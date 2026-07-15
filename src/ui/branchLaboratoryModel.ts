import {
  createCheckpointRootBranch,
  BranchPackageError,
  createInitialUniverseState,
  createRootBranch,
  forkUniverseBranch,
  parseGenesisPackage,
  parseHistoryBranchPackage,
  receiveHistoryBranchPackage,
  replayUniverseToTick,
  type UniverseBranch,
  type UniverseState,
} from "../sim/current";

export function importSharedBranch(raw: string): UniverseBranch {
  let packageType: unknown;
  try { packageType = (JSON.parse(raw) as { packageType?: unknown }).packageType; }
  catch { return createRootBranch(createInitialUniverseState(parseGenesisPackage(raw).universeDefinition)); }
  if (packageType === "history-branch") return receiveHistoryBranchPackage(parseHistoryBranchPackage(raw));
  if (packageType === "genesis") return createRootBranch(createInitialUniverseState(parseGenesisPackage(raw).universeDefinition));
  throw new BranchPackageError("BPKG_TYPE", "package.packageType", "分享包类型无效。");
}

export function restoreCheckpointBranch(state: UniverseState, checkpointId: string, branches: readonly UniverseBranch[]): UniverseBranch {
  for (const branch of branches.filter((entry) => entry.universeDefinitionId === state.identity.universeDefinitionId)) {
    try {
      if (state.clock.tick <= branch.state.clock.tick && replayUniverseToTick(branch.state, state.clock.tick).id === state.id) return forkUniverseBranch(branch, state.clock.tick, []);
    } catch { /* 当前分支不是该检查点的合法历史前缀 */ }
  }
  return createCheckpointRootBranch(state, checkpointId);
}

export function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && "code" in cause && "fieldPath" in cause) {
    const typed = cause as Error & { code: unknown; fieldPath: unknown };
    if (typeof typed.code === "string" && typeof typed.fieldPath === "string") return `${typed.code}｜${typed.fieldPath}｜${typed.message}`;
  }
  return cause instanceof Error ? cause.message : fallback;
}
