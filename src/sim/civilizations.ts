import { clamp, round, type RandomStream } from "./random";
import {
  civilizationEventBlueprints,
  civilizationNameCores,
  civilizationNamePrefixes,
  civilizationNameSuffixes,
  civilizationPathProfiles,
  deityNameCores,
  mythologyProfiles,
  type CivilizationEventBlueprint,
  type CivilizationPathProfile,
  type MythologyProfile,
} from "./content/civilizations";
import type {
  Civilization,
  CivilizationEvent,
  CivilizationEventType,
  CivilizationFate,
  CivilizationPath,
  Galaxy,
  MythologySystem,
  MythologyType,
  Planet,
  StarSystem,
  TimelineImpactSummary,
  UniverseLaws,
  UniverseMetrics,
} from "./types";

type CivilizationGenerationContext = {
  laws: UniverseLaws;
  metrics: UniverseMetrics;
  timelineImpact: TimelineImpactSummary;
  galaxies: Galaxy[];
};

type CivilizationCandidate = {
  galaxy: Galaxy;
  system: StarSystem;
  planet: Planet;
};

type CivilizationValues = {
  technologyLevel: number;
  magicLevel: number;
  faithIntensity: number;
  expansionDrive: number;
  stability: number;
  extinctionRisk: number;
};

export function generateCivilizations(context: CivilizationGenerationContext, rng: RandomStream): Civilization[] {
  const candidates = civilizationCandidates(context.galaxies);
  return candidates.map((candidate, index) => generateCivilization(context, candidate, rng.fork(`civilization.${candidate.planet.id}`), index + 1));
}

function generateCivilization(context: CivilizationGenerationContext, candidate: CivilizationCandidate, rng: RandomStream, index: number): Civilization {
  const seed = candidate.planet.biosphere?.civilizationSeed;
  if (!seed) {
    throw new Error("文明生成必须来自 Biosphere.civilizationSeed。");
  }

  const values = civilizationValues(context, candidate, rng);
  const path = pickCivilizationPath(context, values, rng);
  const mythology = generateMythology(context, candidate, values, path, rng.fork("mythology"));
  const fate = civilizationFateFor(path, values, seed.fate);
  const sourceEventIds = uniqueIds([...seed.sourceEventIds, ...candidate.planet.sourceEventIds, ...sourceEvents(context.timelineImpact, 3)]).slice(0, 6);
  const sourceRuleIds = uniqueIds([
    ...seed.sourceRuleIds,
    strongestRuleId(context.laws.consciousness),
    strongestRuleId(context.laws.divinity),
    strongestRuleId(context.laws.life),
  ]).slice(0, 6);
  const id = `civ-${String(index).padStart(2, "0")}`;

  return {
    id,
    name: civilizationName(path, rng),
    originGalaxyId: candidate.galaxy.id,
    originGalaxyName: candidate.galaxy.name,
    originStarSystemId: candidate.system.id,
    originStarSystemName: candidate.system.name,
    originPlanetId: candidate.planet.id,
    originPlanetName: candidate.planet.name,
    speciesType: seed.speciesType,
    technologyLevel: values.technologyLevel,
    magicLevel: values.magicLevel,
    faithIntensity: values.faithIntensity,
    expansionDrive: values.expansionDrive,
    stability: values.stability,
    extinctionRisk: values.extinctionRisk,
    path,
    mythology,
    fate,
    historyEvents: generateCivilizationEvents({ id, path, mythology, fate, values, sourceEventIds, sourceRuleIds }, rng.fork("history")),
    sourceEventIds,
    sourceRuleIds,
  };
}

function civilizationCandidates(galaxies: Galaxy[]): CivilizationCandidate[] {
  return galaxies.flatMap((galaxy) =>
    galaxy.starSystems.flatMap((system) =>
      system.planets.flatMap((planet) => (planet.biosphere?.civilizationSeed ? [{ galaxy, system, planet }] : [])),
    ),
  );
}

