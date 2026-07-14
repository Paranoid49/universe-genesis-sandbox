import { randomHashToUint32 } from "./random";

export function replayRandomSample(seed: string, namespace: string, sampleIndex: number): number {
  if (!Number.isInteger(sampleIndex) || sampleIndex < 1) throw new Error("随机样本序号必须是正整数。");
  let state = randomHashToUint32(`${seed}::${namespace}`);
  let sample = 0;
  for (let index = 0; index < sampleIndex; index += 1) {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    sample = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return sample;
}
