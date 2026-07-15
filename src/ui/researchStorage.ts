import {
  parseResearchArchive,
  serializeResearchArchive,
  type ResearchStorageAdapter,
} from "../sim";

export const RESEARCH_STORAGE_VERSION = "ugs-research-storage@3";
const DATABASE_NAME = "ugs.research.v3";
const DATABASE_VERSION = 1;
const STORE_NAME = "research-notebooks";

export function createMemoryResearchStorage(options: { rejectWrite?: () => boolean } = {}): ResearchStorageAdapter {
  const records = new Map<string, string>();
  return {
    storageVersion: RESEARCH_STORAGE_VERSION,
    migrate: async () => undefined,
    put: async (archive, validateSignal) => {
      const verified = parseResearchArchive(serializeResearchArchive(archive), validateSignal);
      if (options.rejectWrite?.()) throw new Error("研究记录写入被测试适配器拒绝。");
      records.set(verified.notebookId, serializeResearchArchive(verified));
    },
    get: async (notebookId, validateSignal) => {
      const raw = records.get(notebookId);
      return raw ? parseResearchArchive(raw, validateSignal) : undefined;
    },
    list: async (validateSignal) => [...records.values()].map((raw) => parseResearchArchive(raw, validateSignal)),
    remove: async (notebookId) => { records.delete(notebookId); },
  };
}

export const browserResearchStorage: ResearchStorageAdapter = {
  storageVersion: RESEARCH_STORAGE_VERSION,
  migrate: async () => { const database = await openDatabase(); database.close(); },
  put: async (archive, validateSignal) => {
    const verified = parseResearchArchive(serializeResearchArchive(archive), validateSignal);
    const database = await openDatabase();
    try {
      await transaction(database, "readwrite", (store) => store.put(verified));
    } finally {
      database.close();
    }
  },
  get: async (notebookId, validateSignal) => {
    const database = await openDatabase();
    try {
      const value = await request<unknown>(database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(notebookId));
      return value === undefined ? undefined : parseResearchArchive(JSON.stringify(value), validateSignal);
    } finally {
      database.close();
    }
  },
  list: async (validateSignal) => {
    const database = await openDatabase();
    try {
      const values = await request<unknown[]>(database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll());
      return Object.freeze(values.map((value) => parseResearchArchive(JSON.stringify(value), validateSignal)));
    } finally {
      database.close();
    }
  },
  remove: async (notebookId) => {
    const database = await openDatabase();
    try {
      await transaction(database, "readwrite", (store) => store.delete(notebookId));
    } finally {
      database.close();
    }
  },
};

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("当前环境不支持 IndexedDB 研究记录。"));
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE_NAME)) open.result.createObjectStore(STORE_NAME, { keyPath: "notebookId" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("无法打开研究记录数据库。"));
    open.onblocked = () => reject(new Error("研究记录数据库升级被其他页面阻塞。"));
  });
}

function transaction(database: IDBDatabase, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    const current = database.transaction(STORE_NAME, mode);
    operation(current.objectStore(STORE_NAME));
    current.oncomplete = () => resolve();
    current.onerror = () => reject(current.error ?? new Error("研究记录事务失败。"));
    current.onabort = () => reject(current.error ?? new Error("研究记录事务已中止。"));
  });
}

function request<T>(current: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    current.onsuccess = () => resolve(current.result);
    current.onerror = () => reject(current.error ?? new Error("研究记录读取失败。"));
  });
}

export type { ResearchStorageAdapter } from "../sim";
