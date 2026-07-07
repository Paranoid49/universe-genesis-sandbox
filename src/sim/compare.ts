import { generateUniverse } from "./universe";
import type { DomainLawDiff, LawComparison, LawDomain, LawDomainId, StructuredLaw, UniverseTemplateId } from "./types";

const lawDomainIds: LawDomainId[] = ["physics", "magic", "life", "consciousness", "divinity", "causality"];

const domainNames: Record<LawDomainId, string> = {
  physics: "物理法则",
  magic: "魔法法则",
  life: "生命法则",
  consciousness: "意识法则",
  divinity: "神性法则",
  causality: "因果与时间法则",
};

export function compareUniverseLaws(leftSeed: string, rightSeed: string, templateId: UniverseTemplateId): LawComparison {
  const left = generateUniverse({ seed: leftSeed, templateId });
  const right = generateUniverse({ seed: rightSeed, templateId });
  const domainDiffs = lawDomainIds.map((domain): DomainLawDiff => {
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
  const largestDiff = [...domainDiffs].sort((leftDiff, rightDiff) => Math.abs(rightDiff.delta) - Math.abs(leftDiff.delta))[0];

  return {
    leftSeed: left.seed,
    rightSeed: right.seed,
    templateId,
    domainDiffs,
    largestDiffDomain: largestDiff.domain,
    summary: `差异最大的领域是${domainNames[largestDiff.domain]}，强度变化为 ${signed(largestDiff.delta)}。`,
  };
}

function strongestRuleName(domain: LawDomain): string {
  const strongest = [...domain.rules].sort((left, right) => right.value - left.value)[0];
  return ruleLabel(strongest);
}

function ruleLabel(rule: StructuredLaw): string {
  return `${rule.name}（${rule.value}）`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
