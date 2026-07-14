import type { CausalDomainLocator, CausalEntityKind, CausalNodeKind } from "./contracts/causality";
import type { CausalUniverseSource } from "./causality-source";

type DomainResultIndex = {
  laws: Map<string, CausalUniverseSource["laws"][keyof CausalUniverseSource["laws"]]["rules"][number]>;
  lawInteractions: Map<string, CausalUniverseSource["lawInteractions"][number]>;
  timelineEvents: Map<string, CausalUniverseSource["timeline"][number]>;
  galaxies: Map<string, CausalUniverseSource["galaxies"][number]>;
  starSystems: Map<string, CausalUniverseSource["galaxies"][number]["starSystems"][number]>;
  planets: Map<string, CausalUniverseSource["galaxies"][number]["starSystems"][number]["planets"][number]>;
  civilizations: Map<string, CausalUniverseSource["civilizations"][number]>;
  civilizationEvents: Map<string, CausalUniverseSource["civilizations"][number]["historyEvents"][number]>;
  interventions: Map<string, CausalUniverseSource["miracleState"]["appliedMiracles"][number]>;
};

const domainResultIndexes = new WeakMap<object, DomainResultIndex>();
type EntityLocation = readonly [containerKind: "field" | "collection_member", subjectSuffix?: string];

const entityLocations: Readonly<Record<CausalEntityKind, EntityLocation>> = Object.freeze({
  law: ["collection_member"],
  law_interaction: ["collection_member"],
  timeline_event: ["collection_member"],
  galaxy: ["collection_member"],
  star_system: ["collection_member"],
  planet: ["collection_member"],
  biosphere: ["field", ".biosphere"],
  civilization_seed: ["field", ".civilization-seed"],
  civilization: ["collection_member"],
  mythology: ["field", ".mythology"],
  civilization_event: ["collection_member"],
  intervention: ["collection_member"],
});

export function createDomainLocator(subjectId: string, kind: CausalNodeKind): CausalDomainLocator {
  if (kind === "universe_name") return { kind: "root_field", field: "name" };
  if (kind === "universe_tagline") return { kind: "root_field", field: "tagline" };
  if (kind === "universe_description") return { kind: "root_field", field: "description" };
  if (kind === "share_result") {
    const fields = { "share.code": "shareCode", "share.url": "shareUrl", "share.text": "shareText" } as const;
    const field = fields[subjectId as keyof typeof fields];
    if (field) return { kind: "root_field", field };
  }
  if (kind === "metric" && subjectId.startsWith("metric.")) {
    return { kind: "mapping_key", mapping: "metrics", key: subjectId.slice("metric.".length) };
  }
  if (kind === "law_domain") return { kind: "mapping_key", mapping: "laws", key: subjectId };
  if (kind === "collection_boundary") return collectionLocator(subjectId);
  if (kind === "negative_fact") return negativeFactLocator(subjectId);
  if (isEntityKind(kind)) {
    const [containerKind, subjectSuffix] = entityLocations[kind];
    return {
      kind: "entity_id",
      entityKind: kind,
      entityId: subjectSuffix ? stripSuffix(subjectId, subjectSuffix) : subjectId,
      containerKind,
    };
  }
  return locatorFailure();
}

export function domainLocatorsEqual(left: CausalDomainLocator, right: CausalDomainLocator): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function domainLocatorFingerprint(universe: CausalUniverseSource, locator: CausalDomainLocator): string {
  return `fnv1a32:${stableHash(JSON.stringify(resolveDomainLocator(universe, locator)))}`;
}

function collectionLocator(subjectId: string): CausalDomainLocator {
  if (subjectId === "timeline.base-count") return { kind: "collection_quantity", collection: "base_timeline" };
  if (subjectId === "timeline.count") return { kind: "collection_quantity", collection: "timeline" };
  if (subjectId === "galaxies.count") return { kind: "collection_quantity", collection: "galaxies" };
  const suffix = ".history.count";
  if (subjectId.endsWith(suffix)) {
    return { kind: "collection_quantity", collection: "civilization_history", ownerId: subjectId.slice(0, -suffix.length) };
  }
  return locatorFailure();
}

function negativeFactLocator(subjectId: string): CausalDomainLocator {
  const biosphereSuffix = ".biosphere.absent";
  if (subjectId.endsWith(biosphereSuffix)) {
    return { kind: "negative_fact", predicate: "biosphere_absent", entityId: subjectId.slice(0, -biosphereSuffix.length) };
  }
  const civilizationSuffix = ".civilization-seed.absent";
  if (subjectId.endsWith(civilizationSuffix)) {
    return { kind: "negative_fact", predicate: "civilization_seed_absent", entityId: subjectId.slice(0, -civilizationSuffix.length) };
  }
  return locatorFailure();
}

function isEntityKind(kind: CausalNodeKind): kind is CausalEntityKind {
  return Object.prototype.hasOwnProperty.call(entityLocations, kind);
}

function stripSuffix(subjectId: string, suffix: string): string {
  if (!subjectId.endsWith(suffix)) return locatorFailure();
  return subjectId.slice(0, -suffix.length);
}

function resolveDomainLocator(universe: CausalUniverseSource, locator: CausalDomainLocator): unknown {
  if (locator.kind === "root_field") return requireLocated(universe[locator.field], locator);
  if (locator.kind === "mapping_key") return resolveMapping(universe, locator);
  if (locator.kind === "collection_quantity") return resolveCollectionQuantity(universe, locator);
  if (locator.kind === "negative_fact") return resolveNegativeFact(universe, locator);
  return resolveEntity(universe, locator);
}

