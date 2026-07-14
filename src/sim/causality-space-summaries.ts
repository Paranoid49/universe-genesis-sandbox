import { add, derived } from "./causality-builder";
import { AXIOMS, type CausalMappingContext } from "./causality-model";

function addStatistic(context: CausalMappingContext, subjectId: string, label: string, description: string, causes: string[], ruleId: string): string {
  const nodeId = `collection-boundary:${subjectId}`;
  add(context.builder, context.subjects, derived(nodeId, subjectId, "collection_boundary", label, description, causes, [ruleId]));
  return nodeId;
}

export function addSpaceCollectionSummaries(context: CausalMappingContext): void {
  const { universe } = context;
  const systems = universe.galaxies.flatMap((galaxy) => galaxy.starSystems);
  const planets = systems.flatMap((system) => system.planets);
  const galaxies = addStatistic(context, "space.stats.galaxies", "星系统计", `星系 ${universe.galaxies.length}。`, [
    "collection-boundary:galaxies", ...universe.galaxies.map((galaxy) => `galaxy:${galaxy.id}`),
  ], AXIOMS.spaceGeneration);
  const systemCount = addStatistic(context, "space.stats.systems", "恒星系统计", `恒星系 ${systems.length}。`, [
    ...universe.galaxies.map((galaxy) => `galaxy:${galaxy.id}`), ...systems.map((system) => `star-system:${system.id}`),
  ], AXIOMS.spaceGeneration);
  const planetCount = addStatistic(context, "space.stats.planets", "行星统计", `行星 ${planets.length}。`, [
    ...systems.map((system) => `star-system:${system.id}`), ...planets.map((planet) => `planet:${planet.id}`),
  ], AXIOMS.spaceGeneration);
  const biospheres = addStatistic(context, "space.stats.biospheres", "生物圈统计", `生物圈 ${planets.filter((planet) => planet.biosphere).length}。`,
    planets.map((planet) => planet.biosphere ? `biosphere:${planet.id}` : `biosphere-absence:${planet.id}`), AXIOMS.biosphereGeneration);
  const seeds = addStatistic(context, "space.stats.civilizationSeeds", "文明候选统计", `文明候选 ${planets.filter((planet) => planet.biosphere?.civilizationSeed).length}。`,
    planets.map((planet) => planet.biosphere?.civilizationSeed ? `civilization-seed:${planet.id}`
      : planet.biosphere ? `civilization-seed-absence:${planet.id}` : `biosphere-absence:${planet.id}`), AXIOMS.civilizationGeneration);
  addStatistic(context, "space.stats", "空间统计", "空间统计由五项独立集合证据组成。",
    [galaxies, systemCount, planetCount, biospheres, seeds], AXIOMS.spaceGeneration);
}
