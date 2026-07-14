import type { UniverseState } from "./contracts/runtime";
import { runtimeStableSerialize } from "./runtime-integrity";
import { advanceUniverseState, createInitialUniverseState } from "./runtime-state";

export function assertUniverseStateSemantics(state: UniverseState): void {
  let replayed = createInitialUniverseState({
    seed: state.identity.seed,
    rulesetVersion: state.identity.rulesetVersion,
    templateId: state.identity.templateId,
  });
  if (runtimeStableSerialize(replayed.identity) !== runtimeStableSerialize(state.identity)) {
    throw new Error("宇宙运行状态的创世定义与初始状态不一致。");
  }
  const inputsById = new Map(state.inputLog.map((input) => [input.id, input]));
  const consumedInputIds = new Set<string>();
  for (const [index, recorded] of state.transitions.entries()) {
    const inputs = recorded.inputIds.map((inputId) => {
      const input = inputsById.get(inputId);
      if (!input || consumedInputIds.has(inputId)) throw new Error("宇宙运行状态的转换输入引用无效。");
      consumedInputIds.add(inputId);
      return input;
    });
    replayed = advanceUniverseState(replayed, inputs);
    if (runtimeStableSerialize(replayed.transitions[index]) !== runtimeStableSerialize(recorded)) {
      throw new Error(`宇宙运行状态第 ${index + 1} 个转换的语义校验失败。`);
    }
  }
  if (consumedInputIds.size !== state.inputLog.length) throw new Error("宇宙运行状态存在未提交的输入记录。");
  if (runtimeStableSerialize(replayableStateFacts(replayed)) !== runtimeStableSerialize(replayableStateFacts(state))) {
    throw new Error("宇宙运行状态的最终对象、随机流或历史与转换重放结果不一致。");
  }
}

function replayableStateFacts(state: UniverseState) {
  return {
    version: state.version,
    id: state.id,
    identity: state.identity,
    clock: { version: state.clock.version, tick: state.clock.tick, step: state.clock.step },
    rules: state.rules,
    objects: state.objects,
    randomStreams: state.randomStreams,
    inputLog: state.inputLog,
    transitions: state.transitions,
    committedTransitionIds: state.committedTransitionIds,
  };
}
