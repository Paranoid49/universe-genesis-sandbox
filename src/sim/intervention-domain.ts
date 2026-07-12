import { clamp, round, type RandomStream } from "./random";
import { UniverseInputError } from "./errors";
import type {
  Biosphere,
  Civilization,
  Galaxy,
  InterventionInput,
  MiracleDefinition,
  TargetMutation,
} from "./types";

export type InterventionDomainState = {
  galaxies: Galaxy[];
  civilizations: Civilization[];
};

export type InterventionDomainResult = InterventionDomainState & {
  mutations: TargetMutation[];
};

export function applyInterventionToDomain(
  state: InterventionDomainState,
  input: InterventionInput,
  definition: MiracleDefinition,
  miracleId: string,
  rng: RandomStream,
): InterventionDomainResult {
  if (definition.targetKind === "universe") {
    return {
      ...state,
      mutations: [],
    };
  }

  if (definition.targetKind === "planet") {
    return mutatePlanet(state, input, definition, miracleId, rng);
  }

  if (definition.targetKind === "star_system") {
    return mutateStarSystem(state, input, definition);
  }

  return mutateCivilization(state, input, definition);
}

function mutatePlanet(
  state: InterventionDomainState,
  input: InterventionInput,
  definition: MiracleDefinition,
  miracleId: string,
  rng: RandomStream,
): InterventionDomainResult {
  const mutations: TargetMutation[] = [];
  let matched = false;
  const galaxies = state.galaxies.map((galaxy) => ({
    ...galaxy,
    starSystems: galaxy.starSystems.map((system) => ({
      ...system,
      planets: system.planets.map((planet) => {
        if (planet.id !== input.targetId) {
          return planet;
        }
        matched = true;
        if (definition.type === "seed_life") {
          const nextBiosphere = seededBiosphere(planet.biosphere, planet, miracleId, rng);
          mutations.push(mutation(planet.id, "planet", "biosphere.level", planet.biosphere?.level ?? null, nextBiosphere.level, "生命火种在目标行星形成了可持续生物圈。"));
          mutations.push(mutation(planet.id, "planet", "habitability", planet.habitability, clampValue(planet.habitability + 8), "生命火种改善了目标行星的宜居条件。"));
          return {
            ...planet,
            habitability: clampValue(planet.habitability + 8),
            stability: clampValue(planet.stability + 3),
            biosphere: nextBiosphere,
          };
        }

        const nextHabitability = clampValue(planet.habitability + 10);
        const nextStability = clampValue(planet.stability + 8);
        mutations.push(mutation(planet.id, "planet", "habitability", planet.habitability, nextHabitability, "祝福提高了目标行星的宜居度。"));
        mutations.push(mutation(planet.id, "planet", "stability", planet.stability, nextStability, "祝福提高了目标行星的局部稳定度。"));
        return {
          ...planet,
          habitability: nextHabitability,
          stability: nextStability,
          biosphere: planet.biosphere
            ? {
                ...planet.biosphere,
                complexity: clampValue(planet.biosphere.complexity + 6),
                civilizationChance: clampValue(planet.biosphere.civilizationChance + 8),
              }
            : planet.biosphere,
        };
      }),
    })),
  }));

  ensureMatched(matched, input, definition);
  return { galaxies, civilizations: state.civilizations, mutations };
}

function mutateStarSystem(
  state: InterventionDomainState,
  input: InterventionInput,
  definition: MiracleDefinition,
): InterventionDomainResult {
  const mutations: TargetMutation[] = [];
  let matched = false;
  const galaxies = state.galaxies.map((galaxy) => ({
    ...galaxy,
    starSystems: galaxy.starSystems.map((system) => {
      if (system.id !== input.targetId) {
        return system;
      }
      matched = true;
      const nextStability = clampValue(system.stability + 14);
      const nextAnomalyLevel = clampValue(system.anomalyLevel - 12);
      mutations.push(mutation(system.id, "star_system", "stability", system.stability, nextStability, "恒星稳定术提高了目标恒星系的稳定度。"));
      mutations.push(mutation(system.id, "star_system", "anomalyLevel", system.anomalyLevel, nextAnomalyLevel, "恒星稳定术压低了目标恒星系的异常水平。"));
      return {
        ...system,
        stability: nextStability,
        anomalyLevel: nextAnomalyLevel,
        planets: system.planets.map((planet) => ({
          ...planet,
          stability: clampValue(planet.stability + 5),
        })),
      };
    }),
  }));

  ensureMatched(matched, input, definition);
  return { galaxies, civilizations: state.civilizations, mutations };
}

