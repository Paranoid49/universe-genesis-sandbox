import {
  STATE_TRANSITION_VERSION,
  UNIVERSE_DEFINITION_VERSION,
  UNIVERSE_STATE_VERSION,
  type RuntimeRule,
  type RuntimeWorldObject,
  type StateDiffOperation,
  type StateTransition,
  type TransitionInput,
  type UniverseState,
} from "./contracts/runtime";
import { getTemplate } from "./templates";
import {
  advanceSimulationClock,
  createSimulationClock,
  setSimulationRunStatus,
  setSimulationSpeed,
} from "./runtime-clock";
import { runtimeFingerprint } from "./runtime-integrity";
import { createRuntimeRandomStream } from "./runtime-random";
import { clamp, normalizeSeed } from "./random";
import { RULESET_VERSION, type UniverseTemplateId } from "./types";
import type { SimulationRunStatus, SimulationSpeed } from "./contracts/runtime";

export type CreateUniverseStateInput = {
  seed: string;
  rulesetVersion?: string;
  templateId: UniverseTemplateId;
};

const PRIMARY_STREAM = "evolution.primary";
const PRIMARY_OBJECT = "runtime.galaxy.primary";

export function createInitialUniverseState(input: CreateUniverseStateInput): UniverseState {
  const seed = normalizeSeed(input.seed);
  const rulesetVersion = input.rulesetVersion ?? RULESET_VERSION;
  if (rulesetVersion !== RULESET_VERSION) throw new Error("运行时当前只接受明确匹配的规则版本。");
  const template = getTemplate(input.templateId);
  const universeDefinitionId = `runtime-definition:${runtimeFingerprint({ seed, rulesetVersion, templateId: template.id })}`;
  const rules = createRuntimeRules(template.stabilityBias, template.weights.physics, template.weights.magic);
  const object = freezeObject({
    id: PRIMARY_OBJECT,
    kind: "galaxy",
    status: "forming",
    revision: 0,
    createdAtTick: 0,
    updatedAtTick: 0,
    attributes: {
      cohesion: clamp(Math.round(10 + template.weights.physics / 4)),
      energy: clamp(Math.round(65 + template.weights.magic / 5)),
      resonance: clamp(template.weights.causality),
    },
  });
  const random = createRuntimeRandomStream(runtimeSeedMaterial(seed, rulesetVersion, template.id), PRIMARY_STREAM);
  const core = {
    version: UNIVERSE_STATE_VERSION,
    identity: {
      version: UNIVERSE_DEFINITION_VERSION,
      universeDefinitionId,
      seed,
      rulesetVersion,
      templateId: template.id,
      initialInputIds: Object.freeze([]),
    },
    clock: createSimulationClock(),
    rules,
    objects: { [object.id]: object },
    randomStreams: { [random.streamId]: random.snapshot() },
    inputLog: [],
    transitions: [],
    committedTransitionIds: [],
  } satisfies Omit<UniverseState, "id">;
  return freezeState({ ...core, id: stateId(core) });
}

