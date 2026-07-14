import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function enterLegacyCompatibility(page: Page): Promise<void> {
  await page.getByTitle("隔离查看步骤 1 静态宇宙").click();
  await expect(page.getByLabel("旧版隔离兼容说明")).toBeVisible();
}

async function tabTo(page: Page, target: Locator, reverse = false): Promise<void> {
  for (let index = 0; index < 80; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press(reverse ? "Shift+Tab" : "Tab");
  }
  throw new Error("键盘 Tab 顺序无法到达目标控件。");
}

test("非法 Seed 会显示错误且修正后可以恢复", async ({ page }) => {
  await page.goto("/");
  const stateIdentity = page.locator(".runtime-summary article").nth(1).locator("small");
  const originalIdentity = await stateIdentity.textContent();
  const seed = page.getByRole("textbox", { name: "Seed" });
  await seed.fill("");
  await page.getByRole("button", { name: "创世" }).click();
  await expect(page.getByRole("alert")).toContainText("Seed");
  await expect(stateIdentity).toHaveText(originalIdentity ?? "");
  await seed.fill("E2E-RECOVER-001");
  await page.getByRole("button", { name: "创世" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("干预分享链接可以在新页面恢复同一分支", async ({ page }) => {
  await page.goto("/");
  await enterLegacyCompatibility(page);
  await page.getByTitle("造物主干预与奇迹").click();
  await page.getByRole("button", { name: "施加奇迹" }).click();
  await expect(page.getByText(/实体变化：habitability/)).toBeVisible();
  await page.getByTitle("宇宙摘要与指标").click();
  const href = await page.getByTitle("打开当前宇宙分享链接").getAttribute("href");
  expect(href).toContain("iv=1");
  await page.goto(href ?? "/");
  await page.getByTitle("造物主干预与奇迹").click();
  await expect(page.getByText(/实体变化：habitability/)).toBeVisible();
});

test("桌面页面通过真实浏览器无障碍扫描", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await enterLegacyCompatibility(page);
  await page.getByTitle("法则、关系与对比").click();
  const lawResults = await new AxeBuilder({ page }).analyze();
  expect(lawResults.violations).toEqual([]);
});

test("运行中宇宙可以推进保存刷新恢复并继续演化", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "运行中宇宙" })).toBeVisible();
  await expect(page.getByText("第 0 步")).toBeVisible();
  await page.getByRole("button", { name: "单步推进" }).click();
  await expect(page.getByText("第 1 步")).toBeVisible();
  await page.getByRole("button", { name: "保存检查点" }).click();
  await expect(page.getByRole("status")).toContainText("第 1 步");

  await page.reload();
  await expect(page.getByText("第 0 步")).toBeVisible();
  await page.getByRole("button", { name: "恢复最近检查点" }).click();
  await expect(page.getByRole("status")).toContainText("已恢复检查点：第 1 步");
  await page.getByRole("button", { name: "单步推进" }).click();
  await expect(page.getByText("第 2 步")).toBeVisible();

  await page.getByRole("slider", { name: "历史浏览位置" }).fill("0");
  await expect(page.getByText("历史浏览位置：0")).toBeVisible();
  await expect(page.getByText("第 2 步")).toBeVisible();
  await page.getByRole("button", { name: "回到当前" }).click();
  await page.getByRole("button", { name: "查看原因与后果" }).first().click();
  await expect(page.getByRole("heading", { name: "运行因果查询" })).toBeVisible();

  const runtimeLocalStorageKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes("runtime")));
  expect(runtimeLocalStorageKeys).toEqual([]);
});

