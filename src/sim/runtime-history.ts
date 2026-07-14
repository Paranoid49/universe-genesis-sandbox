import type { RuntimeWorldObject, UniverseState } from "./contracts/runtime";

export function runtimeObjectAtTick(state: UniverseState, objectId: string, tick: number): RuntimeWorldObject {
  if (!Number.isSafeInteger(tick) || tick < 0 || tick > state.clock.tick) throw new Error("历史浏览位置无效。");
  const current = state.objects[objectId];
  if (!current) throw new Error("历史浏览对象不存在。");
  const attributes = { ...current.attributes };
  let status = current.status;
  let revision = current.revision;
  let updatedAtTick = current.updatedAtTick;
  for (const transition of [...state.transitions].reverse()) {
    if (transition.toTick <= tick) continue;
    for (const difference of [...transition.differences].reverse()) {
      if (difference.objectId !== objectId) continue;
      if (difference.field === "status") status = difference.before as RuntimeWorldObject["status"];
      if (difference.field === "revision") revision = difference.before as number;
      if (difference.field === "updatedAtTick") updatedAtTick = difference.before as number;
      if (difference.field.startsWith("attributes.")) attributes[difference.field.slice("attributes.".length)] = difference.before;
    }
  }
  return Object.freeze({
    ...current,
    status,
    revision,
    updatedAtTick,
    attributes: Object.freeze(attributes),
  });
}
