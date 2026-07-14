import { add, derived, randomRefs } from "./causality-builder";
import { AXIOMS, type CausalMappingContext } from "./causality-model";

export function addTimelineBaseCollectionBoundary(context: CausalMappingContext): string {
  const { builder, subjects, universe, trace } = context;
  const nodeId = "collection-boundary:timeline-base";
  const baseCount = universe.timeline.filter((event) => !event.id.startsWith("miracle")).length;
  add(builder, subjects, derived(
    nodeId,
    "timeline.base-count",
    "collection_boundary",
    "基础时间线事件数量",
    `基础生成流程产生 ${baseCount} 个时间线事件。`,
    [`template:${universe.templateId}`, "initial-state:creation-origin", "metric:age"],
    [AXIOMS.timelineGeneration],
    randomRefs(trace, ["root.timeline"], "决定时间线事件数量", ["timeline:count"]),
  ));
  return nodeId;
}

export function addTimelineFinalCollectionBoundary(context: CausalMappingContext, baseBoundaryId: string): string {
  const { builder, subjects, universe } = context;
  const nodeId = "collection-boundary:timeline-final";
  const interventionEventIds = universe.timeline
    .filter((event) => event.id.startsWith("miracle"))
    .map((event) => `timeline-event:${event.id}`);
  add(builder, subjects, derived(
    nodeId,
    "timeline.count",
    "collection_boundary",
    "最终时间线事件数量",
    `基础事件与显式干预追加事件共同形成 ${universe.timeline.length} 个已物化事件。`,
    [baseBoundaryId, ...interventionEventIds],
    [AXIOMS.timelineGeneration],
  ));
  return nodeId;
}

export function addGalaxyCollectionBoundary(context: CausalMappingContext): string {
  const { builder, subjects, universe, trace } = context;
  const nodeId = "collection-boundary:galaxies";
  add(builder, subjects, derived(
    nodeId,
    "galaxies.count",
    "collection_boundary",
    "代表性星系数量",
    `本次运行生成 ${universe.galaxies.length} 个代表性星系。`,
    [`template:${universe.templateId}`, "timeline-impact:summary"],
    [AXIOMS.spaceGeneration],
    randomRefs(trace, ["root.galaxies"], "决定代表性星系数量"),
  ));
  return nodeId;
}

export function addBiosphereAbsence(
  context: CausalMappingContext,
  planet: CausalMappingContext["universe"]["galaxies"][number]["starSystems"][number]["planets"][number],
  planetNodeId: string,
  planetPrefix: string,
): void {
  const { builder, subjects, trace } = context;
  add(builder, subjects, derived(
    `biosphere-absence:${planet.id}`,
    `${planet.id}.biosphere.absent`,
    "negative_fact",
    `${planet.name}未形成生物圈`,
    "当前创世条件与确定性抽样没有达到生物圈形成阈值。",
    [planetNodeId, "timeline-impact:summary", "metric:lifePotential", "metric:magicIntensity"],
    [AXIOMS.biosphereGeneration],
    randomRefs(trace, [`${planetPrefix}.biosphere`], `判定${planet.name}未形成生物圈`, [
      `${planet.id}:biosphere-formation`,
    ]),
  ));
}

export function addCivilizationSeedAbsence(
  context: CausalMappingContext,
  planet: CausalMappingContext["universe"]["galaxies"][number]["starSystems"][number]["planets"][number],
  biosphereNodeId: string,
  planetNodeId: string,
  planetPrefix: string,
): void {
  const { builder, subjects, trace } = context;
  add(builder, subjects, derived(
    `civilization-seed-absence:${planet.id}`,
    `${planet.id}.civilization-seed.absent`,
    "negative_fact",
    `${planet.name}未形成文明候选`,
    `生物圈等级 ${planet.biosphere?.level ?? "未知"}，文明概率 ${planet.biosphere?.civilizationChance ?? 0}，未满足当前规则的文明候选门槛。`,
    [planetNodeId, biosphereNodeId, "metric:civilizationPotential", "metric:divineActivity", "timeline-impact:summary"],
    [AXIOMS.civilizationGeneration],
    randomRefs(trace, [`${planetPrefix}.biosphere`], `判定${planet.name}未形成文明候选`, [
      `${planet.id}:biosphere-formation`,
      `${planet.id}:civilization-chance`,
      `${planet.id}:magic-adaptation`,
    ]),
  ));
}

export function addCivilizationHistoryBoundary(
  context: CausalMappingContext,
  civilization: CausalMappingContext["universe"]["civilizations"][number],
  civilizationNodeId: string,
  prefix: string,
): string {
  const { builder, subjects, trace } = context;
  const nodeId = `collection-boundary:civilization-history:${civilization.id}`;
  add(builder, subjects, derived(
    nodeId,
    `${civilization.id}.history.count`,
    "collection_boundary",
    `${civilization.name}历史事件数量`,
    `本次运行生成 ${civilization.historyEvents.length} 个文明历史事件。`,
    [civilizationNodeId],
    [AXIOMS.civilizationGeneration],
    randomRefs(trace, [`${prefix}.history`], `决定${civilization.name}历史事件数量`, [
      `civilization:${civilization.id}:history-count`,
    ]),
  ));
  return nodeId;
}
