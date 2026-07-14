import { clamp, round, type RandomStream } from "./random";
import {
  biosphereForms,
  galaxyNameCores,
  galaxyTypeProfiles,
  planetNameCores,
  planetTypeProfiles,
  starClasses,
  starSystemNameCores,
  starSystemTypeProfiles,
  type GalaxyTypeProfile,
  type PlanetTypeProfile,
  type StarSystemTypeProfile,
} from "./content/space";
import type {
  Biosphere,
  BiosphereLevel,
  CivilizationFate,
  CivilizationSeed,
  Galaxy,
  LocalGenerationBiasId,
  Planet,
  PlanetType,
  SpeciesType,
  StarSystem,
  TimelineImpactSummary,
  UniverseLaws,
  UniverseMetrics,
} from "./types";

type SpaceGenerationContext = {
  laws: UniverseLaws;
  metrics: UniverseMetrics;
  timelineImpact: TimelineImpactSummary;
};

export function generateGalaxies(context: SpaceGenerationContext, rng: RandomStream): Galaxy[] {
  const galaxyDensity = biasValue(context.timelineImpact, "galaxyDensity");
  const count = round(clamp(10 + galaxyDensity / 18 + rng.int(0, 3), 12, 16));

  return Array.from({ length: count }, (_unused, index) => {
    const galaxyRng = rng.fork(`galaxy.${index + 1}`);
    return generateGalaxy(context, galaxyRng, index + 1);
  });
}

function generateGalaxy(context: SpaceGenerationContext, rng: RandomStream, index: number): Galaxy {
  const id = `gal-${String(index).padStart(2, "0")}`;
  const profile = rng.withScope(`${id}.type`, (scoped) => pickGalaxyProfile(context, scoped));
  const sourceEventIds = sourceEvents(context.timelineImpact, ["galaxyDensity", "magicAnomalyDensity", "divineRelicDensity", "causalHazardLevel"], 3);
  const sourceRuleIds = [strongestRuleId(context.laws.physics), strongestRuleId(context.laws.magic), strongestRuleId(context.laws.divinity)];
  const mass = round(clamp(48 + biasValue(context.timelineImpact, "galaxyDensity") * 0.35 + profile.massBias + rng.range(-12, 12)));
  const metallicity = round(clamp(42 + context.metrics.lifePotential.value * 0.18 + profile.metallicityBias + rng.range(-10, 10)));
  const magicFlux = round(clamp(context.metrics.magicIntensity.value * 0.55 + biasValue(context.timelineImpact, "magicAnomalyDensity") * 0.32 + profile.magicBias + rng.range(-9, 9)));
  const divineResidue = round(clamp(context.metrics.divineActivity.value * 0.55 + biasValue(context.timelineImpact, "divineRelicDensity") * 0.35 + profile.divineBias + rng.range(-8, 8)));
  const causalHazard = round(clamp((100 - context.metrics.causalityIntegrity.value) * 0.42 + biasValue(context.timelineImpact, "causalHazardLevel") * 0.45 + profile.hazardBias
    + rng.withScope(`${id}.causalHazard`, (scoped) => scoped.range(-8, 8))));
  const systemCount = round(clamp(3 + mass / 24 + rng.withScope(`${id}.starSystems.count`, (scoped) => scoped.int(0, 2)), 3, 8));
  const galaxy: Omit<Galaxy, "starSystems"> = {
    id,
    name: `${rng.pick(galaxyNameCores)}-${profile.label}`,
    type: profile.id,
    mass,
    metallicity,
    magicFlux,
    divineResidue,
    causalHazard,
    sourceEventIds,
    sourceRuleIds,
  };

  return {
    ...galaxy,
    starSystems: Array.from({ length: systemCount }, (_unused, systemIndex) =>
      generateStarSystem(context, galaxy, rng.fork(`system.${systemIndex + 1}`), systemIndex + 1),
    ),
  };
}

