import {
  AUTONOMY_PROTOCOL_VERSION,
  type AutonomyState,
  type AutonomyTransition,
  type AutonomousAction,
  type AutonomousBelief,
  type AutonomousEntity,
  type AutonomousIntent,
  type AutonomousMemory,
  type AutonomousMythArchive,
  type AutonomousNarrative,
  type AutonomousPerception,
  type AutonomousRelation,
} from "./contracts/autonomy";
import type { AutonomousEntityPolicy, BoundaryModuleSpec, CognitionModuleSpec, ConstitutionValue, NumericOperator, RuleExecutionResult } from "./contracts/constitution";
import type { UniverseState } from "./contracts/runtime";
import { constitutionModule } from "./constitution-validation";
import { runtimeFingerprint } from "./runtime-integrity";

export type AutonomyPreparation = {
  state: AutonomyState;
  transition: Omit<AutonomyTransition, "actions" | "formedRelationIds" | "ceasedRelationIds" | "narrativeIds" | "mythArchiveIds">;
  autonomousRuleIdsByObject: Readonly<Record<string, readonly string[]>>;
};

export function createInitialAutonomyState(): AutonomyState {
  return freezeAutonomy({ version: AUTONOMY_PROTOCOL_VERSION, entities: {}, relations: {}, narratives: {}, mythArchives: {} });
}

export function prepareAutonomyStep(state: UniverseState): AutonomyPreparation {
  const cognition = constitutionModule<CognitionModuleSpec>(state.identity.constitution, "cognition").spec;
  const policies = cognition.autonomyPolicies ?? [];
  if (policies.length === 0) return Object.freeze({
    state: state.autonomy,
    transition: emptyPreparationTransition(),
    autonomousRuleIdsByObject: Object.freeze({}),
  });
  const boundary = constitutionModule<BoundaryModuleSpec>(state.identity.constitution, "boundary").spec;
  const entities = new Map(Object.entries(state.autonomy.entities).map(([id, entity]) => [id, cloneEntity(entity)]));
  const formedEntityIds: string[] = [];
  const ceasedEntityIds: string[] = [];
  const perceptions: AutonomousPerception[] = [];
  const memories: AutonomousMemory[] = [];
  const beliefs: AutonomousBelief[] = [];
  const intents: AutonomousIntent[] = [];
  const autonomousRuleIdsByObject: Record<string, string[]> = {};
  for (const object of Object.values(state.objects).sort((left, right) => left.id.localeCompare(right.id))) {
    for (const policy of policies.filter((entry) => entry.targetKind === object.kind).sort((left, right) => left.id.localeCompare(right.id))) {
      const entityId = entityIdentity(state.identity.universeDefinitionId, object.id, policy.id);
      let entity = entities.get(entityId);
      if (!entity && conditionSatisfied(object.attributes, policy.activation.operator, policy.activation.field, policy.activation.value)) {
        const ordinal = Object.values(state.objects).filter((candidate) => candidate.kind === object.kind).sort((left, right) => left.id.localeCompare(right.id)).findIndex((candidate) => candidate.id === object.id) + 1;
        entity = {
          id: entityId,
          objectId: object.id,
          policyId: policy.id,
          name: `${policy.name} ${ordinal}`,
          status: "active",
          formedAtTick: state.clock.tick,
          memories: [],
          beliefs: [],
        };
        entities.set(entityId, entity);
        formedEntityIds.push(entityId);
      }
      if (!entity || entity.status !== "active") continue;
      if (policy.deactivation && conditionSatisfied(object.attributes, policy.deactivation.operator, policy.deactivation.field, policy.deactivation.value)) {
        entities.set(entityId, { ...entity, status: "ceased", ceasedAtTick: state.clock.tick });
        ceasedEntityIds.push(entityId);
        continue;
      }
      const localPerceptions = policy.perceptions.map((definition) => createPerception(state, entity!, definition.field, definition.bias ?? 0, definition.uncertainty));
      const perceptionMemories = localPerceptions.map((perception) => createMemory(entityId, "perception", perception.id, `${perception.field} 被感知为 ${String(perception.perceivedValue)}。`, state.clock.tick));
      const nextMemories = boundedMemories([...entity.memories, ...perceptionMemories], policy.memoryCapacity);
      const localBeliefs = localPerceptions.map((perception, index) => createBelief(entityId, perception, [perceptionMemories[index]]));
      const mergedBeliefs = mergeBeliefs(entity.beliefs, localBeliefs);
      const intent = createIntent(entityId, policy, mergedBeliefs, state.clock.tick);
      entities.set(entityId, { ...entity, memories: nextMemories, beliefs: mergedBeliefs, lastIntent: intent });
      perceptions.push(...localPerceptions);
      memories.push(...perceptionMemories);
      beliefs.push(...localBeliefs);
      intents.push(intent);
      if (intent.actionRuleId) autonomousRuleIdsByObject[object.id] = [...(autonomousRuleIdsByObject[object.id] ?? []), intent.actionRuleId];
    }
  }
  const maximumEntities = boundary.maximumAutonomousEntities ?? 0;
  if (entities.size > maximumEntities) throw new Error("AUTONOMY_ENTITY_BUDGET｜autonomy.entities");
  return Object.freeze({
    state: freezeAutonomy({ ...state.autonomy, entities: Object.fromEntries(entities) }),
    transition: Object.freeze({
      formedEntityIds: Object.freeze(formedEntityIds),
      ceasedEntityIds: Object.freeze(ceasedEntityIds),
      perceptions: Object.freeze(perceptions),
      memories: Object.freeze(memories),
      beliefs: Object.freeze(beliefs),
      intents: Object.freeze(intents),
    }),
    autonomousRuleIdsByObject: Object.freeze(Object.fromEntries(Object.entries(autonomousRuleIdsByObject).map(([id, ids]) => [id, Object.freeze([...new Set(ids)].sort())]))),
  });
}

