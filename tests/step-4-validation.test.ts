import { describe, expect, it } from "vitest";
import {
  advanceUniverseState,
  branchHistoryHash,
  branchStateHash,
  BranchPackageError,
  compareUniverseBranches,
  createBranchArchive,
  createExperimentInput,
  createGenesisPackage,
  createHistoryBranchPackage,
  createLegacyInitialUniverseState as createInitialUniverseState,
  createObservationAccess,
  createRootBranch,
  forkUniverseBranch,
  createInterventionInput,
  interveneUniverseBranch,
  parseBranchArchive,
  parseGenesisPackage,
  parseHistoryBranchPackage,
  replayUniverseToTick,
  serializeSharePackage,
  updateUniverseBranchState,
  validateBranch,
  type BranchArchiveEnvelope,
  type TransitionInput,
  type UniverseBranch,
  type UniverseState,
} from "../src/sim";
import { runtimeFingerprint } from "../src/sim/runtime-integrity";
import { inputAdjustments } from "../src/sim/branch-inputs";

describe("步骤 4 损坏、错配与拒绝路径", () => {
  it("分支身份、状态、历史、检查点和谱系篡改都会拒绝", () => {
    const root = createRootBranch(createInitialUniverseState({ seed: "BRANCH-INVALID-001", templateId: "hard_science" }));
    expect(() => validateBranch({ ...root, version: "bad" } as unknown as UniverseBranch)).toThrow("版本");
    expect(() => validateBranch({ ...root, universeDefinitionId: "other" })).toThrow("宇宙定义身份");
    expect(() => validateBranch({ ...root, stateHash: "bad" })).toThrow("状态哈希");
    expect(() => validateBranch({ ...root, historyHash: "bad" })).toThrow("历史哈希");
    expect(() => validateBranch({ ...root, checkpointId: "bad" })).toThrow("检查点身份");
    expect(() => validateBranch({ ...root, lineage: [] })).toThrow("历史哈希");

    const other = createInitialUniverseState({ seed: "BRANCH-INVALID-OTHER", templateId: "hard_science" });
    expect(() => updateUniverseBranchState(root, other)).toThrow("其他宇宙");
  });

  it("重新计算哈希和检查点后仍拒绝伪造谱系、输入索引与共同历史范围", () => {
    let state = createInitialUniverseState({ seed: "BRANCH-LINEAGE-FORGED", templateId: "hard_science" });
    state = advanceUniverseState(advanceUniverseState(state));
    const root = createRootBranch(state);
    const forkState = replayUniverseToTick(state, 1);
    const child = forkUniverseBranch(root, 1, [createExperimentInput(forkState, root.branchId, "cohesion", 3, 2)]);
    const forgedParent = resignBranch({ ...child, lineage: child.lineage.map((entry, index) => index === 1 ? { ...entry, parentBranchId: "branch:forged" } : entry) });
    expect(() => validateBranch(forgedParent)).toThrow("父子关系");
    const forgedInputs = resignBranch({ ...child, branchInputIds: ["branch-input:forged"] });
    expect(() => validateBranch(forgedInputs)).toThrow("输入索引");
    const forgedRange = resignBranch({ ...child, commonTransitionCount: 999 });
    expect(() => validateBranch(forgedRange)).toThrow("共同历史范围");
    const forgedPlausibleRange = resignBranch({ ...child, commonTransitionCount: 0 });
    expect(() => validateBranch(forgedPlausibleRange)).toThrow("共同历史范围");
  });

  it("被规则拒绝的正式输入保留稳定结果但不伪造状态转换", () => {
    const state = createInitialUniverseState({ seed: "BRANCH-INPUT-OUTCOME", templateId: "mythic" });
    const root = createRootBranch(state);
    const input = createInterventionInput(state, root.branchId, "energy", 0, 1);
    const rejected = interveneUniverseBranch(root, input);

    expect(rejected.state.id).toBe(root.state.id);
    expect(rejected.state.transitions).toEqual(root.state.transitions);
    expect(rejected.state.inputLog).toEqual(root.state.inputLog);
    expect(rejected.branchInputIds).toEqual([input.id]);
    expect(rejected.inputOutcomes).toHaveLength(1);
    expect(rejected.inputOutcomes[0]).toMatchObject({ status: "rejected", code: "BI_DELTA_INVALID", fieldPath: "payload.delta" });
    expect(rejected.inputOutcomes[0].transitionId).toBeUndefined();
    expect(rejected.inputOutcomes[0].causalNodeIds).toEqual([]);
    expect(validateBranch(rejected)).toBe(rejected);
  });

  it("分支输入拒绝无对象、错误目标、字段和值并忽略普通运行输入", () => {
    const state = createInitialUniverseState({ seed: "BRANCH-INPUT-INVALID", templateId: "mythic" });
    const objectId = Object.keys(state.objects)[0];
    const input = (payload: Record<string, unknown>): TransitionInput => ({ id: `input:${runtimeFingerprint(payload)}`, kind: "experiment.adjust-condition@1", order: 1, payload } as unknown as TransitionInput);
    expect(inputAdjustments(state, [{ id: "advance", kind: "advance-time", order: 1, payload: { ticks: 1 } }])).toEqual({});
    expect(() => inputAdjustments(state, [input({ objectId: "missing", field: "energy", delta: 1 })])).toThrow("不存在");
    expect(() => inputAdjustments(state, [input({ objectId, field: "unknown", delta: 1 })])).toThrow("字段");
    expect(() => inputAdjustments(state, [input({ objectId, field: "energy", delta: 0 })])).toThrow("非零有限数值");
    expect(inputAdjustments(state, [input({ objectId, field: "energy", delta: 1.5 })])).toEqual({ [objectId]: { energy: 1.5 } });
    expect(() => inputAdjustments(state, [input({ objectId, field: "energy", delta: Number.POSITIVE_INFINITY })])).toThrow("非零有限数值");
    expect(() => inputAdjustments(state, [input({ objectId: 1, field: "energy", delta: 1 })])).toThrow("目标不存在");
    expect(() => inputAdjustments(state, [input({ objectId, field: "energy", delta: "1" })])).toThrow("非零有限数值");
    const empty = { ...state, objects: {} } as UniverseState;
    expect(() => createExperimentInput(empty, "branch:test", "energy", 1, 1)).toThrow("没有可实验对象");
  });

  it("重放拒绝无效时刻、缺失输入、历史错配和状态身份错配", () => {
    let state = createInitialUniverseState({ seed: "BRANCH-REPLAY-INVALID", templateId: "low_magic" });
    state = advanceUniverseState(state);
    const experiment = createExperimentInput(state, "branch:test", "energy", 2, 1);
    state = advanceUniverseState(state, [experiment]);
    expect(() => replayUniverseToTick(state, -1)).toThrow("逻辑时刻");
    expect(() => replayUniverseToTick(state, state.clock.tick + 1)).toThrow("逻辑时刻");
    expect(() => replayUniverseToTick({ ...state, inputLog: [] }, 2)).toThrow("缺少转换输入");
    const mismatched = structuredClone(state);
    (mismatched.transitions[0] as unknown as { ruleIds: string[] }).ruleIds = ["forged"];
    expect(() => replayUniverseToTick(mismatched, 1)).toThrow("原历史不一致");
    expect(() => replayUniverseToTick({ ...state, id: "forged-state" }, 2)).toThrow("状态身份校验失败");
  });

  it("分支存档拒绝无效 JSON、版本、校验和、身份与运行检查点错配", () => {
    const first = createRootBranch(createInitialUniverseState({ seed: "BRANCH-ARCHIVE-001", templateId: "hard_science" }));
    const second = createRootBranch(createInitialUniverseState({ seed: "BRANCH-ARCHIVE-002", templateId: "hard_science" }));
    const archive = createBranchArchive(first);
    expect(() => parseBranchArchive("{" )).toThrow("有效 JSON");
    expect(() => parseBranchArchive("{}" )).toThrow("结构或版本");
    expect(() => parseBranchArchive(JSON.stringify({ ...archive, checksum: "bad" }))).toThrow("完整性");

    const identityMismatch = resign({ ...archive, branchId: "other" });
    expect(() => parseBranchArchive(JSON.stringify(identityMismatch))).toThrow("身份或哈希");
    const checkpointMismatch = resign({ ...archive, runtimeArchive: createBranchArchive(second).runtimeArchive });
    expect(() => parseBranchArchive(JSON.stringify(checkpointMismatch))).toThrow("运行检查点");
  });

  it("两类分享包拒绝无效 JSON、错误类型和篡改校验和", () => {
    const root = createRootBranch(createInitialUniverseState({ seed: "BRANCH-PACKAGE-INVALID", templateId: "dream_realm" }));
    const genesis = createGenesisPackage(root.state.identity);
    const history = createHistoryBranchPackage(root);
    expect(() => parseGenesisPackage("{" )).toThrow("有效 JSON");
    expect(() => parseHistoryBranchPackage("{" )).toThrow("有效 JSON");
    expect(() => parseGenesisPackage(serializeSharePackage(history))).toThrow("结构或版本");
    expect(() => parseHistoryBranchPackage(serializeSharePackage(genesis))).toThrow("结构或版本");
    expect(() => parseGenesisPackage(JSON.stringify({ ...genesis, checksum: "bad" }))).toThrow("完整性");
    expect(() => parseHistoryBranchPackage(JSON.stringify({ ...history, checksum: "bad" }))).toThrow("完整性");
  });

  it("创世身份错配和历史存档损坏返回稳定错误码与字段路径", () => {
    const root = createRootBranch(createInitialUniverseState({ seed: "BRANCH-PACKAGE-CODE", templateId: "dream_realm" }));
    const genesis = createGenesisPackage(root.state.identity);
    const forgedDefinition = { ...genesis.universeDefinition, universeDefinitionId: "universe:forged" };
    const forgedGenesisPayload = { ...genesis, universeDefinition: forgedDefinition };
    const forgedGenesis = resignPackage(forgedGenesisPayload);
    expectPackageError(() => parseGenesisPackage(JSON.stringify(forgedGenesis)), "BPKG_GENESIS_IDENTITY", "universeDefinition");

    const history = createHistoryBranchPackage(root);
    const forgedArchive = resign({ ...history.branchArchive, historyHash: "forged" });
    const forgedHistory = resignPackage({ ...history, branchArchive: forgedArchive });
    expectPackageError(() => parseHistoryBranchPackage(JSON.stringify(forgedHistory)), "BPKG_HISTORY_ARCHIVE", "branchArchive");
  });

  it("相同分支没有输入、状态或因果差异", () => {
    const root = createRootBranch(createInitialUniverseState({ seed: "BRANCH-COMPARE-EDGE", templateId: "mechanical_divinity" }));
    const same = compareUniverseBranches(root, root);
    expect(same.firstDifferentInput).toBeUndefined();
    expect(same.stateDifferences).toEqual([]);
    expect(same.commonStateFieldCount).toBeGreaterThan(0);
    expect(same.commonCausalNodeIds.length).toBeGreaterThan(0);
  });

  it("观察访问拒绝空的正式历史身份", () => {
    const state = createInitialUniverseState({ seed: "BRANCH-OBS-INVALID", templateId: "hard_science" });
    expect(() => createObservationAccess(state, "")).toThrow("历史身份");
  });
});

function resign(archive: BranchArchiveEnvelope): BranchArchiveEnvelope {
  const { checksum: _checksum, ...payload } = archive;
  return { ...payload, checksum: runtimeFingerprint(payload) };
}

function resignBranch(branch: UniverseBranch): UniverseBranch {
  const stateHash = branchStateHash(branch.state);
  const withoutDerived = { ...branch, stateHash, historyHash: "", checkpointId: "" };
  const historyHash = branchHistoryHash(withoutDerived);
  const checkpointId = `branch-checkpoint:${runtimeFingerprint({ branchId: branch.branchId, stateId: branch.state.id, historyHash })}`;
  return { ...withoutDerived, historyHash, checkpointId };
}

function resignPackage<T extends { checksum: string }>(pack: T): T {
  const { checksum: _checksum, ...payload } = pack;
  return { ...payload, checksum: runtimeFingerprint(payload) } as T;
}

function expectPackageError(action: () => unknown, code: string, fieldPath: string): void {
  try { action(); }
  catch (cause) {
    expect(cause).toBeInstanceOf(BranchPackageError);
    expect(cause).toMatchObject({ code, fieldPath });
    return;
  }
  throw new Error("预期分享包解析被拒绝。");
}
