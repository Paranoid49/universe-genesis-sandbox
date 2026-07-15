import { describe, expect, it } from "vitest";
import {
  advanceUniverseBranch,
  advanceUniverseState,
  branchStateHash,
  buildKnowledgeQuestions,
  compareUniverseBranches,
  continueHistoryBranchPackage,
  createBranchArchive,
  createCheckpointRootBranch,
  createExperimentInput,
  createGenesisPackage,
  createHistoryBranchPackage,
  createLegacyInitialUniverseState as createInitialUniverseState,
  createInterventionInput,
  createObservationAccess,
  createResearchArchive,
  createResearchNotebook,
  createRootBranch,
  forkUniverseBranch,
  interveneUniverseBranch,
  isUniverseBranchStateContinuation,
  migrateResearchNotebookToHistory,
  parseBranchArchive,
  parseGenesisPackage,
  parseHistoryBranchPackage,
  receiveHistoryBranchPackage,
  receiveSharedUniverseBranch,
  replayUniverseToTick,
  serializeBranchArchive,
  serializeSharePackage,
  updateUniverseBranchState,
  validateBranch,
} from "../src/sim";

describe("步骤 4 分支、实验、比较与分享契约", () => {
  it("从当前状态、检查点和历史时刻创建分支且父分支保持不变", () => {
    let state = createInitialUniverseState({ seed: "BRANCH-FORK-001", templateId: "hard_science" });
    state = advanceUniverseState(advanceUniverseState(state));
    const root = createRootBranch(state);
    const parentSnapshot = structuredClone(root);
    const experiment = createExperimentInput(replayUniverseToTick(state, 1), root.branchId, "cohesion", 7, 1);
    const child = forkUniverseBranch(root, 1, [experiment]);
    const currentChild = forkUniverseBranch(root, state.clock.tick, []);

    expect(root).toEqual(parentSnapshot);
    expect(child.parentBranchId).toBe(root.branchId);
    expect(child.forkTick).toBe(1);
    expect(child.state.clock.tick).toBe(2);
    expect(currentChild.state.id).toBe(root.state.id);
    expect(child.lineage.map((entry) => entry.branchId)).toEqual([root.branchId, child.branchId]);
    expect(validateBranch(child)).toBe(child);
  });

  it("检查点根分支具有独立来源身份且分支状态只能沿合法历史后继更新", () => {
    const initial = createInitialUniverseState({ seed: "BRANCH-CHECKPOINT-ROOT", templateId: "hard_science" });
    const state = advanceUniverseState(initial);
    expect(() => createCheckpointRootBranch(state, "")).toThrow("来源检查点身份");
    const checkpointRoot = createCheckpointRootBranch(state, "runtime-checkpoint:test");
    expect(checkpointRoot.rootCheckpointId).toBe("runtime-checkpoint:test");
    expect(validateBranch(checkpointRoot)).toBe(checkpointRoot);

    const root = createRootBranch(initial);
    expect(isUniverseBranchStateContinuation(root, state)).toBe(true);
    const updated = updateUniverseBranchState(root, state);
    expect(updated.state.id).toBe(state.id);
    expect(isUniverseBranchStateContinuation(updated, initial)).toBe(false);
    expect(() => updateUniverseBranchState(updated, initial)).toThrow("非后继状态");

    const shared = receiveSharedUniverseBranch(updated);
    expect(shared.accessMode).toBe("shared-readonly");
    expect(() => updateUniverseBranchState(shared, advanceUniverseState(shared.state))).toThrow("先创建接收者子分支");
    expect(isUniverseBranchStateContinuation(updated, { ...state, committedTransitionIds: ["forged"] })).toBe(false);
    const input = createExperimentInput(initial, root.branchId, "cohesion", 2, 1);
    const child = forkUniverseBranch(root, 0, [input]);
    const mismatchedInputState = { ...child.state, inputLog: [{ ...child.state.inputLog[0], id: "forged" }] };
    expect(isUniverseBranchStateContinuation(child, mismatchedInputState)).toBe(false);
  });

  it("界外实验与宇宙内干预使用不同权限并进入有序历史", () => {
    const state = createInitialUniverseState({ seed: "BRANCH-INPUT-001", templateId: "high_magic" });
    const root = createRootBranch(state);
    const experiment = createExperimentInput(state, root.branchId, "cohesion", 8, 1);
    const child = forkUniverseBranch(root, 0, [experiment]);
    const intervention = createInterventionInput(child.state, child.branchId, "energy", -6, 2);
    const intervened = interveneUniverseBranch(child, intervention);

    expect(child.state.inputLog.map((entry) => entry.kind)).toEqual(["experiment.adjust-condition@1"]);
    expect(intervened.state.inputLog.map((entry) => entry.kind)).toEqual(["experiment.adjust-condition@1", "intervention.apply-pulse@1"]);
    expect(intervened.state.transitions.at(-1)?.inputIds).toContain(intervention.id);
    expect(() => forkUniverseBranch(root, 0, [intervention as unknown as typeof experiment])).toThrow("权限");
    expect(() => interveneUniverseBranch(child, experiment as unknown as typeof intervention)).toThrow("权限");
  });

  it("完整历史重放与恢复后的下一状态保持确定性", () => {
    let state = createInitialUniverseState({ seed: "BRANCH-REPLAY-001", templateId: "mythic" });
    state = advanceUniverseState(state);
    state = advanceUniverseState(state, [createInterventionInput(state, "branch:standalone", "energy", 3, 1)]);
    const replayed = replayUniverseToTick(state, 2);
    const root = createRootBranch(state);
    const parsed = parseBranchArchive(serializeBranchArchive(createBranchArchive(root)));

    expect(replayed).toEqual(root.state);
    expect(advanceUniverseBranch(parsed.branch)).toEqual(advanceUniverseBranch(root));
  });

  it("共同祖先比较定位首个不同输入、状态和因果差异", () => {
    const state = advanceUniverseState(createInitialUniverseState({ seed: "BRANCH-COMPARE-001", templateId: "hard_science" }));
    const root = createRootBranch(state);
    const left = forkUniverseBranch(root, 1, [createExperimentInput(state, root.branchId, "cohesion", 8, 1)]);
    const right = forkUniverseBranch(root, 1, [createExperimentInput(state, root.branchId, "energy", -8, 1)]);
    const comparison = compareUniverseBranches(left, right);

    expect(comparison.commonAncestorBranchId).toBe(root.branchId);
    expect(comparison.firstDifferentInput?.leftId).toBe(left.branchInputIds[0]);
    expect(comparison.firstDifferentInput?.rightId).toBe(right.branchInputIds[0]);
    expect(comparison.stateDifferences.length).toBeGreaterThan(0);
    expect(comparison.leftOnlyTransitionIds.length).toBeGreaterThan(0);
    expect(comparison.leftOnlyCausalNodeIds.length).toBeGreaterThan(0);
    expect(comparison.leftOnlyCausalPaths.length).toBeGreaterThan(0);
    expect(comparison.commonCausalNodeIds.length).toBeGreaterThan(0);
    expect(comparison.commonStateFieldCount).toBeGreaterThan(0);
    expect(comparison.differenceEvidence.some((entry) => entry.inputIds.length > 0 && entry.ruleIds.length > 0 && entry.causalNodeIds.length > 0)).toBe(true);
    expect(comparison.stateDifferences.some((entry) => entry.ruleId !== "branch.compare@1")).toBe(true);

    const other = createRootBranch(createInitialUniverseState({ seed: "BRANCH-COMPARE-OTHER", templateId: "hard_science" }));
    expect(() => compareUniverseBranches(left, other)).toThrow("没有可验证共同祖先");
    const unrelatedCheckpointRoot = createCheckpointRootBranch(left.state, "runtime-checkpoint:unrelated");
    expect(() => compareUniverseBranches(left, unrelatedCheckpointRoot)).toThrow("没有可验证共同祖先");
    const prefixComparison = compareUniverseBranches(left, root);
    expect(prefixComparison.firstDifferentInput?.leftId).toBe(left.branchInputIds[0]);
    expect(prefixComparison.firstDifferentInput?.rightId).toBeUndefined();
  });

  it("状态收敛不会合并不同分支历史", () => {
    const state = createInitialUniverseState({ seed: "BRANCH-CONVERGE-001", templateId: "low_magic" });
    const root = createRootBranch(state);
    const left = forkUniverseBranch(root, 0, [createExperimentInput(state, root.branchId, "cohesion", 5, 1)]);
    const right = forkUniverseBranch(root, 0, [createExperimentInput(state, root.branchId, "cohesion", 10, 1), createExperimentInput(state, root.branchId, "cohesion", -5, 2)]);
    const comparison = compareUniverseBranches(left, right);

    expect(branchStateHash(left.state)).toBe(branchStateHash(right.state));
    expect(left.branchId).not.toBe(right.branchId);
    expect(left.historyHash).not.toBe(right.historyHash);
    expect(comparison.historiesConvergedToSameState).toBe(true);
  });

  it("创世条件包与历史分支包保持不同身份和继续语义", () => {
    const state = advanceUniverseState(createInitialUniverseState({ seed: "BRANCH-SHARE-001", templateId: "dream_realm" }));
    const root = createRootBranch(state);
    const genesis = parseGenesisPackage(serializeSharePackage(createGenesisPackage(state.identity)));
    const history = parseHistoryBranchPackage(serializeSharePackage(createHistoryBranchPackage(root)));
    const continued = continueHistoryBranchPackage(history);

    expect(genesis.packageType).toBe("genesis");
    expect(history.packageType).toBe("history-branch");
    expect(continued.parentBranchId).toBe(root.branchId);
    expect(continued.branchId).not.toBe(root.branchId);
    expect(continued.state).toEqual(root.state);
    expect(() => parseGenesisPackage(serializeSharePackage(createHistoryBranchPackage(root)))).toThrow("创世条件包");
    const tampered = JSON.parse(serializeSharePackage(createHistoryBranchPackage(root)));
    tampered.branchArchive.historyHash = "forged";
    expect(() => parseHistoryBranchPackage(JSON.stringify(tampered))).toThrow("完整性");
  });

  it("历史包先恢复原分享节点，带输入历史在第一次操作时才创建本地子分支", () => {
    const state = createInitialUniverseState({ seed: "BRANCH-SHARE-DELAYED", templateId: "mythic" });
    const root = createRootBranch(state);
    const source = forkUniverseBranch(root, 0, [createExperimentInput(state, root.branchId, "cohesion", 4, 1)]);
    const received = receiveHistoryBranchPackage(parseHistoryBranchPackage(serializeSharePackage(createHistoryBranchPackage(source))));

    expect(received.branchId).toBe(source.branchId);
    expect(received.historyHash).toBe(source.historyHash);
    expect(received.accessMode).toBe("shared-readonly");
    expect(received.branchInputs).toEqual(source.branchInputs);

    const advanced = advanceUniverseBranch(received);
    expect(advanced.parentBranchId).toBe(received.branchId);
    expect(advanced.branchId).not.toBe(received.branchId);
    expect(advanced.accessMode).toBe("local");
    expect(advanced.branchInputs).toEqual(source.branchInputs);
    expect(advanced.inputOutcomes).toEqual(source.inputOutcomes);
    expect(validateBranch(advanced)).toBe(advanced);

    const intervention = createInterventionInput(received.state, received.branchId, "energy", 2, 2);
    const intervened = interveneUniverseBranch(received, intervention);
    expect(intervened.parentBranchId).toBe(received.branchId);
    expect(intervened.branchInputs.map((entry) => entry.id)).toEqual([...source.branchInputIds, intervention.id]);
    expect(validateBranch(intervened)).toBe(intervened);
  });

  it("步骤 3 根研究记录只迁移到匹配根分支且不会跨分支拼接", () => {
    const state = advanceUniverseState(createInitialUniverseState({ seed: "BRANCH-RESEARCH-001", templateId: "hard_science" }));
    const root = createRootBranch(state);
    const legacyAccess = createObservationAccess(root.state);
    const objectId = legacyAccess.objects[0].id;
    const signal = legacyAccess.observe({ methodId: "structure", objectId, tick: 1 });
    const base = createResearchNotebook(root.universeDefinitionId);
    const legacyNotebook = {
      ...base,
      revision: 1,
      signals: [signal],
      questions: buildKnowledgeQuestions([signal]),
      observationHistory: [{ id: `research-history:${signal.id}:1`, order: 1, signalId: signal.id, methodId: signal.methodId, objectId, tick: 1 }],
    };
    createResearchArchive(legacyNotebook, legacyAccess.validateSignal);

    const rootAccess = createObservationAccess(root.state, root.branchId);
    const migrated = migrateResearchNotebookToHistory(legacyNotebook, rootAccess);
    expect(migrated.runtimeHistoryId).toBe(root.branchId);
    expect(migrated.signals[0].runtimeHistoryId).toBe(root.branchId);
    expect(migrated.signals[0].id).not.toBe(signal.id);
    expect(() => createResearchArchive(migrated, rootAccess.validateSignal)).not.toThrow();

    const child = forkUniverseBranch(root, 1, []);
    const childAccess = createObservationAccess(child.state, child.branchId);
    expect(() => createResearchArchive(migrated, childAccess.validateSignal)).toThrow("运行历史");
  });
});
