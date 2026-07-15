import type { BranchDifferenceEvidence } from "./contracts/branching";
import type { RuntimeCausalNetwork, RuntimeWorldObject, StateDiffOperation, UniverseState } from "./contracts/runtime";

export function compareBranchObjects(leftState: UniverseState, rightState: UniverseState): StateDiffOperation[] {
  const differences: StateDiffOperation[] = [];
  for (const objectId of [...new Set([...Object.keys(leftState.objects), ...Object.keys(rightState.objects)])].sort()) {
    const leftObject = leftState.objects[objectId];
    const rightObject = rightState.objects[objectId];
    const leftFields = flatten(leftObject);
    const rightFields = flatten(rightObject);
    for (const field of [...new Set([...Object.keys(leftFields), ...Object.keys(rightFields)])].sort()) {
      const before = leftFields[field] ?? null;
      const after = rightFields[field] ?? null;
      if (before === after) continue;
      const transition = [...rightState.transitions, ...leftState.transitions].find((entry) => entry.differences.some((difference) => difference.objectId === objectId && difference.field === field));
      differences.push(Object.freeze({ operation: leftObject && rightObject ? "update" : leftObject ? "delete" : "create", objectId, field, before, after, ruleId: transition?.ruleIds[0] ?? "branch.compare@1" }));
    }
  }
  for (const [kind, left, right] of [["entity", leftState.autonomy.entities, rightState.autonomy.entities], ["relation", leftState.autonomy.relations, rightState.autonomy.relations], ["narrative", leftState.autonomy.narratives, rightState.autonomy.narratives], ["myth", leftState.autonomy.mythArchives, rightState.autonomy.mythArchives]] as const) compareAutonomyCollection(differences, kind, left, right);
  return differences;
}

export function differenceEvidence(difference: StateDiffOperation, left: UniverseState, right: UniverseState): BranchDifferenceEvidence {
  const leftTransitions = matchingTransitions(left, difference);
  const rightTransitions = matchingTransitions(right, difference);
  const transitions = [...leftTransitions, ...rightTransitions];
  return Object.freeze({
    objectId: difference.objectId,
    field: difference.field,
    leftTransitionIds: Object.freeze(leftTransitions.map((entry) => entry.id)),
    rightTransitionIds: Object.freeze(rightTransitions.map((entry) => entry.id)),
    inputIds: Object.freeze([...new Set(transitions.flatMap((entry) => entry.inputIds))]),
    ruleIds: Object.freeze([...new Set(transitions.flatMap((entry) => entry.ruleIds))]),
    causalNodeIds: Object.freeze([...new Set(transitions.flatMap((entry) => [`runtime-cause:transition:${entry.id}`, ...entry.inputIds.map((id) => `runtime-cause:${id}`)]))]),
  });
}

export function commonStateFieldCount(left: Readonly<Record<string, RuntimeWorldObject>>, right: Readonly<Record<string, RuntimeWorldObject>>): number {
  let count = 0;
  for (const objectId of [...new Set([...Object.keys(left), ...Object.keys(right)])]) {
    const leftFields = flatten(left[objectId]);
    const rightFields = flatten(right[objectId]);
    for (const field of new Set([...Object.keys(leftFields), ...Object.keys(rightFields)])) if (leftFields[field] === rightFields[field]) count += 1;
  }
  return count;
}

export function causalPaths(network: RuntimeCausalNetwork, targetIds: readonly string[]): readonly (readonly string[])[] {
  const nodes = new Map(network.nodes.map((entry) => [entry.id, entry]));
  const paths: string[][] = [];
  const visit = (nodeId: string, suffix: readonly string[], seen: ReadonlySet<string>) => {
    if (seen.has(nodeId) || paths.length >= 24) return;
    const node = nodes.get(nodeId);
    if (!node) return;
    const path = [nodeId, ...suffix];
    if (node.root || node.directCauseIds.length === 0) { paths.push(path); return; }
    const nextSeen = new Set(seen).add(nodeId);
    node.directCauseIds.forEach((causeId) => visit(causeId, path, nextSeen));
  };
  targetIds.slice(0, 24).forEach((id) => visit(id, [], new Set()));
  return Object.freeze(paths.map((path) => Object.freeze(path)));
}

function matchingTransitions(state: UniverseState, difference: StateDiffOperation) {
  return state.transitions.filter((entry) => entry.differences.some((candidate) => candidate.objectId === difference.objectId && candidate.field === difference.field) || JSON.stringify(entry.autonomy).includes(difference.objectId));
}

function compareAutonomyCollection(
  differences: StateDiffOperation[],
  kind: string,
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): void {
  for (const objectId of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    const leftValue = left[objectId];
    const rightValue = right[objectId];
    if (!leftValue || !rightValue) {
      if (leftValue !== rightValue) differences.push(autonomyDifference(objectId, `autonomy.${kind}.state`, leftValue, rightValue));
      continue;
    }
    if (kind !== "entity") {
      if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) differences.push(autonomyDifference(objectId, `autonomy.${kind}.state`, leftValue, rightValue));
      continue;
    }
    const leftRecord = leftValue as Record<string, unknown>;
    const rightRecord = rightValue as Record<string, unknown>;
    for (const field of new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]))
      if (JSON.stringify(leftRecord[field]) !== JSON.stringify(rightRecord[field])) differences.push(autonomyDifference(objectId, `autonomy.entity.${field}`, leftValue, rightValue));
  }
}

function autonomyDifference(objectId: string, field: string, left: unknown, right: unknown): StateDiffOperation {
  return Object.freeze({ operation: left && right ? "update" : left ? "delete" : "create", objectId, field, before: left ? "左分支记录" : null, after: right ? "右分支记录" : null, ruleId: "autonomy.compare@1" });
}

function flatten(object: RuntimeWorldObject | undefined): Record<string, string | number | boolean | null> {
  if (!object) return {};
  return { status: object.status, revision: object.revision, createdAtTick: object.createdAtTick, updatedAtTick: object.updatedAtTick, ...Object.fromEntries(Object.entries(object.attributes).map(([key, value]) => [`attributes.${key}`, value])) };
}
