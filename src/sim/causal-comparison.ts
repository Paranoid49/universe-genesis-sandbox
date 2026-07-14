import {
  LAW_COMPARISON_EVIDENCE_VERSION,
  type LawComparisonEvidence,
  type LawComparisonEvidenceTarget,
  type LawComparisonGraphEvidence,
} from "./contracts/causal-comparison";
import type { CausalGraph } from "./contracts/causality";
import type { LawComparison, LawDomainId, UniverseSummary } from "./types";
import { assertCausalGraph } from "./causality";

export const LAW_COMPARISON_DOMAIN_ORDER: readonly LawDomainId[] = [
  "physics",
  "magic",
  "life",
  "consciousness",
  "divinity",
  "causality",
];

export function buildLawComparisonEvidence(
  left: UniverseSummary,
  right: UniverseSummary,
  comparison: LawComparison,
  target: LawComparisonEvidenceTarget,
): LawComparisonEvidence {
  assertCausalGraph(left.causalGraph);
  assertCausalGraph(right.causalGraph);
  assertComparisonIdentity(left, right, comparison);
  if (comparison.domainDiffs.map((diff) => diff.domain).join("\u0000") !== LAW_COMPARISON_DOMAIN_ORDER.join("\u0000")) {
    throw new Error("对比领域顺序无效。");
  }
  const selected = target === "maximum" ? comparison.largestDiffDomain : target;
  const candidateDomains = target === "maximum" ? [...LAW_COMPARISON_DOMAIN_ORDER] : [selected];
  const values = candidateDomains.map((domain) => {
    const diff = comparison.domainDiffs.find((candidate) => candidate.domain === domain);
    if (!diff) throw new Error(`对比领域缺失：${domain}`);
    if (diff.leftValue !== left.laws[domain].rating.value
      || diff.rightValue !== right.laws[domain].rating.value
      || diff.delta !== diff.rightValue - diff.leftValue) {
      throw new Error(`对比值与宇宙不一致：${domain}`);
    }
    return { domain, leftValue: diff.leftValue, rightValue: diff.rightValue, delta: diff.delta };
  });
  const maximumAbsoluteDelta = Math.max(...comparison.domainDiffs.map((diff) => Math.abs(diff.delta)));
  const expectedMaximum = LAW_COMPARISON_DOMAIN_ORDER.find((domain) => {
    const diff = comparison.domainDiffs.find((candidate) => candidate.domain === domain);
    return diff && Math.abs(diff.delta) === maximumAbsoluteDelta;
  });
  if (comparison.largestDiffDomain !== expectedMaximum || (target === "maximum" && selected !== expectedMaximum)) {
    throw new Error("最大差异裁决无效。");
  }
  const evidence: LawComparisonEvidence = {
    version: LAW_COMPARISON_EVIDENCE_VERSION,
    id: `law-comparison:${left.causalGraph.generation.id}:${right.causalGraph.generation.id}:${target}`,
    target,
    selectedDomain: selected,
    values,
    left: graphEvidence(left, candidateDomains),
    right: graphEvidence(right, candidateDomains),
  };
  return freezeEvidence(evidence);
}

export function assertLawComparisonEvidence(
  evidence: LawComparisonEvidence,
  left: UniverseSummary,
  right: UniverseSummary,
  comparison: LawComparison,
  target: LawComparisonEvidenceTarget,
): void {
  const expected = buildLawComparisonEvidence(left, right, comparison, target);
  if (JSON.stringify(evidence) !== JSON.stringify(expected)) {
    throw new Error("组合证据不完整或与左右图不一致。");
  }
}

function graphEvidence(universe: UniverseSummary, domains: readonly LawDomainId[]): LawComparisonGraphEvidence {
  const subjects = domains.flatMap((domain) => [domain, ...universe.laws[domain].rules.map((rule) => rule.id)]);
  return {
    seed: universe.seed,
    generationId: universe.causalGraph.generation.id,
    sourceNodeIds: subjects.map((subjectId) => uniqueSubjectNodeId(universe.causalGraph, subjectId)).sort(),
  };
}

function assertComparisonIdentity(left: UniverseSummary, right: UniverseSummary, comparison: LawComparison): void {
  if (left.seed !== comparison.leftSeed
    || right.seed !== comparison.rightSeed
    || left.templateId !== comparison.templateId
    || right.templateId !== comparison.templateId
    || left.rulesetVersion !== right.rulesetVersion
    || !graphIdentityMatchesUniverse(left)
    || !graphIdentityMatchesUniverse(right)) {
    throw new Error("左右宇宙身份与比较结果不匹配。");
  }
}

function graphIdentityMatchesUniverse(universe: UniverseSummary): boolean {
  const inputs = universe.causalGraph.generation.inputs;
  return inputs[0]?.kind === "seed" && inputs[0].value === universe.seed
    && inputs[1]?.kind === "ruleset_version" && inputs[1].value === universe.rulesetVersion
    && inputs[2]?.kind === "creation_template" && inputs[2].value === universe.templateId;
}

function uniqueSubjectNodeId(graph: CausalGraph, subjectId: string): string {
  const matches = graph.nodes.filter((node) => node.subjectId === subjectId);
  if (matches.length !== 1) throw new Error(`来源主题 ${subjectId} 的节点数量为 ${matches.length}。`);
  return matches[0].id;
}

function freezeEvidence(evidence: LawComparisonEvidence): LawComparisonEvidence {
  evidence.values.forEach(Object.freeze);
  [evidence.values, evidence.left.sourceNodeIds, evidence.right.sourceNodeIds,
    evidence.left, evidence.right].forEach(Object.freeze);
  return Object.freeze(evidence);
}