export function advanceUniverseState(state: UniverseState, inputs: readonly TransitionInput[] = []): UniverseState {
  assertUniverseState(state);
  const orderedInputs = normalizeTransitionInputs(state, inputs);
  const rule = state.rules.find((entry) => entry.id === "runtime.rule.structural-evolution@1");
  if (!rule) throw new Error("运行状态缺少结构演化规则。");
  const object = state.objects[PRIMARY_OBJECT];
  if (!object) throw new Error("运行状态缺少主空间对象。");
  const savedRandom = Object.values(state.randomStreams).find((entry) => entry.namespace === PRIMARY_STREAM);
  if (!savedRandom) throw new Error("运行状态缺少主随机流。");
  const random = createRuntimeRandomStream(runtimeSeedMaterial(
    state.identity.seed,
    state.identity.rulesetVersion,
    state.identity.templateId,
  ), PRIMARY_STREAM, savedRandom);
  const cohesionDecision = random.int(-2, 2);
  const cohesionRandomDecision = requiredDecision(random.lastDecision);
  const cohesionDecisionId = cohesionRandomDecision.id;
  const energyDecision = random.int(-2, 2);
  const energyRandomDecision = requiredDecision(random.lastDecision);
  const energyDecisionId = energyRandomDecision.id;
  const beforeCohesion = numericAttribute(object, "cohesion");
  const beforeEnergy = numericAttribute(object, "energy");
  const cohesion = clamp(beforeCohesion + rule.parameters.cohesionGrowth + cohesionDecision);
  const energy = clamp(beforeEnergy + rule.parameters.energyDrift + energyDecision);
  const status = nextStatus(object.status, cohesion, energy);
  const nextClock = advanceSimulationClock(state.clock);
  const nextObject = freezeObject({
    ...object,
    status,
    revision: object.revision + 1,
    updatedAtTick: nextClock.tick,
    attributes: { ...object.attributes, cohesion, energy },
  });
  const differences = freezeDifferences([
    difference(object.id, "attributes.cohesion", beforeCohesion, cohesion, rule.id, cohesionDecisionId),
    difference(object.id, "attributes.energy", beforeEnergy, energy, rule.id, energyDecisionId),
    ...(object.status === status ? [] : [difference(object.id, "status", object.status, status, rule.id)]),
    difference(object.id, "revision", object.revision, nextObject.revision, rule.id),
    difference(object.id, "updatedAtTick", object.updatedAtTick, nextObject.updatedAtTick, rule.id),
  ]);
  const randomDecisionIds = [cohesionDecisionId, energyDecisionId];
  const transitionId = `runtime-transition:${runtimeFingerprint({
    beforeStateId: state.id,
    fromTick: state.clock.tick,
    toTick: nextClock.tick,
    inputIds: orderedInputs.map((entry) => entry.id),
    randomDecisionIds,
    randomDecisions: [cohesionRandomDecision, energyRandomDecision],
    differences,
  })}`;
  const committedTransitionIds = [...state.committedTransitionIds, transitionId];
  const nextRandomState = random.snapshot();
  const nextCore = {
    version: UNIVERSE_STATE_VERSION,
    identity: state.identity,
    clock: nextClock,
    rules: state.rules,
    objects: { ...state.objects, [nextObject.id]: nextObject },
    randomStreams: { ...state.randomStreams, [nextRandomState.streamId]: nextRandomState },
    inputLog: [...state.inputLog, ...orderedInputs],
    transitions: state.transitions,
    committedTransitionIds,
  } satisfies Omit<UniverseState, "id">;
  const afterStateId = stateId(nextCore);
  const transition = freezeTransition({
    version: STATE_TRANSITION_VERSION,
    id: transitionId,
    beforeStateId: state.id,
    afterStateId,
    fromTick: state.clock.tick,
    toTick: nextClock.tick,
    inputIds: orderedInputs.map((entry) => entry.id),
    ruleIds: [rule.id],
    randomDecisionIds,
    randomDecisions: [cohesionRandomDecision, energyRandomDecision],
    differences,
  });
  return freezeState({ ...nextCore, id: afterStateId, transitions: [...state.transitions, transition] });
}

export function runtimeStateFingerprint(state: UniverseState): string {
  return runtimeFingerprint({
    identity: state.identity,
    clock: logicalClockIdentity(state.clock),
    rules: state.rules,
    objects: state.objects,
    randomStreams: state.randomStreams,
    inputLog: state.inputLog,
    transitions: state.transitions,
    committedTransitionIds: state.committedTransitionIds,
  });
}

export function restoreUniverseState(snapshot: UniverseState): UniverseState {
  const restored = freezeState(structuredClone(snapshot));
  assertUniverseState(restored);
  return restored;
}

export function configureUniverseClock(
  state: UniverseState,
  configuration: { status?: SimulationRunStatus; speed?: SimulationSpeed },
): UniverseState {
  assertUniverseState(state);
  let clock = state.clock;
  if (configuration.status !== undefined) clock = setSimulationRunStatus(clock, configuration.status);
  if (configuration.speed !== undefined) clock = setSimulationSpeed(clock, configuration.speed);
  const core = { ...state, clock };
  return freezeState({ ...core, id: stateId(core) });
}

function createRuntimeRules(stabilityBias: number, physics: number, magic: number): readonly RuntimeRule[] {
  const energyDrift = Math.max(-4, Math.min(4, Math.round((magic - physics) / 25))) || 0;
  return Object.freeze([Object.freeze({
    id: "runtime.rule.structural-evolution@1",
    kind: "object-evolution" as const,
    parameters: Object.freeze({
      cohesionGrowth: clamp(Math.round(10 + stabilityBias / 4), 4, 18),
      energyDrift,
    }),
  })]);
}

