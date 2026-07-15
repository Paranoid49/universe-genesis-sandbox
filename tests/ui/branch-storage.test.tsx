import { describe, expect, it } from "vitest";
import { createBranchArchive, createExperimentInput, createLegacyInitialUniverseState as createInitialUniverseState, createRootBranch, forkUniverseBranch } from "../../src/sim";
import { BRANCH_STORAGE_VERSION, browserBranchStorage, createMemoryBranchStorage } from "../../src/ui/branchStorage";

describe("步骤 4 分支存储", () => {
  it("内存适配器稳定保存、列举、读取和删除分支", async () => {
    const storage = createMemoryBranchStorage();
    expect(storage.storageVersion).toBe(BRANCH_STORAGE_VERSION);
    const branch = createRootBranch(createInitialUniverseState({ seed: "BRANCH-STORAGE-001", templateId: "hard_science" }));
    const archive = createBranchArchive(branch);
    await storage.put(archive);
    expect(await storage.get(branch.branchId)).toEqual(archive);
    expect(await storage.list(branch.universeDefinitionId)).toEqual([archive]);
    await storage.remove(branch.branchId);
    expect(await storage.list()).toEqual([]);
  });

  it("内存适配器原子提交分支与活动指针，失败时保留旧活动分支", async () => {
    let reject = false;
    const storage = createMemoryBranchStorage({ rejectWrite: () => reject });
    const state = createInitialUniverseState({ seed: "BRANCH-STORAGE-ACTIVE", templateId: "hard_science" });
    const root = createRootBranch(state);
    const child = forkUniverseBranch(root, 0, [createExperimentInput(state, root.branchId, "cohesion", 1, 1)]);
    await storage.commit(createBranchArchive(root), true);
    expect(await storage.getActiveBranchId(root.universeDefinitionId)).toBe(root.branchId);
    reject = true;
    await expect(storage.commit(createBranchArchive(child), true)).rejects.toThrow("拒绝");
    expect(await storage.get(child.branchId)).toBeUndefined();
    expect(await storage.getActiveBranchId(root.universeDefinitionId)).toBe(root.branchId);
    await storage.remove(root.branchId);
    expect(await storage.getActiveBranchId(root.universeDefinitionId)).toBeUndefined();
  });

  it("写入失败时保留先前有效分支", async () => {
    let reject = false;
    const storage = createMemoryBranchStorage({ rejectWrite: () => reject });
    const branch = createRootBranch(createInitialUniverseState({ seed: "BRANCH-STORAGE-002", templateId: "mythic" }));
    const archive = createBranchArchive(branch);
    await storage.put(archive);
    reject = true;
    await expect(storage.put(archive)).rejects.toThrow("拒绝");
    expect(await storage.get(branch.branchId)).toEqual(archive);
  });

  it("同一宇宙达到二十条分支后明确拒绝且不删除旧值", async () => {
    const storage = createMemoryBranchStorage();
    const state = createInitialUniverseState({ seed: "BRANCH-STORAGE-CAPACITY", templateId: "hard_science" });
    const root = createRootBranch(state);
    await storage.put(createBranchArchive(root));
    for (let index = 1; index < 20; index += 1) {
      const branch = forkUniverseBranch(root, 0, [createExperimentInput(state, root.branchId, "cohesion", index, 1)]);
      await storage.put(createBranchArchive(branch));
    }
    const overflow = forkUniverseBranch(root, 0, [createExperimentInput(state, root.branchId, "energy", -1, 1)]);
    await expect(storage.put(createBranchArchive(overflow))).rejects.toThrow("20 条上限");
    expect(await storage.list(root.universeDefinitionId)).toHaveLength(20);
  });

  it("浏览器适配器支持往返并在事务中止时保留旧分支", async () => {
    const original = globalThis.indexedDB;
    let rejectWrite = false;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: createIndexedDbStub({ rejectWrite: () => rejectWrite }) });
    try {
      const state = createInitialUniverseState({ seed: "BRANCH-STORAGE-BROWSER", templateId: "mythic" });
      const branch = createRootBranch(state);
      const first = createBranchArchive(branch);
      await browserBranchStorage.migrate();
      await browserBranchStorage.commit(first, true);
      expect(await browserBranchStorage.get(branch.branchId)).toEqual(first);
      expect(await browserBranchStorage.list(branch.universeDefinitionId)).toEqual([first]);
      expect(await browserBranchStorage.getActiveBranchId(branch.universeDefinitionId)).toBe(branch.branchId);
      rejectWrite = true;
      const changed = createBranchArchive(forkUniverseBranch(branch, 0, [createExperimentInput(state, branch.branchId, "energy", 3, 1)]));
      await expect(browserBranchStorage.commit(changed, true)).rejects.toThrow("中止");
      expect(await browserBranchStorage.get(branch.branchId)).toEqual(first);
      expect(await browserBranchStorage.get(changed.branchId)).toBeUndefined();
      expect(await browserBranchStorage.getActiveBranchId(branch.universeDefinitionId)).toBe(branch.branchId);
      rejectWrite = false;
      await browserBranchStorage.remove(branch.branchId);
      expect(await browserBranchStorage.get(branch.branchId)).toBeUndefined();
      expect(await browserBranchStorage.getActiveBranchId(branch.universeDefinitionId)).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });

  it("浏览器适配器在 IndexedDB 不可用时明确拒绝", async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    try {
      await expect(browserBranchStorage.get("missing")).rejects.toThrow("不支持 IndexedDB");
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });

  it("浏览器适配器原子执行二十条容量上限并处理读取失败", async () => {
    const original = globalThis.indexedDB;
    let rejectRead = false;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: createIndexedDbStub({ rejectRead: () => rejectRead }) });
    try {
      const state = createInitialUniverseState({ seed: "BRANCH-STORAGE-BROWSER-CAPACITY", templateId: "hard_science" });
      const root = createRootBranch(state);
      await browserBranchStorage.put(createBranchArchive(root));
      for (let index = 1; index < 20; index += 1) {
        await browserBranchStorage.put(createBranchArchive(forkUniverseBranch(root, 0, [createExperimentInput(state, root.branchId, "cohesion", index, 1)])));
      }
      const overflow = forkUniverseBranch(root, 0, [createExperimentInput(state, root.branchId, "energy", -1, 1)]);
      await expect(browserBranchStorage.put(createBranchArchive(overflow))).rejects.toThrow("20 条上限");
      expect(await browserBranchStorage.list(root.universeDefinitionId)).toHaveLength(20);
      rejectRead = true;
      await expect(browserBranchStorage.list()).rejects.toThrow("读取失败");
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });

  it("浏览器数据库打开错误和阻塞都会明确拒绝", async () => {
    const original = globalThis.indexedDB;
    try {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: createIndexedDbStub({ openFailure: "error" }) });
      await expect(browserBranchStorage.migrate()).rejects.toThrow("无法打开");
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: createIndexedDbStub({ openFailure: "blocked" }) });
      await expect(browserBranchStorage.migrate()).rejects.toThrow("阻塞");
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });
});

