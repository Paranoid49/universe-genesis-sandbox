import { clamp, round, type RandomStream } from "./random";
import {
  timelineEraOrder,
  timelineEventBlueprints,
  timelineEventTypeToEra,
  timelineFutureEffectText,
  timelineMetricNames,
  type TimelineEventBlueprint,
} from "./content/timeline";
import type {
  EraId,
  EventEffect,
  EventType,
  MetricId,
  StructuredLaw,
  TimelineEvent,
  UniverseLaws,
  UniverseMetrics,
} from "./types";
import type { UniverseTemplate } from "./templates";
export { summarizeTimelineImpact } from "./timeline-impact";

type EventDraft = Omit<TimelineEvent, "id" | "triggeredByEventIds" | "sourceIds"> & {
  draftId: string;
  triggeredByDraftIds: string[];
  sourceDraftIds: string[];
  sourceIds: string[];
};

type TimelineState = {
  eventWeights: Record<EventType, number>;
  metricTendencies: Record<MetricId, number>;
  influentialDraftIds: string[];
};

export function generateTimeline(template: UniverseTemplate, laws: UniverseLaws, metrics: UniverseMetrics, rng: RandomStream): TimelineEvent[] {
  const targetCount = rng.withScope("timeline:count", (scoped) => scoped.int(30, 36));
  const state = initialTimelineState(template, laws, metrics);
  const drafts: EventDraft[] = [];

  for (const era of timelineEraOrder) {
    const type = era === "elements" ? "elements" : era === "ascension" ? "ascension" : era;
    const scopeId = nextDraftScope(drafts);
    const draft = rng.withScope(scopeId, (scoped) => createDraft(type, template, laws, metrics, scoped, state, drafts, era));
    drafts.push(draft);
    applyEventInfluence(draft, state);
  }

  while (drafts.length < targetCount) {
    const scopeId = nextDraftScope(drafts);
    const draft = rng.withScope(scopeId, (scoped) => {
      const type = pickEventType(state, template, scoped);
      const era = type === "anomaly" ? scoped.pick(timelineEraOrder.slice(2)) : timelineEventTypeToEra[type];
      return createDraft(type, template, laws, metrics, scoped, state, drafts, era);
    });
    drafts.push(draft);
    applyEventInfluence(draft, state);
  }

  return materializeTimeline(drafts, rng);
}

function nextDraftScope(drafts: EventDraft[]): string {
  return `timeline-draft:draft-${String(drafts.length + 1).padStart(2, "0")}`;
}

export function filterTimelineByEra(timeline: TimelineEvent[], era: EraId | "all"): TimelineEvent[] {
  if (era === "all") {
    return timeline;
  }
  return timeline.filter((event) => event.era === era);
}

function initialTimelineState(template: UniverseTemplate, laws: UniverseLaws, metrics: UniverseMetrics): TimelineState {
  return {
    eventWeights: {
      creation: template.timelineBias.creation ?? 0.25,
      stars: (template.timelineBias.stars ?? 1) + laws.physics.rating.value / 80,
      elements: (template.timelineBias.elements ?? 1) + (laws.physics.rating.value + laws.magic.rating.value) / 140,
      life: (template.timelineBias.life ?? 1) + metrics.lifePotential.value / 70,
      civilization: (template.timelineBias.civilization ?? 1) + metrics.civilizationPotential.value / 70,
      myth: (template.timelineBias.myth ?? 1) + (laws.divinity.rating.value + laws.consciousness.rating.value) / 150,
      ascension: (template.timelineBias.ascension ?? 1) + metrics.civilizationPotential.value / 120,
      ending: (template.timelineBias.ending ?? 1) + (100 - metrics.stability.value) / 110,
      anomaly: (template.timelineBias.anomaly ?? 1) + (100 - metrics.causalityIntegrity.value) / 90,
    },
    metricTendencies: {
      age: 0,
      stability: 0,
      lifePotential: 0,
      civilizationPotential: 0,
      magicIntensity: 0,
      divineActivity: 0,
      causalityIntegrity: 0,
    },
    influentialDraftIds: [],
  };
}

