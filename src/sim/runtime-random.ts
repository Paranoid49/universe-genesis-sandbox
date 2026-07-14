import {
  RUNTIME_RANDOM_STATE_VERSION,
  type RuntimeRandomDecision,
  type RuntimeRandomState,
} from "./contracts/runtime";
import { randomHashToUint32, randomSeedFingerprint } from "./random";

export const RUNTIME_RANDOM_ALGORITHM_VERSION = "mulberry32-resumable@1";

export type RuntimeRandomStream = {
  readonly streamId: string;
  readonly namespace: string;
  readonly sampleCount: number;
  readonly lastDecision: RuntimeRandomDecision | undefined;
  next: () => number;
  int: (min: number, max: number) => number;
  bool: (chance: number) => boolean;
  snapshot: () => RuntimeRandomState;
};

export function createRuntimeRandomStream(seed: string, namespace: string, saved?: RuntimeRandomState): RuntimeRandomStream {
  const seedFingerprint = randomSeedFingerprint(seed);
  const streamId = `${seedFingerprint}:${namespace}`;
  if (saved) assertRuntimeRandomState(saved, { namespace, seedFingerprint, streamId });
  let state = saved?.state ?? randomHashToUint32(`${seed}::${namespace}`);
  let sampleCount = saved?.sampleCount ?? 0;
  let lastDecision: RuntimeRandomDecision | undefined;

  const sample = () => {
    sampleCount += 1;
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    streamId,
    namespace,
    get sampleCount() {
      return sampleCount;
    },
    get lastDecision() {
      return lastDecision;
    },
    next: () => {
      const sampleValue = sample();
      lastDecision = runtimeDecision(streamId, namespace, sampleCount, sampleValue, "next", {}, sampleValue);
      return sampleValue;
    },
    int: (min, max) => {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) throw new Error("随机整数范围无效。");
      const sampleValue = sample();
      const selected = Math.floor(min + (max - min + 1) * sampleValue);
      lastDecision = runtimeDecision(streamId, namespace, sampleCount, sampleValue, "int", { min, max }, selected);
      return selected;
    },
    bool: (chance) => {
      if (!Number.isFinite(chance) || chance < 0 || chance > 1) throw new Error("随机布尔概率必须位于 0 到 1 之间。");
      const sampleValue = sample();
      const selected = sampleValue < chance;
      lastDecision = runtimeDecision(streamId, namespace, sampleCount, sampleValue, "bool", { chance }, selected);
      return selected;
    },
    snapshot: () => Object.freeze({
      version: RUNTIME_RANDOM_STATE_VERSION,
      algorithmVersion: RUNTIME_RANDOM_ALGORITHM_VERSION,
      streamId,
      namespace,
      seedFingerprint,
      state,
      sampleCount,
    }),
  };
}

function runtimeDecision(
  streamId: string,
  namespace: string,
  sampleIndex: number,
  sampleValue: number,
  operation: RuntimeRandomDecision["operation"],
  parameters: Record<string, number>,
  selected: unknown,
): RuntimeRandomDecision {
  return Object.freeze({
    id: `${streamId}:${sampleIndex}`,
    streamId,
    namespace,
    sampleIndex,
    sampleValue,
    operation,
    parameters: Object.freeze({ ...parameters }),
    selectedValue: String(selected),
  });
}

function assertRuntimeRandomState(
  saved: RuntimeRandomState,
  expected: { namespace: string; seedFingerprint: string; streamId: string },
): void {
  if (saved.version !== RUNTIME_RANDOM_STATE_VERSION) throw new Error("运行随机流状态版本不受支持。");
  if (saved.algorithmVersion !== RUNTIME_RANDOM_ALGORITHM_VERSION) throw new Error("运行随机流算法版本不匹配。");
  if (saved.namespace !== expected.namespace || saved.streamId !== expected.streamId || saved.seedFingerprint !== expected.seedFingerprint) {
    throw new Error("运行随机流身份与目标宇宙不匹配。");
  }
  if (!Number.isSafeInteger(saved.state) || saved.state < 0 || saved.state > 0xffffffff) throw new Error("运行随机流内部状态无效。");
  if (!Number.isSafeInteger(saved.sampleCount) || saved.sampleCount < 0) throw new Error("运行随机流游标无效。");
}
