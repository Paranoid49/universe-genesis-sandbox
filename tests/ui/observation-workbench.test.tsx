import { act, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { ObservationPage } from "../../src/components/pages/ObservationPage";
import { ResearchPage } from "../../src/components/pages/ResearchPage";
import { createObservationAccess, runtimeStateFingerprint } from "../../src/sim";
import { createMemoryResearchStorage, type ResearchStorageAdapter } from "../../src/ui/researchStorage";
import { useObservationWorkbench } from "../../src/ui/useObservationWorkbench";
import type { ObservationWorkbenchController } from "../../src/ui/useObservationWorkbench";
import { useLegacyRuntimeUniverseModel as useRuntimeUniverseModel } from "../../src/ui/useLegacyRuntimeUniverseModel";

function WorkbenchApp({ storage, capture, active = true }: { storage: ResearchStorageAdapter; capture?: (controller: ObservationWorkbenchController) => void; active?: boolean }) {
  const runtime = useRuntimeUniverseModel({ seed: "OBSERVATION-UI-001", templateId: "hard_science" });
  const workbench = useObservationWorkbench({ access: createObservationAccess(runtime.state), active, storage });
  capture?.(workbench);
  return <><output data-testid="runtime-fingerprint">{runtimeStateFingerprint(runtime.state)}</output><ObservationPage workbench={workbench} causal={{ node: runtime.causalNode, directCauses: runtime.directCauses, directEffects: runtime.directEffects, select: runtime.setCausalNodeId }} /><ResearchPage workbench={workbench} /></>;
}

describe("步骤 3 自由观察与研究记录", () => {
  it("观察台与研究记录簿通过 axe 检查", async () => {
    const { container } = render(<WorkbenchApp storage={createMemoryResearchStorage()} />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("可以沿不同观察方式获得证据、追溯来源并保存关注笔记和推测", async () => {
    const user = userEvent.setup();
    const storage = createMemoryResearchStorage();
    render(<WorkbenchApp storage={storage} />);
    const runtimeFingerprintBefore = screen.getByTestId("runtime-fingerprint").textContent;

    expect(screen.getByText("底层事实不会自动展示。", { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "按对象开始" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "按尺度开始" }));
    expect(screen.getByRole("combobox", { name: "选择观察尺度" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "按时间开始" }));
    expect(screen.getByRole("slider", { name: "观察逻辑时刻" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "按现象开始" }));
    expect(screen.getByRole("combobox", { name: "选择现象" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /结构观测/ }));
    await user.click(screen.getByRole("button", { name: "执行观察" }));
    expect(await screen.findByRole("heading", { name: "结构观测" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "查看证据来源" }));
    expect(screen.getByRole("heading", { name: "证据来源" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "关闭证据来源" }));
    await user.click(screen.getByRole("button", { name: "执行观察" }));

    await user.type(screen.getByRole("textbox", { name: /关注标签/ }), "结构,长期观察");
    await user.click(screen.getByRole("button", { name: "加入关注" }));
    expect((await screen.findAllByText("已加入关注。")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "加入关注" }));
    expect((await screen.findAllByText("该观察已经在关注列表中。")).length).toBeGreaterThan(0);
    await user.type(screen.getByRole("textbox", { name: /玩家笔记/ }), "结构正在形成，但仍需更多证据。");
    await user.click(screen.getByRole("button", { name: "保存笔记" }));
    expect((await screen.findAllByText("笔记已保存。")).length).toBeGreaterThan(0);
    await user.type(screen.getByRole("textbox", { name: /玩家推测/ }), "凝聚过程可能继续增强。");
    await user.click(screen.getByRole("button", { name: "保存推测" }));
    expect((await screen.findAllByText("推测已保存，并保持为玩家观点。")).length).toBeGreaterThan(0);
    expect(screen.getByText("结构正在形成，但仍需更多证据。")).toBeTruthy();
    expect(screen.getByText("凝聚过程可能继续增强。")).toBeTruthy();
    expect(screen.getByRole("region", { name: "法则认知分层" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "传统空间条件视图" })).toBeNull();
    expect(screen.getByTestId("runtime-fingerprint").textContent).toBe(runtimeFingerprintBefore);
  });

  it("刷新式重新挂载后恢复研究记录，写入失败不会显示虚假成功", async () => {
    const user = userEvent.setup();
    let reject = false;
    const base = createMemoryResearchStorage({ rejectWrite: () => reject });
    const view = render(<WorkbenchApp storage={base} />);
    await user.click(screen.getByRole("button", { name: "执行观察" }));
    await user.click(await screen.findByRole("button", { name: "加入关注" }));
    expect((await screen.findAllByText("已加入关注。")).length).toBeGreaterThan(0);
    view.unmount();

    render(<WorkbenchApp storage={base} />);
    await waitFor(() => expect(screen.getAllByText("结构观测").length).toBeGreaterThan(0));
    expect(screen.queryByRole("region", { name: "传统空间条件视图" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "选择已获得的观察信号" })).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: /玩家笔记/ }), "先成功保存的笔记");
    await user.click(screen.getByRole("button", { name: "保存笔记" }));
    expect((await screen.findAllByText("笔记已保存。")).length).toBeGreaterThan(0);
    reject = true;
    await user.type(screen.getByRole("textbox", { name: /玩家笔记/ }), "这条记录不应保存");
    await user.click(screen.getByRole("button", { name: "保存笔记" }));
    expect((await screen.findAllByRole("alert")).every((entry) => entry.textContent?.includes("拒绝"))).toBe(true);
    expect(screen.queryByText("笔记已保存。")).toBeNull();
    expect(screen.queryByText("这条记录不应保存")).toBeNull();
    expect((screen.getByRole("textbox", { name: /玩家笔记/ }) as HTMLTextAreaElement).value).toBe("这条记录不应保存");
  });

  it("选择不存在的观察信号时保持空选择", async () => {
    let workbench: ObservationWorkbenchController | undefined;
    render(<WorkbenchApp storage={createMemoryResearchStorage()} capture={(value) => { workbench = value; }} />);
    await waitFor(() => expect(workbench?.loading).toBe(false));
    act(() => workbench!.selectSignal("missing"));
    expect(workbench!.signal).toBeUndefined();
  });

  it("工作台未激活时不读取研究存储", async () => {
    let reads = 0;
    const base = createMemoryResearchStorage();
    const storage: ResearchStorageAdapter = { ...base, get: async (...args) => { reads += 1; return base.get(...args); } };
    render(<WorkbenchApp storage={storage} active={false} />);
    await Promise.resolve();
    expect(reads).toBe(0);
  });

  it("加载期、缺失对象和空研究输入都会明确拒绝", async () => {
    let workbench: ObservationWorkbenchController | undefined;
    render(<WorkbenchApp storage={createMemoryResearchStorage()} capture={(value) => { workbench = value; }} />);
    await act(async () => expect(await workbench!.observe({ methodId: "structure", objectId: "missing", tick: 0 })).toBe(false));
    await waitFor(() => expect(workbench?.loading).toBe(false));
    await act(async () => expect(await workbench!.observe({ methodId: "structure", objectId: "missing", tick: 0 })).toBe(false));
    await act(async () => expect(await workbench!.addFocus("缺失信号", [])).toBe(false));
    await act(async () => expect(await workbench!.addNote("   ")).toBe(false));
    await act(async () => expect(await workbench!.addHypothesis("   ")).toBe(false));
    expect(screen.getAllByRole("alert").every((entry) => entry.textContent?.includes("不能为空"))).toBe(true);
  });
});
