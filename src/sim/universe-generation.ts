import { generateCivilizations } from "./civilizations";
import { createCausalGenerationManifest } from "./causality-generation";
import type { CausalGenerationManifest } from "./contracts/causality";
import { generateExplanations, generateObservationLog } from "./explain";
import { generateGalaxies } from "./galaxies";
import { applyInterventions } from "./interventions";
import { generateLawInteractions, generateLaws } from "./laws";
import { generateMetrics } from "./metrics";
import { generateDescription, generateTagline, generateUniverseName } from "./names";
import { createRandomStream, formatSeed, normalizeSeed, type RandomStream } from "./random";
import { createShareCode, createShareText, createShareUrl } from "./share";
import { getTemplate } from "./templates";
import { generateTimeline, summarizeTimelineImpact } from "./timeline";
import { RULESET_SHORT_CODE, type GenerateUniverseInput, type UniverseSummary } from "./types";
import { assertGenerateUniverseInput } from "./validation";

export type UniverseGenerationResult = {
  baseSummary: Omit<UniverseSummary, "causalGraph">;
  root: RandomStream;
  generation: CausalGenerationManifest;
};

export function generateUniverseData(
  input: GenerateUniverseInput,
  trackCausalDecisions: boolean,
): UniverseGenerationResult {
  assertGenerateUniverseInput(input);
  const seed = normalizeSeed(input.seed);
  const template = getTemplate(input.templateId);
  const generation = createCausalGenerationManifest({ seed, rulesetVersion: input.rulesetVersion, templateId: template.id }, input.interventions ?? []);
  const root = createRandomStream(`${input.rulesetVersion}:${template.id}:${seed}`, "root", trackCausalDecisions, generation.id);
  const laws = generateLaws(template, root);
  const lawInteractions = generateLawInteractions(laws, root.fork("laws.interactions"));
  const metrics = generateMetrics(template, laws, lawInteractions, root.fork("metrics"));
  const name = generateUniverseName(template, root.fork("names.universe"));
  const tagline = generateTagline(template, laws, metrics);
  const description = generateDescription(template, laws, metrics);
  const baseTimeline = generateTimeline(template, laws, metrics, root.fork("timeline"));
  const baseTimelineImpact = summarizeTimelineImpact(baseTimeline, metrics);
  const galaxies = generateGalaxies({ laws, metrics, timelineImpact: baseTimelineImpact }, root.fork("galaxies"));
  const civilizations = generateCivilizations({ laws, metrics, timelineImpact: baseTimelineImpact, galaxies }, root.fork("civilizations"));
  const interventionResult = applyInterventions(
    {
      seed,
      metrics,
      timeline: baseTimeline,
      galaxies,
      civilizations,
    },
    input.interventions,
    root.fork("interventions"),
  );
  const finalMetrics = interventionResult.metrics;
  const finalTimeline = interventionResult.timeline;
  const finalTimelineImpact = summarizeTimelineImpact(finalTimeline, finalMetrics);
  const explanations = generateExplanations(template, laws, finalMetrics, finalTimeline);
  const observationLog = generateObservationLog(finalTimeline, finalMetrics, laws);
  const shareCode = createShareCode(seed, template.id, input.interventions);
  const shareUrl = createShareUrl(seed, template.id, input.interventions);

  const baseSummary: Omit<UniverseSummary, "causalGraph"> = {
    seed,
    displaySeed: formatSeed(seed),
    rulesetVersion: input.rulesetVersion,
    rulesetShortCode: RULESET_SHORT_CODE,
    templateId: template.id,
    templateShortCode: template.shortCode,
    shareCode,
    shareUrl,
    shareText: "",
    name,
    archetype: template.archetype,
    tagline,
    description,
    metrics: finalMetrics,
    laws,
    lawInteractions,
    timeline: finalTimeline,
    timelineImpact: finalTimelineImpact,
    galaxies: interventionResult.galaxies,
    civilizations: interventionResult.civilizations,
    miracleState: interventionResult.miracleState,
    explanations,
    observationLog,
  };

  baseSummary.shareText = createShareText(baseSummary as UniverseSummary);
  return { baseSummary, root, generation };
}

export function assertUniverseReplayMatches(
  initial: Omit<UniverseSummary, "causalGraph">,
  replay: Omit<UniverseSummary, "causalGraph">,
): void {
  if (JSON.stringify(initial) !== JSON.stringify(replay)) {
    throw new Error("因果追踪重放与首次生成的领域结果不一致，已拒绝返回因果图。");
  }
}
