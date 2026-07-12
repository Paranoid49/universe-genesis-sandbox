import type { CivilizationPathProfile } from "../content/civilizations";
import type { CivilizationEventType, CivilizationFate, CivilizationPath, MythologySystem } from "../types";

export type CivilizationRecipeValues = {
  technologyLevel: number;
  magicLevel: number;
  faithIntensity: number;
  expansionDrive: number;
  stability: number;
  extinctionRisk: number;
};

export function civilizationPathWeight(
  profile: CivilizationPathProfile,
  values: CivilizationRecipeValues,
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

export function civilizationFate(path: CivilizationPath, values: CivilizationRecipeValues, seedFate: CivilizationFate): CivilizationFate {
  if (values.extinctionRisk >= 88 || path === "lost") return "collapse";
  if (path === "ascended" || path === "arcane_empire" || (values.magicLevel >= 48 && values.faithIntensity >= 38)) return "ascension";
  if (path === "collective_mind" || (values.stability >= 50 && (values.faithIntensity >= 30 || path === "planetary"))) return "symbiosis";
  if (values.expansionDrive < 60 && values.technologyLevel < 55) return "stagnation";
  if (path === "galactic" && values.stability >= 52 && values.extinctionRisk < 62) return "unknown";
  if (path === "galactic" || (values.expansionDrive >= 55 && values.technologyLevel >= 40)) return "expansion";
  if (values.extinctionRisk >= 72 || seedFate === "collapse") return "collapse";
  return seedFate === "expansion" ? "unknown" : seedFate;
}

export function civilizationEventWeight(
  type: CivilizationEventType,
  civilization: { path: CivilizationPath; mythology: MythologySystem; fate: CivilizationFate; values: CivilizationRecipeValues },
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
