import { describe, expect, it } from "vitest";
import {
  advanceUniverseState,
  configureUniverseClock,
  createInitialUniverseState,
  createRuntimeArchive,
} from "../../src/sim";
import { browserRuntimeStorage, createMemoryRuntimeStorage } from "../../src/ui/runtimeStorage";

describe("步骤 2 运行存档适配器", () => {
  it("内存适配器能够保存、读取、列举和删除运行存档", async () => {
    const storage = createMemoryRuntimeStorage();
    const first = createRuntimeArchive(advanceUniverseState(createInitialUniverseState({ seed: "STORAGE-001", templateId: "hard_science" })));
    const second = createRuntimeArchive(advanceUniverseState(createInitialUniverseState({ seed: "STORAGE-002", templateId: "high_magic" })));

    expect(storage.storageVersion).toBe("ugs-runtime-storage@1");
    await expect(storage.migrate()).resolves.toBeUndefined();
    await storage.put(second);
    await storage.put(first);

    expect(await storage.get(first.stateId)).toEqual(first);
    expect((await storage.list()).map((entry) => entry.stateId)).toEqual([first.stateId, second.stateId].sort());
    await storage.remove(first.stateId);
    expect(await storage.get(first.stateId)).toBeUndefined();
  });

  it("写入失败不会覆盖先前有效存档", async () => {
    let reject = false;
    const storage = createMemoryRuntimeStorage({ rejectWrite: () => reject });
    const initial = createRuntimeArchive(advanceUniverseState(createInitialUniverseState({ seed: "STORAGE-ATOMIC-001", templateId: "low_magic" })));
    await storage.put(initial);
    reject = true;

    const replacement = createRuntimeArchive(advanceUniverseState(initial.state));
    await expect(storage.put(replacement)).rejects.toThrow("拒绝");
    expect(await storage.get(initial.stateId)).toEqual(initial);
    expect(await storage.get(replacement.stateId)).toBeUndefined();
  });

  it("适配器写入和读取都经过运行存档完整性校验", async () => {
    const storage = createMemoryRuntimeStorage();
    const archive = createRuntimeArchive(createInitialUniverseState({ seed: "STORAGE-VERIFY-001", templateId: "mythic" }));
    await expect(storage.put({ ...archive, checksum: "00000000" })).rejects.toThrow("完整性");
    expect(await storage.list()).toEqual([]);
  });

  it("较旧检查点延迟写入不会覆盖较新的检查点", async () => {
    const storage = createMemoryRuntimeStorage();
    const initial = createInitialUniverseState({ seed: "STORAGE-CONCURRENT-001", templateId: "hard_science" });
    const older = createRuntimeArchive(advanceUniverseState(initial));
    const newer = createRuntimeArchive(advanceUniverseState(older.state));

    await storage.put(newer);
    await storage.put(older);

    const archives = await storage.list();
    expect(archives).toHaveLength(2);
    expect(archives.find((archive) => archive.stateId === newer.stateId)).toEqual(newer);
    expect(Math.max(...archives.map((archive) => archive.state.clock.step))).toBe(2);
  });

  it("浏览器适配器通过 IndexedDB 完成保存、读取、列举和删除", async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: createIndexedDbStub() });
    try {
      const archive = createRuntimeArchive(advanceUniverseState(createInitialUniverseState({ seed: "STORAGE-INDEXEDDB-001", templateId: "mythic" })));
      expect(browserRuntimeStorage.storageVersion).toBe("ugs-runtime-storage@1");
      await expect(browserRuntimeStorage.migrate()).resolves.toBeUndefined();
      await browserRuntimeStorage.put(archive);
      expect(await browserRuntimeStorage.get(archive.stateId)).toEqual(archive);
      expect(await browserRuntimeStorage.list()).toEqual([archive]);
      await browserRuntimeStorage.remove(archive.stateId);
      expect(await browserRuntimeStorage.get(archive.stateId)).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });

  it("浏览器适配器在 IndexedDB 不可用时明确拒绝", async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    try {
      await expect(browserRuntimeStorage.list()).rejects.toThrow("不支持 IndexedDB");
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });

  it("IndexedDB 写事务中止时不会覆盖同一检查点的先前有效内容", async () => {
    const original = globalThis.indexedDB;
    const failure = { abortNextWrite: false };
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: createIndexedDbStub(failure) });
    try {
      const state = advanceUniverseState(createInitialUniverseState({ seed: "STORAGE-INDEXEDDB-ATOMIC-001", templateId: "hard_science" }));
      const initial = createRuntimeArchive(state);
      const replacement = createRuntimeArchive(configureUniverseClock(state, { speed: 8 }));
      expect(replacement.stateId).toBe(initial.stateId);
      await browserRuntimeStorage.put(initial);
      failure.abortNextWrite = true;

      await expect(browserRuntimeStorage.put(replacement)).rejects.toThrow("中止");
      expect(await browserRuntimeStorage.get(initial.stateId)).toEqual(initial);
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });
});

