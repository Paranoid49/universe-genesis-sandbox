import { miracleDefinitions } from "./content/miracles";
import { UniverseInputError } from "./errors";
import { UNIVERSE_TEMPLATES } from "./templates";
import type { GenerateUniverseInput, InterventionInput, MiracleType, UniverseTemplateId } from "./types";

const interventionIdPattern = /^[A-Za-z0-9._-]{1,64}$/;
const templateIds = new Set<string>(UNIVERSE_TEMPLATES.map((template) => template.id));
const miracleTypes = new Set<string>(miracleDefinitions.map((definition) => definition.type));

export function assertGenerateUniverseInput(input: unknown): asserts input is GenerateUniverseInput {
  if (!input || typeof input !== "object") {
    throw new UniverseInputError("INVALID_INPUT", "input", "宇宙生成输入必须是对象。");
  }

  const candidate = input as Record<string, unknown>;
  if (typeof candidate.seed !== "string" || candidate.seed.trim().length === 0 || candidate.seed.length > 128) {
    throw new UniverseInputError("INVALID_SEED", "seed", "Seed 必须是长度为 1 至 128 的非空字符串。");
  }

  if (candidate.templateId !== undefined && (typeof candidate.templateId !== "string" || !templateIds.has(candidate.templateId))) {
    throw new UniverseInputError("INVALID_TEMPLATE", "templateId", `未知宇宙模板：${String(candidate.templateId)}。`);
  }

  if (candidate.interventions === undefined) {
    return;
  }
  if (!Array.isArray(candidate.interventions) || candidate.interventions.length > 64) {
    throw new UniverseInputError("INVALID_INTERVENTION", "interventions", "干预输入必须是最多包含 64 项的数组。");
  }

  const ids = new Set<string>();
  candidate.interventions.forEach((entry, index) => {
    assertInterventionInput(entry, index, ids);
  });
}

export function isUniverseTemplateId(value: string): value is UniverseTemplateId {
  return templateIds.has(value);
}

export function isMiracleType(value: string): value is MiracleType {
  return miracleTypes.has(value);
}

function assertInterventionInput(entry: unknown, index: number, ids: Set<string>): asserts entry is InterventionInput {
  const path = `interventions[${index}]`;
  if (!entry || typeof entry !== "object") {
    throw new UniverseInputError("INVALID_INTERVENTION", path, `${path} 必须是对象。`);
  }
  const candidate = entry as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !interventionIdPattern.test(candidate.id)) {
    throw new UniverseInputError("INVALID_INTERVENTION", `${path}.id`, "干预 ID 只能包含字母、数字、点、下划线和连字符，长度不能超过 64。");
  }
  if (ids.has(candidate.id)) {
    throw new UniverseInputError("DUPLICATE_INTERVENTION_ID", `${path}.id`, `干预 ID ${candidate.id} 重复。`);
  }
  ids.add(candidate.id);

  if (typeof candidate.miracleType !== "string" || !isMiracleType(candidate.miracleType)) {
    throw new UniverseInputError("INVALID_INTERVENTION", `${path}.miracleType`, `未知奇迹类型：${String(candidate.miracleType)}。`);
  }
  if (typeof candidate.targetId !== "string" || candidate.targetId.trim().length === 0 || candidate.targetId.length > 160) {
    throw new UniverseInputError("INVALID_INTERVENTION", `${path}.targetId`, "奇迹目标 ID 必须是长度为 1 至 160 的非空字符串。");
  }
}
