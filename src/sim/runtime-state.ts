import {
  STATE_TRANSITION_VERSION,
  UNIVERSE_DEFINITION_VERSION,
  UNIVERSE_STATE_VERSION,
  type RuntimeRandomDecision,
  type RuntimeRandomState,
  type RuntimeWorldObject,
  type StateDiffOperation,
  type StateTransition,
  type TransitionInput,
  type UniverseState,
} from "./contracts/runtime";
import type {
  ActionModuleSpec,
  BoundaryModuleSpec,
  ConstitutionWorldObject,
  InterventionModuleSpec,
  OntologyModuleSpec,
  RuleExecutionRecord,
  UniverseConstitution,
} from "./contracts/constitution";
import { assertUniverseConstitution, constitutionModule } from "./constitution-validation";
import { executeConstitutionStep } from "./constitution-executor";
import { advanceSimulationClock, createSimulationClock, setSimulationRunStatus, setSimulationSpeed } from "./runtime-clock";
import { runtimeFingerprint } from "./runtime-integrity";
import { createRuntimeRandomStream } from "./runtime-random";
import { normalizeSeed } from "./random";
import type { SimulationRunStatus, SimulationSpeed } from "./contracts/runtime";
import { inputAdjustments } from "./branch-inputs";
import { createRuntimeTopology } from "./runtime-topology";
import { completeAutonomyStep, createInitialAutonomyState, prepareAutonomyStep } from "./autonomy";
import { assertRuntimeStateIntegrity, runtimeLogicalClockIdentity, runtimeStateId } from "./runtime-state-integrity";

export type CreateUniverseStateInput = { seed: string; constitution: UniverseConstitution };

const PRIMARY_STREAM = "constitution.evolution";

export function createInitialUniverseState(input: CreateUniverseStateInput): UniverseState {
  const seed = normalizeSeed(input.seed);
  const constitution = assertUniverseConstitution(input.constitution);
  const universeDefinitionId = "runtime-definition:" + runtimeFingerprint({ seed, constitution });
  const ontology = constitutionModule<OntologyModuleSpec>(constitution, "ontology").spec;
  const rules = constitutionModule<ActionModuleSpec>(constitution, "action").spec.rules;
  const boundary = constitutionModule<BoundaryModuleSpec>(constitution, "boundary").spec;
  const objectEntries = ontology.objectKinds.flatMap((kind) => Array.from({ length: kind.initialCount ?? 1 }, (_, instanceIndex) => ({ kind, instanceIndex })));
  if (objectEntries.length > boundary.maximumObjects) throw new Error("OBJECT_BUDGET｜objects｜初始对象数量超过宪法预算。");
  const objects = Object.fromEntries(objectEntries.map(({ kind, instanceIndex }, index) => {
    const object = freezeObject({
      id: "runtime.object." + String(index + 1).padStart(2, "0"),
      kind: kind.id,
      status: kind.initialStatus,
      revision: 0,
      createdAtTick: 0,
      updatedAtTick: 0,
      attributes: Object.fromEntries(kind.attributes.map((attribute) => [attribute.id, attribute.initial])),
    });
    return [object.id, object, instanceIndex] as const;
  }).map(([id, object]) => [id, object]));
  const topology = createRuntimeTopology(constitution, objects);
  if (Object.keys(topology.relations).length > boundary.maximumRelations) throw new Error("RELATION_BUDGET｜relations｜初始关系数量超过宪法预算。");
  const random = createRuntimeRandomStream(runtimeSeedMaterial(seed, constitution), PRIMARY_STREAM);
  const core = {
    version: UNIVERSE_STATE_VERSION,
    identity: {
      version: UNIVERSE_DEFINITION_VERSION,
      universeDefinitionId,
      seed,
      constitutionId: constitution.constitutionId,
      constitution,
      initialInputIds: Object.freeze([]),
    },
    clock: createSimulationClock(),
    rules,
    objects,
    topology,
    autonomy: createInitialAutonomyState(),
    randomStreams: { [random.streamId]: random.snapshot() },
    inputLog: [],
    transitions: [],
    committedTransitionIds: [],
  } satisfies Omit<UniverseState, "id">;
  return freezeState({ ...core, id: runtimeStateId(core) });
}

