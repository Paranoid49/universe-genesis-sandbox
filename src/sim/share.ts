import { formatSeed, normalizeSeed } from "./random";
import { DEFAULT_TEMPLATE_ID, getTemplate, getTemplateByShortCode } from "./templates";
import { RULESET_SHORT_CODE, RULESET_VERSION, type UniverseSummary, type UniverseTemplateId } from "./types";

const LEGACY_RULESET_SHORT_CODES: Record<string, string> = {
  UGS01: "ugs-ruleset@0.1.0",
};

export type DecodedShareCode = {
  seed: string;
  templateId: UniverseTemplateId;
  rulesetVersion: string;
  warnings: string[];
};

export function createShareCode(seed: string, templateId: UniverseTemplateId, rulesetVersion = RULESET_VERSION): string {
  const template = getTemplate(templateId);
  return `${shortCodeForRuleset(rulesetVersion)}-${template.shortCode}-${normalizeSeed(seed)}`;
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

export function createShareUrl(seed: string, templateId: UniverseTemplateId, rulesetVersion = RULESET_VERSION): string {
  const template = getTemplate(templateId);
  const params = new URLSearchParams({
    s: normalizeSeed(seed),
    t: template.shortCode,
    v: shortCodeForRuleset(rulesetVersion),
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
  const legacyEntry = Object.entries(LEGACY_RULESET_SHORT_CODES).find(([, version]) => version === rulesetVersion);
  if (legacyEntry) {
    return legacyEntry[0];
  }
  return rulesetVersion.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function rulesetForShortCode(shortCode: string): string {
  const normalized = shortCode.toUpperCase();
  if (normalized === RULESET_SHORT_CODE) {
    return RULESET_VERSION;
  }
  return LEGACY_RULESET_SHORT_CODES[normalized] ?? shortCode;
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
  const legacyVersion = LEGACY_RULESET_SHORT_CODES[normalized];
  if (legacyVersion) {
    return {
      rulesetVersion: legacyVersion,
      warnings: [`规则版本短码 ${normalized} 对应旧规则版本 ${legacyVersion}；当前应用仅生成 ${RULESET_VERSION}，打开后结果可能按当前规则重新解释。`],
    };
  }
  return {
    rulesetVersion: RULESET_VERSION,
    warnings: [`无法识别规则版本短码 ${shortCode || "空值"}，已回退到当前规则版本。`],
  };
}
