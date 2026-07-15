import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pathFromTest } from "./helpers";

describe("步骤 4 分支、实验与分享架构边界", () => {
  it("分支核心不依赖 React、浏览器存储或旧产品模型", () => {
    const files = [
      "contracts/branching.ts",
      "branch-inputs.ts",
      "branch-replay.ts",
      "branching.ts",
      "branch-comparison.ts",
      "branch-archive.ts",
      "branch-packages.ts",
    ].map((file) => pathFromTest(import.meta.url, `../src/sim/${file}`));
    const offenders = files.filter((file) => /react|indexedDB|localStorage|UniverseSummary|MiraclePanel|shareCode|useLawComparisonModel/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("新运行主流程只装配正式实验与分支页面", () => {
    const session = readFileSync(pathFromTest(import.meta.url, "../src/components/RuntimeSession.tsx"), "utf8");
    const navigation = readFileSync(pathFromTest(import.meta.url, "../src/components/RuntimeNavigation.tsx"), "utf8");
    expect(session).toContain("ExperimentPage");
    expect(session).toContain("BranchesPage");
    expect(navigation).toContain('"experiment"');
    expect(navigation).toContain('"branches"');
    expect(session).not.toMatch(/MiraclePanel|UniverseLibrary|useShareController|useLawComparisonModel|shareCode|clearInterventions/);
  });

  it("步骤 4 页面和协调层不依赖旧奇迹、单一分享或 Seed 对比", () => {
    const files = [
      "../src/components/pages/ExperimentPage.tsx",
      "../src/components/pages/BranchesPage.tsx",
      "../src/ui/useBranchLaboratory.ts",
      "../src/ui/branchStorage.ts",
    ].map((file) => pathFromTest(import.meta.url, file));
    const offenders = files.filter((file) => /MiraclePanel|miracleTargets|useShareController|shareState|shareCode|useLawComparisonModel|compareUniverses|clearInterventions|localStorage/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("分支存储与研究记录分别使用版本化 IndexedDB 并绑定正式历史身份", () => {
    const branchStorage = readFileSync(pathFromTest(import.meta.url, "../src/ui/branchStorage.ts"), "utf8");
    const branchIndexedDb = readFileSync(pathFromTest(import.meta.url, "../src/ui/branchIndexedDb.ts"), "utf8");
    const research = readFileSync(pathFromTest(import.meta.url, "../src/sim/research-archive.ts"), "utf8");
    const session = readFileSync(pathFromTest(import.meta.url, "../src/components/RuntimeSession.tsx"), "utf8");
    expect(branchStorage).toContain("BRANCH_STORAGE_VERSION");
    expect(branchStorage).toContain("createBrowserBranchStorage");
    expect(branchIndexedDb).toContain("indexedDB");
    expect(branchIndexedDb).not.toContain("localStorage");
    expect(branchStorage).not.toContain("localStorage");
    expect(research).toContain("researchNotebookId");
    expect(session).toContain("laboratory.currentBranch?.branchId");
  });
});