function civilizationValues(context: CivilizationGenerationContext, candidate: CivilizationCandidate, rng: RandomStream): CivilizationValues {
  const seed = candidate.planet.biosphere?.civilizationSeed;
  if (!seed) {
    throw new Error("文明数值生成必须来自文明候选种子。");
  }
  const localCivilization = biasValue(context.timelineImpact, "civilizationSeedChance");
  const divineRelic = biasValue(context.timelineImpact, "divineRelicDensity");
  const causalHazard = biasValue(context.timelineImpact, "causalHazardLevel");
  const technologyLevel = round(clamp(seed.technologyLevel * 0.62 + context.metrics.civilizationPotential.value * 0.18 + candidate.system.stability * 0.12 + rng.range(-7, 7)));
  const magicLevel = round(clamp(seed.magicLevel * 0.62 + context.metrics.magicIntensity.value * 0.18 + candidate.planet.magicSaturation * 0.16 + rng.range(-7, 7)));
  const faithIntensity = round(clamp(seed.faithIntensity * 0.56 + context.metrics.divineActivity.value * 0.22 + divineRelic * 0.16 + rng.range(-8, 8)));
  const expansionDrive = round(clamp(seed.expansionDrive * 0.6 + context.metrics.civilizationPotential.value * 0.18 + localCivilization * 0.16 + rng.range(-7, 7)));
  const stability = round(
    clamp(
      seed.stability * 0.46 +
        context.metrics.stability.value * 0.24 +
        candidate.system.stability * 0.16 +
        candidate.planet.stability * 0.16 -
        causalHazard * 0.06 +
        rng.range(-8, 8),
    ),
  );
  const extinctionRisk = round(clamp(78 - stability * 0.65 + causalHazard * 0.18 + candidate.galaxy.causalHazard * 0.12 - context.metrics.causalityIntegrity.value * 0.18 + rng.range(-8, 8)));

  return { technologyLevel, magicLevel, faithIntensity, expansionDrive, stability, extinctionRisk };
}

function pickCivilizationPath(context: CivilizationGenerationContext, values: CivilizationValues, rng: RandomStream): CivilizationPath {
  const consciousness = context.laws.consciousness.rating.value;
  const divinity = context.laws.divinity.rating.value;
  const magic = context.laws.magic.rating.value;
  if (values.extinctionRisk >= 78 || values.stability < 28) return "lost";
  if ((values.technologyLevel + values.magicLevel + values.faithIntensity) / 3 >= 68 && values.stability >= 42) return "ascended";
  if (values.magicLevel >= 50 && magic >= 55) return "arcane_empire";
  if (values.faithIntensity >= 50 && divinity >= 55) return "theocracy";
  if (consciousness >= 65 && values.stability >= 45) return "collective_mind";
  if (values.technologyLevel >= 48 && values.expansionDrive >= 45) return "galactic";
  if (values.technologyLevel >= 42 && values.stability >= 32) return "planetary";
  if (values.technologyLevel >= 34) return rng.bool(0.65) ? "city_state" : "tribal";
  const weights = civilizationPathProfiles.map((profile) => ({
    item: profile.id,
    weight: pathWeight(profile, values, { consciousness, divinity, magic }),
  }));
  return rng.weighted(weights);
}

function pathWeight(
  profile: CivilizationPathProfile,
  values: CivilizationValues,
  laws: { consciousness: number; divinity: number; magic: number },
): number {
  const baseline =
    1 +
    Math.max(0, values.technologyLevel + profile.technologyBias - 50) / 18 +
    Math.max(0, values.magicLevel + profile.magicBias - 50) / 18 +
    Math.max(0, values.faithIntensity + profile.faithBias - 50) / 18 +
    Math.max(0, values.expansionDrive + profile.expansionBias - 50) / 18 +
    Math.max(0, values.stability + profile.stabilityBias - 50) / 18;

  if (profile.id === "tribal") return baseline + Math.max(0, 42 - values.technologyLevel) / 8;
  if (profile.id === "city_state") return baseline + Math.max(0, 58 - Math.abs(values.technologyLevel - 48)) / 20;
  if (profile.id === "planetary") return baseline + values.technologyLevel / 45 + values.stability / 70;
  if (profile.id === "galactic") return baseline + values.technologyLevel / 35 + values.expansionDrive / 30;
  if (profile.id === "arcane_empire") return baseline + values.magicLevel / 28 + laws.magic / 38;
  if (profile.id === "theocracy") return baseline + values.faithIntensity / 28 + laws.divinity / 36;
  if (profile.id === "collective_mind") return baseline + laws.consciousness / 28 + values.stability / 48;
  if (profile.id === "ascended") return baseline + (values.technologyLevel + values.magicLevel + values.faithIntensity) / 85;
  return baseline + values.extinctionRisk / 25 + Math.max(0, 45 - values.stability) / 8;
}

