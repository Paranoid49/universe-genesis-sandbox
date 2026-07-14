import { add, derived } from "./causality-builder";
import { AXIOMS, type CausalMappingContext } from "./causality-model";
import { addHighRiskEvidence, addSummaryGroupEvidence } from "./causality-summary-group-evidence";

function addStatistic(context: CausalMappingContext, subjectId: string, label: string, description: string, causes: string[], ruleId: string): string {
  const nodeId = `collection-boundary:${subjectId}`;
  add(context.builder, context.subjects, derived(nodeId, subjectId, "collection_boundary", label, description, causes, [ruleId]));
  return nodeId;
}

export function addCivilizationCollectionSummaries(context: CausalMappingContext): void {
  const civilizations = context.universe.civilizations;
  const fallback = civilizations.length > 0 ? [] : ["metric:civilizationPotential"];
  const total = addStatistic(context, "civilization.stats.total", "文明总数", `文明 ${civilizations.length}。`, [
    ...fallback, ...civilizations.map((entry) => `civilization:${entry.id}`),
  ], AXIOMS.civilizationGeneration);
  const pathGroups = addSummaryGroupEvidence(context, "paths", civilizations.map((entry) => ({
    ownerId: `civilization:${entry.id}`,
    fieldSubject: `${entry.id}.path`,
    fieldLabel: `${entry.name}发展路径`,
    value: entry.path,
  })));
  const paths = addStatistic(context, "civilization.stats.paths", "文明路径统计", `路径 ${pathGroups.length}。`,
    [...fallback, ...pathGroups], AXIOMS.summaryGrouping);
  const mythologyGroups = addSummaryGroupEvidence(context, "mythologies", civilizations.map((entry) => ({
    ownerId: `mythology:${entry.id}`,
    fieldSubject: `${entry.id}.mythology.type`,
    fieldLabel: `${entry.name}神话类型`,
    value: entry.mythology.type,
  })));
  const mythologies = addStatistic(context, "civilization.stats.mythologies", "神话类型统计", `神话 ${mythologyGroups.length}。`,
    [...fallback, ...mythologyGroups], AXIOMS.summaryGrouping);
  const riskClassifications = addHighRiskEvidence(context);
  const highRisk = addStatistic(context, "civilization.stats.highRisk", "高风险文明统计",
    `高风险 ${civilizations.filter((entry) => entry.extinctionRisk >= 65).length}，判定阈值为灭绝风险不低于 65。`,
    [...fallback, ...riskClassifications], AXIOMS.summaryFiltering);
  addStatistic(context, "civilization.stats", "文明统计", "文明统计由总数、路径、神话类型与高风险判定四项独立证据组成。",
    [total, paths, mythologies, highRisk], AXIOMS.civilizationGeneration);
}
