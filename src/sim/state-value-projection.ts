import type { CausalProjectionEvidenceSpec, CausalProjectionSpec } from "./causality-projection";
import type { UniverseSummary } from "./types";
import { findStateValueDefinition } from "./state-value-definitions";

const DERIVATION_RULE = "axiom:state-value-derivation";
const certifiedStateValueSpecs = new WeakSet<object>();

export function buildStateValueCausalProjection(universe: UniverseSummary, subjectId: string): CausalProjectionSpec {
  const definition = findStateValueDefinition(universe, subjectId);
  if (!definition) throw new Error(`没有登记状态值主题“${subjectId}”。`);
  const displayLabel = stateValueDisplayLabel(universe, subjectId, definition.label);
  const projectionId = `state-value.${subjectId}`;
  const evidence: CausalProjectionEvidenceSpec[] = [];

  evidence.push({
    id: `${projectionId}.formula`,
    subjectId: definition.formulaId,
    label: `公式 ${definition.formulaId}`,
    description: definition.formula,
    causeNodeIds: [],
    ruleNodeId: requireSubjectNodeId(universe, DERIVATION_RULE),
  });

  definition.operands.forEach((operand, index) => evidence.push({
    id: `${projectionId}.operand.${index + 1}`,
    subjectId: `${subjectId}.operand.${index + 1}`,
    label: operand.label,
    description: `${operand.label} = ${serializeValue(operand.value)}。`,
    causeNodeIds: operand.causeSubjects.map((cause) => requireSubjectNodeId(universe, cause)),
    ruleNodeId: requireSubjectNodeId(universe, DERIVATION_RULE),
  }));

  const decisions = definition.randomScopes.flatMap((scopeId) => requireScopedDecision(universe, scopeId));
  decisions.forEach(({ stream, decision }, index) => {
    const decisionEvidenceId = `${projectionId}.decision.${index + 1}`;
    evidence.push({
      id: decisionEvidenceId,
      subjectId: `random-decision.${decision.decisionId}`,
      label: `精确随机决定 ${index + 1}`,
      description: `决定 ${decision.decisionId}；流 ${stream.namespace}；作用域 ${decision.scopeId}；操作 ${decision.operation}；类型化参数 ${JSON.stringify(decision.parameters)}；原始样本 ${decision.sampleValue}；候选快照 ${JSON.stringify(decision.candidates)}；选中 ${decision.selectedValue}。`,
      causeNodeIds: [requireSubjectNodeId(universe, "input.seed")],
      ruleNodeId: requireSubjectNodeId(universe, DERIVATION_RULE),
    });
    decisionCandidates(decision).forEach((candidate, candidateIndex) => evidence.push({
      id: `${decisionEvidenceId}.candidate.${candidateIndex + 1}`,
      subjectId: `random-decision.${decision.decisionId}.candidate.${candidateIndex + 1}`,
      label: `候选 ${candidateIndex + 1}`,
      description: `顺序 ${candidateIndex + 1}；标签 ${candidate.label}；权重 ${candidate.weight ?? "不适用"}。`,
      causeNodeIds: [`projection:${decisionEvidenceId}`],
      ruleNodeId: requireSubjectNodeId(universe, DERIVATION_RULE),
    }));
  });

  evidence.forEach((entry) => {
    Object.freeze(entry.causeNodeIds);
    Object.freeze(entry);
  });
  const spec: CausalProjectionSpec = {
    id: projectionId,
    subjectId,
    kind: "state_value",
    label: displayLabel,
    description: `${displayLabel}当前值为 ${serializeValue(definition.value)}，由公式 ${definition.formulaId}、${definition.operands.length} 个直接操作数与 ${decisions.length} 个精确随机决定共同得到。`,
    causeNodeIds: evidence.map((entry) => `projection:${entry.id}`),
    ruleNodeId: requireSubjectNodeId(universe, DERIVATION_RULE),
    evidence,
  };
  Object.freeze(evidence);
  Object.freeze(spec.causeNodeIds);
  Object.freeze(spec);
  certifiedStateValueSpecs.add(spec);
  return spec;
}

export function isCertifiedStateValueProjectionSpec(spec: CausalProjectionSpec): boolean {
  return spec.kind !== "state_value" || certifiedStateValueSpecs.has(spec);
}

export function stateValueResult(universe: UniverseSummary, subjectId: string): unknown {
  const definition = findStateValueDefinition(universe, subjectId);
  if (!definition) throw new Error(`没有登记状态值主题“${subjectId}”。`);
  return definition.value;
}

function requireSubjectNodeId(universe: UniverseSummary, subjectId: string): string {
  const matches = universe.causalGraph.nodes.filter((node) => node.subjectId === subjectId);
  if (matches.length !== 1) throw new Error(`状态值原因主题“${subjectId}”必须唯一，当前为 ${matches.length} 个。`);
  return matches[0].id;
}

function requireScopedDecision(universe: UniverseSummary, scopeId: string) {
  const matches = universe.causalGraph.randomTrace.streams.flatMap((stream) =>
    stream.decisions.filter((decision) => decision.scopeId === scopeId).map((decision) => ({ stream, decision })),
  );
  if (matches.length !== 1) throw new Error(`状态值随机作用域“${scopeId}”必须对应一个精确决定，当前为 ${matches.length} 个。`);
  return matches;
}

function decisionCandidates(decision: UniverseSummary["causalGraph"]["randomTrace"]["streams"][number]["decisions"][number]): Array<{ label: string; weight?: number }> {
  if (decision.parameters.kind === "weighted") return decision.parameters.candidates.map((entry) => ({ label: entry.label, weight: entry.weight }));
  if (decision.parameters.kind === "pick") return decision.parameters.candidates.map((label) => ({ label }));
  return decision.candidates.map((label) => ({ label }));
}

function serializeValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function stateValueDisplayLabel(universe: UniverseSummary, subjectId: string, fieldLabel: string): string {
  for (const galaxy of universe.galaxies) {
    if (subjectId.startsWith(`${galaxy.id}.`) && !subjectId.includes("-sys-")) return `${galaxy.name}：${fieldLabel}`;
    for (const system of galaxy.starSystems) {
      if (subjectId.startsWith(`${system.id}.`) && !subjectId.includes("-pl-")) return `${system.name}：${fieldLabel}`;
      for (const planet of system.planets) {
        if (subjectId.startsWith(`${planet.id}.civilization-seed.`)) return `${planet.name}文明候选：${fieldLabel}`;
        if (subjectId.startsWith(`${planet.id}.biosphere.`)) return `${planet.name}生物圈：${fieldLabel}`;
        if (subjectId.startsWith(`${planet.id}.`)) return `${planet.name}：${fieldLabel}`;
      }
    }
  }
  const civilization = universe.civilizations.find((entry) => subjectId.startsWith(`${entry.id}.`));
  if (civilization) return subjectId.startsWith(`${civilization.id}.mythology.`)
    ? `${civilization.name}神话：${fieldLabel}`
    : `${civilization.name}：${fieldLabel}`;
  return fieldLabel;
}
