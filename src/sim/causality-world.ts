import { add, compact, domainObjectNode, randomRefs, unique } from "./causality-builder";
import { AXIOMS, type CausalMappingContext } from "./causality-model";
import {
  addBiosphereAbsence,
  addCivilizationSeedAbsence,
  addCivilizationHistoryBoundary,
  addGalaxyCollectionBoundary,
} from "./causality-collections";
import { addCivilizationCollectionSummaries, addSpaceCollectionSummaries } from "./causality-summary-collections";

export function addSpace(context: CausalMappingContext): void {
  const { builder, subjects, universe, trace } = context;
  const galaxyBoundaryId = addGalaxyCollectionBoundary(context);
  universe.galaxies.forEach((galaxy, galaxyIndex) => {
    const galaxyPrefix = `root.galaxies.galaxy.${galaxyIndex + 1}`;
    const galaxyNodeId = `galaxy:${galaxy.id}`;
    add(builder, subjects, domainObjectNode(
      builder,
      galaxyNodeId,
      galaxy.id,
      "galaxy",
      galaxy.name,
      `类型 ${galaxy.type}，质量 ${galaxy.mass}。`,
      galaxy.sourceEventIds,
      galaxy.sourceRuleIds,
      subjects,
      [
        galaxyBoundaryId,
        "timeline-impact:summary",
        `template:${universe.templateId}`,
        "metric:lifePotential",
        "metric:magicIntensity",
        "metric:divineActivity",
        "metric:causalityIntegrity",
      ],
      AXIOMS.spaceGeneration,
      randomRefs(trace, [galaxyPrefix], `生成星系“${galaxy.name}”`),
    ));
    galaxy.starSystems.forEach((system, systemIndex) => {
      const systemPrefix = `${galaxyPrefix}.system.${systemIndex + 1}`;
      const systemNodeId = `star-system:${system.id}`;
      add(builder, subjects, domainObjectNode(
        builder,
        systemNodeId,
        system.id,
        "star_system",
        system.name,
        `${system.type}，恒星类型 ${system.starClass}。`,
        system.sourceEventIds,
        system.sourceRuleIds,
        subjects,
        [galaxyNodeId, "timeline-impact:summary", "metric:stability", "metric:causalityIntegrity"],
        AXIOMS.spaceGeneration,
        randomRefs(trace, [systemPrefix], `生成恒星系“${system.name}”`),
      ));
      system.planets.forEach((planet, planetIndex) => {
        const planetPrefix = `${systemPrefix}.planet.${planetIndex + 1}`;
        const planetNodeId = `planet:${planet.id}`;
        add(builder, subjects, domainObjectNode(
          builder,
          planetNodeId,
          planet.id,
          "planet",
          planet.name,
          `${planet.type} 行星，宜居性 ${planet.habitability}。`,
          planet.sourceEventIds,
          planet.sourceRuleIds,
          subjects,
          [systemNodeId, "timeline-impact:summary", "metric:lifePotential", "metric:magicIntensity", "metric:stability"],
          AXIOMS.spaceGeneration,
          randomRefs(trace, [planetPrefix], `生成行星“${planet.name}”`),
        ));
        addBiosphere(context, planet, planetNodeId, planetPrefix);
      });
    });
  });
  addSpaceCollectionSummaries(context);
}

