import type { EraId, EventEffect, EventType, LocalGenerationBiasId, MetricId, StructuredLaw, UniverseLaws, UniverseMetrics } from "../types";

export type TimelineEventBlueprint = {
  era: EraId;
  type: EventType;
  titles: string[];
  location: string;
  metric: MetricId | "timeline" | "laws";
  deltaRange: [number, number];
  influence: EventEffect["influence"];
  description: (laws: UniverseLaws, metrics: UniverseMetrics) => string;
  cause: (laws: UniverseLaws, metrics: UniverseMetrics) => string[];
};

export const timelineEraOrder: EraId[] = ["creation", "stars", "elements", "life", "civilization", "myth", "ascension", "ending"];

export const timelineEventTypeToEra: Record<EventType, EraId> = {
  creation: "creation",
  stars: "stars",
  elements: "elements",
  life: "life",
  civilization: "civilization",
  myth: "myth",
  ascension: "ascension",
  ending: "ending",
  anomaly: "myth",
};

export const timelineMetricNames: Record<MetricId, string> = {
  age: "宇宙年龄",
  stability: "稳定度",
  lifePotential: "生命潜力",
  civilizationPotential: "文明潜力",
  magicIntensity: "魔法强度",
  divineActivity: "神性活跃度",
  causalityIntegrity: "因果完整度",
};

export const localGenerationBiasLabels: Record<LocalGenerationBiasId, string> = {
  galaxyDensity: "星系密度",
  stellarStability: "恒星稳定",
  planetHabitability: "行星宜居",
  biosphereChance: "生命出现",
  civilizationSeedChance: "文明种子",
  magicAnomalyDensity: "魔法异常",
  divineRelicDensity: "神性遗迹",
  causalHazardLevel: "因果风险",
};

export const timelineFutureEffectText: Record<EventType, string> = {
  creation: "确立后续纪元的初始条件",
  stars: "调整元素与生命事件出现概率",
  elements: "调整生命、文明与魔法倾向",
  life: "调整文明与神话事件概率",
  civilization: "调整神话、飞升与终局事件概率",
  myth: "调整神性、异常与终局事件概率",
  ascension: "调整飞升后果与终局路径",
  ending: "收束远未来事件倾向",
  anomaly: "放大因果裂缝与终局风险",
};

