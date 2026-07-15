import { EVIDENCE_PROTOCOL_VERSION, OBSERVATION_PROTOCOL_VERSION, type EvidenceRecord, type ObservableSignal } from "./contracts/observation";
import { runtimeFingerprint } from "./runtime-integrity";

export function validateObservableSignal(signal: ObservableSignal): ObservableSignal {
  if (signal.version !== OBSERVATION_PROTOCOL_VERSION) throw new Error("观察信号版本不受支持。");
  if (!signal.universeDefinitionId || !signal.runtimeHistoryId || !signal.stateId) throw new Error("观察信号宇宙、历史或状态身份无效。");
  if (!signal.methodId) throw new Error("观察信号方式无效。");
  if (!signal.objectId || !Number.isSafeInteger(signal.tick) || signal.tick < 0) throw new Error("观察信号对象或逻辑时刻无效。");
  signal.evidence.forEach((entry) => validateEvidence(entry, signal));
  if (signal.id !== signalIdentity(signal)) throw new Error("观察信号身份校验失败。");
  return signal;
}

export function evidenceIdentity(entry: Omit<EvidenceRecord, "id"> | EvidenceRecord): string {
  const { id: _id, ...identity } = entry as EvidenceRecord;
  return `evidence:${runtimeFingerprint(identity)}`;
}

export function signalIdentity(entry: Omit<ObservableSignal, "id"> | ObservableSignal): string {
  const { id: _id, evidence: _evidence, ...identity } = entry as ObservableSignal;
  return `observation:${runtimeFingerprint({ ...identity, evidenceIds: entry.evidence.map((item) => item.id) })}`;
}

function validateEvidence(entry: EvidenceRecord, parent: ObservableSignal): void {
  if (entry.version !== EVIDENCE_PROTOCOL_VERSION) throw new Error("观察证据版本不受支持。");
  if (entry.universeDefinitionId !== parent.universeDefinitionId || entry.runtimeHistoryId !== parent.runtimeHistoryId || entry.stateId !== parent.stateId) throw new Error("观察证据宇宙、历史或状态身份不匹配。");
  if (entry.methodId !== parent.methodId || entry.objectId !== parent.objectId || entry.tick !== parent.tick) throw new Error("观察证据参数与信号不匹配。");
  if (!entry.sourceSubjectIds.includes(parent.objectId) || entry.causalNodeIds.length === 0) throw new Error("观察证据来源引用无效。");
  if (entry.id !== evidenceIdentity(entry)) throw new Error("观察证据身份校验失败。");
}
