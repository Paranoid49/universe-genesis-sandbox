import { expect } from "vitest";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Civilization, EraId, LawDomainId, MetricId, UniverseSummary } from "../src/sim";

export const fixedSeeds = [
  "LUX-7F3A-91C2",
  "ASH-44DE-0101",
  "DREAM-777",
  "VOID-0001",
  "MYTH-STAR-42",
];

export const lawDomainIds: LawDomainId[] = ["physics", "magic", "life", "consciousness", "divinity", "causality"];
export const metricIds: MetricId[] = ["age", "stability", "lifePotential", "civilizationPotential", "magicIntensity", "divineActivity", "causalityIntegrity"];
export const eraIds: EraId[] = ["creation", "stars", "elements", "life", "civilization", "myth", "ascension", "ending"];
export const expectedRulesetContentHash = "b0f7669a66aabd662b67aebf8925ea923680c64fd1e190c4d312ec84b72fbebe";

export function expectCompleteUniverse(universe: UniverseSummary): void {
  expect(universe.seed).not.toBe("");
  expect(universe.name).not.toBe("");
  expect(universe.archetype).not.toBe("");
  expect(universe.tagline).not.toBe("");
  expect(universe.description).not.toBe("");
  expect(universe.shareCode).not.toBe("");
  expect(universe.timeline.length).toBeGreaterThanOrEqual(30);
  expect(new Set(universe.timeline.map((event) => event.era)).size).toBeGreaterThanOrEqual(8);
  expect(Object.values(universe.metrics).every((metric) => metric.label && metric.explanation)).toBe(true);
  expect(Object.values(universe.laws).every((law) => law.rating.label && law.rating.explanation && law.traits.length >= 3)).toBe(true);
  expect(universe.timeline.every((event) => event.title && event.description && event.causes.length > 0 && event.effects.length > 0 && event.location && event.causalNotes.length > 0)).toBe(true);
  expect(universe.timelineImpact.eventCount).toBe(universe.timeline.length);
  expect(universe.timelineImpact.localBiases.length).toBeGreaterThanOrEqual(8);
  expect(universe.galaxies.length).toBeGreaterThanOrEqual(12);
  expect(universe.miracleState.availableMiracles.length).toBeGreaterThanOrEqual(6);
  expect(universe.miracleState.interventionLog.length).toBe(universe.miracleState.appliedMiracles.length);
}

export function allStructuredLaws(universe: UniverseSummary) {
  return Object.values(universe.laws).flatMap((law) => law.rules);
}

export function galaxySignature(universe: UniverseSummary): string {
  return universe.galaxies.map((galaxy) => `${galaxy.type}:${galaxy.starSystems.length}:${galaxy.causalHazard}`).join("|");
}

export function averageGalaxyValue(universe: UniverseSummary, key: "causalHazard" | "magicFlux" | "divineResidue"): number {
  const total = universe.galaxies.reduce((sum, galaxy) => sum + galaxy[key], 0);
  return total / universe.galaxies.length;
}

export function allPlanets(universe: UniverseSummary) {
  return universe.galaxies.flatMap((galaxy) => galaxy.starSystems).flatMap((system) => system.planets);
}

export function civilizationPathIsCoherent(civilization: Civilization, universe: UniverseSummary): boolean {
  if (civilization.path === "tribal") return civilization.technologyLevel <= 55;
  if (civilization.path === "city_state") return civilization.technologyLevel <= 70 && civilization.stability >= 25;
  if (civilization.path === "planetary") return civilization.technologyLevel >= 35 && civilization.stability >= 35;
  if (civilization.path === "galactic") return civilization.technologyLevel >= 45 && civilization.expansionDrive >= 45;
  if (civilization.path === "arcane_empire") return civilization.magicLevel >= 45 || universe.laws.magic.rating.value >= 65;
  if (civilization.path === "theocracy") return civilization.faithIntensity >= 45 || universe.laws.divinity.rating.value >= 65;
  if (civilization.path === "collective_mind") return civilization.stability >= 45 || universe.laws.consciousness.rating.value >= 65;
  if (civilization.path === "ascended") return civilization.fate === "ascension" || civilization.magicLevel + civilization.faithIntensity + civilization.technologyLevel >= 150;
  return civilization.extinctionRisk >= 45 || civilization.fate === "collapse";
}

export function lawsWithoutMetricTargets(laws: UniverseSummary["laws"]): UniverseSummary["laws"] {
  return {
    physics: { ...laws.physics, rules: laws.physics.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
    magic: { ...laws.magic, rules: laws.magic.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
    life: { ...laws.life, rules: laws.life.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
    consciousness: { ...laws.consciousness, rules: laws.consciousness.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
    divinity: { ...laws.divinity, rules: laws.divinity.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
    causality: { ...laws.causality, rules: laws.causality.rules.map((rule) => ({ ...rule, effectTargets: [] })) },
  };
}

export function listSourceFiles(root: string): string[] {
  const entries = readdirSync(root);
  return entries.flatMap((entry) => {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return listSourceFiles(fullPath);
    }
    return fullPath.endsWith(".ts") || fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}

export function rulesetContentHash(sourceRoot: string): string {
  const projectRoot = resolve(sourceRoot, "../..");
  const hash = createHash("sha256");
  for (const file of listSourceFiles(sourceRoot).sort()) {
    hash.update(relative(projectRoot, file).split(sep).join("/"));
    hash.update("\n");
    hash.update(readFileSync(file));
    hash.update("\n");
  }
  return hash.digest("hex");
}

export function pathFromTest(importMetaUrl: string, relativePath: string): string {
  return resolve(dirname(fileURLToPath(importMetaUrl)), relativePath);
}
