import type { LawDomainId, UniverseTemplateId } from "./types";

export type UniverseTemplate = {
  id: UniverseTemplateId;
  shortCode: string;
  name: string;
  archetype: string;
  description: string;
  weights: Record<LawDomainId, number>;
  stabilityBias: number;
  timelineBias: Partial<Record<"creation" | "stars" | "life" | "civilization" | "myth" | "ending" | "anomaly", number>>;
};

export const UNIVERSE_TEMPLATES: UniverseTemplate[] = [
  {
    id: "hard_science",
    shortCode: "HS",
    name: "硬科学宇宙",
    archetype: "低超自然、强物理稳定宇宙",
    description: "物理规则占据绝对主导，生命依赖罕见但稳定的宜居窗口。",
    weights: { physics: 86, magic: 4, life: 48, consciousness: 38, divinity: 3, causality: 88 },
    stabilityBias: 16,
    timelineBias: { stars: 1.4, life: 1.1, civilization: 1.1, myth: 0.2, anomaly: 0.3 },
  },
  {
    id: "low_magic",
    shortCode: "LM",
    name: "低魔宇宙",
    archetype: "稀薄魔法、代价显著宇宙",
    description: "魔法真实存在，但使用代价高昂，通常只在文明边缘留下痕迹。",
    weights: { physics: 72, magic: 32, life: 56, consciousness: 48, divinity: 24, causality: 70 },
    stabilityBias: 8,
    timelineBias: { life: 1.2, civilization: 1.1, myth: 0.8, anomaly: 0.7 },
  },
  {
    id: "high_magic",
    shortCode: "HM",
    name: "高魔宇宙",
    archetype: "高魔力、多异常宇宙",
    description: "魔力参与物质循环，恒星死亡、灵魂潮汐与文明仪式彼此牵动。",
    weights: { physics: 58, magic: 88, life: 70, consciousness: 68, divinity: 55, causality: 50 },
    stabilityBias: -6,
    timelineBias: { life: 1.3, civilization: 1.2, myth: 1.5, anomaly: 1.3 },
  },
  {
    id: "mythic",
    shortCode: "MY",
    name: "神话宇宙",
    archetype: "高神性、神话纪元宇宙",
    description: "神性是宇宙结构的一部分，纪元更替常由誓言、祭礼与神战推动。",
    weights: { physics: 54, magic: 70, life: 64, consciousness: 72, divinity: 90, causality: 46 },
    stabilityBias: -8,
    timelineBias: { myth: 1.8, civilization: 1.1, ending: 1.2, anomaly: 1.1 },
  },
  {
    id: "polytheistic_war",
    shortCode: "PW",
    name: "多神战争宇宙",
    archetype: "多神冲突、命运撕裂宇宙",
    description: "神系之间的战争塑造星辰、文明与终局，凡世常成为神性冲突的投影。",
    weights: { physics: 50, magic: 66, life: 58, consciousness: 62, divinity: 96, causality: 38 },
    stabilityBias: -16,
    timelineBias: { myth: 2, civilization: 1.2, ending: 1.4, anomaly: 1.5 },
  },
  {
    id: "dream_realm",
    shortCode: "DR",
    name: "梦境宇宙",
    archetype: "意识渗透、梦境现实宇宙",
    description: "意识不是副产品，而是能反向折叠现实的底层介质。",
    weights: { physics: 42, magic: 64, life: 60, consciousness: 94, divinity: 48, causality: 44 },
    stabilityBias: -10,
    timelineBias: { life: 1.1, civilization: 1.2, myth: 1.4, anomaly: 1.8 },
  },
  {
    id: "reincarnation_cycle",
    shortCode: "RC",
    name: "轮回宇宙",
    archetype: "灵魂循环、时间回环宇宙",
    description: "时间会磨损却不彻底断裂，灵魂与文明在循环中积累债务。",
    weights: { physics: 58, magic: 52, life: 74, consciousness: 78, divinity: 60, causality: 66 },
    stabilityBias: 2,
    timelineBias: { life: 1.4, civilization: 1.2, myth: 1.2, ending: 1.5 },
  },
  {
    id: "mechanical_divinity",
    shortCode: "MD",
    name: "机械神宇宙",
    archetype: "秩序计算、机械神性宇宙",
    description: "神性从秩序、算法和巨大机器意志中诞生，奇迹更像可审计的指令。",
    weights: { physics: 78, magic: 28, life: 48, consciousness: 70, divinity: 72, causality: 82 },
    stabilityBias: 12,
    timelineBias: { stars: 1.2, civilization: 1.5, myth: 1.1, anomaly: 0.8 },
  },
  {
    id: "causal_fracture",
    shortCode: "CF",
    name: "因果裂缝宇宙",
    archetype: "因果破碎、预言失真宇宙",
    description: "事件的原因和后果不总按线性连接，历史会留下互相矛盾的痕迹。",
    weights: { physics: 52, magic: 58, life: 52, consciousness: 64, divinity: 44, causality: 18 },
    stabilityBias: -20,
    timelineBias: { anomaly: 2, myth: 1.2, ending: 1.3, civilization: 0.9 },
  },
  {
    id: "chaotic_laws",
    shortCode: "CL",
    name: "混沌法则宇宙",
    archetype: "多法则冲突、低稳定宇宙",
    description: "物理、魔法、神性和意识互相争夺解释权，宇宙壮丽但难以长期稳定。",
    weights: { physics: 40, magic: 82, life: 50, consciousness: 70, divinity: 76, causality: 26 },
    stabilityBias: -26,
    timelineBias: { anomaly: 2, myth: 1.6, ending: 1.5, life: 0.9 },
  },
];

export const DEFAULT_TEMPLATE_ID: UniverseTemplateId = "high_magic";

export function getTemplate(id: UniverseTemplateId = DEFAULT_TEMPLATE_ID): UniverseTemplate {
  return UNIVERSE_TEMPLATES.find((template) => template.id === id) ?? UNIVERSE_TEMPLATES[2];
}

export function getTemplateByShortCode(shortCode: string): UniverseTemplate | undefined {
  return UNIVERSE_TEMPLATES.find((template) => template.shortCode === shortCode.toUpperCase());
}
