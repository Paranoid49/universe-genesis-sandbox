import { miracleDefinitions } from "./content/miracles";
import { applyInterventionToDomain } from "./intervention-domain";
import { UniverseInputError } from "./errors";
import { clamp, round, type RandomStream } from "./random";
import type {
  Civilization,
  EventEffect,
  EventType,
  Galaxy,
  InterventionInput,
  InterventionLog,
  MetricId,
  Miracle,
  MiracleDefinition,
  MiracleOveruseLevel,
  MiracleState,
  MiracleTargetKind,
  TimelineEvent,
  UniverseMetrics,
} from "./types";

const miraclePointBudget = 12;
const metricIds: MetricId[] = ["age", "stability", "lifePotential", "civilizationPotential", "magicIntensity", "divineActivity", "causalityIntegrity"];

type InterventionContext = {
  seed: string;
  metrics: UniverseMetrics;
  timeline: TimelineEvent[];
  galaxies: Galaxy[];
  civilizations: Civilization[];
};

type InterventionResult = {
  metrics: UniverseMetrics;
  timeline: TimelineEvent[];
  galaxies: Galaxy[];
  civilizations: Civilization[];
  miracleState: MiracleState;
};

type TargetInfo = {
  id: string;
  label: string;
  kind: MiracleTargetKind;
  location: string;
  sourceIds: string[];
};

export function applyInterventions(context: InterventionContext, interventions: InterventionInput[] | undefined, rng: RandomStream): InterventionResult {
  const requestedInterventions = interventions ?? [];
  const metricDeltas = emptyMetricDeltas();
  const appliedMiracles: Miracle[] = [];
  const interventionLog: InterventionLog[] = [];
  const resultEvents: TimelineEvent[] = [];
  let spentMiraclePoints = 0;
  let causalityStrain = 0;
  let lawPressure = 0;
  let domainState = {
    galaxies: context.galaxies,
    civilizations: context.civilizations,
  };

  requestedInterventions.forEach((input, index) => {
    const definition = miracleDefinitionFor(input.miracleType);
    const target = findTarget(context, definition.targetKind, input.targetId);
    const miracleId = stableMiracleId(input, index);
    const immediateEffects = interventionEffects(definition);
    const domainResult = applyInterventionToDomain(domainState, input, definition, miracleId, rng.fork(`domain.${index + 1}`));
    domainState = {
      galaxies: domainResult.galaxies,
      civilizations: domainResult.civilizations,
    };
    const eventId = `miracle-event-${String(index + 1).padStart(2, "0")}`;
    const miracle: Miracle = {
      id: miracleId,
      type: definition.type,
      title: definition.title,
      targetId: target.id,
      targetLabel: target.label,
      targetKind: target.kind,
      cost: definition.cost,
      immediateEffects,
      probabilityShifts: [definition.probabilityShift],
      targetMutations: domainResult.mutations,
      longTermRisks: definition.longTermRisks,
    };
    const event = createMiracleEvent(context.timeline, miracle, target, eventId, index, rng);

    spentMiraclePoints += definition.cost.miraclePoints;
    causalityStrain += definition.cost.causalityStrain;
    lawPressure += definition.cost.lawPressureDelta;
    accumulateMetricDeltas(metricDeltas, immediateEffects);
    appliedMiracles.push(miracle);
    resultEvents.push(event);
    interventionLog.push({
      id: `intervention-${String(index + 1).padStart(2, "0")}`,
      age: event.age,
      ageLabel: event.ageLabel,
      miracleId,
      miracleType: definition.type,
      targetId: target.id,
      targetLabel: target.label,
      resultEventIds: [event.id],
      directResult: event.description,
      longTermConsequence: definition.longTermRisks[0] ?? "该奇迹的长期后果仍在形成。",
      sourceIds: [miracleId, target.id, ...target.sourceIds],
    });
  });

  const overuseLevel = overuseLevelFor(spentMiraclePoints, causalityStrain);
  const backlashEvents = overuseLevel === "backlash" ? [createBacklashEvent(context.timeline, resultEvents, causalityStrain, lawPressure)] : [];
  for (const event of backlashEvents) {
    accumulateMetricDeltas(metricDeltas, event.effects);
  }

  const finalTimeline = [...context.timeline, ...resultEvents, ...backlashEvents].sort((left, right) => left.age - right.age || left.id.localeCompare(right.id));
  const finalMetrics = applyMetricDeltas(context.metrics, metricDeltas, appliedMiracles);
  const probabilityShifts = appliedMiracles.flatMap((miracle) => miracle.probabilityShifts);
  const miracleState: MiracleState = {
    mode: appliedMiracles.length > 0 ? "miracle" : "observer",
    miraclePointBudget,
    spentMiraclePoints,
    remainingMiraclePoints: Math.max(0, miraclePointBudget - spentMiraclePoints),
    causalityStrain: round(clamp(causalityStrain, 0, 100)),
    overuseLevel,
    availableMiracles: miracleDefinitions,
    appliedMiracles,
    interventionLog,
    metricDeltas,
    probabilityShifts,
    backlashEvents,
    summary: miracleSummary(appliedMiracles.length, spentMiraclePoints, causalityStrain, overuseLevel),
  };

  return {
    metrics: finalMetrics,
    timeline: finalTimeline,
    galaxies: domainState.galaxies,
    civilizations: domainState.civilizations,
    miracleState,
  };
}