function createIndexedDbStub(failure: { abortNextWrite: boolean } = { abortNextWrite: false }): IDBFactory {
  const records = new Map<string, unknown>();
  let created = false;

  return {
    open: () => {
      const request = {
        result: undefined,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
      } as unknown as IDBOpenDBRequest;
      const database = {
        objectStoreNames: { contains: () => created } as unknown as DOMStringList,
        createObjectStore: () => { created = true; return createStore(records, undefined); },
        transaction: (_name: string, mode: IDBTransactionMode) => createTransaction(records, mode, failure),
        close: () => undefined,
      } as unknown as IDBDatabase;
      Object.defineProperty(request, "result", { configurable: true, get: () => database });
      queueMicrotask(() => {
        request.onupgradeneeded?.call(request, new Event("upgradeneeded") as IDBVersionChangeEvent);
        request.onsuccess?.call(request, new Event("success"));
      });
      return request;
    },
  } as unknown as IDBFactory;
}

function createTransaction(records: Map<string, unknown>, mode: IDBTransactionMode, failure: { abortNextWrite: boolean }): IDBTransaction {
  const staged = new Map(records);
  const transaction = {
    error: null,
    oncomplete: null,
    onerror: null,
    onabort: null,
    objectStore: () => createStore(mode === "readwrite" ? staged : records, mode === "readwrite" ? transaction : undefined, () => {
      if (failure.abortNextWrite) {
        failure.abortNextWrite = false;
        queueMicrotask(() => transaction.onabort?.call(transaction, new Event("abort")));
        return;
      }
      records.clear();
      for (const [key, value] of staged) records.set(key, value);
      completeTransaction(transaction);
    }),
  } as unknown as IDBTransaction;
  return transaction;
}

function createStore(records: Map<string, unknown>, transaction: IDBTransaction | undefined, finishWrite = () => completeTransaction(transaction)): IDBObjectStore {
  return {
    put: (value: unknown) => {
      const stateId = (value as { stateId: string }).stateId;
      records.set(stateId, structuredClone(value));
      finishWrite();
      return successfulRequest(undefined);
    },
    get: (stateId: IDBValidKey) => successfulRequest(records.get(String(stateId))),
    getAll: () => successfulRequest([...records.values()].map((value) => structuredClone(value))),
    delete: (stateId: IDBValidKey) => {
      records.delete(String(stateId));
      finishWrite();
      return successfulRequest(undefined);
    },
  } as unknown as IDBObjectStore;
}

function successfulRequest<T>(value: T): IDBRequest<T> {
  const request = { result: value, error: null, onsuccess: null, onerror: null } as unknown as IDBRequest<T>;
  queueMicrotask(() => request.onsuccess?.call(request, new Event("success")));
  return request;
}

function completeTransaction(transaction: IDBTransaction | undefined): void {
  if (!transaction) return;
  queueMicrotask(() => transaction.oncomplete?.call(transaction, new Event("complete")));
}
