import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listSourceFiles, pathFromTest } from "./helpers";

describe("步骤 5 多本体运行架构边界", () => {
  const sourceRoot = pathFromTest(import.meta.url, "../src");

  it("新主流程只依赖当前动态契约入口", () => {
    const files = [
      "components/RuntimeApplication.tsx",
      "components/ConstitutionCreator.tsx",
      "components/RuntimeSession.tsx",
      "components/pages/RuntimePage.tsx",
      "components/pages/ObservationPage.tsx",
      "components/pages/ExperimentPage.tsx",
      "ui/useRuntimeUniverseModel.ts",
      "ui/useObservationWorkbench.ts",
      "ui/useBranchLaboratory.ts",
    ].map((file) => pathFromTest(import.meta.url, "../src/" + file));
    const forbidden = /UniverseTemplateId|UNIVERSE_TEMPLATES|MiraclePanel|miracleTargets|SpaceExplorer|ObservationConsole|observationProjection|UniverseSummary|timelineImpact|useLawComparisonModel|from ["']\.\.\/sim["']/;
    expect(files.filter((file) => forbidden.test(readFileSync(file, "utf8")))).toEqual([]);
    const currentApi = readFileSync(pathFromTest(import.meta.url, "../src/sim/current.ts"), "utf8");
    expect(currentApi).not.toMatch(/templates|miracles|galaxies|civilizations|UniverseTemplateId|UniverseSummary|timeline-impact|OBSERVATION_METHODS/);
  });

  it("参考预设 ID 只存在于数据目录而不形成专用执行分支", () => {
    const catalog = pathFromTest(import.meta.url, "../src/sim/constitution-catalog.ts");
    const offenders = listSourceFiles(sourceRoot).filter((file) => file !== catalog).filter((file) => /material-expanse@1|arcane-weave@1|dream-flux@1/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("声明式宪法核心不执行动态代码、网络、浏览器 API 或墙上时间", () => {
    const files = [
      "contracts/constitution.ts",
      "constitution-validation.ts",
      "constitution-executor.ts",
      "constitution-catalog.ts",
      "constitution-projections.ts",
      "runtime-state.ts",
      "observation-identity.ts",
    ].map((file) => pathFromTest(import.meta.url, "../src/sim/" + file));
    const forbidden = /\beval\s*\(|\bFunction\s*\(|\bnew\s+Function\b|\bfetch\s*\(|XMLHttpRequest|WebSocket|window\.|document\.|navigator\.|localStorage|sessionStorage|Date\.now|new\s+Date\s*\(|performance\.now|Math\.random/;
    expect(files.filter((file) => forbidden.test(readFileSync(file, "utf8")))).toEqual([]);
  });

  it("旧模板兼容只能通过明确隔离适配器进入物质预设", () => {
    const runtime = readFileSync(pathFromTest(import.meta.url, "../src/sim/runtime-state.ts"), "utf8");
    const legacyRuntime = readFileSync(pathFromTest(import.meta.url, "../src/sim/runtime-state-legacy.ts"), "utf8");
    const runtimeHook = readFileSync(pathFromTest(import.meta.url, "../src/ui/useRuntimeUniverseModel.ts"), "utf8");
    const legacyHook = readFileSync(pathFromTest(import.meta.url, "../src/ui/useLegacyRuntimeUniverseModel.ts"), "utf8");
    expect(runtime).not.toMatch(/UniverseTemplateId|MATERIAL_EXPANSE|templateId/);
    expect(runtimeHook).not.toMatch(/UniverseTemplateId|MATERIAL_EXPANSE|templateId/);
    expect(legacyRuntime).toMatch(/UniverseTemplateId|MATERIAL_EXPANSE/);
    expect(legacyHook).toMatch(/UniverseTemplateId|MATERIAL_EXPANSE/);
  });

  it("步骤 5 关键职责文件保持在冻结后的规模边界内", () => {
    const limits = new Map([
      ["src/sim/current.ts", 55],
      ["src/sim/contracts/constitution.ts", 300],
      ["src/sim/constitution-catalog.ts", 230],
      ["src/sim/constitution-validation.ts", 190],
      ["src/sim/constitution-domain-validation.ts", 160],
      ["src/sim/constitution-executor.ts", 210],
      ["src/components/ConstitutionCreator.tsx", 100],
      ["src/components/RuntimeApplication.tsx", 100],
    ]);
    for (const [file, limit] of limits) {
      const lines = readFileSync(pathFromTest(import.meta.url, "../" + file), "utf8").split(/\r?\n/).length;
      expect(lines, file + " 超过职责规模边界。 ").toBeLessThanOrEqual(limit);
    }
  });
});
