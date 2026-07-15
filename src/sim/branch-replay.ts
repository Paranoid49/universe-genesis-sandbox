import type { UniverseState } from "./contracts/runtime";
import { advanceUniverseState, configureUniverseClock, createInitialUniverseState, runtimeStateFingerprint } from "./runtime-state";

export function replayUniverseToTick(source: UniverseState, targetTick: number): UniverseState {
  if (!Number.isSafeInteger(targetTick) || targetTick < 0 || targetTick > source.clock.tick) throw new Error("分支逻辑时刻无效。");
  let replayed = createInitialUniverseState({ seed: source.identity.seed, constitution: source.identity.constitution });
  const inputs = new Map(source.inputLog.map((entry) => [entry.id, entry]));
  for (const expected of source.transitions) {
    if (expected.toTick > targetTick) break;
    const transitionInputs = expected.inputIds.map((id) => {
      const input = inputs.get(id);
      if (!input) throw new Error("分支重放缺少转换输入。");
      return input;
    });
    replayed = advanceUniverseState(replayed, transitionInputs);
    const actual = replayed.transitions.at(-1);
    if (!actual || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("分支重放与原历史不一致。");
  }
  const paused = configureUniverseClock(replayed, { status: "paused", speed: source.clock.speed });
  const expectedStateId = targetTick === source.clock.tick
    ? configureUniverseClock(source, { status: "paused" }).id
    : source.transitions.find((entry) => entry.toTick === targetTick)?.afterStateId ?? source.transitions[0]?.beforeStateId;
  if (expectedStateId && paused.id !== expectedStateId) throw new Error("分支重放状态身份不一致。");
  if (runtimeStateFingerprint(paused) !== runtimeStateFingerprint(configureUniverseClock(paused, { status: "paused" }))) throw new Error("分支重放状态不稳定。");
  return paused;
}
