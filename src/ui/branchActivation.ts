import { createBranchArchive, type BranchStorageAdapter, type UniverseBranch } from "../sim/current";
import type { RuntimeUniverseController } from "./useRuntimeUniverseModel";

export async function activateRuntimeBranch(runtime: RuntimeUniverseController, storage: BranchStorageAdapter, next: UniverseBranch, previous: UniverseBranch, onSuccess: () => void, onFailure: (message: string) => void): Promise<boolean> {
  runtime.pause();
  if (runtime.replaceState(next.state, `已切换分支：${next.branchId.slice(-8)}`)) {
    onSuccess();
    return true;
  }
  try {
    await storage.commit(createBranchArchive(previous), true);
    onFailure("活动分支运行状态提交失败，已恢复先前活动分支。");
  } catch {
    onFailure("活动分支与持久化回滚失败。");
  }
  return false;
}