function mutateCivilization(
  state: InterventionDomainState,
  input: InterventionInput,
  definition: MiracleDefinition,
): InterventionDomainResult {
  const mutations: TargetMutation[] = [];
  let matched = false;
  const civilizations = state.civilizations.map((civilization) => {
    if (civilization.id !== input.targetId) {
      return civilization;
    }
    matched = true;

    if (definition.type === "grant_magic") {
      const nextMagicLevel = clampValue(civilization.magicLevel + 18);
      const nextFaithIntensity = clampValue(civilization.faithIntensity + 6);
      mutations.push(mutation(civilization.id, "civilization", "magicLevel", civilization.magicLevel, nextMagicLevel, "魔法通道提高了目标文明的魔法水平。"));
      mutations.push(mutation(civilization.id, "civilization", "faithIntensity", civilization.faithIntensity, nextFaithIntensity, "可见神迹提高了目标文明的信仰强度。"));
      return {
        ...civilization,
        magicLevel: nextMagicLevel,
        faithIntensity: nextFaithIntensity,
        mythology: {
          ...civilization.mythology,
          influenceLevel: clampValue(civilization.mythology.influenceLevel + 10),
        },
      };
    }

    if (definition.type === "send_catastrophe") {
      const nextStability = clampValue(civilization.stability - 20);
      const nextExtinctionRisk = clampValue(civilization.extinctionRisk + 24);
      mutations.push(mutation(civilization.id, "civilization", "stability", civilization.stability, nextStability, "灾难削弱了目标文明的稳定度。"));
      mutations.push(mutation(civilization.id, "civilization", "extinctionRisk", civilization.extinctionRisk, nextExtinctionRisk, "灾难提高了目标文明的灭绝风险。"));
      return {
        ...civilization,
        stability: nextStability,
        extinctionRisk: nextExtinctionRisk,
        fate: nextExtinctionRisk >= 75 ? "collapse" : civilization.fate,
      };
    }

    if (definition.type === "revive_civilization") {
      const nextStability = clampValue(Math.max(civilization.stability, 58));
      const nextExtinctionRisk = clampValue(Math.min(civilization.extinctionRisk, 28));
      mutations.push(mutation(civilization.id, "civilization", "stability", civilization.stability, nextStability, "记忆火种恢复了目标文明的延续能力。"));
      mutations.push(mutation(civilization.id, "civilization", "extinctionRisk", civilization.extinctionRisk, nextExtinctionRisk, "复活干预降低了目标文明的灭绝风险。"));
      return {
        ...civilization,
        stability: nextStability,
        extinctionRisk: nextExtinctionRisk,
        fate: civilization.fate === "collapse" ? "unknown" : civilization.fate,
        path: civilization.path === "lost" ? "city_state" : civilization.path,
      };
    }

    const nextInfluence = clampValue(civilization.mythology.influenceLevel - 22);
    mutations.push(mutation(civilization.id, "mythology", "mythology.influenceLevel", civilization.mythology.influenceLevel, nextInfluence, "神明封印降低了目标神话系统的影响力。"));
    return {
      ...civilization,
      faithIntensity: clampValue(civilization.faithIntensity - 8),
      mythology: {
        ...civilization.mythology,
        influenceLevel: nextInfluence,
        relationToCivilization: `封印状态：${civilization.mythology.relationToCivilization}`,
      },
    };
  });

  ensureMatched(matched, input, definition);
  return { galaxies: state.galaxies, civilizations, mutations };
}

function seededBiosphere(
  current: Biosphere | undefined,
  planet: Galaxy["starSystems"][number]["planets"][number],
  miracleId: string,
  rng: RandomStream,
): Biosphere {
  if (current) {
    return {
      ...current,
      level: current.level === "microbial" ? "complex" : current.level,
      dominantForm: current.dominantForm,
      complexity: clampValue(current.complexity + 16),
      magicAdaptation: clampValue(current.magicAdaptation + Math.round(planet.magicSaturation * 0.08)),
      civilizationChance: clampValue(current.civilizationChance + 12),
      sourceEventIds: uniqueIds([...current.sourceEventIds, miracleId]),
    };
  }

  return {
    level: planet.magicSaturation >= 70 ? "magical" : planet.habitability >= 58 ? "complex" : "microbial",
    dominantForm: rng.pick(["奇迹孢子群", "星海原生质", "因果藻毯", "灵性微生物群"]),
    complexity: clampValue(46 + planet.habitability * 0.28 + rng.range(-4, 6)),
    magicAdaptation: clampValue(planet.magicSaturation * 0.72 + rng.range(-3, 5)),
    civilizationChance: clampValue(28 + planet.habitability * 0.24 + rng.range(-4, 5)),
    sourceEventIds: uniqueIds([...planet.sourceEventIds, miracleId]),
    sourceRuleIds: planet.sourceRuleIds,
  };
}

function mutation(
  targetId: string,
  targetKind: TargetMutation["targetKind"],
  field: string,
  before: TargetMutation["before"],
  after: TargetMutation["after"],
  explanation: string,
): TargetMutation {
  return { targetId, targetKind, field, before, after, explanation };
}

function ensureMatched(matched: boolean, input: InterventionInput, definition: MiracleDefinition): void {
  if (!matched) {
    throw new UniverseInputError(
      "INVALID_TARGET",
      `interventions.${input.id}.targetId`,
      `奇迹“${definition.title}”找不到类型为 ${definition.targetKind} 的目标 ${input.targetId}。`,
    );
  }
}

function clampValue(value: number): number {
  return round(clamp(value));
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
