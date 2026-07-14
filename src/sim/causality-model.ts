import type { CausalGraphBuilder, SubjectIndex } from "./causality-builder";
import type { RandomTraceSnapshot } from "./contracts/random";
import type { CausalGenerationManifest } from "./contracts/causality";
import type { GenerateUniverseInput, LawDomainId, MetricId } from "./types";
import type { CausalUniverseSource } from "./causality-source";

export type { CausalUniverseSource } from "./causality-source";

export type CausalMappingContext = {
  builder: CausalGraphBuilder;
  subjects: SubjectIndex;
  universe: CausalUniverseSource;
  trace: RandomTraceSnapshot;
  interventions: NonNullable<GenerateUniverseInput["interventions"]>;
  generation: CausalGenerationManifest;
};

export const AXIOMS = {
  templateResolution: "axiom:template-resolution",
  universeAssembly: "axiom:universe-assembly",
  lawGeneration: "axiom:law-generation",
  lawInteraction: "axiom:law-interaction",
  metricDerivation: "axiom:metric-derivation",
  timelineGeneration: "axiom:timeline-generation",
  timelineProjection: "axiom:timeline-impact-projection",
  spaceGeneration: "axiom:space-generation",
  biosphereGeneration: "axiom:biosphere-generation",
  civilizationGeneration: "axiom:civilization-generation",
  mythologyGeneration: "axiom:mythology-generation",
  interventionApplication: "axiom:intervention-application",
  explanationProjection: "axiom:explanation-projection",
  observationProjection: "axiom:observation-projection",
  shareProjection: "axiom:share-projection",
  eventEffectProjection: "axiom:event-effect-projection",
  stateValueDerivation: "axiom:state-value-derivation",
  summaryGrouping: "axiom:summary-grouping",
  summaryFiltering: "axiom:summary-filtering",
  authorizedFeedback: "axiom:authorized-feedback",
} as const;

export const metricIds: MetricId[] = [
  "age",
  "stability",
  "lifePotential",
  "civilizationPotential",
  "magicIntensity",
  "divineActivity",
  "causalityIntegrity",
];

export const lawDomainIds: LawDomainId[] = ["physics", "magic", "life", "consciousness", "divinity", "causality"];

export function metricAliases(metricId: MetricId): string[] {
  const aliases = [`metric:${metricId}`, `metric-${metricId}`];
  if (metricId === "lifePotential") aliases.push("metric-life");
  return aliases;
}
