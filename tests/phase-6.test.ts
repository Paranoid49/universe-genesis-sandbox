import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../src/App";
import {
  generateUniverse,
  decodeShareCode,
  decodeShareParams,
  miracleDefinitions,
  RULESET_VERSION,
  UniverseInputError,
  type InterventionInput,
  type MiracleType,
} from "../src/sim";
import { allPlanets, fixedSeeds, listSourceFiles, pathFromTest } from "./helpers";

describe("阶段 6 造物主干预与奇迹系统", () => {
  it("至少支持 6 种结构化奇迹，并且每种都有目标、代价、直接效果、概率影响和长期风险", () => {
    expect(miracleDefinitions.length).toBeGreaterThanOrEqual(6);
    for (const definition of miracleDefinitions) {
      expect(definition.type).not.toBe("");
      expect(definition.targetKind).not.toBe("");
      expect(definition.cost.miraclePoints).toBeGreaterThan(0);
      expect(definition.cost.causalityStrain).toBeGreaterThan(0);
      expect(definition.effect.description).not.toBe("");
      expect(Math.abs(definition.effect.delta)).toBeGreaterThan(0);
      expect(definition.probabilityShift.explanation).not.toBe("");
      expect(Math.abs(definition.probabilityShift.delta)).toBeGreaterThan(0);
      expect(definition.longTermRisks.length).toBeGreaterThan(0);
    }
  });

  it("每次奇迹都会生成干预日志、结果事件，并改变至少一个指标或事件概率", () => {
    const base = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const interventions = sampleInterventions(base);
    const intervened = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic", interventions });
    const eventIds = new Set(intervened.timeline.map((event) => event.id));

    expect(intervened.rulesetVersion).toBe(RULESET_VERSION);
    expect(intervened.miracleState.mode).toBe("miracle");
    expect(intervened.miracleState.appliedMiracles).toHaveLength(interventions.length);
    expect(intervened.miracleState.interventionLog).toHaveLength(interventions.length);

    for (const miracle of intervened.miracleState.appliedMiracles) {
      const hasMetricEffect = miracle.immediateEffects.some((effect) => effect.metric !== "timeline" && effect.metric !== "laws" && effect.delta !== 0);
      const hasProbabilityShift = miracle.probabilityShifts.some((shift) => shift.delta !== 0);
      expect(hasMetricEffect || hasProbabilityShift).toBe(true);
    }

    for (const log of intervened.miracleState.interventionLog) {
      expect(log.resultEventIds.length).toBeGreaterThan(0);
      expect(log.resultEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);
      expect(log.directResult).not.toBe("");
      expect(log.longTermConsequence).not.toBe("");
    }

    expect(intervened.timeline.length).toBeGreaterThanOrEqual(base.timeline.length + interventions.length);
    expect(intervened.metrics).not.toEqual(base.metrics);
    expect(intervened.miracleState.probabilityShifts.length).toBe(interventions.length);
  });

  it("同一 seed、模板、规则版本和干预日志会完全复现干预后宇宙", () => {
    const base = generateUniverse({ seed: fixedSeeds[1], templateId: "mythic" });
    const interventions = sampleInterventions(base);
    const first = generateUniverse({ seed: fixedSeeds[1], templateId: "mythic", interventions });
    const second = generateUniverse({ seed: fixedSeeds[1], templateId: "mythic", interventions });

    expect(second).toEqual(first);
  });

  it("奇迹会真实修改目标领域对象，而不是只追加描述日志", () => {
    const base = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const planet = allPlanets(base)[0];
    const system = base.galaxies.flatMap((galaxy) => galaxy.starSystems).find((entry) => entry.planets.some((entryPlanet) => entryPlanet.id === planet.id));
    const civilization = base.civilizations[0];
    expect(system).toBeDefined();
    expect(civilization).toBeDefined();

    const interventions: InterventionInput[] = [
      { id: "domain-planet", miracleType: "bless_planet", targetId: planet.id },
      { id: "domain-star", miracleType: "stabilize_star", targetId: system!.id },
      { id: "domain-civilization", miracleType: "grant_magic", targetId: civilization.id },
    ];
    const universe = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic", interventions });
    const changedPlanet = allPlanets(universe).find((entry) => entry.id === planet.id);
    const changedSystem = universe.galaxies.flatMap((galaxy) => galaxy.starSystems).find((entry) => entry.id === system!.id);
    const changedCivilization = universe.civilizations.find((entry) => entry.id === civilization.id);

    expect(changedPlanet!.habitability).toBeGreaterThan(planet.habitability);
    expect(changedSystem!.stability).toBeGreaterThan(system!.stability);
    expect(changedCivilization!.magicLevel).toBeGreaterThan(civilization.magicLevel);
    expect(universe.miracleState.appliedMiracles.flatMap((miracle) => miracle.targetMutations).length).toBeGreaterThanOrEqual(5);
  });

  it("注入生命会在目标行星形成或强化真实生物圈", () => {
    const base = generateUniverse({ seed: fixedSeeds[3], templateId: "hard_science" });
    const target = allPlanets(base).find((planet) => !planet.biosphere) ?? allPlanets(base)[0];
    const universe = generateUniverse({
      seed: fixedSeeds[3],
      templateId: "hard_science",
      interventions: [{ id: "seed-real-life", miracleType: "seed_life", targetId: target.id }],
    });
    const changedTarget = allPlanets(universe).find((planet) => planet.id === target.id);

    expect(changedTarget?.biosphere).toBeDefined();
    expect(changedTarget!.habitability).toBeGreaterThan(target.habitability);
  });

  it("分享码和分享链接会完整恢复干预分支", () => {
    const base = generateUniverse({ seed: fixedSeeds[1], templateId: "mythic" });
    const interventions = sampleInterventions(base).slice(0, 3);
    const universe = generateUniverse({ seed: fixedSeeds[1], templateId: "mythic", interventions });

    expect(decodeShareCode(universe.shareCode)?.interventions).toEqual(interventions);
    expect(decodeShareParams(universe.shareUrl)?.interventions).toEqual(interventions);
    const decoded = decodeShareParams(universe.shareUrl)!;
    expect(generateUniverse(decoded)).toEqual(universe);
  });

  it("无效奇迹类型、重复 ID 和目标类型不匹配会被明确拒绝", () => {
    expect(() => generateUniverse({ seed: fixedSeeds[0], interventions: [{ id: "bad", miracleType: "unknown" as MiracleType, targetId: "x" }] })).toThrowError(UniverseInputError);
    expect(() => generateUniverse({ seed: fixedSeeds[0], interventions: [
      { id: "duplicate", miracleType: "repair_causality", targetId: `universe.${fixedSeeds[0]}` },
      { id: "duplicate", miracleType: "repair_causality", targetId: `universe.${fixedSeeds[0]}` },
    ] })).toThrowError(/重复/);
    expect(() => generateUniverse({ seed: fixedSeeds[0], interventions: [{ id: "wrong-target", miracleType: "bless_planet", targetId: "civ-01" }] })).toThrowError(/找不到/);
    expect(() => generateUniverse({ seed: fixedSeeds[0], interventions: [{ id: "wrong-universe", miracleType: "repair_causality", targetId: "universe.wrong" }] })).toThrowError(/宇宙级奇迹目标/);
  });

  it("奇迹过度使用会触发负面反噬事件", () => {
    const base = generateUniverse({ seed: fixedSeeds[2], templateId: "chaotic_laws" });
    const seedInterventions = sampleInterventions(base);
    const interventions = [...seedInterventions, ...seedInterventions].map((entry, index) => ({
      ...entry,
      id: `overuse-${String(index + 1).padStart(2, "0")}`,
    }));
    const universe = generateUniverse({ seed: fixedSeeds[2], templateId: "chaotic_laws", interventions });

    expect(universe.miracleState.overuseLevel).toBe("backlash");
    expect(universe.miracleState.backlashEvents.length).toBeGreaterThan(0);
    expect(universe.timeline.some((event) => event.id === universe.miracleState.backlashEvents[0].id)).toBe(true);
    expect(universe.miracleState.backlashEvents[0].effects.some((effect) => effect.delta < 0)).toBe(true);
  });

  it("页面静态渲染包含阶段 6 干预入口", () => {
    const markup = renderToStaticMarkup(createElement(App, { initialPage: "miracles" }));

    expect(markup).toContain("造物主干预");
    expect(markup).toContain("奇迹点");
    expect(markup).toContain("因果压力");
    expect(markup).toContain("干预日志");
    expect(markup).toContain("概率变化");
  });

  it("阶段 6 没有提前实现阶段 7 的可视化观察台能力", () => {
    const sourceRoot = pathFromTest(import.meta.url, "../src");
    const forbiddenPatterns = [/星系点云/, /宇宙背景视觉/, /缩放层级/, /时间播放/, /信息叠层/, /\bThree\b/, /\bWebGL\b/, /\bcanvas\b/i];
    const offenders = listSourceFiles(sourceRoot).filter((file) => {
      const source = readFileSync(file, "utf8");
      return forbiddenPatterns.some((pattern) => pattern.test(source));
    });

    expect(offenders).toEqual([]);
  });
});

function sampleInterventions(universe: ReturnType<typeof generateUniverse>): InterventionInput[] {
  const firstPlanet = allPlanets(universe)[0];
  const secondPlanet = allPlanets(universe)[1] ?? firstPlanet;
  const firstGalaxy = universe.galaxies[0];
  const firstSystem = firstGalaxy.starSystems[0];
  const firstCivilization = universe.civilizations[0];
  const types: Array<{ miracleType: MiracleType; targetId: string }> = [
    { miracleType: "bless_planet", targetId: firstPlanet.id },
    { miracleType: "stabilize_star", targetId: firstSystem.id },
    { miracleType: "seed_life", targetId: secondPlanet.id },
    { miracleType: "grant_magic", targetId: firstCivilization.id },
    { miracleType: "send_catastrophe", targetId: firstCivilization.id },
    { miracleType: "repair_causality", targetId: `universe.${universe.seed}` },
  ];

  return types.map((entry, index) => ({
    id: `test-${String(index + 1).padStart(2, "0")}`,
    ...entry,
  }));
}