export function advanceUniverseState(state: UniverseState, inputs: readonly TransitionInput[] = []): UniverseState {
  assertRuntimeStateIntegrity(state);
  return advanceValidatedUniverseState(state, inputs);
}

/** 仅供语义重放使用，调用方必须从已校验初态开始并逐步比较每个转换。 */
export function advanceUniverseStateForSemanticReplay(state: UniverseState, inputs: readonly TransitionInput[] = []): UniverseState {
  return advanceValidatedUniverseState(state, inputs);
}

function advanceValidatedUniverseState(state: UniverseState, inputs: readonly TransitionInput[]): UniverseState {
  const orderedInputs = normalizeTransitionInputs(state, inputs);
  const savedRandom = Object.values(state.randomStreams).find((entry) => entry.namespace === PRIMARY_STREAM);
  if (!savedRandom) throw new Error("运行状态缺少宪法随机流。");
  let random = createRuntimeRandomStream(runtimeSeedMaterial(state.identity.seed, state.identity.constitution), PRIMARY_STREAM, savedRandom);
  const randomDecisions: RuntimeRandomDecision[] = [];
  let randomCheckpoint: { state: RuntimeRandomState; decisionCount: number } | undefined;
  const autonomyPreparation = prepareAutonomyStep(state);
  const result = executeConstitutionStep(
    state.identity.constitution,
    state.objects,
    {
      int(minimum, maximum) {
        const value = random.int(minimum, maximum);
        const decision = random.lastDecision;
        if (!decision) throw new Error("运行随机决定记录缺失。");
        randomDecisions.push(decision);
        return { id: decision.id, value };
      },
      checkpoint() {
        randomCheckpoint = { state: random.snapshot(), decisionCount: randomDecisions.length };
      },
      rollback() {
        random = createRuntimeRandomStream(runtimeSeedMaterial(state.identity.seed, state.identity.constitution), PRIMARY_STREAM, randomCheckpoint!.state);
        randomDecisions.splice(randomCheckpoint!.decisionCount);
      },
    },
    state.clock.tick,
    inputAdjustments(state, orderedInputs),
    autonomyPreparation.autonomousRuleIdsByObject,
  );
  const autonomyResult = completeAutonomyStep(state, autonomyPreparation, result, state.clock.tick + 1);
  const boundary = constitutionModule<BoundaryModuleSpec>(state.identity.constitution, "boundary").spec;
  if (Object.keys(result.objects).length > boundary.maximumObjects) throw new Error("OBJECT_BUDGET｜objects｜转换后对象数量超过宪法预算。");
  const ruleExecutions = Object.freeze([...result.records, ...inputExecutionRecords(orderedInputs, state.identity.constitution)]);
  const nextClock = advanceSimulationClock(state.clock);
  const differences = freezeDifferences([
    ...result.differences.map((entry) => Object.freeze({ operation: "update" as const, ...entry })),
    ...objectMetadataDifferences(state.objects, result.objects, ruleExecutions),
  ]);
  const randomDecisionIds = randomDecisions.map((entry) => entry.id);
  const transitionId = "runtime-transition:" + runtimeFingerprint({
    beforeStateId: state.id,
    fromTick: state.clock.tick,
    toTick: nextClock.tick,
    inputIds: orderedInputs.map((entry) => entry.id),
    ruleExecutions,
    randomDecisionIds,
    randomDecisions,
    differences,
    autonomy: autonomyResult.transition,
  });
  const committedTransitionIds = [...state.committedTransitionIds, transitionId];
  const nextRandomState = random.snapshot();
  const nextCore = {
    version: UNIVERSE_STATE_VERSION,
    identity: state.identity,
    clock: nextClock,
    rules: state.rules,
    objects: result.objects,
    topology: state.topology,
    autonomy: autonomyResult.state,
    randomStreams: { ...state.randomStreams, [nextRandomState.streamId]: nextRandomState },
    inputLog: [...state.inputLog, ...orderedInputs],
    transitions: state.transitions,
    committedTransitionIds,
  } satisfies Omit<UniverseState, "id">;
  const afterStateId = runtimeStateId(nextCore);
  const transition = freezeTransition({
    version: STATE_TRANSITION_VERSION,
    id: transitionId,
    beforeStateId: state.id,
    afterStateId,
    fromTick: state.clock.tick,
    toTick: nextClock.tick,
    inputIds: orderedInputs.map((entry) => entry.id),
    ruleIds: ruleExecutions.filter((entry) => entry.status === "applied").map((entry) => entry.ruleId),
    randomDecisionIds,
    randomDecisions,
    ruleExecutions,
    differences,
    autonomy: autonomyResult.transition,
  });
  return freezeState({ ...nextCore, id: afterStateId, transitions: [...state.transitions, transition] });
}

