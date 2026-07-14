import type { RandomDecisionParameters } from "./contracts/random";

export function cloneDecisionParameters(parameters: RandomDecisionParameters): RandomDecisionParameters {
  if (parameters.kind === "pick") return { kind: "pick", candidates: [...parameters.candidates] };
  if (parameters.kind === "weighted") return {
    kind: "weighted",
    candidates: parameters.candidates.map((candidate) => ({ ...candidate })),
  };
  return { ...parameters };
}
