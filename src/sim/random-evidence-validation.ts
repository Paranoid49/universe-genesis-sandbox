import type { RandomDecisionRecord } from "./contracts/random";
import { randomCandidateSetId } from "./random";

export function validRandomDecisionSemantics(decision: RandomDecisionRecord): boolean {
  const candidates = decision.candidates;
  if (!decision.parameters || typeof decision.parameters !== "object"
    || !Array.isArray(candidates) || candidates.some((candidate) => typeof candidate !== "string")) return false;
  if (decision.operation === "next") {
    return decision.parameters.kind === "next"
      && decision.candidateSetId === "unit-interval" && candidates.length === 0 && decision.selectedValue === String(decision.sampleValue);
  }
  if (decision.operation === "range") {
    if (decision.parameters.kind !== "range") return false;
    const bounds = numericBounds(decision.candidateSetId, "range", candidates, false);
    const selected = Number(decision.selectedValue);
    return Boolean(bounds) && bounds![0] === decision.parameters.min && bounds![1] === decision.parameters.max
      && Number.isFinite(selected) && selected === bounds![0] + (bounds![1] - bounds![0]) * decision.sampleValue;
  }
  if (decision.operation === "int") {
    if (decision.parameters.kind !== "int") return false;
    const bounds = numericBounds(decision.candidateSetId, "integer", candidates, true);
    const selected = Number(decision.selectedValue);
    return Boolean(bounds) && bounds![0] === decision.parameters.min && bounds![1] === decision.parameters.max
      && Number.isInteger(selected) && selected === Math.floor(bounds![0] + (bounds![1] - bounds![0] + 1) * decision.sampleValue);
  }
  if (decision.operation === "bool") {
    if (decision.parameters.kind !== "bool") return false;
    const chance = prefixedNumber(decision.candidateSetId, "probability");
    return chance !== undefined
      && chance === decision.parameters.chance
      && chance >= 0
      && chance <= 1
      && candidates.length === 2
      && candidates[0] === "true"
      && candidates[1] === "false"
      && decision.selectedValue === String(decision.sampleValue < chance);
  }
  if (decision.operation === "pick") {
    return decision.parameters.kind === "pick"
      && sameStrings(candidates, decision.parameters.candidates)
      && candidates.length > 0
      && decision.candidateSetId === randomCandidateSetId(candidates)
      && candidates[Math.floor(decision.sampleValue * candidates.length)] === decision.selectedValue;
  }
  if (decision.operation === "weighted") {
    if (decision.parameters.kind !== "weighted") return false;
    const parsed = candidates.map(weightedCandidate).filter(isDefined);
    return parsed.length === candidates.length
      && sameWeightedCandidates(parsed, decision.parameters.candidates)
      && parsed.some((candidate) => candidate.weight > 0)
      && decision.candidateSetId === randomCandidateSetId(candidates)
      && weightedSelection(parsed, decision.sampleValue) === decision.selectedValue;
  }
  return false;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameWeightedCandidates(
  left: readonly { label: string; weight: number }[],
  right: readonly { label: string; weight: number }[],
): boolean {
  return left.length === right.length && left.every((value, index) => value.label === right[index]?.label && value.weight === right[index]?.weight);
}

function weightedSelection(candidates: readonly { label: string; weight: number }[], sample: number): string | undefined {
  const total = candidates.reduce((sum, candidate) => sum + Math.max(0, candidate.weight), 0);
  if (total <= 0) return undefined;
  let cursor = sample * total;
  for (const candidate of candidates) {
    cursor -= Math.max(0, candidate.weight);
    if (cursor <= 0) return candidate.label;
  }
  return candidates.at(-1)?.label;
}

function numericBounds(candidateSetId: string, prefix: string, candidates: readonly string[], integers: boolean): [number, number] | undefined {
  const parts = candidateSetId.split(":");
  if (parts.length !== 3 || parts[0] !== prefix || candidates.length !== 2) return undefined;
  const min = Number(parts[1]);
  const max = Number(parts[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return undefined;
  if (integers && (!Number.isInteger(min) || !Number.isInteger(max))) return undefined;
  return candidates[0] === String(min) && candidates[1] === String(max) ? [min, max] : undefined;
}

function prefixedNumber(candidateSetId: string, prefix: string): number | undefined {
  const marker = `${prefix}:`;
  if (!candidateSetId.startsWith(marker)) return undefined;
  const value = Number(candidateSetId.slice(marker.length));
  return Number.isFinite(value) ? value : undefined;
}

function weightedCandidate(candidate: string): { label: string; weight: number } | undefined {
  const separator = candidate.lastIndexOf("@");
  if (separator <= 0) return undefined;
  const weight = Number(candidate.slice(separator + 1));
  return Number.isFinite(weight) ? { label: candidate.slice(0, separator), weight } : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
