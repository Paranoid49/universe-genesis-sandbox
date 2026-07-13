import type { Civilization, Galaxy, Planet, StarSystem, UniverseSummary } from "../sim";
import { galaxyTypeName, orbitZoneName, planetTypeName, starSystemTypeName } from "./labels";

export type ObservationLevel = "universe" | "galaxy" | "system";
export type ObservationOverlay = "life" | "civilization" | "magic" | "divinity" | "causality";
export type ObservationNodeKind = "galaxy" | "system" | "planet";

export type ObservationNode = {
  id: string;
  parentId?: string;
  kind: ObservationNodeKind;
  label: string;
  detail: string;
  x: number;
  y: number;
  size: number;
  brightness: number;
  intensity: Record<ObservationOverlay, number>;
  relatedEventIds: string[];
};

export type ObservationProjection = {
  level: ObservationLevel;
  title: string;
  nodes: ObservationNode[];
  breadcrumbs: Array<{ id: string; label: string; level: ObservationLevel }>;
  textualSummary: string;
};

export const observationOverlayOptions: Array<{ id: ObservationOverlay; label: string; description: string }> = [
  { id: "life", label: "生命", description: "宜居度、生物圈与生命潜力" },
  { id: "civilization", label: "文明", description: "文明存在、技术与扩张能力" },
  { id: "magic", label: "魔法", description: "魔法通量、饱和度与文明魔法" },
  { id: "divinity", label: "神性", description: "神性残留、信仰与神话影响" },
  { id: "causality", label: "因果", description: "因果危险、异常与完整度风险" },
];

export function observationHaloRadius(node: ObservationNode, overlay: ObservationOverlay): number {
  return node.size + 1.5 + node.intensity[overlay] / 35;
}

export function buildObservationProjection(
  universe: UniverseSummary,
  level: ObservationLevel,
  galaxyId?: string,
  systemId?: string,
): ObservationProjection {
  if (level === "universe") return universeProjection(universe);
  const galaxy = universe.galaxies.find((item) => item.id === galaxyId) ?? universe.galaxies[0];
  if (!galaxyId || !galaxy || galaxy.id !== galaxyId) return emptyProjection("无法定位星系", "指定的星系 ID 无效或已过期。", level);
  if (level === "galaxy") return galaxyProjection(universe, galaxy);
  const system = galaxy.starSystems.find((item) => item.id === systemId);
  return systemId && system
    ? systemProjection(universe, galaxy, system)
    : emptyProjection("无法定位恒星系", "指定的恒星系 ID 无效、已过期或不属于当前星系。", level);
}

function universeProjection(universe: UniverseSummary): ObservationProjection {
  const limit = 48;
  const nodes = distributeNodes(universe.galaxies.slice(0, limit).map((galaxy) => galaxyNode(universe, galaxy)));
  return {
    level: "universe",
    title: `${universe.name} · 宇宙层`,
    nodes,
    breadcrumbs: [{ id: universe.seed, label: universe.name, level: "universe" }],
    textualSummary: projectionSummary(universe.galaxies.length, nodes.length, "个代表性星系", "选择节点可进入星系层。"),
  };
}

function galaxyProjection(universe: UniverseSummary, galaxy: Galaxy): ObservationProjection {
  const limit = 64;
  const nodes = distributeNodes(galaxy.starSystems.slice(0, limit).map((system) => systemNode(universe, galaxy, system)));
  return {
    level: "galaxy",
    title: `${galaxy.name} · 星系层`,
    nodes,
    breadcrumbs: [
      { id: universe.seed, label: universe.name, level: "universe" },
      { id: galaxy.id, label: galaxy.name, level: "galaxy" },
    ],
    textualSummary: projectionSummary(galaxy.starSystems.length, nodes.length, "个恒星系", "选择节点可进入恒星系层。"),
  };
}

function systemProjection(universe: UniverseSummary, galaxy: Galaxy, system: StarSystem): ObservationProjection {
  const limit = 32;
  const nodes = distributeNodes(system.planets.slice(0, limit).map((planet) => planetNode(universe, galaxy, system, planet)));
  return {
    level: "system",
    title: `${system.name} · 恒星系层`,
    nodes,
    breadcrumbs: [
      { id: universe.seed, label: universe.name, level: "universe" },
      { id: galaxy.id, label: galaxy.name, level: "galaxy" },
      { id: system.id, label: system.name, level: "system" },
    ],
    textualSummary: projectionSummary(system.planets.length, nodes.length, "颗行星", "选择节点可查看结构化详情。"),
  };
}

function galaxyNode(universe: UniverseSummary, galaxy: Galaxy): ObservationNode {
  const civilizations = universe.civilizations.filter((item) => item.originGalaxyId === galaxy.id);
  const planets = galaxy.starSystems.flatMap((system) => system.planets);
  return createNode(galaxy.id, undefined, "galaxy", galaxy.name, `${galaxyTypeName(galaxy.type)} · ${galaxy.starSystems.length} 个恒星系`, galaxy.mass, galaxy.metallicity, {
    life: clamp(average(planets.map((planet) => lifeValue(planet))) * 0.75 + universe.metrics.lifePotential.value * 0.25),
    civilization: civilizationValue(civilizations),
    magic: clamp(galaxy.magicFlux * 0.65 + average(civilizations.map((item) => item.magicLevel)) * 0.35),
    divinity: clamp(galaxy.divineResidue * 0.55 + average(civilizations.map(divinityValue)) * 0.45),
    causality: causalityValue(universe, galaxy.causalHazard),
  }, universe, galaxy.sourceEventIds);
}

