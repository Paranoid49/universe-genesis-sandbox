import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { App, type AppProps } from "../src/App";
import { generateUniverse, RULESET_VERSION } from "../src/sim";
import { allPlanets, allStructuredLaws, averageGalaxyValue, fixedSeeds, galaxySignature } from "./helpers";

describe("阶段 4 局部对象基础模型", () => {
  it("每个宇宙生成可追踪来源的代表性星系、恒星系和行星", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[0], templateId: "high_magic" });
    const eventIds = new Set(universe.timeline.map((event) => event.id));
    const ruleIds = new Set(allStructuredLaws(universe).map((rule) => rule.id));
    const planetIds = new Set<string>();

    expect(universe.galaxies.length).toBeGreaterThanOrEqual(12);
    expect(universe.galaxies.length).toBeLessThanOrEqual(16);

    for (const galaxy of universe.galaxies) {
      expect(galaxy.starSystems.length).toBeGreaterThanOrEqual(3);
      expect(galaxy.starSystems.length).toBeLessThanOrEqual(8);
      expect(galaxy.sourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);
      expect(galaxy.sourceRuleIds.every((ruleId) => ruleIds.has(ruleId))).toBe(true);

      for (const system of galaxy.starSystems) {
        expect(system.planets.length).toBeGreaterThanOrEqual(2);
        expect(system.planets.length).toBeLessThanOrEqual(6);
        expect(system.sourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);
        expect(system.sourceRuleIds.every((ruleId) => ruleIds.has(ruleId))).toBe(true);

        for (const planet of system.planets) {
          expect(planetIds.has(planet.id)).toBe(false);
          planetIds.add(planet.id);
          expect(planet.sourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);
          expect(planet.sourceRuleIds.every((ruleId) => ruleIds.has(ruleId))).toBe(true);
          expect([planet.habitability, planet.magicSaturation, planet.atmosphere, planet.water, planet.stability].every((value) => value >= 0 && value <= 100)).toBe(true);
          if (planet.biosphere) {
            expect(planet.biosphere.sourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);
            expect(planet.biosphere.sourceRuleIds.every((ruleId) => ruleIds.has(ruleId))).toBe(true);
          }
        }
      }
    }
  });

  it("局部对象会出现生命样本，并保持同 seed 完全复现", () => {
    const first = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[2], templateId: "high_magic" });
    const second = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[2], templateId: "high_magic" });
    const biosphereCount = first.galaxies
      .flatMap((galaxy) => galaxy.starSystems)
      .flatMap((system) => system.planets)
      .filter((planet) => planet.biosphere).length;

    expect(second.galaxies).toEqual(first.galaxies);
    expect(biosphereCount).toBeGreaterThan(0);
  });

  it("不同模板会改变局部对象结构和异常倾向", () => {
    const hardScience = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[3], templateId: "hard_science" });
    const chaoticLaws = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[3], templateId: "chaotic_laws" });
    const hardSignature = galaxySignature(hardScience);
    const chaoticSignature = galaxySignature(chaoticLaws);
    const hardHazard = averageGalaxyValue(hardScience, "causalHazard");
    const chaoticHazard = averageGalaxyValue(chaoticLaws, "causalHazard");

    expect(chaoticSignature).not.toBe(hardSignature);
    expect(chaoticHazard).toBeGreaterThan(hardHazard);
  });

  it("生命行星为阶段 5 文明开发保留可追踪候选种子", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[0], templateId: "high_magic" });
    const eventIds = new Set(universe.timeline.map((event) => event.id));
    const ruleIds = new Set(allStructuredLaws(universe).map((rule) => rule.id));
    const candidates = allPlanets(universe).flatMap((planet) =>
      planet.biosphere?.civilizationSeed ? [{ planet, seed: planet.biosphere.civilizationSeed }] : [],
    );

    expect(candidates.length).toBeGreaterThan(0);
    for (const { planet, seed } of candidates) {
      expect(seed.originPlanetId).toBe(planet.id);
      expect(seed.speciesType).not.toBe("");
      expect(seed.fate).not.toBe("");
      expect([seed.technologyLevel, seed.magicLevel, seed.faithIntensity, seed.expansionDrive, seed.stability].every((value) => value >= 0 && value <= 100)).toBe(true);
      expect(seed.sourceEventIds.length).toBeGreaterThan(0);
      expect(seed.sourceRuleIds.length).toBeGreaterThan(0);
      expect(seed.sourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);
      expect(seed.sourceRuleIds.every((ruleId) => ruleIds.has(ruleId))).toBe(true);
    }
  });

  it("页面提供从宇宙摘要进入星系、恒星系和行星详情的浏览入口", () => {
    const markup = renderToStaticMarkup(createElement<AppProps>(App, { initialPage: "space" }));

    expect(markup).toContain("星系、恒星系与行星");
    expect(markup).toContain("局部探索");
    expect(markup).toContain("星系列表");
    expect(markup).toContain("恒星系");
    expect(markup).toContain("行星详情");
    expect(markup).toContain("阶段 5 文明入口");
  });

  it("默认总览通过一级导航进入重型页面，不直接渲染全部页面内容", () => {
    const markup = renderToStaticMarkup(createElement(App));

    expect(markup).toContain("主页面导航");
    expect(markup).toContain("创世总览");
    expect(markup).toContain("宇宙快照");
    expect(markup).not.toContain("星系列表");
    expect(markup).not.toContain("文明详情");
    expect(markup).not.toContain("文明历史");
  });
});
