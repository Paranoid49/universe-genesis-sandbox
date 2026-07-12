import { describe, expect, it } from "vitest";
import {
  compareUniverseLaws,
  generateUniverse,
  getTemplate,
  normalizeSeed,
  RULESET_VERSION,
} from "../src/sim";
import { generateLawInteractions, generateLaws } from "../src/sim/laws";
import { generateMetrics } from "../src/sim/metrics";
import { createRandomStream } from "../src/sim/random";
import { allStructuredLaws, fixedSeeds, lawDomainIds, lawsWithoutMetricTargets, metricIds } from "./helpers";

describe("阶段 2 宇宙法则引擎", () => {
  it("每个宇宙至少生成 12 条结构化法则，并且每类至少 2 条", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[0], templateId: "high_magic" });
    const rules = allStructuredLaws(universe);

    expect(rules.length).toBeGreaterThanOrEqual(12);
    for (const domain of lawDomainIds) {
      expect(universe.laws[domain].rules.length).toBeGreaterThanOrEqual(2);
    }
    expect(rules.every((rule) => rule.id && rule.name && rule.effectTargets.length > 0 && rule.value >= 0 && rule.value <= 100)).toBe(true);
  });

  it("每个宇宙至少生成 3 条法则关系，并且关系能追踪到结构化法则", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[1], templateId: "mythic" });
    const ruleIds = new Set(allStructuredLaws(universe).map((rule) => rule.id));

    expect(universe.lawInteractions.length).toBeGreaterThanOrEqual(3);
    expect(universe.lawInteractions.every((interaction) => ruleIds.has(interaction.sourceLawId) && ruleIds.has(interaction.targetLawId))).toBe(true);
  });

  it("每个关键指标至少有 1 条可追踪到法则或关系的影响来源", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[2], templateId: "chaotic_laws" });
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
    const hardScience = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[3], templateId: "hard_science" });
    const highMagic = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[3], templateId: "high_magic" });
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
