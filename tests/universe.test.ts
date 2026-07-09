import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../src/App";
import {
  compareUniverseLaws,
  decodeShareCode,
  decodeShareParams,
  filterTimelineByEra,
  generateUniverse,
  RULESET_SHORT_CODE,
  RULESET_VERSION,
  UNIVERSE_TEMPLATES,
  getTemplate,
  normalizeSeed,
  type EraId,
  type EventType,
  type Civilization,
  type LawDomainId,
  type MetricId,
  type UniverseSummary,
} from "../src/sim";
import { generateLawInteractions, generateLaws } from "../src/sim/laws";
import { generateMetrics } from "../src/sim/metrics";
import { createRandomStream } from "../src/sim/random";

const fixedSeeds = [
  "LUX-7F3A-91C2",
  "ASH-44DE-0101",
  "DREAM-777",
  "VOID-0001",
  "MYTH-STAR-42",
];

const lawDomainIds: LawDomainId[] = ["physics", "magic", "life", "consciousness", "divinity", "causality"];
const metricIds: MetricId[] = ["age", "stability", "lifePotential", "civilizationPotential", "magicIntensity", "divineActivity", "causalityIntegrity"];
const eraIds: EraId[] = ["creation", "stars", "elements", "life", "civilization", "myth", "ascension", "ending"];
const expectedRulesetContentHash = "4628dcc9eeca171a3e7ac8de5dd17934b31c8cdb04d5441106d6b769cbe1770e";

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

    expect(universe.rulesetShortCode).toBe(RULESET_SHORT_CODE);
    expect(universe.shareCode.startsWith(`${RULESET_SHORT_CODE}-`)).toBe(true);
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

  it("非当前规则短码不做兼容解析，只按当前规则提示处理", () => {
    const decoded = decodeShareParams("?s=LUX7F3A91C2&t=HM&v=UGS03");

    expect(decoded?.seed).toBe("LUX7F3A91C2");
    expect(decoded?.templateId).toBe("high_magic");
    expect(decoded?.rulesetVersion).toBe(RULESET_VERSION);
    expect(decoded?.warnings.length).toBe(1);
    expect(decoded?.warnings[0]).toContain("不受当前版本支持");
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

describe("规则版本门禁", () => {
  it("生成规则内容变化时必须同步更新规则版本哈希", () => {
    const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../src/sim");
    const actualHash = rulesetContentHash(sourceRoot);

    if (actualHash !== expectedRulesetContentHash) {
      throw new Error(`生成规则内容哈希已变化。若本次变更会影响生成结果，请更新 RULESET_VERSION、RULESET_SHORT_CODE 和该测试基线。当前哈希：${actualHash}`);
    }

    expect(actualHash).toBe(expectedRulesetContentHash);
  });
});

describe("阶段 2 宇宙法则引擎", () => {
  it("每个宇宙至少生成 12 条结构化法则，并且每类至少 2 条", () => {
    const universe = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const rules = allStructuredLaws(universe);

    expect(rules.length).toBeGreaterThanOrEqual(12);
    for (const domain of lawDomainIds) {
      expect(universe.laws[domain].rules.length).toBeGreaterThanOrEqual(2);
    }
    expect(rules.every((rule) => rule.id && rule.name && rule.effectTargets.length > 0 && rule.value >= 0 && rule.value <= 100)).toBe(true);
  });

  it("每个宇宙至少生成 3 条法则关系，并且关系能追踪到结构化法则", () => {
    const universe = generateUniverse({ seed: fixedSeeds[1], templateId: "mythic" });
    const ruleIds = new Set(allStructuredLaws(universe).map((rule) => rule.id));

    expect(universe.lawInteractions.length).toBeGreaterThanOrEqual(3);
    expect(universe.lawInteractions.every((interaction) => ruleIds.has(interaction.sourceLawId) && ruleIds.has(interaction.targetLawId))).toBe(true);
  });

  it("每个关键指标至少有 1 条可追踪到法则或关系的影响来源", () => {
    const universe = generateUniverse({ seed: fixedSeeds[2], templateId: "chaotic_laws" });
    const traceableSourceIds = new Set([
      ...allStructuredLaws(universe).map((rule) => rule.id),
      ...universe.lawInteractions.map((interaction) => interaction.id),
    ]);

    for (const metricId of metricIds) {
      const influences = universe.metrics[metricId].influences ?? [];
      expect(influences.some((influence) => traceableSourceIds.has(influence.sourceId))).toBe(true);
    }
  });

  it("法则影响指标值，而不是只作为展示文本", () => {
    const template = getTemplate("high_magic");
    const seed = normalizeSeed(fixedSeeds[0]);
    const root = createRandomStream(`${RULESET_VERSION}:${template.id}:${seed}`, "root");
    const laws = generateLaws(template, root);
    const interactions = generateLawInteractions(laws, root.fork("laws.interactions"));
    const metricsWithLaws = generateMetrics(template, laws, interactions, createRandomStream("phase-2-law-impact", "metrics"));
    const metricsWithoutInfluences = generateMetrics(
      template,
      lawsWithoutMetricTargets(laws),
      interactions.map((interaction) => ({ ...interaction, impact: 0 })),
      createRandomStream("phase-2-law-impact", "metrics"),
    );

    const changedMetrics = metricIds.filter((metricId) => metricsWithLaws[metricId].value !== metricsWithoutInfluences[metricId].value);
    expect(changedMetrics.length).toBeGreaterThan(0);
  });

  it("不同模板会明显改变法则结果", () => {
    const hardScience = generateUniverse({ seed: fixedSeeds[3], templateId: "hard_science" });
    const highMagic = generateUniverse({ seed: fixedSeeds[3], templateId: "high_magic" });
    const totalDomainDelta = lawDomainIds.reduce((sum, domain) => sum + Math.abs(hardScience.laws[domain].rating.value - highMagic.laws[domain].rating.value), 0);
    const hardScienceSignature = allStructuredLaws(hardScience).map((rule) => `${rule.domain}:${rule.name}:${rule.value}`).join("|");
    const highMagicSignature = allStructuredLaws(highMagic).map((rule) => `${rule.domain}:${rule.name}:${rule.value}`).join("|");

    expect(totalDomainDelta).toBeGreaterThan(120);
    expect(highMagicSignature).not.toBe(hardScienceSignature);
  });

  it("两个 seed 的法则差异对比结果确定且非空", () => {
    const first = compareUniverseLaws(fixedSeeds[0], fixedSeeds[1], "reincarnation_cycle");
    const second = compareUniverseLaws(fixedSeeds[0], fixedSeeds[1], "reincarnation_cycle");

    expect(second).toEqual(first);
    expect(first.domainDiffs).toHaveLength(lawDomainIds.length);
    expect(first.summary).not.toBe("");
    expect(first.domainDiffs.some((diff) => diff.delta !== 0)).toBe(true);
    expect(lawDomainIds).toContain(first.largestDiffDomain);
  });
});

describe("阶段 3 宇宙时间线与纪元系统", () => {
  it("每个宇宙至少生成 30 条事件，并覆盖完整阶段 3 纪元", () => {
    const universe = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const eras = new Set(universe.timeline.map((event) => event.era));

    expect(universe.timeline.length).toBeGreaterThanOrEqual(30);
    for (const era of eraIds) {
      expect(eras.has(era)).toBe(true);
    }
  });

  it("时间线能按纪元筛选，筛选不会改变原始事件集合", () => {
    const universe = generateUniverse({ seed: fixedSeeds[1], templateId: "mythic" });
    const allEvents = filterTimelineByEra(universe.timeline, "all");
    const lifeEvents = filterTimelineByEra(universe.timeline, "life");

    expect(allEvents).toEqual(universe.timeline);
    expect(lifeEvents.length).toBeGreaterThan(0);
    expect(lifeEvents.every((event) => event.era === "life")).toBe(true);
    expect(universe.timeline.length).toBeGreaterThan(lifeEvents.length);
  });

  it("关键事件包含因果解释和可追踪影响来源", () => {
    const universe = generateUniverse({ seed: fixedSeeds[2], templateId: "causal_fracture" });
    const keyEvents = universe.timeline.filter((event) => event.importance >= 75);

    expect(keyEvents.length).toBeGreaterThan(0);
    expect(keyEvents.every((event) => event.causalNotes.length > 0 && event.sourceIds.length > 0 && event.location)).toBe(true);
  });

  it("至少 5 类事件会影响后续生成结果", () => {
    const universe = generateUniverse({ seed: fixedSeeds[3], templateId: "chaotic_laws" });
    const futureAffectingTypes = new Set<EventType>();

    for (const event of universe.timeline) {
      if (event.effects.some((effect) => effect.affectsFuture)) {
        futureAffectingTypes.add(event.type);
      }
    }

    expect(futureAffectingTypes.size).toBeGreaterThanOrEqual(5);
  });

  it("部分事件会引用前序事件作为触发来源，且引用目标存在", () => {
    const universe = generateUniverse({ seed: fixedSeeds[4], templateId: "reincarnation_cycle" });
    const eventIds = new Set(universe.timeline.map((event) => event.id));
    const linkedEvents = universe.timeline.filter((event) => event.triggeredByEventIds.length > 0);

    expect(linkedEvents.length).toBeGreaterThan(0);
    expect(linkedEvents.every((event) => event.triggeredByEventIds.every((eventId) => eventIds.has(eventId)))).toBe(true);
  });

  it("同一 seed、模板和规则版本会生成完全一致的阶段 3 时间线", () => {
    const first = generateUniverse({ seed: fixedSeeds[0], templateId: "mechanical_divinity" });
    const second = generateUniverse({ seed: fixedSeeds[0], templateId: "mechanical_divinity" });

    expect(second.timeline).toEqual(first.timeline);
  });

  it("时间线影响摘要可作为阶段 4 局部对象生成上下文", () => {
    const universe = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const eventIds = new Set(universe.timeline.map((event) => event.id));

    expect(universe.timelineImpact.eventCount).toBe(universe.timeline.length);
    expect(universe.timelineImpact.futureAffectingEventCount).toBeGreaterThan(0);
    expect(universe.timelineImpact.localBiases).toHaveLength(8);
    expect(universe.timelineImpact.eraProfiles).toHaveLength(eraIds.length);
    expect(universe.timelineImpact.keySourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);

    for (const metricId of metricIds) {
      expect(typeof universe.timelineImpact.metricDeltas[metricId]).toBe("number");
    }

    for (const bias of universe.timelineImpact.localBiases) {
      expect(bias.value).toBeGreaterThanOrEqual(0);
      expect(bias.value).toBeLessThanOrEqual(100);
      expect(bias.sourceEventIds.length).toBeGreaterThan(0);
      expect(bias.sourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);
    }
  });
});

describe("阶段 4 局部对象基础模型", () => {
  it("每个宇宙生成可追踪来源的代表性星系、恒星系和行星", () => {
    const universe = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
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
    const first = generateUniverse({ seed: fixedSeeds[2], templateId: "high_magic" });
    const second = generateUniverse({ seed: fixedSeeds[2], templateId: "high_magic" });
    const biosphereCount = first.galaxies
      .flatMap((galaxy) => galaxy.starSystems)
      .flatMap((system) => system.planets)
      .filter((planet) => planet.biosphere).length;

    expect(second.galaxies).toEqual(first.galaxies);
    expect(biosphereCount).toBeGreaterThan(0);
  });

  it("不同模板会改变局部对象结构和异常倾向", () => {
    const hardScience = generateUniverse({ seed: fixedSeeds[3], templateId: "hard_science" });
    const chaoticLaws = generateUniverse({ seed: fixedSeeds[3], templateId: "chaotic_laws" });
    const hardSignature = galaxySignature(hardScience);
    const chaoticSignature = galaxySignature(chaoticLaws);
    const hardHazard = averageGalaxyValue(hardScience, "causalHazard");
    const chaoticHazard = averageGalaxyValue(chaoticLaws, "causalHazard");

    expect(chaoticSignature).not.toBe(hardSignature);
    expect(chaoticHazard).toBeGreaterThan(hardHazard);
  });

  it("生命行星为阶段 5 文明开发保留可追踪候选种子", () => {
    const universe = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
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
    const markup = renderToStaticMarkup(createElement(App));

    expect(markup).toContain("探索星系");
    expect(markup).toContain("局部探索");
    expect(markup).toContain("星系列表");
    expect(markup).toContain("恒星系");
    expect(markup).toContain("行星详情");
    expect(markup).toContain("阶段 5 文明入口");
  });
});

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
    const markup = renderToStaticMarkup(createElement(App));

    expect(markup).toContain("文明演化");
    expect(markup).toContain("文明详情");
    expect(markup).toContain("神话系统");
    expect(markup).toContain("文明历史");
  });

  it("阶段 5 没有提前实现阶段 6 的造物主干预或奇迹交互", () => {
    const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
    const forbiddenPatterns = [/造物主模式/, /奇迹点/, /干预日志/, /改写局部法则/, /\bMiracle\b/, /\bIntervention\b/];
    const offenders = listSourceFiles(sourceRoot).filter((file) => {
      const source = readFileSync(file, "utf8");
      return forbiddenPatterns.some((pattern) => pattern.test(source));
    });

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
  expect(universe.timeline.length).toBeGreaterThanOrEqual(30);
  expect(new Set(universe.timeline.map((event) => event.era)).size).toBeGreaterThanOrEqual(8);
  expect(Object.values(universe.metrics).every((metric) => metric.label && metric.explanation)).toBe(true);
  expect(Object.values(universe.laws).every((law) => law.rating.label && law.rating.explanation && law.traits.length >= 3)).toBe(true);
  expect(universe.timeline.every((event) => event.title && event.description && event.causes.length > 0 && event.effects.length > 0 && event.location && event.causalNotes.length > 0)).toBe(true);
  expect(universe.timelineImpact.eventCount).toBe(universe.timeline.length);
  expect(universe.timelineImpact.localBiases.length).toBeGreaterThanOrEqual(8);
  expect(universe.galaxies.length).toBeGreaterThanOrEqual(12);
}

function allStructuredLaws(universe: UniverseSummary) {
  return Object.values(universe.laws).flatMap((law) => law.rules);
}

function galaxySignature(universe: UniverseSummary): string {
  return universe.galaxies.map((galaxy) => `${galaxy.type}:${galaxy.starSystems.length}:${galaxy.causalHazard}`).join("|");
}

function averageGalaxyValue(universe: UniverseSummary, key: "causalHazard" | "magicFlux" | "divineResidue"): number {
  const total = universe.galaxies.reduce((sum, galaxy) => sum + galaxy[key], 0);
  return total / universe.galaxies.length;
}

function allPlanets(universe: UniverseSummary) {
  return universe.galaxies.flatMap((galaxy) => galaxy.starSystems).flatMap((system) => system.planets);
}

function civilizationPathIsCoherent(civilization: Civilization, universe: UniverseSummary): boolean {
  if (civilization.path === "tribal") return civilization.technologyLevel <= 55;
  if (civilization.path === "city_state") return civilization.technologyLevel <= 70 && civilization.stability >= 25;
  if (civilization.path === "planetary") return civilization.technologyLevel >= 35 && civilization.stability >= 35;
  if (civilization.path === "galactic") return civilization.technologyLevel >= 45 && civilization.expansionDrive >= 45;
  if (civilization.path === "arcane_empire") return civilization.magicLevel >= 45 || universe.laws.magic.rating.value >= 65;
  if (civilization.path === "theocracy") return civilization.faithIntensity >= 45 || universe.laws.divinity.rating.value >= 65;
  if (civilization.path === "collective_mind") return civilization.stability >= 45 || universe.laws.consciousness.rating.value >= 65;
  if (civilization.path === "ascended") return civilization.fate === "ascension" || civilization.magicLevel + civilization.faithIntensity + civilization.technologyLevel >= 150;
  return civilization.extinctionRisk >= 45 || civilization.fate === "collapse";
}

function lawsWithoutMetricTargets(laws: UniverseSummary["laws"]): UniverseSummary["laws"] {
  return {
    physics: { ...laws.physics, rules: laws.physics.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
    magic: { ...laws.magic, rules: laws.magic.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
    life: { ...laws.life, rules: laws.life.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
    consciousness: { ...laws.consciousness, rules: laws.consciousness.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
    divinity: { ...laws.divinity, rules: laws.divinity.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
    causality: { ...laws.causality, rules: laws.causality.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
  };
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

function rulesetContentHash(sourceRoot: string): string {
  const projectRoot = resolve(sourceRoot, "../..");
  const hash = createHash("sha256");
  for (const file of listSourceFiles(sourceRoot).sort()) {
    hash.update(relative(projectRoot, file).split(sep).join("/"));
    hash.update("\n");
    hash.update(readFileSync(file));
    hash.update("\n");
  }
  return hash.digest("hex");
}
