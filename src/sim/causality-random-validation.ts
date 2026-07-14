import type { CausalGraph, CausalValidationIssue } from "./contracts/causality";
import type { RandomStreamMetadata } from "./contracts/random";
import { RANDOM_ALGORITHM_VERSION, randomSeedFingerprint } from "./random";
import { replayRandomSample } from "./random-replay";
import { validRandomDecisionSemantics } from "./random-evidence-validation";

export function validateCausalRandomEvidence(graph: CausalGraph, issues: CausalValidationIssue[]): void {
  validateRandomTrace(graph, issues);
  validateRandomReferences(graph, issues);
}

function validateRandomTrace(graph: CausalGraph, issues: CausalValidationIssue[]): void {
  const trace = graph.randomTrace;
  const seed = graph.generation.inputs.find((input) => input.kind === "seed")?.value;
  const ruleset = graph.generation.inputs.find((input) => input.kind === "ruleset_version")?.value;
  const template = graph.generation.inputs.find((input) => input.kind === "creation_template")?.value;
  const expectedSeedMaterial = seed && ruleset && template ? `${ruleset}:${template}:${seed}` : undefined;
  let invalid = trace.algorithmVersion !== RANDOM_ALGORITHM_VERSION
    || !trace.generationId
    || trace.generationId !== graph.generation?.id
    || !expectedSeedMaterial
    || trace.seedMaterial !== expectedSeedMaterial
    || trace.seedFingerprint !== randomSeedFingerprint(trace.seedMaterial)
    || !/^[0-9a-f]{8}$/.test(trace.seedFingerprint)
    || !Number.isInteger(trace.totalSamples)
    || trace.totalSamples < 0;
  const streamIds = new Set<string>();
  let computedTotal = 0;
  for (const stream of trace.streams) {
    if (streamIds.has(stream.streamId)) invalid = true;
    streamIds.add(stream.streamId);
    invalid ||= invalidRandomStream(stream, trace.seedFingerprint, trace.seedMaterial);
    computedTotal += stream.sampleCount;
  }
  invalid ||= computedTotal !== trace.totalSamples;
  if (invalid) issues.push({ code: "INVALID_RANDOM_TRACE", message: "确定性随机追踪元数据不完整或彼此不一致。" });
}

function invalidRandomStream(stream: RandomStreamMetadata, seedFingerprint: string, seed: string): boolean {
  if (stream.algorithmVersion !== RANDOM_ALGORITHM_VERSION
    || stream.seedFingerprint !== seedFingerprint
    || !stream.streamId
    || !stream.namespace
    || !Number.isInteger(stream.sampleCount)
    || stream.sampleCount < 0
    || stream.lastSampleIndex !== (stream.sampleCount === 0 ? null : stream.sampleCount)
    || !stream.decisions
    || stream.decisions.length !== stream.sampleCount) return true;
  const indexes = new Set<number>();
  for (const decision of stream.decisions) {
    if (!Number.isInteger(decision.sampleIndex)
      || decision.sampleIndex < 1
      || decision.sampleIndex > stream.sampleCount
      || decision.sampleValue !== replayRandomSample(seed, stream.namespace, decision.sampleIndex)
      || indexes.has(decision.sampleIndex)
      || decision.decisionId !== `${stream.streamId}:${decision.sampleIndex}`
      || !validRandomDecisionSemantics(decision)
      || typeof decision.selectedValue !== "string"
      || !Array.isArray(decision.candidates)) return true;
    indexes.add(decision.sampleIndex);
  }
  return indexes.size !== stream.sampleCount;
}

function validateRandomReferences(graph: CausalGraph, issues: CausalValidationIssue[]): void {
  const streams = new Map(graph.randomTrace.streams.map((stream) => [stream.streamId, stream]));
  const decisions = new Map(graph.randomTrace.streams.flatMap((stream) => stream.decisions.map((decision) => [
    decision.decisionId,
    { decision, streamId: stream.streamId },
  ] as const)));
  const referencedDecisionIds = new Set<string>();
  for (const node of graph.nodes) {
    for (const reference of node.randomSampleRefs) {
      const stream = streams.get(reference.streamId);
      const indexedDecision = decisions.get(reference.decisionId);
      const decision = indexedDecision?.decision;
      const indexes = reference.sampleIndexes ?? [];
      const validIndexes = indexes.length > 0
        && indexes.every((index) => Number.isInteger(index) && index >= 1)
        && new Set(indexes).size === indexes.length;
      const invalid = !stream
        || !decision
        || reference.resultSubjectId !== node.subjectId
        || indexedDecision.streamId !== reference.streamId
        || stream.namespace !== reference.namespace
        || reference.scopeId !== decision.scopeId
        || !validIndexes
        || reference.firstSampleIndex !== Math.min(...indexes)
        || reference.lastSampleIndex !== Math.max(...indexes)
        || reference.firstSampleIndex !== reference.lastSampleIndex
        || indexes[0] !== decision.sampleIndex
        || reference.candidateSetId !== decision.candidateSetId
        || reference.selectedValue !== decision.selectedValue
        || !reference.purpose;
      if (invalid) issues.push({ code: "INVALID_RANDOM_REFERENCE", nodeId: node.id, message: `节点 ${node.id} 的确定性决策引用无效。` });
      else referencedDecisionIds.add(reference.decisionId);
    }
  }
  const unreferenced = [...decisions.keys()].filter((decisionId) => !referencedDecisionIds.has(decisionId));
  if (unreferenced.length > 0) issues.push({
    code: "INVALID_RANDOM_REFERENCE",
    message: `存在 ${unreferenced.length} 个未进入因果节点的确定性决定，首项为 ${unreferenced[0]}。`,
  });
}
