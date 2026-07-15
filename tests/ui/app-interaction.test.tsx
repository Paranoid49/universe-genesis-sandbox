import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App";
import { AppErrorBoundary } from "../../src/components/AppErrorBoundary";
import { MiraclePanel } from "../../src/components/MiraclePanel";
import { SpaceExplorer } from "../../src/components/SpaceExplorer";
import { buildStateValueCausalProjection, generateUniverse, RULESET_VERSION, stateValueResult, type MiracleType } from "../../src/sim";
import { buildMiracleTargetOptions } from "../../src/ui/miracleTargets";
import { buildObservationProjection } from "../../src/ui/observationProjection";
import { buildSourceLabelMap, summarizeSpace } from "../../src/ui/selectors";
import { useUniverseAppModel, type AppPageId } from "../../src/ui/useUniverseAppModel";
import { saveUniverseEntry, serializeArchive, type UniverseArchiveEntry } from "../../src/ui/archive";
import { resultValueFingerprint } from "../../src/ui/resultValueContract";
import { interactionKindName, metricName, miracleOveruseLevelName, miracleTypeName, polarityName, signed } from "../../src/ui/labels";

describe("应用关键交互", () => {
  beforeEach(() => window.localStorage.clear());
  it("默认主流程只启动运行中宇宙并可隔离进入旧版后返回", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: "运行中宇宙" })).toBeTruthy();
    expect(screen.queryByLabelText("创世总览")).toBeNull();
    expect(screen.queryByRole("button", { name: "复制分享" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "单步推进" }));
    expect(screen.getByText("第 1 步")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /旧版兼容/ }));
    expect(screen.getByLabelText("旧版隔离兼容说明")).toBeTruthy();
    expect(screen.getByLabelText("创世总览")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "返回运行中宇宙" }));
    expect(screen.getByRole("heading", { name: "运行中宇宙" })).toBeTruthy();
    expect(screen.getByText("第 1 步")).toBeTruthy();
    expect(screen.getByText("已暂停")).toBeTruthy();
  }, 30_000);

  it("只有可识别的旧分享查询才进入旧版兼容流程", () => {
    const cases = [
      { search: "", legacy: false },
      { search: "?utm_source=test", legacy: false },
      { search: "?iv=1&i=broken", legacy: false },
      { search: "?s=LEGACY-SEED&t=HS&v=UGS070", legacy: true },
      { search: "?utm_source=test&s=LEGACY-SEED&t=HS&v=UGS070&iv=1&i=broken", legacy: true },
    ];

    for (const entry of cases) {
      const view = render(<App search={entry.search} />);
      expect(Boolean(screen.queryByLabelText("旧版隔离兼容说明"))).toBe(entry.legacy);
      expect(Boolean(screen.queryByRole("heading", { name: "运行中宇宙" }))).toBe(!entry.legacy);
      view.unmount();
    }
  }, 15_000);

  it("可以通过主导航进入星系与文明页面", async () => {
    const user = userEvent.setup();
    render(<App initialPage="overview" />);

    await user.click(screen.getByRole("button", { name: /星系、恒星系与行星/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "局部探索" })).toBeTruthy());
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
  }, 30_000);

  it("可以通过一级入口用键盘完成真实宇宙的双向因果查询", async () => {
    const user = userEvent.setup();
    const { container } = render(<App initialPage="overview" />);
    const causalityNavigation = screen.getByRole("button", { name: /结果、原因与影响链路/ });

    causalityNavigation.focus();
    await user.keyboard("{Enter}");

    expect(causalityNavigation.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { name: "因果查询" })).toBeTruthy();
    expect(screen.getByRole("region", { name: /的因果查询/ })).toBeTruthy();
    expect(container.querySelectorAll(".causal-result-list > button:not(.causal-load-more)").length).toBeGreaterThan(0);

    const activeResult = container.querySelector<HTMLButtonElement>(".causal-result-list > button.active")!;
    const originalHeading = screen.getByRole("heading", { level: 3 }).textContent;
    activeResult.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).not.toBe(activeResult);
    expect(screen.getByRole("heading", { level: 3 }).textContent).not.toBe(originalHeading);

    const causesTab = screen.getByRole("tab", { name: "为什么发生" });
    causesTab.focus();
    await user.keyboard("{ArrowRight}");
    const effectsTab = screen.getByRole("tab", { name: "产生了什么后果" });
    expect(document.activeElement).toBe(effectsTab);
    expect(effectsTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel")).toBeTruthy();
  });

  it("真实宇宙的因果查询入口没有自动化可检测的无障碍违规", async () => {
    const { container } = render(<App initialPage="causality" />);
    const result = await axe(container);
    expect(result.violations).toEqual([]);
  }, 30_000);

  it("主要旧页面的可见结果可以就地追因并返回原页面继续浏览", async () => {
    const user = userEvent.setup();
    const { container } = render(<App initialPage="overview" />);

    async function traceAndReturn(button: HTMLElement, pageHeading: string) {
      await user.click(button);
      expect(screen.getByRole("heading", { name: "因果查询" })).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "返回" }));
      expect(screen.getByRole("heading", { name: pageHeading })).toBeTruthy();
    }

    await traceAndReturn(container.querySelector(".metric-tile .trace")!, "宇宙指标");

    await user.click(screen.getByTitle("时间线与阶段影响"));
    await traceAndReturn(container.querySelector(".event-detail .trace")!, "纪元时间线");

    await user.click(screen.getByTitle("文明演化与神话"));
    await traceAndReturn(container.querySelector(".civilization-detail > .trace")!, "文明演化");
    await traceAndReturn(container.querySelector(".mythology-block .trace")!, "文明演化");
    await traceAndReturn(container.querySelector(".civilization-history .trace")!, "文明演化");

    await user.click(screen.getByTitle("造物主干预与奇迹"));
    await user.selectOptions(screen.getByRole("combobox", { name: "奇迹类型" }), "repair_causality");
    await user.click(screen.getByRole("button", { name: "施加奇迹" }));
    await traceAndReturn(container.querySelector(".miracle-summary article .trace")!, "造物主干预");
    await traceAndReturn(container.querySelector(".miracle-deltas .trace")!, "造物主干预");
    await traceAndReturn(container.querySelector(".intervention-log article .trace")!, "造物主干预");

    await user.click(screen.getByRole("button", { name: "施加奇迹" }));
    await user.click(screen.getByRole("button", { name: "施加奇迹" }));
    await traceAndReturn(container.querySelector(".backlash-entry .trace")!, "造物主干预");
  }, 30_000);

  it("各主要页面登记的追因入口都能唯一定位当前生产图", () => {
    const { result } = renderHook(() => useUniverseAppModel());
    const graph = result.current.universe.causalGraph;
    const pages: Array<{ id: AppPageId; minimum: number }> = [
      { id: "overview", minimum: 18 },
      { id: "space", minimum: 25 },
      { id: "civilizations", minimum: 20 },
      { id: "timeline", minimum: 20 },
      { id: "laws", minimum: 20 },
      { id: "logs", minimum: 6 },
      { id: "miracles", minimum: 10 },
    ];
    for (const page of pages) {
      const view = render(<App initialPage={page.id} />);
      const buttons = [...view.container.querySelectorAll<HTMLElement>("[data-t]")];
      expect(buttons.length, `${page.id} 追因入口数量`).toBeGreaterThanOrEqual(page.minimum);
      for (const button of buttons) {
        const subjectId = button.dataset.t!;
        expect(graph.nodes.filter((node) => node.subjectId === subjectId), `${page.id}/${subjectId}`).toHaveLength(1);
        expect(button.getAttribute("aria-label"), `${page.id}/${subjectId} 可访问名称`).toMatch(/^追溯.+原因$/);
      }
      const stateButtons = [...view.container.querySelectorAll<HTMLElement>("[data-p]")];
      for (const button of stateButtons) {
        const subjectId = button.dataset.p!;
        expect(buildStateValueCausalProjection(result.current.universe, subjectId).subjectId).toBe(subjectId);
        expect(button.getAttribute("aria-label"), `${page.id}/${subjectId} 状态值可访问名称`).toMatch(/^追溯.+原因$/);
      }
      for (const resultElement of view.container.querySelectorAll<HTMLElement>("[data-result-subject]")) {
        const subjectId = resultElement.dataset.resultSubject!;
        const strategy = resultElement.dataset.resultStrategy ?? (resultElement.classList.contains("attribute-bar") ? "state" : "cause");
        expect(strategy, `${page.id}/${subjectId} 缺少追因策略`).toMatch(/^(cause|state)$/);
        const resultContext = resultElement.closest("article, .space-choice, .civilization-choice, .space-list, .space-detail, .civilization-detail") ?? resultElement;
        expect(resultElement.querySelector(`[data-p="${subjectId}"], [data-t="${subjectId}"]`)
          ?? resultContext.querySelector(`[data-p="${subjectId}"], [data-t="${subjectId}"]`), `${page.id}/${subjectId} 可见结果缺少追因入口`).toBeTruthy();
        expect(resultElement.dataset.resultValue, `${page.id}/${subjectId} 缺少原始值指纹`).toBeDefined();
        expect(resultElement.dataset.resultValue, `${page.id}/${subjectId} 不得登记 undefined`).not.toBe("undefined");
        if (strategy === "state") {
          expect(resultElement.dataset.resultValue, `${page.id}/${subjectId} 状态值与生产事实不一致`)
            .toBe(resultValueFingerprint(stateValueResult(result.current.universe, subjectId)));
        }
      }
      const resultSubjects = new Set([...view.container.querySelectorAll<HTMLElement>("[data-result-subject]")].map((element) => element.dataset.resultSubject));
      const resultValues = new Map<string, Set<string>>();
      for (const element of view.container.querySelectorAll<HTMLElement>("[data-result-subject]")) {
        const values = resultValues.get(element.dataset.resultSubject!) ?? new Set<string>();
        values.add(element.dataset.resultValue!);
        resultValues.set(element.dataset.resultSubject!, values);
      }
      const expectValue = (subjectId: string, value: unknown) => expect(resultValues.get(subjectId), `${page.id}/${subjectId} 缺少生产值指纹`)
        .toContain(resultValueFingerprint(value));
      if (page.id === "overview") {
        Object.keys(result.current.universe.metrics).forEach((key) => expect(resultSubjects.has(`metric.${key}`), `概览缺少指标 ${key} 的结果契约`).toBe(true));
        ["space.stats.galaxies", "space.stats.planets", "civilization.stats.total", "civilization.stats.paths", "civilization.stats.mythologies", "civilization.stats.highRisk"]
          .forEach((subject) => expect(resultSubjects.has(subject), `概览缺少 ${subject} 的结果契约`).toBe(true));
        expectValue("universe.name", result.current.universe.name);
        expectValue("universe.description", result.current.universe.description);
        expectValue("input.seed", result.current.universe.seed);
        expectValue("share.code", result.current.universe.shareCode);
        expectValue("share.url", result.current.universe.shareUrl);
      }
      if (page.id === "space") {
        result.current.universe.galaxies.forEach((galaxy) => {
          expect(resultSubjects.has(`${galaxy.id}.starSystems.count`), `星系 ${galaxy.id} 缺少成员数量结果契约`).toBe(true);
          expectValue(galaxy.id, galaxy.name);
        });
        result.current.selectedGalaxy?.starSystems.forEach((system) => expectValue(system.id, system.name));
        result.current.selectedSystem?.planets.forEach((planet) => expectValue(planet.id, planet.name));
      }
      if (page.id === "timeline") {
        expect(resultSubjects.has(result.current.selectedEvent.id), "时间线缺少事件元数据结果契约").toBe(true);
        result.current.selectedEvent.effects.forEach((_effect, index) => expect(resultSubjects.has(`${result.current.selectedEvent.id}.effect.${index + 1}`), "时间线缺少效果结果契约").toBe(true));
      }
      if (page.id === "civilizations" && result.current.selectedCivilization) {
        ["speciesType", "path", "fate", "technologyLevel", "magicLevel", "faithIntensity", "expansionDrive", "stability", "extinctionRisk"]
          .forEach((field) => expect(resultSubjects.has(`${result.current.selectedCivilization!.id}.${field}`), `文明字段 ${field} 缺少结果契约`).toBe(true));
        result.current.universe.civilizations.filter((civilization) => resultValues.has(civilization.id))
          .forEach((civilization) => expectValue(civilization.id, civilization.name));
        expectValue(result.current.selectedCivilization.originGalaxyId, result.current.selectedCivilization.originGalaxyName);
        expectValue(result.current.selectedCivilization.originStarSystemId, result.current.selectedCivilization.originStarSystemName);
        expectValue(result.current.selectedCivilization.originPlanetId, result.current.selectedCivilization.originPlanetName);
      }
      if (page.id === "laws") {
        const visibleText = (subjectId: string) => view.container.querySelector<HTMLElement>(`[data-result-subject="${subjectId}"] > span`)?.textContent;
        const sourceLabels = buildSourceLabelMap(result.current.universe);
        Object.values(result.current.universe.laws).forEach((law) => {
          ["title", "rating.label", "rating.explanation", "traits", "cost"].forEach((field) => expect(resultSubjects.has(`${law.id}.${field}`), `法则领域字段 ${law.id}.${field} 缺少结果契约`).toBe(true));
          expect(visibleText(`${law.id}.title`)).toBe(law.title);
          expect(visibleText(`${law.id}.rating.label`)).toBe(law.rating.label);
          expect(visibleText(`${law.id}.rating.explanation`)).toBe(law.rating.explanation);
          expect(visibleText(`${law.id}.traits`)).toBe(law.traits.join(""));
          expect(visibleText(`${law.id}.cost`)).toBe(law.cost);
          law.rules.forEach((rule) => {
            ["name", "value", "label", "polarity", "explanation", "effectTargets"]
              .forEach((field) => expect(resultSubjects.has(`${rule.id}.${field}`), `规则字段 ${rule.id}.${field} 缺少结果契约`).toBe(true));
            expect(visibleText(`${rule.id}.name`)).toBe(rule.name);
            expect(visibleText(`${rule.id}.value`)).toBe(String(rule.value));
            expect(visibleText(`${rule.id}.label`)).toBe(rule.label);
            expect(visibleText(`${rule.id}.polarity`)).toBe(polarityName(rule.polarity));
            expect(visibleText(`${rule.id}.explanation`)).toBe(rule.explanation);
            expect(visibleText(`${rule.id}.effectTargets`)).toBe(rule.effectTargets.map(metricName).join(""));
          });
        });
        result.current.universe.lawInteractions.forEach((interaction) => {
          ["kind", "impact", "sourceLawId", "targetLawId", "explanation"]
            .forEach((field) => expect(resultSubjects.has(`${interaction.id}.${field}`), `法则关系字段 ${interaction.id}.${field} 缺少结果契约`).toBe(true));
          expect(visibleText(`${interaction.id}.kind`)).toBe(interactionKindName(interaction.kind));
          expect(visibleText(`${interaction.id}.impact`)).toBe(signed(interaction.impact));
          expect(visibleText(`${interaction.id}.sourceLawId`)).toBe(sourceLabels.get(interaction.sourceLawId));
          expect(visibleText(`${interaction.id}.targetLawId`)).toBe(sourceLabels.get(interaction.targetLawId));
          expect(visibleText(`${interaction.id}.explanation`)).toBe(interaction.explanation);
        });
      }
      if (page.id === "logs") {
        const expectLogText = (subjectId: string, item: string) => {
          expect(resultSubjects.has(subjectId)).toBe(true);
          expect(view.container.querySelector<HTMLElement>(`[data-result-subject="${subjectId}"] > span`)?.textContent).toBe(item);
        };
        result.current.universe.observationLog.importantEvents.forEach((item, index) => expectLogText(`observation.important.${index + 1}`, item));
        result.current.universe.observationLog.rareFindings.forEach((item, index) => expectLogText(`observation.rare.${index + 1}`, item));
        result.current.universe.observationLog.possibleEndings.forEach((item, index) => expectLogText(`observation.ending.${index + 1}`, item));
      }
      if (page.id === "miracles") {
        expect(resultSubjects.has("miracle-state")).toBe(true);
        expect(resultSubjects.has("miracle-state.overuseLevel")).toBe(true);
        Object.keys(result.current.universe.miracleState.metricDeltas)
          .forEach((metricId) => expect(resultSubjects.has(`miracle-state.metric-delta.${metricId}`)).toBe(true));
      }
      view.unmount();
    }
  }, 30_000);

  it("已施加干预的概率、指标和日志字段完整登记真实值", () => {
    const { result } = renderHook(() => useUniverseAppModel());
    act(() => result.current.applySelectedMiracle());
    const view = render(<MiraclePanel
      universe={result.current.universe}
      targetOptions={result.current.miracleTargetOptions}
      selectedMiracleType={result.current.selectedMiracleType}
      selectedTargetId={result.current.selectedMiracleTargetId}
      onSelectMiracleType={result.current.setSelectedMiracleType}
      onSelectTarget={result.current.setSelectedMiracleTargetId}
      onApplyMiracle={result.current.applySelectedMiracle}
      onClearInterventions={result.current.clearInterventions}
    />);
    const subjects = new Set([...view.container.querySelectorAll<HTMLElement>("[data-result-subject]")].map((element) => element.dataset.resultSubject));
    const visibleText = (subjectId: string) => view.container.querySelector<HTMLElement>(`[data-result-subject="${subjectId}"] > span`)?.textContent;
    const miracle = result.current.universe.miracleState.appliedMiracles[0];
    const log = result.current.universe.miracleState.interventionLog[0];
    expect(subjects.has(`${miracle.id}.type`)).toBe(true);
    expect(visibleText("miracle-state.overuseLevel")).toBe(miracleOveruseLevelName(result.current.universe.miracleState.overuseLevel));
    expect(visibleText(`${miracle.id}.type`)).toBe(miracleTypeName(miracle.type));
    miracle.probabilityShifts.forEach((shift, index) => {
      const owner = `${miracle.id}.probability-shift.${shift.eventType}.${index + 1}`;
      ["eventType", "delta", "explanation"].forEach((field) =>
        expect(subjects.has(`${owner}.${field}`), `概率字段 ${field} 缺少结果契约`).toBe(true));
      expect(visibleText(`${owner}.eventType`)).toBe(shift.eventType);
      expect(visibleText(`${owner}.delta`)).toBe(signed(shift.delta));
      expect(visibleText(`${owner}.explanation`)).toBe(shift.explanation);
    });
    ["ageLabel", "miracleType", "targetLabel", "directResult", "longTermConsequence"].forEach((field) =>
      expect(subjects.has(`${log.id}.${field}`), `干预日志字段 ${field} 缺少结果契约`).toBe(true));
    expect(visibleText(`${log.id}.ageLabel`)).toBe(log.ageLabel);
    expect(visibleText(`${log.id}.miracleType`)).toBe(miracleTypeName(log.miracleType));
    expect(visibleText(`${log.id}.targetLabel`)).toBe(log.targetLabel);
    expect(visibleText(`${log.id}.directResult`)).toBe(log.directResult);
    expect(visibleText(`${log.id}.longTermConsequence`)).toBe(log.longTermConsequence);
    Object.entries(result.current.universe.miracleState.metricDeltas).forEach(([metricId, delta]) =>
      expect(visibleText(`miracle-state.metric-delta.${metricId}`)).toBe(signed(delta)));
    miracle.targetMutations.forEach((mutation) => {
      const subjectId = `${miracle.id}.mutation.${mutation.targetKind}.${mutation.targetId}.${mutation.field}`;
      expect(subjects.has(subjectId)).toBe(true);
      expect(visibleText(subjectId)).toBe(`实体变化：${mutation.field} 从 ${String(mutation.before ?? "无")} 变为 ${String(mutation.after ?? "无")}，${mutation.explanation}`);
    });
    for (const element of view.container.querySelectorAll<HTMLElement>('[data-result-strategy="state"]')) {
      expect(element.dataset.resultValue).toBe(resultValueFingerprint(stateValueResult(result.current.universe, element.dataset.resultSubject!)));
    }
    view.unmount();
  }, 30_000);

  it("追因返回会保留文明筛选分页、选中结果和焦点上下文", async () => {
    const user = userEvent.setup();
    render(<App initialPage="civilizations" />);
    const search = screen.getByRole("textbox", { name: "搜索文明" });
    const pathFilter = screen.getByRole("combobox", { name: "文明路径" });
    const selectedName = screen.getByRole("heading", { level: 3 }).textContent!;
    await user.type(search, selectedName.slice(0, 2));
    await user.selectOptions(pathFilter, (pathFilter as HTMLSelectElement).options[1].value);
    await user.clear(search);
    const nextPage = screen.getByRole("button", { name: "下一页" });
    await user.click(nextPage);
    const pageLabel = screen.getByText(/第 2 \/ /).textContent;
    const trace = document.querySelector<HTMLButtonElement>(".civilization-detail > .trace")!;
    await user.click(trace);
    await user.click(screen.getByRole("button", { name: "返回" }));
    await waitFor(() => expect(document.activeElement).toBe(trace));
    expect((pathFilter as HTMLSelectElement).value).not.toBe("all");
    expect(screen.getByText(pageLabel!)).toBeTruthy();
    expect(screen.getByRole("heading", { name: selectedName })).toBeTruthy();
  }, 30_000);

  it("字段级可见结果按需建立闭包投影并恢复触发焦点", async () => {
    const user = userEvent.setup();
    render(<App initialPage="space" />);
    const trace = screen.getByRole("button", { name: "追溯宜居性原因" });
    await user.click(trace);
    expect(screen.getByRole("heading", { name: /：宜居性/ })).toBeTruthy();
    expect(screen.getByText(/宜居性当前值为/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "返回" }));
    await waitFor(() => expect(document.activeElement).toBe(trace));
  }, 30_000);

  it("概览快捷入口可以进入星系和文明页面", async () => {
    const user = userEvent.setup();
    render(<App initialPage="overview" />);
    await user.click(screen.getByRole("button", { name: "探索星系" }));
    expect(screen.getByRole("heading", { name: "局部探索" })).toBeTruthy();
    await user.click(screen.getByTitle("宇宙摘要与指标"));
    await user.click(screen.getByRole("button", { name: "查看文明" }));
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

  it("空间详情中的生命与文明负事实可以直接进入因果追溯", async () => {
    const user = userEvent.setup();
    const universe = generateUniverse({ seed: "SPACE-NEGATIVE-FACTS", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    const planets = universe.galaxies.flatMap((galaxy) => galaxy.starSystems.flatMap((system) => system.planets.map((planet) => ({ galaxy, system, planet }))));
    const candidate = planets.find(({ planet }) => planet.biosphere && !planet.biosphere.civilizationSeed)
      ?? planets.find(({ planet }) => !planet.biosphere)!;
    const onTraceCausalSubject = vi.fn();
    const host = (explorer: React.ReactNode) => <div onClick={(event) => {
      const subjectId = (event.target as Element).closest<HTMLElement>("[data-t]")?.dataset.t;
      if (subjectId) onTraceCausalSubject(subjectId);
    }}>{explorer}</div>;
    render(host(<SpaceExplorer
      universe={universe}
      stats={summarizeSpace(universe)}
      selectedGalaxy={candidate.galaxy}
      selectedSystem={candidate.system}
      selectedPlanet={candidate.planet}
      sourceLabelById={buildSourceLabelMap(universe)}
      onSelectGalaxy={vi.fn()}
      onSelectSystem={vi.fn()}
      onSelectPlanet={vi.fn()}
    />));
    await user.click(screen.getByRole("button", { name: /追溯未形成.*原因/ }));
    expect(onTraceCausalSubject).toHaveBeenCalledWith(candidate.planet.biosphere
      ? `${candidate.planet.id}.civilization-seed.absent`
      : `${candidate.planet.id}.biosphere.absent`);

    const noBiosphere = planets.find(({ planet }) => !planet.biosphere);
    if (noBiosphere && candidate.planet.biosphere) {
      onTraceCausalSubject.mockClear();
      render(host(<SpaceExplorer
        universe={universe}
        stats={summarizeSpace(universe)}
        selectedGalaxy={noBiosphere.galaxy}
        selectedSystem={noBiosphere.system}
        selectedPlanet={noBiosphere.planet}
        sourceLabelById={buildSourceLabelMap(universe)}
        onSelectGalaxy={vi.fn()}
        onSelectSystem={vi.fn()}
        onSelectPlanet={vi.fn()}
      />));
      await user.click(screen.getAllByRole("button", { name: /追溯未形成.*原因/ }).at(-1)!);
      expect(onTraceCausalSubject).toHaveBeenCalledWith(`${noBiosphere.planet.id}.biosphere.absent`);
    }
  });

  it("应用模型可以按主题打开负事实，未知或不唯一主题明确报错", () => {
    const { result } = renderHook(() => useUniverseAppModel({ initialPage: "space" }));
    const negative = result.current.universe.causalGraph.nodes.find((node) => node.kind === "negative_fact")!;
    act(() => result.current.openCausalSubject(negative.subjectId));
    expect(result.current.activePage).toBe("causality");
    expect(result.current.causalView.initialNodeId).toBe(negative.id);
    act(() => result.current.setActivePage("space"));
    act(() => result.current.openCausalSubject("missing.subject"));
    expect(result.current.activePage).toBe("space");
    expect(result.current.traceError).toContain("missing.subject");
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
    fireEvent.keyDown(svgNode, { key: "Enter" });
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
    expect((screen.getByRole("textbox", { name: "Seed" }) as HTMLInputElement).value).toBe("LUX-7F3A-91C2");
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
  }, 10_000);

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

    await user.click(screen.getByRole("button", { name: "清除干预" }));
    expect(screen.getByText("当前宇宙处于观察者模式，没有干预日志。")).toBeTruthy();
  });

  it("空 Seed 会显示错误并保留当前宇宙，修正后可以继续创世", async () => {
    const user = userEvent.setup();
    render(<App initialPage="overview" />);
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
    render(<App initialPage="overview" />);
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
    render(<App initialPage="overview" />);
    await user.click(screen.getByRole("button", { name: "复制分享" }));
    expect(await screen.findByRole("button", { name: "已复制" })).toBeTruthy();
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain("http://localhost");
  });

  it("剪贴板不可用时打开手动复制框", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("");
    render(<App initialPage="overview" />);
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

  it("键盘可以依次聚焦 Seed、宪法预设和创世操作", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Seed" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "宪法预设" }));
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
