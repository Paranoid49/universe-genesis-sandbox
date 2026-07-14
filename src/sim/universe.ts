import { buildUniverseCausalGraph } from "./causality";
import type { GenerateUniverseInput, UniverseSummary } from "./types";
import { generateUniverseData } from "./universe-generation";

export function generateUniverse(input: GenerateUniverseInput): UniverseSummary {
  const stableInput: GenerateUniverseInput = {
    ...input,
    interventions: input.interventions?.map((entry) => ({ ...entry })),
  };
  const { baseSummary } = generateUniverseData(stableInput, false);
  const summary = baseSummary as UniverseSummary;
  let causalGraph: UniverseSummary["causalGraph"] | undefined;
  Object.defineProperty(summary, "causalGraph", {
    enumerable: false,
    configurable: false,
    get: () => {
      if (!causalGraph) {
        causalGraph = buildUniverseCausalGraph(stableInput, baseSummary);
      }
      return causalGraph;
    },
  });
  return summary;
}

export function generateCausalUniverse(input: GenerateUniverseInput): UniverseSummary {
  const universe = generateUniverse(input);
  void universe.causalGraph;
  return universe;
}
