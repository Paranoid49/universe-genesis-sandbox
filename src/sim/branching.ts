import type { ExperimentInput, InUniverseIntervention, UniverseBranch } from "./contracts/branching";
import type { TransitionInput, UniverseState } from "./contracts/runtime";
import { replayUniverseToTick } from "./branch-replay";
import { runtimeFingerprint } from "./runtime-integrity";
import { advanceUniverseState, configureUniverseClock } from "./runtime-state";
import { buildBranch, evaluateBranchInputs, freezeBranch, validateBranch } from "./branch-validation";

export { branchHistoryHash, branchStateHash, validateBranch } from "./branch-validation";

export function createRootBranch(state: UniverseState): UniverseBranch {
  const paused = configureUniverseClock(state, { status: "paused" });
  const branchId = `branch:${runtimeFingerprint({ universeDefinitionId: paused.identity.universeDefinitionId, root: true })}`;
  return buildBranch(paused, { branchId, forkTick: 0, forkStateId: initialStateId(paused), commonTransitionCount: 0, lineage: [{ branchId, forkTick: 0, forkStateId: initialStateId(paused), creationInputIds: [] }], branchInputs: [], branchInputIds: [], inputOutcomes: [], accessMode: "local" });
}

export function createCheckpointRootBranch(state: UniverseState, rootCheckpointId: string): UniverseBranch {
  if (!rootCheckpointId) throw new Error("缺少来源检查点身份。");
  const paused = configureUniverseClock(state, { status: "paused" });
  const branchId = `branch:${runtimeFingerprint({ universeDefinitionId: paused.identity.universeDefinitionId, rootCheckpointId })}`;
  return buildBranch(paused, { branchId, forkTick: paused.clock.tick, forkStateId: paused.id, commonTransitionCount: paused.transitions.length, lineage: [{ branchId, forkTick: paused.clock.tick, forkStateId: paused.id, creationInputIds: [] }], branchInputs: [], branchInputIds: [], inputOutcomes: [], accessMode: "local", rootCheckpointId });
}

export function forkUniverseBranch(parent: UniverseBranch, targetTick: number, inputs: readonly ExperimentInput[]): UniverseBranch {
  validateBranch(parent);
  const forkState = replayUniverseToTick(parent.state, targetTick);
  validateInputKinds(inputs, "experiment.adjust-condition@1");
  const branchId = `branch:${runtimeFingerprint({ parentBranchId: parent.branchId, forkStateId: forkState.id, inputs })}`;
  const evaluated = evaluateBranchInputs(forkState, branchId, inputs, [parent.branchId]);
  return buildBranch(evaluated.state, {
    branchId,
    parentBranchId: parent.branchId,
    forkTick: targetTick,
    forkStateId: forkState.id,
    commonTransitionCount: targetTick,
    lineage: [...parent.lineage, { branchId, parentBranchId: parent.branchId, forkTick: targetTick, forkStateId: forkState.id, creationInputIds: inputs.map((entry) => entry.id) }],
    branchInputs: [...parent.branchInputs, ...inputs],
    branchInputIds: [...parent.branchInputIds, ...inputs.map((entry) => entry.id)],
    inputOutcomes: [...parent.inputOutcomes, ...evaluated.outcomes],
    accessMode: "local",
  });
}

export function advanceUniverseBranch(branch: UniverseBranch): UniverseBranch {
  validateBranch(branch);
  const writable = branch.accessMode === "shared-readonly" ? continueSharedUniverseBranch(branch) : branch;
  return buildBranch(advanceUniverseState(writable.state), writable);
}

export function updateUniverseBranchState(branch: UniverseBranch, state: UniverseState): UniverseBranch {
  validateBranch(branch);
  if (state.identity.universeDefinitionId !== branch.universeDefinitionId) throw new Error("不能写入其他宇宙状态。");
  if (branch.accessMode === "shared-readonly" && state.id !== branch.state.id) throw new Error("必须先创建接收者子分支。");
  if (!isUniverseBranchStateContinuation(branch, state)) throw new Error("不能覆盖为非后继状态。");
  return buildBranch(state, branch);
}

export function isUniverseBranchStateContinuation(branch: UniverseBranch, state: UniverseState): boolean {
  if (state.identity.universeDefinitionId !== branch.universeDefinitionId) return false;
  if (state.committedTransitionIds.length < branch.state.committedTransitionIds.length || state.inputLog.length < branch.state.inputLog.length) return false;
  return branch.state.committedTransitionIds.every((id, index) => state.committedTransitionIds[index] === id)
    && branch.state.inputLog.every((input, index) => JSON.stringify(state.inputLog[index]) === JSON.stringify(input));
}

export function interveneUniverseBranch(branch: UniverseBranch, input: InUniverseIntervention): UniverseBranch {
  validateBranch(branch);
  validateInputKinds([input], "intervention.apply-pulse@1");
  const writable = branch.accessMode === "shared-readonly" ? continueSharedUniverseBranch(branch) : branch;
  const evaluated = evaluateBranchInputs(writable.state, writable.branchId, [input], [branch.branchId, writable.branchId]);
  return buildBranch(evaluated.state, {
    ...writable,
    branchInputs: [...writable.branchInputs, input],
    branchInputIds: [...writable.branchInputIds, input.id],
    inputOutcomes: [...writable.inputOutcomes, ...evaluated.outcomes],
  });
}

export function continueSharedUniverseBranch(shared: UniverseBranch): UniverseBranch {
  validateBranch(shared);
  const branchId = `branch:${runtimeFingerprint({ parentBranchId: shared.branchId, forkStateId: shared.state.id, inputs: [] })}`;
  return buildBranch(shared.state, {
    ...shared,
    branchId,
    parentBranchId: shared.branchId,
    forkTick: shared.state.clock.tick,
    forkStateId: shared.state.id,
    commonTransitionCount: shared.state.transitions.length,
    lineage: [...shared.lineage, { branchId, parentBranchId: shared.branchId, forkTick: shared.state.clock.tick, forkStateId: shared.state.id, creationInputIds: [] }],
    accessMode: "local",
    sharedOriginBranchId: shared.branchId,
  });
}

export function receiveSharedUniverseBranch(shared: UniverseBranch): UniverseBranch {
  validateBranch(shared);
  return freezeBranch({ ...shared, accessMode: "shared-readonly" });
}

function initialStateId(state: UniverseState): string {
  return state.transitions[0]?.beforeStateId ?? state.id;
}

function validateInputKinds(inputs: readonly TransitionInput[], expected: string): void {
  if (inputs.some((entry) => entry.kind !== expected)) throw new Error("输入类型与权限不匹配。");
}
