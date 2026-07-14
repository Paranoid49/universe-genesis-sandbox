import { randomHashToUint32 } from "./random";

export function runtimeFingerprint(value: unknown): string {
  return randomHashToUint32(runtimeStableSerialize(value)).toString(16).padStart(8, "0");
}

export function runtimeStableSerialize(value: unknown): string {
  if (value === undefined) return "[undefined]";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(runtimeStableSerialize).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${runtimeStableSerialize((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
