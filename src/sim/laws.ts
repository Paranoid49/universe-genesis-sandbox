import { clamp, round, type RandomStream } from "./random";
import type { LawDomain, LawDomainId, LawInteraction, MetricId, StructuredLaw, UniverseLaws } from "./types";
import type { UniverseTemplate } from "./templates";

const domainNames: Record<LawDomainId, string> = {
  physics: "物理法则",
  magic: "魔法法则",
  life: "生命法则",
  consciousness: "意识法则",
  divinity: "神性法则",
  causality: "因果与时间法则",
};

const sources: Record<LawDomainId, string[]> = {
  physics: ["真空涨落", "初始奇点", "黑洞蒸发残响", "暗物质潮汐", "第一束背景辐射"],
  magic: ["恒星死亡释放的灵质", "古老真名的回声", "维度膜间的渗漏", "生命梦境的沉积", "因果裂缝中的余焰"],
  life: ["重元素尘埃", "温和恒星风", "灵魂孢子", "深海热泉网络", "自复制矿物晶格"],
  consciousness: ["神经复杂度跃迁", "梦境底层海", "信息自指循环", "灵魂回声", "集体记忆沉积"],
  divinity: ["文明信仰反馈", "宇宙秩序自我人格化", "恒星意志", "机械计算神格", "死亡与梦境边界"],
  causality: ["时间箭头张力", "命运闭环", "观测者回声", "预言残留", "创世时的第一道选择"],
};

const traits: Record<LawDomainId, string[]> = {
  physics: ["恒星形成规律清晰", "重元素分布不均", "空间曲率存在局部褶皱", "真空衰变风险可测", "引力常数有微弱纪元漂移"],
  magic: ["施法需要代价", "魔力随恒星死亡增强", "灵质会污染物理常数", "命名能短暂改变实体边界", "仪式比天赋更可靠"],
  life: ["宜居窗口狭窄", "复杂生命依赖灾变筛选", "非碳基生命偶尔出现", "生命会改造局部魔法环境", "灭绝压力推动快速适应"],
  consciousness: ["梦境可影响现实", "灵魂可被记录", "记忆具备法则权重", "集体意识能形成实体", "自我认知会改变命运概率"],
  divinity: ["信仰能反向塑造神格", "神明受到法则约束", "奇迹存在冷却代价", "神战会污染纪元", "神性更偏向象征而非全能"],
  causality: ["预言并不总可靠", "局部时间可回流", "因果裂缝会吞噬解释", "命运存在弹性", "重大选择会形成历史锁点"],
};

const costs: Record<LawDomainId, string[]> = {
  physics: ["稳定来自低奇迹密度", "高能事件会放大结构缺陷", "过度稳定会压低异常可能"],
  magic: ["每次改写现实都会留下熵债", "魔法越强，因果越容易松动", "施法会消耗记忆、寿命或星光"],
  life: ["生命繁荣会提高灾变可见度", "复杂性越高，灭绝链越长", "意识出现后生态不再完全中立"],
  consciousness: ["梦境渗透会削弱客观历史", "灵魂保存需要付出记忆代价", "集体意识容易压制个体命运"],
  divinity: ["神性越活跃，凡世越难保持自主", "信仰失衡会引发神格饥荒", "奇迹会向未来转嫁风险"],
  causality: ["稳定因果会限制奇迹", "裂缝越多，复现难度越高", "时间回流会累积未偿还事件"],
};

