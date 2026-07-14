import { describe, expect, it } from "vitest";
import {
  advanceSimulationClock,
  createRuntimeRandomStream,
  createSimulationClock,
  setSimulationRunStatus,
  setSimulationSpeed,
} from "../src/sim";

describe("步骤 2 运行时基础契约", () => {
  it("逻辑时钟不读取墙上时间并以不可变值推进", () => {
    const initial = createSimulationClock();
    const running = setSimulationRunStatus(initial, "running");
    const faster = setSimulationSpeed(running, 4);
    const advanced = advanceSimulationClock(faster, 5);

    expect(initial).toEqual({ version: "ugs-simulation-clock@1", tick: 0, step: 0, status: "paused", speed: 1 });
    expect(advanced).toEqual({ version: "ugs-simulation-clock@1", tick: 5, step: 1, status: "running", speed: 4 });
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(advanced)).toBe(true);
  });

  it("随机流从快照恢复后的下一次抽样与未中断运行一致", () => {
    const uninterrupted = createRuntimeRandomStream("RUNTIME-SEED-001", "evolution.primary");
    const prefix = [uninterrupted.next(), uninterrupted.int(1, 10), uninterrupted.bool(0.4)];
    const snapshot = uninterrupted.snapshot();
    const expectedNext = [uninterrupted.next(), uninterrupted.int(-5, 5), uninterrupted.bool(0.75)];

    const restored = createRuntimeRandomStream("RUNTIME-SEED-001", "evolution.primary", snapshot);
    const restoredNext = [restored.next(), restored.int(-5, 5), restored.bool(0.75)];

    expect(prefix).toHaveLength(3);
    expect(restoredNext).toEqual(expectedNext);
    expect(restored.sampleCount).toBe(uninterrupted.sampleCount);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("随机流拒绝跨宇宙身份、未知版本和损坏游标", () => {
    const snapshot = createRuntimeRandomStream("RUNTIME-SEED-002", "evolution.primary").snapshot();

    expect(() => createRuntimeRandomStream("OTHER-SEED", "evolution.primary", snapshot)).toThrow("身份");
    expect(() => createRuntimeRandomStream("RUNTIME-SEED-002", "other", snapshot)).toThrow("身份");
    expect(() => createRuntimeRandomStream("RUNTIME-SEED-002", "evolution.primary", { ...snapshot, version: "unknown" as typeof snapshot.version })).toThrow("版本");
    expect(() => createRuntimeRandomStream("RUNTIME-SEED-002", "evolution.primary", { ...snapshot, sampleCount: -1 })).toThrow("游标");
  });

  it("时钟和随机输入边界拒绝无效值", () => {
    expect(() => advanceSimulationClock(createSimulationClock(), 0)).toThrow("推进量");
    const stream = createRuntimeRandomStream("RUNTIME-SEED-003", "evolution.primary");
    expect(() => stream.int(3, 2)).toThrow("范围");
    expect(() => stream.bool(1.1)).toThrow("概率");
  });
});
