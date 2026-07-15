import { parseBranchArchive, serializeBranchArchive, type BranchArchiveEnvelope, type BranchStorageAdapter } from "../sim/current";
import { ACTIVE_BRANCH_STORE_NAME, BRANCH_DATABASE_NAME, BRANCH_DATABASE_VERSION, BRANCH_STORAGE_VERSION, BRANCH_STORE_NAME, MAX_BRANCHES_PER_UNIVERSE } from "./branchStorageConfig";

export function createBrowserBranchStorage(): BranchStorageAdapter {
  return {
    storageVersion: BRANCH_STORAGE_VERSION,
    migrate: async () => { const database = await openDatabase(); database.close(); },
    put: async (archive) => commitArchive(archive, false),
    commit: async (archive, activate) => commitArchive(archive, activate),
    get: async (branchId) => withDatabase(async (database) => {
      const value = await request<unknown>(database.transaction(BRANCH_STORE_NAME, "readonly").objectStore(BRANCH_STORE_NAME).get(branchId));
      return value === undefined ? undefined : parseBranchArchive(JSON.stringify(value));
    }),
    list: async (universeDefinitionId) => withDatabase(async (database) => {
      const values = await request<unknown[]>(database.transaction(BRANCH_STORE_NAME, "readonly").objectStore(BRANCH_STORE_NAME).getAll());
      return Object.freeze(values.map((value) => parseBranchArchive(JSON.stringify(value))).filter((entry) => !universeDefinitionId || entry.universeDefinitionId === universeDefinitionId));
    }),
    getActiveBranchId: async (universeDefinitionId) => withDatabase(async (database) => {
      const value = await request<{ branchId: string } | undefined>(database.transaction(ACTIVE_BRANCH_STORE_NAME, "readonly").objectStore(ACTIVE_BRANCH_STORE_NAME).get(universeDefinitionId));
      return value?.branchId;
    }),
    remove: async (branchId) => withDatabase((database) => removeArchive(database, branchId)),
  };
}

async function commitArchive(archive: BranchArchiveEnvelope, activate: boolean): Promise<void> {
  const verified = parseBranchArchive(serializeBranchArchive(archive));
  await withDatabase((database) => putWithCapacity(database, verified, activate));
}

function putWithCapacity(database: IDBDatabase, archive: BranchArchiveEnvelope, activate: boolean): Promise<void> {
  return transact(database, (current, branches, activeBranches, fail) => {
    const existing = branches.getAll();
    existing.onsuccess = () => {
      const count = (existing.result as BranchArchiveEnvelope[]).filter((entry) => entry.universeDefinitionId === archive.universeDefinitionId && entry.branchId !== archive.branchId).length;
      if (count >= MAX_BRANCHES_PER_UNIVERSE) { fail(new Error(`当前宇宙的分支数量已达到 ${MAX_BRANCHES_PER_UNIVERSE} 条上限。`)); current.abort(); return; }
      branches.put(archive);
      if (activate) activeBranches.put({ universeDefinitionId: archive.universeDefinitionId, branchId: archive.branchId });
    };
    existing.onerror = () => fail(existing.error ?? new Error("分支存储容量检查失败。"));
  });
}

function removeArchive(database: IDBDatabase, branchId: string): Promise<void> {
  return transact(database, (_current, branches, activeBranches, fail) => {
    const existing = branches.get(branchId);
    existing.onsuccess = () => {
      const archive = existing.result as BranchArchiveEnvelope | undefined;
      branches.delete(branchId);
      if (!archive) return;
      const active = activeBranches.get(archive.universeDefinitionId);
      active.onsuccess = () => { if ((active.result as { branchId?: string } | undefined)?.branchId === branchId) activeBranches.delete(archive.universeDefinitionId); };
      active.onerror = () => fail(active.error ?? new Error("活动分支指针读取失败。"));
    };
    existing.onerror = () => fail(existing.error ?? new Error("分支删除前读取失败。"));
  });
}

function transact(database: IDBDatabase, operation: (current: IDBTransaction, branches: IDBObjectStore, activeBranches: IDBObjectStore, fail: (error: Error) => void) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const current = database.transaction([BRANCH_STORE_NAME, ACTIVE_BRANCH_STORE_NAME], "readwrite");
    let settled = false;
    const fail = (error: Error) => { if (!settled) { settled = true; reject(error); } };
    operation(current, current.objectStore(BRANCH_STORE_NAME), current.objectStore(ACTIVE_BRANCH_STORE_NAME), fail);
    current.oncomplete = () => { if (!settled) resolve(); };
    current.onerror = () => fail(current.error ?? new Error("分支存储事务失败。"));
    current.onabort = () => fail(current.error ?? new Error("分支存储事务已中止。"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("当前环境不支持 IndexedDB 分支存储。"));
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(BRANCH_DATABASE_NAME, BRANCH_DATABASE_VERSION);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(BRANCH_STORE_NAME)) open.result.createObjectStore(BRANCH_STORE_NAME, { keyPath: "branchId" });
      if (!open.result.objectStoreNames.contains(ACTIVE_BRANCH_STORE_NAME)) open.result.createObjectStore(ACTIVE_BRANCH_STORE_NAME, { keyPath: "universeDefinitionId" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("无法打开分支数据库。"));
    open.onblocked = () => reject(new Error("分支数据库升级被其他页面阻塞。"));
  });
}

async function withDatabase<T>(action: (database: IDBDatabase) => Promise<T>): Promise<T> {
  const database = await openDatabase();
  try { return await action(database); }
  finally { database.close(); }
}

function request<T>(current: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { current.onsuccess = () => resolve(current.result); current.onerror = () => reject(current.error ?? new Error("分支存储读取失败。")); });
}
