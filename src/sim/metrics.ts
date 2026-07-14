import { clamp, round, type RandomStream } from "./random";
import type { LawInteraction, LawRating, MetricId, MetricInfluence, StructuredLaw, UniverseLaws, UniverseMetrics } from "./types";
import type { UniverseTemplate } from "./templates";

export function generateMetrics(template: UniverseTemplate, laws: UniverseLaws, interactions: LawInteraction[], rng: RandomStream): UniverseMetrics {
  const influences = buildMetricInfluences(laws, interactions);
  const stabilityRaw =
    laws.physics.rating.value * 0.34 +
    laws.causality.rating.value * 0.34 +
    (100 - Math.abs(laws.magic.rating.value - laws.physics.rating.value)) * 0.12 +
    template.stabilityBias +
    influenceTotal(influences.stability) +
    rng.withScope("metric:stability", (scoped) => scoped.range(-6, 6));

  const lifeRaw =
    laws.life.rating.value * 0.42 +
    laws.physics.rating.value * 0.2 +
    laws.causality.rating.value * 0.16 +
    laws.consciousness.rating.value * 0.12 +
    laws.magic.rating.value * 0.1 +
    influenceTotal(influences.lifePotential) +
    rng.withScope("metric:lifePotential", (scoped) => scoped.range(-7, 7));

  const civilizationRaw =
    lifeRaw * 0.42 +
    laws.consciousness.rating.value * 0.24 +
    laws.physics.rating.value * 0.14 +
    laws.causality.rating.value * 0.12 +
    (100 - Math.max(0, laws.divinity.rating.value - 70)) * 0.08 +
    influenceTotal(influences.civilizationPotential) +
    rng.withScope("metric:civilizationPotential", (scoped) => scoped.range(-6, 6));

  const ageValue = round(clamp(rng.withScope("metric:age", (scoped) => scoped.range(18, 92)) + influenceTotal(influences.age) * 0.2));
  const magicValue = round(clamp(laws.magic.rating.value + influenceTotal(influences.magicIntensity)));
  const divinityValue = round(clamp(laws.divinity.rating.value + influenceTotal(influences.divineActivity)));
  const causalityValue = round(clamp(laws.causality.rating.value + influenceTotal(influences.causalityIntegrity)));

  return {
    age: metric(ageValue, ageLabel(ageValue), `宇宙年龄处于${ageLabel(ageValue)}，由因果与物理法则共同限定可展开的历史深度。`, influences.age),
    stability: metric(round(clamp(stabilityRaw)), stabilityLabel(stabilityRaw), "由物理稳定度、因果完整度、结构化法则和法则关系共同决定。", influences.stability),
    lifePotential: metric(round(clamp(lifeRaw)), potentialLabel(lifeRaw), "由生命法则、物理窗口、意识活性、魔法环境和结构化法则共同决定。", influences.lifePotential),
    civilizationPotential: metric(round(clamp(civilizationRaw)), potentialLabel(civilizationRaw), "由生命潜力、意识复杂度、因果稳定度、神性压力和法则影响共同决定。", influences.civilizationPotential),
    magicIntensity: metric(magicValue, laws.magic.rating.label, laws.magic.rating.explanation, influences.magicIntensity),
    divineActivity: metric(divinityValue, laws.divinity.rating.label, laws.divinity.rating.explanation, influences.divineActivity),
    causalityIntegrity: metric(causalityValue, laws.causality.rating.label, laws.causality.rating.explanation, influences.causalityIntegrity),
  };
}

function metric(value: number, label: string, explanation: string, influences: MetricInfluence[]): LawRating {
  return { value: round(clamp(value)), label, explanation, influences };
}

function buildMetricInfluences(laws: UniverseLaws, interactions: LawInteraction[]): Record<MetricId, MetricInfluence[]> {
  const result: Record<MetricId, MetricInfluence[]> = {
    age: [],
    stability: [],
    lifePotential: [],
    civilizationPotential: [],
    magicIntensity: [],
    divineActivity: [],
    causalityIntegrity: [],
  };

  for (const law of Object.values(laws).flatMap((domain) => domain.rules)) {
    const delta = lawDelta(law);
    for (const target of law.effectTargets) {
      result[target].push({
        sourceId: law.id,
        sourceLabel: law.name,
        targetMetric: target,
        delta,
        explanation: `结构化法则“${law.name}”以 ${law.label} 强度影响该指标。`,
      });
    }
  }

  for (const interaction of interactions) {
    const targets = interaction.kind === "conflict" ? (["stability", "causalityIntegrity"] as MetricId[]) : interaction.kind === "synergy" ? (["lifePotential", "civilizationPotential", "divineActivity"] as MetricId[]) : (["stability", "magicIntensity"] as MetricId[]);
    for (const target of targets) {
      result[target].push({
        sourceId: interaction.id,
        sourceLabel: interaction.kind === "synergy" ? "法则协同" : interaction.kind === "conflict" ? "法则冲突" : "法则约束",
        targetMetric: target,
        delta: round(interaction.impact / 4),
        explanation: interaction.explanation,
      });
    }
  }

  for (const law of [strongestRule(laws.physics.rules), strongestRule(laws.causality.rules)]) {
    result.age.push({
      sourceId: law.id,
      sourceLabel: law.name,
      targetMetric: "age",
      delta: round((law.value - 50) / 20),
      explanation: `结构化法则“${law.name}”限定宇宙历史展开速度。`,
    });
  }

  result.age.push({
    sourceId: "age.causality-window",
    sourceLabel: "因果历史窗口",
    targetMetric: "age",
    delta: round((laws.causality.rating.value + laws.physics.rating.value) / 20 - 5),
    explanation: "因果与物理稳定度决定宇宙能展开的历史纵深。",
  });

  return result;
}

function strongestRule(rules: StructuredLaw[]): StructuredLaw {
  return [...rules].sort((left, right) => right.value - left.value)[0];
}

function lawDelta(law: StructuredLaw): number {
  const magnitude = round((law.value - 50) / 8);
  if (law.polarity === "support") return magnitude;
  if (law.polarity === "pressure") return -Math.abs(magnitude);
  return round(magnitude / 2);
}

function influenceTotal(influences: MetricInfluence[]): number {
  return influences.reduce((sum, influence) => sum + influence.delta, 0);
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
