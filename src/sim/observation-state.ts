import type { UniverseState } from "./contracts/runtime";

export function observedStateId(state: UniverseState, tick: number): string {
  if (tick === state.clock.tick) return state.id;
  const completed = state.transitions.find((entry) => entry.toTick === tick);
  if (completed) return completed.afterStateId;
  const following = state.transitions.find((entry) => entry.fromTick === tick);
  if (following) return following.beforeStateId;
  throw new Error("观察时刻没有对应的可信状态身份。");
}
