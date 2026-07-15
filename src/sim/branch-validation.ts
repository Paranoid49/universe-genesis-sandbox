import { BRANCH_PROTOCOL_VERSION, type BranchInputOutcome, type ExperimentInput, type InUniverseIntervention, type UniverseBranch } from "./contracts/branching";
import type { UniverseState } from "./contracts/runtime";
import { BranchInputRejection, inputAdjustments } from "./branch-inputs";
import { replayUniverseToTick } from "./branch-replay";
import { runtimeFingerprint } from "./runtime-integrity";
import { advanceUniverseState, configureUniverseClock } from "./runtime-state";

export function branchHistoryHash(branch: Pick<UniverseBranch, "branchId" | "parentBranchId" | "forkStateId" | "state">): string {
  const complete = branch as UniverseBranch;
  return runtimeFingerprint({ branchId: branch.branchId, parentBranchId: branch.parentBranchId, forkStateId: branch.forkStateId, forkTick: complete.forkTick, commonTransitionCount: complete.commonTransitionCount, lineage: complete.lineage, branchInputs: complete.branchInputs, branchInputIds: complete.branchInputIds, inputOutcomes: complete.inputOutcomes, rootCheckpointId: complete.rootCheckpointId, sharedOriginBranchId: complete.sharedOriginBranchId, transitionIds: branch.state.committedTransitionIds, inputLog: branch.state.inputLog });
}

export function branchStateHash(state: UniverseState): string {
  return runtimeFingerprint({ identity: state.identity, clock: { version: state.clock.version, tick: state.clock.tick, step: state.clock.step }, rules: state.rules, objects: state.objects, topology: state.topology, autonomy: state.autonomy, randomStreams: state.randomStreams });
}

export function validateBranch(branch: UniverseBranch): UniverseBranch {
  if (branch.version !== BRANCH_PROTOCOL_VERSION) throw new Error("分支版本无效。");
  if (branch.universeDefinitionId !== branch.state.identity.universeDefinitionId) throw new Error("宇宙定义身份不匹配。");
  if (branch.stateHash !== branchStateHash(branch.state)) throw new Error("状态哈希不匹配。");
  if (branch.historyHash !== branchHistoryHash(branch)) throw new Error("历史哈希不匹配。");
  if (branch.checkpointId !== checkpointId(branch.branchId, branch.state.id, branch.historyHash)) throw new Error("检查点身份不匹配。");
  validateLineage(branch);
  if (branch.branchInputIds.length !== branch.branchInputs.length || branch.branchInputIds.some((id, index) => id !== branch.branchInputs[index].id)) throw new Error("输入索引不匹配。");
  const lineageIds = new Set(branch.lineage.map((entry) => entry.branchId));
  if (branch.branchInputs.some((entry) => !lineageIds.has(entry.branchId))) throw new Error("输入发起身份不匹配。");
  if (branch.inputOutcomes.length !== branch.branchInputs.length || branch.inputOutcomes.some((entry, index) => entry.inputId !== branch.branchInputs[index].id || !lineageIds.has(entry.branchId))) throw new Error("输入结果不完整。");
  const expectedCommonTransitionCount = branch.lineage.at(-1)?.forkTick;
  if (!Number.isSafeInteger(branch.commonTransitionCount)
    || branch.commonTransitionCount < 0
    || branch.commonTransitionCount > branch.state.transitions.length
    || branch.commonTransitionCount !== expectedCommonTransitionCount) throw new Error("共同历史范围无效。");
  if (branch.accessMode !== "local" && branch.accessMode !== "shared-readonly") throw new Error("访问模式无效。");
  return branch;
}

export function buildBranch(state: UniverseState, source: Pick<UniverseBranch, "branchId" | "forkTick" | "forkStateId" | "commonTransitionCount" | "lineage" | "branchInputs" | "branchInputIds" | "inputOutcomes" | "accessMode"> & Partial<Pick<UniverseBranch, "parentBranchId" | "rootCheckpointId" | "sharedOriginBranchId">>): UniverseBranch {
  const paused = configureUniverseClock(state, { status: "paused" });
  const base = { version: BRANCH_PROTOCOL_VERSION, universeDefinitionId: paused.identity.universeDefinitionId, ...source, stateHash: branchStateHash(paused), state: paused } satisfies Omit<UniverseBranch, "historyHash" | "checkpointId">;
  const historyHash = branchHistoryHash(base);
  return freezeBranch({ ...base, historyHash, checkpointId: checkpointId(base.branchId, paused.id, historyHash) });
}

export function evaluateBranchInputs(state: UniverseState, resultBranchId: string, inputs: readonly (ExperimentInput | InUniverseIntervention)[], allowedBranchIds: readonly string[]): { state: UniverseState; outcomes: readonly BranchInputOutcome[] } {
  if (inputs.length === 0) return { state, outcomes: [] };
  try {
    for (const input of inputs) {
      if (!allowedBranchIds.includes(input.branchId)) throw new BranchInputRejection("BI_BRANCH_MISMATCH", "branchId", "分支输入发起身份不匹配。");
      if (input.beforeStateId !== state.id) throw new BranchInputRejection("BI_STATE_MISMATCH", "beforeStateId", "分支输入前置状态不匹配。");
      if (JSON.stringify(input.ruleIds) !== JSON.stringify(state.rules.map((entry) => entry.id))) throw new BranchInputRejection("BI_RULE_MISMATCH", "ruleIds", "分支输入适用规则不匹配。");
    }
    inputAdjustments(state, inputs);
    const next = advanceUniverseState(state, inputs);
    const transition = next.transitions.at(-1)!;
    return { state: next, outcomes: Object.freeze(inputs.map((input) => outcome(resultBranchId, input, "accepted", "BI_ACCEPTED", "", transition.id, [`runtime-cause:${input.id}`, `runtime-cause:transition:${transition.id}`]))) };
  } catch (cause) {
    const rejection = cause instanceof BranchInputRejection ? cause : new BranchInputRejection("BI_REJECTED", "input", cause instanceof Error ? cause.message : "分支输入被拒绝。");
    return { state, outcomes: Object.freeze(inputs.map((input) => outcome(resultBranchId, input, "rejected", rejection.code, rejection.fieldPath, undefined, []))) };
  }
}

