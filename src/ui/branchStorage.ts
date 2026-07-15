import { parseBranchArchive, serializeBranchArchive, type BranchArchiveEnvelope, type BranchStorageAdapter } from "../sim";
import { createBrowserBranchStorage } from "./branchIndexedDb";
import { BRANCH_STORAGE_VERSION, MAX_BRANCHES_PER_UNIVERSE } from "./branchStorageConfig";

export { BRANCH_STORAGE_VERSION } from "./branchStorageConfig";

export function createMemoryBranchStorage(options: { rejectWrite?: () => boolean } = {}): BranchStorageAdapter {
  const records = new Map<string, string>();
  const universeIds = new Map<string, string>();
  const activeBranches = new Map<string, string>();
  const commit = async (archive: BranchArchiveEnvelope, activate: boolean) => {
    const verified = parseBranchArchive(serializeBranchArchive(archive));
    if (options.rejectWrite?.()) throw new Error("分支写入被测试适配器拒绝。");
    const existingCount = [...universeIds.entries()].filter(([branchId, universeDefinitionId]) => universeDefinitionId === verified.universeDefinitionId && branchId !== verified.branchId).length;
    if (existingCount >= MAX_BRANCHES_PER_UNIVERSE) throw new Error("当前宇宙的分支数量已达到 20 条上限。");
    records.set(verified.branchId, serializeBranchArchive(verified));
    universeIds.set(verified.branchId, verified.universeDefinitionId);
    if (activate) activeBranches.set(verified.universeDefinitionId, verified.branchId);
  };
  return {
    storageVersion: BRANCH_STORAGE_VERSION,
    migrate: async () => undefined,
    put: async (archive) => commit(archive, false),
    commit,
    get: async (branchId) => { const raw = records.get(branchId); return raw ? parseBranchArchive(raw) : undefined; },
    list: async (universeDefinitionId) => Object.freeze([...records.values()].map(parseBranchArchive).filter((entry) => !universeDefinitionId || entry.universeDefinitionId === universeDefinitionId)),
    getActiveBranchId: async (universeDefinitionId) => activeBranches.get(universeDefinitionId),
    remove: async (branchId) => {
      const existing = records.get(branchId);
      records.delete(branchId);
      universeIds.delete(branchId);
      if (existing) {
        const archive = parseBranchArchive(existing);
        if (activeBranches.get(archive.universeDefinitionId) === branchId) activeBranches.delete(archive.universeDefinitionId);
      }
    },
  };
}

export const browserBranchStorage = createBrowserBranchStorage();

export type { BranchStorageAdapter } from "../sim";
