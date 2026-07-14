import type { UniverseSummary } from "./types";

export type InterfaceStateValueDefinition = {
  label: string;
  value: unknown;
  formulaId: string;
  formula: string;
  operands: Array<{ label: string; value: unknown; causeSubjects: string[] }>;
  randomScopes: string[];
};

export function findInterfaceStateValueDefinition(universe: UniverseSummary, subjectId: string): InterfaceStateValueDefinition | undefined {
  for (const law of Object.values(universe.laws)) {
    const lawFields: Record<string, [string, unknown]> = {
      title: ["法则领域标题", law.title],
      "rating.value": ["法则领域评分", law.rating.value],
      "rating.label": ["法则领域评级", law.rating.label],
      "rating.explanation": ["法则领域解释", law.rating.explanation],
      traits: ["法则领域特征", law.traits],
      cost: ["法则领域代价", law.cost],
    };
    const lawField = fieldDefinition(subjectId, law.id, lawFields);
    if (lawField) return lawField;
    for (const rule of law.rules) {
      const ruleFields: Record<string, [string, unknown]> = {
        name: ["规则名称", rule.name],
        value: ["规则值", rule.value],
        label: ["规则标签", rule.label],
        polarity: ["规则极性", rule.polarity],
        explanation: ["规则解释", rule.explanation],
        effectTargets: ["规则影响目标", rule.effectTargets],
      };
      const ruleField = fieldDefinition(subjectId, rule.id, ruleFields);
      if (ruleField) return ruleField;
    }
  }
  for (const interaction of universe.lawInteractions) {
    const fields: Record<string, [string, unknown]> = {
      kind: ["法则关系类型", interaction.kind],
      impact: ["法则关系影响", interaction.impact],
      sourceLawId: ["来源规则", interaction.sourceLawId],
      targetLawId: ["目标规则", interaction.targetLawId],
      explanation: ["法则关系解释", interaction.explanation],
    };
    const definition = fieldDefinition(subjectId, interaction.id, fields);
    if (definition) return definition;
  }
  if (subjectId === "miracle-state.overuseLevel") {
    return definition("反噬状态", universe.miracleState.overuseLevel, "miracle-state", "从当前干预状态投影反噬等级。");
  }
  for (const miracle of universe.miracleState.appliedMiracles) {
    if (subjectId === `${miracle.id}.type`) return definition("奇迹类型", miracle.type, miracle.id, "从已应用奇迹记录投影类型。");
    for (const [index, shift] of miracle.probabilityShifts.entries()) {
      const owner = `${miracle.id}.probability-shift.${shift.eventType}.${index + 1}`;
      const fields: Record<string, [string, unknown]> = {
        eventType: ["概率偏移事件类型", shift.eventType],
        delta: ["概率偏移量", shift.delta],
        explanation: ["概率偏移解释", shift.explanation],
      };
      const definitionValue = fieldDefinition(subjectId, owner, fields);
      if (definitionValue) return definitionValue;
    }
  }
  for (const log of universe.miracleState.interventionLog) {
    const fields: Record<string, [string, unknown]> = {
      ageLabel: ["干预纪元", log.ageLabel],
      miracleType: ["干预类型", log.miracleType],
      targetLabel: ["干预目标", log.targetLabel],
      directResult: ["干预直接结果", log.directResult],
      longTermConsequence: ["干预长期后果", log.longTermConsequence],
    };
    const definitionValue = fieldDefinition(subjectId, log.id, fields);
    if (definitionValue) return definitionValue;
  }
  return undefined;
}

function fieldDefinition(subjectId: string, ownerSubject: string, fields: Record<string, [string, unknown]>): InterfaceStateValueDefinition | undefined {
  const prefix = `${ownerSubject}.`;
  if (!subjectId.startsWith(prefix)) return undefined;
  const field = subjectId.slice(prefix.length);
  const entry = fields[field];
  return entry ? definition(entry[0], entry[1], ownerSubject, `从生产主题 ${ownerSubject} 精确投影字段 ${field}。`) : undefined;
}

function definition(label: string, value: unknown, causeSubject: string, formula: string): InterfaceStateValueDefinition {
  return {
    label,
    value,
    formulaId: "formula:registered-interface-field@1",
    formula,
    operands: [{ label: "生产字段值", value, causeSubjects: [causeSubject] }],
    randomScopes: [],
  };
}
