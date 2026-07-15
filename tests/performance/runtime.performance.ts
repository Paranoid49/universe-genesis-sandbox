import { describe, expect, it } from "vitest";
import {
  advanceUniverseState,
  createLegacyInitialUniverseState as createInitialUniverseState,
  createRuntimeArchive,
  parseRuntimeArchive,
  serializeRuntimeArchive,
  type UniverseTemplateId,
} from "../../src/sim";

const SINGLE_STEP_P50_BUDGET_MS = 50;
const SINGLE_STEP_P90_BUDGET_MS = 100;
const HUNDRED_STEPS_P50_BUDGET_MS = 1500;
const HUNDRED_STEPS_P90_BUDGET_MS = 2500;
const SNAPSHOT_P90_BUDGET_MS = 500;
const RESTORE_P90_BUDGET_MS = 1000;

const scenarios: readonly { seed: string; templateId: UniverseTemplateId }[] = [
  { seed: "RUNTIME-PERFORMANCE-001", templateId: "hard_science" },
  { seed: "RUNTIME-PERFORMANCE-002", templateId: "high_magic" },
  { seed: "RUNTIME-PERFORMANCE-003", templateId: "mythic" },
  { seed: "RUNTIME-PERFORMANCE-004", templateId: "low_magic" },
  { seed: "RUNTIME-PERFORMANCE-005", templateId: "mechanical_divinity" },
  { seed: "RUNTIME-PERFORMANCE-006", templateId: "chaotic_laws" },
  { seed: "RUNTIME-PERFORMANCE-007", templateId: "polytheistic_war" },
  { seed: "RUNTIME-PERFORMANCE-008", templateId: "reincarnation_cycle" },
  { seed: "RUNTIME-PERFORMANCE-009", templateId: "dream_realm" },
  { seed: "RUNTIME-PERFORMANCE-010", templateId: "causal_fracture" },
  { seed: "RUNTIME-PERFORMANCE-011", templateId: "hard_science" },
  { seed: "RUNTIME-PERFORMANCE-012", templateId: "high_magic" },
];

describe("步骤 2 运行时性能", () => {
  it("预热后的状态推进、快照和恢复满足冻结预算", () => {
    measureScenario({ seed: "RUNTIME-PERFORMANCE-WARMUP-A", templateId: "causal_fracture" });
    measureScenario({ seed: "RUNTIME-PERFORMANCE-WARMUP-B", templateId: "high_magic" });

    const samples = scenarios.map(measureScenario);
    const singleSteps = samples.map((sample) => sample.singleStep).sort(ascending);
    const hundredSteps = samples.map((sample) => sample.hundredSteps).sort(ascending);
    const snapshots = samples.map((sample) => sample.snapshot).sort(ascending);
    const restores = samples.map((sample) => sample.restore).sort(ascending);

    expect(percentile(singleSteps, 0.5), evidence("单步 P50", singleSteps)).toBeLessThan(SINGLE_STEP_P50_BUDGET_MS);
    expect(percentile(singleSteps, 0.9), evidence("单步 P90", singleSteps)).toBeLessThan(SINGLE_STEP_P90_BUDGET_MS);
    expect(percentile(hundredSteps, 0.5), evidence("一百步 P50", hundredSteps)).toBeLessThan(HUNDRED_STEPS_P50_BUDGET_MS);
    expect(percentile(hundredSteps, 0.9), evidence("一百步 P90", hundredSteps)).toBeLessThan(HUNDRED_STEPS_P90_BUDGET_MS);
    expect(percentile(snapshots, 0.9), evidence("快照 P90", snapshots)).toBeLessThan(SNAPSHOT_P90_BUDGET_MS);
    expect(percentile(restores, 0.9), evidence("恢复 P90", restores)).toBeLessThan(RESTORE_P90_BUDGET_MS);
  });
});

function measureScenario(input: { seed: string; templateId: UniverseTemplateId }) {
  const initial = createInitialUniverseState(input);

  const singleStartedAt = performance.now();
  const first = advanceUniverseState(initial);
  const singleStep = performance.now() - singleStartedAt;

  let state = initial;
  const hundredStartedAt = performance.now();
  for (let index = 0; index < 100; index += 1) state = advanceUniverseState(state);
  const hundredSteps = performance.now() - hundredStartedAt;

  const snapshotStartedAt = performance.now();
  const serialized = serializeRuntimeArchive(createRuntimeArchive(state));
  const snapshot = performance.now() - snapshotStartedAt;

  const restoreStartedAt = performance.now();
  const restored = parseRuntimeArchive(serialized);
  const restore = performance.now() - restoreStartedAt;

  expect(first.clock.step).toBe(1);
  expect(restored.state).toEqual(state);
  return { singleStep, hundredSteps, snapshot, restore };
}

function percentile(samples: readonly number[], ratio: number): number {
  return samples[Math.ceil(samples.length * ratio) - 1];
}

function ascending(left: number, right: number): number {
  return left - right;
}

function evidence(label: string, samples: readonly number[]): string {
  return `${label}；样本 ${samples.map((sample) => `${sample.toFixed(2)}ms`).join("、")}`;
}
