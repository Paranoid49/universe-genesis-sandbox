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
  const entityChange = page.getByText(/实体变化：/).first();
  await expect(entityChange).toBeVisible();
  const entityChangeText = await entityChange.textContent();
  await page.getByTitle("宇宙摘要与指标").click();
  const href = await page.getByTitle("打开当前宇宙分享链接").getAttribute("href");
  expect(href).toContain("iv=1");
  await page.goto(href ?? "/");
  await page.getByTitle("造物主干预与奇迹").click();
  await expect(page.getByText(entityChangeText ?? "")).toBeVisible();
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
  await expect(page.getByRole("status")).toContainText("检查点已转为新分支", { timeout: 15_000 });
  await page.getByRole("button", { name: "单步推进" }).click();
  await expect(page.getByText("第 2 步")).toBeVisible();

  await page.getByRole("button", { name: /已发生历史/ }).click();
  await page.getByRole("slider", { name: "历史浏览位置" }).fill("0");
  await expect(page.getByText("历史浏览位置：0")).toBeVisible();
  await page.getByRole("button", { name: /当前宇宙/ }).click();
  await expect(page.getByText("第 2 步")).toBeVisible();
  await page.getByRole("button", { name: /已发生历史/ }).click();
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
  await expect(page.getByRole("status")).toContainText("检查点已转为新分支");

  const restoredAdvance = page.getByRole("button", { name: "单步推进" });
  await tabTo(page, restoredAdvance, true);
  await page.keyboard.press("Space");
  await expect(page.getByText("第 2 步")).toBeVisible();

  const historyNavigation = page.getByRole("button", { name: /已发生历史/ });
  await tabTo(page, historyNavigation, true);
  await page.keyboard.press("Enter");
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
  await expect(page.getByText("历史浏览位置：2")).toBeVisible();
  const currentUniverseNavigation = page.getByRole("button", { name: /当前宇宙/ });
  await tabTo(page, currentUniverseNavigation, true);
  await page.keyboard.press("Enter");
  await expect(page.getByText("第 2 步")).toBeVisible();
});

test("三个宇宙宪法预设分别完成演化观察保存与恢复", async ({ page }) => {
  const presets = [
    { id: "material-expanse@1", heading: "物质广域", metric: "凝聚度" },
    { id: "arcane-weave@1", heading: "奥术织网", metric: "共鸣" },
    { id: "dream-flux@1", heading: "梦流连续体", metric: "连贯性" },
  ];
  for (const preset of presets) {
    await page.goto("/");
    await page.getByRole("combobox", { name: "宪法预设" }).selectOption(preset.id);
    await page.getByRole("button", { name: "创世" }).click();
    await expect(page.getByRole("heading", { name: preset.heading })).toBeVisible();
    await page.getByRole("button", { name: "单步推进" }).click();
    await expect(page.getByText("第 1 步")).toBeVisible();
    await page.getByRole("button", { name: /观察：选择方式并获取证据/ }).click();
    await expect(page.getByRole("region", { name: "宪法动态指标" })).toContainText(preset.metric);
    await page.getByRole("button", { name: "执行观察" }).click();
    await expect(page.getByRole("status")).toContainText("观察记录已保存");
    if (preset.id === "dream-flux@1") {
      await expect(page.getByRole("button", { name: /星系|生命|文明|神话|奇迹/ })).toHaveCount(0);
    }
    await page.getByRole("button", { name: /当前宇宙/ }).click();
    await page.getByRole("button", { name: "保存检查点" }).click();
    await expect(page.getByRole("status")).toContainText("第 1 步");
    await page.reload();
    await page.getByRole("combobox", { name: "宪法预设" }).selectOption(preset.id);
    await page.getByRole("button", { name: "创世" }).click();
    await page.getByRole("button", { name: "恢复最近检查点" }).click();
    await expect(page.getByRole("status")).toContainText("检查点已转为新分支");
    await expect(page.getByText("第 1 步")).toBeVisible();
  }
});

