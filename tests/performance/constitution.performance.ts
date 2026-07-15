import { describe, expect, it } from "vitest";
import {
  COMPOSED_REFERENCE_CONSTITUTION,
  REFERENCE_CONSTITUTIONS,
  advanceUniverseState,
  createInitialUniverseState,
  createObservationAccess,
  createRuntimeArchive,
  restoreRuntimeArchive,
  validateUniverseConstitution,
} from "../../src/sim";

describe("步骤 5 宇宙宪法性能预算", () => {
  it("宪法校验、创世、百步演化、观察和恢复满足预算", () => {
    const constitutions = [...REFERENCE_CONSTITUTIONS, COMPOSED_REFERENCE_CONSTITUTION];
    const validation: number[] = [];
    const creation: number[] = [];
    const evolution: number[] = [];
    const observation: number[] = [];
    const restoration: number[] = [];
    for (let warmup = 0; warmup < 2; warmup += 1) runSample(constitutions[warmup % constitutions.length], "WARMUP-" + warmup);
    for (let index = 0; index < 12; index += 1) {
      const sample = runSample(constitutions[index % constitutions.length], "CONSTITUTION-PERF-" + index);
      validation.push(sample.validation);
      creation.push(sample.creation);
      evolution.push(sample.evolution);
      observation.push(sample.observation);
      restoration.push(sample.restoration);
    }
    expect(percentile(validation, 0.9)).toBeLessThan(100);
    expect(percentile(creation, 0.9)).toBeLessThan(500);
    expect(percentile(evolution, 0.9)).toBeLessThan(2500);
    expect(percentile(observation, 0.9)).toBeLessThan(100);
    expect(percentile(restoration, 0.9)).toBeLessThan(1500);
  }, 120_000);
});

function runSample(constitution: (typeof REFERENCE_CONSTITUTIONS)[number], seed: string) {
  let start = performance.now();
  expect(validateUniverseConstitution(constitution)).toEqual([]);
  const validation = performance.now() - start;
  start = performance.now();
  let state = createInitialUniverseState({ seed, constitution });
  const creation = performance.now() - start;
  start = performance.now();
  for (let step = 0; step < 100; step += 1) state = advanceUniverseState(state);
  const evolution = performance.now() - start;
  start = performance.now();
  const access = createObservationAccess(state);
  if (access.methods.length > 0 && access.objects.length > 0) access.observe({ methodId: access.methods[0].id, objectId: access.objects[0].id, tick: state.clock.tick });
  const observation = performance.now() - start;
  start = performance.now();
  const restored = restoreRuntimeArchive(createRuntimeArchive(state));
  const restoration = performance.now() - start;
  expect(restored).toEqual(state);
  return { validation, creation, evolution, observation, restoration };
}

function percentile(values: readonly number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))];
}
