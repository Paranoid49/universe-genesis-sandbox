import type { UniverseSummary } from "./types";

export type CausalUniverseSource = Omit<UniverseSummary, "causalGraph">;
