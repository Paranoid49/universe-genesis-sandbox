import { describe, expect, it } from "vitest";
import { decodeShareCode, generateUniverse, RULESET_VERSION } from "../src/sim";
import {
  ARCHIVE_LIMIT,
  ArchiveError,
  filterArchiveEntries,
  mergeArchiveEntries,
  parseArchive,
  saveUniverseEntry,
  serializeArchive,
  toggleArchiveFavorite,
} from "../src/ui/archive";

describe("阶段 8：本地存档、分享与宇宙图书馆", () => {
  const first = generateUniverse({ seed: "ARCHIVE-001", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
  const second = generateUniverse({ seed: "ARCHIVE-002", rulesetVersion: RULESET_VERSION, templateId: "hard_science" });
  const earlier = "2026-01-01T00:00:00.000Z";
  const later = "2026-02-01T00:00:00.000Z";

  it("同一分享码重复保存只更新一个稳定条目", () => {
    const saved = saveUniverseEntry([], first, "第一宇宙", earlier);
    const updated = saveUniverseEntry(saved, first, "更新标题", later);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ id: first.shareCode, title: "更新标题", createdAt: earlier, updatedAt: later });
  });

  it("收藏优先排序并支持组合搜索", () => {
    const entries = saveUniverseEntry(saveUniverseEntry([], first, "魔法档案", earlier), second, "科学档案", later);
    const favored = toggleArchiveFavorite(entries, first.shareCode, later);
    expect(favored[0].id).toBe(first.shareCode);
    expect(filterArchiveEntries(favored, second.seed, false).map((entry) => entry.id)).toEqual([second.shareCode]);
    expect(filterArchiveEntries(favored, "魔法", true).map((entry) => entry.id)).toEqual([first.shareCode]);
  });

  it("A1 导出后可以无损解析并合并", () => {
    const entries = saveUniverseEntry(saveUniverseEntry([], first, "第一宇宙", earlier), second, "第二宇宙", later);
    const parsed = parseArchive(serializeArchive(entries, later));
    expect(parsed.entries).toEqual(entries);
    expect(mergeArchiveEntries([], parsed.entries)).toEqual(entries);
  });

  it("恢复载荷仍由当前分享码确定性生成", () => {
    const entry = saveUniverseEntry([], first, "第一宇宙", earlier)[0];
    expect(entry.shareCode).toBe(first.shareCode);
    expect(generateUniverse({ seed: first.seed, rulesetVersion: RULESET_VERSION, templateId: first.templateId }).shareCode).toBe(entry.shareCode);
  });

  it("带干预的 A1 存档可完整校验并恢复同一分支", () => {
    const target = first.galaxies[0].starSystems[0].planets[0];
    const branch = generateUniverse({
      seed: first.seed,
      rulesetVersion: RULESET_VERSION,
      templateId: first.templateId,
      interventions: [{ id: "archive-miracle", miracleType: "bless_planet", targetId: target.id }],
    });
    const entry = parseArchive(serializeArchive(saveUniverseEntry([], branch, "干预分支", earlier), later)).entries[0];
    const decoded = decodeShareCode(entry.shareCode)!;
    expect(generateUniverse(decoded).shareCode).toBe(branch.shareCode);
    expect(generateUniverse(decoded).miracleState.appliedMiracles).toHaveLength(1);
  });

  it.each([
    ["损坏 JSON", "{"],
    ["未知版本", JSON.stringify({ format: "ugs-universe-archive", version: "A9", exportedAt: earlier, entries: [] })],
    ["错误标识", JSON.stringify({ format: "wrong", version: "A1", exportedAt: earlier, entries: [] })],
  ])("拒绝%s并保持明确错误", (_label, raw) => {
    expect(() => parseArchive(raw)).toThrow(ArchiveError);
  });

  it("拒绝非法分享码和超容量合并", () => {
    const entry = saveUniverseEntry([], first, "第一宇宙", earlier)[0];
    const invalid = serializeArchive([{ ...entry, shareCode: "BROKEN", id: "BROKEN" }], later);
    expect(() => parseArchive(invalid)).toThrow(/分享码/);
    const many = Array.from({ length: ARCHIVE_LIMIT }, (_, index) => ({ ...entry, id: `id-${index}`, shareCode: entry.shareCode }));
    expect(() => mergeArchiveEntries(many, [{ ...entry, id: "overflow" }])).toThrow(/上限/);
  });

  it("拒绝可解码但不可生成的干预分支", () => {
    const entry = saveUniverseEntry([], first, "第一宇宙", earlier)[0];
    const payload = btoa(JSON.stringify([["bad-id", "bless_planet", "missing-target"]])).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const shareCode = `${first.shareCode}~I1~${payload}`;
    expect(() => parseArchive(serializeArchive([{ ...entry, id: shareCode, shareCode }], later))).toThrow(/无法生成/);
  });

  it.each(["1", "2026-02-01", "2026-02-30T00:00:00.000Z"])("拒绝非严格 ISO 时间 %s", (createdAt) => {
    const entry = saveUniverseEntry([], first, "第一宇宙", earlier)[0];
    expect(() => parseArchive(JSON.stringify({
      format: "ugs-universe-archive", version: "A1", exportedAt: later, entries: [{ ...entry, createdAt }],
    }))).toThrow(/时间/);
  });

  it("拒绝伪造展示 Seed 和非规范分享码别名", () => {
    const entry = saveUniverseEntry([], first, "第一宇宙", earlier)[0];
    expect(() => parseArchive(serializeArchive([{ ...entry, displaySeed: "FAKE-SEED" }], later))).toThrow(/不一致/);
    const alias = entry.shareCode.toLowerCase();
    expect(() => parseArchive(serializeArchive([{ ...entry, id: alias, shareCode: alias }], later))).toThrow(/不一致/);
  });
});