function generateMythology(
  context: CivilizationGenerationContext,
  candidate: CivilizationCandidate,
  values: CivilizationValues,
  path: CivilizationPath,
  rng: RandomStream,
): MythologySystem {
  const profile = pickMythologyProfile(context, candidate, values, path, rng);
  const influenceLevel = round(clamp(values.faithIntensity * 0.48 + context.metrics.divineActivity.value * 0.26 + values.magicLevel * 0.14 + profile.divinityBias + rng.range(-6, 6)));
  const sourceEventIds = uniqueIds([...candidate.planet.sourceEventIds, ...sourceEvents(context.timelineImpact, 2)]).slice(0, 5);
  const sourceRuleIds = uniqueIds([strongestRuleId(context.laws.divinity), strongestRuleId(context.laws.consciousness), ...candidate.planet.sourceRuleIds]).slice(0, 5);
  const deityName = profile.id === "none" ? "无主神" : `${rng.pick(deityNameCores)}-${profile.label}`;

  return {
    type: profile.id,
    deityName,
    origin: mythologyOrigin(profile.id, candidate),
    influenceLevel,
    relationToCivilization: mythologyRelation(profile.id, path, values),
    explanation: `${profile.label}由信仰强度 ${values.faithIntensity}、神性活跃 ${context.metrics.divineActivity.value} 与起源环境共同决定。`,
    sourceEventIds,
    sourceRuleIds,
  };
}

function pickMythologyProfile(
  context: CivilizationGenerationContext,
  candidate: CivilizationCandidate,
  values: CivilizationValues,
  path: CivilizationPath,
  rng: RandomStream,
): MythologyProfile {
  const weights = mythologyProfiles.map((profile) => ({
    item: profile,
    weight:
      1 +
      Math.max(0, values.faithIntensity + profile.faithBias - 45) / 16 +
      Math.max(0, values.magicLevel + profile.magicBias - 50) / 20 +
      Math.max(0, context.metrics.divineActivity.value + profile.divinityBias - 45) / 16 +
      Math.max(0, values.technologyLevel + profile.technologyBias - 55) / 24 +
      mythologyEnvironmentWeight(profile.id, candidate, path),
  }));
  return rng.weighted(weights);
}

function mythologyEnvironmentWeight(type: MythologyType, candidate: CivilizationCandidate, path: CivilizationPath): number {
  if (type === "none") return candidate.planet.magicSaturation < 30 && candidate.galaxy.divineResidue < 30 ? 5 : 0;
  if (type === "nature_deity") return candidate.planet.habitability / 35 + candidate.planet.water / 40;
  if (type === "stellar_deity") return candidate.system.luminosity / 35;
  if (type === "black_hole_deity") return candidate.system.type === "black_hole_neighbor" ? 7 : candidate.galaxy.causalHazard / 45;
  if (type === "death_or_dream_deity") return candidate.planet.type === "dream" || path === "lost" ? 7 : candidate.galaxy.causalHazard / 50;
  if (type === "machine_deity") return candidate.planet.type === "mechanical" || path === "theocracy" ? 5 : 0;
  if (type === "faith_deity") return path === "theocracy" ? 7 : 0;
  return candidate.galaxy.divineResidue / 34;
}

function mythologyOrigin(type: MythologyType, candidate: CivilizationCandidate): string {
  if (type === "none") return "文明未形成稳定神格结构。";
  if (type === "creator_deity") return "神话把宇宙初始法则人格化为造物主。";
  if (type === "nature_deity") return `神格来自${candidate.planet.name}的生态循环。`;
  if (type === "faith_deity") return "神格由长期集体信仰反馈塑造。";
  if (type === "stellar_deity") return `神格投射到${candidate.system.name}的恒星活动。`;
  if (type === "black_hole_deity") return "神格来自高因果风险天体的观测阴影。";
  if (type === "death_or_dream_deity") return "神格诞生于死亡记忆、梦境和灵魂回声。";
  return "神格由文明制造的秩序机器逐步人格化。";
}

