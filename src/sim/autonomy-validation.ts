import { AUTONOMY_PROTOCOL_VERSION, type AutonomousBelief, type AutonomousIntent, type AutonomousMemory } from "./contracts/autonomy";
import type { CognitionModuleSpec } from "./contracts/constitution";
import type { UniverseState } from "./contracts/runtime";
import { constitutionModule } from "./constitution-validation";

export function assertAutonomyStateIntegrity(state: UniverseState): void {
  if (state.autonomy.version !== AUTONOMY_PROTOCOL_VERSION) {
    fail("AUTONOMY_VERSION", "autonomy.version");
  }
  const policies = new Map((constitutionModule<CognitionModuleSpec>(state.identity.constitution, "cognition").spec.autonomyPolicies ?? []).map((policy) => [policy.id, policy]));
  const entities = new Map(Object.entries(state.autonomy.entities));
  const perceptions = new Map(state.transitions.flatMap((transition) => transition.autonomy.perceptions.map((entry) => [entry.id, entry] as const)));
  const memories = new Map(state.transitions.flatMap((transition) => transition.autonomy.memories.map((entry) => [entry.id, entry] as const)));
  const beliefs = new Map(state.transitions.flatMap((transition) => transition.autonomy.beliefs.map((entry) => [entry.id, entry] as const)));
  const intents = new Map(state.transitions.flatMap((transition) => transition.autonomy.intents.map((entry) => [entry.id, entry] as const)));
  const actions = new Map(state.transitions.flatMap((transition) => transition.autonomy.actions.map((entry) => [entry.id, entry] as const)));

  for (const [key, entity] of entities) {
    const path = `autonomy.entities.${key}`;
    if (key !== entity.id) fail("AUTONOMY_ENTITY_ID", `${path}.id`);
    const object = state.objects[entity.objectId];
    if (!object) fail("AUTONOMY_ENTITY_OBJECT", `${path}.objectId`);
    const policy = policies.get(entity.policyId);
    if (!policy) fail("AUTONOMY_ENTITY_POLICY", `${path}.policyId`);
    if (policy.targetKind !== object.kind) fail("AUTONOMY_ENTITY_POLICY", `${path}.policyId`);
    if (entity.status === "ceased" && (!Number.isSafeInteger(entity.ceasedAtTick) || entity.ceasedAtTick! < entity.formedAtTick)) {
      fail("AUTONOMY_ENTITY_LIFECYCLE", `${path}.ceasedAtTick`);
    }
    if (entity.status === "active" && entity.ceasedAtTick !== undefined) fail("AUTONOMY_ENTITY_LIFECYCLE", `${path}.ceasedAtTick`);
    for (const memory of entity.memories) assertEntityMemory(memory, entity.id, memories, path);
    for (const belief of entity.beliefs) assertEntityBelief(belief, entity.id, memories, beliefs, path);
    if (entity.lastIntent) assertEntityIntent(entity.lastIntent, entity.id, beliefs, intents, path);
    if (entity.lastAction) {
      const historical = actions.get(entity.lastAction.id);
      if (!historical || historical.entityId !== entity.id) fail("AUTONOMY_ACTION_REFERENCE", `${path}.lastAction`);
    }
  }

  for (const [id, memory] of memories) {
    const path = `autonomy.memories.${id}`;
    if (!entities.has(memory.entityId)) fail("AUTONOMY_MEMORY_ENTITY", `${path}.entityId`);
    const source = memory.kind === "perception" ? perceptions.get(memory.sourceId) : actions.get(memory.sourceId);
    if (!source || source.entityId !== memory.entityId) fail("AUTONOMY_MEMORY_SOURCE", `${path}.sourceId`);
  }
  for (const [id, belief] of beliefs) assertEntityBelief(belief, belief.entityId, memories, beliefs, `autonomy.beliefs.${id}`);
  for (const [id, intent] of intents) assertEntityIntent(intent, intent.entityId, beliefs, intents, `autonomy.intents.${id}`);
  for (const [id, action] of actions) {
    const path = `autonomy.actions.${id}`;
    const entity = entities.get(action.entityId);
    if (!entity) fail("AUTONOMY_ACTION_ENTITY", `${path}.entityId`);
    const intent = intents.get(action.intentId);
    if (!intent || intent.entityId !== action.entityId) fail("AUTONOMY_ACTION_INTENT", `${path}.intentId`);
    if (entity.status === "ceased" && entity.ceasedAtTick !== undefined && action.tick > entity.ceasedAtTick) {
      fail("AUTONOMY_ACTION_AFTER_CEASED", `${path}.tick`);
    }
  }
  for (const [key, relation] of Object.entries(state.autonomy.relations)) {
    const path = `autonomy.relations.${key}`;
    if (key !== relation.id) fail("AUTONOMY_RELATION_ID", `${path}.id`);
    if (!entities.has(relation.sourceEntityId)) fail("AUTONOMY_RELATION_ENTITY", `${path}.sourceEntityId`);
    if (!entities.has(relation.targetEntityId)) fail("AUTONOMY_RELATION_ENTITY", `${path}.targetEntityId`);
  }
  for (const [key, narrative] of Object.entries(state.autonomy.narratives)) {
    const path = `autonomy.narratives.${key}`;
    if (key !== narrative.id) fail("AUTONOMY_NARRATIVE_ID", `${path}.id`);
    if (!entities.has(narrative.entityId)) fail("AUTONOMY_NARRATIVE_ENTITY", `${path}.entityId`);
    const belief = beliefs.get(narrative.beliefId);
    if (!belief || belief.entityId !== narrative.entityId) fail("AUTONOMY_NARRATIVE_BELIEF", `${path}.beliefId`);
  }
  for (const [key, archive] of Object.entries(state.autonomy.mythArchives)) {
    const path = `autonomy.mythArchives.${key}`;
    if (key !== archive.id) fail("AUTONOMY_MYTH_ID", `${path}.id`);
    const narrative = state.autonomy.narratives[archive.sourceNarrativeId];
    if (!narrative) fail("AUTONOMY_MYTH_NARRATIVE", `${path}.sourceNarrativeId`);
    if (!entities.has(narrative.entityId)) fail("AUTONOMY_MYTH_ENTITY", `${path}.sourceNarrativeId`);
  }
}

