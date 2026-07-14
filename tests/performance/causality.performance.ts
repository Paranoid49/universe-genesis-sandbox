import { describe, expect, it } from "vitest";
import {
  generateUniverse,
  getDirectCauses,
  getDirectEffects,
  RULESET_VERSION,
  traceCausalAncestors,
  traceCausalDescendants,
  type GenerateUniverseInput,
} from "../../src/sim";

const BUDGET_MS = 1500;
const scenarios: GenerateUniverseInput[] = [
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-001", templateId: "hard_science" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-002", templateId: "high_magic" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-003", templateId: "mythic" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-004", templateId: "low_magic" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-005", templateId: "mechanical_divinity" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-006", templateId: "chaotic_laws" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-007", templateId: "polytheistic_war" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-008", templateId: "reincarnation_cycle" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-009", templateId: "dream_realm" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-010", templateId: "causal_fracture" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-011", templateId: "polytheistic_war" },
  { rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-012", templateId: "low_magic" },
];

describe("步骤 1 因果物化性能", () => {
  it("预热后的多场景中位数和第九十分位满足预算", () => {
    measure({ rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-WARMUP-A", templateId: "causal_fracture" });
    measure({ rulesetVersion: RULESET_VERSION, seed: "PERFORMANCE-WARMUP-B", templateId: "high_magic" });
    const samples = scenarios.map(measure).sort((left, right) => left - right);
    const median = percentile(samples, 0.5);
    const p90 = percentile(samples, 0.9);
    const evidence = samples.map((sample) => sample.toFixed(2)).join("、");
    expect(median, `因果物化中位数 ${median.toFixed(2)}ms；样本 ${evidence}`).toBeLessThan(BUDGET_MS);
    expect(p90, `因果物化 P90 ${p90.toFixed(2)}ms；样本 ${evidence}`).toBeLessThan(BUDGET_MS);
  });
});

function measure(input: GenerateUniverseInput): number {
  const startedAt = performance.now();
  const universe = generateUniverse(input);
  const graph = universe.causalGraph;
  const target = graph.nodes.find((node) => node.kind === "metric" && node.directCauseIds.length > 0 && node.directEffectIds.length > 0);
  if (!target) throw new Error("性能场景缺少可双向查询的指标节点。");
  getDirectCauses(graph, target.id);
  getDirectEffects(graph, target.id);
  traceCausalAncestors(graph, target.id);
  traceCausalDescendants(graph, target.id);
  return performance.now() - startedAt;
}

function percentile(samples: number[], ratio: number): number {
  return samples[Math.ceil(samples.length * ratio) - 1];
}