const ruleCatalog: Record<LawDomainId, Array<Omit<StructuredLaw, "id" | "domain" | "value" | "label" | "explanation">>> = {
  physics: [
    { name: "恒星形成效率", effectTargets: ["stability", "lifePotential"], polarity: "support" },
    { name: "重元素生成率", effectTargets: ["lifePotential", "civilizationPotential"], polarity: "support" },
    { name: "真空衰变压力", effectTargets: ["stability", "causalityIntegrity"], polarity: "pressure" },
    { name: "空间曲率弹性", effectTargets: ["age", "stability", "causalityIntegrity"], polarity: "volatile" },
  ],
  magic: [
    { name: "灵质通量", effectTargets: ["magicIntensity", "lifePotential"], polarity: "support" },
    { name: "施法代价", effectTargets: ["magicIntensity", "civilizationPotential"], polarity: "pressure" },
    { name: "魔法污染", effectTargets: ["stability", "causalityIntegrity"], polarity: "pressure" },
    { name: "命名术效率", effectTargets: ["magicIntensity", "civilizationPotential"], polarity: "volatile" },
  ],
  life: [
    { name: "宜居窗口宽度", effectTargets: ["lifePotential", "civilizationPotential"], polarity: "support" },
    { name: "复杂生命门槛", effectTargets: ["lifePotential", "civilizationPotential"], polarity: "pressure" },
    { name: "灭绝恢复力", effectTargets: ["lifePotential", "stability"], polarity: "support" },
    { name: "非碳基适应性", effectTargets: ["lifePotential", "magicIntensity"], polarity: "volatile" },
  ],
  consciousness: [
    { name: "意识独立性", effectTargets: ["civilizationPotential", "divineActivity"], polarity: "support" },
    { name: "灵魂可记录性", effectTargets: ["civilizationPotential", "causalityIntegrity"], polarity: "volatile" },
    { name: "梦境现实渗透", effectTargets: ["magicIntensity", "causalityIntegrity"], polarity: "volatile" },
    { name: "集体意识凝聚", effectTargets: ["civilizationPotential", "divineActivity"], polarity: "support" },
  ],
  divinity: [
    { name: "信仰反馈强度", effectTargets: ["divineActivity", "civilizationPotential"], polarity: "support" },
    { name: "奇迹冷却代价", effectTargets: ["divineActivity", "causalityIntegrity"], polarity: "pressure" },
    { name: "神战风险", effectTargets: ["stability", "divineActivity"], polarity: "pressure" },
    { name: "神格自洽度", effectTargets: ["divineActivity", "stability"], polarity: "support" },
  ],
  causality: [
    { name: "因果稳定度", effectTargets: ["causalityIntegrity", "stability"], polarity: "support" },
    { name: "时间线弹性", effectTargets: ["age", "causalityIntegrity", "civilizationPotential"], polarity: "support" },
    { name: "预言可靠性", effectTargets: ["civilizationPotential", "divineActivity"], polarity: "volatile" },
    { name: "裂缝扩散率", effectTargets: ["causalityIntegrity", "stability"], polarity: "pressure" },
  ],
};

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
  const selectedTraits = uniquePicks(traits[id], rng, 3);
  const title = `${template.name}的${domainNames[id]}`;
  const rules = generateStructuredRules(id, value, rng);

  return {
    id,
    title,
    rating: {
      value,
      label: labelFor(value),
      explanation: explanationFor(id, value, template.name),
    },
    source: rng.pick(sources[id]),
    traits: selectedTraits,
    cost: rng.pick(costs[id]),
    rules,
  };
}

function generateStructuredRules(id: LawDomainId, domainValue: number, rng: RandomStream): StructuredLaw[] {
  const catalog = uniquePicks(ruleCatalog[id], rng, 2);
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
  return `${templateName}中，${domainNames[id]}${direction}，数值为 ${value}。`;
}

function structuredRuleExplanation(
  name: string,
  domain: LawDomainId,
  value: number,
  polarity: StructuredLaw["polarity"],
  effectTargets: MetricId[],
): string {
  const effect = polarity === "support" ? "提供正向支撑" : polarity === "pressure" ? "形成持续压力" : "带来高波动影响";
  return `${domainNames[domain]}中的“${name}”数值为 ${value}，会对${effectTargets.map(metricName).join("、")}${effect}。`;
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