export function completeAutonomyStep(state: UniverseState, preparation: AutonomyPreparation, result: RuleExecutionResult, tick: number): { state: AutonomyState; transition: AutonomyTransition } {
  const cognition = constitutionModule<CognitionModuleSpec>(state.identity.constitution, "cognition").spec;
  const policies = new Map((cognition.autonomyPolicies ?? []).map((policy) => [policy.id, policy]));
  const entities = new Map(Object.entries(preparation.state.entities).map(([id, entity]) => [id, cloneEntity(entity)]));
  const actions: AutonomousAction[] = [];
  const actionMemories: AutonomousMemory[] = [];
  for (const intent of preparation.transition.intents) {
    const entity = entities.get(intent.entityId);
    if (!entity) throw new Error("AUTONOMY_ENTITY｜autonomy.entities");
    const policy = policies.get(entity.policyId);
    if (!policy) throw new Error("AUTONOMY_POLICY｜cognition.autonomyPolicies");
    const execution = intent.actionRuleId ? result.records.find((record) => record.objectId === entity.objectId && record.ruleId === intent.actionRuleId) : undefined;
    const differenceIndexes = execution?.status === "applied" ? result.differences.map((difference, index) => ({ difference, index })).filter(({ difference }) => difference.objectId === entity.objectId && difference.ruleId === execution.ruleId).map(({ index }) => index) : [];
    const action = createAction(entity.id, intent, execution, differenceIndexes, tick);
    const memory = createMemory(entity.id, "action", action.id, action.reason, tick);
    const memories = boundedMemories([...entity.memories, memory], policy.memoryCapacity);
    entities.set(entity.id, { ...entity, memories, lastAction: action });
    actions.push(action);
    actionMemories.push(memory);
  }
  const narrativeResult = updateNarratives(preparation.state.narratives, preparation.state.mythArchives, entities, policies, tick);
  const relationResult = updateRelations(state, preparation.state.relations, entities, tick);
  const next = freezeAutonomy({
    version: AUTONOMY_PROTOCOL_VERSION,
    entities: Object.fromEntries(entities),
    relations: relationResult.relations,
    narratives: narrativeResult.narratives,
    mythArchives: narrativeResult.mythArchives,
  });
  return {
    state: next,
    transition: Object.freeze({
      ...preparation.transition,
      memories: Object.freeze([...preparation.transition.memories, ...actionMemories]),
      actions: Object.freeze(actions),
      formedRelationIds: Object.freeze(relationResult.formed),
      ceasedRelationIds: Object.freeze(relationResult.ceased),
      narrativeIds: Object.freeze(narrativeResult.formed),
      mythArchiveIds: Object.freeze(narrativeResult.formedMyths),
    }),
  };
}

function createPerception(state: UniverseState, entity: AutonomousEntity, field: string, bias: number, uncertainty: string): AutonomousPerception {
  const object = state.objects[entity.objectId];
  const actual = object?.attributes[field];
  if (actual === undefined) throw new Error("AUTONOMY_PERCEPTION_FIELD｜autonomy.perception.field");
  const perceivedValue = typeof actual === "number" ? actual + bias : actual;
  const payload = { entityId: entity.id, objectId: entity.objectId, field, perceivedValue, uncertainty, sourceStateId: state.id, tick: state.clock.tick };
  return Object.freeze({ ...payload, id: "autonomy-perception:" + runtimeFingerprint(payload) });
}