function generateStarSystem(context: SpaceGenerationContext, galaxy: Omit<Galaxy, "starSystems">, rng: RandomStream, index: number): StarSystem {
  const id = `${galaxy.id}-sys-${String(index).padStart(2, "0")}`;
  const profile = rng.withScope(`${id}.type`, (scoped) => pickStarSystemProfile(context, galaxy, scoped));
  const sourceEventIds = uniqueIds([...galaxy.sourceEventIds, ...sourceEvents(context.timelineImpact, ["stellarStability", "causalHazardLevel"], 2)]);
  const sourceRuleIds = uniqueIds([strongestRuleId(context.laws.physics), strongestRuleId(context.laws.causality), ...galaxy.sourceRuleIds]).slice(0, 4);
  const stability = round(clamp(context.metrics.stability.value * 0.45 + biasValue(context.timelineImpact, "stellarStability") * 0.45 + profile.stabilityBias - galaxy.causalHazard * 0.18 + rng.range(-10, 10)));
  const luminosity = round(clamp(44 + galaxy.mass * 0.25 + profile.luminosityBias
    + rng.withScope(`${id}.luminosity`, (scoped) => scoped.range(-12, 12))));
  const anomalyLevel = round(clamp(galaxy.magicFlux * 0.35 + galaxy.causalHazard * 0.35 + profile.anomalyBias + rng.range(-8, 8)));
  const planetCount = round(clamp(2 + stability / 26 + galaxy.metallicity / 35
    + rng.withScope(`${id}.planets.count`, (scoped) => scoped.int(0, 2)), 2, 6));
  const system: Omit<StarSystem, "planets"> = {
    id,
    name: `${rng.pick(starSystemNameCores)}-${profile.label}`,
    type: profile.id,
    starClass: pickStarClass(profile, rng),
    stability,
    luminosity,
    anomalyLevel,
    sourceEventIds,
    sourceRuleIds,
  };

  return {
    ...system,
    planets: Array.from({ length: planetCount }, (_unused, planetIndex) =>
      generatePlanet(context, galaxy, system, rng.fork(`planet.${planetIndex + 1}`), planetIndex + 1),
    ),
  };
}

function generatePlanet(
  context: SpaceGenerationContext,
  galaxy: Omit<Galaxy, "starSystems">,
  system: Omit<StarSystem, "planets">,
  rng: RandomStream,
  index: number,
): Planet {
  const id = `${system.id}-pl-${String(index).padStart(2, "0")}`;
  const profile = rng.withScope(`${id}.type`, (scoped) => pickPlanetProfile(context, system, scoped));
  const orbitZone = index === 1 ? "inner" : index <= 3 ? "habitable" : "outer";
  const orbitHabitability = orbitZone === "habitable" ? 12 : orbitZone === "inner" ? -8 : -10;
  const sourceEventIds = uniqueIds([...system.sourceEventIds, ...sourceEvents(context.timelineImpact, ["planetHabitability", "biosphereChance"], 2)]).slice(0, 4);
  const sourceRuleIds = uniqueIds([strongestRuleId(context.laws.life), strongestRuleId(context.laws.physics), ...system.sourceRuleIds]).slice(0, 4);
  const habitability = round(
    clamp(
      context.metrics.lifePotential.value * 0.35 +
        biasValue(context.timelineImpact, "planetHabitability") * 0.35 +
        system.stability * 0.22 +
        profile.habitabilityBias +
        orbitHabitability +
        rng.withScope(`${id}.habitability`, (scoped) => scoped.range(-12, 12)),
    ),
  );
  const magicSaturation = round(clamp(galaxy.magicFlux * 0.4 + system.anomalyLevel * 0.28 + profile.magicBias
    + rng.withScope(`${id}.magicSaturation`, (scoped) => scoped.range(-10, 10))));
  const atmosphere = round(clamp(42 + profile.atmosphereBias + system.stability * 0.12
    + rng.withScope(`${id}.atmosphere`, (scoped) => scoped.range(-18, 18))));
  const water = round(clamp(38 + profile.waterBias + biasValue(context.timelineImpact, "biosphereChance") * 0.18
    + rng.withScope(`${id}.water`, (scoped) => scoped.range(-18, 18))));
  const stability = round(clamp(system.stability * 0.62 + profile.stabilityBias - system.anomalyLevel * 0.18
    + rng.withScope(`${id}.stability`, (scoped) => scoped.range(-10, 10))));
  const planet: Planet = {
    id,
    name: `${rng.pick(planetNameCores)}-${profile.label}`,
    type: profile.id,
    orbitZone,
    habitability,
    magicSaturation,
    atmosphere,
    water,
    stability,
    sourceEventIds,
    sourceRuleIds,
  };
  const biosphere = generateBiosphere(context, planet, rng.fork("biosphere"));
  if (biosphere) {
    planet.biosphere = biosphere;
  }
  return planet;
}

