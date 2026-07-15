import { describe, expect, it } from "vitest";
import {
  LIVING_TIDE,
  advanceUniverseState,
  createConstitutionModule,
  createInitialUniverseState,
  createRuntimeArchive,
  createUniverseConstitution,
  restoreRuntimeArchive,
  type BoundaryModuleSpec,
  type OntologyModuleSpec,
} from "../../src/sim";

describe("步骤 6 自主实体性能预算", () => {
  it("三十二个主体的百步演化、行动批次和存档恢复满足冻结预算", () => {
    const constitution = autonomyStressConstitution();
    const evolutionSamples: number[] = [];
    const actionBatchSamples: number[] = [];
    const restorationSamples: number[] = [];
    runSample(constitution, "AUTONOMY-PERF-WARMUP-A");
    runSample(constitution, "AUTONOMY-PERF-WARMUP-B");
    for (let index = 0; index < 12; index += 1) {
      const sample = runSample(constitution, `AUTONOMY-PERF-${index}`);
      evolutionSamples.push(sample.evolution);
      actionBatchSamples.push(sample.actionBatch);
      restorationSamples.push(sample.restoration);
    }
    expect(percentile(evolutionSamples, 0.5), evidence("百步演化 P50", evolutionSamples)).toBeLessThan(2000);
    expect(percentile(evolutionSamples, 0.9), evidence("百步演化 P90", evolutionSamples)).toBeLessThan(3500);
    expect(percentile(actionBatchSamples, 0.9), evidence("自主行动批次 P90", actionBatchSamples)).toBeLessThan(100);
    expect(percentile(restorationSamples, 0.9), evidence("自主存档恢复 P90", restorationSamples)).toBeLessThan(2000);
  }, 120_000);
});

function runSample(constitution: ReturnType<typeof autonomyStressConstitution>, seed: string) {
  let state = createInitialUniverseState({ seed, constitution });
  state = advanceUniverseState(state);
  const actionStartedAt = performance.now();
  state = advanceUniverseState(state);
  const actionBatch = performance.now() - actionStartedAt;
  expect(Object.values(state.autonomy.entities)).toHaveLength(32);
  expect(state.transitions[1].autonomy.actions).toHaveLength(32);

  state = createInitialUniverseState({ seed, constitution });
  const evolutionStartedAt = performance.now();
  for (let index = 0; index < 100; index += 1) state = advanceUniverseState(state);
  const evolution = performance.now() - evolutionStartedAt;
  const restorationStartedAt = performance.now();
  const restored = restoreRuntimeArchive(createRuntimeArchive(state));
  const restoration = performance.now() - restorationStartedAt;
  expect(restored).toEqual(state);
  return { evolution, actionBatch, restoration };
}

function autonomyStressConstitution() {
  const ontology = LIVING_TIDE.modules.find((module) => module.category === "ontology")!;
  const boundary = LIVING_TIDE.modules.find((module) => module.category === "boundary")!;
  const ontologySpec = ontology.spec as OntologyModuleSpec;
  const boundarySpec = boundary.spec as BoundaryModuleSpec;
  const replacements = new Map([
    ["ontology", createConstitutionModule({ id: "ontology.autonomy-stress@1", moduleVersion: ontology.moduleVersion, category: "ontology", name: ontology.name, description: ontology.description, dependencies: ontology.dependencies, conflicts: ontology.conflicts, spec: { objectKinds: ontologySpec.objectKinds.map((kind) => ({ ...kind, initialCount: 32 })) } })],
    ["boundary", createConstitutionModule({ id: "boundary.autonomy-stress@1", moduleVersion: boundary.moduleVersion, category: "boundary", name: boundary.name, description: boundary.description, dependencies: boundary.dependencies, conflicts: boundary.conflicts, spec: { ...boundarySpec, maximumRuleEvaluations: 128, maximumEffectsPerStep: 128, maximumObjects: 32, maximumRelations: 64, maximumAutonomousEntities: 32, maximumAutonomousActionsPerStep: 32 } })],
  ]);
  return createUniverseConstitution({ name: "自主实体性能夹具", description: "使用三十二个主体验证冻结性能预算。", modules: LIVING_TIDE.modules.map((module) => replacements.get(module.category) ?? module) });
}

function percentile(values: readonly number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))];
}

function evidence(label: string, samples: readonly number[]): string {
  return `${label}；样本 ${samples.map((sample) => `${sample.toFixed(2)}ms`).join("、")}`;
}
