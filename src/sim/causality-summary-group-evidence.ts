import { add, derived } from "./causality-builder";
import { AXIOMS, type CausalMappingContext } from "./causality-model";

export function addSummaryGroupEvidence(
  context: CausalMappingContext,
  category: "paths" | "mythologies",
  entries: Array<{ ownerId: string; fieldSubject: string; fieldLabel: string; value: string }>,
): string[] {
  const membersByValue = new Map<string, string[]>();
  for (const entry of entries) {
    const fieldId = `summary-field:${entry.fieldSubject}`;
    add(context.builder, context.subjects, derived(fieldId, entry.fieldSubject, "state_value", entry.fieldLabel,
      `${entry.fieldLabel}为 ${entry.value}。`, [entry.ownerId], [AXIOMS.stateValueDerivation]));
    const memberId = `summary-group-member:${category}:${entry.fieldSubject}`;
    add(context.builder, context.subjects, derived(memberId, `civilization.stats.${category}.member.${entry.fieldSubject}`, "collection_boundary",
      `${entry.fieldLabel}归入 ${entry.value}`, `分组键为 ${entry.value}。`, [fieldId], [AXIOMS.summaryGrouping]));
    membersByValue.set(entry.value, [...(membersByValue.get(entry.value) ?? []), memberId]);
  }
  return [...membersByValue.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([value, members]) => {
    const groupId = `summary-group:${category}:${value}`;
    add(context.builder, context.subjects, derived(groupId, `civilization.stats.${category}.group.${value}`, "collection_boundary",
      `${category === "paths" ? "文明路径" : "神话类型"}分组 ${value}`, `分组 ${value} 包含 ${members.length} 个成员。`, members, [AXIOMS.summaryGrouping]));
    return groupId;
  });
}

export function addHighRiskEvidence(context: CausalMappingContext): string[] {
  const predicateId = "summary-filter:high-risk:predicate";
  add(context.builder, context.subjects, derived(predicateId, "civilization.stats.highRisk.predicate", "state_value", "高风险文明判定谓词",
    "谓词版本 civilization-high-risk@1；字段 extinctionRisk；运算符 >=；阈值 65。",
    ["initial-state:template-configuration"], [AXIOMS.summaryFiltering]));
  return context.universe.civilizations.map((entry) => {
    const fieldId = `summary-field:${entry.id}.extinctionRisk`;
    add(context.builder, context.subjects, derived(fieldId, `${entry.id}.extinctionRisk`, "state_value", `${entry.name}灭绝风险`,
      `灭绝风险字段值为 ${entry.extinctionRisk}。`, [`civilization:${entry.id}`], [AXIOMS.stateValueDerivation]));
    const included = entry.extinctionRisk >= 65;
    const classificationId = `summary-filter:high-risk:${entry.id}`;
    add(context.builder, context.subjects, derived(classificationId, `civilization.stats.highRisk.member.${entry.id}`, "collection_boundary",
      `${entry.name}${included ? "计入" : "排除"}高风险统计`, `灭绝风险 ${entry.extinctionRisk} ${included ? "不低于" : "低于"}阈值 65。`,
      [fieldId, predicateId], [AXIOMS.summaryFiltering]));
    return classificationId;
  });
}
