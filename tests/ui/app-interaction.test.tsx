import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/App";
import { AppErrorBoundary } from "../../src/components/AppErrorBoundary";
import { generateUniverse, RULESET_VERSION } from "../../src/sim";

describe("应用关键交互", () => {
  it("可以通过主导航进入星系与文明页面", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /星系、恒星系与行星/ }));
    expect(screen.getByRole("heading", { name: "局部探索" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /文明演化与神话/ }));
    expect(screen.getByRole("heading", { name: "文明演化" })).toBeTruthy();
  });

  it("施加奇迹后会显示真实实体变化和干预日志", async () => {
    const user = userEvent.setup();
    render(<App initialPage="miracles" />);

    await user.click(screen.getByRole("button", { name: "施加奇迹" }));
    expect(await screen.findByText(/实体变化：habitability/)).toBeTruthy();
    expect(screen.getByText(/造物主对.*施加“祝福行星”/)).toBeTruthy();
  });

  it("空 Seed 会显示错误并保留当前宇宙，修正后可以继续创世", async () => {
    const user = userEvent.setup();
    render(<App />);
    const universeName = screen.getByRole("heading", { level: 2 }).textContent;
    const seedInput = screen.getByRole("textbox", { name: "Seed" });
    await user.clear(seedInput);
    await user.click(screen.getByRole("button", { name: "创世" }));
    expect(screen.getByRole("alert").textContent).toContain("Seed");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(universeName);

    await user.type(seedInput, "RECOVER-001");
    await user.click(screen.getByRole("button", { name: "创世" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(seedInput.getAttribute("aria-invalid")).toBe("false");
  });

  it("随机 Seed 会更新输入并生成新宇宙", async () => {
    const user = userEvent.setup();
    render(<App />);
    const seedInput = screen.getByRole("textbox", { name: "Seed" }) as HTMLInputElement;
    const before = seedInput.value;
    await user.click(screen.getByRole("button", { name: "随机" }));
    expect(seedInput.value).not.toBe(before);
    expect(seedInput.value).toMatch(/^[A-F0-9-]+$/);
  });

  it("剪贴板可用时复制完整分享文本", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<App />);
    await user.click(screen.getByRole("button", { name: "复制分享" }));
    expect(await screen.findByRole("button", { name: "已复制" })).toBeTruthy();
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain("http://localhost");
  });

  it("剪贴板不可用时打开手动复制框", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("");
    render(<App />);
    await user.click(screen.getByRole("button", { name: "复制分享" }));
    expect(await screen.findByRole("button", { name: "已打开复制框" })).toBeTruthy();
    expect(prompt).toHaveBeenCalledOnce();
    prompt.mockRestore();
  });

  it("带干预的分享查询可以恢复同一分支", () => {
    const base = generateUniverse({ seed: "UI-SHARE-001", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    const target = base.galaxies[0].starSystems[0].planets[0];
    const universe = generateUniverse({
      seed: "UI-SHARE-001",
      rulesetVersion: RULESET_VERSION,
      templateId: "high_magic",
      interventions: [{ id: "ui-share", miracleType: "bless_planet", targetId: target.id }],
    });
    render(<App initialPage="miracles" search={universe.shareUrl} />);
    expect(screen.getByText(/实体变化：habitability/)).toBeTruthy();
    expect(screen.getByText(/1 次奇迹/)).toBeTruthy();
  });

  it.each([
    ["timeline", "纪元时间线"],
    ["laws", "法则与解释"],
    ["logs", "潜在终局"],
  ] as const)("%s 页面可以独立渲染", (page, text) => {
    render(<App initialPage={page} />);
    expect(screen.getByText(text, { exact: false })).toBeTruthy();
  });

  it("纪元筛选、事件选择和法则对比可以交互", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App initialPage="timeline" />);
    await user.click(screen.getByTitle("筛选生命事件"));
    expect(screen.getByTitle("筛选生命事件").className).toContain("active");
    const eventButtons = screen.getAllByRole("button").filter((button) => button.className.includes("timeline-event"));
    await user.click(eventButtons.at(-1)!);
    expect(eventButtons.at(-1)!.className).toContain("active");

    unmount();
    render(<App initialPage="laws" />);
    const compareInput = screen.getByRole("textbox", { name: "对比 Seed" });
    await user.clear(compareInput);
    await user.click(screen.getByRole("button", { name: "对比" }));
    expect(screen.getByRole("alert").textContent).toContain("对比 Seed 无效");
  });

  it("核心页面没有自动化可检测的无障碍违规", async () => {
    const { container } = render(<App />);
    const result = await axe(container);
    expect(result.violations).toEqual([]);
  });

  it("键盘可以依次聚焦 Seed、模板和创世操作", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Seed" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "模板" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "创世" }));
  });

  it("顶层错误边界会提供可恢复提示", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Broken = () => {
      throw new Error("测试异常");
    };
    render(<AppErrorBoundary><Broken /></AppErrorBoundary>);
    expect(screen.getByRole("alert").textContent).toContain("测试异常");
    expect(screen.getByRole("button", { name: "重新加载" })).toBeTruthy();
    consoleError.mockRestore();
  });
});