function miracleDefinitionFor(type: InterventionInput["miracleType"]): MiracleDefinition {
  const definition = miracleDefinitions.find((entry) => entry.type === type);
  if (!definition) {
    throw new UniverseInputError("INVALID_INTERVENTION", "interventions.miracleType", `未知奇迹类型：${type}。`);
  }
  return definition;
}

function stableMiracleId(input: InterventionInput, index: number): string {
  return `miracle-${String(index + 1).padStart(2, "0")}-${input.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || input.miracleType}`;
}

function interventionEffects(definition: MiracleDefinition): EventEffect[] {
  const effects = [definition.effect];
  if (definition.cost.stabilityDelta !== 0 && definition.effect.metric !== "stability") {
    effects.push({
      metric: "stability",
      delta: definition.cost.stabilityDelta,
      description: `奇迹代价让稳定度变化 ${signed(definition.cost.stabilityDelta)}。`,
      influence: "metric",
      affectsFuture: true,
    });
  }
  if (definition.cost.lawPressureDelta !== 0) {
    effects.push({
      metric: "laws",
      delta: definition.cost.lawPressureDelta,
      description: `奇迹对法则压力造成 ${signed(definition.cost.lawPressureDelta)} 影响。`,
      influence: "law-pressure",
      affectsFuture: true,
    });
  }
  return effects;
}

function createMiracleEvent(
  timeline: TimelineEvent[],
  miracle: Miracle,
  target: TargetInfo,
  eventId: string,
  index: number,
  rng: RandomStream,
): TimelineEvent {
  const previousMiracleId = index > 0 ? `miracle-event-${String(index).padStart(2, "0")}` : undefined;
  return {
    id: eventId,
    age: nextInterventionAge(timeline, index),
    ageLabel: `干预纪元 ${index + 1}`,
    era: eraForMiracle(miracle.type),
    type: eventTypeForMiracle(miracle.type),
    title: `奇迹：${miracle.title}`,
    description: `造物主对${target.label}施加“${miracle.title}”，直接结果是${miracle.immediateEffects[0].description}`,
    causes: [`显式干预输入 ${miracle.id}`, `目标对象：${target.label}`],
    effects: miracle.immediateEffects,
    importance: round(clamp(76 + miracle.cost.miraclePoints * 3 + miracle.cost.causalityStrain / 3 + rng.range(-4, 6), 60, 99)),
    location: target.location,
    sourceIds: [miracle.id, target.id, ...target.sourceIds],
    triggeredByEventIds: previousMiracleId ? [previousMiracleId] : [],
    causalNotes: [
      "阶段 6 将该事件记录为显式造物主干预结果。",
      `${miracle.probabilityShifts[0].explanation}`,
    ],
  };
}

