import { assertGenerateUniverseInput, decodeShareCode, formatSeed, generateUniverse, RULESET_VERSION, type UniverseSummary, type UniverseTemplateId } from "../sim";

export const ARCHIVE_FORMAT = "ugs-universe-archive";
export const ARCHIVE_VERSION = "A1";
export const ARCHIVE_LIMIT = 50;

export type UniverseArchiveEntry = {
  id: string;
  title: string;
  seed: string;
  displaySeed: string;
  templateId: UniverseTemplateId;
  rulesetVersion: string;
  shareCode: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UniverseArchiveEnvelope = {
  format: typeof ARCHIVE_FORMAT;
  version: typeof ARCHIVE_VERSION;
  exportedAt: string;
  entries: UniverseArchiveEntry[];
};

export class ArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveError";
  }
}

export function saveUniverseEntry(entries: UniverseArchiveEntry[], universe: UniverseSummary, title: string, now: string): UniverseArchiveEntry[] {
  const normalizedTitle = normalizeTitle(title, universe.name);
  const current = entries.find((entry) => entry.id === universe.shareCode);
  const next: UniverseArchiveEntry = {
    id: universe.shareCode,
    title: normalizedTitle,
    seed: universe.seed,
    displaySeed: universe.displaySeed,
    templateId: universe.templateId,
    rulesetVersion: universe.rulesetVersion,
    shareCode: universe.shareCode,
    favorite: current?.favorite ?? false,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  if (!current && entries.length >= ARCHIVE_LIMIT) throw new ArchiveError(`本地图书馆最多保存 ${ARCHIVE_LIMIT} 条宇宙。`);
  return sortArchiveEntries([...entries.filter((entry) => entry.id !== next.id), next]);
}

export function toggleArchiveFavorite(entries: UniverseArchiveEntry[], id: string, now: string): UniverseArchiveEntry[] {
  return sortArchiveEntries(entries.map((entry) => entry.id === id ? { ...entry, favorite: !entry.favorite, updatedAt: now } : entry));
}

export function removeArchiveEntry(entries: UniverseArchiveEntry[], id: string): UniverseArchiveEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

export function filterArchiveEntries(entries: UniverseArchiveEntry[], query: string, favoritesOnly: boolean): UniverseArchiveEntry[] {
  const needle = query.trim().toLocaleLowerCase("zh-CN");
  return sortArchiveEntries(entries.filter((entry) => (!favoritesOnly || entry.favorite)
    && (!needle || [entry.title, entry.seed, entry.displaySeed, entry.templateId, entry.shareCode]
      .some((value) => value.toLocaleLowerCase("zh-CN").includes(needle)))));
}

export function serializeArchive(entries: UniverseArchiveEntry[], now: string): string {
  const envelope: UniverseArchiveEnvelope = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: now,
    entries: sortArchiveEntries(entries),
  };
  return JSON.stringify(envelope, null, 2);
}

export function parseArchive(raw: string): UniverseArchiveEnvelope {
  return parseArchiveEnvelope(raw, true);
}

export function parseStoredArchive(raw: string): UniverseArchiveEnvelope {
  return parseArchiveEnvelope(raw, false);
}

export async function parseArchiveAsync(raw: string): Promise<UniverseArchiveEnvelope> {
  const envelope = parseArchiveEnvelope(raw, false);
  for (let index = 0; index < envelope.entries.length; index += 1) {
    verifyRestorableEntry(envelope.entries[index], index);
    if ((index + 1) % 5 === 0) await yieldToBrowser();
  }
  return envelope;
}

function parseArchiveEnvelope(raw: string, verifyGeneration: boolean): UniverseArchiveEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ArchiveError("存档 JSON 无法解析。");
  }
  if (!isRecord(value) || value.format !== ARCHIVE_FORMAT) throw new ArchiveError("存档标识无效。");
  if (value.version !== ARCHIVE_VERSION) throw new ArchiveError(`存档版本不受支持，仅支持 ${ARCHIVE_VERSION}。`);
  if (typeof value.exportedAt !== "string" || !isIsoDate(value.exportedAt)) throw new ArchiveError("存档导出时间无效。");
  if (!Array.isArray(value.entries)) throw new ArchiveError("存档条目必须是数组。");
  if (value.entries.length > ARCHIVE_LIMIT) throw new ArchiveError(`导入条目超过 ${ARCHIVE_LIMIT} 条上限。`);
  const entries = value.entries.map((entry, index) => validateEntry(entry, index, verifyGeneration));
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new ArchiveError("存档包含重复条目 ID。");
  return { format: ARCHIVE_FORMAT, version: ARCHIVE_VERSION, exportedAt: value.exportedAt, entries: sortArchiveEntries(entries) };
}

