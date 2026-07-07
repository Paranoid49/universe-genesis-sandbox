import { formatSeed, normalizeSeed } from "./random";
import { DEFAULT_TEMPLATE_ID, getTemplate, getTemplateByShortCode } from "./templates";
import { RULESET_SHORT_CODE, RULESET_VERSION, type UniverseSummary, type UniverseTemplateId } from "./types";

export type DecodedShareCode = {
  seed: string;
  templateId: UniverseTemplateId;
  rulesetVersion: string;
  warnings: string[];
};

export function createShareCode(seed: string, templateId: UniverseTemplateId): string {
  const template = getTemplate(templateId);
  return `${RULESET_SHORT_CODE}-${template.shortCode}-${normalizeSeed(seed)}`;
}

export function decodeShareCode(shareCode: string): DecodedShareCode | undefined {
  const [versionShort, templateShort, seed] = shareCode.trim().toUpperCase().split("-");
  if (!versionShort || !templateShort || !seed) {
    return undefined;
  }
  const { templateId, warnings: templateWarnings } = decodeTemplateShortCode(templateShort);
  const { rulesetVersion, warnings: versionWarnings } = decodeRulesetShortCode(versionShort);
  return {
    seed: normalizeSeed(seed),
    templateId,
    rulesetVersion,
    warnings: [...templateWarnings, ...versionWarnings],
  };
}

export function createShareUrl(seed: string, templateId: UniverseTemplateId): string {
  const template = getTemplate(templateId);
  const params = new URLSearchParams({
    s: normalizeSeed(seed),
    t: template.shortCode,
    v: RULESET_SHORT_CODE,
  });
  return `?${params.toString()}`;
}

export function decodeShareParams(search: string): DecodedShareCode | undefined {
  const params = new URLSearchParams(search);
  const seed = params.get("s");
  const templateShort = params.get("t");
  const versionShort = params.get("v");
  if (!seed) {
    return undefined;
  }
  const { templateId, warnings: templateWarnings } = decodeTemplateShortCode(templateShort ?? "");
  const { rulesetVersion, warnings: versionWarnings } = decodeRulesetShortCode(versionShort ?? RULESET_SHORT_CODE);
  return {
    seed: normalizeSeed(seed),
    templateId,
    rulesetVersion,
    warnings: [...templateWarnings, ...versionWarnings],
  };
}

export function createShareText(summary: UniverseSummary): string {
  return [
    `【${summary.name}】`,
    `${summary.archetype}｜Seed ${formatSeed(summary.seed)}`,
    `分享码 ${summary.shareCode}`,
    summary.tagline,
  ].join("\n");
}

export function shortCodeForRuleset(rulesetVersion: string): string {
  if (rulesetVersion === RULESET_VERSION) {
    return RULESET_SHORT_CODE;
  }
  return rulesetVersion.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function decodeTemplateShortCode(shortCode: string): { templateId: UniverseTemplateId; warnings: string[] } {
  const template = getTemplateByShortCode(shortCode);
  if (template) {
    return { templateId: template.id, warnings: [] };
  }
  return {
    templateId: DEFAULT_TEMPLATE_ID,
    warnings: [`无法识别模板短码 ${shortCode || "空值"}，已回退到默认模板。`],
  };
}

function decodeRulesetShortCode(shortCode: string): { rulesetVersion: string; warnings: string[] } {
  const normalized = shortCode.toUpperCase();
  if (normalized === RULESET_SHORT_CODE) {
    return { rulesetVersion: RULESET_VERSION, warnings: [] };
  }
  return {
    rulesetVersion: RULESET_VERSION,
    warnings: [`规则版本短码 ${shortCode || "空值"} 不受当前版本支持，已按 ${RULESET_VERSION} 解析。`],
  };
}
