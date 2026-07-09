import type { MetricInfluence, UniverseSummary } from "../sim";
import { interactionKindName, metricName } from "./labels";

export type SpaceStats = {
  galaxyCount: number;
  systemCount: number;
  planetCount: number;
  biosphereCount: number;
  civilizationSeedCount: number;
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

  return new Map([...lawEntries, ...interactionEntries, ...metricEntries, ...eventEntries]);
}

export function topInfluences(influences: MetricInfluence[]): MetricInfluence[] {
  return [...influences].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta)).slice(0, 2);
}
