import { clamp, type RandomStream } from "./random";
import type { EraId, EventEffect, EventType, TimelineEvent, UniverseLaws, UniverseMetrics } from "./types";
import type { UniverseTemplate } from "./templates";

type EventDraft = {
  era: EraId;
  type: EventType;
  title: string;
  description: string;
  causes: string[];
  effects: EventEffect[];
  importance: number;
};

const eraOrder: EraId[] = ["creation", "stars", "life", "civilization", "myth", "ending"];

export function generateTimeline(template: UniverseTemplate, laws: UniverseLaws, metrics: UniverseMetrics, rng: RandomStream): TimelineEvent[] {
  const count = rng.int(8, 12);
  const drafts = baseEvents(template, laws, metrics, rng);

  while (drafts.length < count) {
    drafts.push(extraEvent(template, laws, metrics, rng));
  }

  return drafts
    .map((draft, index) => materializeEvent(draft, index, rng))
    .sort((a, b) => a.age - b.age)
    .map((event, index) => ({ ...event, id: `evt-${String(index + 1).padStart(2, "0")}` }));
}

function baseEvents(template: UniverseTemplate, laws: UniverseLaws, metrics: UniverseMetrics, rng: RandomStream): EventDraft[] {
  return [
    {
      era: "creation",
      type: "creation",
      title: rng.pick(["第一道规则凝结", "虚无被命名", "创世常数落定"]),
      description: `${template.name}在${laws.physics.source}中获得最初边界，${laws.causality.title}随之成形。`,
      causes: [laws.physics.source, laws.causality.source],
      effects: [{ metric: "stability", delta: 8, description: "确立宇宙能否长期维持的底盘。" }],
      importance: 96,
    },
    {
      era: "stars",
      type: "stars",
      title: rng.pick(["第一批恒星点燃", "星尘长河展开", "重元素炉群苏醒"]),
      description: `恒星在${laws.physics.traits[0]}的约束下形成，物质开始为生命和文明储备材料。`,
      causes: [laws.physics.traits[0]],
      effects: [{ metric: "lifePotential", delta: 6, description: "提高后续宜居窗口的出现概率。" }],
      importance: 82,
    },
    {
      era: "life",
      type: "life",
      title: rng.pick(["第一片生命海出现", "自复制尘埃觉醒", "灵魂孢子降落"]),
      description: `${laws.life.source}触发生命萌芽，生命潜力达到${metrics.lifePotential.label}。`,
      causes: [laws.life.source, metrics.lifePotential.explanation],
      effects: [{ metric: "lifePotential", delta: 10, description: "生命从可能性转为历史事实。" }],
      importance: 78,
    },
    {
      era: "civilization",
      type: "civilization",
      title: rng.pick(["第一座观星城升起", "语言与火种结盟", "文明开始记录天空"]),
      description: `意识复杂度推动文明出现，文明潜力为${metrics.civilizationPotential.label}。`,
      causes: [laws.consciousness.source, metrics.civilizationPotential.explanation],
      effects: [{ metric: "civilizationPotential", delta: 9, description: "文明开始反向影响宇宙叙事。" }],
      importance: 74,
    },
    {
      era: "myth",
      type: "myth",
      title: rng.pick(["第一则神话成为事实", "诸神听见凡世", "梦境与神性互相命名"]),
      description: `${laws.divinity.source}让神话层开始显影，神性活跃度为${metrics.divineActivity.label}。`,
      causes: [laws.divinity.source, laws.consciousness.traits[0]],
      effects: [{ metric: "divineActivity", delta: 7, description: "神话事件进入可观测历史。" }],
      importance: 70,
    },
    {
      era: "ending",
      type: "ending",
      title: rng.pick(["远终局露出轮廓", "最后纪元被预言", "命运边界开始收束"]),
      description: `因果完整度为${metrics.causalityIntegrity.label}，终局仍可被观察但不完全确定。`,
      causes: [laws.causality.cost, metrics.stability.explanation],
      effects: [{ metric: "causalityIntegrity", delta: -6, description: "终局预兆开始改变文明的长期选择。" }],
      importance: 88,
    },
  ];
}

function extraEvent(template: UniverseTemplate, laws: UniverseLaws, metrics: UniverseMetrics, rng: RandomStream): EventDraft {
  const type = rng.weighted([
    { item: "stars" as const, weight: template.timelineBias.stars ?? 1 },
    { item: "life" as const, weight: template.timelineBias.life ?? 1 },
    { item: "civilization" as const, weight: template.timelineBias.civilization ?? 1 },
    { item: "myth" as const, weight: template.timelineBias.myth ?? 1 },
    { item: "ending" as const, weight: template.timelineBias.ending ?? 1 },
    { item: "anomaly" as const, weight: template.timelineBias.anomaly ?? 1 },
  ]);

  const anomaly = type === "anomaly";
  const era: EraId = anomaly ? rng.pick(eraOrder) : type;
  const titleMap: Record<EventType, string[]> = {
    creation: ["规则余震"],
    stars: ["星群迁徙", "黑暗星云开裂", "恒星墓场回响"],
    life: ["第二生命实验", "灭绝后的复苏", "海洋意识苏醒"],
    civilization: ["第一场星火远航", "文明联盟短暂成立", "禁忌历法公布"],
    myth: ["神名交换", "圣约断裂", "梦境神殿落成"],
    ending: ["终局试算", "远未来的回声", "最后星光被记录"],
    anomaly: ["因果裂缝张开", "记忆雨降临", "不可能纪元插入历史"],
  };

  const metric = anomaly ? "causalityIntegrity" : type === "myth" ? "divineActivity" : type === "civilization" ? "civilizationPotential" : type === "life" ? "lifePotential" : "stability";
  const delta = anomaly ? -rng.int(3, 12) : rng.int(2, 9);

  return {
    era,
    type,
    title: rng.pick(titleMap[type]),
    description: buildExtraDescription(type, laws, metrics),
    causes: [laws.magic.traits[0], laws.causality.traits[0]],
    effects: [{ metric, delta, description: anomaly ? "异常事件削弱长期可预测性。" : "事件为后续纪元提供新的可能性。" }],
    importance: rng.int(45, 82),
  };
}

function buildExtraDescription(type: EventType, laws: UniverseLaws, metrics: UniverseMetrics): string {
  if (type === "anomaly") return `${laws.causality.traits[0]}引发历史噪声，因果完整度承受新的压力。`;
  if (type === "myth") return `${laws.divinity.traits[0]}与${laws.consciousness.traits[0]}共振，神话不再只是解释。`;
  if (type === "civilization") return `文明在${metrics.civilizationPotential.label}的潜力中扩张，同时继承早期法则代价。`;
  if (type === "life") return `${laws.life.traits[0]}改变生态路径，生命再次证明自己的韧性。`;
  if (type === "ending") return `${laws.causality.cost}让远终局变得更清晰，也更难回避。`;
  return `${laws.physics.traits[0]}带来新的星辰结构，物质版图被改写。`;
}

function materializeEvent(draft: EventDraft, index: number, rng: RandomStream): TimelineEvent {
  const baseAge = eraOrder.indexOf(draft.era) * 1600 + index * 17;
  const age = Math.round(clamp(baseAge + rng.range(0, 900), 0, 9999));
  return {
    id: `evt-${index + 1}`,
    age,
    ageLabel: age === 0 ? "创世瞬间" : `第 ${age} 纪元`,
    ...draft,
  };
}