function assertEntityMemory(memory: AutonomousMemory, entityId: string, memories: ReadonlyMap<string, AutonomousMemory>, path: string): void {
  const historical = memories.get(memory.id);
  if (!historical || historical.entityId !== entityId) fail("AUTONOMY_MEMORY_REFERENCE", `${path}.memories`);
}

function assertEntityBelief(
  belief: AutonomousBelief,
  entityId: string,
  memories: ReadonlyMap<string, AutonomousMemory>,
  beliefs: ReadonlyMap<string, AutonomousBelief>,
  path: string,
): void {
  if (!entitiesMatch(entityId, belief.entityId)) fail("AUTONOMY_BELIEF_ENTITY", `${path}.entityId`);
  if (!belief.memoryIds.length || belief.memoryIds.some((memoryId) => memories.get(memoryId)?.entityId !== entityId)) {
    fail("AUTONOMY_BELIEF_MEMORY", `${path}.memoryIds`);
  }
  const historical = beliefs.get(belief.id);
  if (!historical || historical.entityId !== entityId) fail("AUTONOMY_BELIEF_REFERENCE", path);
}

function assertEntityIntent(
  intent: AutonomousIntent,
  entityId: string,
  beliefs: ReadonlyMap<string, AutonomousBelief>,
  intents: ReadonlyMap<string, AutonomousIntent>,
  path: string,
): void {
  if (!entitiesMatch(entityId, intent.entityId)) fail("AUTONOMY_INTENT_ENTITY", `${path}.entityId`);
  if (intent.beliefIds.some((beliefId) => beliefs.get(beliefId)?.entityId !== entityId)) fail("AUTONOMY_INTENT_BELIEF", `${path}.beliefIds`);
  const historical = intents.get(intent.id);
  if (!historical || historical.entityId !== entityId) fail("AUTONOMY_INTENT_REFERENCE", path);
}

function entitiesMatch(expected: string, actual: string): boolean {
  return Boolean(expected) && expected === actual;
}

function fail(code: string, path: string): never {
  throw new Error(`${code}｜${path}`);
}