function createIndexedDbStub(options: { rejectWrite?: () => boolean; rejectRead?: () => boolean; openFailure?: "error" | "blocked" } = {}): IDBFactory {
  const stores = new Map<string, Map<string, unknown>>();
  return {
    open: () => {
      const open = { result: undefined, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null } as unknown as IDBOpenDBRequest;
      const database = {
        objectStoreNames: { contains: (name: string) => stores.has(name) } as unknown as DOMStringList,
        createObjectStore: (name: string) => {
          const records = new Map<string, unknown>();
          stores.set(name, records);
          return createStore(name, records, undefined, options);
        },
        transaction: (names: string | string[], mode: IDBTransactionMode) => createTransaction(stores, Array.isArray(names) ? names : [names], mode, options),
        close: () => undefined,
      } as unknown as IDBDatabase;
      Object.defineProperty(open, "result", { configurable: true, get: () => database });
      queueMicrotask(() => {
        if (options.openFailure === "error") { open.onerror?.call(open, new Event("error")); return; }
        if (options.openFailure === "blocked") { open.onblocked?.call(open, new Event("blocked") as IDBVersionChangeEvent); return; }
        open.onupgradeneeded?.call(open, new Event("upgradeneeded") as IDBVersionChangeEvent);
        open.onsuccess?.call(open, new Event("success"));
      });
      return open;
    },
  } as unknown as IDBFactory;
}

type StubTransaction = IDBTransaction & { aborted?: boolean };

function createTransaction(stores: Map<string, Map<string, unknown>>, names: readonly string[], mode: IDBTransactionMode, options: { rejectWrite?: () => boolean; rejectRead?: () => boolean }): IDBTransaction {
  const current = {
    error: null,
    oncomplete: null,
    onerror: null,
    onabort: null,
    abort: () => {
      if (current.aborted) return;
      current.aborted = true;
      queueMicrotask(() => current.onabort?.call(current, new Event("abort")));
    },
    objectStore: (name: string) => {
      if (!names.includes(name)) throw new Error(`事务未包含对象仓库：${name}`);
      const records = stores.get(name);
      if (!records) throw new Error(`对象仓库不存在：${name}`);
      return createStore(name, records, mode === "readwrite" ? current : undefined, options);
    },
  } as unknown as StubTransaction;
  return current;
}

function createStore(name: string, records: Map<string, unknown>, current: StubTransaction | undefined, options: { rejectWrite?: () => boolean; rejectRead?: () => boolean } = {}): IDBObjectStore {
  return {
    put: (value: unknown) => {
      const key = name === "active-branches" ? (value as { universeDefinitionId: string }).universeDefinitionId : (value as { branchId: string }).branchId;
      const reject = options.rejectWrite?.() ?? false;
      if (reject && current) current.aborted = true;
      complete(current, reject ? undefined : () => records.set(key, structuredClone(value)), reject, name === "branches");
      return successfulRequest(undefined);
    },
    get: (key: IDBValidKey) => options.rejectRead?.() ? failedRequest<unknown>() : successfulRequest(records.get(String(key))),
    getAll: () => options.rejectRead?.() ? failedRequest<unknown[]>() : successfulRequest([...records.values()]),
    delete: (key: IDBValidKey) => {
      complete(current, () => records.delete(String(key)), false, name === "branches");
      return successfulRequest(undefined);
    },
  } as unknown as IDBObjectStore;
}

function successfulRequest<T>(value: T): IDBRequest<T> {
  const current = { result: value, error: null, onsuccess: null, onerror: null } as unknown as IDBRequest<T>;
  queueMicrotask(() => current.onsuccess?.call(current, new Event("success")));
  return current;
}

function failedRequest<T>(): IDBRequest<T> {
  const current = { result: undefined, error: null, onsuccess: null, onerror: null } as unknown as IDBRequest<T>;
  queueMicrotask(() => current.onerror?.call(current, new Event("error")));
  return current;
}

function complete(current: StubTransaction | undefined, commit: (() => void) | undefined, abort: boolean, completeTransaction: boolean): void {
  if (!current) return;
  queueMicrotask(() => {
    if (abort || current.aborted) {
      if (!completeTransaction) return;
      current.onabort?.call(current, new Event("abort"));
      return;
    }
    commit?.();
    if (completeTransaction) queueMicrotask(() => current.oncomplete?.call(current, new Event("complete")));
  });
}
