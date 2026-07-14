import type { RandomDecisionParameters, RandomDecisionRecord, RandomTraceSnapshot } from "./contracts/random";

export function randomTraceMatchesExpected(
  actual: RandomTraceSnapshot,
  expected: RandomTraceSnapshot,
): boolean {
  return actual.algorithmVersion === expected.algorithmVersion
    && actual.generationId === expected.generationId
    && actual.seedMaterial === expected.seedMaterial
    && actual.seedFingerprint === expected.seedFingerprint
    && actual.totalSamples === expected.totalSamples
    && actual.streams.length === expected.streams.length
    && actual.streams.every((stream, streamIndex) => {
      const counterpart = expected.streams[streamIndex];
      return Boolean(counterpart)
        && stream.algorithmVersion === counterpart!.algorithmVersion
        && stream.streamId === counterpart!.streamId
        && stream.namespace === counterpart!.namespace
        && stream.seedFingerprint === counterpart!.seedFingerprint
        && stream.sampleCount === counterpart!.sampleCount
        && stream.lastSampleIndex === counterpart!.lastSampleIndex
        && stream.decisions.length === counterpart!.decisions.length
        && stream.decisions.every((decision, decisionIndex) => randomDecisionsEqual(
          decision, counterpart!.decisions[decisionIndex],
        ));
    });
}

function randomDecisionsEqual(actual: RandomDecisionRecord, expected: RandomDecisionRecord | undefined): boolean {
  return Boolean(expected)
    && actual.decisionId === expected!.decisionId
    && actual.sampleIndex === expected!.sampleIndex
    && actual.sampleValue === expected!.sampleValue
    && actual.operation === expected!.operation
    && randomParametersEqual(actual.parameters, expected!.parameters)
    && actual.scopeId === expected!.scopeId
    && actual.candidateSetId === expected!.candidateSetId
    && sameStrings(actual.candidates, expected!.candidates)
    && actual.selectedValue === expected!.selectedValue;
}

function randomParametersEqual(actual: RandomDecisionParameters, expected: RandomDecisionParameters): boolean {
  if (actual.kind !== expected.kind) return false;
  if (actual.kind === "next") return true;
  if (actual.kind === "range" || actual.kind === "int") {
    const counterpart = expected as typeof actual;
    return actual.min === counterpart.min && actual.max === counterpart.max;
  }
  if (actual.kind === "bool") return actual.chance === (expected as typeof actual).chance;
  if (actual.kind === "pick") return sameStrings(actual.candidates, (expected as typeof actual).candidates);
  return sameWeightedCandidates(actual.candidates, (expected as typeof actual).candidates);
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
