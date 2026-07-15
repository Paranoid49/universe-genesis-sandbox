import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pathFromTest } from "./helpers";

describe("步骤 3 观察与认知边界", () => {
  it("观察核心不依赖 React、浏览器存储或旧完整聚合模型", () => {
    const files = [
      pathFromTest(import.meta.url, "../src/sim/contracts/observation.ts"),
      pathFromTest(import.meta.url, "../src/sim/contracts/research.ts"),
      pathFromTest(import.meta.url, "../src/sim/observation.ts"),
      pathFromTest(import.meta.url, "../src/sim/observation-access.ts"),
      pathFromTest(import.meta.url, "../src/sim/observation-identity.ts"),
      pathFromTest(import.meta.url, "../src/sim/knowledge-questions.ts"),
      pathFromTest(import.meta.url, "../src/sim/research-archive.ts"),
    ];
    const offenders = files.filter((file) => /react|localStorage|indexedDB|UniverseSummary|observationLog|useUniverseAppModel/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("新主流程不装配旧概览、日志、固定空间文明或奇迹页面", () => {
    const runtimeApplication = readFileSync(pathFromTest(import.meta.url, "../src/components/RuntimeApplication.tsx"), "utf8");
    const runtimeSession = readFileSync(pathFromTest(import.meta.url, "../src/components/RuntimeSession.tsx"), "utf8");
    expect(`${runtimeApplication}\n${runtimeSession}`).not.toMatch(/OverviewPage|LogsPage|SpaceExplorer|CivilizationPanel|MiraclePanel|ObservationConsole|UniverseSummary|useUniverseAppModel/);
    expect(runtimeSession).toContain("ObservationPage");
    expect(runtimeSession).toContain("ResearchPage");
  });

  it("新页面与观察工作台不能接收完整运行控制器或 UniverseState", () => {
    const files = [
      pathFromTest(import.meta.url, "../src/components/pages/RuntimePage.tsx"),
      pathFromTest(import.meta.url, "../src/components/pages/ObservationPage.tsx"),
      pathFromTest(import.meta.url, "../src/components/pages/ResearchPage.tsx"),
      pathFromTest(import.meta.url, "../src/components/pages/ArchivePage.tsx"),
      pathFromTest(import.meta.url, "../src/ui/useObservationWorkbench.ts"),
    ];
    const offenders = files.filter((file) => /RuntimeUniverseController|UniverseState|state\.objects|state\.rules|timelineImpact|UniverseSummary|selectors/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("研究记录使用独立版本化存储且不写入 localStorage", () => {
    const storage = readFileSync(pathFromTest(import.meta.url, "../src/ui/researchStorage.ts"), "utf8");
    expect(storage).toContain("RESEARCH_STORAGE_VERSION");
    expect(storage).toContain("indexedDB");
    expect(storage).not.toContain("localStorage");
  });
});
