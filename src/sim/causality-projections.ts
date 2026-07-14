import { add, derived, unique } from "./causality-builder";
import { AXIOMS, metricIds, type CausalMappingContext } from "./causality-model";
import type { TargetMutation } from "./types";

export function addInterventionResults(context: CausalMappingContext): void {
  const { builder, subjects, universe } = context;
  const interventionNodes = universe.miracleState.appliedMiracles.map((miracle) => `intervention:${miracle.id}`);
  const mutationNodes: string[] = [];
  const probabilityNodes: string[] = [];

  universe.miracleState.appliedMiracles.forEach((miracle) => {
    miracle.targetMutations.forEach((mutation, index) => {
      const nodeId = `target-mutation:${miracle.id}:${index + 1}`;
      mutationNodes.push(nodeId);
      add(builder, subjects, derived(
        nodeId,
        `${miracle.id}.mutation.${mutation.targetKind}.${mutation.targetId}.${mutation.field}`,
        "target_mutation",
        `${miracle.title}：${mutation.field}`,
        `${mutation.explanation} ${String(mutation.before)} → ${String(mutation.after)}。`,
        [`intervention:${miracle.id}`],
        [AXIOMS.interventionApplication],
      ));
      const targetNodeId = targetNodeForMutation(subjects, mutation);
      if (targetNodeId) builder.derive(targetNodeId, [nodeId], [AXIOMS.interventionApplication], "intervenes");
    });

    miracle.probabilityShifts.forEach((shift, index) => {
      const nodeId = `probability-shift:${miracle.id}:${index + 1}`;
      probabilityNodes.push(nodeId);
      add(builder, subjects, derived(
        nodeId,
        `${miracle.id}.probability-shift.${shift.eventType}.${index + 1}`,
        "probability_shift",
        `${shift.eventType} 概率偏移`,
        `${shift.explanation} 偏移量 ${shift.delta}。`,
        [`intervention:${miracle.id}`],
        [AXIOMS.interventionApplication],
      ));
    });
  });

  const metricNodes = metricIds.map((metricId) => {
    const nodeId = `intervention-metric:${metricId}`;
    const effectNodes = universe.miracleState.appliedMiracles.flatMap((miracle) => miracle.immediateEffects
      .map((effect, index) => ({ effect, nodeId: subjects.first(`miracle-effect:${miracle.id}:${index + 1}`) }))
      .filter((entry) => entry.effect.metric === metricId)
      .map((entry) => entry.nodeId)
      .filter((entry): entry is string => Boolean(entry)));
    add(builder, subjects, derived(
      nodeId,
      `miracle-state.metric-delta.${metricId}`,
      "intervention_metric",
      `${metricId} 干预汇总`,
      `累计变化 ${universe.miracleState.metricDeltas[metricId]}。`,
      unique([`metric:${metricId}`, ...interventionNodes, ...effectNodes]),
      [AXIOMS.interventionApplication],
    ));
    return nodeId;
  });

  const accountingNodes = [
    ["budget", "奇迹点预算", universe.miracleState.miraclePointBudget],
    ["spent", "已消耗奇迹点", universe.miracleState.spentMiraclePoints],
    ["remaining", "剩余奇迹点", universe.miracleState.remainingMiraclePoints],
    ["causality-strain", "因果压力", universe.miracleState.causalityStrain],
  ] as const;
  const accountingNodeIds = accountingNodes.map(([key, label, value]) => {
    const nodeId = `intervention-metric:${key}`;
    add(builder, subjects, derived(
      nodeId,
      `miracle-state.${key}`,
      "intervention_metric",
      label,
      `${label}为 ${value}。`,
      interventionNodes.length > 0 ? interventionNodes : ["input:seed"],
      [AXIOMS.interventionApplication],
    ));
    return nodeId;
  });

  add(builder, subjects, derived(
    "intervention-result:state",
    "miracle-state",
    "intervention_result",
    "干预状态",
    universe.miracleState.summary,
    unique([
      ...(interventionNodes.length > 0 ? interventionNodes : ["input:seed"]),
      ...mutationNodes,
      ...probabilityNodes,
      ...metricNodes,
      ...accountingNodeIds,
    ]),
    [AXIOMS.interventionApplication],
  ));

  for (const log of universe.miracleState.interventionLog) {
    add(builder, subjects, derived(
      `intervention-result:${log.id}`,
      log.id,
      "intervention_result",
      log.directResult,
      log.longTermConsequence,
      unique([
        ...subjects.all(log.miracleId),
        ...log.resultEventIds.map((id) => `timeline-event:${id}`),
        ...log.sourceIds.flatMap((id) => subjects.all(id)),
      ]),
      [AXIOMS.interventionApplication],
    ));
  }
}

