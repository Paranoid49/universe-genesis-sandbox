import { clamp, round, type RandomStream } from "./random";
import type { LawRating, UniverseLaws, UniverseMetrics } from "./types";
import type { UniverseTemplate } from "./templates";

export function generateMetrics(template: UniverseTemplate, laws: UniverseLaws, rng: RandomStream): UniverseMetrics {
  const stabilityRaw =
    laws.physics.rating.value * 0.34 +
    laws.causality.rating.value * 0.34 +
    (100 - Math.abs(laws.magic.rating.value - laws.physics.rating.value)) * 0.12 +
    template.stabilityBias +
    rng.range(-6, 6);

  const lifeRaw =
    laws.life.rating.value * 0.42 +
    laws.physics.rating.value * 0.2 +
    laws.causality.rating.value * 0.16 +
    laws.consciousness.rating.value * 0.12 +
    laws.magic.rating.value * 0.1 +
    rng.range(-7, 7);

  const civilizationRaw =
    lifeRaw * 0.42 +
    laws.consciousness.rating.value * 0.24 +
    laws.physics.rating.value * 0.14 +
    laws.causality.rating.value * 0.12 +
    (100 - Math.max(0, laws.divinity.rating.value - 70)) * 0.08 +
    rng.range(-6, 6);

  const ageValue = round(clamp(rng.range(18, 92)));

  return {
    age: metric(ageValue, ageLabel(ageValue), `宇宙年龄处于${ageLabel(ageValue)}，决定了时间线中可出现的文明成熟度。`),
    stability: metric(round(clamp(stabilityRaw)), stabilityLabel(stabilityRaw), "由物理稳定度、因果完整度和模板稳定偏置共同决定。"),
    lifePotential: metric(round(clamp(lifeRaw)), potentialLabel(lifeRaw), "由生命法则、物理窗口、意识活性和魔法环境共同决定。"),
    civilizationPotential: metric(round(clamp(civilizationRaw)), potentialLabel(civilizationRaw), "由生命潜力、意识复杂度、因果稳定度和神性压力共同决定。"),
    magicIntensity: metric(laws.magic.rating.value, laws.magic.rating.label, laws.magic.rating.explanation),
    divineActivity: metric(laws.divinity.rating.value, laws.divinity.rating.label, laws.divinity.rating.explanation),
    causalityIntegrity: metric(laws.causality.rating.value, laws.causality.rating.label, laws.causality.rating.explanation),
  };
}

function metric(value: number, label: string, explanation: string): LawRating {
  return { value: round(clamp(value)), label, explanation };
}

function ageLabel(value: number): string {
  if (value < 30) return "幼年纪";
  if (value < 55) return "繁盛纪";
  if (value < 78) return "深时纪";
  return "暮年纪";
}

function stabilityLabel(value: number): string {
  if (value < 25) return "濒临破裂";
  if (value < 45) return "不稳定";
  if (value < 65) return "可维持";
  if (value < 82) return "稳定";
  return "近乎恒定";
}

function potentialLabel(value: number): string {
  if (value < 25) return "稀薄";
  if (value < 45) return "有限";
  if (value < 65) return "可观";
  if (value < 82) return "丰沛";
  return "异常旺盛";
}
