import { MATERIAL_EXPANSE } from "./constitution-catalog";
import { createInitialUniverseState } from "./runtime-state";
import type { UniverseTemplateId } from "./types";

export type LegacyCreateUniverseStateInput = {
  seed: string;
  rulesetVersion?: string;
  templateId: UniverseTemplateId;
};

export function createLegacyInitialUniverseState(input: LegacyCreateUniverseStateInput) {
  return createInitialUniverseState({ seed: input.seed, constitution: MATERIAL_EXPANSE });
}