function resolveMapping(universe: CausalUniverseSource, locator: Extract<CausalDomainLocator, { kind: "mapping_key" }>): unknown {
  const mapping = universe[locator.mapping] as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(mapping, locator.key)) return locatorFailure();
  const value = mapping[locator.key];
  if (locator.mapping === "laws" && value && typeof value === "object") {
    const { rules: _rules, ...domainValue } = value as Record<string, unknown>;
    return domainValue;
  }
  return value;
}

function resolveCollectionQuantity(
  universe: CausalUniverseSource,
  locator: Extract<CausalDomainLocator, { kind: "collection_quantity" }>,
): number {
  if (locator.collection === "base_timeline") return universe.timeline.filter((event) => !event.id.startsWith("miracle")).length;
  if (locator.collection === "timeline") return universe.timeline.length;
  if (locator.collection === "galaxies") return universe.galaxies.length;
  const civilization = domainResultIndex(universe).civilizations.get(locator.ownerId ?? "");
  if (!civilization) return locatorFailure();
  return civilization.historyEvents.length;
}

function resolveNegativeFact(universe: CausalUniverseSource, locator: Extract<CausalDomainLocator, { kind: "negative_fact" }>): true {
  const planet = findPlanet(universe, locator.entityId);
  const established = locator.predicate === "biosphere_absent" ? planet.biosphere === undefined : planet.biosphere?.civilizationSeed === undefined;
  if (!established) return locatorFailure();
  return true;
}

function resolveEntity(universe: CausalUniverseSource, locator: Extract<CausalDomainLocator, { kind: "entity_id" }>): unknown {
  if (entityLocations[locator.entityKind][0] !== locator.containerKind) return locatorFailure();
  const index = domainResultIndex(universe);
  switch (locator.entityKind) {
    case "law": return requireLocated(index.laws.get(locator.entityId), locator);
    case "law_interaction": return requireLocated(index.lawInteractions.get(locator.entityId), locator);
    case "timeline_event": return requireLocated(index.timelineEvents.get(locator.entityId), locator);
    case "galaxy": {
      const { starSystems, ...galaxy } = requireLocated(index.galaxies.get(locator.entityId), locator);
      return { ...galaxy, starSystemIds: starSystems.map((entry) => entry.id) };
    }
    case "star_system": {
      const { planets, ...system } = requireLocated(index.starSystems.get(locator.entityId), locator);
      return { ...system, planetIds: planets.map((entry) => entry.id) };
    }
    case "planet": {
      const { biosphere, ...planet } = findPlanet(universe, locator.entityId);
      return { ...planet, biospherePresent: biosphere !== undefined };
    }
    case "biosphere": {
      const { civilizationSeed, ...biosphere } = requireLocated(findPlanet(universe, locator.entityId).biosphere, locator);
      return { ...biosphere, civilizationSeedPresent: civilizationSeed !== undefined };
    }
    case "civilization_seed": return requireLocated(findPlanet(universe, locator.entityId).biosphere?.civilizationSeed, locator);
    case "civilization": {
      const { mythology, historyEvents, ...civilization } = requireLocated(index.civilizations.get(locator.entityId), locator);
      return { ...civilization, mythologyType: mythology.type, historyEventIds: historyEvents.map((entry) => entry.id) };
    }
    case "mythology": return requireLocated(index.civilizations.get(locator.entityId)?.mythology, locator);
    case "civilization_event": return requireLocated(index.civilizationEvents.get(locator.entityId), locator);
    case "intervention": return requireLocated(index.interventions.get(locator.entityId), locator);
  }
}

function findPlanet(universe: CausalUniverseSource, planetId: string) {
  return requireLocated(domainResultIndex(universe).planets.get(planetId), {
    kind: "entity_id", entityKind: "planet", entityId: planetId, containerKind: "collection_member",
  } as const);
}

function domainResultIndex(universe: CausalUniverseSource): DomainResultIndex {
  const cached = domainResultIndexes.get(universe);
  if (cached) return cached;
  const starSystems = universe.galaxies.flatMap((galaxy) => galaxy.starSystems);
  const planets = starSystems.flatMap((system) => system.planets);
  const index: DomainResultIndex = {
    laws: new Map(Object.values(universe.laws).flatMap((domain) => domain.rules).map((entry) => [entry.id, entry])),
    lawInteractions: new Map(universe.lawInteractions.map((entry) => [entry.id, entry])),
    timelineEvents: new Map(universe.timeline.map((entry) => [entry.id, entry])),
    galaxies: new Map(universe.galaxies.map((entry) => [entry.id, entry])),
    starSystems: new Map(starSystems.map((entry) => [entry.id, entry])),
    planets: new Map(planets.map((entry) => [entry.id, entry])),
    civilizations: new Map(universe.civilizations.map((entry) => [entry.id, entry])),
    civilizationEvents: new Map(universe.civilizations.flatMap((entry) => entry.historyEvents).map((entry) => [entry.id, entry])),
    interventions: new Map(universe.miracleState.appliedMiracles.map((entry) => [entry.id, entry])),
  };
  domainResultIndexes.set(universe, index);
  return index;
}

function requireLocated<T>(value: T | undefined, _locator: CausalDomainLocator): T {
  if (value === undefined) return locatorFailure();
  return value;
}

function locatorFailure(): never {
  throw new Error("领域定位失败");
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
