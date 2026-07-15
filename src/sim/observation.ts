import {
  EVIDENCE_PROTOCOL_VERSION,
  OBSERVATION_PROTOCOL_VERSION,
  type EvidenceRecord,
  type EvidenceStrength,
  type ObservableSignal,
  type ObservationMethod,
  type ObservationContext,
  type ObservationRequest,
} from "./contracts/observation";
import type { CognitionModuleSpec, ObservableModuleSpec } from "./contracts/constitution";
import type { StateTransition, UniverseState } from "./contracts/runtime";
import { constitutionModule } from "./constitution-validation";
import { runtimeObjectAtTick } from "./runtime-history";
import { evidenceIdentity, signalIdentity } from "./observation-identity";
import { observedStateId } from "./observation-state";

export function observationMethods(stateOrConstitution: UniverseState | UniverseState["identity"]["constitution"]): readonly ObservationMethod[] {
  const constitution = "identity" in stateOrConstitution ? stateOrConstitution.identity.constitution : stateOrConstitution;
  const definitions = constitutionModule<ObservableModuleSpec>(constitution, "observable").spec.methods;
  return Object.freeze(definitions.map((entry) => Object.freeze({
    id: entry.id,
    version: OBSERVATION_PROTOCOL_VERSION,
    name: entry.name,
    description: entry.description,
    scale: entry.scale,
    phenomenon: entry.name,
    kind: entry.kind,
    ...(entry.field ? { field: entry.field } : {}),
    ...(entry.bands ? { bands: Object.freeze(entry.bands.map((band) => Object.freeze({ ...band }))) } : {}),
  })));
}

export function createObservationContext(state: UniverseState, tick: number, runtimeHistoryId = state.identity.universeDefinitionId): ObservationContext {
  if (!Number.isSafeInteger(tick) || tick < 0 || tick > state.clock.tick) throw new Error("观察上下文的逻辑时刻无效。");
  if (!runtimeHistoryId) throw new Error("观察上下文缺少运行历史身份。");
  return Object.freeze({
    universeDefinitionId: state.identity.universeDefinitionId,
    stateId: state.id,
    runtimeHistoryId,
    tick,
    visibleObjectIds: Object.freeze(Object.keys(state.objects).sort()),
    availableMethodIds: Object.freeze(observationMethods(state).map((entry) => entry.id)),
  });
}

export function knowledgeStatusFromEvidence(evidenceRecords: readonly EvidenceRecord[]): ObservableSignal["knowledgeStatus"] {
  const supports = evidenceRecords.some((entry) => entry.stance === "supports");
  const opposes = evidenceRecords.some((entry) => entry.stance === "opposes");
  if (supports && opposes) return "conflicted";
  if (supports) return "supported";
  if (opposes) return "confirmed-absent";
  return "insufficient";
}

