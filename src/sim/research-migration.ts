import type { ObservationAccess, ObservableSignal } from "./contracts/observation";
import type { ResearchNotebook } from "./contracts/research";
import { buildKnowledgeQuestions } from "./knowledge-questions";
import { freezeResearchNotebook, researchNotebookId } from "./research-archive";

export function migrateResearchNotebookToHistory(notebook: ResearchNotebook, access: ObservationAccess): ResearchNotebook {
  if (notebook.universeDefinitionId !== access.universeDefinitionId) throw new Error("旧研究记录不属于当前宇宙。" );
  if (notebook.runtimeHistoryId !== notebook.universeDefinitionId) throw new Error("只有步骤 3 根研究记录可以迁移。" );
  const signalMap = new Map<string, ObservableSignal>();
  const evidenceMap = new Map<string, string>();
  for (const oldSignal of notebook.signals) {
    access.validateLegacySignal(oldSignal);
    const migrated = access.observe({ methodId: oldSignal.methodId, objectId: oldSignal.objectId, tick: oldSignal.tick });
    if (JSON.stringify(observationMeaning(oldSignal)) !== JSON.stringify(observationMeaning(migrated))) throw new Error("旧研究记录与当前根分支历史不完全匹配。" );
    signalMap.set(oldSignal.id, migrated);
    oldSignal.evidence.forEach((entry, index) => {
      const next = migrated.evidence[index];
      if (!next) throw new Error("旧研究记录证据无法迁移。" );
      evidenceMap.set(entry.id, next.id);
    });
  }
  const signals = notebook.signals.map((entry) => signalMap.get(entry.id)!);
  return freezeResearchNotebook({
    ...notebook,
    id: researchNotebookId(access.universeDefinitionId, access.runtimeHistoryId),
    runtimeHistoryId: access.runtimeHistoryId,
    revision: notebook.revision + 1,
    signals,
    questions: buildKnowledgeQuestions(signals),
    focuses: notebook.focuses.map((entry) => {
      const subjectId = signalMap.get(entry.subjectId)?.id;
      if (!subjectId) throw new Error("旧研究关注无法迁移。" );
      return { ...entry, id: `focus:${subjectId}`, subjectId };
    }),
    notes: notebook.notes.map((entry) => ({ ...entry, evidenceIds: entry.evidenceIds.map((id) => requiredMapping(evidenceMap, id, "旧玩家笔记证据无法迁移。")) })),
    hypotheses: notebook.hypotheses.map((entry) => ({
      ...entry,
      supportingEvidenceIds: entry.supportingEvidenceIds.map((id) => requiredMapping(evidenceMap, id, "旧玩家推测证据无法迁移。")),
      opposingEvidenceIds: entry.opposingEvidenceIds.map((id) => requiredMapping(evidenceMap, id, "旧玩家推测证据无法迁移。")),
    })),
    observationHistory: notebook.observationHistory.map((entry) => {
      const signalId = signalMap.get(entry.signalId)?.id;
      if (!signalId) throw new Error("旧观察历史无法迁移。" );
      return { ...entry, id: `research-history:${signalId}:${entry.order}`, signalId };
    }),
  });
}

function observationMeaning(signal: ObservableSignal): unknown {
  return {
    stateId: signal.stateId,
    methodId: signal.methodId,
    objectId: signal.objectId,
    tick: signal.tick,
    title: signal.title,
    visibleValue: signal.visibleValue,
    knowledgeStatus: signal.knowledgeStatus,
    uncertainty: signal.uncertainty,
    evidence: signal.evidence.map((entry) => ({
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

function requiredMapping(mapping: ReadonlyMap<string, string>, id: string, error: string): string {
  const result = mapping.get(id);
  if (!result) throw new Error(error);
  return result;
}