export function runtimeStateFingerprint(state: UniverseState): string {
  return runtimeFingerprint({
    identity: state.identity,
    clock: runtimeLogicalClockIdentity(state.clock),
    rules: state.rules,
    objects: state.objects,
    topology: state.topology,
    autonomy: state.autonomy,
    randomStreams: state.randomStreams,
    inputLog: state.inputLog,
    transitions: state.transitions,
    committedTransitionIds: state.committedTransitionIds,
  });
}

export function restoreUniverseState(snapshot: UniverseState): UniverseState {
  const restored = freezeState(structuredClone(snapshot));
  assertRuntimeStateIntegrity(restored);
  return restored;
}

export function configureUniverseClock(state: UniverseState, configuration: { status?: SimulationRunStatus; speed?: SimulationSpeed }): UniverseState {
  assertRuntimeStateIntegrity(state);
  let clock = state.clock;
  if (configuration.status !== undefined) clock = setSimulationRunStatus(clock, configuration.status);
  if (configuration.speed !== undefined) clock = setSimulationSpeed(clock, configuration.speed);
  const core = { ...state, clock };
  return freezeState({ ...core, id: runtimeStateId(core) });
}

function normalizeTransitionInputs(state: UniverseState, inputs: readonly TransitionInput[]): readonly TransitionInput[] {
  const existingIds = new Set(state.inputLog.map((entry) => entry.id));
  const lastOrder = state.inputLog.at(-1)?.order ?? -1;
  const normalized = inputs.map((entry) => Object.freeze({ ...entry, payload: Object.freeze({ ...entry.payload }) }));
  for (const [index, entry] of normalized.entries()) {
    if (!entry.id || existingIds.has(entry.id)) throw new Error("状态转换输入 ID 重复或为空。");
    if (!Number.isSafeInteger(entry.order) || entry.order <= lastOrder || (index > 0 && entry.order <= normalized[index - 1].order)) throw new Error("状态转换输入顺序无效。");
    existingIds.add(entry.id);
  }
  return Object.freeze(normalized);
}

function objectMetadataDifferences(
  before: Readonly<Record<string, RuntimeWorldObject>>,
  after: Readonly<Record<string, ConstitutionWorldObject>>,
  records: readonly RuleExecutionRecord[],
): StateDiffOperation[] {
  return Object.values(after).flatMap((object) => {
    const previous = before[object.id];
    const ruleId = records.find((entry) => entry.objectId === object.id && entry.status === "applied")?.ruleId ?? "constitution.input-adjustment@1";
    if (!previous || previous.revision === object.revision) return [];
    return [
      { operation: "update", objectId: object.id, field: "revision", before: previous.revision, after: object.revision, ruleId },
      { operation: "update", objectId: object.id, field: "updatedAtTick", before: previous.updatedAtTick, after: object.updatedAtTick, ruleId },
    ];
  });
}

function freezeDifferences(differences: StateDiffOperation[]): readonly StateDiffOperation[] {
  return Object.freeze(differences.filter((entry) => entry.before !== entry.after).map((entry) => Object.freeze(entry)));
}

function freezeObject(object: RuntimeWorldObject): RuntimeWorldObject {
  return Object.freeze({ ...object, attributes: Object.freeze({ ...object.attributes }) });
}