function createDraft(
  type: EventType,
  template: UniverseTemplate,
  laws: UniverseLaws,
  metrics: UniverseMetrics,
  rng: RandomStream,
  state: TimelineState,
  drafts: EventDraft[],
  eraOverride?: EraId,
): EventDraft {
  const blueprint = rng.pick(timelineEventBlueprints[type]);
  const era = eraOverride ?? blueprint.era;
  const trigger = pickTriggerDraft(drafts, era, rng);
  const sourceLaw = strongestRuleForType(type, laws);
  const sourceIds = [sourceLaw.id, `metric.${effectMetricId(blueprint.metric)}`];
  const triggeredByDraftIds = trigger ? [trigger.draftId] : [];
  const sourceDraftIds = trigger ? [trigger.draftId] : [];
  const deltaBase = rng.int(blueprint.deltaRange[0], blueprint.deltaRange[1]);
  const tendency = blueprint.metric in state.metricTendencies ? state.metricTendencies[blueprint.metric as MetricId] : 0;
  const delta = round(clamp(deltaBase + tendency, -20, 20));
  const effect = buildEffect(blueprint, delta, type);
  const causes = [...blueprint.cause(laws, metrics), sourceLaw.explanation];
  const causalNotes = [
    `阶段 3 生成器将“${sourceLaw.name}”作为该事件的主要法则来源。`,
    trigger ? `前序事件“${trigger.title}”改变了后续权重，因此推动本事件进入时间线。` : `${template.name}的初始权重让该纪元成为时间线锚点。`,
  ];

  return {
    draftId: `draft-${String(drafts.length + 1).padStart(2, "0")}`,
    age: ageForEra(era, rng),
    ageLabel: "",
    era,
    type,
    title: rng.pick(blueprint.titles),
    description: blueprint.description(laws, metrics),
    causes,
    effects: [effect],
    importance: importanceFor(type, effect, trigger, rng),
    location: blueprint.location,
    sourceIds,
    sourceDraftIds,
    triggeredByDraftIds,
    causalNotes,
  };
}

function buildEffect(blueprint: TimelineEventBlueprint, delta: number, type: EventType): EventEffect {
  const futureText = futureEffectText(type);
  return {
    metric: blueprint.metric,
    delta,
    description: `${futureText}，${effectMetricName(blueprint.metric)}倾向变化 ${signed(delta)}。`,
    influence: blueprint.influence,
    affectsFuture: type !== "creation" || Math.abs(delta) >= 6,
  };
}

function applyEventInfluence(draft: EventDraft, state: TimelineState): void {
  for (const effect of draft.effects) {
    if (!effect.affectsFuture) {
      continue;
    }
    state.influentialDraftIds.push(draft.draftId);
    if (effect.metric in state.metricTendencies) {
      const metric = effect.metric as MetricId;
      state.metricTendencies[metric] = round(clamp(state.metricTendencies[metric] + effect.delta / 5, -12, 12));
    }
    for (const [target, delta] of Object.entries(weightChangesFor(draft.type, effect.delta)) as Array<[EventType, number]>) {
      state.eventWeights[target] = Math.max(0.15, state.eventWeights[target] + delta);
    }
  }
}

function pickEventType(state: TimelineState, template: UniverseTemplate, rng: RandomStream): EventType {
  return rng.weighted(
    (Object.keys(state.eventWeights) as EventType[]).map((type) => ({
      item: type,
      weight: state.eventWeights[type] + (template.timelineBias[type] ?? 0),
    })),
  );
}

function pickTriggerDraft(drafts: EventDraft[], era: EraId, rng: RandomStream): EventDraft | undefined {
  const currentEraIndex = timelineEraOrder.indexOf(era);
  const candidates = drafts.filter((draft) => draft.effects.some((effect) => effect.affectsFuture) && timelineEraOrder.indexOf(draft.era) <= currentEraIndex);
  if (candidates.length === 0) {
    return undefined;
  }
  const recentCandidates = candidates.slice(-8);
  return rng.pick(recentCandidates);
}

