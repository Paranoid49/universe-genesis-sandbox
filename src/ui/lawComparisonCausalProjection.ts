import {
  generateUniverse,
  buildLawComparisonEvidence,
  LAW_COMPARISON_DOMAIN_ORDER,
  type CausalProjectionSpec,
  type DomainLawDiff,
  type LawComparison,
  type LawDomain,
  type LawDomainId,
  type UniverseSummary,
} from "../sim";
import { requireCausalSubjectNode } from "./causalProjectionSources";
import { lawDomainTitle } from "./labels";

export type LawComparisonSide = "left" | "right";
export type LawComparisonTraceTarget = LawDomainId | "maximum";

export const lawComparisonDomainOrder: readonly LawDomainId[] = [
  ...LAW_COMPARISON_DOMAIN_ORDER,
];

export function generateLawComparisonUniverse(leftUniverse: UniverseSummary, rightSeed: string): UniverseSummary {
  return generateUniverse({
    seed: rightSeed,
    rulesetVersion: leftUniverse.rulesetVersion,
    templateId: leftUniverse.templateId,
  });
}

export function buildLawComparisonView(left: UniverseSummary, right: UniverseSummary): LawComparison {
  const domainDiffs = lawComparisonDomainOrder.map((domain): DomainLawDiff => {
    const leftDomain = left.laws[domain];
    const rightDomain = right.laws[domain];
    return {
      domain,
      leftValue: leftDomain.rating.value,
      rightValue: rightDomain.rating.value,
      delta: rightDomain.rating.value - leftDomain.rating.value,
      strongestLeftRule: strongestRuleName(leftDomain),
      strongestRightRule: strongestRuleName(rightDomain),
    };
  });
  const maximumAbsoluteDelta = Math.max(...domainDiffs.map((diff) => Math.abs(diff.delta)));
  const largestDiff = domainDiffs.find((diff) => Math.abs(diff.delta) === maximumAbsoluteDelta) ?? domainDiffs[0];
  if (!largestDiff) throw new Error("法则对比至少需要一个候选领域。");
  const stableOrder = lawComparisonDomainOrder.map(lawDomainTitle).join(" → ");
  return {
    leftSeed: left.seed,
    rightSeed: right.seed,
    templateId: left.templateId,
    domainDiffs,
    largestDiffDomain: largestDiff.domain,
    summary: `在六个候选领域中计算 max(abs(右值 - 左值)) = ${maximumAbsoluteDelta}；若绝对差值并列，按 ${stableOrder} 的固定顺序选择最先出现项。本次结果为${lawDomainTitle(largestDiff.domain)}。`,
  };
}

export function buildLawComparisonCausalProjection(
  leftUniverse: UniverseSummary,
  rightUniverse: UniverseSummary,
  comparison: LawComparison,
  side: LawComparisonSide,
  target: LawComparisonTraceTarget,
): CausalProjectionSpec {
  const evidence = buildLawComparisonEvidence(leftUniverse, rightUniverse, comparison, target);
  const universe = side === "left" ? leftUniverse : rightUniverse;
  const sideEvidence = side === "left" ? evidence.left : evidence.right;
  const diff = target === "maximum"
    ? comparison.domainDiffs.find((candidate) => candidate.domain === comparison.largestDiffDomain)
    : comparison.domainDiffs.find((candidate) => candidate.domain === target);
  if (!diff) throw new Error(`法则对比缺少目标：${target}`);
  const ruleNodeId = requireCausalSubjectNode(universe.causalGraph, "axiom:explanation-projection");
  const causeNodeIds = [...sideEvidence.sourceNodeIds];
  const sideLabel = side === "left" ? "左值" : "右值";
  return {
    id: `law-comparison:${comparison.leftSeed}:${comparison.rightSeed}:${side}:${target}`,
    subjectId: `law-comparison.${comparison.leftSeed}.${comparison.rightSeed}.${side}.${target}`,
    kind: "explanation",
    label: target === "maximum" ? `最大差异总结：${sideLabel}依据` : `${lawDomainTitle(diff.domain)}：${sideLabel}评分`,
    description: target === "maximum"
      ? `本侧六领域依据见组合证据 ${evidence.id}；该证据校验左右因果图的最大差异与并列裁决。`
      : `${sideLabel}评分为 ${side === "left" ? diff.leftValue : diff.rightValue}；最强规则为${side === "left" ? diff.strongestLeftRule : diff.strongestRightRule}。组合证据 ${evidence.id} 校验左右评分与差值。`,
    causeNodeIds,
    ruleNodeId,
  };
}

function strongestRuleName(domain: LawDomain): string {
  const strongest = [...domain.rules].sort((left, right) => right.value - left.value)[0];
  return strongest ? `${strongest.name}（${strongest.value}）` : "无结构化规则";
}
