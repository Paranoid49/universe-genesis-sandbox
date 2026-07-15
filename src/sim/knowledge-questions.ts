import type { ObservableSignal } from "./contracts/observation";
import type { KnowledgeQuestion } from "./contracts/research";
import { knowledgeStatusFromEvidence } from "./observation";
import { runtimeFingerprint } from "./runtime-integrity";

export function buildKnowledgeQuestions(signals: readonly ObservableSignal[]): readonly KnowledgeQuestion[] {
  const groups = new Map<string, ObservableSignal[]>();
  for (const entry of signals) {
    const key = `${entry.objectId}:${entry.methodId}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return Object.freeze([...groups.entries()].map(([key, entries]) => {
    const evidence = entries.flatMap((entry) => entry.evidence);
    return Object.freeze({
      id: `knowledge-question:${runtimeFingerprint({ key })}`,
      objectId: entries[0].objectId,
      methodId: entries[0].methodId,
      title: entries[0].title,
      status: evidence.length === 0 ? entries.at(-1)!.knowledgeStatus : knowledgeStatusFromEvidence(evidence),
      signalIds: Object.freeze(entries.map((entry) => entry.id)),
      supportingEvidenceIds: Object.freeze(evidence.filter((entry) => entry.stance === "supports").map((entry) => entry.id)),
      opposingEvidenceIds: Object.freeze(evidence.filter((entry) => entry.stance === "opposes").map((entry) => entry.id)),
      neutralEvidenceIds: Object.freeze(evidence.filter((entry) => entry.stance === "neutral").map((entry) => entry.id)),
    });
  }));
}