function systemNode(universe: UniverseSummary, galaxy: Galaxy, system: StarSystem): ObservationNode {
  const civilizations = universe.civilizations.filter((item) => item.originStarSystemId === system.id);
  return createNode(system.id, galaxy.id, "system", system.name, `${starSystemTypeName(system.type)} · ${system.starClass} · ${system.planets.length} 颗行星`, system.luminosity, system.stability, {
    life: clamp(average(system.planets.map((planet) => lifeValue(planet))) * 0.75 + universe.metrics.lifePotential.value * 0.25),
    civilization: civilizationValue(civilizations),
    magic: clamp(galaxy.magicFlux * 0.25 + average(system.planets.map((planet) => planet.magicSaturation)) * 0.45 + average(civilizations.map((item) => item.magicLevel)) * 0.3),
    divinity: clamp(galaxy.divineResidue * 0.4 + average(civilizations.map(divinityValue)) * 0.6),
    causality: causalityValue(universe, galaxy.causalHazard * 0.45 + system.anomalyLevel * 0.55),
  }, universe, system.sourceEventIds);
}

function planetNode(universe: UniverseSummary, galaxy: Galaxy, system: StarSystem, planet: Planet): ObservationNode {
  const civilizations = universe.civilizations.filter((item) => item.originPlanetId === planet.id);
  return createNode(planet.id, system.id, "planet", planet.name, `${planetTypeName(planet.type)} · ${orbitZoneName(planet.orbitZone)}轨道`, clamp(planet.habitability * 0.7 + planetTypeSize(planet) * 0.3), planet.stability, {
    life: clamp(lifeValue(planet) * 0.75 + universe.metrics.lifePotential.value * 0.25),
    civilization: civilizationValue(civilizations),
    magic: clamp(planet.magicSaturation * 0.65 + average(civilizations.map((item) => item.magicLevel)) * 0.35),
    divinity: clamp(galaxy.divineResidue * 0.25 + average(civilizations.map(divinityValue)) * 0.75),
    causality: causalityValue(universe, galaxy.causalHazard * 0.35 + system.anomalyLevel * 0.4 + (100 - planet.stability) * 0.25),
  }, universe, planet.sourceEventIds);
}

function createNode(
  id: string,
  parentId: string | undefined,
  kind: ObservationNodeKind,
  label: string,
  detail: string,
  sizeSource: number,
  brightnessSource: number,
  intensity: Record<ObservationOverlay, number>,
  universe: UniverseSummary,
  sourceIds: string[],
): ObservationNode {
  const x = 10 + stableFraction(`${id}:x`) * 80;
  const y = 10 + stableFraction(`${id}:y`) * 80;
  return {
    id,
    parentId,
    kind,
    label,
    detail,
    x,
    y,
    size: 3.2 + clamp(sizeSource) / 36,
    brightness: clamp(brightnessSource),
    intensity: mapIntensity(intensity),
    relatedEventIds: universe.timeline.filter((event) => sourceIds.includes(event.id)
      || event.sourceIds.includes(id)
      || event.location.includes(label)).map((event) => event.id),
  };
}

function lifeValue(planet: Planet): number {
  return clamp(planet.habitability * 0.55 + (planet.biosphere?.complexity ?? 0) * 0.45);
}

function civilizationValue(civilizations: Civilization[]): number {
  return clamp(average(civilizations.map((item) => (item.technologyLevel + item.expansionDrive + item.stability) / 3)));
}

function divinityValue(civilization: Civilization): number {
  return (civilization.faithIntensity + civilization.mythology.influenceLevel) / 2;
}

function causalityValue(universe: UniverseSummary, localRisk: number): number {
  return clamp(localRisk * 0.7 + (100 - universe.metrics.causalityIntegrity.value) * 0.3);
}

function planetTypeSize(planet: Planet): number {
  const weights: Record<Planet["type"], number> = {
    rocky: 48, ocean: 52, desert: 46, ice: 44, gas_giant: 100,
    floating: 62, dream: 58, aether: 66, mechanical: 72,
  };
  return weights[planet.type];
}

function mapIntensity(values: Record<ObservationOverlay, number>): Record<ObservationOverlay, number> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, clamp(value)])) as Record<ObservationOverlay, number>;
}

function stableFraction(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function distributeNodes(nodes: ObservationNode[]): ObservationNode[] {
  if (nodes.length <= 1) return nodes.map((node) => ({ ...node, x: 50, y: 50 }));
  const columns = Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / columns);
  const horizontalStep = columns <= 1 ? 0 : 76 / (columns - 1);
  const verticalStep = rows <= 1 ? 0 : 72 / (rows - 1);
  const minimumStep = Math.min(
    horizontalStep || Number.POSITIVE_INFINITY,
    verticalStep || Number.POSITIVE_INFINITY,
  );
  return nodes.map((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const rowLength = Math.min(columns, nodes.length - row * columns);
    const rowOffset = (columns - rowLength) * horizontalStep / 2;
    const maximumHaloExpansion = 1.5 + Math.max(...Object.values(node.intensity)) / 35;
    const maximumCoreRadius = Math.max(0.35, minimumStep / 2 - maximumHaloExpansion - 0.45);
    return {
      ...node,
      size: Math.min(node.size, maximumCoreRadius),
      x: columns <= 1 ? 50 : 12 + column * horizontalStep + rowOffset,
      y: rows <= 1 ? 50 : 14 + row * verticalStep,
    };
  });
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function projectionSummary(total: number, visible: number, unit: string, action: string): string {
  return total > visible
    ? `共 ${total} ${unit}，当前展示前 ${visible} ${unit}。${action}`
    : `显示 ${visible} ${unit}，${action}`;
}

function emptyProjection(title: string, reason = "当前宇宙没有可投影的空间对象。", level: ObservationLevel = "universe"): ObservationProjection {
  return { level, title, nodes: [], breadcrumbs: [], textualSummary: reason };
}
