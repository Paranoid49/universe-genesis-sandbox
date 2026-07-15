import {
  parseRuntimeArchive,
  serializeRuntimeArchive,
  type RuntimeArchiveEnvelope,
  type RuntimeStorageAdapter,
} from "../sim/current";

export const RUNTIME_DATABASE_NAME = "ugs.runtime.v5";
export const RUNTIME_DATABASE_VERSION = 1;
export const RUNTIME_STORAGE_VERSION = "ugs-runtime-storage@5";
const ARCHIVE_STORE = "runtime-archives";

export type { RuntimeStorageAdapter } from "../sim/current";

export type MemoryRuntimeStorageOptions = {
  rejectWrite?: (archive: RuntimeArchiveEnvelope) => boolean;
};

export function createMemoryRuntimeStorage(options: MemoryRuntimeStorageOptions = {}): RuntimeStorageAdapter {
  const archives = new Map<string, string>();
  return {
    storageVersion: RUNTIME_STORAGE_VERSION,
    migrate: async () => undefined,
    put: async (archive) => {
      const serialized = serializeRuntimeArchive(archive);
      const verified = parseRuntimeArchive(serialized);
      if (options.rejectWrite?.(verified)) throw new Error("运行存档写入被测试适配器拒绝。");
      archives.set(verified.stateId, serialized);
    },
    get: async (stateId) => {
      const serialized = archives.get(stateId);
      return serialized ? parseRuntimeArchive(serialized) : undefined;
    },
    list: async () => Object.freeze([...archives.values()]
      .map(parseRuntimeArchive)
      .sort((left, right) => left.stateId.localeCompare(right.stateId))),
    remove: async (stateId) => {
      archives.delete(stateId);
    },
  };
}

export const browserRuntimeStorage: RuntimeStorageAdapter = {
  storageVersion: RUNTIME_STORAGE_VERSION,
  migrate: async () => {
    const database = await openRuntimeDatabase();
    database.close();
  },
  put: async (archive) => {
    const verified = parseRuntimeArchive(serializeRuntimeArchive(archive));
    const database = await openRuntimeDatabase();
    try {
      await runTransaction(database, "readwrite", (store) => store.put(verified));
    } finally {
      database.close();
    }
  },
  get: async (stateId) => {
    const database = await openRuntimeDatabase();
    try {
      const value = await runRequest<unknown>(database.transaction(ARCHIVE_STORE, "readonly").objectStore(ARCHIVE_STORE).get(stateId));
      return value === undefined ? undefined : parseRuntimeArchive(JSON.stringify(value));
    } finally {
      database.close();
    }
  },
  list: async () => {
    const database = await openRuntimeDatabase();
    try {
      const values = await runRequest<unknown[]>(database.transaction(ARCHIVE_STORE, "readonly").objectStore(ARCHIVE_STORE).getAll());
      return Object.freeze(values.map((value) => parseRuntimeArchive(JSON.stringify(value))).sort((left, right) => left.stateId.localeCompare(right.stateId)));
    } finally {
      database.close();
    }
  },
  remove: async (stateId) => {
    const database = await openRuntimeDatabase();
    try {
      await runTransaction(database, "readwrite", (store) => store.delete(stateId));
    } finally {
      database.close();
    }
  },
};

function openRuntimeDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("当前环境不支持 IndexedDB 运行存档。"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RUNTIME_DATABASE_NAME, RUNTIME_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ARCHIVE_STORE)) database.createObjectStore(ARCHIVE_STORE, { keyPath: "stateId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开运行存档数据库。"));
    request.onblocked = () => reject(new Error("运行存档数据库升级被其他页面阻塞。"));
  });
}

function runTransaction(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ARCHIVE_STORE, mode);
    operation(transaction.objectStore(ARCHIVE_STORE));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("运行存档事务失败。"));
    transaction.onabort = () => reject(transaction.error ?? new Error("运行存档事务已中止。"));
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("运行存档读取失败。"));
  });
}
