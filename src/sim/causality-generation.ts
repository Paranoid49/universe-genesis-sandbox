import {
  CAUSAL_GENERATION_MANIFEST_VERSION,
  type CausalGraph,
  type CausalGenerationManifest,
  type CausalInputRecord,
  type CausalNode,
  type CausalValidationIssue,
} from "./contracts/causality";
import type { GenerateUniverseInput } from "./types";

type GenerationSource = Pick<GenerateUniverseInput, "seed" | "rulesetVersion" | "templateId">;

export function createCausalGenerationManifest(
  source: Required<GenerationSource>,
  interventions: NonNullable<GenerateUniverseInput["interventions"]> = [],
): CausalGenerationManifest {
  const inputs: CausalInputRecord[] = [
    inputRecord("input:seed", "seed", 0, "input.seed", source.seed),
    inputRecord("input:ruleset", "ruleset_version", 1, source.rulesetVersion, source.rulesetVersion),
    inputRecord("input:template", "creation_template", 2, source.templateId, source.templateId),
    ...interventions.map((input, index) => inputRecord(
      `input:intervention:${index + 1}:${input.id}`,
      "intervention",
      index + 3,
      input.id,
      JSON.stringify({ id: input.id, miracleType: input.miracleType, targetId: input.targetId }),
    )),
  ];
  return {
    version: CAUSAL_GENERATION_MANIFEST_VERSION,
    id: causalGenerationManifestId(inputs),
    inputs,
  };
}

export function causalGenerationManifestId(inputs: readonly CausalInputRecord[]): string {
  const canonical = inputs.map((input) => [input.kind, input.order, input.subjectId, input.value].join("\u0000")).join("\u0001");
  return `generation:${stableHash(canonical)}`;
}

export function validateCausalGenerationManifest(
  graph: CausalGraph,
  nodes: Map<string, CausalNode>,
  issues: CausalValidationIssue[],
  expected?: CausalGenerationManifest,
): Set<string> {
  const manifest = graph.generation;
  const inputRoots = graph.nodes.filter((node) => node.root === "input");
  let valid = Boolean(manifest)
    && manifest.version === CAUSAL_GENERATION_MANIFEST_VERSION
    && Array.isArray(manifest.inputs)
    && manifest.id === causalGenerationManifestId(manifest.inputs ?? [])
    && graph.randomTrace?.generationId === manifest.id
    && (!expected || sameManifest(manifest, expected));
  const records = manifest?.inputs ?? [];
  const rootIds = new Set<string>();
  const kinds = records.map((record) => record.kind);
  valid &&= kinds[0] === "seed" && kinds[1] === "ruleset_version" && kinds[2] === "creation_template";
  valid &&= records.slice(3).every((record) => record.kind === "intervention");
  for (const [index, record] of records.entries()) {
    valid &&= validInputRecord(record, index, nodes) && !rootIds.has(record.rootNodeId);
    if (record.kind === "intervention") valid &&= validInterventionEvidence(record, nodes);
    rootIds.add(record.rootNodeId);
  }
  valid &&= sameStringSet(inputRoots.map((node) => node.id), rootIds);
  if (!valid) {
    issues.push({ code: "INVALID_INPUT_MANIFEST", message: "输入清单、根与随机追踪不一致。" });
    return new Set();
  }
  return rootIds;
}

function inputRecord(
  rootNodeId: string,
  kind: CausalInputRecord["kind"],
  order: number,
  subjectId: string,
  value: string,
): CausalInputRecord {
  return { rootNodeId, kind, order, subjectId, value };
}

function validInputRecord(record: CausalInputRecord, index: number, nodes: Map<string, CausalNode>): boolean {
  const node = nodes.get(record.rootNodeId);
  return record.order === index
    && Boolean(record.subjectId)
    && Boolean(record.value)
    && node?.kind === "input"
    && node.root === "input"
    && node.subjectId === record.subjectId
    && sameInputEvidence(node, record);
}

function validInterventionEvidence(record: CausalInputRecord, nodes: Map<string, CausalNode>): boolean {
  const matching = [...nodes.values()].filter((node) => node.kind === "intervention" && sameInputEvidence(node, record));
  return matching.length === 1;
}

function sameInputEvidence(node: CausalNode, record: CausalInputRecord): boolean {
  return node.input?.kind === record.kind
    && node.input.order === record.order
    && node.input.subjectId === record.subjectId
    && node.input.value === record.value;
}

function sameManifest(actual: CausalGenerationManifest, expected: CausalGenerationManifest): boolean {
  return actual.version === expected.version
    && actual.id === expected.id
    && actual.inputs.length === expected.inputs.length
    && actual.inputs.every((input, index) => {
      const other = expected.inputs[index];
      return Boolean(other)
        && input.kind === other.kind
        && input.order === other.order
        && input.subjectId === other.subjectId
        && input.value === other.value;
    });
}

function sameStringSet(actual: readonly string[], expected: Set<string>): boolean {
  return actual.length === expected.size && actual.every((value) => expected.has(value));
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
