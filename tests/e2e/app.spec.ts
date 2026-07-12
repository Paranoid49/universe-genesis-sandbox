import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("非法 Seed 会显示错误且修正后可以恢复", async ({ page }) => {
  await page.goto("/");
  const heading = page.locator(".universe-title h2");
  const originalName = await heading.textContent();
  const seed = page.getByRole("textbox", { name: "Seed" });
  await seed.fill("");
  await page.getByRole("button", { name: "创世" }).click();
  await expect(page.getByRole("alert")).toContainText("Seed");
  await expect(heading).toHaveText(originalName ?? "");
  await seed.fill("E2E-RECOVER-001");
  await page.getByRole("button", { name: "创世" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("干预分享链接可以在新页面恢复同一分支", async ({ page }) => {
  await page.goto("/");
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
  await page.getByTitle("法则、关系与对比").click();
  const lawResults = await new AxeBuilder({ page }).analyze();
  expect(lawResults.violations).toEqual([]);
});

test("移动视口没有横向溢出且核心导航可操作", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByTitle("星系、恒星系与行星").click();
  await expect(page.getByRole("heading", { name: "局部探索" })).toBeVisible();
});

test("观察台可以进入星系层并浏览时间", async ({ page }) => {
  await page.goto("/");
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

test("本地图书馆可以跨刷新保存并恢复宇宙", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("本地存档、收藏与恢复").click();
  await page.getByRole("button", { name: "保存当前宇宙" }).click();
  await expect(page.getByText("当前宇宙已保存。")).toBeVisible();
  await page.reload();
  await page.getByTitle("本地存档、收藏与恢复").click();
  await expect(page.locator(".library-list article")).toHaveCount(1);
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(page.locator(".universe-title h2")).toBeVisible();
});

test("360 像素图书馆无溢出并通过真实无障碍扫描", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
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
  await page.getByRole("button", { name: "复制分享" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("分享码");
});