test("潮生世界形成主体后可以观察行动因果并跨刷新恢复继续", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "宪法预设" }).selectOption("living-tide@1");
  await page.getByRole("button", { name: "创世" }).click();
  await expect(page.getByRole("heading", { name: "潮生世界" })).toBeVisible();
  await expect(page.getByRole("button", { name: /自主实体/ })).toHaveCount(0);
  await page.getByRole("button", { name: "单步推进" }).click();
  await page.getByRole("button", { name: "单步推进" }).click();
  await expect(page.getByText("第 2 步")).toBeVisible();

  await page.getByRole("button", { name: /自主实体：行为、关系与公开叙述/ }).click();
  await expect(page.getByRole("heading", { name: "自主实体" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "选择自主实体" }).locator("option")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "自主行为证据" })).toContainText("行动产生后果");
  await expect(page.getByRole("region", { name: "公开叙述" })).toContainText("叙述不等于事实");
  await expect(page.getByRole("region", { name: "神话档案" })).toContainText("档案不等于事实");
  await page.getByRole("button", { name: "查看行动因果" }).first().click();
  await expect(page.getByRole("region", { name: "自主行动因果" })).toBeVisible();
  await expect(page.getByRole("region", { name: "自主行动因果" })).not.toContainText(/rule\.tide|置信度|被感知为|确定性偏差|\bapplied\b/);
  await expect(page.getByRole("heading", { name: "为什么发生" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "已经产生" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "关闭行动因果" }).click();

  await page.getByRole("button", { name: /当前宇宙/ }).click();
  await page.getByRole("button", { name: "保存检查点" }).click();
  await expect(page.getByRole("status")).toContainText("第 2 步");
  await page.reload();
  await page.getByRole("combobox", { name: "宪法预设" }).selectOption("living-tide@1");
  await page.getByRole("button", { name: "创世" }).click();
  await page.getByRole("button", { name: "恢复最近检查点" }).click();
  await expect(page.getByRole("status")).toContainText("检查点已转为新分支", { timeout: 15_000 });
  await expect(page.getByText("第 2 步")).toBeVisible();
  await expect(page.getByRole("button", { name: /自主实体：行为、关系与公开叙述/ })).toBeVisible();
  await page.getByRole("button", { name: "单步推进" }).click();
  await expect(page.getByText("第 3 步")).toBeVisible();
});

test("360 像素下可用纯键盘完成潮生主体、分支、保存恢复与继续闭环", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const preset = page.getByRole("combobox", { name: "宪法预设" });
  await tabTo(page, preset);
  await page.keyboard.press("End");
  await expect(preset).toHaveValue("living-tide@1");
  const createUniverse = page.getByRole("button", { name: "创世" });
  await tabTo(page, createUniverse);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "潮生世界" })).toBeVisible();
  const advance = page.getByRole("button", { name: "单步推进" });
  await tabTo(page, advance);
  await page.keyboard.press("Space");
  await tabTo(page, advance);
  await page.keyboard.press("Enter");
  await expect(page.getByText("第 2 步")).toBeVisible();

  const entitiesNavigation = page.getByRole("button", { name: /自主实体：行为、关系与公开叙述/ });
  await tabTo(page, entitiesNavigation, true);
  await page.keyboard.press("Enter");
  const entitySelect = page.getByRole("combobox", { name: "选择自主实体" });
  await tabTo(page, entitySelect);
  await page.keyboard.press("ArrowDown");
  const causalButton = page.getByRole("button", { name: "查看行动因果" }).last();
  await tabTo(page, causalButton);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "自主行动因果" })).toContainText("内部依据");
  const closeCausal = page.getByRole("button", { name: "关闭行动因果" });
  await tabTo(page, closeCausal);
  await page.keyboard.press("Enter");

  const currentNavigation = page.getByRole("button", { name: /当前宇宙/ });
  await tabTo(page, currentNavigation, true);
  await page.keyboard.press("Enter");
  const experimentNavigation = page.getByRole("button", { name: /实验：界外实验与宇宙内干预/ });
  await tabTo(page, experimentNavigation);
  await page.keyboard.press("Enter");
  const createExperiment = page.getByRole("button", { name: "创建实验分支" });
  await tabTo(page, createExperiment);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("父分支不变");
  const branchesNavigation = page.getByRole("button", { name: /历史分支：切换、比较与保存/ });
  await tabTo(page, branchesNavigation, true);
  await page.keyboard.press("Enter");
  const saveBranch = page.getByRole("button", { name: "保存当前分支" });
  await tabTo(page, saveBranch);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("分支已保存");
  const savedBranchId = await page.getByRole("region", { name: "当前分支身份" }).locator("p").first().textContent();

  await page.reload();
  await tabTo(page, preset);
  await page.keyboard.press("End");
  await tabTo(page, createUniverse);
  await page.keyboard.press("Enter");
  await tabTo(page, branchesNavigation);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "当前分支身份" })).toContainText(savedBranchId ?? "");
  await tabTo(page, currentNavigation, true);
  await page.keyboard.press("Enter");
  const stepLabel = page.getByRole("region", { name: "运行中宇宙" }).locator("article").first().locator("strong");
  const restoredStep = Number((await stepLabel.textContent())?.match(/\d+/)?.[0]);
  expect(Number.isSafeInteger(restoredStep)).toBe(true);
  await tabTo(page, advance);
  await page.keyboard.press("Enter");
  await expect(stepLabel).toHaveText(`第 ${restoredStep + 1} 步`);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("分支实验可以创建、干预、比较、保存、刷新恢复并继续", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "单步推进" }).click();
  await page.getByRole("button", { name: /实验：界外实验与宇宙内干预/ }).click();
  await page.getByRole("spinbutton", { name: "条件变化" }).fill("8");
  await page.getByRole("button", { name: "创建实验分支" }).click();
  await expect(page.getByRole("status")).toContainText("父分支不变");
  await page.getByRole("spinbutton", { name: "干预强度" }).fill("-4");
  await page.getByRole("button", { name: "提交宇宙内干预" }).click();
  await expect(page.getByRole("status")).toContainText("不能清除");
  await expect(page.getByRole("textbox", { name: "创世条件包｜只创建共同起点" })).toHaveValue(/ugs-genesis-package@4/);
  await expect(page.getByRole("textbox", { name: "历史分支包｜恢复共享节点，首次继续时分叉" })).toHaveValue(/ugs-history-branch-package@5/);

  await page.getByRole("button", { name: /历史分支：切换、比较与保存/ }).click();
  const compare = page.getByRole("button", { name: "与当前分支比较" }).filter({ visible: true });
  await compare.first().click();
  await expect(page.getByRole("region", { name: "共同祖先分支比较" })).toBeVisible();
  await page.getByRole("button", { name: "保存当前分支" }).click();
  await expect(page.getByRole("status")).toContainText("分支已保存");
  const savedBranchId = await page.getByRole("region", { name: "当前分支身份" }).locator("p").first().textContent();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.reload();
  await page.getByRole("button", { name: /历史分支：切换、比较与保存/ }).click();
  await expect(page.getByRole("button", { name: "切换到此分支" })).toHaveCount(2);
  await expect(page.getByRole("region", { name: "当前分支身份" })).toContainText(savedBranchId ?? "");
  await page.getByRole("button", { name: /当前宇宙/ }).click();
  await expect(page.getByText("第 3 步")).toBeVisible();
  await page.getByRole("button", { name: "单步推进" }).click();
  await expect(page.getByText("第 4 步")).toBeVisible();
});

