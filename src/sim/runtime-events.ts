import type { EventModuleSpec } from "./contracts/constitution";
import type { RuntimeEvent, StateTransition, UniverseState } from "./contracts/runtime";
import { constitutionModule } from "./constitution-validation";
export function projectRuntimeEvents(state: UniverseState): readonly RuntimeEvent[] {
  const classifiers = constitutionModule<EventModuleSpec>(state.identity.constitution, "event").spec.classifiers;
  return Object.freeze(state.transitions.flatMap((transition) => projectTransitionEvents(state, transition, classifiers)));
}
function projectTransitionEvents(state: UniverseState, transition: StateTransition, classifiers: EventModuleSpec["classifiers"]): RuntimeEvent[] {
  const objectIds = [...new Set(transition.differences.map((entry) => entry.objectId))].sort();
  const stateEvents = objectIds.flatMap((objectId) => {
    const differenceIndexes = transition.differences.flatMap((entry, index) => entry.objectId === objectId && entry.field.startsWith("attributes.") ? [index] : []);
    if (differenceIndexes.length === 0) return [];
    const matching = classifiers.filter((classifier) => differenceIndexes.some((index) => transition.differences[index].field === "attributes." + classifier.field));
    const title = matching.map((entry) => entry.name).join("、") || "对象发生宪法定义的变化";
    const description = differenceIndexes.map((index) => {
      const entry = transition.differences[index];
      return entry.field + "：" + String(entry.before) + " → " + String(entry.after);
    }).join("；");
    const causeSubjectIds = [...new Set(differenceIndexes.flatMap((index) => {
      const entry = transition.differences[index];
      return [entry.ruleId, entry.randomDecisionId].filter((value): value is string => Boolean(value));
    }))].sort();
    return [Object.freeze({
      id: "runtime-event:" + transition.id + ":" + objectId,
      transitionId: transition.id,
      tick: transition.toTick,
      objectId,
      title,
      description,
      differenceIndexes: Object.freeze(differenceIndexes),
      causeSubjectIds: Object.freeze(causeSubjectIds),
    })];
  });
  const autonomyEvents: RuntimeEvent[] = [];
  for (const entityId of transition.autonomy.formedEntityIds) autonomyEvents.push(autonomyEvent(state, transition, entityId, "自主主体形成", "对象满足宇宙宪法声明的自主形成条件。", entityId));
  for (const action of transition.autonomy.actions) autonomyEvents.push(autonomyEvent(state, transition, action.entityId, action.status === "applied" ? "自主行动产生后果" : action.status === "rejected" ? "自主行动被拒绝" : "自主主体保持观察", action.reason, action.id, action.differenceIndexes));
  for (const narrativeId of transition.autonomy.narrativeIds) {
    const narrative = state.autonomy.narratives[narrativeId]; if (narrative) autonomyEvents.push(autonomyEvent(state, transition, narrative.entityId, "主体叙述形成", narrative.claim, narrative.id));
  }
  for (const entityId of transition.autonomy.ceasedEntityIds) autonomyEvents.push(autonomyEvent(state, transition, entityId, "自主性终止", "主体不再产生新的感知、意图或行动。", entityId));
  return [...stateEvents, ...autonomyEvents];
}
function autonomyEvent(state: UniverseState, transition: StateTransition, entityId: string, title: string, description: string, causeSubjectId: string, differenceIndexes: readonly number[] = []): RuntimeEvent {
  const entity = state.autonomy.entities[entityId];
  if (!entity) throw new Error("自主事件引用不存在实体。");
  return Object.freeze({
    id: "runtime-event:" + transition.id + ":" + causeSubjectId,
    transitionId: transition.id,
    tick: transition.toTick,
    objectId: entity.objectId,
    title,
    description,
    differenceIndexes: Object.freeze([...differenceIndexes]),
    causeSubjectIds: Object.freeze([causeSubjectId]),
  });
}
