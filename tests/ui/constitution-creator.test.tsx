import { axe } from "jest-axe";
import { render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RuntimeApplication } from "../../src/components/RuntimeApplication";

describe("步骤 5 宇宙宪法创世", () => {
  it("三个参考预设能够切换、校验并创建对应运行宇宙", async () => {
    const user = userEvent.setup();
    const view = render(<RuntimeApplication active onOpenLegacy={() => undefined} />);
    const preset = screen.getByRole("combobox", { name: "宪法预设" });
    expect(screen.getByRole("heading", { name: "物质广域" })).toBeTruthy();
    await user.selectOptions(preset, "arcane-weave@1");
    expect(screen.getByRole("heading", { name: "奥术织网" })).toBeTruthy();
    expect(screen.getAllByText(/循环时间|cyclic/).length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "跨宇宙宪法比较" }).textContent).toContain("双方没有共同历史");
    expect(screen.getByRole("region", { name: "跨宇宙宪法比较" }).textContent).toContain("本体");
    await user.click(screen.getByRole("button", { name: "创世" }));
    expect(screen.queryByRole("region", { name: "跨宇宙宪法比较" })).toBeNull();
    expect(screen.getByText(/奥术织网｜相位/)).toBeTruthy();
    await user.selectOptions(preset, "dream-flux@1");
    expect(screen.getByText(/不提供宇宙内干预/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "创世" }));
    await user.click(screen.getByRole("button", { name: /观察：选择方式并获取证据/ }));
    expect(screen.getByRole("region", { name: "宪法动态指标" }).textContent).toContain("连贯性");
    expect(screen.getByRole("region", { name: "宪法动态指标" }).textContent).not.toContain("凝聚度");
    await user.click(screen.getByRole("button", { name: "执行观察" }));
    expect(await screen.findByText(/意象破碎|意象可辨|意象连贯/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /实验：界外实验与宇宙内干预/ }));
    expect(screen.getByText(/当前宇宙宪法不提供宇宙内干预能力/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "提交宇宙内干预" })).toBeNull();
    expect((await axe(view.container)).violations).toEqual([]);
  });

  it("兼容模块可以组合为新宪法并获得新身份", async () => {
    const user = userEvent.setup();
    render(<RuntimeApplication active onOpenLegacy={() => undefined} />);
    const originalIdentity = screen.getByText(/宪法身份：/).textContent;
    await user.click(screen.getByText("组合宪法模块"));
    await user.selectOptions(screen.getByRole("combobox", { name: "时间" }), "time.cyclic@1");
    await user.selectOptions(screen.getByRole("combobox", { name: "拓扑" }), "topology.semantic-dream@1");
    expect(screen.getByRole("heading", { name: "自定义组合宪法" })).toBeTruthy();
    expect(screen.getAllByText(/cyclic/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/semantic/).length).toBeGreaterThan(0);
    expect(screen.getByText(/宪法身份：/).textContent).not.toBe(originalIdentity);
    await user.click(screen.getByRole("button", { name: "创世" }));
    expect(screen.getByText(/自定义组合宪法｜相位/)).toBeTruthy();
  });

  it("不兼容模块组合显示可访问错误且不能形成部分宪法", async () => {
    const user = userEvent.setup();
    render(<RuntimeApplication active onOpenLegacy={() => undefined} />);
    await user.click(screen.getByText("组合宪法模块"));
    await user.selectOptions(screen.getByRole("combobox", { name: "本体" }), "ontology.arcane-weave@1");
    expect(screen.getAllByRole("alert").some((entry) => /RULE_TARGET|字段/.test(entry.textContent ?? ""))).toBe(true);
    expect(screen.getByRole("heading", { name: "物质广域" })).toBeTruthy();
  });
});