function generateBiosphere(context: SpaceGenerationContext, planet: Planet, rng: RandomStream): Biosphere | undefined {
  const chance = round(
    clamp(
      planet.habitability * 0.46 +
        biasValue(context.timelineImpact, "biosphereChance") * 0.32 +
        context.metrics.lifePotential.value * 0.2 +
        planet.magicSaturation * 0.08 -
        Math.max(0, 35 - planet.stability) * 0.35 +
        rng.withScope(`${planet.id}:biosphere-formation`, (scoped) => scoped.range(-14, 14)),
    ),
  );
  if (chance < 42) {
    return undefined;
  }
  const civilizationChance = round(clamp(chance * 0.35
    + biasValue(context.timelineImpact, "civilizationSeedChance") * 0.45
    + context.metrics.civilizationPotential.value * 0.18
    + rng.withScope(`${planet.id}:civilization-chance`, (scoped) => scoped.range(-10, 10))));
  const magicAdaptation = round(clamp(planet.magicSaturation * 0.65
    + context.metrics.magicIntensity.value * 0.25
    + rng.withScope(`${planet.id}:magic-adaptation`, (scoped) => scoped.range(-8, 8))));
  const level = biosphereLevelFor(chance, civilizationChance, magicAdaptation, planet.type);
  const civilizationSeed = generateCivilizationSeed(context, planet, level, civilizationChance, magicAdaptation, rng.fork("civilization-seed"));

  const biosphere: Biosphere = {
    level,
    dominantForm: rng.withScope(`${planet.id}.biosphere.dominantForm`, (scoped) => scoped.pick(biosphereForms)),
    complexity: round(clamp(chance + civilizationChance * 0.2
      + rng.withScope(`${planet.id}.biosphere.complexity`, (scoped) => scoped.range(-8, 8)))),
    magicAdaptation,
    civilizationChance,
    sourceEventIds: planet.sourceEventIds,
    sourceRuleIds: planet.sourceRuleIds,
  };
  if (civilizationSeed) {
    biosphere.civilizationSeed = civilizationSeed;
  }

  return biosphere;
}

function generateCivilizationSeed(
  context: SpaceGenerationContext,
  planet: Planet,
  level: BiosphereLevel,
  civilizationChance: number,
  magicAdaptation: number,
  rng: RandomStream,
): CivilizationSeed | undefined {
  if (civilizationChance < 52 || level === "microbial") {
    return undefined;
  }
  const subject = `${planet.id}.civilization-seed`;
  const technologyLevel = round(clamp(civilizationChance * 0.48 + context.metrics.civilizationPotential.value * 0.28 + planet.stability * 0.18
    + rng.withScope(`${subject}.technologyLevel`, (scoped) => scoped.range(-8, 8))));
  const magicLevel = round(clamp(magicAdaptation * 0.58 + context.metrics.magicIntensity.value * 0.28
    + rng.withScope(`${subject}.magicLevel`, (scoped) => scoped.range(-8, 8))));
  const faithIntensity = round(clamp(context.metrics.divineActivity.value * 0.45 + biasValue(context.timelineImpact, "divineRelicDensity") * 0.25 + magicAdaptation * 0.18
    + rng.withScope(`${subject}.faithIntensity`, (scoped) => scoped.range(-10, 10))));
  const expansionDrive = round(clamp(civilizationChance * 0.34 + context.metrics.civilizationPotential.value * 0.3 + planet.habitability * 0.2 - planet.magicSaturation * 0.06
    + rng.withScope(`${subject}.expansionDrive`, (scoped) => scoped.range(-8, 8))));
  const stability = round(clamp(planet.stability * 0.54 + context.metrics.causalityIntegrity.value * 0.24 + context.metrics.stability.value * 0.18 - biasValue(context.timelineImpact, "causalHazardLevel") * 0.18
    + rng.withScope(`${subject}.stability`, (scoped) => scoped.range(-8, 8))));

  return {
    originPlanetId: planet.id,
    speciesType: speciesTypeFor(level, planet.type, magicAdaptation),
    technologyLevel,
    magicLevel,
    faithIntensity,
    expansionDrive,
    stability,
    fate: civilizationFateFor({ technologyLevel, magicLevel, faithIntensity, expansionDrive, stability }),
    sourceEventIds: uniqueIds([...planet.sourceEventIds, ...sourceEvents(context.timelineImpact, ["civilizationSeedChance"], 2)]).slice(0, 5),
    sourceRuleIds: uniqueIds([...planet.sourceRuleIds, strongestRuleId(context.laws.consciousness), strongestRuleId(context.laws.divinity)]).slice(0, 5),
  };
}

