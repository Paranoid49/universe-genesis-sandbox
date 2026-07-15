import type { InterventionModuleSpec } from "./contracts/constitution";
import type { ExperimentInput, InUniverseIntervention } from "./contracts/branching";
import type { TransitionInput, UniverseState } from "./contracts/runtime";
import { constitutionModule } from "./constitution-validation";
import { runtimeFingerprint } from "./runtime-integrity";

export class BranchInputRejection extends Error {
  constructor(readonly code: string, readonly fieldPath: string, message: string) {
    super(message);
    this.name = "BranchInputRejection";
  }
}

export function createExperimentInput(state: UniverseState, branchId: string, field: string, delta: number, order: number, objectId?: string): ExperimentInput {
  return createInput(state, branchId, "experiment.adjust-condition@1", field, delta, order, objectId) as ExperimentInput;
}

export function createInterventionInput(state: UniverseState, branchId: string, field: string, delta: number, order: number, objectId?: string, capabilityId?: string): InUniverseIntervention {
  const object = selectedObject(state, objectId);
  const capabilities = constitutionModule<InterventionModuleSpec>(state.identity.constitution, "intervention").spec.capabilities;
  const capability = capabilities.find((entry) => (!capabilityId || entry.id === capabilityId) && entry.targetKinds.includes(object.kind) && entry.field === field);
  if (!capability) throw new BranchInputRejection("BI_CAPABILITY_UNAVAILABLE", "payload.capabilityId", "当前宇宙宪法不允许该宇宙内干预。");
  return createInput(state, branchId, "intervention.apply-pulse@1", field, delta, order, object.id, capability.id) as InUniverseIntervention;
}

export function inputAdjustments(state: UniverseState, inputs: readonly TransitionInput[]): Readonly<Record<string, Readonly<Record<string, number>>>> {
  const result: Record<string, Record<string, number>> = {};
  const capabilities = constitutionModule<InterventionModuleSpec>(state.identity.constitution, "intervention").spec.capabilities;
  for (const input of inputs) {
    if (input.kind !== "experiment.adjust-condition@1" && input.kind !== "intervention.apply-pulse@1") continue;
    const objectId = input.payload.objectId;
    const field = input.payload.field;
    const delta = input.payload.delta;
    if (typeof objectId !== "string" || !state.objects[objectId]) throw new BranchInputRejection("BI_TARGET_INVALID", "payload.objectId", "分支输入目标不存在。");
    if (typeof field !== "string" || !(field in state.objects[objectId].attributes)) throw new BranchInputRejection("BI_FIELD_UNSUPPORTED", "payload.field", "分支输入字段不受宪法支持。");
    if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) throw new BranchInputRejection("BI_DELTA_INVALID", "payload.delta", "分支输入变化必须是非零有限数值。");
    result[objectId] ??= {};
    if (input.kind === "intervention.apply-pulse@1") {
      const capabilityId = input.payload.capabilityId;
      const capability = capabilities.find((entry) => entry.id === capabilityId && entry.targetKinds.includes(state.objects[objectId].kind) && entry.field === field);
      if (!capability) throw new BranchInputRejection("BI_CAPABILITY_UNAVAILABLE", "payload.capabilityId", "干预能力不属于当前宇宙宪法。");
      if (delta < capability.minimumDelta || delta > capability.maximumDelta) throw new BranchInputRejection("BI_DELTA_INVALID", "payload.delta", "干预变化超出宇宙宪法允许范围。");
      if (capability.costField && capability.costAmount) result[objectId][capability.costField] = (result[objectId][capability.costField] ?? 0) - capability.costAmount;
    }
    result[objectId][field] = (result[objectId][field] ?? 0) + delta;
  }
  return Object.freeze(Object.fromEntries(Object.entries(result).map(([objectId, fields]) => [objectId, Object.freeze({ ...fields })])));
}

function createInput(state: UniverseState, branchId: string, kind: ExperimentInput["kind"] | InUniverseIntervention["kind"], field: string, delta: number, order: number, objectId?: string, capabilityId?: string): TransitionInput {
  const object = selectedObject(state, objectId);
  const payload = Object.freeze({ objectId: object.id, field, delta, ...(capabilityId ? { capabilityId } : {}) });
  const base = { kind, branchId, beforeStateId: state.id, ruleIds: state.rules.map((entry) => entry.id), order, payload };
  return Object.freeze({ ...base, id: "branch-input:" + runtimeFingerprint(base) }) as TransitionInput;
}

function selectedObject(state: UniverseState, objectId?: string) {
  const object = objectId ? state.objects[objectId] : Object.values(state.objects)[0];
  if (!object) throw new BranchInputRejection("BI_TARGET_MISSING", "state.objects", "当前宇宙没有可实验对象。");
  return object;
}