function createBacklashEvent(timeline: TimelineEvent[], resultEvents: TimelineEvent[], causalityStrain: number, lawPressure: number): TimelineEvent {
  const previousEvent = resultEvents[resultEvents.length - 1];
  return {
    id: "miracle-backlash-01",
    age: nextInterventionAge(timeline, resultEvents.length + 1),
    ageLabel: "干预反噬",
    era: "ending",
    type: "anomaly",
    title: "奇迹反噬震荡",
    description: `过度奇迹让因果压力升至 ${round(causalityStrain)}，法则裂缝开始回收干预债务。`,
    causes: ["奇迹点过度消耗", `累计法则压力 ${round(lawPressure)}`],
    effects: [
      {
        metric: "stability",
        delta: -10,
        description: "奇迹反噬降低宇宙稳定度。",
        influence: "metric",
        affectsFuture: true,
      },
      {
        metric: "causalityIntegrity",
        delta: -12,
        description: "奇迹反噬撕开新的因果裂缝。",
        influence: "metric",
        affectsFuture: true,
      },
      {
        metric: "timeline",
        delta: 14,
        description: "奇迹反噬提高后续异常事件权重。",
        influence: "probability",
        affectsFuture: true,
      },
    ],
    importance: 96,
    location: "宇宙级因果层",
    sourceIds: ["miracle-overuse", ...(previousEvent ? [previousEvent.id] : [])],
    triggeredByEventIds: previousEvent ? [previousEvent.id] : [],
    causalNotes: ["阶段 6 反噬门槛被触发，系统追加负面后果事件。"],
  };
}

function findTarget(context: InterventionContext, kind: MiracleTargetKind, targetId: string): TargetInfo {
  if (kind === "universe") {
    const expectedTargetId = `universe.${context.seed}`;
    if (targetId !== expectedTargetId) {
      throw new UniverseInputError("INVALID_TARGET", "interventions.targetId", `宇宙级奇迹目标必须是 ${expectedTargetId}。`);
    }
    return {
      id: targetId,
      label: "整个宇宙",
      kind,
      location: "宇宙整体",
      sourceIds: context.timeline.slice(0, 3).map((event) => event.id),
    };
  }
  if (kind === "star_system") {
    for (const galaxy of context.galaxies) {
      const system = galaxy.starSystems.find((entry) => entry.id === targetId);
      if (system) {
        return {
          id: system.id,
          label: `${system.name}恒星系`,
          kind,
          location: `${galaxy.name} / ${system.name}`,
          sourceIds: [...system.sourceEventIds, ...system.sourceRuleIds],
        };
      }
    }
  }
  if (kind === "planet") {
    for (const galaxy of context.galaxies) {
      for (const system of galaxy.starSystems) {
        const planet = system.planets.find((entry) => entry.id === targetId);
        if (planet) {
          return {
            id: planet.id,
            label: `${planet.name}行星`,
            kind,
            location: `${galaxy.name} / ${system.name} / ${planet.name}`,
            sourceIds: [...planet.sourceEventIds, ...planet.sourceRuleIds],
          };
        }
      }
    }
  }
  if (kind === "civilization" || kind === "mythology") {
    const civilization = context.civilizations.find((entry) => entry.id === targetId);
    if (civilization) {
      return {
        id: civilization.id,
        label: kind === "mythology" ? `${civilization.mythology.deityName}（${civilization.name}）` : civilization.name,
        kind,
        location: `${civilization.originGalaxyName} / ${civilization.originStarSystemName} / ${civilization.originPlanetName}`,
        sourceIds: kind === "mythology" ? [...civilization.mythology.sourceEventIds, ...civilization.mythology.sourceRuleIds] : [...civilization.sourceEventIds, ...civilization.sourceRuleIds],
      };
    }
  }
  return {
    id: targetId || "target.unknown",
    label: targetId ? `未知目标 ${targetId}` : "未指定目标",
    kind,
    location: "未知区域",
    sourceIds: context.timeline.slice(0, 2).map((event) => event.id),
  };
}

