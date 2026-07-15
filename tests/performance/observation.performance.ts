import { describe, expect, it } from "vitest";
import {
  advanceUniverseState,
  buildKnowledgeQuestions,
  createLegacyInitialUniverseState as createInitialUniverseState,
  createObservationAccess,
  createResearchArchive,
  createResearchNotebook,
  observeUniverse,
  parseResearchArchive,
  serializeResearchArchive,
  type UniverseTemplateId,
  type ResearchNotebook,
} from "../../src/sim";

const scenarios: readonly { seed: string; templateId: UniverseTemplateId }[] = [
  { seed: "OBS-PERF-001", templateId: "hard_science" },
  { seed: "OBS-PERF-002", templateId: "high_magic" },
  { seed: "OBS-PERF-003", templateId: "mythic" },
  { seed: "OBS-PERF-004", templateId: "low_magic" },
  { seed: "OBS-PERF-005", templateId: "mechanical_divinity" },
  { seed: "OBS-PERF-006", templateId: "chaotic_laws" },
  { seed: "OBS-PERF-007", templateId: "polytheistic_war" },
  { seed: "OBS-PERF-008", templateId: "reincarnation_cycle" },
  { seed: "OBS-PERF-009", templateId: "dream_realm" },
  { seed: "OBS-PERF-010", templateId: "causal_fracture" },
  { seed: "OBS-PERF-011", templateId: "hard_science" },
  { seed: "OBS-PERF-012", templateId: "high_magic" },
];

describe("步骤 3 观察与研究性能", () => {
  it("两次预热后的观察、百条历史和研究存档满足冻结预算", () => {
    measure({ seed: "OBS-PERF-WARMUP-A", templateId: "hard_science" });
    measure({ seed: "OBS-PERF-WARMUP-B", templateId: "high_magic" });
    const samples = scenarios.map(measure);
    const observation = samples.map((entry) => entry.observation).sort(ascending);
    const history = samples.map((entry) => entry.history).sort(ascending);
    const save = samples.map((entry) => entry.save).sort(ascending);
    const restore = samples.map((entry) => entry.restore).sort(ascending);

    expect(percentile(observation, 0.5)).toBeLessThan(50);
    expect(percentile(observation, 0.9)).toBeLessThan(100);
    expect(percentile(history, 0.5)).toBeLessThan(500);
    expect(percentile(history, 0.9)).toBeLessThan(1000);
    expect(percentile(save, 0.9)).toBeLessThan(500);
    expect(percentile(restore, 0.9)).toBeLessThan(1000);
  });
});

function measure(input: { seed: string; templateId: UniverseTemplateId }) {
  let state = createInitialUniverseState(input);
  for (let index = 0; index < 100; index += 1) state = advanceUniverseState(state);
  const objectId = Object.keys(state.objects)[0];

  const observationStarted = performance.now();
  observeUniverse(state, { methodId: "structure", objectId, tick: state.clock.tick });
  const observation = performance.now() - observationStarted;

  const historyStarted = performance.now();
  const signals = Array.from({ length: 100 }, (_, index) => observeUniverse(state, { methodId: "energy-trend", objectId, tick: index + 1 }));
  const history = performance.now() - historyStarted;

  const base = createResearchNotebook(state.identity.universeDefinitionId);
  const firstEvidenceId = signals[0].evidence[0].id;
  const notebook: ResearchNotebook = {
    ...base,
    revision: 103,
    signals,
    questions: buildKnowledgeQuestions(signals),
    observationHistory: signals.map((signal, index) => ({ id: `performance-history:${index + 1}`, order: index + 1, signalId: signal.id, methodId: signal.methodId, objectId, tick: signal.tick })),
    focuses: [{ id: "performance-focus", subjectId: signals[0].id, label: "能量趋势", tags: ["性能", "百条历史"], createdOrder: 101 }],
    notes: [{ id: "performance-note", text: "百条观察记录的恢复性能样本。", evidenceIds: [firstEvidenceId], createdOrder: 102, updatedOrder: 102 }],
    hypotheses: [{ id: "performance-hypothesis", statement: "能量趋势可能保持稳定。", status: "open", supportingEvidenceIds: [firstEvidenceId], opposingEvidenceIds: [], createdOrder: 103 }],
  };
  const validateSignal = createObservationAccess(state).validateSignal;
  const saveStarted = performance.now();
  const serialized = serializeResearchArchive(createResearchArchive(notebook, validateSignal));
  const save = performance.now() - saveStarted;
  const restoreStarted = performance.now();
  parseResearchArchive(serialized, validateSignal);
  const restore = performance.now() - restoreStarted;
  return { observation, history, save, restore };
}

function percentile(samples: readonly number[], ratio: number): number {
  return samples[Math.ceil(samples.length * ratio) - 1];
}

function ascending(left: number, right: number): number {
  return left - right;
}
