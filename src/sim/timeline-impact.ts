import { localGenerationBiasLabels, timelineEraOrder } from "./content/timeline";
import { clamp, round } from "./random";
import type {
  EraId,
  EventEffect,
  EventType,
  LocalGenerationBias,
  LocalGenerationBiasId,
  MetricId,
  TimelineEraProfile,
  TimelineEvent,
  TimelineImpactSummary,
  UniverseMetrics,
} from "./types";

const metricIds: MetricId[] = ["age", "stability", "lifePotential", "civilizationPotential", "magicIntensity", "divineActivity", "causalityIntegrity"];

export function summarizeTimelineImpact(timeline: TimelineEvent[], metrics: UniverseMetrics): TimelineImpactSummary {
  const metricDeltas = emptyMetricDeltas();
  const pressureDeltas: TimelineImpactSummary["pressureDeltas"] = { timeline: 0, laws: 0 };
  for (const event of timeline) {
    for (const effect of event.effects) {
      if (effect.metric === "timeline" || effect.metric === "laws") {
        pressureDeltas[effect.metric] += effect.delta;
      } else {
        metricDeltas[effect.metric] += effect.delta;
      }
    }
  }
  const futureAffectingEvents = timeline.filter((event) => event.effects.some((effect) => effect.affectsFuture));
  const eraProfiles = timelineEraOrder.map((era) => summarizeEra(timeline, era));
  const localBiases = buildLocalGenerationBiases(timeline, metrics, metricDeltas, pressureDeltas);
  const keySourceEventIds = selectKeySourceEvents(futureAffectingEvents.length > 0 ? futureAffectingEvents : timeline, 5);
  const strongestBias = [...localBiases].sort((left, right) => right.value - left.value)[0];
  return {
    eventCount: timeline.length,
    futureAffectingEventCount: futureAffectingEvents.length,
    metricDeltas: normalizeMetricDeltas(metricDeltas),
    pressureDeltas: {
      timeline: round(clamp(pressureDeltas.timeline, -50, 50)),
      laws: round(clamp(pressureDeltas.laws, -50, 50)),
    },
    localBiases,
    eraProfiles,
    keySourceEventIds,
    summary: `局部对象生成应优先关注${strongestBias.label}，其偏置值为 ${strongestBias.value}。`,
  };
}

function emptyMetricDeltas(): Record<MetricId, number> {
  return { age: 0, stability: 0, lifePotential: 0, civilizationPotential: 0, magicIntensity: 0, divineActivity: 0, causalityIntegrity: 0 };
}

function normalizeMetricDeltas(metricDeltas: Record<MetricId, number>): Record<MetricId, number> {
  return metricIds.reduce((result, metricId) => {
    result[metricId] = round(clamp(metricDeltas[metricId], -50, 50));
    return result;
  }, emptyMetricDeltas());
}

function summarizeEra(timeline: TimelineEvent[], era: EraId): TimelineEraProfile {
  const events = timeline.filter((event) => event.era === era);
  const futureAffectingEvents = events.filter((event) => event.effects.some((effect) => effect.affectsFuture));
  return {
    era,
    eventCount: events.length,
    futureAffectingEventCount: futureAffectingEvents.length,
    influenceScore: round(events.reduce((sum, event) => sum + event.importance / 20 + event.effects.reduce((effectSum, effect) => effectSum + Math.abs(effect.delta), 0), 0)),
    dominantType: dominantEventType(events),
    keyEventIds: selectKeySourceEvents(events, 3),
  };
}

function dominantEventType(events: TimelineEvent[]): EventType {
  if (events.length === 0) return "creation";
  const counts = events.reduce((result, event) => {
    result[event.type] = (result[event.type] ?? 0) + 1;
    return result;
  }, {} as Partial<Record<EventType, number>>);
  return (Object.entries(counts) as Array<[EventType, number]>).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0];
}

