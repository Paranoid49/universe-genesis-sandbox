import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listSourceFiles, pathFromTest } from "./helpers";

describe("步骤 6 自主实体架构边界", () => {
  const sourceRoot = pathFromTest(import.meta.url, "../src");

  it("当前自主实体主流程不依赖旧生命种子、预制文明或旧文明页面", () => {
    const files = [
      "sim/autonomy.ts",
      "sim/autonomy-validation.ts",
      "sim/runtime-state.ts",
      "sim/runtime-causality.ts",
      "sim/runtime-events.ts",
      "components/RuntimeSession.tsx",
      "components/RuntimeNavigation.tsx",
      "components/pages/AutonomousEntitiesPage.tsx",
    ].map((file) => pathFromTest(import.meta.url, "../src/" + file));
    const forbidden = /civilizationSeed|generateCivilizations|CivilizationPanel|SpaceExplorer|content\/civilizations|recipes\/civilization|UniverseSummary/;
    expect(files.filter((file) => forbidden.test(readFileSync(file, "utf8")))).toEqual([]);
  });

  it("旧文明实现只能从隔离兼容入口到达", () => {
    const currentApi = readFileSync(pathFromTest(import.meta.url, "../src/sim/current.ts"), "utf8");
    const legacyApplication = readFileSync(pathFromTest(import.meta.url, "../src/components/LegacyApplication.tsx"), "utf8");
    expect(currentApi).not.toMatch(/civilizations|content\/civilizations|recipes\/civilization|CivilizationPanel|civilizationSeed/);
    expect(legacyApplication).toContain("CivilizationPanel");
  });

  it("参考主体预设 ID 只存在于宪法目录而不形成专用执行分支", () => {
    const catalogs = new Set([
      pathFromTest(import.meta.url, "../src/sim/constitution-catalog.ts"),
      pathFromTest(import.meta.url, "../src/sim/constitution-autonomy-catalog.ts"),
    ]);
    const offenders = listSourceFiles(sourceRoot).filter((file) => !catalogs.has(file)).filter((file) => /living-tide@1|tide-organism/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("自主实体页面保持条件入口并与私有认知契约分离", () => {
    const session = readFileSync(pathFromTest(import.meta.url, "../src/components/RuntimeSession.tsx"), "utf8");
    const navigation = readFileSync(pathFromTest(import.meta.url, "../src/components/RuntimeNavigation.tsx"), "utf8");
    const page = readFileSync(pathFromTest(import.meta.url, "../src/components/pages/AutonomousEntitiesPage.tsx"), "utf8");
    expect(session).toContain("hasEntities");
    expect(navigation).toContain('id !== "entities" || hasEntities');
    expect(page).not.toMatch(/perceivedValue|memoryIds|believedValue|confidence|sourceStateId/);
  });

  it("步骤 6 关键职责保持在独立文件规模边界内", () => {
    const limits = new Map([
      ["src/sim/contracts/autonomy.ts", 140],
      ["src/sim/autonomy.ts", 340],
      ["src/sim/autonomy-validation.ts", 180],
      ["src/sim/runtime-causality-build.ts", 240],
      ["src/sim/runtime-causality-validation.ts", 100],
      ["src/components/pages/AutonomousEntitiesPage.tsx", 100],
    ]);
    for (const [file, limit] of limits) {
      const lines = readFileSync(pathFromTest(import.meta.url, "../" + file), "utf8").split(/\r?\n/).length;
      expect(lines, file + " 超过职责规模边界。").toBeLessThanOrEqual(limit);
    }
  });
});
