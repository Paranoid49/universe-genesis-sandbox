import type { BranchComparison, UniverseBranch } from "./contracts/branching";
import { buildRuntimeCausalNetwork } from "./runtime-causality";
import { validateBranch } from "./branching";
import { causalPaths, commonStateFieldCount, compareBranchObjects, differenceEvidence } from "./branch-comparison-evidence";

export function compareUniverseBranches(left: UniverseBranch, right: UniverseBranch): BranchComparison {
  validateBranch(left);
  validateBranch(right);
  if (left.universeDefinitionId !== right.universeDefinitionId) throw new Error("跨宇宙内容没有可验证共同祖先。");
  const rightLineage = new Set(right.lineage.map((entry) => entry.branchId));
  const ancestor = [...left.lineage].reverse().find((entry) => rightLineage.has(entry.branchId));
  if (!ancestor) throw new Error("两个分支没有可验证共同祖先。");
  const commonTransitionCount = Math.min(commonCount(left, ancestor.branchId), commonCount(right, ancestor.branchId));
  const leftInputs = left.state.transitions.slice(commonTransitionCount).flatMap((entry) => entry.inputIds);
  const rightInputs = right.state.transitions.slice(commonTransitionCount).flatMap((entry) => entry.inputIds);
  const firstIndex = firstDifference(leftInputs, rightInputs);
  const leftNetwork = buildRuntimeCausalNetwork(left.state);
  const rightNetwork = buildRuntimeCausalNetwork(right.state);
  const leftOnlyCausalNodeIds = leftNetwork.nodes.map((entry) => entry.id).filter((id) => !rightNetwork.nodes.some((entry) => entry.id === id));
  const rightOnlyCausalNodeIds = rightNetwork.nodes.map((entry) => entry.id).filter((id) => !leftNetwork.nodes.some((entry) => entry.id === id));
  const stateDifferences = compareBranchObjects(left.state, right.state);
  return Object.freeze({
    leftBranchId: left.branchId,
    rightBranchId: right.branchId,
    commonAncestorBranchId: ancestor.branchId,
    commonTransitionCount,
    ...(firstIndex < 0 ? {} : { firstDifferentInput: Object.freeze({ leftId: leftInputs[firstIndex], rightId: rightInputs[firstIndex], order: firstIndex + 1 }) }),
    stateDifferences: Object.freeze(stateDifferences),
    leftOnlyTransitionIds: Object.freeze(left.state.committedTransitionIds.filter((id) => !right.state.committedTransitionIds.includes(id))),
    rightOnlyTransitionIds: Object.freeze(right.state.committedTransitionIds.filter((id) => !left.state.committedTransitionIds.includes(id))),
    leftOnlyCausalNodeIds: Object.freeze(leftOnlyCausalNodeIds),
    rightOnlyCausalNodeIds: Object.freeze(rightOnlyCausalNodeIds),
    leftOnlyCausalPaths: Object.freeze(causalPaths(leftNetwork, leftOnlyCausalNodeIds)),
    rightOnlyCausalPaths: Object.freeze(causalPaths(rightNetwork, rightOnlyCausalNodeIds)),
    commonCausalNodeIds: Object.freeze(leftNetwork.nodes.map((entry) => entry.id).filter((id) => rightNetwork.nodes.some((rightNode) => rightNode.id === id))),
    commonStateFieldCount: commonStateFieldCount(left.state.objects, right.state.objects),
    differenceEvidence: Object.freeze(stateDifferences.map((difference) => differenceEvidence(difference, left.state, right.state))),
    historiesConvergedToSameState: left.stateHash === right.stateHash && left.historyHash !== right.historyHash,
  });
}

function commonCount(branch: UniverseBranch, ancestorBranchId: string): number {
  if (branch.branchId === ancestorBranchId) return branch.state.transitions.length;
  const child = branch.lineage.find((entry) => entry.parentBranchId === ancestorBranchId);
  return child?.forkTick ?? 0;
}

function firstDifference(left: readonly string[], right: readonly string[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) if (left[index] !== right[index]) return index;
  return -1;
}
