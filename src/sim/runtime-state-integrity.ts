import { UNIVERSE_DEFINITION_VERSION, UNIVERSE_STATE_VERSION, type UniverseState } from "./contracts/runtime";
import { assertAutonomyStateIntegrity } from "./autonomy-validation";
import { assertUniverseConstitution } from "./constitution-validation";
import { runtimeFingerprint } from "./runtime-integrity";

export function assertRuntimeStateIntegrity(state: UniverseState): void {
  if (state.version !== UNIVERSE_STATE_VERSION) throw new Error("宇宙运行状态版本不受支持。");
  if (state.identity.version !== UNIVERSE_DEFINITION_VERSION) throw new Error("宇宙定义版本不受支持。");
  assertUniverseConstitution(state.identity.constitution);
  if (state.identity.constitutionId !== state.identity.constitution.constitutionId) throw new Error("宇宙宪法身份不匹配。");
  const objectIds = new Set(Object.keys(state.objects));
  if (Object.values(state.topology.relations).some((relation) => !objectIds.has(relation.sourceObjectId) || !objectIds.has(relation.targetObjectId))) throw new Error("宇宙拓扑引用不存在的对象。");
  assertAutonomyStateIntegrity(state);
  if (state.id !== runtimeStateId(state)) throw new Error("宇宙运行状态身份校验失败。");
  if (state.transitions.length !== state.committedTransitionIds.length) throw new Error("宇宙运行状态转换历史不完整。");
}

export function runtimeStateId(state: Omit<UniverseState, "id"> | UniverseState): string {
  return "runtime-state:" + runtimeFingerprint({
    identity: state.identity,
    clock: runtimeLogicalClockIdentity(state.clock),
    rules: state.rules,
    objects: state.objects,
    topology: state.topology,
    autonomy: state.autonomy,
    randomStreams: state.randomStreams,
    inputLog: state.inputLog,
    committedTransitionIds: state.committedTransitionIds,
  });
}

export function runtimeLogicalClockIdentity(clock: UniverseState["clock"]): Pick<UniverseState["clock"], "version" | "tick" | "step"> {
  return { version: clock.version, tick: clock.tick, step: clock.step };
}
