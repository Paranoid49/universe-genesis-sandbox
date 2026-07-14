import type {
  RandomDecisionOperation,
  RandomDecisionParameters,
  RandomDecisionRecord,
  RandomStreamMetadata,
  RandomTraceSnapshot,
} from "./contracts/random";
import { cloneDecisionParameters } from "./random-decision-parameters";

export type { RandomDecisionOperation, RandomDecisionParameters, RandomDecisionRecord, RandomStreamMetadata, RandomTraceSnapshot } from "./contracts/random";

export type WeightedChoice<T> = {
  item: T;
  weight: number;
};

export const RANDOM_ALGORITHM_VERSION = "fnv1a32-mulberry32@1";

export type RandomStream = {
  readonly algorithmVersion: string;
  readonly streamId: string;
  readonly namespace: string;
  readonly sampleCount: number;
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  bool: (chance: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
  weighted: <T>(items: readonly WeightedChoice<T>[]) => T;
  fork: (name: string) => RandomStream;
  withScope: <T>(scopeId: string, operation: (stream: RandomStream) => T) => T;
  renameScope: (fromScopeId: string, toScopeId: string) => void;
  getMetadata: () => RandomStreamMetadata;
  getTrace: () => RandomTraceSnapshot;
};

type MutableRandomTrace = {
  generationId: string;
  seedMaterial: string;
  seedFingerprint: string;
  trackDecisions: boolean;
  occurrenceByNamespace: Map<string, number>;
  streams: RandomStreamRecord[];
};

type MutableRandomDecision = {
  decisionId: string;
  sampleIndex: number;
  sampleValue: number;
  operation: RandomDecisionOperation;
  parameters: RandomDecisionParameters;
  scopeId?: string;
  candidateSetId: string;
  candidates: string[];
  selectedValue: string;
};

type RandomStreamRecord = {
  streamId: string;
  namespace: string;
  sampleCount: number;
  decisions: MutableRandomDecision[];
};

type DecisionDescription = {
  operation: RandomDecisionOperation;
  parameters: RandomDecisionParameters;
  candidateSetId: string;
  candidates: string[];
  selectedValue: string;
};

export function normalizeSeed(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  return cleaned || "VOID00000001";
}

export function formatSeed(seed: string): string {
  const normalized = normalizeSeed(seed);
  const first = normalized.slice(0, 3);
  const second = normalized.slice(3, 7);
  const third = normalized.slice(7, 11);
  const rest = normalized.slice(11);
  return [first, second, third, rest].filter(Boolean).join("-");
}

export function createRandomStream(seed: string, namespace = "root", trackDecisions = false, generationId?: string): RandomStream {
  const seedFingerprint = randomSeedFingerprint(seed);
  const trace: MutableRandomTrace = {
    generationId: generationId ?? seedFingerprint,
    seedMaterial: seed,
    seedFingerprint,
    trackDecisions,
    occurrenceByNamespace: new Map(),
    streams: [],
  };
  return createTrackedRandomStream(seed, namespace, trace);
}

function createTrackedRandomStream(seed: string, namespace: string, trace: MutableRandomTrace): RandomStream {
  let state = randomHashToUint32(`${seed}::${namespace}`);
  const occurrence = (trace.occurrenceByNamespace.get(namespace) ?? 0) + 1;
  trace.occurrenceByNamespace.set(namespace, occurrence);
  const record: RandomStreamRecord = {
    streamId: `${trace.seedFingerprint}:${namespace}#${occurrence}`,
    namespace,
    sampleCount: 0,
    decisions: [],
  };
  trace.streams.push(record);

  const rawSample = () => {
    record.sampleCount += 1;
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  const createFacade = (scopeId?: string): RandomStream => {
    const draw = <T>(select: (sample: number) => T, describe: (selected: T) => DecisionDescription): T => {
      const sample = rawSample();
      const selected = select(sample);
      if (!trace.trackDecisions) return selected;
      const description = describe(selected);
      const sampleIndex = record.sampleCount;
      record.decisions.push({
        decisionId: `${record.streamId}:${sampleIndex}`,
        sampleIndex,
        sampleValue: sample,
        scopeId,
        ...description,
      });
      return selected;
    };

    const stream: RandomStream = {
      algorithmVersion: RANDOM_ALGORITHM_VERSION,
      streamId: record.streamId,
      namespace,
      get sampleCount() {
        return record.sampleCount;
      },
      next: () => draw(
        (sample) => sample,
        (selected) => decision("next", { kind: "next" }, "unit-interval", [], selected),
      ),
      range: (min, max) => draw(
        (sample) => min + (max - min) * sample,
        (selected) => decision("range", { kind: "range", min, max }, `range:${min}:${max}`, [min, max], selected),
      ),
      int: (min, max) => draw(
        (sample) => Math.floor(min + (max - min + 1) * sample),
        (selected) => decision("int", { kind: "int", min, max }, `integer:${min}:${max}`, [min, max], selected),
      ),
      bool: (chance) => draw(
        (sample) => sample < chance,
        (selected) => decision("bool", { kind: "bool", chance }, `probability:${chance}`, [true, false], selected),
      ),
      pick: (items) => {
        if (items.length === 0) throw new Error("不能从空集合中抽取元素。");
        return draw(
          (sample) => items[Math.floor(sample * items.length)],
          (selected) => {
            const candidates = items.map(candidateLabel);
            return decision("pick", { kind: "pick", candidates }, randomCandidateSetId(candidates), candidates, selected);
          },
        );
      },
      weighted: (items) => {
        if (items.length === 0) throw new Error("不能从空的加权集合中抽取元素。");
        const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
        if (total <= 0) return items[0].item;
        return draw(
          (sample) => {
            let cursor = sample * total;
            for (const entry of items) {
              cursor -= Math.max(0, entry.weight);
              if (cursor <= 0) return entry.item;
            }
            return items[items.length - 1].item;
          },
          (selected) => {
            const typedCandidates = items.map((entry) => ({ label: candidateLabel(entry.item), weight: entry.weight }));
            const candidates = typedCandidates.map((entry) => `${entry.label}@${entry.weight}`);
            return decision("weighted", { kind: "weighted", candidates: typedCandidates }, randomCandidateSetId(candidates), candidates, selected);
          },
        );
      },
      fork: (name) => createTrackedRandomStream(seed, `${namespace}.${name}`, trace),
      withScope: (nextScopeId, operation) => operation(trace.trackDecisions ? createFacade(nextScopeId) : stream),
      renameScope: (fromScopeId, toScopeId) => {
        for (const entry of trace.streams.flatMap((item) => item.decisions)) {
          if (entry.scopeId === fromScopeId) entry.scopeId = toScopeId;
        }
      },
      getMetadata: () => snapshotStream(record, trace.seedFingerprint),
      getTrace: () => snapshotTrace(trace),
    };
    return stream;
  };

  return createFacade();
}

function decision(
  operation: RandomDecisionOperation,
  parameters: RandomDecisionParameters,
  candidateId: string,
  candidates: readonly unknown[],
  selected: unknown,
): DecisionDescription {
  const labels = candidates.map(candidateLabel);
  return {
    operation,
    parameters,
    candidateSetId: candidateId,
    candidates: labels,
    selectedValue: candidateLabel(selected),
  };
}

export function randomCandidateSetId(candidates: readonly string[]): string {
  return `set:${randomHashToUint32(candidates.join("\u0000")).toString(16).padStart(8, "0")}`;
}

function candidateLabel(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const identityKeys = Object.keys(record).sort().filter((key) => {
      const entry = record[key];
      return typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean";
    });
    if (identityKeys.length > 0) return identityKeys.map((key) => `${key}=${String(record[key])}`).join("|");
  }
  const normalized = stableSerializable(value, new Set());
  const serialized = typeof normalized === "string" ? normalized : JSON.stringify(normalized);
  return serialized.length > 240 ? `${serialized.slice(0, 224)}…#${randomHashToUint32(serialized).toString(16).padStart(8, "0")}` : serialized;
}

function stableSerializable(value: unknown, active: Set<object>): unknown {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "undefined") return "[undefined]";
  if (typeof value === "function") return `[函数:${value.name || "匿名"}]`;
  if (typeof value !== "object") return String(value);
  if (active.has(value)) return "[循环引用]";
  active.add(value);
  const normalized = Array.isArray(value)
    ? value.map((entry) => stableSerializable(entry, active))
    : Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [
      key,
      stableSerializable((value as Record<string, unknown>)[key], active),
    ]));
  active.delete(value);
  return normalized;
}