test("运行主流程支持键盘推进调速历史追因保存与恢复", async ({ page }) => {
  await page.goto("/");
  const advance = page.getByRole("button", { name: "单步推进" });
  await tabTo(page, advance);
  await page.keyboard.press("Space");
  await expect(page.getByText("第 1 步")).toBeVisible();

  const speed = page.getByRole("combobox", { name: "运行速度" });
  await tabTo(page, speed);
  await page.keyboard.press("End");
  await expect(speed).toHaveValue("8");

  const save = page.getByRole("button", { name: "保存检查点" });
  await tabTo(page, save);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("已保存检查点：第 1 步");

  await page.reload();
  const restore = page.getByRole("button", { name: "恢复最近检查点" });
  await tabTo(page, restore);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("已恢复检查点：第 1 步");

  const restoredAdvance = page.getByRole("button", { name: "单步推进" });
  await tabTo(page, restoredAdvance, true);
  await page.keyboard.press("Space");
  await expect(page.getByText("第 2 步")).toBeVisible();

  const history = page.getByRole("slider", { name: "历史浏览位置" });
  await tabTo(page, history);
  await page.keyboard.press("Home");
  await expect(page.getByText("历史浏览位置：0")).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByText("历史浏览位置：2")).toBeVisible();

  const trace = page.getByRole("button", { name: "查看原因与后果" }).first();
  await tabTo(page, trace);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "运行因果查询" })).toBeVisible();
  const close = page.getByRole("button", { name: "关闭运行因果查询" });
  await tabTo(page, close);
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "运行因果查询" })).toBeHidden();
  await expect(page.getByText("第 2 步")).toBeVisible();
  await expect(page.getByText("历史浏览位置：2")).toBeVisible();
});

test("因果查询一级入口支持键盘双向追溯并通过无障碍扫描", async ({ page }) => {
  await page.goto("/");
  await enterLegacyCompatibility(page);
  const causalityNavigation = page.getByRole("button", { name: /结果、原因与影响链路/ });
  await causalityNavigation.focus();
  await page.keyboard.press("Enter");
  await expect(causalityNavigation).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "因果查询" })).toBeVisible();

  const causesTab = page.getByRole("tab", { name: "为什么发生" });
  await causesTab.focus();
  await page.keyboard.press("ArrowRight");
  const effectsTab = page.getByRole("tab", { name: "产生了什么后果" });
  await expect(effectsTab).toBeFocused();
  await expect(effectsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("移动视口没有横向溢出且核心导航可操作", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".page-navigation")).toBeVisible();
  const layout = await page.evaluate(() => {
    const navigation = document.querySelector<HTMLElement>(".page-navigation");
    const runtime = document.querySelector<HTMLElement>("[aria-label='运行中宇宙']");
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      navigationHeight: navigation?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY,
      navigationScrollable: Boolean(navigation && navigation.scrollWidth > navigation.clientWidth),
      runtimeTop: runtime?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
    };
  });
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.navigationHeight).toBeLessThan(100);
  expect(layout.navigationScrollable).toBe(false);
  expect(layout.runtimeTop).toBeLessThan(400);
  await enterLegacyCompatibility(page);
  await page.getByTitle("星系、恒星系与行星").click();
  await expect(page.getByRole("heading", { name: "局部探索" })).toBeVisible();
});

test("观察台可以进入星系层并浏览时间", async ({ page }) => {
  await page.goto("/");
  await enterLegacyCompatibility(page);
  await page.getByTitle("二维宇宙投影与时间浏览").click();
  await expect(page.getByRole("heading", { name: "可视化宇宙观察台" })).toBeVisible();
  const svgNode = page.locator(".observation-node").first();
  await svgNode.focus();
  await expect(svgNode.locator(".node-core")).toHaveCSS("stroke-width", "1.8px");
  await page.locator(".observation-node-list button").first().click();
  await expect(page.getByText(/选择节点可进入恒星系层/)).toBeVisible();
  await page.getByRole("button", { name: "下一条" }).click();
  await expect(page.getByText(/时间位置 2/)).toBeVisible();
});

