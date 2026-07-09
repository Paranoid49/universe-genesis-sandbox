import type { CivilizationEventType, CivilizationPath, MythologyType } from "../types";

export type CivilizationPathProfile = {
  id: CivilizationPath;
  label: string;
  technologyBias: number;
  magicBias: number;
  faithBias: number;
  expansionBias: number;
  stabilityBias: number;
};

export type MythologyProfile = {
  id: MythologyType;
  label: string;
  faithBias: number;
  magicBias: number;
  divinityBias: number;
  technologyBias: number;
};

export type CivilizationEventBlueprint = {
  type: CivilizationEventType;
  titles: string[];
  baseImpact: number;
  description: string;
};

export const civilizationNamePrefixes = ["曦", "澄", "烬", "银", "律", "梦", "星", "玄", "环", "霜", "机", "灵", "潮", "镜", "尘"];
export const civilizationNameCores = ["庭", "环", "舟", "冕", "塔", "渊", "城", "盟", "序", "歌", "脉", "炉", "门", "冠", "书"];
export const civilizationNameSuffixes = ["文明", "城邦群", "星盟", "神权", "游牧庭", "记忆共同体", "飞升会", "遗民", "王朝", "议会"];

export const deityNameCores = ["初火", "远星", "静潮", "灰梦", "铁冕", "玄井", "霜门", "灵环", "烁眼", "归墟", "昼律", "群鸦"];

export const civilizationPathProfiles: CivilizationPathProfile[] = [
  { id: "tribal", label: "原始部落", technologyBias: -24, magicBias: 0, faithBias: 2, expansionBias: -18, stabilityBias: -4 },
  { id: "city_state", label: "城邦", technologyBias: -8, magicBias: 0, faithBias: 4, expansionBias: -8, stabilityBias: 4 },
  { id: "planetary", label: "行星文明", technologyBias: 8, magicBias: -2, faithBias: -2, expansionBias: 3, stabilityBias: 8 },
  { id: "galactic", label: "星系文明", technologyBias: 22, magicBias: -4, faithBias: -4, expansionBias: 24, stabilityBias: 4 },
  { id: "arcane_empire", label: "魔法帝国", technologyBias: 0, magicBias: 24, faithBias: 6, expansionBias: 12, stabilityBias: -8 },
  { id: "theocracy", label: "神权文明", technologyBias: 0, magicBias: 8, faithBias: 24, expansionBias: 4, stabilityBias: -2 },
  { id: "collective_mind", label: "集体意识", technologyBias: 8, magicBias: 6, faithBias: 4, expansionBias: -4, stabilityBias: 16 },
  { id: "ascended", label: "飞升文明", technologyBias: 18, magicBias: 18, faithBias: 12, expansionBias: 8, stabilityBias: 12 },
  { id: "lost", label: "失落文明", technologyBias: -8, magicBias: 4, faithBias: 2, expansionBias: -16, stabilityBias: -24 },
];

export const mythologyProfiles: MythologyProfile[] = [
  { id: "none", label: "无神", faithBias: -28, magicBias: -8, divinityBias: -30, technologyBias: 12 },
  { id: "creator_deity", label: "造物主神", faithBias: 16, magicBias: 6, divinityBias: 24, technologyBias: -4 },
  { id: "nature_deity", label: "自然神", faithBias: 10, magicBias: 8, divinityBias: 12, technologyBias: -8 },
  { id: "faith_deity", label: "信仰神", faithBias: 28, magicBias: 4, divinityBias: 18, technologyBias: -4 },
  { id: "stellar_deity", label: "恒星神", faithBias: 14, magicBias: 8, divinityBias: 14, technologyBias: 8 },
  { id: "black_hole_deity", label: "黑洞神", faithBias: 10, magicBias: 10, divinityBias: 14, technologyBias: 12 },
  { id: "death_or_dream_deity", label: "死亡或梦境神", faithBias: 16, magicBias: 16, divinityBias: 16, technologyBias: -2 },
  { id: "machine_deity", label: "机械神", faithBias: 14, magicBias: -6, divinityBias: 12, technologyBias: 26 },
];

export const civilizationEventBlueprints: CivilizationEventBlueprint[] = [
  {
    type: "first_fire_or_language",
    titles: ["第一簇共同火种", "语言在夜岸成形", "氏族刻下第一枚记号"],
    baseImpact: 12,
    description: "文明获得稳定传承能力，部落记忆开始跨代保存。",
  },
  {
    type: "first_magic",
    titles: ["第一场可复现施法", "灵质仪式被记录", "命名术进入工坊"],
    baseImpact: 14,
    description: "魔法从偶发现象转入制度化训练，文明开始改写局部环境。",
  },
  {
    type: "first_astronomy",
    titles: ["第一座观星台升起", "恒星历法完成", "天空被写入法律"],
    baseImpact: 13,
    description: "文明把星辰运动纳入制度，技术和远航倾向同步增长。",
  },
  {
    type: "first_deity_contact",
    titles: ["神名回应祭礼", "第一份神谕被封存", "梦境边界出现回声"],
    baseImpact: 16,
    description: "神话系统与文明制度发生连接，信仰开始影响文明路径。",
  },
  {
    type: "world_war",
    titles: ["世界战争撕裂旧秩序", "诸城邦进入长夜", "星下内战留下裂痕"],
    baseImpact: -18,
    description: "文明稳定度显著下降，灭绝风险与集权倾向上升。",
  },
  {
    type: "star_voyage",
    titles: ["第一支星海船队启航", "外层轨道被殖民", "远航协议完成"],
    baseImpact: 18,
    description: "文明突破起源行星边界，扩张倾向进入主导位置。",
  },
  {
    type: "ascension_rite",
    titles: ["飞升仪式打开上层门", "群体意识越过肉身", "星光献祭完成"],
    baseImpact: 22,
    description: "文明尝试改变自身存在层级，飞升或崩溃的可能性同时提高。",
  },
  {
    type: "extinction",
    titles: ["灭绝纪念碑被点亮", "最后城门沉入尘海", "文明遗产转入神话层"],
    baseImpact: -24,
    description: "文明进入失落或灭绝边缘，残留遗产成为后续阶段可追踪对象。",
  },
];