function mythologyRelation(type: MythologyType, path: CivilizationPath, values: CivilizationValues): string {
  if (type === "none") return "文明以技术、制度或集体记忆维持秩序。";
  if (path === "theocracy") return "神话系统直接参与统治合法性。";
  if (path === "arcane_empire") return "神话系统约束高强度魔法的代价。";
  if (path === "collective_mind") return "神话系统被集体意识重新解释。";
  if (values.faithIntensity >= 70) return "神话系统深度塑造法律、战争和远航。";
  return "神话系统主要提供仪式、禁忌和历史解释。";
}

function civilizationFateFor(path: CivilizationPath, values: CivilizationValues, seedFate: CivilizationFate): CivilizationFate {
  if (values.extinctionRisk >= 88 || path === "lost") return "collapse";
  if (path === "ascended" || path === "arcane_empire" || (values.magicLevel >= 48 && values.faithIntensity >= 38)) return "ascension";
  if (path === "collective_mind" || (values.stability >= 50 && (values.faithIntensity >= 30 || path === "planetary"))) return "symbiosis";
  if (values.expansionDrive < 60 && values.technologyLevel < 55) return "stagnation";
  if (path === "galactic" && values.stability >= 52 && values.extinctionRisk < 62) return "unknown";
  if (path === "galactic" || (values.expansionDrive >= 55 && values.technologyLevel >= 40)) return "expansion";
  if (values.extinctionRisk >= 72 || seedFate === "collapse") return "collapse";
  return seedFate === "expansion" ? "unknown" : seedFate;
}

function civilizationName(path: CivilizationPath, rng: RandomStream): string {
  const prefix = rng.pick(civilizationNamePrefixes);
  const core = rng.pick(civilizationNameCores);
  const suffix = rng.pick(civilizationNameSuffixes);
  if (path === "collective_mind") {
    return `${prefix}${core}群识`;
  }
  if (path === "lost") {
    return `${prefix}${core}遗民`;
  }
  return `${prefix}${core}${suffix}`;
}

function generateCivilizationEvents(
  civilization: {
    id: string;
    path: CivilizationPath;
    mythology: MythologySystem;
    fate: CivilizationFate;
    values: CivilizationValues;
    sourceEventIds: string[];
    sourceRuleIds: string[];
  },
  rng: RandomStream,
): CivilizationEvent[] {
  const targetCount = rng.int(8, 15);
  const blueprints = seedEventBlueprints(civilization);

  while (blueprints.length < targetCount) {
    blueprints.push(pickEventBlueprint(civilization, rng));
  }

  return blueprints.slice(0, targetCount).map((blueprint, index): CivilizationEvent => {
    const id = `${civilization.id}-evt-${String(index + 1).padStart(2, "0")}`;
    const previous = index > 0 && rng.bool(0.68) ? [`${civilization.id}-evt-${String(index).padStart(2, "0")}`] : [];
    return {
      id,
      ageLabel: `文明纪元 ${index + 1}`,
      type: blueprint.type,
      title: rng.pick(blueprint.titles),
      description: eventDescription(blueprint, civilization),
      impact: round(clamp(blueprint.baseImpact + eventImpactDelta(blueprint.type, civilization.values) + rng.range(-6, 6), -40, 40)),
      sourceEventIds: civilization.sourceEventIds,
      sourceRuleIds: civilization.sourceRuleIds,
      triggeredByCivilizationEventIds: previous,
    };
  });
}

function seedEventBlueprints(civilization: {
  path: CivilizationPath;
  mythology: MythologySystem;
  fate: CivilizationFate;
  values: CivilizationValues;
}): CivilizationEventBlueprint[] {
  const result = [blueprintByType("first_fire_or_language"), blueprintByType("first_astronomy")];
  if (civilization.values.magicLevel >= 42 || civilization.path === "arcane_empire") result.push(blueprintByType("first_magic"));
  if (civilization.mythology.type !== "none" || civilization.values.faithIntensity >= 45) result.push(blueprintByType("first_deity_contact"));
  if (civilization.values.extinctionRisk >= 55 || civilization.fate === "collapse") result.push(blueprintByType("world_war"));
  if (civilization.values.expansionDrive >= 55 || civilization.path === "galactic") result.push(blueprintByType("star_voyage"));
  if (civilization.fate === "ascension" || civilization.path === "ascended") result.push(blueprintByType("ascension_rite"));
  if (civilization.fate === "collapse" || civilization.path === "lost") result.push(blueprintByType("extinction"));
  return uniqueBlueprints(result);
}