function createMemory(entityId: string, kind: AutonomousMemory["kind"], sourceId: string, summary: string, tick: number): AutonomousMemory {
  const payload = { entityId, kind, sourceId, summary, tick };
  return Object.freeze({ ...payload, id: "autonomy-memory:" + runtimeFingerprint(payload) });
}

function createBelief(entityId: string, perception: AutonomousPerception, memories: readonly AutonomousMemory[]): AutonomousBelief {
  const memoryIds = memories.filter((memory) => memory.sourceId === perception.id).map((memory) => memory.id);
  const payload = { entityId, field: perception.field, believedValue: perception.perceivedValue, confidence: perception.uncertainty === "确定" ? 1 : 0.6, memoryIds, formedAtTick: perception.tick };
  return Object.freeze({ ...payload, id: "autonomy-belief:" + runtimeFingerprint(payload), memoryIds: Object.freeze(memoryIds) });
}

function createIntent(entityId: string, policy: AutonomousEntityPolicy, beliefs: readonly AutonomousBelief[], tick: number): AutonomousIntent {
  const action = [...policy.actions].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id)).find((candidate) => {
    const belief = beliefs.find((entry) => entry.field === candidate.beliefField);
    return belief && typeof belief.believedValue === "number" && compare(candidate.operator, belief.believedValue, candidate.value);
  });
  const beliefIds = action ? beliefs.filter((belief) => belief.field === action.beliefField).map((belief) => belief.id) : beliefs.map((belief) => belief.id);
  const payload = { entityId, goal: action?.goal ?? "保持观察", ...(action ? { actionRuleId: action.ruleId } : {}), beliefIds, status: action ? "act" as const : "idle" as const, formedAtTick: tick };
  return Object.freeze({ ...payload, id: "autonomy-intent:" + runtimeFingerprint(payload), beliefIds: Object.freeze(beliefIds) });
}

function createAction(entityId: string, intent: AutonomousIntent, execution: RuleExecutionResult["records"][number] | undefined, differenceIndexes: readonly number[], tick: number): AutonomousAction {
  const status: AutonomousAction["status"] = !intent.actionRuleId ? "idle" : execution?.status === "applied" ? "applied" : "rejected";
  const reason = status === "idle" ? "当前不行动。" : status === "applied" ? "行动通过规则并产生后果。" : `行动被拒绝：${executionRejectionLabel(execution?.status)}。`;
  const payload = { entityId, intentId: intent.id, ...(intent.actionRuleId ? { ruleId: intent.actionRuleId } : {}), status, ...(execution ? { executionRecordId: execution.id } : {}), differenceIndexes, reason, tick };
  return Object.freeze({ ...payload, id: "autonomy-action:" + runtimeFingerprint(payload), differenceIndexes: Object.freeze([...differenceIndexes]) });
}

function executionRejectionLabel(status: RuleExecutionResult["records"][number]["status"] | undefined): string {
  if (status === "condition-rejected") return "条件不成立";
  if (status === "constraint-rejected") return "约束不允许";
  if (status === "cost-rejected") return "代价不足";
  if (status === "arbitration-rejected") return "规则或预算拒绝";
  return "缺少执行记录";
}

function updateNarratives(
  current: Readonly<Record<string, AutonomousNarrative>>,
  currentMyths: Readonly<Record<string, AutonomousMythArchive>>,
  entities: ReadonlyMap<string, AutonomousEntity>,
  policies: ReadonlyMap<string, AutonomousEntityPolicy>,
  tick: number,
): { narratives: Readonly<Record<string, AutonomousNarrative>>; mythArchives: Readonly<Record<string, AutonomousMythArchive>>; formed: string[]; formedMyths: string[] } {
  const narratives = new Map(Object.entries(current));
  const mythArchives = new Map(Object.entries(currentMyths));
  const formed: string[] = [];
  const formedMyths: string[] = [];
  for (const entity of [...entities.values()].filter((entry) => entry.status === "active").sort((left, right) => left.id.localeCompare(right.id))) {
    const definition = policies.get(entity.policyId)?.narrative;
    if (!definition) continue;
    const id = "autonomy-narrative:" + runtimeFingerprint({ entityId: entity.id, definitionId: definition.id });
    if (narratives.has(id)) continue;
    const belief = entity.beliefs.find((entry) => entry.field === definition.beliefField);
    if (!belief) continue;
    const claim = definition.template.replace("{value}", String(belief.believedValue));
    const narrative = Object.freeze({ id, entityId: entity.id, definitionId: definition.id, title: definition.title, claim, beliefId: belief.id, formedAtTick: tick });
    narratives.set(id, narrative);
    formed.push(id);
    if (definition.archiveAsMyth) {
      const mythId = "autonomy-myth:" + runtimeFingerprint({ sourceNarrativeId: id });
      mythArchives.set(mythId, Object.freeze({ id: mythId, sourceNarrativeId: id, formedAtTick: tick }));
      formedMyths.push(mythId);
    }
  }
  return { narratives: Object.freeze(Object.fromEntries(narratives)), mythArchives: Object.freeze(Object.fromEntries(mythArchives)), formed, formedMyths };
}

