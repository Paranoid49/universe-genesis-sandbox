import { generateExplanations, generateObservationLog } from "./explain";
import { generateLaws } from "./laws";
import { generateMetrics } from "./metrics";
import { generateDescription, generateTagline, generateUniverseName } from "./names";
import { createRandomStream, formatSeed, normalizeSeed } from "./random";
import { createShareCode, createShareText, createShareUrl } from "./share";
import { getTemplate } from "./templates";
import { generateTimeline } from "./timeline";
import { RULESET_SHORT_CODE, RULESET_VERSION, type GenerateUniverseInput, type UniverseSummary } from "./types";

export function generateUniverse(input: GenerateUniverseInput): UniverseSummary {
  const seed = normalizeSeed(input.seed);
  const template = getTemplate(input.templateId);
  const root = createRandomStream(`${RULESET_VERSION}:${template.id}:${seed}`, "root");
  const laws = generateLaws(template, root);
  const metrics = generateMetrics(template, laws, root.fork("metrics"));
  const name = generateUniverseName(template, root.fork("names.universe"));
  const tagline = generateTagline(template, laws, metrics);
  const description = generateDescription(template, laws, metrics);
  const timeline = generateTimeline(template, laws, metrics, root.fork("timeline"));
  const explanations = generateExplanations(template, laws, metrics, timeline);
  const observationLog = generateObservationLog(timeline, metrics, laws);
  const shareCode = createShareCode(seed, template.id, RULESET_VERSION);
  const shareUrl = createShareUrl(seed, template.id, RULESET_VERSION);

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
    metrics,
    laws,
    timeline,
    explanations,
    observationLog,
  };

  return {
    ...summary,
    shareText: createShareText(summary),
  };
}
