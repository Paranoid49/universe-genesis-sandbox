import { describe, expect, it } from "vitest";
import { createLegacyInitialUniverseState as createInitialUniverseState, createObservationAccess, createResearchArchive, createResearchNotebook, createRootBranch } from "../../src/sim";
import { browserResearchStorage, createMemoryResearchStorage } from "../../src/ui/researchStorage";
import { loadResearchNotebook } from "../../src/ui/researchNotebookLoader";

describe("步骤 3 研究记录存储", () => {
  it("内存适配器支持迁移、保存、读取和删除", async () => {
    const storage = createMemoryResearchStorage();
    const archive = createResearchArchive(createResearchNotebook("runtime-definition:research-storage-1"));
    expect(storage.storageVersion).toBe("ugs-research-storage@3");
    await expect(storage.migrate()).resolves.toBeUndefined();
    await storage.put(archive);
    expect(await storage.get(archive.notebookId)).toEqual(archive);
    expect(await storage.list()).toEqual([archive]);
    await storage.remove(archive.notebookId);
    expect(await storage.get(archive.notebookId)).toBeUndefined();
  });

  it("写入失败保留先前有效记录且损坏信封不会进入存储", async () => {
    let reject = false;
    const storage = createMemoryResearchStorage({ rejectWrite: () => reject });
    const archive = createResearchArchive(createResearchNotebook("runtime-definition:research-storage-2"));
    await storage.put(archive);
    reject = true;
    await expect(storage.put(archive)).rejects.toThrow("拒绝");
    expect(await storage.get(archive.notebookId)).toEqual(archive);

    reject = false;
    await expect(storage.put({ ...archive, checksum: "00000000" })).rejects.toThrow("完整性");
    expect(await storage.get(archive.notebookId)).toEqual(archive);
  });

  it("浏览器适配器通过 IndexedDB 保存、读取、迁移和删除", async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: createIndexedDbStub() });
    try {
      const archive = createResearchArchive(createResearchNotebook("runtime-definition:research-browser-1"));
      await browserResearchStorage.migrate();
      await browserResearchStorage.put(archive);
      expect(await browserResearchStorage.get(archive.notebookId)).toEqual(archive);
      expect(await browserResearchStorage.list()).toEqual([archive]);
      await browserResearchStorage.remove(archive.notebookId);
      expect(await browserResearchStorage.get(archive.notebookId)).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });

  it("浏览器适配器在 IndexedDB 不可用时明确拒绝", async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    try {
      await expect(browserResearchStorage.get("missing")).rejects.toThrow("不支持 IndexedDB");
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });

  it("浏览器写事务中止时保留先前有效研究记录", async () => {
    const original = globalThis.indexedDB;
    let rejectWrite = false;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: createIndexedDbStub({ rejectWrite: () => rejectWrite }) });
    try {
      const notebook = createResearchNotebook("runtime-definition:research-browser-rollback");
      const first = createResearchArchive(notebook);
      const second = createResearchArchive({ ...notebook, revision: 1 });
      await browserResearchStorage.put(first);
      rejectWrite = true;
      await expect(browserResearchStorage.put(second)).rejects.toThrow("中止");
      expect(await browserResearchStorage.get(first.notebookId)).toEqual(first);
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });

  it("步骤 3 空根记录可以受控迁移到正式根分支身份", async () => {
    const storage = createMemoryResearchStorage();
    const root = createRootBranch(createInitialUniverseState({ seed: "RESEARCH-ROOT-MIGRATION", templateId: "hard_science" }));
    const legacy = createResearchNotebook(root.universeDefinitionId);
    await storage.put(createResearchArchive(legacy));
    const access = createObservationAccess(root.state, root.branchId);
    const migrated = await loadResearchNotebook(access, storage, true);
    expect(migrated.runtimeHistoryId).toBe(root.branchId);
    expect(await storage.get(migrated.id)).toBeTruthy();
  });
});

function createIndexedDbStub(options: { rejectWrite?: () => boolean } = {}): IDBFactory {
  const records = new Map<string, unknown>();
  let created = false;
  return {
    open: () => {
      const open = { result: undefined, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null } as unknown as IDBOpenDBRequest;
      const database = {
        objectStoreNames: { contains: () => created } as unknown as DOMStringList,
        createObjectStore: () => { created = true; return createStore(records, undefined); },
        transaction: (_name: string, mode: IDBTransactionMode) => createTransaction(records, mode, options),
        close: () => undefined,
      } as unknown as IDBDatabase;
      Object.defineProperty(open, "result", { configurable: true, get: () => database });
      queueMicrotask(() => {
        open.onupgradeneeded?.call(open, new Event("upgradeneeded") as IDBVersionChangeEvent);
        open.onsuccess?.call(open, new Event("success"));
      });
      return open;
    },
  } as unknown as IDBFactory;
}

function createTransaction(records: Map<string, unknown>, mode: IDBTransactionMode, options: { rejectWrite?: () => boolean }): IDBTransaction {
  const current = { error: null, oncomplete: null, onerror: null, onabort: null, objectStore: () => createStore(records, mode === "readwrite" ? current : undefined, options) } as unknown as IDBTransaction;
  return current;
}

function createStore(records: Map<string, unknown>, current: IDBTransaction | undefined, options: { rejectWrite?: () => boolean } = {}): IDBObjectStore {
  return {
    put: (value: unknown) => {
      const key = (value as { notebookId: string }).notebookId;
      complete(current, options.rejectWrite?.() ? undefined : () => records.set(key, structuredClone(value)), options.rejectWrite?.() ?? false);
      return successfulRequest(undefined);
    },
    get: (key: IDBValidKey) => successfulRequest(records.get(String(key))),
    getAll: () => successfulRequest([...records.values()]),
    delete: (key: IDBValidKey) => {
      complete(current, () => records.delete(String(key)), false);
      return successfulRequest(undefined);
    },
  } as unknown as IDBObjectStore;
}

function successfulRequest<T>(value: T): IDBRequest<T> {
  const current = { result: value, error: null, onsuccess: null, onerror: null } as unknown as IDBRequest<T>;
  queueMicrotask(() => current.onsuccess?.call(current, new Event("success")));
  return current;
}

function complete(current: IDBTransaction | undefined, commit: (() => void) | undefined, abort: boolean): void {
  if (!current) return;
  queueMicrotask(() => {
    if (abort) {
      current.onabort?.call(current, new Event("abort"));
      return;
    }
    commit?.();
    current.oncomplete?.call(current, new Event("complete"));
  });
}
