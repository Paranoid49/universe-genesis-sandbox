import { act, fireEvent, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimePage } from "../../src/components/pages/RuntimePage";
import { createMemoryRuntimeStorage, type RuntimeStorageAdapter } from "../../src/ui/runtimeStorage";
import { CONTINUOUS_STEP_BUDGET, useRuntimeUniverseModel } from "../../src/ui/useRuntimeUniverseModel";

function RuntimeTestApp({ storage = createMemoryRuntimeStorage(), active = true }: { storage?: RuntimeStorageAdapter; active?: boolean }) {
  const runtime = useRuntimeUniverseModel({ seed: "RUNTIME-UI-001", templateId: "hard_science", storage, active });
  return <RuntimePage runtime={runtime} />;
}

describe("步骤 2 运行中宇宙页面", () => {
  afterEach(() => vi.useRealTimers());

  it("可以单步推进并在只读历史游标中查看过去", async () => {
    const user = userEvent.setup();
    render(<RuntimeTestApp />);

    expect(screen.getByText("第 0 步")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "单步推进" }));
    expect(screen.getByText("第 1 步")).toBeTruthy();
    expect(screen.getAllByText("逻辑时刻 1")).toHaveLength(2);

    fireEvent.change(screen.getByRole("slider", { name: "历史浏览位置" }), { target: { value: "0" } });
    expect(screen.getByText("历史浏览位置：0")).toBeTruthy();
    expect(screen.getByText("第 1 步")).toBeTruthy();
    expect(screen.getByText("当前浏览位置尚无已发生事件。")).toBeTruthy();
  });

  it("连续运行可以暂停且暂停后不再提交时间步", async () => {
    vi.useFakeTimers();
    render(<RuntimeTestApp />);
    fireEvent.click(screen.getByRole("button", { name: "连续运行" }));

    await act(async () => {
      vi.advanceTimersByTime(1700);
    });
    expect(screen.getByText("第 2 步")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("第 2 步")).toBeTruthy();
  });

  it("页面离开运行视图时停止调度", async () => {
    vi.useFakeTimers();
    const storage = createMemoryRuntimeStorage();
    const view = render(<RuntimeTestApp storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "连续运行" }));
    await act(async () => { vi.advanceTimersByTime(850); });
    expect(screen.getByText("第 1 步")).toBeTruthy();

    view.rerender(<RuntimeTestApp storage={storage} active={false} />);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText("第 1 步")).toBeTruthy();
  });

  it("连续运行达到单次计算预算后自动暂停且不跳步", async () => {
    vi.useFakeTimers();
    render(<RuntimeTestApp />);
    fireEvent.click(screen.getByRole("button", { name: "连续运行" }));

    await act(async () => { vi.advanceTimersByTime((CONTINUOUS_STEP_BUDGET + 2) * 800); });

    expect(screen.getByText(`第 ${CONTINUOUS_STEP_BUDGET} 步`)).toBeTruthy();
    expect(screen.getByText("已暂停")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("计算预算");
  });

  it("保存检查点后可以恢复并从保存位置继续", async () => {
    const storage = createMemoryRuntimeStorage();
    const user = userEvent.setup();
    render(<RuntimeTestApp storage={storage} />);

    await user.click(screen.getByRole("button", { name: "单步推进" }));
    await user.click(screen.getByRole("button", { name: "保存检查点" }));
    expect(await screen.findByText("已保存检查点：第 1 步")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "单步推进" }));
    expect(screen.getByText("第 2 步")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "恢复最近检查点" }));
    expect(await screen.findByText("已恢复检查点：第 1 步")).toBeTruthy();
    expect(screen.getByText("第 1 步")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "单步推进" }));
    expect(screen.getByText("第 2 步")).toBeTruthy();
  });

  it("保存进行期间停止调度且并发运行命令不可重入", async () => {
    vi.useFakeTimers();
    const base = createMemoryRuntimeStorage();
    let releaseWrite: (() => void) | undefined;
    const storage: RuntimeStorageAdapter = {
      ...base,
      put: async (archive) => {
        await new Promise<void>((resolve) => { releaseWrite = resolve; });
        await base.put(archive);
      },
    };
    render(<RuntimeTestApp storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "连续运行" }));
    await act(async () => { vi.advanceTimersByTime(850); });
    expect(screen.getByText("第 1 步")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "保存检查点" }));
    expect(screen.getByText("已暂停")).toBeTruthy();
    expect(screen.getByRole("button", { name: "连续运行" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "保存检查点" }).hasAttribute("disabled")).toBe(true);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText("第 1 步")).toBeTruthy();

    await act(async () => releaseWrite?.());
    expect(await screen.findByText("已保存检查点：第 1 步")).toBeTruthy();
    expect(screen.getByText("已暂停")).toBeTruthy();
  });

  it("存档写入失败时保持原运行状态并显示可恢复错误", async () => {
    const storage = createMemoryRuntimeStorage({ rejectWrite: () => true });
    const user = userEvent.setup();
    render(<RuntimeTestApp storage={storage} />);

    await user.click(screen.getByRole("button", { name: "保存检查点" }));

    expect((await screen.findByRole("alert")).textContent).toContain("拒绝");
    expect(screen.getByText("第 0 步")).toBeTruthy();
    expect(screen.getByText("已暂停")).toBeTruthy();
    expect(await storage.list()).toEqual([]);
  });

  it("连续运行中的保存失败会保持暂停且等待真实时间不再推进", async () => {
    vi.useFakeTimers();
    const storage = createMemoryRuntimeStorage({ rejectWrite: () => true });
    render(<RuntimeTestApp storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "连续运行" }));
    await act(async () => { vi.advanceTimersByTime(850); });
    expect(screen.getByText("第 1 步")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "保存检查点" }));
    expect((await screen.findByRole("alert")).textContent).toContain("拒绝");
    expect(screen.getByText("已暂停")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText("第 1 步")).toBeTruthy();
  });

  it("连续运行中的恢复失败会保持暂停且等待真实时间不再推进", async () => {
    vi.useFakeTimers();
    const base = createMemoryRuntimeStorage();
    const storage: RuntimeStorageAdapter = {
      ...base,
      list: async () => { throw new Error("IndexedDB 打开失败。"); },
    };
    render(<RuntimeTestApp storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "连续运行" }));
    await act(async () => { vi.advanceTimersByTime(850); });
    expect(screen.getByText("第 1 步")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "恢复最近检查点" }));
    expect((await screen.findByRole("alert")).textContent).toContain("IndexedDB 打开失败");
    expect(screen.getByText("已暂停")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText("第 1 步")).toBeTruthy();
  });

  it("运行控制与历史页面通过 axe 检查", async () => {
    const { container } = render(<RuntimeTestApp />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("已发生事件可以双向浏览运行因果网络", async () => {
    const user = userEvent.setup();
    render(<RuntimeTestApp />);
    await user.click(screen.getByRole("button", { name: "单步推进" }));
    await user.click(screen.getByRole("button", { name: "查看原因与后果" }));

    expect(screen.getByRole("heading", { name: "运行因果查询" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "为什么发生" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "产生了什么后果" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "状态转换" }));
    expect(screen.getByText(/逻辑时刻 0 → 1/)).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: /attributes\./ })[0]);
    expect(screen.getAllByText(/→/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "运行规则" }));
    expect(screen.getByText("该节点是合法根因。")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "关闭运行因果查询" }));
    expect(screen.queryByRole("heading", { name: "运行因果查询" })).toBeNull();
  });

  it("速度和全部历史导航按钮可以操作", async () => {
    const user = userEvent.setup();
    render(<RuntimeTestApp />);
    await user.selectOptions(screen.getByRole("combobox", { name: "运行速度" }), "4");
    expect((screen.getByRole("combobox", { name: "运行速度" }) as HTMLSelectElement).value).toBe("4");
    await user.click(screen.getByRole("button", { name: "单步推进" }));
    await user.click(screen.getByRole("button", { name: "单步推进" }));

    await user.click(screen.getByRole("button", { name: "最初" }));
    expect(screen.getByText("历史浏览位置：0")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByText("历史浏览位置：1")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "上一步" }));
    expect(screen.getByText("历史浏览位置：0")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "回到当前" }));
    expect(screen.getByText("历史浏览位置：2")).toBeTruthy();
  });

  it("没有检查点时恢复会显示明确错误且不改变状态", async () => {
    const user = userEvent.setup();
    render(<RuntimeTestApp />);
    await user.click(screen.getByRole("button", { name: "恢复最近检查点" }));
    expect((await screen.findByRole("alert")).textContent).toContain("没有可恢复");
    expect(screen.getByText("第 0 步")).toBeTruthy();
  });
});
