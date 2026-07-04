import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeShareCode,
  decodeShareParams,
  generateUniverse,
  RULESET_VERSION,
  UNIVERSE_TEMPLATES,
  type UniverseSummary,
} from "../src/sim";

const fixedSeeds = [
  "LUX-7F3A-91C2",
  "ASH-44DE-0101",
  "DREAM-777",
  "VOID-0001",
  "MYTH-STAR-42",
];

describe("阶段 1 宇宙生成", () => {
  it("同一 seed、模板和规则版本会生成完全一致的宇宙", () => {
    const first = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const second = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });

    expect(first.rulesetVersion).toBe(RULESET_VERSION);
    expect(second).toEqual(first);
  });

  it("不同 seed 会产生可感知差异", () => {
    const first = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const second = generateUniverse({ seed: fixedSeeds[1], templateId: "high_magic" });

    expect(second.name === first.name && second.tagline === first.tagline && second.timeline[0].title === first.timeline[0].title).toBe(false);
  });

  it("10 个模板都能生成非空宇宙", () => {
    for (const template of UNIVERSE_TEMPLATES) {
      const universe = generateUniverse({ seed: fixedSeeds[2], templateId: template.id });

      expectCompleteUniverse(universe);
      expect(universe.templateId).toBe(template.id);
      expect(universe.templateShortCode).toBe(template.shortCode);
    }
  });

  it("分享码和链接参数能恢复复现信息", () => {
    const universe = generateUniverse({ seed: fixedSeeds[3], templateId: "mechanical_divinity" });

    expect(decodeShareCode(universe.shareCode)).toEqual({
      seed: universe.seed,
      templateId: universe.templateId,
      rulesetVersion: universe.rulesetVersion,
      warnings: [],
    });

    expect(decodeShareParams(universe.shareUrl)).toEqual({
      seed: universe.seed,
      templateId: universe.templateId,
      rulesetVersion: universe.rulesetVersion,
      warnings: [],
    });
  });

  it("无法识别分享短码时会回退并给出提示", () => {
    const decoded = decodeShareParams("?s=LUX7F3A91C2&t=NOPE&v=UNKNOWN");

    expect(decoded?.seed).toBe("LUX7F3A91C2");
    expect(decoded?.templateId).toBe("high_magic");
    expect(decoded?.rulesetVersion).toBe(RULESET_VERSION);
    expect(decoded?.warnings.length).toBe(2);
  });

  it("50 个 seed 冒烟测试不出现空白字段或事件数量异常", () => {
    const start = performance.now();
    for (let index = 0; index < 50; index += 1) {
      const template = UNIVERSE_TEMPLATES[index % UNIVERSE_TEMPLATES.length];
      const universe = generateUniverse({ seed: `SMOKE-${String(index).padStart(2, "0")}-UGS`, templateId: template.id });
      expectCompleteUniverse(universe);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it("模拟核心不直接使用 Math.random", () => {
    const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../src/sim");
    const offenders = listSourceFiles(sourceRoot).filter((file) => readFileSync(file, "utf8").includes("Math.random"));

    expect(offenders).toEqual([]);
  });
});

function expectCompleteUniverse(universe: UniverseSummary): void {
  expect(universe.seed).not.toBe("");
  expect(universe.name).not.toBe("");
  expect(universe.archetype).not.toBe("");
  expect(universe.tagline).not.toBe("");
  expect(universe.description).not.toBe("");
  expect(universe.shareCode).not.toBe("");
  expect(universe.timeline.length).toBeGreaterThanOrEqual(8);
  expect(universe.timeline.length).toBeLessThanOrEqual(12);
  expect(new Set(universe.timeline.map((event) => event.era)).size).toBeGreaterThanOrEqual(4);
  expect(Object.values(universe.metrics).every((metric) => metric.label && metric.explanation)).toBe(true);
  expect(Object.values(universe.laws).every((law) => law.rating.label && law.rating.explanation && law.traits.length >= 3)).toBe(true);
  expect(universe.timeline.every((event) => event.title && event.description && event.causes.length > 0 && event.effects.length > 0)).toBe(true);
}

function listSourceFiles(root: string): string[] {
  const entries = readdirSync(root);
  return entries.flatMap((entry) => {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return listSourceFiles(fullPath);
    }
    return fullPath.endsWith(".ts") || fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}