export function mergeArchiveEntries(current: UniverseArchiveEntry[], imported: UniverseArchiveEntry[]): UniverseArchiveEntry[] {
  const merged = new Map(current.map((entry) => [entry.id, entry]));
  imported.forEach((entry) => merged.set(entry.id, entry));
  if (merged.size > ARCHIVE_LIMIT) throw new ArchiveError(`合并后条目超过 ${ARCHIVE_LIMIT} 条上限。`);
  return sortArchiveEntries([...merged.values()]);
}

export function mergeArchiveEntriesPreservingLocalChanges(
  baseline: UniverseArchiveEntry[],
  current: UniverseArchiveEntry[],
  imported: UniverseArchiveEntry[],
): { entries: UniverseArchiveEntry[]; added: number; updated: number; preservedLocalChanges: number } {
  const baselineById = new Map(baseline.map((entry) => [entry.id, entry]));
  const currentById = new Map(current.map((entry) => [entry.id, entry]));
  const merged = new Map(currentById);
  let added = 0;
  let updated = 0;
  let preservedLocalChanges = 0;

  for (const importedEntry of imported) {
    const baselineEntry = baselineById.get(importedEntry.id);
    const currentEntry = currentById.get(importedEntry.id);
    if (!baselineEntry) {
      if (currentEntry) {
        if (!sameArchiveEntry(currentEntry, importedEntry)) preservedLocalChanges += 1;
      } else {
        merged.set(importedEntry.id, importedEntry);
        added += 1;
      }
      continue;
    }
    if (!currentEntry || !sameArchiveEntry(currentEntry, baselineEntry)) {
      preservedLocalChanges += 1;
      continue;
    }
    merged.set(importedEntry.id, importedEntry);
    if (!sameArchiveEntry(currentEntry, importedEntry)) updated += 1;
  }

  if (merged.size > ARCHIVE_LIMIT) throw new ArchiveError(`合并后条目超过 ${ARCHIVE_LIMIT} 条上限。`);
  return { entries: sortArchiveEntries([...merged.values()]), added, updated, preservedLocalChanges };
}

export function sortArchiveEntries(entries: UniverseArchiveEntry[]): UniverseArchiveEntry[] {
  return [...entries].sort((left, right) => Number(right.favorite) - Number(left.favorite)
    || right.updatedAt.localeCompare(left.updatedAt)
    || left.title.localeCompare(right.title, "zh-CN"));
}

function validateEntry(value: unknown, index: number, verifyGeneration: boolean): UniverseArchiveEntry {
  if (!isRecord(value)) throw new ArchiveError(`第 ${index + 1} 条存档不是对象。`);
  const strings = ["id", "title", "seed", "displaySeed", "templateId", "rulesetVersion", "shareCode", "createdAt", "updatedAt"] as const;
  for (const field of strings) {
    if (typeof value[field] !== "string" || value[field].length === 0 || value[field].length > fieldLimit(field)) {
      throw new ArchiveError(`第 ${index + 1} 条存档的 ${field} 字段无效。`);
    }
  }
  if (typeof value.favorite !== "boolean") throw new ArchiveError(`第 ${index + 1} 条存档的 favorite 字段无效。`);
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) throw new ArchiveError(`第 ${index + 1} 条存档的时间字段无效。`);
  const shareCode = value.shareCode as string;
  const decoded = decodeShareCode(shareCode);
  if (!decoded || decoded.warnings.length > 0 || decoded.rulesetVersion !== RULESET_VERSION) throw new ArchiveError(`第 ${index + 1} 条存档的分享码无效或不受支持。`);
  if (shareCode !== value.id
    || value.seed !== decoded.seed
    || value.displaySeed !== formatSeed(decoded.seed)
    || value.templateId !== decoded.templateId
    || value.rulesetVersion !== decoded.rulesetVersion) {
    throw new ArchiveError(`第 ${index + 1} 条存档与分享码内容不一致。`);
  }
  const entry = value as UniverseArchiveEntry;
  if (verifyGeneration) verifyRestorableEntry(entry, index);
  return entry;
}

function verifyRestorableEntry(entry: UniverseArchiveEntry, index: number): void {
  const decoded = decodeShareCode(entry.shareCode);
  if (!decoded) throw new ArchiveError(`第 ${index + 1} 条存档的分享码无效或不受支持。`);
  let restored: UniverseSummary;
  try {
    assertGenerateUniverseInput(decoded);
    restored = generateUniverse(decoded);
  } catch {
    throw new ArchiveError(`第 ${index + 1} 条存档的分享分支无法生成。`);
  }
  if (entry.shareCode !== restored.shareCode || entry.id !== restored.shareCode) {
    throw new ArchiveError(`第 ${index + 1} 条存档与分享码内容不一致。`);
  }
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function normalizeTitle(title: string, fallback: string): string {
  const normalized = title.trim() || fallback;
  if (normalized.length > 80) throw new ArchiveError("存档标题不能超过 80 个字符。");
  return normalized;
}

function fieldLimit(field: string): number {
  return field === "title" ? 80 : field === "shareCode" || field === "id" ? 4096 : 160;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameArchiveEntry(left: UniverseArchiveEntry, right: UniverseArchiveEntry): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}
