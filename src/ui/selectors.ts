import type { MetricInfluence, UniverseSummary } from "../sim";
import { civilizationPathName, interactionKindName, metricName, mythologyTypeName } from "./labels";

export type SpaceStats = {
  galaxyCount: number;
  systemCount: number;
  planetCount: number;
  biosphereCount: number;
  civilizationSeedCount: number;
};

export type CivilizationStats = {
  civilizationCount: number;
  pathCount: number;
  mythologyCount: number;
  highRiskCount: number;
};

export function summarizeSpace(universe: UniverseSummary): SpaceStats {
  const systems = universe.galaxies.flatMap((galaxy) => galaxy.starSystems);
  const planets = systems.flatMap((system) => system.planets);
  const biospheres = planets.flatMap((planet) => (planet.biosphere ? [planet.biosphere] : []));

  return {
    galaxyCount: universe.galaxies.length,
    systemCount: systems.length,
    planetCount: planets.length,
    biosphereCount: biospheres.length,
    civilizationSeedCount: biospheres.filter((biosphere) => biosphere.civilizationSeed).length,
  };
}

export function buildSourceLabelMap(universe: UniverseSummary): Map<string, string> {
  const lawEntries = Object.values(universe.laws).flatMap((domain) => domain.rules.map((rule) => [rule.id, `${rule.name}（${rule.value}）`] as const));
  const interactionEntries = universe.lawInteractions.map((interaction) => [interaction.id, interactionKindName(interaction.kind)] as const);
  const metricEntries = Object.keys(universe.metrics).map((metricId) => [`metric.${metricId}`, metricName(metricId)] as const);
  const eventEntries = universe.timeline.map((event) => [event.id, event.title] as const);
  const miracleEntries = [
    ["miracle.interventions", "阶段 6 造物主干预"] as const,
    ["miracle-overuse", "奇迹过度使用"] as const,
    ...universe.miracleState.appliedMiracles.map((miracle) => [miracle.id, miracle.title] as const),
  ];
  const civilizationEntries = universe.civilizations.flatMap((civilization) => [
    [civilization.id, civilization.name] as const,
    ...civilization.historyEvents.map((event) => [event.id, event.title] as const),
  ]);

  return new Map([...lawEntries, ...interactionEntries, ...metricEntries, ...eventEntries, ...miracleEntries, ...civilizationEntries]);
}

export function topInfluences(influences: MetricInfluence[]): MetricInfluence[] {
  return [...influences].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta)).slice(0, 2);
}

export function summarizeCivilizations(universe: UniverseSummary): CivilizationStats {
  return {
    civilizationCount: universe.civilizations.length,
    pathCount: new Set(universe.civilizations.map((civilization) => civilization.path)).size,
    mythologyCount: new Set(universe.civilizations.map((civilization) => civilization.mythology.type)).size,
    highRiskCount: universe.civilizations.filter((civilization) => civilization.extinctionRisk >= 65).length,
  };
}

export function civilizationSignature(universe: UniverseSummary): string {
  return universe.civilizations
    .map((civilization) => `${civilization.name}｜${civilizationPathName(civilization.path)}｜${mythologyTypeName(civilization.mythology.type)}｜${civilization.fate}`)
    .join(" / ");
}
