import { describe, expect, it } from "vitest";
import {
  advanceUniverseState,
  buildKnowledgeQuestions,
  createLegacyInitialUniverseState as createInitialUniverseState,
  createObservationAccess,
  createResearchArchive,
  createResearchNotebook,
  knowledgeStatusFromEvidence,
  observeUniverse,
  parseResearchArchive,
  runtimeStateFingerprint,
  serializeResearchArchive,
  validateObservableSignal,
  EVIDENCE_PROTOCOL_VERSION,
  type EvidenceRecord,
  type ResearchNotebook,
  type UniverseState,
} from "../src/sim";
import { runtimeFingerprint } from "../src/sim/runtime-integrity";
import { evidenceIdentity, signalIdentity } from "../src/sim/observation-identity";

describe("步骤 3 观察与研究契约", () => {
  it("多种观察方式只产生有限且确定的可见信号", () => {
    let state = createInitialUniverseState({ seed: "OBSERVATION-001", templateId: "high_magic" });
    state = advanceUniverseState(state);
    const objectId = Object.keys(state.objects)[0];
    const before = runtimeStateFingerprint(state);
    const methods = ["structure", "energy-trend", "recent-change", "rule-trace"] as const;
    const first = methods.map((methodId) => observeUniverse(state, { methodId, objectId, tick: 1 }));
    const second = methods.map((methodId) => observeUniverse(state, { methodId, objectId, tick: 1 }));

    expect(second).toEqual(first);
    expect(new Set(first.map((entry) => entry.id)).size).toBe(methods.length);
    expect(first.every((entry) => entry.universeDefinitionId === state.identity.universeDefinitionId)).toBe(true);
    expect(first.every((entry) => !entry.visibleValue.includes(String(state.objects[objectId].attributes.cohesion)))).toBe(true);
    expect(runtimeStateFingerprint(state)).toBe(before);
  });

  it("观察访问端口只暴露可见引用、公开公理和受控观察能力", () => {
    const state = createInitialUniverseState({ seed: "OBSERVATION-ACCESS-001", templateId: "hard_science" });
    const access = createObservationAccess(state);
    const objectId = access.objects[0].id;
    expect(access).toMatchObject({ universeDefinitionId: state.identity.universeDefinitionId, currentTick: 0 });
    expect(access.objects[0]).not.toHaveProperty("attributes");
    expect(access.publicAxioms.length).toBeGreaterThan(0);
    expect(access.observe({ methodId: "structure", objectId, tick: 0 })).toEqual(observeUniverse(state, { methodId: "structure", objectId, tick: 0 }));
  });

  it("未获得相邻时刻证据时保持证据不足而不是补造答案", () => {
    const state = createInitialUniverseState({ seed: "OBSERVATION-UNKNOWN-001", templateId: "hard_science" });
    const objectId = Object.keys(state.objects)[0];
    const result = observeUniverse(state, { methodId: "energy-trend", objectId, tick: 0 });

    expect(result.knowledgeStatus).toBe("insufficient");
    expect(result.visibleValue).toBe("证据不足");
    expect(result.evidence).toEqual([]);
  });

  it("支持与反对证据同时存在时保留解释冲突", () => {
    const base: Omit<EvidenceRecord, "stance"> = { version: EVIDENCE_PROTOCOL_VERSION, id: "evidence-1", universeDefinitionId: "universe", runtimeHistoryId: "universe", stateId: "state", methodId: "structure", objectId: "object", tick: 0, strength: "moderate", summary: "测试证据", sourceSubjectIds: ["source"], causalNodeIds: ["node"] };
    expect(knowledgeStatusFromEvidence([{ ...base, stance: "supports" }, { ...base, id: "evidence-2", stance: "opposes" }])).toBe("conflicted");
    expect(knowledgeStatusFromEvidence([{ ...base, stance: "supports" }])).toBe("supported");
    expect(knowledgeStatusFromEvidence([{ ...base, stance: "opposes" }])).toBe("confirmed-absent");
    expect(knowledgeStatusFromEvidence([])).toBe("insufficient");
  });

  it("结构、能量、变化与规律观测覆盖全部合法结果区间", () => {
    const initial = createInitialUniverseState({ seed: "OBSERVATION-BRANCHES-001", templateId: "hard_science" });
    const objectId = Object.keys(initial.objects)[0];
    expect(observeUniverse(withAttribute(initial, objectId, "cohesion", 20), { methodId: "structure", objectId, tick: 0 }).visibleValue).toBe("结构松散");
    expect(observeUniverse(withAttribute(initial, objectId, "cohesion", 55), { methodId: "structure", objectId, tick: 0 }).visibleValue).toBe("结构正在凝聚");
    expect(observeUniverse(withAttribute(initial, objectId, "cohesion", 80), { methodId: "structure", objectId, tick: 0 }).visibleValue).toBe("结构高度凝聚");

    const advanced = advanceUniverseState(initial);
    expect(observeUniverse(withEnergyDelta(advanced, objectId, 3), { methodId: "energy-trend", objectId, tick: 1 })).toMatchObject({ visibleValue: "能量上升", evidence: [{ strength: "strong" }] });
    expect(observeUniverse(withEnergyDelta(advanced, objectId, -1), { methodId: "energy-trend", objectId, tick: 1 })).toMatchObject({ visibleValue: "能量下降", evidence: [{ strength: "moderate" }] });
    expect(observeUniverse(withEnergyDelta(advanced, objectId, 0), { methodId: "energy-trend", objectId, tick: 1 })).toMatchObject({ visibleValue: "能量保持稳定", evidence: [{ strength: "moderate" }] });

    const noSemanticChange = withDifferences(advanced, advanced.transitions[0].differences.filter((entry) => ["revision", "updatedAtTick"].includes(entry.field)));
    expect(observeUniverse(noSemanticChange, { methodId: "recent-change", objectId, tick: 1 }).knowledgeStatus).toBe("confirmed-absent");
    expect(observeUniverse(initial, { methodId: "recent-change", objectId, tick: 0 })).toMatchObject({ visibleValue: "观测完成但没有可用结果", knowledgeStatus: "observed-no-result", evidence: [] });
    expect(observeUniverse(initial, { methodId: "rule-trace", objectId, tick: 0 })).toMatchObject({ visibleValue: "尚无已应用公开规则证据", evidence: [] });
  });

  it("观察上下文拒绝越界、不可见对象、未知方式和无效数值", () => {
    const state = createInitialUniverseState({ seed: "OBSERVATION-INVALID-001", templateId: "hard_science" });
    const objectId = Object.keys(state.objects)[0];
    expect(() => observeUniverse(state, { methodId: "structure", objectId, tick: -1 })).toThrow("逻辑时刻无效");
    expect(() => observeUniverse(state, { methodId: "structure", objectId: "missing", tick: 0 })).toThrow("可见范围");
    expect(() => observeUniverse(state, { methodId: "unknown" as "structure", objectId, tick: 0 })).toThrow("可见范围");
    expect(() => observeUniverse(withAttribute(state, objectId, "cohesion", "invalid"), { methodId: "structure", objectId, tick: 0 })).toThrow("对象数值无效");
  });

  it("研究存档稳定往返并拒绝损坏、未知版本和跨宇宙身份", () => {
    const notebook = createResearchNotebook("runtime-definition:test-observation");
    const serialized = serializeResearchArchive(createResearchArchive(notebook));
    expect(serializeResearchArchive(parseResearchArchive(serialized))).toBe(serialized);

    const valid = JSON.parse(serialized) as Record<string, unknown>;
    expect(() => parseResearchArchive("{")).toThrow("JSON");
    expect(() => parseResearchArchive(JSON.stringify({ ...valid, version: "unknown" }))).toThrow("结构或版本");
    expect(() => parseResearchArchive(JSON.stringify({ ...valid, checksum: "00000000" }))).toThrow("完整性");

    const mismatched = structuredClone(notebook);
    (mismatched as { runtimeHistoryId: string }).runtimeHistoryId = "other-history";
    expect(() => createResearchArchive(mismatched)).toThrow("身份");

    const state = createInitialUniverseState({ seed: "RESEARCH-REFERENCE-001", templateId: "mythic" });
    const signal = observeUniverse(state, { methodId: "structure", objectId: Object.keys(state.objects)[0], tick: 0 });
    const crossUniverse = { ...notebook, signals: [{ ...signal, universeDefinitionId: "other-universe" }] };
    expect(() => createResearchArchive(crossUniverse)).toThrow("其他宇宙");
    const missingSignal = { ...notebook, observationHistory: [{ id: "history-1", order: 1, signalId: "missing", methodId: "structure" as const, objectId: "object", tick: 0 }] };
    expect(() => createResearchArchive(missingSignal)).toThrow("不存在的观察信号");
  });

  it("完整研究记录可以冻结往返并保持全部嵌套数据", () => {
    const state = createInitialUniverseState({ seed: "RESEARCH-COMPLETE-001", templateId: "mythic" });
    const objectId = Object.keys(state.objects)[0];
    const signal = observeUniverse(state, { methodId: "structure", objectId, tick: 0 });
    const evidenceId = signal.evidence[0].id;
    const base = createResearchNotebook(state.identity.universeDefinitionId);
    const notebook: ResearchNotebook = {
      ...base,
      revision: 5,
      signals: [signal],
      questions: buildKnowledgeQuestions([signal]),
      focuses: [{ id: "focus-1", subjectId: signal.id, label: "结构问题", tags: ["结构", "长期"], createdOrder: 1 }],
      notes: [{ id: "note-1", text: "记录结构信号", evidenceIds: [evidenceId], createdOrder: 2, updatedOrder: 2 }],
      hypotheses: [{ id: "hypothesis-1", statement: "结构可能继续凝聚", status: "open", supportingEvidenceIds: [evidenceId], opposingEvidenceIds: [], createdOrder: 3 }],
      observationHistory: [{ id: "history-1", order: 4, signalId: signal.id, methodId: signal.methodId, objectId, tick: 0 }],
    };
    const validateSignal = createObservationAccess(state).validateSignal;
    const restored = parseResearchArchive(serializeResearchArchive(createResearchArchive(notebook, validateSignal)), validateSignal);

    expect(restored.notebook).toEqual(notebook);
    expect(Object.isFrozen(restored.notebook.signals[0].evidence[0].sourceSubjectIds)).toBe(true);
    expect(Object.isFrozen(restored.notebook.focuses[0].tags)).toBe(true);
    expect(Object.isFrozen(restored.notebook.notes[0].evidenceIds)).toBe(true);
    expect(Object.isFrozen(restored.notebook.hypotheses[0].supportingEvidenceIds)).toBe(true);
    expect(Object.isFrozen(restored.notebook.observationHistory[0])).toBe(true);
  });

  it("研究存档逐项拒绝身份、顺序和引用损坏", () => {
    const state = createInitialUniverseState({ seed: "RESEARCH-INVALID-001", templateId: "mythic" });
    const objectId = Object.keys(state.objects)[0];
    const signal = observeUniverse(state, { methodId: "structure", objectId, tick: 0 });
    const evidenceId = signal.evidence[0].id;
    const base = createResearchNotebook(state.identity.universeDefinitionId);
    const valid: ResearchNotebook = {
      ...base,
      revision: 4,
      signals: [signal],
      questions: buildKnowledgeQuestions([signal]),
      focuses: [{ id: "focus-1", subjectId: signal.id, label: "结构", tags: [], createdOrder: 1 }],
      notes: [{ id: "note-1", text: "笔记", evidenceIds: [evidenceId], createdOrder: 2, updatedOrder: 2 }],
      hypotheses: [{ id: "hypothesis-1", statement: "推测", status: "open", supportingEvidenceIds: [evidenceId], opposingEvidenceIds: [], createdOrder: 3 }],
      observationHistory: [{ id: "history-1", order: 4, signalId: signal.id, methodId: signal.methodId, objectId, tick: 0 }],
    };
    const validateSignal = createObservationAccess(state).validateSignal;

    expect(() => createResearchNotebook("")).toThrow("宇宙定义身份");
    expect(() => createResearchArchive({ ...valid, version: "unknown" as ResearchNotebook["version"] }, validateSignal)).toThrow("版本不受支持");
    expect(() => createResearchArchive({ ...valid, revision: -1 }, validateSignal)).toThrow("版本号无效");
    expect(() => createResearchArchive({ ...valid, notes: [{ ...valid.notes[0], id: valid.focuses[0].id }] }, validateSignal)).toThrow("身份重复");
    expect(() => createResearchArchive({ ...valid, focuses: [{ ...valid.focuses[0], createdOrder: 0 }] }, validateSignal)).toThrow("顺序无效");
    expect(() => createResearchArchive({ ...valid, notes: [{ ...valid.notes[0], updatedOrder: 1 }] }, validateSignal)).toThrow("更新时间顺序无效");
    expect(() => createResearchArchive({ ...valid, focuses: [{ ...valid.focuses[0], subjectId: "missing" }] }, validateSignal)).toThrow("研究关注引用");
    expect(() => createResearchArchive({ ...valid, notes: [{ ...valid.notes[0], evidenceIds: ["missing"] }] }, validateSignal)).toThrow("玩家笔记引用");
    expect(() => createResearchArchive({ ...valid, hypotheses: [{ ...valid.hypotheses[0], opposingEvidenceIds: ["missing"] }] }, validateSignal)).toThrow("玩家推测引用");

    const archive = JSON.parse(serializeResearchArchive(createResearchArchive(valid, validateSignal))) as Record<string, unknown>;
    const payload = {
      version: archive.version,
      notebookId: "research-notebook:other",
      universeDefinitionId: archive.universeDefinitionId,
      notebook: archive.notebook,
    };
    expect(() => parseResearchArchive(JSON.stringify({ ...payload, checksum: runtimeFingerprint(payload) }), validateSignal)).toThrow("身份不匹配");
  });

  it("已观察无结果、确认不存在与冲突解释可以聚合并保存恢复", () => {
    let state = createInitialUniverseState({ seed: "OBSERVATION-CONFLICT-001", templateId: "hard_science" });
    state = advanceUniverseState(state);
    state = advanceUniverseState(state);
    const objectId = Object.keys(state.objects)[0];
    const firstTransition = state.transitions[0];
    const withoutSemanticChange = {
      ...state,
      transitions: [
        { ...firstTransition, differences: firstTransition.differences.filter((entry) => ["revision", "updatedAtTick"].includes(entry.field)) },
        state.transitions[1],
      ],
    };
    const absent = observeUniverse(withoutSemanticChange, { methodId: "recent-change", objectId, tick: 1 });
    const changed = observeUniverse(withoutSemanticChange, { methodId: "recent-change", objectId, tick: 2 });
    const noResult = observeUniverse(createInitialUniverseState({ seed: "OBSERVATION-NO-RESULT-001", templateId: "hard_science" }), { methodId: "recent-change", objectId, tick: 0 });
    const questions = buildKnowledgeQuestions([absent, changed]);

    expect(noResult.knowledgeStatus).toBe("observed-no-result");
    expect(buildKnowledgeQuestions([noResult])[0].status).toBe("observed-no-result");
    expect(absent.knowledgeStatus).toBe("confirmed-absent");
    expect(questions).toMatchObject([{ status: "conflicted", supportingEvidenceIds: [changed.evidence[0].id], opposingEvidenceIds: [absent.evidence[0].id] }]);

    const base = createResearchNotebook(state.identity.universeDefinitionId);
    const notebook: ResearchNotebook = {
      ...base,
      revision: 2,
      signals: [absent, changed],
      questions,
      observationHistory: [
        { id: "history-conflict-1", order: 1, signalId: absent.id, methodId: absent.methodId, objectId, tick: 1 },
        { id: "history-conflict-2", order: 2, signalId: changed.id, methodId: changed.methodId, objectId, tick: 2 },
      ],
    };
    const validateSignal = createObservationAccess(withoutSemanticChange).validateSignal;
    expect(parseResearchArchive(serializeResearchArchive(createResearchArchive(notebook, validateSignal)), validateSignal).notebook.questions[0].status).toBe("conflicted");
  });

  it("研究存档拒绝重新封装的观察协议、历史身份和来源篡改", () => {
    const state = createInitialUniverseState({ seed: "RESEARCH-SEMANTIC-001", templateId: "hard_science" });
    const objectId = Object.keys(state.objects)[0];
    const signal = observeUniverse(state, { methodId: "structure", objectId, tick: 0 });
    const base = createResearchNotebook(state.identity.universeDefinitionId);
    const validateSignal = createObservationAccess(state).validateSignal;
    const archive = (candidate: typeof signal) => createResearchArchive({ ...base, revision: 1, signals: [candidate], questions: buildKnowledgeQuestions([candidate]) }, validateSignal);

    expect(() => archive({ ...signal, version: "unknown" as typeof signal.version })).toThrow("信号版本");
    expect(() => validateObservableSignal({ ...signal, universeDefinitionId: "" })).toThrow("宇宙");
    expect(() => archive({ ...signal, runtimeHistoryId: "other-history" })).toThrow("历史");
    expect(() => archive({ ...signal, stateId: "other-state" })).toThrow("状态身份");
    expect(() => archive({ ...signal, methodId: "rule-trace" })).toThrow("参数");
    expect(() => validateObservableSignal({ ...signal, methodId: "" })).toThrow("方式无效");
    const dynamicEvidenceBase = { ...signal.evidence[0], methodId: "dynamic-observation" };
    const dynamicEvidence = { ...dynamicEvidenceBase, id: evidenceIdentity(dynamicEvidenceBase) };
    const dynamicSignalBase = { ...signal, methodId: "dynamic-observation", evidence: [dynamicEvidence] };
    const dynamicSignal = { ...dynamicSignalBase, id: signalIdentity(dynamicSignalBase) };
    expect(validateObservableSignal(dynamicSignal)).toEqual(dynamicSignal);
    expect(() => validateSignal(dynamicSignal)).toThrow("观察请求不在当前可见范围内");
    expect(() => validateObservableSignal({ ...signal, objectId: "" })).toThrow("对象或逻辑时刻");
    expect(() => archive({ ...signal, visibleValue: "伪造结果" })).toThrow("信号身份");
    expect(() => archive({ ...signal, evidence: [{ ...signal.evidence[0], version: "unknown" as typeof signal.evidence[0]["version"] }] })).toThrow("证据版本");
    expect(() => archive({ ...signal, evidence: [{ ...signal.evidence[0], sourceSubjectIds: ["forged", objectId] }] })).toThrow("证据身份");
    expect(() => archive({ ...signal, evidence: [{ ...signal.evidence[0], sourceSubjectIds: ["forged"] }] })).toThrow("来源引用无效");

    const forgedEvidenceBase = { ...signal.evidence[0], summary: "伪造证据", sourceSubjectIds: ["forged-subject", objectId], causalNodeIds: ["runtime-cause:transition:forged"] };
    const forgedEvidence = { ...forgedEvidenceBase, id: evidenceIdentity(forgedEvidenceBase) };
    const forgedSignalBase = { ...signal, visibleValue: "伪造的观察结论", evidence: [forgedEvidence] };
    const forgedSignal = { ...forgedSignalBase, id: signalIdentity(forgedSignalBase) };
    expect(() => archive(forgedSignal)).toThrow("结论或证据来源");
    expect(() => createResearchArchive({ ...base, revision: 1, signals: [signal], questions: buildKnowledgeQuestions([signal]) })).toThrow("缺少可信观察来源校验器");
  });

  it("可信观察校验精确绑定观察时刻状态并允许历史继续推进后恢复", () => {
    const initial = createInitialUniverseState({ seed: "RESEARCH-STATE-BINDING-001", templateId: "hard_science" });
    const objectId = Object.keys(initial.objects)[0];
    const signal = observeUniverse(initial, { methodId: "structure", objectId, tick: 0 });
    const advanced = advanceUniverseState(advanceUniverseState(initial));
    const validateSignal = createObservationAccess(advanced).validateSignal;
    const base = createResearchNotebook(initial.identity.universeDefinitionId);
    const notebook = { ...base, revision: 1, signals: [signal], questions: buildKnowledgeQuestions([signal]) };

    expect(() => createResearchArchive(notebook, validateSignal)).not.toThrow();
    for (const replacementStateId of [advanced.transitions[0].afterStateId, advanced.id]) {
      const evidenceBase = { ...signal.evidence[0], stateId: replacementStateId };
      const evidence = { ...evidenceBase, id: evidenceIdentity(evidenceBase) };
      const signalBase = { ...signal, stateId: replacementStateId, evidence: [evidence] };
      const replaced = { ...signalBase, id: signalIdentity(signalBase) };
      expect(() => createResearchArchive({ ...base, revision: 1, signals: [replaced], questions: buildKnowledgeQuestions([replaced]) }, validateSignal)).toThrow("结论或证据来源");
    }
  });
});

function withAttribute(state: UniverseState, objectId: string, field: string, value: unknown): UniverseState {
  const object = state.objects[objectId];
  return {
    ...state,
    objects: {
      ...state.objects,
      [objectId]: { ...object, attributes: { ...object.attributes, [field]: value } as UniverseState["objects"][string]["attributes"] },
    },
  };
}

function withEnergyDelta(state: UniverseState, objectId: string, delta: number): UniverseState {
  const currentEnergy = state.objects[objectId].attributes.energy as number;
  const existing = state.transitions[0].differences.some((entry) => entry.field === "attributes.energy");
  const differences = state.transitions[0].differences.map((entry) => entry.field === "attributes.energy"
    ? { ...entry, before: currentEnergy - delta, after: currentEnergy }
    : entry);
  return withDifferences(state, existing ? differences : [...differences, { operation: "update", objectId, field: "attributes.energy", before: currentEnergy - delta, after: currentEnergy, ruleId: state.rules[0].id }]);
}

function withDifferences(state: UniverseState, differences: UniverseState["transitions"][number]["differences"]): UniverseState {
  return { ...state, transitions: [{ ...state.transitions[0], differences }] };
}
