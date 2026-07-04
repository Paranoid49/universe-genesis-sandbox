import type { Explanation, ObservationLog, TimelineEvent, UniverseLaws, UniverseMetrics } from "./types";
import type { UniverseTemplate } from "./templates";

export function generateExplanations(template: UniverseTemplate, laws: UniverseLaws, metrics: UniverseMetrics, timeline: TimelineEvent[]): Explanation[] {
  const firstCrisis = timeline.find((event) => event.effects.some((effect) => effect.delta < 0));
  const highestEvent = [...timeline].sort((a, b) => b.importance - a.importance)[0];

  return [
    {
      id: "exp-template",
      targetId: template.id,
      text: `${template.name}的模板权重决定了初始法则倾向，后续指标在此基础上加入 seed 派生随机流。`,
    },
    {
      id: "exp-stability",
      targetId: "metric-stability",
      text: `稳定度为${metrics.stability.label}，主要来自${laws.physics.title}与${laws.causality.title}的共同作用。`,
    },
    {
      id: "exp-life",
      targetId: "metric-life",
      text: `生命潜力为${metrics.lifePotential.label}，${laws.life.source}和${laws.physics.traits[0]}是关键前提。`,
    },
    {
      id: "exp-event",
      targetId: highestEvent.id,
      text: `“${highestEvent.title}”是本宇宙最重要的早期事件之一，因为它改变了${highestEvent.effects[0]?.description ?? "后续纪元概率"}。`,
    },
    {
      id: "exp-risk",
      targetId: firstCrisis?.id ?? "timeline",
      text: firstCrisis ? `主要风险来自“${firstCrisis.title}”，它暴露了${laws.causality.cost}。` : "当前时间线风险较低，但远终局仍受因果完整度约束。",
    },
  ];
}

export function generateObservationLog(timeline: TimelineEvent[], metrics: UniverseMetrics, laws: UniverseLaws): ObservationLog {
  const importantEvents = [...timeline]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 3)
    .map((event) => event.title);

  const rareFindings = [
    laws.magic.rating.value > 75 ? "恒星死亡后会释放可观灵质潮汐" : "魔法痕迹稀薄，需要漫长观测才能确认",
    laws.consciousness.rating.value > 75 ? "梦境具备改变现实边界的能力" : "意识主要表现为文明内部现象",
    metrics.causalityIntegrity.value < 35 ? "因果裂缝已进入常态化观测" : "因果结构仍能维持多数历史解释",
  ];

  const possibleEndings = [
    metrics.stability.value < 35 ? "法则崩解终局" : "热寂或长稳态终局",
    metrics.divineActivity.value > 70 ? "神性吞噬或神战终局" : "文明自我超越终局",
    metrics.causalityIntegrity.value < 40 ? "轮回重启或历史断裂终局" : "渐进式飞升终局",
  ];

  return { importantEvents, rareFindings, possibleEndings };
}
