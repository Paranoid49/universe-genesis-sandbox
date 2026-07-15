import { RESEARCH_NOTEBOOK_VERSION, type ResearchArchiveEnvelope, type ResearchNotebook, type ObservableSignalValidator } from "./contracts/research";
import { runtimeFingerprint } from "./runtime-integrity";
import { buildKnowledgeQuestions } from "./knowledge-questions";
import { validateObservableSignal } from "./observation-identity";

export function researchNotebookId(universeDefinitionId: string, runtimeHistoryId = universeDefinitionId): string {
  return runtimeHistoryId === universeDefinitionId ? `research-notebook:${universeDefinitionId}` : `research-notebook:${universeDefinitionId}:${runtimeHistoryId}`;
}

export function createResearchNotebook(universeDefinitionId: string, runtimeHistoryId = universeDefinitionId): ResearchNotebook {
  if (!universeDefinitionId) throw new Error("研究记录缺少宇宙定义身份。");
  if (!runtimeHistoryId) throw new Error("研究记录缺少运行历史身份。");
  return freezeResearchNotebook({
    version: RESEARCH_NOTEBOOK_VERSION,
    id: researchNotebookId(universeDefinitionId, runtimeHistoryId),
    universeDefinitionId,
    runtimeHistoryId,
    revision: 0,
    signals: [],
    questions: [],
    focuses: [],
    notes: [],
    hypotheses: [],
    observationHistory: [],
  });
}

export function createResearchArchive(notebook: ResearchNotebook, validateSignal?: ObservableSignalValidator): ResearchArchiveEnvelope {
  const verified = validateNotebook(notebook, validateSignal);
  const payload = {
    version: "ugs-research-archive@3" as const,
    notebookId: verified.id,
    universeDefinitionId: verified.universeDefinitionId,
    notebook: verified,
  };
  return Object.freeze({ ...payload, checksum: runtimeFingerprint(payload) });
}

export function parseResearchArchive(raw: string, validateSignal?: ObservableSignalValidator): ResearchArchiveEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("研究记录不是有效 JSON。");
  }
  if (!record(parsed) || parsed.version !== "ugs-research-archive@3" || typeof parsed.checksum !== "string" || !record(parsed.notebook)) {
    throw new Error("研究记录结构或版本无效。");
  }
  const { checksum, ...payload } = parsed;
  if (runtimeFingerprint(payload) !== checksum) throw new Error("研究记录完整性校验失败。");
  const notebook = validateNotebook(parsed.notebook as ResearchNotebook, validateSignal);
  if (parsed.notebookId !== notebook.id || parsed.universeDefinitionId !== notebook.universeDefinitionId) throw new Error("研究记录身份不匹配。");
  return createResearchArchive(notebook, validateSignal);
}

export function serializeResearchArchive(archive: ResearchArchiveEnvelope): string {
  return JSON.stringify(archive);
}