function buildLocalGenerationBiases(
  timeline: TimelineEvent[],
  metrics: UniverseMetrics,
  metricDeltas: Record<MetricId, number>,
  pressureDeltas: TimelineImpactSummary["pressureDeltas"],
): LocalGenerationBias[] {
  const counts = countEventTypes(timeline);
  const recipes: Array<{ id: LocalGenerationBiasId; value: number; eventTypes: EventType[]; effectMetrics: EventEffect["metric"][] }> = [
    { id: "galaxyDensity", value: 44 + metrics.age.value * 0.16 + counts.stars * 3 + counts.elements * 2 + metricDeltas.lifePotential * 0.5 + pressureDeltas.timeline * 0.4, eventTypes: ["stars", "elements"], effectMetrics: ["lifePotential", "timeline"] },
    { id: "stellarStability", value: metrics.stability.value * 0.62 + metricDeltas.stability * 1.1 + counts.stars * 2 - counts.anomaly * 2 - Math.max(0, pressureDeltas.laws) * 0.5, eventTypes: ["stars", "creation", "anomaly"], effectMetrics: ["stability", "laws"] },
    { id: "planetHabitability", value: metrics.lifePotential.value * 0.44 + metrics.stability.value * 0.28 + metricDeltas.lifePotential * 1.1 + metricDeltas.stability * 0.8 - counts.anomaly * 1.5, eventTypes: ["elements", "life", "anomaly"], effectMetrics: ["lifePotential", "stability"] },
    { id: "biosphereChance", value: metrics.lifePotential.value * 0.58 + counts.life * 3.4 + metricDeltas.lifePotential * 1.3 + metricDeltas.magicIntensity * 0.4, eventTypes: ["life", "elements"], effectMetrics: ["lifePotential", "magicIntensity"] },
    { id: "civilizationSeedChance", value: metrics.civilizationPotential.value * 0.6 + counts.civilization * 3.2 + counts.ascension * 1.5 + metricDeltas.civilizationPotential * 1.2, eventTypes: ["civilization", "ascension"], effectMetrics: ["civilizationPotential"] },
    { id: "magicAnomalyDensity", value: metrics.magicIntensity.value * 0.62 + counts.anomaly * 4.5 + counts.myth * 2 + metricDeltas.magicIntensity + Math.max(0, -metricDeltas.causalityIntegrity) * 0.5, eventTypes: ["myth", "anomaly", "elements"], effectMetrics: ["magicIntensity", "causalityIntegrity"] },
    { id: "divineRelicDensity", value: metrics.divineActivity.value * 0.62 + counts.myth * 3 + counts.ascension * 2 + metricDeltas.divineActivity * 1.1, eventTypes: ["myth", "ascension", "civilization"], effectMetrics: ["divineActivity"] },
    { id: "causalHazardLevel", value: (100 - metrics.causalityIntegrity.value) * 0.55 + counts.anomaly * 5 + counts.ending * 2 - metricDeltas.causalityIntegrity * 1.3 + Math.max(0, -pressureDeltas.timeline) * 1.4, eventTypes: ["anomaly", "ending", "myth"], effectMetrics: ["causalityIntegrity", "timeline", "laws"] },
  ];
  return recipes.map((recipe) => ({
    id: recipe.id,
    label: localGenerationBiasLabels[recipe.id],
    value: round(clamp(recipe.value)),
    sourceEventIds: sourceEventsForBias(timeline, recipe.eventTypes, recipe.effectMetrics),
    explanation: `${localGenerationBiasLabels[recipe.id]}由时间线事件、宇宙指标和事件效果共同折算，供局部对象生成时读取。`,
  }));
}

function countEventTypes(timeline: TimelineEvent[]): Record<EventType, number> {
  return {
    creation: 0, stars: 0, elements: 0, life: 0, civilization: 0, myth: 0, ascension: 0, ending: 0, anomaly: 0,
    ...timeline.reduce((result, event) => {
      result[event.type] = (result[event.type] ?? 0) + 1;
      return result;
    }, {} as Partial<Record<EventType, number>>),
  };
}

function sourceEventsForBias(timeline: TimelineEvent[], eventTypes: EventType[], effectMetrics: EventEffect["metric"][]): string[] {
  const matchedEvents = timeline.filter((event) => eventTypes.includes(event.type) || event.effects.some((effect) => effectMetrics.includes(effect.metric)));
  return selectKeySourceEvents(matchedEvents.length > 0 ? matchedEvents : timeline, 3);
}

function selectKeySourceEvents(events: TimelineEvent[], limit: number): string[] {
  return [...events].sort((left, right) => right.importance - left.importance || left.age - right.age || left.id.localeCompare(right.id)).slice(0, limit).map((event) => event.id);
}
