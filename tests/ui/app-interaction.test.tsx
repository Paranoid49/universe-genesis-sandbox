import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { App } from "../../src/App";

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
});