function pickEventBlueprint(
  civilization: {
    path: CivilizationPath;
    mythology: MythologySystem;
    fate: CivilizationFate;
    values: CivilizationValues;
  },
  rng: RandomStream,
): CivilizationEventBlueprint {
  return rng.weighted(
    civilizationEventBlueprints.map((blueprint) => ({
      item: blueprint,
      weight: eventWeight(blueprint.type, civilization),
    })),
  );
}

function eventWeight(
  type: CivilizationEventType,
  civilization: {
    path: CivilizationPath;
    mythology: MythologySystem;
    fate: CivilizationFate;
    values: CivilizationValues;
  },
): number {
  if (type === "first_fire_or_language") return 2;
  if (type === "first_magic") return 1 + civilization.values.magicLevel / 24;
  if (type === "first_astronomy") return 1 + civilization.values.technologyLevel / 26;
  if (type === "first_deity_contact") return 1 + civilization.values.faithIntensity / 22 + (civilization.mythology.type === "none" ? -0.8 : 1);
  if (type === "world_war") return 1 + civilization.values.extinctionRisk / 22;
  if (type === "star_voyage") return 1 + civilization.values.expansionDrive / 22 + (civilization.path === "galactic" ? 2 : 0);
  if (type === "ascension_rite") return 1 + (civilization.fate === "ascension" ? 5 : 0) + civilization.values.magicLevel / 45;
  return 1 + (civilization.fate === "collapse" ? 5 : 0) + civilization.values.extinctionRisk / 24;
}

function eventDescription(
  blueprint: CivilizationEventBlueprint,
  civilization: {
    path: CivilizationPath;
    mythology: MythologySystem;
    fate: CivilizationFate;
    values: CivilizationValues;
  },
): string {
  return `${blueprint.description} 当前文明路径为${pathLabel(civilization.path)}，神话系统为${civilization.mythology.deityName}，终局倾向为${civilization.fate}。`;
}

function eventImpactDelta(type: CivilizationEventType, values: CivilizationValues): number {
  if (type === "first_magic") return round((values.magicLevel - 50) / 5);
  if (type === "first_astronomy") return round((values.technologyLevel - 50) / 5);
  if (type === "first_deity_contact") return round((values.faithIntensity - 50) / 5);
  if (type === "world_war" || type === "extinction") return round((values.extinctionRisk - 50) / -4);
  if (type === "star_voyage") return round((values.expansionDrive - 50) / 4);
  if (type === "ascension_rite") return round((values.magicLevel + values.faithIntensity - 100) / 8);
  return round((values.stability - 50) / 8);
}

function blueprintByType(type: CivilizationEventType): CivilizationEventBlueprint {
  return civilizationEventBlueprints.find((blueprint) => blueprint.type === type) ?? civilizationEventBlueprints[0];
}

function uniqueBlueprints(blueprints: CivilizationEventBlueprint[]): CivilizationEventBlueprint[] {
  const seen = new Set<CivilizationEventType>();
  return blueprints.filter((blueprint) => {
    if (seen.has(blueprint.type)) return false;
    seen.add(blueprint.type);
    return true;
  });
}

function pathLabel(path: CivilizationPath): string {
  return civilizationPathProfiles.find((profile) => profile.id === path)?.label ?? path;
}

function biasValue(timelineImpact: TimelineImpactSummary, id: string): number {
  return timelineImpact.localBiases.find((bias) => bias.id === id)?.value ?? 50;
}

function sourceEvents(timelineImpact: TimelineImpactSummary, limit: number): string[] {
  return [...timelineImpact.keySourceEventIds, ...timelineImpact.localBiases.flatMap((bias) => bias.sourceEventIds)].slice(0, limit);
}

function strongestRuleId(domain: { rules: Array<{ id: string; value: number }> }): string {
  return [...domain.rules].sort((left, right) => right.value - left.value)[0]?.id ?? "rule.unknown";
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