test("360 像素下可用纯键盘完成分支与分类型分享核心闭环", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const preset = page.getByRole("combobox", { name: "宪法预设" });
  await tabTo(page, preset);
  await page.keyboard.press("ArrowDown");
  await expect(preset).toHaveValue("arcane-weave@1");
  const createUniverse = page.getByRole("button", { name: "创世" });
  await tabTo(page, createUniverse);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "奥术织网" })).toBeVisible();
  const advanceUniverse = page.getByRole("button", { name: "单步推进" });
  await tabTo(page, advanceUniverse);
  await page.keyboard.press("Space");
  await expect(page.getByText("第 1 步")).toBeVisible();
  const observationNavigation = page.getByRole("button", { name: /观察：选择方式并获取证据/ });
  await tabTo(page, observationNavigation, true);
  await page.keyboard.press("Enter");
  const observe = page.getByRole("button", { name: "执行观察" });
  await tabTo(page, observe);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("观察记录已保存");
  const experimentNavigation = page.getByRole("button", { name: /实验：界外实验与宇宙内干预/ });
  await tabTo(page, experimentNavigation, true);
  await page.keyboard.press("Enter");
  const createExperiment = page.getByRole("button", { name: "创建实验分支" });
  await tabTo(page, createExperiment);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("父分支不变");
  const intervention = page.getByRole("button", { name: "提交宇宙内干预" });
  await tabTo(page, intervention);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("不能清除");

  const branchesNavigation = page.getByRole("button", { name: /历史分支：切换、比较与保存/ });
  await tabTo(page, branchesNavigation, true);
  await page.keyboard.press("Enter");
  const switchBranch = page.locator("button:not([disabled])").filter({ hasText: "切换到此分支" }).first();
  await tabTo(page, switchBranch);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("已切换");
  const compareBranch = page.locator("button:not([disabled])").filter({ hasText: "与当前分支比较" }).first();
  await tabTo(page, compareBranch);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "共同祖先分支比较" })).toBeVisible();
  const saveBranch = page.getByRole("button", { name: "保存当前分支" });
  await tabTo(page, saveBranch, true);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("分支已保存");
  const savedBranchId = await page.getByRole("region", { name: "当前分支身份" }).locator("p").first().textContent();

  await page.reload();
  await tabTo(page, preset);
  await page.keyboard.press("ArrowDown");
  await tabTo(page, createUniverse);
  await page.keyboard.press("Enter");
  await tabTo(page, branchesNavigation);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "当前分支身份" })).toContainText(savedBranchId ?? "");
  await tabTo(page, experimentNavigation, true);
  await page.keyboard.press("Enter");

  const genesis = await page.getByRole("textbox", { name: "创世条件包｜只创建共同起点" }).inputValue();
  const history = await page.getByRole("textbox", { name: "历史分支包｜恢复共享节点，首次继续时分叉" }).inputValue();
  const importBox = page.getByRole("textbox", { name: "导入创世条件包或历史分支包" });
  await tabTo(page, importBox);
  await page.keyboard.insertText(history);
  const importButton = page.getByRole("button", { name: "导入为独立本地分支" });
  await tabTo(page, importButton);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("共享节点已恢复，继续时分叉");

  const currentNavigation = page.getByRole("button", { name: /当前宇宙/ });
  await tabTo(page, currentNavigation, true);
  await page.keyboard.press("Enter");
  const stepLabel = page.getByRole("region", { name: "运行中宇宙" }).locator("article").first().locator("strong");
  const importedStep = Number((await stepLabel.textContent())?.match(/\d+/)?.[0]);
  expect(Number.isSafeInteger(importedStep)).toBe(true);
  const advance = page.getByRole("button", { name: "单步推进" });
  await tabTo(page, advance);
  await page.keyboard.press("Enter");
  await expect(stepLabel).toHaveText(`第 ${importedStep + 1} 步`);

  await tabTo(page, experimentNavigation, true);
  await page.keyboard.press("Enter");
  await tabTo(page, importBox);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.insertText(genesis);
  await tabTo(page, importButton);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("已创建本地创世根分支");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("研究记录绑定当前分支且切换后不会串线", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /观察：选择方式并获取证据/ }).click();
  await page.getByRole("button", { name: "执行观察" }).click();
  await page.getByRole("button", { name: /研究记录：关注、笔记与推测/ }).click();
  await page.getByRole("textbox", { name: /玩家笔记/ }).fill("只属于根分支的研究记录。");
  await page.getByRole("button", { name: "保存笔记" }).click();
  await expect(page.getByText("只属于根分支的研究记录。")).toBeVisible();

  await page.getByRole("button", { name: /实验：界外实验与宇宙内干预/ }).click();
  await page.getByRole("button", { name: "创建实验分支" }).click();
  await page.getByRole("button", { name: /研究记录：关注、笔记与推测/ }).click();
  await expect(page.getByText("只属于根分支的研究记录。")).toHaveCount(0);

  await page.getByRole("button", { name: /历史分支：切换、比较与保存/ }).click();
  await page.getByRole("button", { name: "切换到此分支" }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: /研究记录：关注、笔记与推测/ }).click();
  await expect(page.getByText("只属于根分支的研究记录。")).toBeVisible();
});

