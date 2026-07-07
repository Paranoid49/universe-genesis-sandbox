import type { GalaxyType, PlanetType, StarSystemType } from "../types";

export type GalaxyTypeProfile = {
  id: GalaxyType;
  label: string;
  massBias: number;
  metallicityBias: number;
  magicBias: number;
  divineBias: number;
  hazardBias: number;
};

export type StarSystemTypeProfile = {
  id: StarSystemType;
  label: string;
  stabilityBias: number;
  luminosityBias: number;
  anomalyBias: number;
};

export type PlanetTypeProfile = {
  id: PlanetType;
  label: string;
  habitabilityBias: number;
  waterBias: number;
  atmosphereBias: number;
  magicBias: number;
  stabilityBias: number;
};

export const galaxyTypeProfiles: GalaxyTypeProfile[] = [
  { id: "spiral", label: "旋臂星系", massBias: 8, metallicityBias: 12, magicBias: 0, divineBias: 0, hazardBias: -4 },
  { id: "elliptical", label: "椭圆星系", massBias: 16, metallicityBias: 4, magicBias: -4, divineBias: 2, hazardBias: -2 },
  { id: "dwarf", label: "矮星系", massBias: -18, metallicityBias: -8, magicBias: 1, divineBias: 0, hazardBias: 2 },
  { id: "irregular", label: "不规则星系", massBias: -6, metallicityBias: 0, magicBias: 4, divineBias: 1, hazardBias: 8 },
  { id: "nebula_forge", label: "星云熔炉", massBias: 2, metallicityBias: 16, magicBias: 8, divineBias: 0, hazardBias: 4 },
  { id: "arcane_cluster", label: "灵质星团", massBias: -4, metallicityBias: 6, magicBias: 20, divineBias: 4, hazardBias: 10 },
  { id: "divine_remnant", label: "神性遗迹星系", massBias: 4, metallicityBias: 2, magicBias: 8, divineBias: 22, hazardBias: 7 },
  { id: "causal_shard", label: "因果碎片星系", massBias: -10, metallicityBias: -2, magicBias: 12, divineBias: 6, hazardBias: 24 },
];

export const starSystemTypeProfiles: StarSystemTypeProfile[] = [
  { id: "single_star", label: "单恒星系", stabilityBias: 12, luminosityBias: 0, anomalyBias: -6 },
  { id: "binary_star", label: "双星系", stabilityBias: -4, luminosityBias: 8, anomalyBias: 4 },
  { id: "trinary_star", label: "三星系", stabilityBias: -10, luminosityBias: 12, anomalyBias: 8 },
  { id: "red_dwarf", label: "红矮星系", stabilityBias: 16, luminosityBias: -14, anomalyBias: -2 },
  { id: "giant_star", label: "巨星系", stabilityBias: -8, luminosityBias: 22, anomalyBias: 6 },
  { id: "white_dwarf", label: "白矮星残系", stabilityBias: 4, luminosityBias: -8, anomalyBias: 3 },
  { id: "black_hole_neighbor", label: "黑洞邻近星系", stabilityBias: -18, luminosityBias: 4, anomalyBias: 24 },
  { id: "arcane_star", label: "魔法恒星系", stabilityBias: -6, luminosityBias: 8, anomalyBias: 18 },
];

export const planetTypeProfiles: PlanetTypeProfile[] = [
  { id: "rocky", label: "岩石行星", habitabilityBias: 10, waterBias: 0, atmosphereBias: 6, magicBias: 0, stabilityBias: 8 },
  { id: "ocean", label: "海洋行星", habitabilityBias: 22, waterBias: 28, atmosphereBias: 10, magicBias: 2, stabilityBias: 4 },
  { id: "desert", label: "荒漠行星", habitabilityBias: -6, waterBias: -22, atmosphereBias: 0, magicBias: 0, stabilityBias: 5 },
  { id: "ice", label: "冰封行星", habitabilityBias: -12, waterBias: 10, atmosphereBias: -6, magicBias: 1, stabilityBias: 7 },
  { id: "gas_giant", label: "气态巨行星", habitabilityBias: -30, waterBias: -12, atmosphereBias: 22, magicBias: 4, stabilityBias: 2 },
  { id: "floating", label: "浮空行星", habitabilityBias: 4, waterBias: -4, atmosphereBias: 16, magicBias: 18, stabilityBias: -8 },
  { id: "dream", label: "梦境行星", habitabilityBias: 2, waterBias: 0, atmosphereBias: 6, magicBias: 24, stabilityBias: -12 },
  { id: "aether", label: "灵质行星", habitabilityBias: 8, waterBias: 4, atmosphereBias: 8, magicBias: 28, stabilityBias: -6 },
  { id: "mechanical", label: "机械行星", habitabilityBias: -4, waterBias: -12, atmosphereBias: 4, magicBias: -4, stabilityBias: 20 },
];

export const starClasses = ["A", "F", "G", "K", "M", "白矮", "蓝巨", "灵质", "黑洞伴星"];

export const galaxyNameCores = ["银澜", "烬环", "澄辉", "玄潮", "星冕", "镜渊", "尘炉", "霜庭", "梦塔", "律幕", "烁谷", "环井"];

export const starSystemNameCores = ["远炬", "曦门", "灰冠", "琥光", "静轨", "潮星", "弦核", "辉井", "烬舟", "霜环", "梦脉", "律塔"];

export const planetNameCores = ["澄陆", "银海", "砂庭", "霜面", "浮穹", "梦壳", "灵渊", "机冕", "星沼", "烁原", "尘冠", "镜湾"];

export const biosphereForms = ["硅基菌毯", "潮汐林海", "灵质浮游群", "梦境神经网", "机械孢子群", "晶体兽群", "海洋城邦种", "环形记忆群"];