function addBiosphere(
  context: CausalMappingContext,
  planet: CausalMappingContext["universe"]["galaxies"][number]["starSystems"][number]["planets"][number],
  planetNodeId: string,
  planetPrefix: string,
): void {
  const { builder, subjects, trace } = context;
  if (!planet.biosphere) {
    addBiosphereAbsence(context, planet, planetNodeId, planetPrefix);
    return;
  }
  const biosphereNodeId = `biosphere:${planet.id}`;
  add(builder, subjects, domainObjectNode(
    builder,
    biosphereNodeId,
    `${planet.id}.biosphere`,
    "biosphere",
    `${planet.name}生物圈`,
    `${planet.biosphere.level}，主导形态为${planet.biosphere.dominantForm}。`,
    planet.biosphere.sourceEventIds,
    planet.biosphere.sourceRuleIds,
    subjects,
    [planetNodeId, "timeline-impact:summary", "metric:lifePotential", "metric:magicIntensity"],
    AXIOMS.biosphereGeneration,
    randomRefs(trace, [`${planetPrefix}.biosphere`], `生成${planet.name}生物圈`),
  ), [`biosphere-for:${planet.id}`]);
  if (!planet.biosphere.civilizationSeed) {
    addCivilizationSeedAbsence(context, planet, biosphereNodeId, planetNodeId, planetPrefix);
    return;
  }
  const seed = planet.biosphere.civilizationSeed;
  const seedNodeId = `civilization-seed:${planet.id}`;
  add(builder, subjects, domainObjectNode(
    builder,
    seedNodeId,
    `${planet.id}.civilization-seed`,
    "civilization_seed",
    `${planet.name}文明种子`,
    `${seed.speciesType}，技术 ${seed.technologyLevel}，魔法 ${seed.magicLevel}。`,
    seed.sourceEventIds,
    seed.sourceRuleIds,
    subjects,
    [biosphereNodeId, "metric:civilizationPotential", "metric:divineActivity", "timeline-impact:summary"],
    AXIOMS.civilizationGeneration,
    randomRefs(trace, [`${planetPrefix}.biosphere.civilization-seed`], `生成${planet.name}文明种子`),
  ), [`civilization-seed-for:${planet.id}`]);
}

export function addCivilizations(context: CausalMappingContext): void {
  const { builder, subjects, universe, trace } = context;
  for (const civilization of universe.civilizations) {
    const prefix = `root.civilizations.civilization.${civilization.originPlanetId}`;
    const civilizationNodeId = `civilization:${civilization.id}`;
    add(builder, subjects, domainObjectNode(
      builder,
      civilizationNodeId,
      civilization.id,
      "civilization",
      civilization.name,
      `${civilization.speciesType}文明，发展路径 ${civilization.path}，命运 ${civilization.fate}。`,
      civilization.sourceEventIds,
      civilization.sourceRuleIds,
      subjects,
      compact([
        `civilization-seed:${civilization.originPlanetId}`,
        `planet:${civilization.originPlanetId}`,
        "metric:civilizationPotential",
        "metric:stability",
        "metric:causalityIntegrity",
        "timeline-impact:summary",
      ]),
      AXIOMS.civilizationGeneration,
      randomRefs(trace, [prefix], `生成文明“${civilization.name}”`),
    ));
    const mythology = civilization.mythology;
    const mythologyNodeId = `mythology:${civilization.id}`;
    add(builder, subjects, domainObjectNode(
      builder,
      mythologyNodeId,
      `${civilization.id}.mythology`,
      "mythology",
      mythology.deityName || `${civilization.name}神话体系`,
      mythology.explanation,
      mythology.sourceEventIds,
      mythology.sourceRuleIds,
      subjects,
      [civilizationNodeId, "metric:divineActivity", "metric:magicIntensity", "metric:civilizationPotential"],
      AXIOMS.mythologyGeneration,
      randomRefs(trace, [`${prefix}.mythology`], `生成${civilization.name}神话体系`),
    ));
    const historyBoundaryId = addCivilizationHistoryBoundary(context, civilization, civilizationNodeId, prefix);
    for (const historyEvent of civilization.historyEvents) {
      add(builder, subjects, domainObjectNode(
        builder,
        `civilization-event:${historyEvent.id}`,
        historyEvent.id,
        "civilization_event",
        historyEvent.title,
        historyEvent.description,
        historyEvent.sourceEventIds,
        historyEvent.sourceRuleIds,
        subjects,
        unique([civilizationNodeId, historyBoundaryId, ...historyEvent.triggeredByCivilizationEventIds.map((id) => `civilization-event:${id}`)]),
        AXIOMS.civilizationGeneration,
        randomRefs(trace, [`${prefix}.history`], `生成文明事件“${historyEvent.title}”`, [`civilization-event:${historyEvent.id}`]),
        false,
      ));
    }
  }
  addCivilizationCollectionSummaries(context);
}
