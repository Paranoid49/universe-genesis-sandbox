export type WeightedChoice<T> = {
  item: T;
  weight: number;
};

export type RandomStream = {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  bool: (chance: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
  weighted: <T>(items: readonly WeightedChoice<T>[]) => T;
  fork: (name: string) => RandomStream;
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

export function createRandomStream(seed: string, namespace = "root"): RandomStream {
  let state = hashToUint32(`${seed}::${namespace}`);

  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  const stream: RandomStream = {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    bool: (chance) => next() < chance,
    pick: (items) => {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty collection.");
      }
      return items[Math.floor(next() * items.length)];
    },
    weighted: (items) => {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty weighted collection.");
      }
      const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
      if (total <= 0) {
        return items[0].item;
      }
      let cursor = next() * total;
      for (const entry of items) {
        cursor -= Math.max(0, entry.weight);
        if (cursor <= 0) {
          return entry.item;
        }
      }
      return items[items.length - 1].item;
    },
    fork: (name) => createRandomStream(seed, `${namespace}.${name}`),
  };

  return stream;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number): number {
  return Math.round(value);
}

function hashToUint32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