test("自由观察与研究记录可以保存刷新并继续", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /观察：选择方式并获取证据/ }).click();
  await expect(page.getByRole("heading", { name: "自由观察台" })).toBeVisible();
  await page.getByRole("button", { name: /结构观测/ }).click();
  await page.getByRole("button", { name: "执行观察" }).click();
  await expect(page.getByRole("heading", { name: "结构观测" })).toBeVisible();
  await page.getByRole("button", { name: "查看证据来源" }).click();
  await expect(page.getByRole("heading", { name: "证据来源" })).toBeVisible();
  await page.getByRole("button", { name: "关闭证据来源" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("textbox", { name: /关注标签/ }).fill("结构,待验证");
  await page.getByRole("button", { name: "加入关注" }).click();
  await expect(page.getByRole("status")).toContainText("已加入关注");

  await page.getByRole("button", { name: /研究记录：关注、笔记与推测/ }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("textbox", { name: /玩家笔记/ }).fill("结构信号已经出现，但仍需继续观察。");
  await page.getByRole("button", { name: "保存笔记" }).click();
  await expect(page.getByRole("status")).toContainText("笔记已保存");
  await page.getByRole("textbox", { name: /玩家推测/ }).fill("凝聚过程可能继续增强。");
  await page.getByRole("button", { name: "保存推测" }).click();
  await expect(page.getByRole("status")).toContainText("玩家观点");

  await page.reload();
  await page.getByRole("button", { name: /研究记录：关注、笔记与推测/ }).click();
  await expect(page.getByText("结构信号已经出现，但仍需继续观察。")).toBeVisible();
  await expect(page.getByText("凝聚过程可能继续增强。")).toBeVisible();
  await expect(page.getByText("结构、待验证")).toBeVisible();
});

test("自由观察与研究记录支持纯键盘纵向闭环", async ({ page }) => {
  await page.goto("/");
  const observeNavigation = page.getByRole("button", { name: /观察：选择方式并获取证据/ });
  await tabTo(page, observeNavigation);
  await page.keyboard.press("Enter");
  const trend = page.getByRole("button", { name: /能量趋势/ });
  await tabTo(page, trend);
  await page.keyboard.press("Space");
  const execute = page.getByRole("button", { name: "执行观察" });
  await tabTo(page, execute);
  await page.keyboard.press("Enter");
  await expect(page.locator(".observation-signal").getByText("证据不足", { exact: true })).toBeVisible();
  const tags = page.getByRole("textbox", { name: /关注标签/ });
  await tabTo(page, tags);
  await page.keyboard.type("趋势,继续观察");
  const focus = page.getByRole("button", { name: "加入关注" });
  await tabTo(page, focus);
  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toContainText("已加入关注");

  const researchNavigation = page.getByRole("button", { name: /研究记录：关注、笔记与推测/ });
  await tabTo(page, researchNavigation, true);
  await page.keyboard.press("Enter");
  const note = page.getByRole("textbox", { name: /玩家笔记/ });
  await tabTo(page, note);
  await page.keyboard.type("当前证据不足也是有效观察结果。");
  const saveNote = page.getByRole("button", { name: "保存笔记" });
  await tabTo(page, saveNote);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("笔记已保存");
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
  expect(layout.runtimeTop).toBeLessThan(700);
  await page.getByRole("button", { name: /观察：选择方式并获取证据/ }).click();
  await expect(page.getByRole("heading", { name: "自由观察台" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: /研究记录：关注、笔记与推测/ }).click();
  await expect(page.getByRole("heading", { name: "研究记录簿" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: /存档：运行检查点与研究记录/ }).click();
  await expect(page.getByRole("heading", { name: "存档" })).toBeVisible();
  await enterLegacyCompatibility(page);
  await page.getByTitle("星系、恒星系与行星").click();
  await expect(page.getByRole("heading", { name: "局部探索" })).toBeVisible();
});

test("研究存储不可用时新主流程显示可访问错误", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined }));
  await page.goto("/");
  await page.getByRole("button", { name: /观察：选择方式并获取证据/ }).click();
  await expect(page.getByRole("alert")).toContainText("不支持 IndexedDB");
});