export function freezeBranch(branch: UniverseBranch): UniverseBranch {
  return Object.freeze({
    ...branch,
    lineage: Object.freeze(branch.lineage.map((entry) => Object.freeze({ ...entry, creationInputIds: Object.freeze([...entry.creationInputIds]) }))),
    branchInputs: Object.freeze(branch.branchInputs.map((entry) => Object.freeze({ ...entry, ruleIds: Object.freeze([...entry.ruleIds]), payload: Object.freeze({ ...entry.payload }) }) as ExperimentInput | InUniverseIntervention)),
    branchInputIds: Object.freeze([...branch.branchInputIds]),
    inputOutcomes: Object.freeze(branch.inputOutcomes.map((entry) => Object.freeze({ ...entry, ruleIds: Object.freeze([...entry.ruleIds]), causalNodeIds: Object.freeze([...entry.causalNodeIds]) }))),
    state: branch.state,
  });
}

function checkpointId(branchId: string, stateId: string, historyHash: string): string {
  return `branch-checkpoint:${runtimeFingerprint({ branchId, stateId, historyHash })}`;
}

function outcome(branchId: string, input: ExperimentInput | InUniverseIntervention, status: BranchInputOutcome["status"], code: string, fieldPath: string, transitionId: string | undefined, causalNodeIds: readonly string[]): BranchInputOutcome {
  const base = { version: "ugs-branch-input-outcome@1" as const, branchId, inputId: input.id, beforeStateId: input.beforeStateId, status, code, fieldPath, ruleIds: input.ruleIds, ...(transitionId ? { transitionId } : {}), causalNodeIds };
  return Object.freeze({ ...base, id: `branch-input-outcome:${runtimeFingerprint(base)}`, ruleIds: Object.freeze([...base.ruleIds]), causalNodeIds: Object.freeze([...causalNodeIds]) });
}

function validateLineage(branch: UniverseBranch): void {
  if (branch.lineage.length === 0 || branch.lineage.at(-1)?.branchId !== branch.branchId) throw new Error("谱系身份不完整。");
  if (new Set(branch.lineage.map((entry) => entry.branchId)).size !== branch.lineage.length) throw new Error("谱系身份重复。");
  const root = branch.lineage[0];
  const expectedRootId = branch.rootCheckpointId ? `branch:${runtimeFingerprint({ universeDefinitionId: branch.universeDefinitionId, rootCheckpointId: branch.rootCheckpointId })}` : `branch:${runtimeFingerprint({ universeDefinitionId: branch.universeDefinitionId, root: true })}`;
  if (root.branchId !== expectedRootId || root.parentBranchId || root.creationInputIds.length !== 0) throw new Error("根谱系无效。");
  if (!branch.rootCheckpointId && root.forkTick !== 0) throw new Error("根谱系来源无效。");
  if (replayUniverseToTick(branch.state, root.forkTick).id !== root.forkStateId) throw new Error("根谱系状态不匹配。");
  const inputs = new Map(branch.branchInputs.map((entry) => [entry.id, entry]));
  for (let index = 1; index < branch.lineage.length; index += 1) validateLineageEntry(branch, index, inputs);
  const last = branch.lineage.at(-1)!;
  if (last.parentBranchId !== branch.parentBranchId || last.forkTick !== branch.forkTick || last.forkStateId !== branch.forkStateId) throw new Error("当前身份与谱系不一致。");
}

function validateLineageEntry(branch: UniverseBranch, index: number, inputs: ReadonlyMap<string, ExperimentInput | InUniverseIntervention>): void {
  const entry = branch.lineage[index];
  const parent = branch.lineage[index - 1];
  if (entry.parentBranchId !== parent.branchId || !Number.isSafeInteger(entry.forkTick) || entry.forkTick < 0 || entry.forkTick > branch.state.clock.tick) throw new Error("谱系父子关系或分叉范围无效。");
  if (replayUniverseToTick(branch.state, entry.forkTick).id !== entry.forkStateId) throw new Error("谱系分叉状态不匹配。");
  const creationInputs = entry.creationInputIds.map((id) => inputs.get(id)).filter((input): input is ExperimentInput | InUniverseIntervention => Boolean(input));
  if (creationInputs.length !== entry.creationInputIds.length) throw new Error("谱系缺少创建输入。");
  const expectedBranchId = `branch:${runtimeFingerprint({ parentBranchId: parent.branchId, forkStateId: entry.forkStateId, inputs: creationInputs })}`;
  if (entry.branchId !== expectedBranchId) throw new Error("谱系身份证明无效。");
}