export function addExplanationsAndObservations(context: CausalMappingContext): void {
  const { builder, subjects, universe } = context;
  for (const explanation of universe.explanations) {
    const targetNodes = subjects.all(explanation.targetId);
    add(builder, subjects, derived(
      `explanation:${explanation.id}`,
      explanation.id,
      "explanation",
      `解释：${explanation.targetId}`,
      explanation.text,
      targetNodes.length > 0 ? targetNodes : ["universe:identity"],
      [AXIOMS.explanationProjection],
    ));
  }

  universe.observationLog.importantEvents.forEach((text, index) => {
    const event = universe.timeline.find((candidate) => candidate.title === text);
    add(builder, subjects, derived(
      `observation:important:${index + 1}`,
      `observation.important.${index + 1}`,
      "observation",
      "重要事件观察",
      text,
      event ? [`timeline-event:${event.id}`] : ["timeline-impact:summary"],
      [AXIOMS.observationProjection],
    ));
  });
  const rareSources = ["law-domain:magic", "law-domain:consciousness", "metric:causalityIntegrity"];
  universe.observationLog.rareFindings.forEach((text, index) => add(builder, subjects, derived(
    `observation:rare:${index + 1}`,
    `observation.rare.${index + 1}`,
    "observation",
    "稀有发现观察",
    text,
    [rareSources[index] ?? "universe:identity"],
    [AXIOMS.observationProjection],
  )));
  const endingSources = ["metric:stability", "metric:divineActivity", "metric:causalityIntegrity"];
  universe.observationLog.possibleEndings.forEach((text, index) => add(builder, subjects, derived(
    `observation:ending:${index + 1}`,
    `observation.ending.${index + 1}`,
    "observation",
    "潜在终局观察",
    text,
    [endingSources[index] ?? "timeline-impact:summary"],
    [AXIOMS.observationProjection],
  )));
}

export function addShareResults(context: CausalMappingContext): void {
  const { builder, subjects, universe } = context;
  const interventionInputs = context.interventions.map((_, index) => subjects.first(`intervention-input:${index}`)).filter(isDefined);
  add(builder, subjects, derived(
    "share:code",
    "share.code",
    "share_result",
    "分享码",
    universe.shareCode,
    ["input:seed", "input:ruleset", `template:${universe.templateId}`, ...interventionInputs],
    [AXIOMS.shareProjection],
  ));
  add(builder, subjects, derived(
    "share:url",
    "share.url",
    "share_result",
    "分享链接",
    universe.shareUrl,
    ["input:seed", "input:ruleset", `template:${universe.templateId}`, ...interventionInputs],
    [AXIOMS.shareProjection],
  ));
  add(builder, subjects, derived(
    "share:text",
    "share.text",
    "share_result",
    "分享文本",
    universe.shareText,
    ["universe:identity", "share:code", "intervention-result:state"],
    [AXIOMS.shareProjection],
  ));
}

function targetNodeForMutation(subjects: CausalMappingContext["subjects"], mutation: TargetMutation): string | undefined {
  if (mutation.targetKind === "mythology") return subjects.first(`${mutation.targetId}.mythology`);
  return subjects.first(mutation.targetId);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
