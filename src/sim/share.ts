import { formatSeed, normalizeSeed } from "./random";
import { miracleDefinitions } from "./content/miracles";
import { DEFAULT_TEMPLATE_ID, getTemplate, getTemplateByShortCode } from "./templates";
import { RULESET_SHORT_CODE, RULESET_VERSION, type InterventionInput, type MiracleType, type UniverseSummary, type UniverseTemplateId } from "./types";

export type DecodedShareCode = {
  seed: string;
  templateId: UniverseTemplateId;
  rulesetVersion: string;
  interventions: InterventionInput[];
  warnings: string[];
};

export function createShareCode(seed: string, templateId: UniverseTemplateId, interventions: InterventionInput[] = []): string {
  const template = getTemplate(templateId);
  const baseCode = `${RULESET_SHORT_CODE}-${template.shortCode}-${normalizeSeed(seed)}`;
  return interventions.length > 0 ? `${baseCode}~I1~${encodeInterventions(interventions)}` : baseCode;
}

export function decodeShareCode(shareCode: string): DecodedShareCode | undefined {
  const [baseCode, interventionVersion, interventionPayload] = shareCode.trim().split("~");
  const [versionShort, templateShort, seed] = baseCode.toUpperCase().split("-");
  if (!versionShort || !templateShort || !seed) {
    return undefined;
  }
  const { templateId, warnings: templateWarnings } = decodeTemplateShortCode(templateShort);
  const { rulesetVersion, warnings: versionWarnings } = decodeRulesetShortCode(versionShort);
  const { interventions, warnings: interventionWarnings } = decodeInterventionPayload(interventionVersion, interventionPayload);
  return {
    seed: normalizeSeed(seed),
    templateId,
    rulesetVersion,
    interventions,
    warnings: [...templateWarnings, ...versionWarnings, ...interventionWarnings],
  };
}

export function createShareUrl(seed: string, templateId: UniverseTemplateId, interventions: InterventionInput[] = []): string {
  const template = getTemplate(templateId);
  const params = new URLSearchParams({
    s: normalizeSeed(seed),
    t: template.shortCode,
    v: RULESET_SHORT_CODE,
  });
  if (interventions.length > 0) {
    params.set("iv", "1");
    params.set("i", encodeInterventions(interventions));
  }
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
  const { interventions, warnings: interventionWarnings } = decodeInterventionPayload(params.get("iv") ? `I${params.get("iv")}` : undefined, params.get("i") ?? undefined);
  return {
    seed: normalizeSeed(seed),
    templateId,
    rulesetVersion,
    interventions,
    warnings: [...templateWarnings, ...versionWarnings, ...interventionWarnings],
  };
}

export function createShareText(summary: UniverseSummary): string {
  return [
    `【${summary.name}】`,
    `${summary.archetype}｜Seed ${formatSeed(summary.seed)}`,
    `分享码 ${summary.shareCode}`,
    summary.miracleState.appliedMiracles.length > 0 ? `包含 ${summary.miracleState.appliedMiracles.length} 次可复现干预` : "基础宇宙未包含干预",
    summary.tagline,
  ].join("\n");
}

function encodeInterventions(interventions: InterventionInput[]): string {
  const compact = interventions.map((entry) => [entry.id, entry.miracleType, entry.targetId]);
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeInterventionPayload(
  version: string | undefined,
  payload: string | undefined,
): { interventions: InterventionInput[]; warnings: string[] } {
  if (!version && !payload) {
    return { interventions: [], warnings: [] };
  }
  if (version !== "I1" || !payload) {
    return { interventions: [], warnings: ["干预分享数据版本不受支持，已忽略干预记录。"] };
  }
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(parsed)) {
      throw new Error("干预数据不是数组。");
    }
    const knownTypes = new Set<string>(miracleDefinitions.map((definition) => definition.type));
    const interventions = parsed.map((entry, index) => {
      if (!Array.isArray(entry) || entry.length !== 3 || entry.some((value) => typeof value !== "string") || !knownTypes.has(entry[1])) {
        throw new Error(`第 ${index + 1} 条干预数据无效。`);
      }
      return {
        id: entry[0],
        miracleType: entry[1] as MiracleType,
        targetId: entry[2],
      };
    });
    return { interventions, warnings: [] };
  } catch {
    return { interventions: [], warnings: ["干预分享数据损坏，已忽略干预记录。"] };
  }
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