function validateNotebook(notebook: ResearchNotebook, validateSignal?: ObservableSignalValidator): ResearchNotebook {
  if (notebook.version !== RESEARCH_NOTEBOOK_VERSION) throw new Error("研究记录版本不受支持。");
  if (!notebook.universeDefinitionId || !notebook.runtimeHistoryId || notebook.id !== researchNotebookId(notebook.universeDefinitionId, notebook.runtimeHistoryId)) {
    throw new Error("研究记录宇宙或历史身份无效。");
  }
  if (!Number.isSafeInteger(notebook.revision) || notebook.revision < 0) throw new Error("研究记录版本号无效。");
  const allIds = [...notebook.signals, ...notebook.focuses, ...notebook.notes, ...notebook.hypotheses, ...notebook.observationHistory].map((entry) => entry.id);
  if (new Set(allIds).size !== allIds.length) throw new Error("研究记录条目身份重复。");
  const orders = [...notebook.focuses.map((entry) => entry.createdOrder), ...notebook.notes.map((entry) => entry.createdOrder), ...notebook.hypotheses.map((entry) => entry.createdOrder), ...notebook.observationHistory.map((entry) => entry.order)];
  if (orders.some((order) => !Number.isSafeInteger(order) || order <= 0) || new Set(orders).size !== orders.length) throw new Error("研究记录条目顺序无效。");
  if (notebook.notes.some((entry) => !Number.isSafeInteger(entry.updatedOrder) || entry.updatedOrder < entry.createdOrder)) throw new Error("玩家笔记更新时间顺序无效。");
  if (notebook.signals.some((entry) => entry.universeDefinitionId !== notebook.universeDefinitionId)) throw new Error("研究记录包含其他宇宙的观察信号。");
  notebook.signals.forEach((entry) => validateObservableSignal(entry));
  if (notebook.signals.length > 0 && !validateSignal) throw new Error("研究记录缺少可信观察来源校验器。");
  notebook.signals.forEach((entry) => validateSignal?.(entry));
  if (notebook.signals.some((entry) => entry.runtimeHistoryId !== notebook.runtimeHistoryId)) throw new Error("研究记录包含其他运行历史的观察信号。");
  if (JSON.stringify(notebook.questions) !== JSON.stringify(buildKnowledgeQuestions(notebook.signals))) throw new Error("研究记录的认知问题聚合无效。");
  const signalIds = new Set(notebook.signals.map((entry) => entry.id));
  const evidenceIds = new Set(notebook.signals.flatMap((entry) => entry.evidence.map((evidence) => evidence.id)));
  if (notebook.focuses.some((entry) => !signalIds.has(entry.subjectId))) throw new Error("研究关注引用了不存在的观察信号。");
  if (notebook.observationHistory.some((entry) => !signalIds.has(entry.signalId))) throw new Error("观察历史引用了不存在的观察信号。");
  if (notebook.notes.some((entry) => entry.evidenceIds.some((id) => !evidenceIds.has(id)))) throw new Error("玩家笔记引用了不存在的证据。");
  if (notebook.hypotheses.some((entry) => [...entry.supportingEvidenceIds, ...entry.opposingEvidenceIds].some((id) => !evidenceIds.has(id)))) throw new Error("玩家推测引用了不存在的证据。");
  return freezeResearchNotebook(structuredClone(notebook));
}

export function freezeResearchNotebook(notebook: ResearchNotebook): ResearchNotebook {
  return Object.freeze({
    ...notebook,
    signals: Object.freeze(notebook.signals.map((entry) => Object.freeze({
      ...entry,
      evidence: Object.freeze(entry.evidence.map((evidence) => Object.freeze({
        ...evidence,
        sourceSubjectIds: Object.freeze([...evidence.sourceSubjectIds]),
        causalNodeIds: Object.freeze([...evidence.causalNodeIds]),
      }))),
    }))),
    questions: Object.freeze(notebook.questions.map((entry) => Object.freeze({
      ...entry,
      signalIds: Object.freeze([...entry.signalIds]),
      supportingEvidenceIds: Object.freeze([...entry.supportingEvidenceIds]),
      opposingEvidenceIds: Object.freeze([...entry.opposingEvidenceIds]),
      neutralEvidenceIds: Object.freeze([...entry.neutralEvidenceIds]),
    }))),
    focuses: Object.freeze(notebook.focuses.map((entry) => Object.freeze({ ...entry, tags: Object.freeze([...entry.tags]) }))),
    notes: Object.freeze(notebook.notes.map((entry) => Object.freeze({ ...entry, evidenceIds: Object.freeze([...entry.evidenceIds]) }))),
    hypotheses: Object.freeze(notebook.hypotheses.map((entry) => Object.freeze({
      ...entry,
      supportingEvidenceIds: Object.freeze([...entry.supportingEvidenceIds]),
      opposingEvidenceIds: Object.freeze([...entry.opposingEvidenceIds]),
    }))),
    observationHistory: Object.freeze(notebook.observationHistory.map((entry) => Object.freeze({ ...entry }))),
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
