import type { RuntimeEvent, StateTransition, UniverseState } from "./contracts/runtime";

export function projectRuntimeEvents(state: UniverseState): readonly RuntimeEvent[] {
  return Object.freeze(state.transitions.flatMap(projectTransitionEvents));
}

function projectTransitionEvents(transition: StateTransition): RuntimeEvent[] {
  const objectIds = [...new Set(transition.differences.map((entry) => entry.objectId))].sort();
  return objectIds.map((objectId) => {
    const differenceIndexes = transition.differences.flatMap((entry, index) => entry.objectId === objectId ? [index] : []);
    const statusDifference = differenceIndexes.map((index) => transition.differences[index]).find((entry) => entry.field === "status");
    const title = statusDifference
      ? `对象状态变为${String(statusDifference.after)}`
      : "对象结构发生变化";
    const description = differenceIndexes.map((index) => {
      const entry = transition.differences[index];
      return `${entry.field}：${String(entry.before)} → ${String(entry.after)}`;
    }).join("；");
    const causeSubjectIds = [...new Set(differenceIndexes.flatMap((index) => {
      const entry = transition.differences[index];
      return [entry.ruleId, entry.randomDecisionId].filter((value): value is string => Boolean(value));
    }))].sort();
    return Object.freeze({
      id: `runtime-event:${transition.id}:${objectId}`,
      transitionId: transition.id,
      tick: transition.toTick,
      objectId,
      title,
      description,
      differenceIndexes: Object.freeze(differenceIndexes),
      causeSubjectIds: Object.freeze(causeSubjectIds),
    });
  });
}
