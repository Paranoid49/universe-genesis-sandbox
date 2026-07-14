import type { CausalGraph } from "./contracts/causality";
import type { CausalUniverseSource } from "./causality-source";
import { deepSummaryEvidenceIssues } from "./causality-summary-deep-validation";

type ExpectedSummary = { subjectId: string; description: string; causeSubjects: string[] };

export function summaryCollectionEvidenceIssues(graph: CausalGraph, universe: CausalUniverseSource): string[] {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodesBySubject = new Map(graph.nodes.map((node) => [node.subjectId, node]));
  return [...expectedSummaries(universe).flatMap((expected) => {
    const node = nodesBySubject.get(expected.subjectId);
    if (!node) return [`缺少统计主题 ${expected.subjectId}`];
    const actualCauses = new Set<string>(node.directCauseIds.flatMap((id) => {
      const subjectId = nodesById.get(id)?.subjectId;
      return subjectId ? [subjectId] : [];
    }));
    const expectedCauses = new Set(expected.causeSubjects);
    const missing = expected.causeSubjects.filter((subjectId) => !actualCauses.has(subjectId));
    const extra = [...actualCauses].filter((subjectId) => !expectedCauses.has(subjectId));
    return [
      ...(node.description === expected.description ? [] : [`统计主题 ${expected.subjectId} 的描述与当前集合不一致`]),
      ...missing.map((subjectId) => `统计主题 ${expected.subjectId} 缺少证据 ${subjectId}`),
      ...extra.map((subjectId) => `统计主题 ${expected.subjectId} 包含无关证据 ${subjectId}`),
    ];
  }), ...deepSummaryEvidenceIssues(graph, universe)];
}

export function assertSummaryCollectionEvidence(graph: CausalGraph, universe: CausalUniverseSource): void {
  const issues = summaryCollectionEvidenceIssues(graph, universe);
  if (issues.length > 0) throw new Error(`聚合统计因果证据不完整：${issues.join("；")}`);
}

function expectedSummaries(universe: CausalUniverseSource): ExpectedSummary[] {
  const systems = universe.galaxies.flatMap((galaxy) => galaxy.starSystems);
  const planets = systems.flatMap((system) => system.planets);
  const civilizations = universe.civilizations;
  const fallback = civilizations.length > 0 ? [] : ["metric.civilizationPotential"];
  return [
    {
      subjectId: "space.stats.galaxies",
      description: `星系 ${universe.galaxies.length}。`,
      causeSubjects: ["axiom:space-generation", "galaxies.count", ...universe.galaxies.map((galaxy) => galaxy.id)],
    },
    {
      subjectId: "space.stats.systems",
      description: `恒星系 ${systems.length}。`,
      causeSubjects: ["axiom:space-generation", ...universe.galaxies.map((galaxy) => galaxy.id), ...systems.map((system) => system.id)],
    },
    {
      subjectId: "space.stats.planets",
      description: `行星 ${planets.length}。`,
      causeSubjects: ["axiom:space-generation", ...systems.map((system) => system.id), ...planets.map((planet) => planet.id)],
    },
    {
      subjectId: "space.stats.biospheres",
      description: `生物圈 ${planets.filter((planet) => planet.biosphere).length}。`,
      causeSubjects: ["axiom:biosphere-generation", ...planets.map((planet) => planet.biosphere ? `${planet.id}.biosphere` : `${planet.id}.biosphere.absent`)],
    },
    {
      subjectId: "space.stats.civilizationSeeds",
      description: `文明候选 ${planets.filter((planet) => planet.biosphere?.civilizationSeed).length}。`,
      causeSubjects: ["axiom:civilization-generation", ...planets.map((planet) => planet.biosphere?.civilizationSeed
        ? `${planet.id}.civilization-seed`
        : planet.biosphere ? `${planet.id}.civilization-seed.absent` : `${planet.id}.biosphere.absent`)],
    },
    {
      subjectId: "civilization.stats.total",
      description: `文明 ${civilizations.length}。`,
      causeSubjects: ["axiom:civilization-generation", ...fallback, ...civilizations.map((entry) => entry.id)],
    },
    {
      subjectId: "civilization.stats.paths",
      description: `路径 ${new Set(civilizations.map((entry) => entry.path)).size}。`,
      causeSubjects: ["axiom:summary-grouping", ...fallback, ...[...new Set(civilizations.map((entry) => entry.path))].sort().map((path) => `civilization.stats.paths.group.${path}`)],
    },
    {
      subjectId: "civilization.stats.mythologies",
      description: `神话 ${new Set(civilizations.map((entry) => entry.mythology.type)).size}。`,
      causeSubjects: ["axiom:summary-grouping", ...fallback, ...[...new Set(civilizations.map((entry) => entry.mythology.type))].sort().map((type) => `civilization.stats.mythologies.group.${type}`)],
    },
    {
      subjectId: "civilization.stats.highRisk",
      description: `高风险 ${civilizations.filter((entry) => entry.extinctionRisk >= 65).length}，判定阈值为灭绝风险不低于 65。`,
      causeSubjects: ["axiom:summary-filtering", ...fallback, ...civilizations.map((entry) => `civilization.stats.highRisk.member.${entry.id}`)],
    },
  ];
}
