import type { ObservableSignal } from "./contracts/observation";
import type { UniverseState } from "./contracts/runtime";
import { observeUniverse } from "./observation";
import { validateObservableSignal } from "./observation-identity";

export function validateObservableSignalAgainstState(state: UniverseState, candidate: ObservableSignal, runtimeHistoryId = state.identity.universeDefinitionId): ObservableSignal {
  validateObservableSignal(candidate);
  if (candidate.universeDefinitionId !== state.identity.universeDefinitionId || candidate.runtimeHistoryId !== runtimeHistoryId) {
    throw new Error("观察信号不属于当前宇宙或运行历史。");
  }
  const knownStateIds = new Set([state.id, ...state.transitions.flatMap((entry) => [entry.beforeStateId, entry.afterStateId])]);
  if (!knownStateIds.has(candidate.stateId)) throw new Error("观察信号状态身份不属于当前运行历史。");
  const expected = observeUniverse(state, { methodId: candidate.methodId, objectId: candidate.objectId, tick: candidate.tick }, runtimeHistoryId);
  if (JSON.stringify(signalSemantics(candidate)) !== JSON.stringify(signalSemantics(expected))) {
    throw new Error("观察信号结论或证据来源与当前运行历史不匹配。");
  }
  return candidate;
}

function signalSemantics(signal: ObservableSignal): unknown {
  return {
    version: signal.version,
    universeDefinitionId: signal.universeDefinitionId,
    runtimeHistoryId: signal.runtimeHistoryId,
    stateId: signal.stateId,
    methodId: signal.methodId,
    objectId: signal.objectId,
    tick: signal.tick,
    title: signal.title,
    visibleValue: signal.visibleValue,
    knowledgeStatus: signal.knowledgeStatus,
    uncertainty: signal.uncertainty,
    evidence: signal.evidence.map((entry) => ({
      version: entry.version,
      universeDefinitionId: entry.universeDefinitionId,
      runtimeHistoryId: entry.runtimeHistoryId,
      stateId: entry.stateId,
      methodId: entry.methodId,
      objectId: entry.objectId,
      tick: entry.tick,
      strength: entry.strength,
      stance: entry.stance,
      summary: entry.summary,
      sourceSubjectIds: [...entry.sourceSubjectIds],
      causalNodeIds: [...entry.causalNodeIds],
    })),
  };
}
