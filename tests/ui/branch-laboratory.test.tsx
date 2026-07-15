import { act, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { createBranchArchive, createExperimentInput, createGenesisPackage, createHistoryBranchPackage, createLegacyInitialUniverseState as createInitialUniverseState, createRootBranch, forkUniverseBranch, serializeSharePackage } from "../../src/sim";
import { BranchesPage } from "../../src/components/pages/BranchesPage";
import { ExperimentPage } from "../../src/components/pages/ExperimentPage";
import { createMemoryBranchStorage, type BranchStorageAdapter } from "../../src/ui/branchStorage";
import { activateRuntimeBranch } from "../../src/ui/branchActivation";
import { createMemoryRuntimeStorage, type RuntimeStorageAdapter } from "../../src/ui/runtimeStorage";
import { useBranchLaboratory } from "../../src/ui/useBranchLaboratory";
import type { BranchLaboratoryController } from "../../src/ui/useBranchLaboratory";
import { useLegacyRuntimeUniverseModel as useRuntimeUniverseModel } from "../../src/ui/useLegacyRuntimeUniverseModel";

function BranchLaboratoryApp({ storage }: { storage: BranchStorageAdapter }) {
  const runtime = useRuntimeUniverseModel({ seed: "BRANCH-UI-001", templateId: "hard_science" });
  const laboratory = useBranchLaboratory({ runtime, active: true, storage });
  return <><ExperimentPage laboratory={laboratory} /><BranchesPage laboratory={laboratory} /></>;
}

function BranchLaboratoryProbe({ storage, capture }: { storage: BranchStorageAdapter; capture: (controller: BranchLaboratoryController) => void }) {
  const runtime = useRuntimeUniverseModel({ seed: "BRANCH-UI-PROBE", templateId: "hard_science" });
  const laboratory = useBranchLaboratory({ runtime, active: true, storage });
  capture(laboratory);
  return <ExperimentPage laboratory={laboratory} />;
}

function BranchCheckpointProbe({ branchStorage, runtimeStorage, capture }: { branchStorage: BranchStorageAdapter; runtimeStorage: RuntimeStorageAdapter; capture: (laboratory: BranchLaboratoryController, runtime: ReturnType<typeof useRuntimeUniverseModel>) => void }) {
  const runtime = useRuntimeUniverseModel({ seed: "BRANCH-UI-CHECKPOINT", templateId: "hard_science", storage: runtimeStorage });
  const laboratory = useBranchLaboratory({ runtime, active: true, storage: branchStorage });
  capture(laboratory, runtime);
  return <ExperimentPage laboratory={laboratory} />;
}

describe("步骤 4 宇宙实验室界面", () => {
  it("可以创建实验分支、比较、切换、干预和保存", async () => {
    const user = userEvent.setup();
    const storage = createMemoryBranchStorage();
    render(<BranchLaboratoryApp storage={storage} />);

    expect(screen.getByRole("region", { name: "界外实验" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "宇宙内干预" })).toBeTruthy();
    fireEvent.change(screen.getByRole("spinbutton", { name: "条件变化" }), { target: { value: "8" } });
    await user.click(screen.getByRole("button", { name: "创建实验分支" }));
    expect((await screen.findAllByText("实验分支已创建，父分支不变。")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "切换到此分支" })).toHaveLength(2);
    const switchBranch = screen.getAllByRole("button", { name: "切换到此分支" }).find((entry) => !entry.hasAttribute("disabled"));
    expect(switchBranch).toBeTruthy();
    await user.click(switchBranch!);
    expect((await screen.findAllByText("已切换，其他分支不变。")).length).toBeGreaterThan(0);

    const compare = screen.getAllByRole("button", { name: "与当前分支比较" }).find((entry) => !entry.hasAttribute("disabled"));
    expect(compare).toBeTruthy();
    await user.click(compare!);
    expect(screen.getByRole("region", { name: "共同祖先分支比较" })).toBeTruthy();

    fireEvent.change(screen.getByRole("spinbutton", { name: "干预强度" }), { target: { value: "-4" } });
    await user.click(screen.getByRole("button", { name: "提交宇宙内干预" }));
    expect((await screen.findAllByText("干预已提交，不能清除。")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "保存当前分支" }));
    expect((await screen.findAllByText("分支已保存。")).length).toBeGreaterThan(0);
    await waitFor(async () => expect((await storage.list()).length).toBe(2));
  });

  it("实验、分支和分享页面通过 axe 检查", async () => {
    const { container } = render(<BranchLaboratoryApp storage={createMemoryBranchStorage()} />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("分支比较页面显示具体自主认知差异类别且不泄露私有内容", () => {
    const laboratory = {
      currentBranch: undefined,
      branches: [],
      busy: false,
      error: undefined,
      status: undefined,
      comparison: {
        commonAncestorBranchId: "branch:root",
        commonTransitionCount: 1,
        stateDifferences: [{ operation: "update", objectId: "autonomy-entity:1", field: "autonomy.entity.memories", before: "左分支记录", after: "右分支记录", ruleId: "autonomy.compare@1" }],
        differenceEvidence: [{ objectId: "autonomy-entity:1", field: "autonomy.entity.memories", leftTransitionIds: [], rightTransitionIds: [], inputIds: [], ruleIds: [], causalNodeIds: [] }],
        leftOnlyTransitionIds: [], rightOnlyTransitionIds: [], leftOnlyCausalNodeIds: [], rightOnlyCausalNodeIds: [], leftOnlyCausalPaths: [], rightOnlyCausalPaths: [], commonCausalNodeIds: [], commonStateFieldCount: 0, historiesConvergedToSameState: false,
      },
    } as unknown as BranchLaboratoryController;
    render(<BranchesPage laboratory={laboratory} />);
    const comparison = screen.getByRole("region", { name: "共同祖先分支比较" });
    expect(comparison.textContent).toContain("autonomy.entity.memories");
    expect(comparison.textContent).toContain("左分支记录 → 右分支记录");
    expect(comparison.textContent).not.toContain("私有记忆内容");
  });

  it("导入两类分享包并明确处理无效操作和保存失败", async () => {
    let reject = false;
    let laboratory: BranchLaboratoryController | undefined;
    render(<BranchLaboratoryProbe storage={createMemoryBranchStorage({ rejectWrite: () => reject })} capture={(value) => { laboratory = value; }} />);
    await waitFor(() => expect(laboratory).toBeTruthy());

    const genesis = laboratory!.genesisPackage;
    const history = laboratory!.historyPackage;
    await act(async () => expect(await laboratory!.importPackage(genesis)).toBe(true));
    await act(async () => expect(await laboratory!.importPackage(history)).toBe(true));
    await act(async () => expect(await laboratory!.importPackage("损坏内容")).toBe(false));
    expect(screen.getByRole("alert").textContent).toContain("BPKG_JSON｜package");

    await act(async () => expect(await laboratory!.switchBranch("missing")).toBe(false));
    await act(async () => expect(await laboratory!.createExperiment(-1, "cohesion", 1)).toBe(false));
    await act(async () => expect(await laboratory!.intervene("energy", 0)).toBe(false));
    reject = true;
    await act(async () => expect(await laboratory!.saveCurrent()).toBe(false));
    expect(screen.getByRole("alert").textContent).toContain("拒绝");
  });

  it("刷新装配时自动恢复原子保存的活动分支", async () => {
    const storage = createMemoryBranchStorage();
    const state = createInitialUniverseState({ seed: "BRANCH-UI-PROBE", templateId: "hard_science" });
    const root = createRootBranch(state);
    const child = forkUniverseBranch(root, 0, [createExperimentInput(state, root.branchId, "cohesion", 5, 1)]);
    await storage.commit(createBranchArchive(root), false);
    await storage.commit(createBranchArchive(child), true);
    let laboratory: BranchLaboratoryController | undefined;
    render(<BranchLaboratoryProbe storage={storage} capture={(value) => { laboratory = value; }} />);
    await waitFor(() => expect(laboratory?.currentBranch?.branchId).toBe(child.branchId));
    expect(await storage.getActiveBranchId(root.universeDefinitionId)).toBe(child.branchId);
  });

  it("历史包导入保持共享节点身份并在首次推进时原子创建接收者子分支", async () => {
    const storage = createMemoryBranchStorage();
    let laboratory: BranchLaboratoryController | undefined;
    render(<BranchLaboratoryProbe storage={storage} capture={(value) => { laboratory = value; }} />);
    await waitFor(() => expect(laboratory).toBeTruthy());
    const sourceState = createInitialUniverseState({ seed: "BRANCH-UI-PROBE", templateId: "hard_science" });
    const sourceRoot = createRootBranch(sourceState);
    const source = forkUniverseBranch(sourceRoot, 0, [createExperimentInput(sourceState, sourceRoot.branchId, "energy", 4, 1)]);
    const raw = serializeSharePackage(createHistoryBranchPackage(source));

    await act(async () => expect(await laboratory!.importPackage(raw)).toBe(true));
    await waitFor(() => expect(laboratory?.currentBranch?.branchId).toBe(source.branchId));
    expect(laboratory!.currentBranch?.accessMode).toBe("shared-readonly");
    await act(async () => expect(await laboratory!.advanceCurrent()).toBe(true));
    await waitFor(() => expect(laboratory?.currentBranch?.parentBranchId).toBe(source.branchId));
    expect(laboratory!.currentBranch?.accessMode).toBe("local");
    expect(await storage.getActiveBranchId(source.universeDefinitionId)).toBe(laboratory!.currentBranch?.branchId);
  });

  it("跨宇宙比较显示可访问错误且导入失败不改变活动分支", async () => {
    let reject = false;
    const storage = createMemoryBranchStorage({ rejectWrite: () => reject });
    let laboratory: BranchLaboratoryController | undefined;
    render(<BranchLaboratoryProbe storage={storage} capture={(value) => { laboratory = value; }} />);
    await waitFor(() => expect(laboratory?.currentBranch).toBeTruthy());
    const originalId = laboratory!.currentBranch!.branchId;
    const other = createInitialUniverseState({ seed: "BRANCH-UI-OTHER", templateId: "mythic" });
    const otherPackage = serializeSharePackage(createGenesisPackage(other.identity));
    await act(async () => expect(await laboratory!.importPackage(otherPackage)).toBe(true));
    await act(async () => expect(laboratory!.compareWith(originalId)).toBe(false));
    expect(screen.getByRole("alert").textContent).toContain("跨宇宙内容没有可验证共同祖先");

    const activeBeforeFailure = laboratory!.currentBranch!.branchId;
    reject = true;
    const third = createInitialUniverseState({ seed: "BRANCH-UI-THIRD", templateId: "low_magic" });
    await act(async () => expect(await laboratory!.importPackage(serializeSharePackage(createGenesisPackage(third.identity)))).toBe(false));
    expect(laboratory!.currentBranch!.branchId).toBe(activeBeforeFailure);
  });

  it("恢复步骤 2 检查点会创建新正式分支且原实验历史保持不变", async () => {
    const branchStorage = createMemoryBranchStorage();
    const runtimeStorage = createMemoryRuntimeStorage();
    let laboratory: BranchLaboratoryController | undefined;
    let runtime: ReturnType<typeof useRuntimeUniverseModel> | undefined;
    render(<BranchCheckpointProbe branchStorage={branchStorage} runtimeStorage={runtimeStorage} capture={(nextLaboratory, nextRuntime) => { laboratory = nextLaboratory; runtime = nextRuntime; }} />);
    await waitFor(() => expect(laboratory?.currentBranch).toBeTruthy());
    act(() => { runtime!.advance(); runtime!.advance(); });
    await waitFor(() => expect(runtime!.state.clock.tick).toBe(2));
    await act(async () => { await runtime!.save(); });
    await act(async () => expect(await laboratory!.createExperiment(2, "energy", 5)).toBe(true));
    await waitFor(() => expect(laboratory!.currentBranch!.state.clock.tick).toBe(3));
    const experiment = structuredClone(laboratory!.currentBranch!);

    await act(async () => expect(await laboratory!.restoreLatestCheckpoint()).toBe(true));
    await waitFor(() => expect(laboratory!.currentBranch!.state.clock.tick).toBe(2));
    expect(laboratory!.currentBranch!.branchId).not.toBe(experiment.branchId);
    expect(laboratory!.branches.find((entry) => entry.branchId === experiment.branchId)).toEqual(experiment);
    expect(await branchStorage.getActiveBranchId(experiment.universeDefinitionId)).toBe(laboratory!.currentBranch!.branchId);
  });

  it("连续运行启动前确保共享节点可写，停止时不创建额外分支", async () => {
    const branchStorage = createMemoryBranchStorage();
    const runtimeStorage = createMemoryRuntimeStorage();
    let laboratory: BranchLaboratoryController | undefined;
    let runtime: ReturnType<typeof useRuntimeUniverseModel> | undefined;
    render(<BranchCheckpointProbe branchStorage={branchStorage} runtimeStorage={runtimeStorage} capture={(nextLaboratory, nextRuntime) => { laboratory = nextLaboratory; runtime = nextRuntime; }} />);
    await waitFor(() => expect(laboratory).toBeTruthy());
    await act(async () => expect(await laboratory!.toggleRunning()).toBe(true));
    await waitFor(() => expect(runtime!.state.clock.status).toBe("running"));
    const branchId = laboratory!.currentBranch!.branchId;
    await act(async () => expect(await laboratory!.toggleRunning()).toBe(true));
    await waitFor(() => expect(runtime!.state.clock.status).toBe("paused"));
    expect(laboratory!.currentBranch!.branchId).toBe(branchId);
  });

  it("运行状态切换失败时等待活动指针回滚并报告回滚失败", async () => {
    let reject = false;
    const storage = createMemoryBranchStorage({ rejectWrite: () => reject });
    const state = createInitialUniverseState({ seed: "BRANCH-ACTIVATION-FAILURE", templateId: "hard_science" });
    const previous = createRootBranch(state);
    const next = forkUniverseBranch(previous, 0, []);
    await storage.commit(createBranchArchive(previous), true);
    const runtime = { pause: () => undefined, replaceState: () => false } as unknown as ReturnType<typeof useRuntimeUniverseModel>;
    let failure = "";
    expect(await activateRuntimeBranch(runtime, storage, next, previous, () => undefined, (message) => { failure = message; })).toBe(false);
    expect(failure).toContain("已恢复先前活动分支");
    reject = true;
    expect(await activateRuntimeBranch(runtime, storage, next, previous, () => undefined, (message) => { failure = message; })).toBe(false);
    expect(failure).toContain("持久化回滚失败");
  });

  it("分支列表读取失败时显示可访问错误", async () => {
    const storage: BranchStorageAdapter = {
      storageVersion: "test",
      migrate: async () => undefined,
      put: async () => undefined,
      commit: async () => undefined,
      get: async () => undefined,
      list: async () => { throw "读取失败"; },
      getActiveBranchId: async () => undefined,
      remove: async () => undefined,
    };
    render(<BranchLaboratoryProbe storage={storage} capture={() => undefined} />);
    expect((await screen.findByRole("alert")).textContent).toContain("分支列表读取失败");
  });
});
