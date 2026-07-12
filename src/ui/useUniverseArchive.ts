import { useMemo, useState } from "react";
import type { UniverseSummary } from "../sim";
import {
  ArchiveError,
  filterArchiveEntries,
  mergeArchiveEntries,
  parseArchive,
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
  const [error, setError] = useState<string | undefined>(initial.error);
  const [status, setStatus] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [exportText, setExportText] = useState("");
  const visibleEntries = useMemo(() => filterArchiveEntries(entries, query, favoritesOnly), [entries, query, favoritesOnly]);

  function commit(next: UniverseArchiveEntry[], message: string) {
    try {
      storage.write(serializeArchive(next, clock()));
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
      commit(saveUniverseEntry(entries, universe, title, clock()), "当前宇宙已保存。");
    } catch (reason) {
      setError(errorMessage(reason, "当前宇宙无法保存。"));
    }
  }

  function toggleFavorite(id: string) {
    commit(toggleArchiveFavorite(entries, id, clock()), "收藏状态已更新。");
  }

  function remove(id: string) {
    commit(removeArchiveEntry(entries, id), "存档已删除。");
  }

  function exportAll() {
    setExportText(serializeArchive(entries, clock()));
    setError(undefined);
    setStatus(`已生成 ${entries.length} 条存档的导出 JSON。`);
  }

  function importAll(raw: string) {
    try {
      const imported = parseArchive(raw);
      const next = mergeArchiveEntries(entries, imported.entries);
      const currentIds = new Set(entries.map((entry) => entry.id));
      const added = imported.entries.filter((entry) => !currentIds.has(entry.id)).length;
      const updated = imported.entries.length - added;
      commit(next, `导入完成：新增 ${added} 条，更新 ${updated} 条，当前共有 ${next.length} 条。`);
    } catch (reason) {
      setError(errorMessage(reason, "存档导入失败。"));
      setStatus(undefined);
    }
  }

  return {
    entries,
    error,
    exportAll,
    exportText,
    favoritesOnly,
    importAll,
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

function readInitialArchive(storage: ArchiveStorage): { entries: UniverseArchiveEntry[]; error?: string } {
  try {
    const raw = storage.read();
    return raw ? { entries: parseArchive(raw).entries } : { entries: [] };
  } catch (reason) {
    return { entries: [], error: errorMessage(reason, "本地图书馆读取失败。") };
  }
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ArchiveError) return reason.message;
  return reason instanceof Error && reason.message ? `${fallback} ${reason.message}` : fallback;
}