function materializeTimeline(drafts: EventDraft[], rng: RandomStream): TimelineEvent[] {
  const sorted = [...drafts].sort((left, right) => left.age - right.age || left.draftId.localeCompare(right.draftId));
  const idByDraft = new Map(sorted.map((draft, index) => [draft.draftId, `evt-${String(index + 1).padStart(2, "0")}`]));

  return sorted.map((draft, index) => {
    const id = idByDraft.get(draft.draftId) ?? `evt-${String(index + 1).padStart(2, "0")}`;
    rng.renameScope(`timeline-draft:${draft.draftId}`, `timeline-event:${id}`);
    return {
      id,
      age: draft.age,
      ageLabel: ageLabel(draft.age, draft.era),
      era: draft.era,
      type: draft.type,
      title: draft.title,
      description: draft.description,
      causes: draft.causes,
      effects: draft.effects,
      importance: draft.importance,
      location: draft.location,
      sourceIds: [
        ...draft.sourceIds,
        ...draft.sourceDraftIds.map((draftId) => idByDraft.get(draftId)).filter((value): value is string => Boolean(value)),
      ],
      triggeredByEventIds: draft.triggeredByDraftIds.map((draftId) => idByDraft.get(draftId)).filter((value): value is string => Boolean(value)),
      causalNotes: draft.causalNotes,
    };
  });
}

function ageForEra(era: EraId, rng: RandomStream): number {
  const eraIndex = timelineEraOrder.indexOf(era);
  const start = eraIndex * 1200;
  const jitter = era === "creation" ? rng.int(0, 420) : rng.int(80, 1160);
  return Math.round(clamp(start + jitter, 0, 9999));
}

function ageLabel(age: number, era: EraId): string {
  if (era === "creation" && age < 120) {
    return "创世瞬间";
  }
  return `第 ${age} 纪元`;
}

function strongestRuleForType(type: EventType, laws: UniverseLaws): StructuredLaw {
  if (type === "stars" || type === "creation") return strongestRule(laws.physics.rules);
  if (type === "elements") return strongestRule([...laws.physics.rules, ...laws.magic.rules]);
  if (type === "life") return strongestRule(laws.life.rules);
  if (type === "civilization" || type === "ascension") return strongestRule(laws.consciousness.rules);
  if (type === "myth") return strongestRule(laws.divinity.rules);
  if (type === "anomaly" || type === "ending") return strongestRule(laws.causality.rules);
  return strongestRule(laws.physics.rules);
}

function strongestRule(rules: StructuredLaw[]): StructuredLaw {
  return [...rules].sort((left, right) => right.value - left.value)[0];
}

function weightChangesFor(type: EventType, delta: number): Partial<Record<EventType, number>> {
  const direction = delta >= 0 ? 1 : -1;
  const magnitude = Math.max(0.2, Math.abs(delta) / 8);
  const changes: Record<EventType, Partial<Record<EventType, number>>> = {
    creation: { stars: 0.4, elements: 0.2 },
    stars: { elements: 0.5 * direction, life: 0.45 * direction, anomaly: direction < 0 ? 0.4 : -0.1 },
    elements: { life: 0.5 * direction, civilization: 0.25 * direction, myth: 0.15 * direction },
    life: { civilization: 0.55 * direction, myth: 0.25 * direction, ending: direction < 0 ? 0.25 : -0.1 },
    civilization: { myth: 0.4 * direction, ascension: 0.45 * direction, ending: direction < 0 ? 0.35 : 0.05 },
    myth: { ascension: 0.25 * direction, ending: 0.35, anomaly: direction < 0 ? 0.45 : 0.15 },
    ascension: { ending: 0.5, anomaly: direction < 0 ? 0.35 : -0.15 },
    ending: { ending: 0.2, anomaly: 0.2 },
    anomaly: { anomaly: 0.45, ending: 0.4, myth: 0.2 },
  };
  const result: Partial<Record<EventType, number>> = {};
  for (const [target, value] of Object.entries(changes[type]) as Array<[EventType, number]>) {
    result[target] = round(value * magnitude * 100) / 100;
  }
  return result;
}

function importanceFor(type: EventType, effect: EventEffect, trigger: EventDraft | undefined, rng: RandomStream): number {
  const base = type === "creation" || type === "ending" ? 82 : type === "anomaly" || type === "ascension" ? 70 : 58;
  const triggerBoost = trigger ? 6 : 0;
  return Math.round(clamp(base + Math.abs(effect.delta) * 1.2 + triggerBoost + rng.range(-8, 12), 35, 99));
}

function futureEffectText(type: EventType): string {
  return timelineFutureEffectText[type];
}

function effectMetricId(metric: EventEffect["metric"]): string {
  return metric === "timeline" || metric === "laws" ? metric : metric;
}

function effectMetricName(metric: EventEffect["metric"]): string {
  if (metric === "timeline") return "时间线";
  if (metric === "laws") return "法则压力";
  return timelineMetricNames[metric];
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