function applyMetricDeltas(metrics: UniverseMetrics, metricDeltas: Record<MetricId, number>, appliedMiracles: Miracle[]): UniverseMetrics {
  const influenceSource = appliedMiracles.length > 0 ? appliedMiracles.map((miracle) => miracle.title).join("、") : "无干预";
  return metricIds.reduce((result, metricId) => {
    const metric = metrics[metricId];
    const delta = metricDeltas[metricId];
    result[metricId] = delta === 0
      ? metric
      : {
          ...metric,
          value: round(clamp(metric.value + delta)),
          explanation: `${metric.explanation} 阶段 6 干预累计造成 ${signed(delta)} 调整。`,
          influences: [
            ...(metric.influences ?? []),
            {
              sourceId: "miracle.interventions",
              sourceLabel: influenceSource,
              targetMetric: metricId,
              delta,
              explanation: "阶段 6 造物主干预对该指标产生显式影响。",
            },
          ],
        };
    return result;
  }, {} as UniverseMetrics);
}

function accumulateMetricDeltas(metricDeltas: Record<MetricId, number>, effects: EventEffect[]): void {
  for (const effect of effects) {
    if (effect.metric !== "timeline" && effect.metric !== "laws") {
      metricDeltas[effect.metric] = round(clamp(metricDeltas[effect.metric] + effect.delta, -50, 50));
    }
  }
}

function emptyMetricDeltas(): Record<MetricId, number> {
  return {
    age: 0,
    stability: 0,
    lifePotential: 0,
    civilizationPotential: 0,
    magicIntensity: 0,
    divineActivity: 0,
    causalityIntegrity: 0,
  };
}

function overuseLevelFor(spentMiraclePoints: number, causalityStrain: number): MiracleOveruseLevel {
  if (spentMiraclePoints > miraclePointBudget || causalityStrain >= 60) return "backlash";
  if (spentMiraclePoints >= miraclePointBudget - 2 || causalityStrain >= 40) return "strained";
  return "none";
}

function miracleSummary(count: number, spentMiraclePoints: number, causalityStrain: number, overuseLevel: MiracleOveruseLevel): string {
  if (count === 0) {
    return "当前为观察者模式，宇宙未受到造物主干预。";
  }
  const state = overuseLevel === "backlash" ? "已触发反噬" : overuseLevel === "strained" ? "因果压力偏高" : "仍在可控范围";
  return `已施加 ${count} 次奇迹，消耗 ${spentMiraclePoints} 点奇迹点，因果压力 ${round(causalityStrain)}，${state}。`;
}

function nextInterventionAge(timeline: TimelineEvent[], index: number): number {
  const latestAge = Math.max(...timeline.map((event) => event.age), 0);
  return latestAge + 20 + index * 25;
}

function eraForMiracle(type: Miracle["type"]): TimelineEvent["era"] {
  if (type === "bless_planet" || type === "seed_life") return "life";
  if (type === "grant_magic" || type === "seal_deity") return "myth";
  if (type === "revive_civilization" || type === "send_catastrophe") return "civilization";
  if (type === "repair_causality") return "ending";
  return "stars";
}

function eventTypeForMiracle(type: Miracle["type"]): EventType {
  if (type === "bless_planet" || type === "seed_life") return "life";
  if (type === "grant_magic" || type === "seal_deity") return "myth";
  if (type === "revive_civilization" || type === "send_catastrophe") return "civilization";
  if (type === "repair_causality") return "anomaly";
  return "stars";
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
