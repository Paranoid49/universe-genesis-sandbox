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
          const nextPlanet = {
            ...planet,
            habitability: clampValue(planet.habitability + 8),
            stability: clampValue(planet.stability + 3),
            biosphere: nextBiosphere,
          };
          mutations.push(...diffTargetMutations(planet.id, "planet", planet, nextPlanet, definition.title));
          return nextPlanet;
        }

        const nextHabitability = clampValue(planet.habitability + 10);
        const nextStability = clampValue(planet.stability + 8);
        const nextPlanet = {
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
        mutations.push(...diffTargetMutations(planet.id, "planet", planet, nextPlanet, definition.title));
        return nextPlanet;
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
      const nextSystem = {
        ...system,
        stability: nextStability,
        anomalyLevel: nextAnomalyLevel,
        planets: system.planets.map((planet) => ({
          ...planet,
          stability: clampValue(planet.stability + 5),
        })),
      };
      mutations.push(...diffTargetMutations(system.id, "star_system", omitPlanets(system), omitPlanets(nextSystem), definition.title));
      system.planets.forEach((planet, index) => {
        mutations.push(...diffTargetMutations(planet.id, "planet", planet, nextSystem.planets[index], definition.title));
      });
      return nextSystem;
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
      const nextCivilization = {
        ...civilization,
        magicLevel: nextMagicLevel,
        faithIntensity: nextFaithIntensity,
        mythology: {
          ...civilization.mythology,
          influenceLevel: clampValue(civilization.mythology.influenceLevel + 10),
        },
      };
      mutations.push(...diffTargetMutations(civilization.id, "civilization", civilization, nextCivilization, definition.title));
      return nextCivilization;
    }

    if (definition.type === "send_catastrophe") {
      const nextStability = clampValue(civilization.stability - 20);
      const nextExtinctionRisk = clampValue(civilization.extinctionRisk + 24);
      const nextCivilization = {
        ...civilization,
        stability: nextStability,
        extinctionRisk: nextExtinctionRisk,
        fate: nextExtinctionRisk >= 75 ? "collapse" : civilization.fate,
      };
      mutations.push(...diffTargetMutations(civilization.id, "civilization", civilization, nextCivilization, definition.title));
      return nextCivilization;
    }

    if (definition.type === "revive_civilization") {
      const nextStability = clampValue(Math.max(civilization.stability, 58));
      const nextExtinctionRisk = clampValue(Math.min(civilization.extinctionRisk, 28));
      const nextCivilization = {
        ...civilization,
        stability: nextStability,
        extinctionRisk: nextExtinctionRisk,
        fate: civilization.fate === "collapse" ? "unknown" : civilization.fate,
        path: civilization.path === "lost" ? "city_state" : civilization.path,
      };
      mutations.push(...diffTargetMutations(civilization.id, "civilization", civilization, nextCivilization, definition.title));
      return nextCivilization;
    }

    const nextInfluence = clampValue(civilization.mythology.influenceLevel - 22);
    const nextCivilization = {
      ...civilization,
      faithIntensity: clampValue(civilization.faithIntensity - 8),
      mythology: {
        ...civilization.mythology,
        influenceLevel: nextInfluence,
        relationToCivilization: `封印状态：${civilization.mythology.relationToCivilization}`,
      },
    };
    mutations.push(...diffTargetMutations(civilization.id, "mythology", civilization, nextCivilization, definition.title));
    return nextCivilization;
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

function diffTargetMutations(
  targetId: string,
  targetKind: TargetMutation["targetKind"],
  before: unknown,
  after: unknown,
  miracleTitle: string,
  field = "",
): TargetMutation[] {
  if (Object.is(before, after)) return [];
  if (isRecord(after) || isRecord(before)) {
    const beforeRecord = isRecord(before) ? before : {};
    const afterRecord = isRecord(after) ? after : {};
    const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
    return [...keys].flatMap((key) => diffTargetMutations(
      targetId,
      targetKind,
      beforeRecord[key],
      afterRecord[key],
      miracleTitle,
      field ? `${field}.${key}` : key,
    ));
  }
  return [{
    targetId,
    targetKind,
    field,
    before: auditValue(before),
    after: auditValue(after),
    explanation: `奇迹“${miracleTitle}”修改了目标字段 ${field}。`,
  }];
}

function omitPlanets(system: Galaxy["starSystems"][number]) {
  const { planets: _planets, ...summary } = system;
  return summary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function auditValue(value: unknown): TargetMutation["before"] {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  return JSON.stringify(value);
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
