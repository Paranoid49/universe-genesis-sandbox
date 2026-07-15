import { useEffect, useRef, useState } from "preact/hooks";
import {
  createResearchArchive,
  createResearchNotebook,
  buildKnowledgeQuestions,
  type ObservationAccess,
  type ObservationRequest,
  type ObservableSignal,
  type ObservationMethodId,
  type ResearchNotebook,
  type ResearchStorageAdapter,
} from "../sim/current";
import { browserResearchStorage } from "./researchStorage";
import { loadResearchNotebook } from "./researchNotebookLoader";

export function useObservationWorkbench({ access, active, storage = browserResearchStorage, allowLegacyRootMigration = false }: { access: ObservationAccess; active: boolean; storage?: ResearchStorageAdapter; allowLegacyRootMigration?: boolean }) {
  const [selectedMethodId, setMethodId] = useState<ObservationMethodId>(access.methods[0]?.id ?? "");
  const [signal, setSignal] = useState<ObservableSignal>();
  const [notebook, setNotebook] = useState(() => createResearchNotebook(access.universeDefinitionId, access.runtimeHistoryId));
  const [busy, setBusy] = useState(false);
  const [loadedHistoryId, setLoadedHistoryId] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const accessRef = useRef(access);
  const loading = loadedHistoryId !== access.runtimeHistoryId;
  const methodId = access.methods.some((entry) => entry.id === selectedMethodId) ? selectedMethodId : access.methods[0]?.id ?? "";

  useEffect(() => {
    accessRef.current = access;
  }, [access]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const currentAccess = accessRef.current;
    loadResearchNotebook(currentAccess, storage, allowLegacyRootMigration).then((loaded) => {
      if (!cancelled) {
        setNotebook(loaded);
        setSignal(loaded.signals.at(-1));
        setStatus(undefined);
        setError(undefined);
      }
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "研究记录读取失败。");
    }).finally(() => { if (!cancelled) setLoadedHistoryId(currentAccess.runtimeHistoryId); });
    return () => { cancelled = true; };
  }, [access.runtimeHistoryId, access.universeDefinitionId, active, allowLegacyRootMigration, storage]);

  async function observe(request: ObservationRequest): Promise<boolean> {
    if (loading) { setError("研究记录仍在加载，请稍后再试。"); return false; }
    if (!access.objects.some((entry) => entry.id === request.objectId)) { setError("当前观察范围没有可用对象。"); return false; }
    const nextSignal = access.observe(request);
    const order = nextOrder(notebook);
    const next = freezeNotebook({
      ...notebook,
      revision: notebook.revision + 1,
      signals: notebook.signals.some((entry) => entry.id === nextSignal.id) ? notebook.signals : [...notebook.signals, nextSignal],
      questions: buildKnowledgeQuestions(notebook.signals.some((entry) => entry.id === nextSignal.id) ? notebook.signals : [...notebook.signals, nextSignal]),
      observationHistory: [...notebook.observationHistory, Object.freeze({
        id: `research-history:${nextSignal.id}:${order}`,
        order,
        signalId: nextSignal.id,
        methodId: request.methodId,
        objectId: request.objectId,
        tick: request.tick,
      })],
    });
    const saved = await persist(next, "观察记录已保存。");
    if (saved) setSignal(nextSignal);
    return saved;
  }

  async function addFocus(label: string, tags: readonly string[]): Promise<boolean> {
    if (!signal) { setError("请先完成一次观察。"); return false; }
    if (notebook.focuses.some((entry) => entry.subjectId === signal.id)) {
      setStatus("该观察已经在关注列表中。");
      return true;
    }
    const order = nextOrder(notebook);
    return persist(freezeNotebook({
      ...notebook,
      revision: notebook.revision + 1,
      focuses: [...notebook.focuses, Object.freeze({ id: `focus:${signal.id}`, subjectId: signal.id, label, tags: Object.freeze([...tags]), createdOrder: order })],
    }), "已加入关注。" );
  }

  async function addNote(text: string): Promise<boolean> {
    const normalized = text.trim();
    if (!normalized) { setStatus(undefined); setError("笔记内容不能为空。"); return false; }
    const order = nextOrder(notebook);
    return persist(freezeNotebook({
      ...notebook,
      revision: notebook.revision + 1,
      notes: [...notebook.notes, Object.freeze({
        id: `note:${notebook.universeDefinitionId}:${order}`,
        text: normalized,
        evidenceIds: Object.freeze(signal?.evidence.map((entry) => entry.id) ?? []),
        createdOrder: order,
        updatedOrder: order,
      })],
    }), "笔记已保存。" );
  }

  async function addHypothesis(statement: string): Promise<boolean> {
    const normalized = statement.trim();
    if (!normalized) { setStatus(undefined); setError("推测内容不能为空。"); return false; }
    const order = nextOrder(notebook);
    return persist(freezeNotebook({
      ...notebook,
      revision: notebook.revision + 1,
      hypotheses: [...notebook.hypotheses, Object.freeze({
        id: `hypothesis:${notebook.universeDefinitionId}:${order}`,
        statement: normalized,
        status: "open",
        supportingEvidenceIds: Object.freeze(signal?.evidence.map((entry) => entry.id) ?? []),
        opposingEvidenceIds: Object.freeze([]),
        createdOrder: order,
      })],
    }), "推测已保存，并保持为玩家观点。" );
  }

  async function persist(next: ResearchNotebook, message: string): Promise<boolean> {
    if (busy || loading) return false;
    if (next.runtimeHistoryId !== access.runtimeHistoryId) { setError("研究记录不属于当前活动分支。" ); return false; }
    setBusy(true);
    setStatus(undefined);
    try {
      await storage.put(createResearchArchive(next, access.validateSignal), access.validateSignal);
      setNotebook(next);
      setStatus(message);
      setError(undefined);
      return true;
    } catch (cause) {
      setStatus(undefined);
      setError(cause instanceof Error ? cause.message : "研究记录保存失败。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function selectSignal(signalId: string): void {
    setSignal(notebook.signals.find((entry) => entry.id === signalId));
  }

  const visibleNotebook = notebook.runtimeHistoryId === access.runtimeHistoryId ? notebook : createResearchNotebook(access.universeDefinitionId, access.runtimeHistoryId);
  return { access, methodId, setMethodId, signal: visibleNotebook === notebook ? signal : undefined, notebook: visibleNotebook, busy, loading, status, error, observe, selectSignal, addFocus, addNote, addHypothesis };
}

function nextOrder(notebook: ResearchNotebook): number {
  return Math.max(0, ...notebook.focuses.map((entry) => entry.createdOrder), ...notebook.notes.map((entry) => entry.updatedOrder), ...notebook.hypotheses.map((entry) => entry.createdOrder), ...notebook.observationHistory.map((entry) => entry.order)) + 1;
}

function freezeNotebook(notebook: ResearchNotebook): ResearchNotebook {
  return Object.freeze({
    ...notebook,
    signals: Object.freeze([...notebook.signals]),
    questions: Object.freeze([...notebook.questions]),
    focuses: Object.freeze([...notebook.focuses]),
    notes: Object.freeze([...notebook.notes]),
    hypotheses: Object.freeze([...notebook.hypotheses]),
    observationHistory: Object.freeze([...notebook.observationHistory]),
  });
}

export type ObservationWorkbenchController = ReturnType<typeof useObservationWorkbench>;