function updateRelations(
  state: UniverseState,
  current: Readonly<Record<string, AutonomousRelation>>,
  entities: ReadonlyMap<string, AutonomousEntity>,
  tick: number,
): { relations: Readonly<Record<string, AutonomousRelation>>; formed: string[]; ceased: string[] } {
  const relations = new Map(Object.entries(current));
  const formed: string[] = [];
  const ceased: string[] = [];
  const activeByObject = new Map([...entities.values()].filter((entry) => entry.status === "active").map((entry) => [entry.objectId, entry]));
  for (const topology of Object.values(state.topology.relations).sort((left, right) => left.id.localeCompare(right.id))) {
    const source = activeByObject.get(topology.sourceObjectId);
    const target = activeByObject.get(topology.targetObjectId);
    if (!source || !target || source.id === target.id) continue;
    const id = "autonomy-relation:" + runtimeFingerprint({ topologyId: topology.id, sourceEntityId: source.id, targetEntityId: target.id });
    if (!relations.has(id)) {
      relations.set(id, Object.freeze({ id, sourceEntityId: source.id, targetEntityId: target.id, typeId: topology.typeId, name: topology.name, status: "active", formedAtTick: tick }));
      formed.push(id);
    }
  }
  for (const [id, relation] of relations) {
    if (relation.status === "active" && (!isActive(entities.get(relation.sourceEntityId)) || !isActive(entities.get(relation.targetEntityId)))) {
      relations.set(id, Object.freeze({ ...relation, status: "ceased", ceasedAtTick: tick }));
      ceased.push(id);
    }
  }
  return { relations: Object.freeze(Object.fromEntries(relations)), formed, ceased };
}

function emptyPreparationTransition(): AutonomyPreparation["transition"] {
  return Object.freeze({ formedEntityIds: Object.freeze([]), ceasedEntityIds: Object.freeze([]), perceptions: Object.freeze([]), memories: Object.freeze([]), beliefs: Object.freeze([]), intents: Object.freeze([]) });
}

function entityIdentity(universeDefinitionId: string, objectId: string, policyId: string): string {
  return "autonomy-entity:" + runtimeFingerprint({ universeDefinitionId, objectId, policyId });
}

function conditionSatisfied(attributes: Readonly<Record<string, ConstitutionValue>>, operator: NumericOperator, field: string, expected: number): boolean {
  const actual = attributes[field];
  return typeof actual === "number" && compare(operator, actual, expected);
}

function compare(operator: NumericOperator, actual: number, expected: number): boolean {
  if (operator === "lt") return actual < expected;
  if (operator === "lte") return actual <= expected;
  if (operator === "eq") return actual === expected;
  if (operator === "gte") return actual >= expected;
  return actual > expected;
}

function mergeBeliefs(current: readonly AutonomousBelief[], next: readonly AutonomousBelief[]): readonly AutonomousBelief[] {
  const replaced = new Set(next.map((belief) => belief.field));
  return Object.freeze([...current.filter((belief) => !replaced.has(belief.field)), ...next].sort((left, right) => left.field.localeCompare(right.field)));
}

function boundedMemories(memories: readonly AutonomousMemory[], capacity: number): readonly AutonomousMemory[] {
  return Object.freeze([...memories].sort((left, right) => left.tick - right.tick || left.id.localeCompare(right.id)).slice(-capacity));
}

function cloneEntity(entity: AutonomousEntity): AutonomousEntity {
  return { ...entity, memories: [...entity.memories], beliefs: [...entity.beliefs] };
}

function isActive(entity: AutonomousEntity | undefined): boolean {
  return entity?.status === "active";
}

function freezeAutonomy(state: AutonomyState): AutonomyState {
  return deepFreeze(structuredClone(state));
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}
