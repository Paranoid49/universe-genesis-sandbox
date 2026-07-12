import { miracleDefinitions, type MiracleTargetKind, type MiracleType, type UniverseSummary } from "../sim";

export type MiracleTargetOption = {
  id: string;
  label: string;
  kind: MiracleTargetKind;
};

export function buildMiracleTargetOptions(universe: UniverseSummary, miracleType: MiracleType): MiracleTargetOption[] {
  const definition = miracleDefinitions.find((entry) => entry.type === miracleType);
  if (!definition) return [];
  if (definition.targetKind === "universe") {
    return [{ id: `universe.${universe.seed}`, label: "整个宇宙", kind: "universe" }];
  }
  if (definition.targetKind === "star_system") {
    return universe.galaxies.flatMap((galaxy) => galaxy.starSystems.map((system) => ({
      id: system.id,
      label: `${galaxy.name} / ${system.name}`,
      kind: "star_system" as const,
    })));
  }
  if (definition.targetKind === "planet") {
    return universe.galaxies.flatMap((galaxy) => galaxy.starSystems.flatMap((system) => system.planets.map((planet) => ({
      id: planet.id,
      label: `${galaxy.name} / ${system.name} / ${planet.name}`,
      kind: "planet" as const,
    }))));
  }
  if (definition.targetKind === "mythology") {
    return universe.civilizations.filter((civilization) => civilization.mythology.type !== "none").map((civilization) => ({
      id: civilization.id,
      label: `${civilization.mythology.deityName} / ${civilization.name}`,
      kind: "mythology" as const,
    }));
  }
  return universe.civilizations.map((civilization) => ({
    id: civilization.id,
    label: `${civilization.name} / ${civilization.originPlanetName}`,
    kind: "civilization" as const,
  }));
}