test("观察单项可以用键盘进入闭包追因并返回当前宇宙图", async ({ page }) => {
  await page.goto("/");
  await enterLegacyCompatibility(page);
  await page.getByTitle("二维宇宙投影与时间浏览").click();
  const trace = page.getByRole("button", { name: "查看几何原因" });
  await trace.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /观察几何：/ })).toBeVisible();
  await expect(page.getByText(/投影坐标 x=.*尺寸.*亮度/)).toBeVisible();
  const projectedResults = await new AxeBuilder({ page }).analyze();
  expect(projectedResults.violations).toEqual([]);

  await page.getByTitle("结果、原因与影响链路").click();
  await expect(page.getByRole("heading", { name: /观察几何：/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "因果查询" })).toBeVisible();
});

test("主要旧页面结果可以直接追因并返回原上下文", async ({ page }) => {
  await page.goto("/");
  await enterLegacyCompatibility(page);

  const traceAndReturn = async (selector: string, pageHeading: string) => {
    await page.locator(selector).first().click();
    await expect(page.getByRole("heading", { name: "因果查询" })).toBeVisible();
    await page.getByRole("button", { name: "返回", exact: true }).click();
    await expect(page.getByRole("heading", { name: pageHeading })).toBeVisible();
  };

  await traceAndReturn(".metric-tile .trace", "宇宙指标");

  await page.getByTitle("星系、恒星系与行星").click();
  await traceAndReturn(".space-detail .result-traces .trace", "局部探索");
  await traceAndReturn(".space-detail .detail-metrics .trace", "局部探索");

  await page.getByTitle("时间线与阶段影响").click();
  await traceAndReturn(".event-detail .trace", "纪元时间线");
  await traceAndReturn(".event-detail .detail-columns small .trace", "纪元时间线");

  await page.getByTitle("文明演化与神话").click();
  await traceAndReturn(".civilization-detail > .trace", "文明演化");
  await traceAndReturn(".civilization-detail .detail-metrics .trace", "文明演化");
  await traceAndReturn(".mythology-block .trace", "文明演化");
  await traceAndReturn(".civilization-history .trace", "文明演化");

  await page.getByTitle("法则、关系与对比").click();
  await traceAndReturn(".law-row > .trace", "法则与解释");
  await page.getByTitle("观察记录与终局").click();
  await traceAndReturn(".log-band .trace", "重要事件");

  await page.getByTitle("造物主干预与奇迹").click();
  await page.getByRole("button", { name: "施加奇迹" }).click();
  await traceAndReturn(".intervention-log small .trace", "造物主干预");
  await page.getByRole("combobox", { name: "奇迹类型" }).selectOption("repair_causality");
  await page.getByRole("button", { name: "施加奇迹" }).click();
  await traceAndReturn(".miracle-summary article .trace", "造物主干预");
  await traceAndReturn(".miracle-deltas .trace", "造物主干预");
  await traceAndReturn(".intervention-log article .trace", "造物主干预");
  await page.getByRole("button", { name: "施加奇迹" }).click();
  await page.getByRole("button", { name: "施加奇迹" }).click();
  await traceAndReturn(".backlash-entry .trace", "造物主干预");
});

test("集合数量、事件元数据、指标影响和条件分支都能值级追因", async ({ page }) => {
  await page.goto("/");
  await enterLegacyCompatibility(page);
  const enterAndReturn = async (buttonName: RegExp) => {
    await page.getByRole("button", { name: buttonName }).first().click();
    await expect(page.locator(".causal-node-detail h3")).toBeVisible();
    await page.getByRole("button", { name: "返回", exact: true }).click();
  };

  await enterAndReturn(/追溯.+影响来源原因/);
  await page.getByTitle("星系、恒星系与行星").click();
  await enterAndReturn(/追溯.+恒星系数量原因/);
  const negativeBranch = page.getByRole("button", { name: /追溯.+未形成生物圈原因/ }).first();
  if (await negativeBranch.count()) await enterAndReturn(/追溯.+未形成生物圈原因/);
  await page.getByTitle("时间线与阶段影响").click();
  await enterAndReturn(/追溯.+列表元数据原因/);
});

