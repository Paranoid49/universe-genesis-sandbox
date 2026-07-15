import { useEffect, useRef, useState } from "preact/hooks";
import type { Dispatch, SetStateAction } from "react";
import { createRootBranch, isUniverseBranchStateContinuation, updateUniverseBranchState, type BranchStorageAdapter, type UniverseBranch } from "../sim/current";
import type { RuntimeUniverseController } from "./useRuntimeUniverseModel";

export function useBranchCollection(runtime: RuntimeUniverseController, active: boolean, storage: BranchStorageAdapter, onError: Dispatch<SetStateAction<string | undefined>>) {
  const [branches, setBranches] = useState<readonly UniverseBranch[]>(() => [createRootBranch(runtime.state)]);
  const [currentBranchId, setCurrentBranchId] = useState(branches[0].branchId);
  const runtimeRef = useRef(runtime);
  const currentBranch = branches.find((entry) => entry.branchId === currentBranchId) ?? branches[0];
  const synced = currentBranch && isUniverseBranchStateContinuation(currentBranch, runtime.state) ? updateUniverseBranchState(currentBranch, runtime.state) : currentBranch;
  const viewBranches = synced ? mergeBranches(branches, [synced]) : branches;

  useEffect(() => { runtimeRef.current = runtime; }, [runtime]);
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const universeDefinitionId = runtime.state.identity.universeDefinitionId;
    Promise.all([storage.list(universeDefinitionId), storage.getActiveBranchId(universeDefinitionId)]).then(([archives, activeBranchId]) => {
      if (cancelled || archives.length === 0) return;
      const loaded = archives.map((entry) => entry.branch);
      setBranches((current) => mergeBranches(current, loaded));
      const activeBranch = loaded.find((entry) => entry.branchId === activeBranchId);
      if (activeBranch && runtimeRef.current.replaceState(activeBranch.state, "已恢复上次活动分支。")) setCurrentBranchId(activeBranch.branchId);
    }).catch((cause) => { if (!cancelled) onError(cause instanceof Error ? cause.message : "分支列表读取失败。"); });
    return () => { cancelled = true; };
  }, [active, onError, runtime.state.identity.universeDefinitionId, storage]);

  return { currentBranch, synced, viewBranches, setBranches, setCurrentBranchId };
}

export function mergeBranches(current: readonly UniverseBranch[], incoming: readonly UniverseBranch[]): readonly UniverseBranch[] {
  const merged = new Map(current.map((entry) => [entry.branchId, entry]));
  incoming.forEach((entry) => merged.set(entry.branchId, entry));
  return Object.freeze([...merged.values()].sort((left, right) => left.lineage.length - right.lineage.length || left.branchId.localeCompare(right.branchId)));
}
