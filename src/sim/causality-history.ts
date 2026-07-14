import { add, compact, derived, isRuleNodeId, randomRefs, unique } from "./causality-builder";
import { AXIOMS, metricIds, type CausalMappingContext } from "./causality-model";
import { addTimelineBaseCollectionBoundary, addTimelineFinalCollectionBoundary } from "./causality-collections";

export function addInterventions(context: CausalMappingContext): void {
  const { builder, subjects, universe, interventions, trace, generation } = context;
  universe.miracleState.appliedMiracles.forEach((miracle, index) => {
    const inputNode = subjects.first(`intervention-input:${index}`)
      ?? `input:intervention:${index + 1}:${interventions[index]?.id ?? miracle.id}`;
    const rootRefs = randomRefs(trace, ["root.interventions"], `应用干预“${miracle.title}”`, [`intervention:${miracle.id}`]);
    const domainRefs = randomRefs(trace, [`root.interventions.domain.${index + 1}`], `变更干预目标“${miracle.targetLabel}”`);
    const inputEvidence = generation.inputs[index + 3];
    add(builder, subjects, {
      ...derived(
      `intervention:${miracle.id}`,
      miracle.id,
      "intervention",
      miracle.title,
      `显式输入作用于 ${miracle.targetLabel}，并承担奇迹点与因果压力代价。`,
      [inputNode],
      [AXIOMS.interventionApplication],
      [...rootRefs, ...domainRefs],
      ),
      input: inputEvidence ? {
        kind: inputEvidence.kind,
        order: inputEvidence.order,
        subjectId: inputEvidence.subjectId,
        value: inputEvidence.value,
      } : undefined,
    });
  });
}

export function addTimelineAndEffects(context: CausalMappingContext): void {
  const { builder, subjects, universe, trace } = context;
  const timelineBoundaryId = addTimelineBaseCollectionBoundary(context);
  for (const event of universe.timeline) {
    const interventionEvent = event.id.startsWith("miracle");
    add(builder, subjects, {
      id: `timeline-event:${event.id}`,
      subjectId: event.id,
      kind: "timeline_event",
      label: event.title,
      description: event.description,
      randomSampleRefs: randomRefs(
        trace,
        interventionEvent ? ["root.interventions"] : ["root.timeline"],
        `生成事件“${event.title}”`,
        [interventionEvent ? `intervention:${event.sourceIds[0] ?? event.id}` : `timeline-event:${event.id}`],
      ),
    });
  }

  universe.timeline.forEach((event) => {
    const nodeId = `timeline-event:${event.id}`;
    const sourceNodes = event.sourceIds.flatMap((sourceId) => subjects.all(sourceId));
    const triggerNodes = event.triggeredByEventIds.map((eventId) => `timeline-event:${eventId}`);
    const effectMetrics = event.effects
      .filter((effect) => metricIds.includes(effect.metric as (typeof metricIds)[number]))
      .map((effect) => `metric:${effect.metric}`);
    const interventionRules = event.id.startsWith("miracle") ? [AXIOMS.interventionApplication] : [];
    const ruleIds = unique([
      AXIOMS.timelineGeneration,
      ...interventionRules,
      ...sourceNodes.filter((sourceId) => isRuleNodeId(sourceId)),
    ]);
    const creationRoot = event.type === "creation" ? ["initial-state:creation-origin"] : [];
    builder.derive(nodeId, unique([
      ...(event.id.startsWith("miracle") ? [] : [timelineBoundaryId]),
      `template:${universe.templateId}`,
      ...creationRoot,
      ...sourceNodes,
      ...triggerNodes,
      ...effectMetrics,
    ]), ruleIds, triggerNodes.length > 0 ? "triggers" : "derives");

    event.effects.forEach((effect, index) => {
      const metricCause = metricIds.includes(effect.metric as (typeof metricIds)[number]) ? `metric:${effect.metric}` : undefined;
      const aliases = event.id.startsWith("miracle-event-")
        ? [`miracle-effect:${event.sourceIds[0] ?? event.id}:${index + 1}`]
        : [];
      add(builder, subjects, derived(
        `event-effect:${event.id}:${index + 1}`,
        `${event.id}.effect.${index + 1}`,
        "event_effect",
        `${event.title}：${effect.metric}`,
        `${effect.description}；变化量 ${effect.delta}；影响类型 ${effect.influence}。`,
        compact([nodeId, metricCause]),
        [AXIOMS.eventEffectProjection],
      ), aliases);
    });
  });
  addTimelineFinalCollectionBoundary(context, timelineBoundaryId);
}

export function addTimelineImpact(context: CausalMappingContext): void {
  const { builder, subjects, universe } = context;
  const eventNodes = universe.timeline.map((event) => `timeline-event:${event.id}`);
  add(builder, subjects, derived(
    "timeline-impact:summary",
    "timeline-impact",
    "timeline_impact",
    "时间线影响摘要",
    universe.timelineImpact.summary,
    eventNodes,
    [AXIOMS.timelineProjection],
  ));
  universe.timelineImpact.localBiases.forEach((bias) => add(builder, subjects, derived(
    `timeline-impact:bias:${bias.id}`,
    `timeline-bias.${bias.id}`,
    "timeline_impact",
    bias.label,
    bias.explanation,
    unique(["timeline-impact:summary", ...bias.sourceEventIds.map((id) => `timeline-event:${id}`)]),
    [AXIOMS.timelineProjection],
  )));
  universe.timelineImpact.eraProfiles.forEach((profile) => add(builder, subjects, derived(
    `timeline-impact:era:${profile.era}`,
    `timeline-era.${profile.era}`,
    "timeline_impact",
    `${profile.era} 纪元影响`,
    `事件 ${profile.eventCount} 个，影响强度 ${profile.influenceScore}。`,
    unique(["timeline-impact:summary", ...profile.keyEventIds.map((id) => `timeline-event:${id}`)]),
    [AXIOMS.timelineProjection],
  )));
}
