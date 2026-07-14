import { useMemo, useRef, useState } from "react";
import type { UniverseSummary } from "../sim";
import {
  ArchiveError,
  filterArchiveEntries,
  mergeArchiveEntriesPreservingLocalChanges,
  parseArchiveAsync,
  parseStoredArchive,
  removeArchiveEntry,
  saveUniverseEntry,
  serializeArchive,
  toggleArchiveFavorite,
  type UniverseArchiveEntry,
} from "./archive";
import { browserArchiveStorage, type ArchiveStorage } from "./archiveStorage";

export function useUniverseArchive(storage: ArchiveStorage = browserArchiveStorage, clock: () => string = () => new Date().toISOString()) {
  const initial = useMemo(() => readInitialArchive(storage), [storage]);
  const [entries, setEntries] = useState<UniverseArchiveEntry[]>(initial.entries);
  const entriesRef = useRef<UniverseArchiveEntry[]>(initial.entries);
  const importingRef = useRef(false);
  const [error, setError] = useState<string | undefined>(initial.error);
  const [status, setStatus] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [exportText, setExportText] = useState("");
  const [importing, setImporting] = useState(false);
  const visibleEntries = useMemo(() => filterArchiveEntries(entries, query, favoritesOnly), [entries, query, favoritesOnly]);

  function commit(next: UniverseArchiveEntry[], message: string) {
    try {
      storage.write(serializeArchive(next, clock()));
      entriesRef.current = next;
      setEntries(next);
      setError(undefined);
      setStatus(message);
    } catch (reason) {
      setError(errorMessage(reason, "本地图书馆写入失败。"));
      setStatus(undefined);
    }
  }

  function saveCurrent(universe: UniverseSummary, title: string) {
    try {
      void universe.causalGraph;
      commit(saveUniverseEntry(entriesRef.current, universe, title, clock()), "当前宇宙已保存。");
    } catch (reason) {
      setError(errorMessage(reason, "当前宇宙无法保存。"));
    }
  }

  function toggleFavorite(id: string) {
    commit(toggleArchiveFavorite(entriesRef.current, id, clock()), "收藏状态已更新。");
  }

  function remove(id: string) {
    commit(removeArchiveEntry(entriesRef.current, id), "存档已删除。");
  }

  function exportAll() {
    const currentEntries = entriesRef.current;
    setExportText(serializeArchive(currentEntries, clock()));
    setError(undefined);
    setStatus(`已生成 ${currentEntries.length} 条存档的导出 JSON。`);
  }

  async function importAll(raw: string) {
    if (importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    const baselineEntries = entriesRef.current;
    try {
      const imported = await parseArchiveAsync(raw);
      const currentEntries = entriesRef.current;
      const result = mergeArchiveEntriesPreservingLocalChanges(baselineEntries, currentEntries, imported.entries);
      const preserved = result.preservedLocalChanges > 0 ? `，保留 ${result.preservedLocalChanges} 条导入期间的本地变更` : "";
      commit(result.entries, `导入完成：新增 ${result.added} 条，更新 ${result.updated} 条${preserved}，当前共有 ${result.entries.length} 条。`);
    } catch (reason) {
      setError(errorMessage(reason, "存档导入失败。"));
      setStatus(undefined);
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  }

  return {
    entries,
    error,
    exportAll,
    exportText,
    favoritesOnly,
    importAll,
    importing,
    query,
    remove,
    saveCurrent,
    setExportText,
    setFavoritesOnly,
    setQuery,
    status,
    toggleFavorite,
    visibleEntries,
  };
}

export type UniverseArchiveController = ReturnType<typeof useUniverseArchive>;

function readInitialArchive(storage: ArchiveStorage): { entries: UniverseArchiveEntry[]; error?: string } {
  try {
    const raw = storage.read();
    return raw ? { entries: parseStoredArchive(raw).entries } : { entries: [] };
  } catch (reason) {
    return { entries: [], error: errorMessage(reason, "本地图书馆读取失败。") };
  }
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ArchiveError) return reason.message;
  return reason instanceof Error && reason.message ? `${fallback} ${reason.message}` : fallback;
}
