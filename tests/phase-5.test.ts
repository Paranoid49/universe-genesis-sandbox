import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../src/App";
import { generateUniverse, UNIVERSE_TEMPLATES } from "../src/sim";
import {
  allPlanets,
  allStructuredLaws,
  civilizationPathIsCoherent,
  fixedSeeds,
  listSourceFiles,
  pathFromTest,
} from "./helpers";

describe("阶段 5 文明演化与神话生成", () => {
  it("文明实体从生命行星的文明候选种子派生，并保持同 seed 完全复现", () => {
    const first = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const second = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const candidatePlanetIds = new Set(
      allPlanets(first)
        .filter((planet) => planet.biosphere?.civilizationSeed)
        .map((planet) => planet.id),
    );

    expect(second.civilizations).toEqual(first.civilizations);
    expect(first.civilizations.length).toBeGreaterThan(0);
    expect(first.civilizations.length).toBe(candidatePlanetIds.size);
    expect(first.civilizations.every((civilization) => candidatePlanetIds.has(civilization.originPlanetId))).toBe(true);
  });

  it("文明路径、神话系统和文明历史都能追踪到已有来源", () => {
    const universe = generateUniverse({ seed: fixedSeeds[1], templateId: "mythic" });
    const eventIds = new Set(universe.timeline.map((event) => event.id));
    const ruleIds = new Set(allStructuredLaws(universe).map((rule) => rule.id));

    for (const civilization of universe.civilizations) {
      expect(civilization.name).not.toBe("");
      expect(civilization.path).not.toBe("");
      expect(civilization.mythology.type).not.toBe("");
      expect(civilization.mythology.deityName).not.toBe("");
      expect([civilization.technologyLevel, civilization.magicLevel, civilization.faithIntensity, civilization.expansionDrive, civilization.stability, civilization.extinctionRisk].every((value) => value >= 0 && value <= 100)).toBe(true);
      expect(civilization.sourceEventIds.length).toBeGreaterThan(0);
      expect(civilization.sourceRuleIds.length).toBeGreaterThan(0);
      expect(civilization.sourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);
      expect(civilization.sourceRuleIds.every((ruleId) => ruleIds.has(ruleId))).toBe(true);
      expect(civilization.mythology.sourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);
      expect(civilization.mythology.sourceRuleIds.every((ruleId) => ruleIds.has(ruleId))).toBe(true);
      expect(civilization.historyEvents.length).toBeGreaterThanOrEqual(8);
      expect(civilization.historyEvents.length).toBeLessThanOrEqual(15);
      expect(civilization.historyEvents.every((event) => event.title && event.description && event.sourceEventIds.every((eventId) => eventIds.has(eventId)) && event.sourceRuleIds.every((ruleId) => ruleIds.has(ruleId)))).toBe(true);
      expect(civilizationPathIsCoherent(civilization, universe)).toBe(true);
    }
  });

  it("跨模板和 seed 至少覆盖 5 类文明终局", () => {
    const fates = new Set<string>();
    for (const template of UNIVERSE_TEMPLATES) {
      for (const seed of fixedSeeds) {
        for (const civilization of generateUniverse({ seed, templateId: template.id }).civilizations) {
          fates.add(civilization.fate);
        }
      }
    }

    expect(fates.size).toBeGreaterThanOrEqual(5);
  });

  it("页面提供文明演化、文明详情、神话系统和文明历史入口", () => {
    const markup = renderToStaticMarkup(createElement(App, { initialPage: "civilizations" }));

    expect(markup).toContain("文明演化");
    expect(markup).toContain("文明详情");
    expect(markup).toContain("神话系统");
    expect(markup).toContain("文明历史");
  });

  it("阶段 5 没有提前实现阶段 6 的造物主干预或奇迹交互", () => {
    const sourceRoot = pathFromTest(import.meta.url, "../src");
    const forbiddenPatterns = [/造物主模式/, /奇迹点/, /干预日志/, /改写局部法则/, /\bMiracle\b/, /\bIntervention\b/];
    const offenders = listSourceFiles(sourceRoot).filter((file) => {
      const source = readFileSync(file, "utf8");
      return forbiddenPatterns.some((pattern) => pattern.test(source));
    });

    expect(offenders).toEqual([]);
  });
});