export function observeUniverse(state: UniverseState, request: ObservationRequest, runtimeHistoryId = state.identity.universeDefinitionId): ObservableSignal {
  const context = createObservationContext(state, request.tick, runtimeHistoryId);
  const method = observationMethods(state).find((entry) => entry.id === request.methodId);
  if (!context.visibleObjectIds.includes(request.objectId) || !method) throw new Error("观察请求不在当前可见范围内。");
  const object = runtimeObjectAtTick(state, request.objectId, request.tick);
  const transition = state.transitions.find((entry) => entry.toTick === request.tick);
  if (method.kind === "range") {
    const value = numeric(object.attributes[requiredField(method)], "观察所需的对象数值无效。");
    const visibleValue = method.bands?.find((band) => band.maximum === undefined || value <= band.maximum)?.label ?? "已取得可见信号";
    return signal(state, request, runtimeHistoryId, method.name, visibleValue, "supported", "观测只公开宪法声明的区间，不泄露底层精确值。", [
      evidence(state, request, runtimeHistoryId, method.name + "由当前可见对象状态支持。", transition, "moderate"),
    ]);
  }
  if (method.kind === "trend") {
    if (request.tick === 0) return signal(state, request, runtimeHistoryId, method.name, "证据不足", "insufficient", "至少需要两个逻辑时刻才能判断趋势。", []);
    const field = requiredField(method);
    const previous = runtimeObjectAtTick(state, request.objectId, request.tick - 1);
    const delta = numeric(object.attributes[field], "观察所需的对象数值无效。") - numeric(previous.attributes[field], "观察所需的对象数值无效。");
    const trendSubject = method.name.endsWith("趋势") ? method.name.slice(0, -"趋势".length) : method.name;
    const visibleValue = delta > 0 ? trendSubject + "上升" : delta < 0 ? trendSubject + "下降" : trendSubject + "保持稳定";
    return signal(state, request, runtimeHistoryId, method.name, visibleValue, "supported", "趋势只描述相邻逻辑时刻，不代表长期规律。", [
      evidence(state, request, runtimeHistoryId, "相邻时刻的可见信号支持该趋势。", transition, Math.abs(delta) >= 2 ? "strong" : "moderate"),
    ]);
  }
  if (method.kind === "recent-change") {
    const semanticDifferences = transition?.differences.filter((entry) => !["revision", "updatedAtTick"].includes(entry.field)) ?? [];
    if (!transition) return signal(state, request, runtimeHistoryId, method.name, "观测完成但没有可用结果", "observed-no-result", "当前时刻没有可用于判断变化的已提交转换。", []);
    if (semanticDifferences.length === 0) return signal(state, request, runtimeHistoryId, method.name, "未观测到变化", "confirmed-absent", "当前观察范围内没有已提交的语义变化。", [
      evidence(state, request, runtimeHistoryId, "当前时刻的已提交差异中没有语义字段变化。", transition, "strong", "opposes"),
    ]);
    return signal(state, request, runtimeHistoryId, method.name, "观测到 " + semanticDifferences.length + " 项变化", "confirmed", "数量只覆盖当前对象和逻辑时刻。", [
      evidence(state, request, runtimeHistoryId, semanticDifferences.map((entry) => entry.field).join("、"), transition, "strong"),
    ]);
  }
  const publicAxiomIds = constitutionModule<CognitionModuleSpec>(state.identity.constitution, "cognition").spec.publicAxiomIds;
  const ruleIds = (transition?.ruleIds ?? []).filter((ruleId) => publicAxiomIds.includes(ruleId));
  if (ruleIds.length === 0) return signal(state, request, runtimeHistoryId, method.name, "尚无已应用公开规则证据", "insufficient", "当前时刻没有可公开的已应用规则证据。", []);
  return signal(state, request, runtimeHistoryId, method.name, ruleIds.join("、"), "confirmed", "这里只显示已经参与实际变化的公开规则引用。", [
    evidence(state, request, runtimeHistoryId, "已提交转换直接引用这些规则。", transition, "strong"),
  ]);
}

function signal(state: UniverseState, request: ObservationRequest, runtimeHistoryId: string, title: string, visibleValue: string, knowledgeStatus: ObservableSignal["knowledgeStatus"], uncertainty: string, evidenceRecords: readonly EvidenceRecord[]): ObservableSignal {
  const stateId = observedStateId(state, request.tick);
  const result = { version: OBSERVATION_PROTOCOL_VERSION, id: "", universeDefinitionId: state.identity.universeDefinitionId, runtimeHistoryId, stateId, ...request, title, visibleValue, knowledgeStatus, uncertainty, evidence: Object.freeze([...evidenceRecords]) } satisfies ObservableSignal;
  return Object.freeze({ ...result, id: signalIdentity(result) });
}

function evidence(state: UniverseState, request: ObservationRequest, runtimeHistoryId: string, summary: string, transition: StateTransition | undefined, strength: EvidenceStrength, stance: EvidenceRecord["stance"] = "supports"): EvidenceRecord {
  const stateId = observedStateId(state, request.tick);
  const sourceSubjectIds = transition ? [transition.id, request.objectId] : [stateId, request.objectId];
  const causalNodeIds = transition ? ["runtime-cause:transition:" + transition.id] : ["runtime-cause:state:" + stateId];
  const result = { version: EVIDENCE_PROTOCOL_VERSION, id: "", universeDefinitionId: state.identity.universeDefinitionId, runtimeHistoryId, stateId, methodId: request.methodId, objectId: request.objectId, tick: request.tick, strength, stance, summary, sourceSubjectIds: Object.freeze(sourceSubjectIds), causalNodeIds: Object.freeze(causalNodeIds) } satisfies EvidenceRecord;
  return Object.freeze({ ...result, id: evidenceIdentity(result) });
}

function requiredField(method: ObservationMethod): string {
  if (!method.field) throw new Error("观察方式缺少字段定义。");
  return method.field;
}

function numeric(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(message);
  return value;
}
