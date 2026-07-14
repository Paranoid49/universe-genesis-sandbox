import { CausalGraphBuilder, SubjectIndex } from "./causality-builder";
import {
  addLawsAndInteractions,
  addMetricsAndUniverseNarrative,
  addRootsAndAxioms,
  addTemplateAndName,
} from "./causality-foundations";
import { addInterventions, addTimelineAndEffects, addTimelineImpact } from "./causality-history";
import type { CausalMappingContext, CausalUniverseSource } from "./causality-model";
import { addExplanationsAndObservations, addInterventionResults, addShareResults } from "./causality-projections";
import { addCivilizations, addSpace } from "./causality-world";
import { createCausalGenerationManifest } from "./causality-generation";
import { assertCausalGraphStructure } from "./causality-query";
import type { CausalGenerationManifest } from "./contracts/causality";
import type { RandomTraceSnapshot } from "./contracts/random";
import type { GenerateUniverseInput } from "./types";
import { assertSummaryCollectionEvidence } from "./causality-summary-validation";

export type CausalGenerationEnvelope = {
  universe: CausalUniverseSource;
  randomTrace: RandomTraceSnapshot;
  interventions: NonNullable<GenerateUniverseInput["interventions"]>;
  generation: CausalGenerationManifest;
};

export function buildCausalGraphStructure(envelope: CausalGenerationEnvelope) {
  const { universe, randomTrace, interventions, generation } = envelope;
  const expectedGeneration = createCausalGenerationManifest({
    seed: universe.seed,
    rulesetVersion: universe.rulesetVersion,
    templateId: universe.templateId,
  }, interventions);
  if (JSON.stringify(generation) !== JSON.stringify(expectedGeneration) || randomTrace.generationId !== generation.id) {
    throw new Error("领域结果、输入与随机追踪不属于同一次生成。");
  }
  const context: CausalMappingContext = {
    builder: new CausalGraphBuilder(universe),
    subjects: new SubjectIndex(),
    universe,
    trace: randomTrace,
    interventions,
    generation,
  };

  addRootsAndAxioms(context);
  addTemplateAndName(context);
  addLawsAndInteractions(context);
  addInterventions(context);
  addMetricsAndUniverseNarrative(context);
  addTimelineAndEffects(context);
  addTimelineImpact(context);
  addSpace(context);
  addCivilizations(context);
  addInterventionResults(context);
  addExplanationsAndObservations(context);
  addShareResults(context);

  const result = context.builder.finish(randomTrace, generation);
  assertCausalGraphStructure(result.graph, expectedGeneration);
  assertSummaryCollectionEvidence(result.graph, universe);
  return result;
}