export const timelineEventBlueprints: Record<EventType, TimelineEventBlueprint[]> = {
  creation: [
    {
      era: "creation",
      type: "creation",
      titles: ["第一道规则凝结", "虚无被命名", "创世常数落定"],
      location: "创世边界",
      metric: "stability",
      deltaRange: [5, 10],
      influence: "metric",
      description: (laws) => `宇宙在${laws.physics.source}中获得最初边界，${laws.causality.title}随之成形。`,
      cause: (laws) => [laws.physics.source, laws.causality.source],
    },
  ],
  stars: [
    {
      era: "stars",
      type: "stars",
      titles: ["第一批恒星点燃", "星尘长河展开", "重元素炉群苏醒", "黑暗星云开裂"],
      location: "原初星云带",
      metric: "lifePotential",
      deltaRange: [3, 8],
      influence: "probability",
      description: (laws) => `恒星在${laws.physics.traits[0]}的约束下形成，物质开始为生命和文明储备材料。`,
      cause: (laws) => [laws.physics.traits[0], strongestRule(laws.physics.rules).explanation],
    },
    {
      era: "stars",
      type: "stars",
      titles: ["恒星墓场回响", "黑洞炉群沉降", "星群迁徙"],
      location: "恒星墓场",
      metric: "stability",
      deltaRange: [-4, 6],
      influence: "law-pressure",
      description: (laws) => `${laws.physics.traits[1]}让恒星死亡不再只是终点，而成为后续纪元的物质回路。`,
      cause: (laws) => [laws.physics.cost, laws.causality.traits[0]],
    },
  ],
  elements: [
    {
      era: "elements",
      type: "elements",
      titles: ["重元素潮汐汇聚", "灵质矿脉成形", "第一批生命材料沉积"],
      location: "元素潮汐层",
      metric: "lifePotential",
      deltaRange: [4, 10],
      influence: "metric",
      description: (laws) => `${laws.life.source}与${laws.magic.source}在星尘中混合，生命材料开始具备可演化的复杂性。`,
      cause: (laws) => [laws.life.source, strongestRule(laws.life.rules).explanation],
    },
    {
      era: "elements",
      type: "elements",
      titles: ["暗物质骨架定型", "灵质污染进入常数", "元素丰度出现偏斜"],
      location: "暗物质网格",
      metric: "magicIntensity",
      deltaRange: [-2, 8],
      influence: "probability",
      description: (laws) => `${laws.magic.traits[1]}改变元素分布，魔法不再只附着于生命，而进入宇宙材料层。`,
      cause: (laws) => [laws.magic.traits[1], laws.physics.traits[2]],
    },
  ],
  life: [
    {
      era: "life",
      type: "life",
      titles: ["第一片生命海出现", "自复制尘埃觉醒", "灵魂孢子降落"],
      location: "生命海",
      metric: "lifePotential",
      deltaRange: [7, 12],
      influence: "metric",
      description: (_laws, metrics) => `生命从可能性转为历史事实，生命潜力达到${metrics.lifePotential.label}。`,
      cause: (laws, metrics) => [laws.life.source, metrics.lifePotential.explanation],
    },
    {
      era: "life",
      type: "life",
      titles: ["灭绝后的复苏", "第二生命实验", "海洋意识苏醒"],
      location: "复苏生态带",
      metric: "civilizationPotential",
      deltaRange: [2, 8],
      influence: "probability",
      description: (laws) => `${laws.life.traits[1]}迫使生命在灾变后重组，后续文明概率随之改变。`,
      cause: (laws) => [laws.life.traits[1], laws.consciousness.traits[0]],
    },
  ],
  civilization: [
    {
      era: "civilization",
      type: "civilization",
      titles: ["第一座观星城升起", "语言与火种结盟", "文明开始记录天空"],
      location: "早期文明圈",
      metric: "civilizationPotential",
      deltaRange: [6, 11],
      influence: "metric",
      description: (_laws, metrics) => `意识复杂度推动文明出现，文明潜力为${metrics.civilizationPotential.label}。`,
      cause: (laws, metrics) => [laws.consciousness.source, metrics.civilizationPotential.explanation],
    },
    {
      era: "civilization",
      type: "civilization",
      titles: ["第一场星火远航", "文明联盟短暂成立", "禁忌历法公布"],
      location: "文明观测网",
      metric: "divineActivity",
      deltaRange: [1, 8],
      influence: "probability",
      description: (laws) => `文明开始把${laws.divinity.source}纳入制度和观测，神话纪元的概率被提前抬高。`,
      cause: (laws) => [laws.consciousness.traits[2], laws.divinity.source],
    },
  ],
  myth: [
    {
      era: "myth",
      type: "myth",
      titles: ["第一则神话成为事实", "诸神听见凡世", "梦境与神性互相命名"],
      location: "神话层",
      metric: "divineActivity",
      deltaRange: [5, 11],
      influence: "probability",
      description: (_laws, metrics) => `神话层开始显影，神性活跃度为${metrics.divineActivity.label}。`,
      cause: (laws) => [laws.divinity.source, laws.consciousness.traits[0]],
    },
    {
      era: "myth",
      type: "myth",
      titles: ["神名交换", "圣约断裂", "梦境神殿落成"],
      location: "信仰回声带",
      metric: "causalityIntegrity",
      deltaRange: [-7, 4],
      influence: "law-pressure",
      description: (laws) => `${laws.divinity.traits[2]}让奇迹进入历史记录，但未来因果需要承担代价。`,
      cause: (laws) => [laws.divinity.traits[2], laws.causality.cost],
    },
  ],
  ascension: [
    {
      era: "ascension",
      type: "ascension",
      titles: ["第一文明触及飞升门槛", "群星协议完成", "灵魂网络越过物质边界"],
      location: "飞升门槛",
      metric: "civilizationPotential",
      deltaRange: [3, 10],
      influence: "probability",
      description: (laws) => `文明把${laws.consciousness.traits[1]}与技术秩序结合，开始尝试改变自身命运层级。`,
      cause: (laws) => [laws.consciousness.traits[1], laws.causality.traits[3]],
    },
    {
      era: "ascension",
      type: "ascension",
      titles: ["衰亡纪元提前显影", "文明遗产转入神话层", "飞升仪式留下裂痕"],
      location: "衰亡边界",
      metric: "stability",
      deltaRange: [-9, 3],
      influence: "law-pressure",
      description: (laws) => `${laws.causality.cost}让飞升不再是纯粹胜利，而是向终局转移风险。`,
      cause: (laws) => [laws.causality.cost, laws.divinity.cost],
    },
  ],
  ending: [
    {
      era: "ending",
      type: "ending",
      titles: ["远终局露出轮廓", "最后纪元被预言", "命运边界开始收束"],
      location: "终局边界",
      metric: "causalityIntegrity",
      deltaRange: [-9, -3],
      influence: "probability",
      description: (_laws, metrics) => `因果完整度为${metrics.causalityIntegrity.label}，终局仍可被观察但不完全确定。`,
      cause: (laws, metrics) => [laws.causality.cost, metrics.stability.explanation],
    },
    {
      era: "ending",
      type: "ending",
      titles: ["最后星光被记录", "轮回试算完成", "宇宙边界开始降温"],
      location: "远未来残响",
      metric: "timeline",
      deltaRange: [-5, 2],
      influence: "metric",
      description: (laws) => `${laws.causality.traits[2]}把前序纪元的选择压缩成终局路径。`,
      cause: (laws) => [laws.causality.traits[2], laws.physics.cost],
    },
  ],
  anomaly: [
    {
      era: "myth",
      type: "anomaly",
      titles: ["因果裂缝张开", "记忆雨降临", "不可能纪元插入历史"],
      location: "因果裂缝",
      metric: "causalityIntegrity",
      deltaRange: [-12, -4],
      influence: "law-pressure",
      description: (laws) => `${laws.causality.traits[2]}引发历史噪声，因果完整度承受新的压力。`,
      cause: (laws) => [laws.causality.traits[2], laws.magic.cost],
    },
  ],
};

function strongestRule(rules: StructuredLaw[]): StructuredLaw {
  return [...rules].sort((left, right) => right.value - left.value)[0];
}
