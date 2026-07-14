import type { CausalGraph, CausalNode } from "./contracts/causality";
import type { CausalUniverseSource } from "./causality-source";

export function deepSummaryEvidenceIssues(graph: CausalGraph, universe: CausalUniverseSource): string[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const bySubject = new Map<string, CausalNode[]>();
  for (const node of graph.nodes) {
    const matches = bySubject.get(node.subjectId) ?? [];
    matches.push(node);
    bySubject.set(node.subjectId, matches);
  }
  return [
    ...groupIssues("paths", universe.civilizations.map((entry) => ({
      owner: entry.id,
      ownerSubject: entry.id,
      fieldSubject: `${entry.id}.path`,
      fieldLabel: `${entry.name}发展路径`,
      value: entry.path,
    }))),
    ...groupIssues("mythologies", universe.civilizations.map((entry) => ({
      owner: entry.id,
      ownerSubject: `${entry.id}.mythology`,
      fieldSubject: `${entry.id}.mythology.type`,
      fieldLabel: `${entry.name}神话类型`,
      value: entry.mythology.type,
    }))),
    ...highRiskIssues(),
  ];

  function groupIssues(category: "paths" | "mythologies", entries: Array<{
    owner: string; ownerSubject: string; fieldSubject: string; fieldLabel: string; value: string;
  }>): string[] {
    const issues: string[] = [];
    const expectedGroups = new Map<string, string[]>();
    for (const entry of entries) {
      const field = requireNode(entry.fieldSubject, `${category} 字段`, issues);
      checkNode(field, `${entry.fieldLabel}为 ${entry.value}。`, [entry.ownerSubject, "axiom:state-value-derivation"], issues);
      const memberSubject = `civilization.stats.${category}.member.${entry.fieldSubject}`;
      const member = requireNode(memberSubject, `${category} 成员`, issues);
      checkNode(member, `分组键为 ${entry.value}。`, [entry.fieldSubject, "axiom:summary-grouping"], issues);
      expectedGroups.set(entry.value, [...(expectedGroups.get(entry.value) ?? []), memberSubject]);
    }
    for (const [value, members] of expectedGroups) {
      const groupSubject = `civilization.stats.${category}.group.${value}`;
      const group = requireNode(groupSubject, `${category} 分组`, issues);
      checkNode(group, `分组 ${value} 包含 ${members.length} 个成员。`, [...members, "axiom:summary-grouping"], issues);
    }
    const actualMembers = graph.nodes.filter((node) => node.subjectId.startsWith(`civilization.stats.${category}.member.`));
    const actualGroups = graph.nodes.filter((node) => node.subjectId.startsWith(`civilization.stats.${category}.group.`));
    if (actualMembers.length !== entries.length) issues.push(`${category} 分组成员数量不精确`);
    if (actualGroups.length !== expectedGroups.size) issues.push(`${category} 分组数量不精确`);
    return issues;
  }

  function highRiskIssues(): string[] {
    const issues: string[] = [];
    const predicate = requireNode("civilization.stats.highRisk.predicate", "高风险谓词", issues);
    checkNode(predicate, "谓词版本 civilization-high-risk@1；字段 extinctionRisk；运算符 >=；阈值 65。",
      ["initial-state:template-configuration", "axiom:summary-filtering"], issues);
    for (const entry of universe.civilizations) {
      const fieldSubject = `${entry.id}.extinctionRisk`;
      const field = requireNode(fieldSubject, "灭绝风险字段", issues);
      checkNode(field, `灭绝风险字段值为 ${entry.extinctionRisk}。`, [entry.id, "axiom:state-value-derivation"], issues);
      const included = entry.extinctionRisk >= 65;
      const memberSubject = `civilization.stats.highRisk.member.${entry.id}`;
      const member = requireNode(memberSubject, "高风险成员判定", issues);
      checkNode(member, `灭绝风险 ${entry.extinctionRisk} ${included ? "不低于" : "低于"}阈值 65。`,
        [fieldSubject, "civilization.stats.highRisk.predicate", "axiom:summary-filtering"], issues);
      if (member && !member.label.includes(included ? "计入" : "排除")) issues.push(`${memberSubject} 纳入结果错误`);
    }
    const actualMembers = graph.nodes.filter((node) => node.subjectId.startsWith("civilization.stats.highRisk.member."));
    if (actualMembers.length !== universe.civilizations.length) issues.push("高风险成员判定数量不精确");
    return issues;
  }

  function requireNode(subjectId: string, label: string, issues: string[]): CausalNode | undefined {
    const matches = bySubject.get(subjectId) ?? [];
    if (matches.length !== 1) issues.push(`${label} ${subjectId} 节点数量为 ${matches.length}`);
    return matches[0];
  }

  function checkNode(node: CausalNode | undefined, description: string, causeSubjects: string[], issues: string[]): void {
    if (!node) return;
    if (node.description !== description) issues.push(`${node.subjectId} 描述或值证据错误`);
    const actual = node.directCauseIds.flatMap((id) => byId.get(id)?.subjectId ?? []);
    if (!sameSet(actual, causeSubjects)) issues.push(`${node.subjectId} 原因集合错误`);
  }
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size || leftSet.size !== left.length || leftSet.size !== right.length) return false;
  for (const value of leftSet) if (!rightSet.has(value)) return false;
  return true;
}
