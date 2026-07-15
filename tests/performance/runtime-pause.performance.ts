// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import type { SimulationSpeed, UniverseTemplateId } from "../../src/sim";
import { createMemoryRuntimeStorage } from "../../src/ui/runtimeStorage";
import { useLegacyRuntimeUniverseModel as useRuntimeUniverseModel } from "../../src/ui/useLegacyRuntimeUniverseModel";

const PAUSE_BUDGET_MS = 100;
const scenarios: readonly { seed: string; templateId: UniverseTemplateId; speed: SimulationSpeed }[] = [
  { seed: "RUNTIME-PAUSE-001", templateId: "hard_science", speed: 1 },
  { seed: "RUNTIME-PAUSE-002", templateId: "high_magic", speed: 2 },
  { seed: "RUNTIME-PAUSE-003", templateId: "mythic", speed: 4 },
  { seed: "RUNTIME-PAUSE-004", templateId: "low_magic", speed: 8 },
  { seed: "RUNTIME-PAUSE-005", templateId: "mechanical_divinity", speed: 1 },
  { seed: "RUNTIME-PAUSE-006", templateId: "chaotic_laws", speed: 2 },
  { seed: "RUNTIME-PAUSE-007", templateId: "polytheistic_war", speed: 4 },
  { seed: "RUNTIME-PAUSE-008", templateId: "reincarnation_cycle", speed: 8 },
  { seed: "RUNTIME-PAUSE-009", templateId: "dream_realm", speed: 1 },
  { seed: "RUNTIME-PAUSE-010", templateId: "causal_fracture", speed: 2 },
  { seed: "RUNTIME-PAUSE-011", templateId: "hard_science", speed: 4 },
  { seed: "RUNTIME-PAUSE-012", templateId: "high_magic", speed: 8 },
];

describe("步骤 2 暂停调度性能", () => {
  it("两次预热后十二个多模板样本通过真实运行模型满足暂停预算", async () => {
    await measurePause({ seed: "RUNTIME-PAUSE-WARMUP-A", templateId: "causal_fracture", speed: 8 });
    await measurePause({ seed: "RUNTIME-PAUSE-WARMUP-B", templateId: "high_magic", speed: 8 });

    const samples = [];
    for (const scenario of scenarios) samples.push(await measurePause(scenario));

    expect(samples).toHaveLength(12);
    for (const sample of samples) {
      expect(sample.pauseLatency, `${sample.speed} 倍速度暂停状态提交耗时 ${sample.pauseLatency.toFixed(2)}ms`).toBeLessThan(PAUSE_BUDGET_MS);
      expect(sample.stepAfterBudget, `${sample.speed} 倍速度暂停后仍提交了新的时间步`).toBe(1);
    }
  }, 20_000);
});

async function measurePause(input: { seed: string; templateId: UniverseTemplateId; speed: SimulationSpeed }) {
  const storage = createMemoryRuntimeStorage();
  const view = renderHook(() => useRuntimeUniverseModel({
    seed: input.seed,
    templateId: input.templateId,
    storage,
  }));
  act(() => view.result.current.changeSpeed(input.speed));
  act(() => view.result.current.toggleRunning());
  await waitFor(() => expect(view.result.current.state.clock.step).toBe(1), { timeout: 2_000, interval: 5 });

  const committedAt = performance.now();
  act(() => view.result.current.pause());
  await waitFor(() => expect(view.result.current.state.clock.status).toBe("paused"), { timeout: PAUSE_BUDGET_MS, interval: 1 });
  const pauseLatency = performance.now() - committedAt;
  await new Promise((resolve) => setTimeout(resolve, PAUSE_BUDGET_MS + 20));
  const stepAfterBudget = view.result.current.state.clock.step;
  view.unmount();
  return { speed: input.speed, pauseLatency, stepAfterBudget };
}