test("观察筛选、关注和笔记输入反馈在一百毫秒内可见", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium" || (page.viewportSize()?.width ?? 0) < 1000, "界面响应预算使用桌面 Chromium 代表环境执行");
  await page.goto("/");
  await page.getByRole("button", { name: /观察：选择方式并获取证据/ }).click();
  const filterDuration = await page.getByRole("button", { name: "按尺度开始" }).evaluate((button) => new Promise<number>((resolve) => {
    const started = performance.now();
    (button as HTMLButtonElement).click();
    requestAnimationFrame(() => resolve(performance.now() - started));
  }));
  expect(filterDuration).toBeLessThan(100);
  await page.getByRole("button", { name: /结构观测/ }).click();
  await page.getByRole("button", { name: "执行观察" }).click();
  const focusDuration = await page.getByRole("button", { name: "加入关注" }).evaluate((button) => new Promise<number>((resolve, reject) => {
    const started = performance.now();
    const observer = new MutationObserver(() => {
      if (document.querySelector("[role='status']")?.textContent?.includes("已加入关注")) {
        observer.disconnect();
        resolve(performance.now() - started);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    (button as HTMLButtonElement).click();
    setTimeout(() => { observer.disconnect(); reject(new Error("关注反馈超时")); }, 1000);
  }));
  expect(focusDuration).toBeLessThan(100);
  await page.getByRole("button", { name: /研究记录：关注、笔记与推测/ }).click();
  const inputDuration = await page.evaluate(() => new Promise<number>((resolve) => {
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    const started = performance.now();
    textarea.value = "响应预算笔记";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    requestAnimationFrame(() => resolve(performance.now() - started));
  }));
  expect(inputDuration).toBeLessThan(100);
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
  test.slow();
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