test("追因返回保留文明筛选分页、空间选择、焦点和滚动上下文", async ({ page }) => {
  await page.goto("/");
  await enterLegacyCompatibility(page);
  await page.getByTitle("文明演化与神话").click();
  const pathFilter = page.getByRole("combobox", { name: "文明路径" });
  const pathValue = await pathFilter.locator("option").nth(1).getAttribute("value");
  await pathFilter.selectOption(pathValue ?? "");
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByText(/第 2 \/ /)).toBeVisible();
  const civilizationTrace = page.locator(".civilization-detail > .trace");
  await civilizationTrace.scrollIntoViewIfNeeded();
  const scrollY = await page.evaluate(() => window.scrollY);
  await civilizationTrace.click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await expect(civilizationTrace).toBeFocused();
  await expect(pathFilter).toHaveValue(pathValue ?? "");
  await expect(page.getByText(/第 2 \/ /)).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);

  await page.getByTitle("星系、恒星系与行星").click();
  const galaxyChoices = page.locator(".space-grid > .space-list:first-child .space-select");
  await galaxyChoices.nth(1).click();
  const systemChoices = page.locator(".space-grid > .space-list:nth-child(2) > div:not(.planet-select-list) .space-select");
  await systemChoices.nth(1).click();
  const planetChoices = page.locator(".planet-select-list .space-select");
  await planetChoices.nth(1).click();
  const selectedPlanetTitle = await page.locator(".space-detail h3").textContent();
  const planetTrace = page.locator(".space-detail .result-traces .trace").last();
  await planetTrace.click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await expect(page.locator(".space-detail .result-traces .trace").last()).toBeFocused();
  await expect(page.locator(".space-detail h3")).toHaveText(selectedPlanetTitle ?? "");

  await page.getByTitle("二维宇宙投影与时间浏览").click();
  const relatedTrace = page.getByRole("button", { name: "查看当前层级事件关联原因" });
  await relatedTrace.focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await relatedTrace.evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByRole("heading", { name: /事件关联：/ })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await expect(relatedTrace).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("Seed 法则对比显式展示公式并通过组合证据追溯独立左右图", async ({ page }) => {
  await page.goto("/");
  await enterLegacyCompatibility(page);
  await page.getByTitle("法则、关系与对比").click();
  await expect(page.getByText(/^右值 - 左值 =/)).toHaveCount(6);
  await expect(page.getByText(/六个候选领域.*max\(abs\(右值 - 左值\)\).*固定顺序/)).toBeVisible();

  const rightTrace = page.getByRole("button", { name: "追溯右值原因：物理" });
  await rightTrace.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "物理法则：右值评分" })).toBeVisible();
  await expect(page.getByText(/组合证据.*校验左右评分与差值/)).toBeVisible();

  await page.getByTitle("法则、关系与对比").click();
  const leftTrace = page.getByRole("button", { name: "追溯左值原因：物理" });
  await leftTrace.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "物理法则：左值评分" })).toBeVisible();
});

test("本地图书馆可以跨刷新保存并恢复宇宙", async ({ page }) => {
  await page.goto("/");
  await enterLegacyCompatibility(page);
  await page.getByTitle("本地存档、收藏与恢复").click();
  await page.getByRole("button", { name: "保存当前宇宙" }).click();
  await expect(page.getByText("当前宇宙已保存。")).toBeVisible();
  await page.reload();
  await enterLegacyCompatibility(page);
  await page.getByTitle("本地存档、收藏与恢复").click();
  await expect(page.locator(".library-list article")).toHaveCount(1);
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(page.locator(".universe-title h2")).toBeVisible();
});

test("360 像素图书馆无溢出并通过真实无障碍扫描", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await enterLegacyCompatibility(page);
  await page.getByTitle("本地存档、收藏与恢复").click();
  await page.getByRole("button", { name: "保存当前宇宙" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("Chromium 可以写入剪贴板", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "剪贴板权限只在 Chromium 项目中验证。");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await enterLegacyCompatibility(page);
  await page.getByRole("button", { name: "复制分享" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("分享码");
});