function normalizeTransitionInputs(state: UniverseState, inputs: readonly TransitionInput[]): readonly TransitionInput[] {
  const existingIds = new Set(state.inputLog.map((entry) => entry.id));
  const lastOrder = state.inputLog.at(-1)?.order ?? -1;
  const normalized = inputs.map((entry) => Object.freeze({ ...entry, payload: Object.freeze({ ...entry.payload }) }));
  for (const [index, entry] of normalized.entries()) {
    if (!entry.id || existingIds.has(entry.id)) throw new Error("状态转换输入 ID 重复或为空。");
    if (!Number.isSafeInteger(entry.order) || entry.order <= lastOrder || (index > 0 && entry.order <= normalized[index - 1].order)) {
      throw new Error("状态转换输入顺序无效。");
    }
    existingIds.add(entry.id);
  }
  return Object.freeze(normalized);
}

function nextStatus(current: RuntimeWorldObject["status"], cohesion: number, energy: number): RuntimeWorldObject["status"] {
  if (energy === 0) return "destroyed";
  if (energy <= 15) return "decaying";
  if (current === "forming" && cohesion >= 60) return "stable";
  return current;
}

function numericAttribute(object: RuntimeWorldObject, field: string): number {
  const value = object.attributes[field];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`运行对象字段 ${field} 不是有效数值。`);
  return value;
}

function difference(
  objectId: string,
  field: string,
  before: string | number | boolean | null,
  after: string | number | boolean | null,
  ruleId: string,
  randomDecisionId?: string,
): StateDiffOperation {
  return Object.freeze({
    operation: "update",
    objectId,
    field,
    before,
    after,
    ruleId,
    ...(randomDecisionId === undefined ? {} : { randomDecisionId }),
  });
}

function freezeDifferences(differences: StateDiffOperation[]): readonly StateDiffOperation[] {
  return Object.freeze(differences.filter((entry) => entry.before !== entry.after));
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
    differences: Object.freeze([...transition.differences]),
  });
}

function requiredDecision(decision: import("./contracts/runtime").RuntimeRandomDecision | undefined) {
  if (!decision) throw new Error("运行随机决定记录缺失。");
  return decision;
}

function freezeState(state: UniverseState): UniverseState {
  return Object.freeze({
    ...state,
    identity: Object.freeze({ ...state.identity, initialInputIds: Object.freeze([...state.identity.initialInputIds]) }),
    clock: Object.freeze({ ...state.clock }),
    rules: Object.freeze(state.rules.map((rule) => Object.freeze({ ...rule, parameters: Object.freeze({ ...rule.parameters }) }))),
    objects: Object.freeze(Object.fromEntries(Object.entries(state.objects).map(([id, object]) => [id, freezeObject(object)]))),
    randomStreams: Object.freeze(Object.fromEntries(Object.entries(state.randomStreams).map(([id, random]) => [id, Object.freeze({ ...random })]))),
    inputLog: Object.freeze(state.inputLog.map((entry) => Object.freeze({ ...entry, payload: Object.freeze({ ...entry.payload }) }))),
    transitions: Object.freeze(state.transitions.map((transition) => freezeTransition({
      ...transition,
      differences: transition.differences.map((entry) => Object.freeze({ ...entry })),
    }))),
    committedTransitionIds: Object.freeze([...state.committedTransitionIds]),
  });
}

function assertUniverseState(state: UniverseState): void {
  if (state.version !== UNIVERSE_STATE_VERSION) throw new Error("宇宙运行状态版本不受支持。");
  if (state.identity.version !== UNIVERSE_DEFINITION_VERSION) throw new Error("宇宙定义版本不受支持。");
  if (state.id !== stateId(state)) throw new Error("宇宙运行状态身份校验失败。");
  if (state.transitions.length !== state.committedTransitionIds.length) throw new Error("宇宙运行状态转换历史不完整。");
}

function stateId(state: Omit<UniverseState, "id"> | UniverseState): string {
  return `runtime-state:${runtimeFingerprint({
    identity: state.identity,
    clock: logicalClockIdentity(state.clock),
    rules: state.rules,
    objects: state.objects,
    randomStreams: state.randomStreams,
    inputLog: state.inputLog,
    committedTransitionIds: state.committedTransitionIds,
  })}`;
}

function logicalClockIdentity(clock: UniverseState["clock"]): Pick<UniverseState["clock"], "version" | "tick" | "step"> {
  return { version: clock.version, tick: clock.tick, step: clock.step };
}


function runtimeSeedMaterial(seed: string, rulesetVersion: string, templateId: UniverseTemplateId): string {
  return `${rulesetVersion}:${templateId}:${seed}:runtime`;
}
