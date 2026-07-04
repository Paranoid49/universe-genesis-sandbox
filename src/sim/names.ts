import type { RandomStream } from "./random";
import type { UniverseTemplate } from "./templates";
import type { UniverseLaws, UniverseMetrics } from "./types";

const prefixes = ["银", "烬", "澄", "玄", "星", "镜", "尘", "霜", "晦", "熵", "昼", "梦", "律", "烁", "环"];
const cores = ["庭", "渊", "环", "冕", "潮", "阈", "域", "塔", "舟", "炉", "谷", "冠", "井", "幕", "轮"];
const suffixes = ["界", "纪", "庭", "宇", "穹", "谱", "域", "海", "环", "座"];

export function generateUniverseName(template: UniverseTemplate, rng: RandomStream): string {
  const prefix = rng.pick(prefixes);
  const core = rng.pick(cores);
  const suffix = rng.bool(0.42) ? rng.pick(suffixes) : "";
  const name = `${prefix}${core}${suffix}`;
  if (template.id === "mechanical_divinity" && rng.bool(0.5)) {
    return `${name}-序列`;
  }
  return name;
}

export function generateTagline(template: UniverseTemplate, laws: UniverseLaws, metrics: UniverseMetrics): string {
  const strongest = Object.values(laws).sort((a, b) => b.rating.value - a.rating.value)[0];
  const weakest = Object.values(laws).sort((a, b) => a.rating.value - b.rating.value)[0];
  return `${template.name}中，${strongest.title.replace(`${template.name}的`, "")}压过${weakest.title.replace(`${template.name}的`, "")}，宇宙稳定度为${metrics.stability.label}。`;
}

export function generateDescription(template: UniverseTemplate, laws: UniverseLaws, metrics: UniverseMetrics): string {
  return `${template.description} 这个宇宙的生命潜力为${metrics.lifePotential.label}，文明潜力为${metrics.civilizationPotential.label}，因果完整度为${metrics.causalityIntegrity.label}。${laws.magic.cost}`;
}