function freezeTransition(transition: StateTransition): StateTransition {
  return Object.freeze({
    ...transition,
    inputIds: Object.freeze([...transition.inputIds]),
    ruleIds: Object.freeze([...transition.ruleIds]),
    randomDecisionIds: Object.freeze([...transition.randomDecisionIds]),
    randomDecisions: Object.freeze(transition.randomDecisions.map((decision) => Object.freeze({ ...decision, parameters: Object.freeze({ ...decision.parameters }) }))),
    ruleExecutions: Object.freeze(transition.ruleExecutions.map((record) => Object.freeze({
      ...record,
      conditionRecords: Object.freeze([...record.conditionRecords]),
      constraintRecords: Object.freeze([...record.constraintRecords]),
      effectFields: Object.freeze([...record.effectFields]),
      randomDecisionIds: Object.freeze([...record.randomDecisionIds]),
      inputIds: Object.freeze([...record.inputIds]),
    }))),
    differences: Object.freeze([...transition.differences]),
    autonomy: structuredFreeze(structuredClone(transition.autonomy)),
  });
}

function inputExecutionRecords(inputs: readonly TransitionInput[], constitution: UniverseConstitution): readonly RuleExecutionRecord[] {
  const adjustments = inputs.filter((input) => input.kind === "experiment.adjust-condition@1" || input.kind === "intervention.apply-pulse@1");
  if (adjustments.length === 0) return Object.freeze([]);
  const groups = new Map<string, TransitionInput[]>();
  for (const input of adjustments) {
    const objectId = String(input.payload.objectId ?? "");
    groups.set(objectId, [...(groups.get(objectId) ?? []), input]);
  }
  return Object.freeze([...groups.entries()].map(([objectId, entries]) => {
    const capabilities = constitutionModule<InterventionModuleSpec>(constitution, "intervention").spec.capabilities;
    const effectFields = entries.flatMap((entry) => {
      const capability = capabilities.find((candidate) => candidate.id === entry.payload.capabilityId);
      return [String(entry.payload.field), ...(capability?.costField ? [capability.costField] : [])];
    });
    const payload = {
      ruleId: "constitution.input-adjustment@1",
      objectId,
      priority: Number.MAX_SAFE_INTEGER,
      status: "applied" as const,
      conditionRecords: Object.freeze([]),
      constraintRecords: Object.freeze([]),
      effectFields: Object.freeze([...new Set(effectFields)].sort()),
      randomDecisionIds: Object.freeze([]),
      inputIds: Object.freeze(entries.map((entry) => entry.id)),
      arbitration: "显式实验或宇宙内干预通过宪法能力与字段约束后原子提交。",
    };
    return Object.freeze({ ...payload, id: "rule-execution:" + runtimeFingerprint(payload) });
  }));
}

function freezeState(state: UniverseState): UniverseState {
  return Object.freeze({
    ...state,
    identity: Object.freeze({ ...state.identity, constitution: structuredFreeze(state.identity.constitution), initialInputIds: Object.freeze([...state.identity.initialInputIds]) }),
    clock: Object.freeze({ ...state.clock }),
    rules: Object.freeze(state.rules.map((rule) => structuredFreeze(rule))),
    objects: Object.freeze(Object.fromEntries(Object.entries(state.objects).map(([id, object]) => [id, freezeObject(object)]))),
    topology: structuredFreeze(structuredClone(state.topology)),
    autonomy: structuredFreeze(structuredClone(state.autonomy)),
    randomStreams: Object.freeze(Object.fromEntries(Object.entries(state.randomStreams).map(([id, random]) => [id, Object.freeze({ ...random })]))),
    inputLog: Object.freeze(state.inputLog.map((entry) => Object.freeze({ ...entry, payload: Object.freeze({ ...entry.payload }) }))),
    transitions: Object.freeze(state.transitions.map((transition) => freezeTransition({ ...transition, differences: transition.differences.map((entry) => Object.freeze({ ...entry })) }))),
    committedTransitionIds: Object.freeze([...state.committedTransitionIds]),
  });
}

function runtimeSeedMaterial(seed: string, constitution: UniverseConstitution): string {
  return constitution.executorVersion + ":" + constitution.contentFingerprint + ":" + seed + ":runtime";
}

function structuredFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) structuredFreeze(child);
  return value;
}
