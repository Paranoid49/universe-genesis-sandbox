import { useState } from "preact/hooks";
import {
  compareUniverseBranches, continueSharedUniverseBranch, createBranchArchive, createExperimentInput, createInterventionInput,
  createGenesisPackage, createHistoryBranchPackage, forkUniverseBranch, interveneUniverseBranch, isUniverseBranchStateContinuation,
  replayUniverseToTick, serializeSharePackage, updateUniverseBranchState,
  type BranchComparison, type BranchStorageAdapter, type UniverseBranch,
} from "../sim/current";
import { browserBranchStorage } from "./branchStorage";
import { activateRuntimeBranch } from "./branchActivation";
import { errorMessage, importSharedBranch, restoreCheckpointBranch } from "./branchLaboratoryModel";
import { mergeBranches, useBranchCollection } from "./useBranchCollection";
import { useBranchOperation } from "./useBranchOperation";
import type { RuntimeUniverseController } from "./useRuntimeUniverseModel";

export function useBranchLaboratory({ runtime, active, storage = browserBranchStorage }: { runtime: RuntimeUniverseController; active: boolean; storage?: BranchStorageAdapter }) {
  const [comparison, setComparison] = useState<BranchComparison>();
  const { busy, status, error, setStatus, setError, exclusive } = useBranchOperation(runtime);
  const { currentBranch, synced, viewBranches, setBranches, setCurrentBranchId } = useBranchCollection(runtime, active, storage, setError);

  async function createExperiment(targetTick: number, field: string, delta: number, objectId?: string): Promise<boolean> {
    return exclusive(async () => {
      const source = synchronizedCurrent();
      const forkState = replayUniverseToTick(source.state, targetTick);
      const order = (forkState.inputLog.at(-1)?.order ?? 0) + 1;
      const input = createExperimentInput(forkState, source.branchId, field, delta, order, objectId);
      const child = forkUniverseBranch(source, targetTick, [input]);
      await storage.commit(createBranchArchive(child), true);
      if (!await activateBranch(child, source)) return false;
      return finishOutcome(child, "实验分支已创建，父分支不变。");
    }, "实验失败。");
  }

  async function intervene(field: string, delta: number, objectId?: string, capabilityId?: string): Promise<boolean> {
    return exclusive(async () => {
      const source = synchronizedCurrent();
      const order = (source.state.inputLog.at(-1)?.order ?? 0) + 1;
      const next = interveneUniverseBranch(source, createInterventionInput(source.state, source.branchId, field, delta, order, objectId, capabilityId));
      await storage.commit(createBranchArchive(next), true);
      if (!await activateBranch(next, source)) return false;
      return finishOutcome(next, "干预已提交，不能清除。");
    }, "干预失败。");
  }

  async function switchBranch(branchId: string): Promise<boolean> {
    const target = viewBranches.find((entry) => entry.branchId === branchId);
    if (!target) return false;
    return exclusive(async () => {
      const previous = synchronizedCurrent();
      await storage.commit(createBranchArchive(target), true);
      if (!await activateBranch(target, previous)) return false;
      setStatus("已切换，其他分支不变。");
      return true;
    }, "切换失败。");
  }

  async function saveCurrent(): Promise<boolean> {
    return exclusive(async () => {
      const current = synchronizedCurrent();
      await storage.commit(createBranchArchive(current), true);
      setBranches((entries) => mergeBranches(entries, [current]));
      setStatus("分支已保存。");
      return true;
    }, "保存失败。");
  }

  async function importPackage(raw: string): Promise<boolean> {
    return exclusive(async () => {
      const imported = importSharedBranch(raw);
      const previous = synchronizedCurrent();
      await storage.commit(createBranchArchive(imported), true);
      if (!await activateBranch(imported, previous)) return false;
      setStatus(imported.accessMode === "shared-readonly" ? "共享节点已恢复，继续时分叉。" : "已创建本地创世根分支。");
      return true;
    }, "导入失败。");
  }

  function compareWith(branchId: string): boolean {
    const target = viewBranches.find((entry) => entry.branchId === branchId);
    if (!synced || !target || target.branchId === synced.branchId) return false;
    try {
      setComparison(compareUniverseBranches(synced, target));
      setError(undefined);
      return true;
    } catch (cause) {
      setComparison(undefined);
      setError(errorMessage(cause, "分支比较失败。"));
      return false;
    }
  }

  async function advanceCurrent(): Promise<boolean> {
    return exclusive(async () => { await ensureWritable(); runtime.advance(); return true; }, "推进失败。");
  }

  async function toggleRunning(): Promise<boolean> {
    if (runtime.state.clock.status === "running") { runtime.toggleRunning(); return true; }
    return exclusive(async () => { await ensureWritable(); runtime.toggleRunning(); return true; }, "运行失败。");
  }

  async function restoreLatestCheckpoint(): Promise<boolean> {
    return exclusive(async () => {
      const checkpoint = await runtime.loadLatestCheckpoint(runtime.state.identity.universeDefinitionId);
      const restored = restoreCheckpointBranch(checkpoint.state, checkpoint.checkpointId, viewBranches);
      const previous = synchronizedCurrent();
      await storage.commit(createBranchArchive(restored), true);
      if (!await activateBranch(restored, previous)) return false;
      setStatus("检查点已转为新分支，原历史不变。");
      return true;
    }, "检查点恢复失败。");
  }

  async function ensureWritable(): Promise<UniverseBranch> {
    const source = synchronizedCurrent();
    if (source.accessMode === "local") return source;
    const child = continueSharedUniverseBranch(source);
    await storage.commit(createBranchArchive(child), true);
    if (!await activateBranch(child, source)) throw new Error("共享分支继续失败。");
    return child;
  }

  function synchronizedCurrent(): UniverseBranch {
    if (!currentBranch) throw new Error("当前没有活动分支。");
    return isUniverseBranchStateContinuation(currentBranch, runtime.state) ? updateUniverseBranchState(currentBranch, runtime.state) : currentBranch;
  }

  function activateBranch(next: UniverseBranch, previous: UniverseBranch): Promise<boolean> {
    return activateRuntimeBranch(runtime, storage, next, previous, () => {
      setBranches((entries) => mergeBranches(entries, [previous, next]));
      setCurrentBranchId(next.branchId);
      setComparison(undefined);
      setError(undefined);
    }, setError);
  }

  function finishOutcome(branch: UniverseBranch, success: string): boolean {
    const outcome = branch.inputOutcomes.at(-1);
    const rejected = outcome?.status === "rejected";
    setStatus(rejected ? undefined : success);
    setError(rejected ? `${outcome.code}｜${outcome.fieldPath}｜输入被当前规则拒绝。` : undefined);
    return !rejected;
  }

  return {
    branches: viewBranches, currentBranch: synced, comparison, busy, status, error,
    genesisPackage: synced ? serializeSharePackage(createGenesisPackage(synced.state.identity)) : "",
    historyPackage: synced ? serializeSharePackage(createHistoryBranchPackage(synced)) : "",
    createExperiment, intervene, switchBranch, saveCurrent, importPackage, compareWith, advanceCurrent, toggleRunning, restoreLatestCheckpoint,
  };
}

export type BranchLaboratoryController = ReturnType<typeof useBranchLaboratory>;
