import { generateExplanations, generateObservationLog } from "./explain";
import { generateCivilizations } from "./civilizations";
import { generateGalaxies } from "./galaxies";
import { applyInterventions } from "./interventions";
import { generateLawInteractions, generateLaws } from "./laws";
import { generateMetrics } from "./metrics";
import { generateDescription, generateTagline, generateUniverseName } from "./names";
import { createRandomStream, formatSeed, normalizeSeed } from "./random";
import { createShareCode, createShareText, createShareUrl } from "./share";
import { getTemplate } from "./templates";
import { generateTimeline, summarizeTimelineImpact } from "./timeline";
import { RULESET_SHORT_CODE, RULESET_VERSION, type GenerateUniverseInput, type UniverseSummary } from "./types";

export function generateUniverse(input: GenerateUniverseInput): UniverseSummary {
  const seed = normalizeSeed(input.seed);
  const template = getTemplate(input.templateId);
  const root = createRandomStream(`${RULESET_VERSION}:${template.id}:${seed}`, "root");
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
  const shareCode = createShareCode(seed, template.id);
  const shareUrl = createShareUrl(seed, template.id);

  const summary: UniverseSummary = {
    seed,
    displaySeed: formatSeed(seed),
    rulesetVersion: RULESET_VERSION,
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
    galaxies,
    civilizations,
    miracleState: interventionResult.miracleState,
    explanations,
    observationLog,
  };

  return {
    ...summary,
    shareText: createShareText(summary),
  };
}
