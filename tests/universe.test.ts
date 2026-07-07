import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareUniverseLaws,
  decodeShareCode,
  decodeShareParams,
  generateUniverse,
  RULESET_SHORT_CODE,
  RULESET_VERSION,
  UNIVERSE_TEMPLATES,
  getTemplate,
  normalizeSeed,
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

  it("旧规则短码会被识别并提示迁移风险", () => {
    const decoded = decodeShareParams("?s=LUX7F3A91C2&t=HM&v=UGS01");

    expect(decoded?.seed).toBe("LUX7F3A91C2");
    expect(decoded?.templateId).toBe("high_magic");
    expect(decoded?.rulesetVersion).toBe("ugs-ruleset@0.1.0");
    expect(decoded?.warnings.length).toBe(1);
    expect(decoded?.warnings[0]).toContain("旧规则版本");
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

function allStructuredLaws(universe: UniverseSummary) {
  return Object.values(universe.laws).flatMap((law) => law.rules);
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