function pickGalaxyProfile(context: SpaceGenerationContext, rng: RandomStream): GalaxyTypeProfile {
  const magic = biasValue(context.timelineImpact, "magicAnomalyDensity");
  const divine = biasValue(context.timelineImpact, "divineRelicDensity");
  const hazard = biasValue(context.timelineImpact, "causalHazardLevel");
  return rng.weighted(
    galaxyTypeProfiles.map((profile) => ({
      item: profile,
      weight:
        1 +
        Math.max(0, profile.magicBias) * magic / 110 +
        Math.max(0, profile.divineBias) * divine / 110 +
        Math.max(0, profile.hazardBias) * hazard / 130 +
        (profile.id === "spiral" ? context.metrics.lifePotential.value / 70 : 0),
    })),
  );
}

function pickStarSystemProfile(context: SpaceGenerationContext, galaxy: Omit<Galaxy, "starSystems">, rng: RandomStream): StarSystemTypeProfile {
  const stability = biasValue(context.timelineImpact, "stellarStability");
  return rng.weighted(
    starSystemTypeProfiles.map((profile) => ({
      item: profile,
      weight:
        1 +
        Math.max(0, profile.stabilityBias) * stability / 100 +
        Math.max(0, profile.anomalyBias) * (galaxy.magicFlux + galaxy.causalHazard) / 160 +
        (profile.id === "arcane_star" ? context.metrics.magicIntensity.value / 70 : 0),
    })),
  );
}

function pickPlanetProfile(context: SpaceGenerationContext, system: Omit<StarSystem, "planets">, rng: RandomStream): PlanetTypeProfile {
  const habitability = biasValue(context.timelineImpact, "planetHabitability");
  const magic = biasValue(context.timelineImpact, "magicAnomalyDensity");
  return rng.weighted(
    planetTypeProfiles.map((profile) => ({
      item: profile,
      weight:
        1 +
        Math.max(0, profile.habitabilityBias) * habitability / 115 +
        Math.max(0, profile.magicBias) * magic / 110 +
        (profile.id === "gas_giant" ? Math.max(0, 80 - system.luminosity) / 60 : 0),
    })),
  );
}

function pickStarClass(profile: StarSystemTypeProfile, rng: RandomStream): string {
  if (profile.id === "red_dwarf") return "M";
  if (profile.id === "white_dwarf") return "白矮";
  if (profile.id === "giant_star") return "蓝巨";
  if (profile.id === "arcane_star") return "灵质";
  if (profile.id === "black_hole_neighbor") return "黑洞伴星";
  return rng.pick(starClasses.slice(0, 5));
}

function biosphereLevelFor(chance: number, civilizationChance: number, magicAdaptation: number, planetType: PlanetType): BiosphereLevel {
  if (planetType === "mechanical" && civilizationChance >= 55) return "mechanical";
  if (magicAdaptation >= 76) return planetType === "dream" || planetType === "aether" ? "spiritual" : "magical";
  if (civilizationChance >= 72) return "intelligent";
  if (chance >= 66) return "complex";
  return "microbial";
}

function speciesTypeFor(level: BiosphereLevel, planetType: PlanetType, magicAdaptation: number): SpeciesType {
  if (level === "mechanical" || planetType === "mechanical") return "mechanical";
  if (level === "spiritual") return "spiritual";
  if (level === "magical" || magicAdaptation >= 70) return "magical";
  if (planetType === "aether" || planetType === "dream") return "hybrid";
  return "biological";
}

function civilizationFateFor(values: {
  technologyLevel: number;
  magicLevel: number;
  faithIntensity: number;
  expansionDrive: number;
  stability: number;
}): CivilizationFate {
  if (values.stability < 35) return "collapse";
  if (values.magicLevel >= 72 && values.faithIntensity >= 58) return "ascension";
  if (values.expansionDrive >= 68 && values.technologyLevel >= 52) return "expansion";
  if (values.stability >= 70 && values.faithIntensity >= 45) return "symbiosis";
  if (values.expansionDrive < 38) return "stagnation";
  return "unknown";
}

function biasValue(timelineImpact: TimelineImpactSummary, id: LocalGenerationBiasId): number {
  return timelineImpact.localBiases.find((bias) => bias.id === id)?.value ?? 50;
}

function sourceEvents(timelineImpact: TimelineImpactSummary, ids: LocalGenerationBiasId[], limit: number): string[] {
  const matched = timelineImpact.localBiases.filter((bias) => ids.includes(bias.id)).flatMap((bias) => bias.sourceEventIds);
  return uniqueIds(matched.length > 0 ? matched : timelineImpact.keySourceEventIds).slice(0, limit);
}

function strongestRuleId(domain: { rules: Array<{ id: string; value: number }> }): string {
  return [...domain.rules].sort((left, right) => right.value - left.value)[0]?.id ?? "rule.unknown";
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
