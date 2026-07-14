import type { Civilization, Galaxy, Planet, StarSystem, UniverseSummary } from "../sim";
import type { CausalProjectionSpec } from "../sim";
import type { ObservationNode, ObservationOverlay, ObservationProjection } from "./observationProjection";
import { causalNodeIdsForSubjects, requireCausalSubjectNode, uniqueSubjectIds } from "./causalProjectionSources";

export type ObservationTraceAspect = "summary" | "geometry" | ObservationOverlay | "related-events";

export const observationTraceOptions: ReadonlyArray<{ id: ObservationTraceAspect; label: string }> = [
  { id: "summary", label: "查看摘要原因" },
  { id: "geometry", label: "查看几何原因" },
  { id: "life", label: "查看生命强度原因" },
  { id: "civilization", label: "查看文明强度原因" },
  { id: "magic", label: "查看魔法强度原因" },
  { id: "divinity", label: "查看神性强度原因" },
  { id: "causality", label: "查看因果强度原因" },
  { id: "related-events", label: "查看事件关联原因" },
];

type SpatialContext = {
  galaxy?: Galaxy;
  system?: StarSystem;
  planet?: Planet;
  regionalPlanets: Planet[];
  civilizations: Civilization[];
};

export function buildObservationCausalProjection(
  universe: UniverseSummary,
  projection: ObservationProjection,
  node: ObservationNode,
  aspect: ObservationTraceAspect,
): CausalProjectionSpec {
  const context = findSpatialContext(universe, node);
  const sourceSubjects = observationSourceSubjects(universe, projection, node, aspect, context);
  const causeNodeIds = causalNodeIdsForSubjects(universe.causalGraph, sourceSubjects);
  const baseNodeId = requireCausalSubjectNode(universe.causalGraph, node.id);
  const ruleNodeId = requireCausalSubjectNode(universe.causalGraph, "axiom:observation-projection");
  return {
    id: `observation:${projection.level}:${node.id}:${aspect}`,
    subjectId: `observation.${projection.level}.${node.id}.${aspect}`,
    kind: "observation",
    label: observationLabel(node, aspect),
    description: observationDescription(universe, projection, node, aspect),
    causeNodeIds: [...new Set([baseNodeId, ...causeNodeIds])],
    ruleNodeId,
  };
}

function observationSourceSubjects(
  universe: UniverseSummary,
  projection: ObservationProjection,
  node: ObservationNode,
  aspect: ObservationTraceAspect,
  context: SpatialContext,
): string[] {
  const base = [node.id];
  if (aspect === "summary") return uniqueSubjectIds([...base, ...levelObjectSubjects(universe, projection, context)]);
  if (aspect === "geometry") return uniqueSubjectIds([...base, ...projection.nodes.map((item) => item.id)]);
  if (aspect !== "related-events") return uniqueSubjectIds([...base, ...node.intensitySourceSubjects[aspect]]);
  return uniqueSubjectIds([...base, ...universe.timeline.map((event) => event.id)]);
}

function findSpatialContext(universe: UniverseSummary, node: ObservationNode): SpatialContext {
  for (const galaxy of universe.galaxies) {
    if (node.kind === "galaxy" && galaxy.id === node.id) {
      return regionalContext(universe, node, galaxy);
    }
    for (const system of galaxy.starSystems) {
      if (node.kind === "system" && system.id === node.id) {
        return regionalContext(universe, node, galaxy, system);
      }
      const planet = system.planets.find((candidate) => candidate.id === node.id);
      if (node.kind === "planet" && planet) {
        return regionalContext(universe, node, galaxy, system, planet);
      }
    }
  }
  throw new Error(`无法定位观察节点：${node.id}`);
}

function regionalContext(
  universe: UniverseSummary,
  node: ObservationNode,
  galaxy: Galaxy,
  system?: StarSystem,
  planet?: Planet,
): SpatialContext {
  const regionalPlanets = planet ? [planet] : system ? system.planets : galaxy.starSystems.flatMap((item) => item.planets);
  const civilizations = universe.civilizations.filter((civilization) => node.kind === "galaxy"
    ? civilization.originGalaxyId === galaxy.id
    : node.kind === "system"
      ? civilization.originStarSystemId === system?.id
      : civilization.originPlanetId === planet?.id);
  return { galaxy, system, planet, regionalPlanets, civilizations };
}

function levelObjectSubjects(universe: UniverseSummary, projection: ObservationProjection, context: SpatialContext): string[] {
  if (projection.level === "universe") return universe.galaxies.map((galaxy) => galaxy.id);
  if (projection.level === "galaxy") return context.galaxy?.starSystems.map((system) => system.id) ?? [];
  return context.system?.planets.map((planet) => planet.id) ?? [];
}

function observationLabel(node: ObservationNode, aspect: ObservationTraceAspect): string {
  const labels: Record<ObservationTraceAspect, string> = {
    summary: "观察摘要",
    geometry: "观察几何",
    life: "生命强度",
    civilization: "文明强度",
    magic: "魔法强度",
    divinity: "神性强度",
    causality: "因果强度",
    "related-events": "事件关联",
  };
  return `${labels[aspect]}：${node.label}`;
}

function observationDescription(
  universe: UniverseSummary,
  projection: ObservationProjection,
  node: ObservationNode,
  aspect: ObservationTraceAspect,
): string {
  if (aspect === "summary") return `当前层级文字摘要：${projection.textualSummary} 当前节点摘要：${node.detail}`;
  if (aspect === "geometry") {
    return `投影坐标 x=${formatNumber(node.x)}、y=${formatNumber(node.y)}；尺寸 ${formatNumber(node.size)}；亮度 ${formatNumber(node.brightness)}。`;
  }
  if (aspect === "related-events") {
    return `从全部 ${universe.timeline.length} 条时间线事件候选中筛得 ${node.relatedEventIds.length} 条关联：${node.relatedEventIds.join("、") || "无"}。`;
  }
  const labels: Record<ObservationOverlay, string> = {
    life: "生命",
    civilization: "文明",
    magic: "魔法",
    divinity: "神性",
    causality: "因果",
  };
  return `${labels[aspect]}强度为 ${node.intensity[aspect]} / 100，由登记的区域操作数和观察规则计算。`;
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(2)));
}
