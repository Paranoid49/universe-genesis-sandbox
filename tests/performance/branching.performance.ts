import { describe, expect, it } from "vitest";
import {
  advanceUniverseState,
  compareUniverseBranches,
  createBranchArchive,
  createExperimentInput,
  createLegacyInitialUniverseState as createInitialUniverseState,
  createRootBranch,
  forkUniverseBranch,
  parseBranchArchive,
  replayUniverseToTick,
  serializeBranchArchive,
  type UniverseTemplateId,
} from "../../src/sim";

const scenarios: readonly { seed: string; templateId: UniverseTemplateId }[] = [
  { seed: "BRANCH-PERF-001", templateId: "hard_science" },
  { seed: "BRANCH-PERF-002", templateId: "high_magic" },
  { seed: "BRANCH-PERF-003", templateId: "mythic" },
  { seed: "BRANCH-PERF-004", templateId: "low_magic" },
  { seed: "BRANCH-PERF-005", templateId: "mechanical_divinity" },
  { seed: "BRANCH-PERF-006", templateId: "chaotic_laws" },
  { seed: "BRANCH-PERF-007", templateId: "polytheistic_war" },
  { seed: "BRANCH-PERF-008", templateId: "reincarnation_cycle" },
  { seed: "BRANCH-PERF-009", templateId: "dream_realm" },
  { seed: "BRANCH-PERF-010", templateId: "causal_fracture" },
  { seed: "BRANCH-PERF-011", templateId: "hard_science" },
  { seed: "BRANCH-PERF-012", templateId: "high_magic" },
];

describe("步骤 4 分支性能", () => {
  it("预热后的分支创建、百步重放、比较、保存和恢复满足冻结预算", () => {
    measure({ seed: "BRANCH-PERF-WARMUP-A", templateId: "hard_science" });
    measure({ seed: "BRANCH-PERF-WARMUP-B", templateId: "high_magic" });
    const samples = scenarios.map(measure);
    assertBudget(samples, "create", 500, 1000, "分支创建");
    assertBudget(samples, "replay", 1500, 2500, "百步重放");
    assertBudget(samples, "compare", 500, 1000, "共同祖先比较");
    expect(percentile(samples.map((entry) => entry.save).sort(ascending), 0.9)).toBeLessThan(750);
    expect(percentile(samples.map((entry) => entry.restore).sort(ascending), 0.9)).toBeLessThan(1500);
  });
});

function measure(input: { seed: string; templateId: UniverseTemplateId }) {
  let state = createInitialUniverseState(input);
  for (let index = 0; index < 100; index += 1) state = advanceUniverseState(state);
  const root = createRootBranch(state);
  const forkState = replayUniverseToTick(state, 50);

  const createStarted = performance.now();
  const left = forkUniverseBranch(root, 50, [createExperimentInput(forkState, root.branchId, "cohesion", 8, 1)]);
  const create = performance.now() - createStarted;
  const right = forkUniverseBranch(root, 50, [createExperimentInput(forkState, root.branchId, "energy", -8, 1)]);

  const replayStarted = performance.now();
  const replayed = replayUniverseToTick(state, 100);
  const replay = performance.now() - replayStarted;

  const compareStarted = performance.now();
  const comparison = compareUniverseBranches(left, right);
  const compare = performance.now() - compareStarted;

  const saveStarted = performance.now();
  const serialized = serializeBranchArchive(createBranchArchive(left));
  const save = performance.now() - saveStarted;

  const restoreStarted = performance.now();
  const restored = parseBranchArchive(serialized);
  const restore = performance.now() - restoreStarted;

  expect(replayed).toEqual(root.state);
  expect(restored.branch).toEqual(left);
  expect(comparison.commonAncestorBranchId).toBe(root.branchId);
  return { create, replay, compare, save, restore };
}

function assertBudget(samples: readonly ReturnType<typeof measure>[], field: "create" | "replay" | "compare", p50: number, p90: number, label: string): void {
  const values = samples.map((entry) => entry[field]).sort(ascending);
  expect(percentile(values, 0.5), `${label} P50：${values.map(format).join("、")}`).toBeLessThan(p50);
  expect(percentile(values, 0.9), `${label} P90：${values.map(format).join("、")}`).toBeLessThan(p90);
}

function percentile(samples: readonly number[], ratio: number): number {
  return samples[Math.ceil(samples.length * ratio) - 1];
}

function ascending(left: number, right: number): number {
  return left - right;
}

function format(value: number): string {
  return `${value.toFixed(2)}ms`;
}
