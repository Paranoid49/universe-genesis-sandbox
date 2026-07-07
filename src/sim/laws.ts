import { clamp, round, type RandomStream } from "./random";
import { lawCosts, lawDomainNames, lawRuleCatalog, lawSources, lawTraits } from "./content/laws";
import type { LawDomain, LawDomainId, LawInteraction, MetricId, StructuredLaw, UniverseLaws } from "./types";
import type { UniverseTemplate } from "./templates";

export function generateLaws(template: UniverseTemplate, root: RandomStream): UniverseLaws {
  return {
    physics: generateDomain("physics", template, root.fork("laws.physics")),
    magic: generateDomain("magic", template, root.fork("laws.magic")),
    life: generateDomain("life", template, root.fork("laws.life")),
    consciousness: generateDomain("consciousness", template, root.fork("laws.consciousness")),
    divinity: generateDomain("divinity", template, root.fork("laws.divinity")),
    causality: generateDomain("causality", template, root.fork("laws.causality")),
  };
}

export function generateLawInteractions(laws: UniverseLaws, rng: RandomStream): LawInteraction[] {
  const allRules = flattenStructuredLaws(laws);
  const pairs: Array<{ source: StructuredLaw; target: StructuredLaw; kind: LawInteraction["kind"] }> = [
    { source: strongestRule(laws.physics.rules), target: strongestRule(laws.life.rules), kind: "synergy" },
    { source: strongestRule(laws.magic.rules), target: strongestRule(laws.causality.rules), kind: "conflict" },
    { source: strongestRule(laws.consciousness.rules), target: strongestRule(laws.divinity.rules), kind: "synergy" },
    { source: strongestRule(laws.physics.rules), target: strongestRule(laws.magic.rules), kind: "constraint" },
  ];

  return pairs.map(({ source, target, kind }, index) => {
    const impactBase = Math.abs(source.value - target.value) + rng.int(4, 16);
    const impact = round(clamp(kind === "synergy" ? impactBase : -impactBase, -40, 40));
    return {
      id: `interaction-${index + 1}`,
      sourceLawId: source.id,
      targetLawId: target.id,
      kind,
      impact,
      explanation: interactionExplanation(source, target, kind, impact),
    };
  }).filter((interaction) => allRules.some((rule) => rule.id === interaction.sourceLawId) && allRules.some((rule) => rule.id === interaction.targetLawId));
}

export function flattenStructuredLaws(laws: UniverseLaws): StructuredLaw[] {
  return Object.values(laws).flatMap((domain) => domain.rules);
}

function generateDomain(id: LawDomainId, template: UniverseTemplate, rng: RandomStream): LawDomain {
  const value = round(clamp(template.weights[id] + rng.range(-13, 13)));
  const selectedTraits = uniquePicks(lawTraits[id], rng, 3);
  const title = `${template.name}的${lawDomainNames[id]}`;
  const rules = generateStructuredRules(id, value, rng);

  return {
    id,
    title,
    rating: {
      value,
      label: labelFor(value),
      explanation: explanationFor(id, value, template.name),
    },
    source: rng.pick(lawSources[id]),
    traits: selectedTraits,
    cost: rng.pick(lawCosts[id]),
    rules,
  };
}

function generateStructuredRules(id: LawDomainId, domainValue: number, rng: RandomStream): StructuredLaw[] {
  const catalog = uniquePicks(lawRuleCatalog[id], rng, 2);
  return catalog.map((rule, index) => {
    const value = round(clamp(domainValue + rng.range(-18, 18)));
    return {
      ...rule,
      id: `${id}.${stableRuleId(rule.name)}.${index + 1}`,
      domain: id,
      value,
      label: labelFor(value),
      explanation: structuredRuleExplanation(rule.name, id, value, rule.polarity, rule.effectTargets),
    };
  });
}

function labelFor(value: number): string {
  if (value < 20) return "近乎沉寂";
  if (value < 40) return "微弱";
  if (value < 60) return "平衡";
  if (value < 80) return "强盛";
  return "极盛";
}

function explanationFor(id: LawDomainId, value: number, templateName: string): string {
  const direction = value >= 70 ? "成为主要驱动力" : value <= 30 ? "被压制到边缘" : "保持可观影响";
  return `${templateName}中，${lawDomainNames[id]}${direction}，数值为 ${value}。`;
}

function structuredRuleExplanation(
  name: string,
  domain: LawDomainId,
  value: number,
  polarity: StructuredLaw["polarity"],
  effectTargets: MetricId[],
): string {
  const effect = polarity === "support" ? "提供正向支撑" : polarity === "pressure" ? "形成持续压力" : "带来高波动影响";
  return `${lawDomainNames[domain]}中的“${name}”数值为 ${value}，会对${effectTargets.map(metricName).join("、")}${effect}。`;
}

function interactionExplanation(source: StructuredLaw, target: StructuredLaw, kind: LawInteraction["kind"], impact: number): string {
  const kindText = kind === "synergy" ? "协同" : kind === "conflict" ? "冲突" : "约束";
  return `“${source.name}”与“${target.name}”形成${kindText}关系，综合影响值为 ${impact}。`;
}

function strongestRule(rules: StructuredLaw[]): StructuredLaw {
  return [...rules].sort((left, right) => right.value - left.value)[0];
}

function stableRuleId(value: string): string {
  return value
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "")
    .split("")
    .map((char) => char.charCodeAt(0).toString(36))
    .join("")
    .slice(0, 16);
}

function metricName(metric: MetricId): string {
  const names: Record<MetricId, string> = {
    age: "宇宙年龄",
    stability: "稳定度",
    lifePotential: "生命潜力",
    civilizationPotential: "文明潜力",
    magicIntensity: "魔法强度",
    divineActivity: "神性活跃度",
    causalityIntegrity: "因果完整度",
  };
  return names[metric];
}

function uniquePicks<T>(items: readonly T[], rng: RandomStream, count: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  while (pool.length > 0 && result.length < count) {
    const index = rng.int(0, pool.length - 1);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}
