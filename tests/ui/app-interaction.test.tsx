import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App";
import { AppErrorBoundary } from "../../src/components/AppErrorBoundary";
import { SpaceExplorer } from "../../src/components/SpaceExplorer";
import { generateUniverse, RULESET_VERSION, type MiracleType } from "../../src/sim";
import { buildMiracleTargetOptions } from "../../src/ui/miracleTargets";
import { buildObservationProjection } from "../../src/ui/observationProjection";
import { buildSourceLabelMap, summarizeSpace } from "../../src/ui/selectors";
import { saveUniverseEntry, serializeArchive, type UniverseArchiveEntry } from "../../src/ui/archive";

describe("应用关键交互", () => {
  beforeEach(() => window.localStorage.clear());
  it("可以通过主导航进入星系与文明页面", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /星系、恒星系与行星/ }));
    expect(screen.getByRole("heading", { name: "局部探索" })).toBeTruthy();
    const galaxyChoices = document.querySelectorAll(".space-grid > .space-list:first-child .space-select");
    await user.click(galaxyChoices[Math.min(1, galaxyChoices.length - 1)] as HTMLElement);
    const systemChoices = document.querySelectorAll(".space-grid > .space-list:nth-child(2) > div:not(.planet-select-list) .space-select");
    await user.click(systemChoices[Math.min(1, systemChoices.length - 1)] as HTMLElement);
    const planetChoices = document.querySelectorAll(".planet-select-list .space-select");
    await user.click(planetChoices[Math.min(1, planetChoices.length - 1)] as HTMLElement);

    await user.click(screen.getByRole("button", { name: /文明演化与神话/ }));
    expect(screen.getByRole("heading", { name: "文明演化" })).toBeTruthy();
    const civilizationChoices = document.querySelectorAll(".civilization-select");
    await user.click(civilizationChoices[Math.min(1, civilizationChoices.length - 1)] as HTMLElement);
  });

  it("概览快捷入口可以进入星系和文明页面", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTitle("查看代表性星系"));
    expect(screen.getByRole("heading", { name: "局部探索" })).toBeTruthy();
    await user.click(screen.getByTitle("宇宙摘要与指标"));
    await user.click(screen.getByTitle("查看文明演化"));
    expect(screen.getByRole("heading", { name: "文明演化" })).toBeTruthy();
  });

  it("局部探索覆盖空状态和三级选择回调", async () => {
    const user = userEvent.setup();
    const universe = generateUniverse({ seed: "SPACE-UI-001", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    const galaxy = universe.galaxies[0];
    const system = galaxy.starSystems[0];
    const planet = system.planets[0];
    const onSelectGalaxy = vi.fn();
    const onSelectSystem = vi.fn();
    const onSelectPlanet = vi.fn();
    const empty = render(<SpaceExplorer universe={universe} stats={summarizeSpace(universe)} sourceLabelById={buildSourceLabelMap(universe)} onSelectGalaxy={onSelectGalaxy} onSelectSystem={onSelectSystem} onSelectPlanet={onSelectPlanet} />);
    expect(empty.container.textContent).toBe("");
    empty.unmount();
    render(<SpaceExplorer universe={universe} stats={summarizeSpace(universe)} selectedGalaxy={galaxy} selectedSystem={system} selectedPlanet={planet} sourceLabelById={buildSourceLabelMap(universe)} onSelectGalaxy={onSelectGalaxy} onSelectSystem={onSelectSystem} onSelectPlanet={onSelectPlanet} />);
    const galaxyButtons = document.querySelectorAll(".space-grid > .space-list:first-child .space-select");
    const systemButtons = document.querySelectorAll(".space-grid > .space-list:nth-child(2) > div:not(.planet-select-list) .space-select");
    const planetButtons = document.querySelectorAll(".planet-select-list .space-select");
    await user.click(galaxyButtons[Math.min(1, galaxyButtons.length - 1)] as HTMLElement);
    await user.click(systemButtons[Math.min(1, systemButtons.length - 1)] as HTMLElement);
    await user.click(planetButtons[Math.min(1, planetButtons.length - 1)] as HTMLElement);
    expect(onSelectGalaxy).toHaveBeenCalledTimes(1);
    expect(onSelectSystem).toHaveBeenCalledTimes(1);
    expect(onSelectPlanet).toHaveBeenCalledTimes(1);
  });

  it("奇迹目标选择覆盖宇宙、恒星系、行星、神话和文明目标", () => {
    const universe = generateUniverse({ seed: "MIRACLE-TARGETS-001", rulesetVersion: RULESET_VERSION, templateId: "mythic" });
    expect(buildMiracleTargetOptions(universe, "repair_causality")).toHaveLength(1);
    expect(buildMiracleTargetOptions(universe, "stabilize_star").every((option) => option.kind === "star_system")).toBe(true);
    expect(buildMiracleTargetOptions(universe, "bless_planet").every((option) => option.kind === "planet")).toBe(true);
    expect(buildMiracleTargetOptions(universe, "seal_deity").every((option) => option.kind === "mythology")).toBe(true);
    expect(buildMiracleTargetOptions(universe, "revive_civilization").every((option) => option.kind === "civilization")).toBe(true);
    expect(buildMiracleTargetOptions(universe, "unknown" as MiracleType)).toEqual([]);
  });

  it("观察投影覆盖单节点、双节点和无效层级布局分支", () => {
    const universe = generateUniverse({ seed: "OBSERVATION-BRANCHES", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    const single = structuredClone(universe);
    single.galaxies = [single.galaxies[0]];
    expect(buildObservationProjection(single, "universe").nodes[0]).toMatchObject({ x: 50, y: 50 });
    const pair = structuredClone(universe);
    pair.galaxies = pair.galaxies.slice(0, 2);
    expect(buildObservationProjection(pair, "universe").nodes.every((node) => node.y === 50)).toBe(true);
    expect(buildObservationProjection(universe, "galaxy", "missing").nodes).toEqual([]);
    expect(buildObservationProjection(universe, "system", universe.galaxies[0].id, "missing").nodes).toEqual([]);
  });

  it("观察台支持层级、叠层和时间浏览", async () => {
    const user = userEvent.setup();
    const { container } = render(<App initialPage="observe" />);
    expect(screen.getByRole("heading", { name: "可视化宇宙观察台" })).toBeTruthy();
    await user.click(container.querySelector<HTMLButtonElement>(".observation-node-list button")!);
    expect(screen.getByText(/选择节点可进入恒星系层/)).toBeTruthy();
    await user.click(container.querySelector<HTMLButtonElement>(".observation-node-list button")!);
    expect(screen.getByText(/选择节点可查看结构化详情/)).toBeTruthy();
    await user.click(container.querySelector<HTMLButtonElement>(".observation-node-list button")!);
    const galaxyBreadcrumb = container.querySelectorAll<HTMLButtonElement>(".observation-breadcrumbs button")[1];
    await user.click(galaxyBreadcrumb);
    expect(screen.getByText(/选择节点可进入恒星系层/)).toBeTruthy();
    const svgNode = container.querySelector<SVGGElement>(".observation-node")!;
    svgNode.focus();
    expect(document.activeElement).toBe(svgNode);
    await user.keyboard("{Enter}");
    expect(screen.getByText(/选择节点可查看结构化详情/)).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox", { name: "信息叠层" }), "causality");
    expect((screen.getByRole("combobox", { name: "信息叠层" }) as HTMLSelectElement).value).toBe("causality");
    await user.click(screen.getByRole("button", { name: "下一条" }));
    expect(screen.getByText(/时间位置 2/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "最后一条" }));
    expect(screen.getByRole("button", { name: "下一条" }).hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByRole("button", { name: "上一条" }));
    await user.click(screen.getByRole("button", { name: "第一条" }));
    expect(screen.getByText(/时间位置 1/)).toBeTruthy();

    const svgIds = [...container.querySelectorAll<SVGGElement>(".observation-node")].map((node) => node.dataset.nodeId);
    const textIds = [...container.querySelectorAll<HTMLButtonElement>(".observation-node-list button")].map((node) => node.dataset.nodeId);
    expect(svgIds).toEqual(textIds);
    const defaultUniverse = generateUniverse({ seed: "LUX-7F3A-91C2", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    const defaultGalaxy = defaultUniverse.galaxies[0];
    const defaultSystem = defaultGalaxy.starSystems[0];
    const relatedEventId = buildObservationProjection(defaultUniverse, "system", defaultGalaxy.id, defaultSystem.id).nodes
      .flatMap((node) => node.relatedEventIds)[0];
    const relatedEventIndex = defaultUniverse.timeline.findIndex((event) => event.id === relatedEventId);
    expect(relatedEventIndex).toBeGreaterThanOrEqual(0);
    fireEvent.change(screen.getByRole("slider"), { target: { value: relatedEventIndex } });
    expect(container.querySelectorAll(".observation-node.event-related").length).toBeGreaterThan(0);
    expect(screen.getByText(/当前层级关联节点：/).textContent).not.toContain("：无");

    await user.click(screen.getByRole("button", { name: "最后一条" }));
    const seedInput = screen.getByRole("textbox", { name: "Seed" });
    await user.clear(seedInput);
    await user.type(seedInput, "OBSERVE-RESET-001");
    await user.click(screen.getByRole("button", { name: "创世" }));
    expect(screen.getByText(/时间位置 1/)).toBeTruthy();
  });

  it("图书馆支持保存、搜索、收藏、导出、删除、导入和恢复", async () => {
    const user = userEvent.setup();
    render(<App initialPage="library" />);
    const title = screen.getByRole("textbox", { name: "存档标题" });
    await user.clear(title);
    await user.type(title, "我的测试宇宙");
    await user.click(screen.getByRole("button", { name: "保存当前宇宙" }));
    expect(await screen.findByText("我的测试宇宙")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "收藏" }));
    expect(screen.getByLabelText("已收藏")).toBeTruthy();
    const search = screen.getByRole("textbox", { name: "搜索存档" });
    await user.type(search, "不存在");
    expect(screen.getByText("没有匹配当前条件的存档。")).toBeTruthy();
    await user.clear(search);
    await user.click(screen.getByRole("button", { name: "生成导出 JSON" }));
    const exported = (screen.getByRole("textbox", { name: "导出 JSON" }) as HTMLTextAreaElement).value;
    expect(exported).toContain("ugs-universe-archive");
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(screen.getByText("尚未保存任何宇宙。")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "导入 JSON" }), { target: { value: exported } });
    await user.click(screen.getByRole("button", { name: "导入 JSON" }));
    expect(await screen.findByText("我的测试宇宙")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("新增 1 条，更新 0 条");
    await user.click(screen.getByRole("button", { name: "恢复" }));
    expect(document.querySelector(".universe-title h2")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Seed" }).getAttribute("value")).toBe("LUX-7F3A-91C2");
  });

  it("文明列表对大样本分页并支持搜索与路径筛选", async () => {
    const user = userEvent.setup();
    render(<App initialPage="civilizations" />);
    expect(document.querySelectorAll(".civilization-select").length).toBeLessThanOrEqual(30);
    expect(screen.getByRole("status").textContent).toContain("每页最多显示 30 个");
    const search = screen.getByRole("textbox", { name: "搜索文明" });
    await user.type(search, "不存在的文明");
    expect(screen.getByText("没有符合当前筛选条件的文明。")).toBeTruthy();
    await user.clear(search);
    const pathFilter = screen.getByRole("combobox", { name: "文明路径" });
    expect((pathFilter as HTMLSelectElement).options.length).toBeGreaterThan(2);
  });

  it("图书馆恢复带干预存档时保持完整分支", async () => {
    const user = userEvent.setup();
    const base = generateUniverse({ seed: "LIBRARY-BRANCH", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    const target = base.galaxies[0].starSystems[0].planets[0];
    const branch = generateUniverse({
      seed: base.seed, rulesetVersion: RULESET_VERSION, templateId: base.templateId,
      interventions: [{ id: "library-branch", miracleType: "bless_planet", targetId: target.id }],
    });
    render(<App initialPage="library" search={branch.shareUrl} />);
    await user.click(screen.getByRole("button", { name: "保存当前宇宙" }));
    const seed = screen.getByRole("textbox", { name: "Seed" });
    await user.clear(seed);
    await user.type(seed, "OTHER-UNIVERSE");
    await user.click(screen.getByRole("button", { name: "创世" }));
    await user.click(screen.getByTitle("本地存档、收藏与恢复"));
    await user.click(screen.getByRole("button", { name: "恢复" }));
    await user.click(screen.getByTitle("造物主干预与奇迹"));
    expect(screen.getByText(/1 次奇迹/)).toBeTruthy();
    expect(screen.getByText(/实体变化：habitability/)).toBeTruthy();
  });

  it("图书馆拒绝损坏导入且保留现有条目", async () => {
    const user = userEvent.setup();
    render(<App initialPage="library" />);
    await user.click(screen.getByRole("button", { name: "保存当前宇宙" }));
    fireEvent.change(screen.getByRole("textbox", { name: "导入 JSON" }), { target: { value: "{" } });
    await user.click(screen.getByRole("button", { name: "导入 JSON" }));
    expect(screen.getByRole("alert").textContent).toContain("无法解析");
    expect(screen.getAllByText(/LUX-7F3A-91C2/).length).toBeGreaterThan(1);
  });

  it("异步导入期间保存的新宇宙不会被旧快照覆盖", async () => {
    const timestamp = "2026-07-13T08:00:00.000Z";
    const importedEntries = Array.from({ length: 5 }, (_, index) => generateUniverse({
      seed: `IMPORT-RACE-${index}`,
      rulesetVersion: RULESET_VERSION,
      templateId: "high_magic",
    })).reduce<UniverseArchiveEntry[]>((entries, universe, index) => saveUniverseEntry(entries, universe, `导入宇宙 ${index}`, timestamp), []);
    render(<App initialPage="library" />);
    fireEvent.change(screen.getByRole("textbox", { name: "导入 JSON" }), { target: { value: serializeArchive(importedEntries, timestamp) } });
    fireEvent.click(screen.getByRole("button", { name: "导入 JSON" }));
    expect(screen.getByRole("button", { name: "正在校验导入" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "保存当前宇宙" }));
    expect(await screen.findByText(/当前共有 6 条/)).toBeTruthy();
    expect(document.querySelectorAll(".library-list article")).toHaveLength(6);
  });

  it("异步导入期间同 ID 收藏会优先于外部导入内容", async () => {
    const timestamp = "2026-07-13T08:00:00.000Z";
    const defaultUniverse = generateUniverse({ seed: "LUX-7F3A-91C2", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    const importedUniverses = [defaultUniverse, ...Array.from({ length: 4 }, (_, index) => generateUniverse({
      seed: `IMPORT-CONFLICT-${index}`,
      rulesetVersion: RULESET_VERSION,
      templateId: "high_magic",
    }))];
    const importedEntries = importedUniverses.reduce<UniverseArchiveEntry[]>((entries, universe, index) => saveUniverseEntry(entries, universe, `外部标题 ${index}`, timestamp), []);
    render(<App initialPage="library" />);
    fireEvent.click(screen.getByRole("button", { name: "保存当前宇宙" }));
    fireEvent.change(screen.getByRole("textbox", { name: "导入 JSON" }), { target: { value: serializeArchive(importedEntries, timestamp) } });
    fireEvent.click(screen.getByRole("button", { name: "导入 JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    expect(await screen.findByText(/保留 1 条导入期间的本地变更/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "取消收藏" })).toBeTruthy();
    expect(screen.getByText(defaultUniverse.name)).toBeTruthy();
  });

  it("本地存储写入失败时保留原状态并显示明确错误", async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("配额不足"); });
    render(<App initialPage="library" />);
    await user.click(screen.getByRole("button", { name: "保存当前宇宙" }));
    expect(screen.getByRole("alert").textContent).toContain("本地图书馆写入失败");
    expect(screen.getByText("尚未保存任何宇宙。")).toBeTruthy();
    write.mockRestore();
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
    const universeName = document.querySelector(".universe-title h2")?.textContent;
    const seedInput = screen.getByRole("textbox", { name: "Seed" });
    await user.clear(seedInput);
    await user.click(screen.getByRole("button", { name: "创世" }));
    expect(screen.getByRole("alert").textContent).toContain("Seed");
    expect(document.querySelector(".universe-title h2")?.textContent).toBe(universeName);

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
