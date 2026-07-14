import type { CausalGraph } from "../sim";

export function causalNodeIdsForSubjects(graph: CausalGraph, subjectIds: readonly string[]): string[] {
  return [...new Set(subjectIds)].map((subjectId) => requireCausalSubjectNode(graph, subjectId));
}

export function requireCausalSubjectNode(graph: CausalGraph, subjectId: string): string {
  const matches = graph.nodes.filter((candidate) => candidate.subjectId === subjectId);
  if (matches.length === 0) throw new Error(`因果图缺少主题节点：${subjectId}`);
  if (matches.length > 1) throw new Error(`因果图主题节点不唯一：${subjectId}`);
  return matches[0].id;
}

export function uniqueSubjectIds(subjectIds: readonly (string | undefined)[]): string[] {
  return [...new Set(subjectIds.filter((subjectId): subjectId is string => Boolean(subjectId)))];
}