function snapshotStream(record: RandomStreamRecord, seedFingerprint: string): RandomStreamMetadata {
  return {
    algorithmVersion: RANDOM_ALGORITHM_VERSION,
    streamId: record.streamId,
    namespace: record.namespace,
    seedFingerprint,
    sampleCount: record.sampleCount,
    lastSampleIndex: record.sampleCount > 0 ? record.sampleCount : null,
    decisions: record.decisions.map((entry): RandomDecisionRecord => ({
      ...entry,
      parameters: cloneDecisionParameters(entry.parameters),
      candidates: [...entry.candidates],
    })),
  };
}

function snapshotTrace(trace: MutableRandomTrace): RandomTraceSnapshot {
  const streams = trace.streams
    .map((record) => snapshotStream(record, trace.seedFingerprint))
    .sort((left, right) => left.streamId.localeCompare(right.streamId));
  return {
    algorithmVersion: RANDOM_ALGORITHM_VERSION,
    generationId: trace.generationId,
    seedMaterial: trace.seedMaterial,
    seedFingerprint: trace.seedFingerprint,
    totalSamples: streams.reduce((sum, stream) => sum + stream.sampleCount, 0),
    streams,
  };
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number): number {
  return Math.round(value);
}

export function randomSeedFingerprint(seedMaterial: string): string {
  return randomHashToUint32(seedMaterial).toString(16).padStart(8, "0");
}

export function randomHashToUint32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
