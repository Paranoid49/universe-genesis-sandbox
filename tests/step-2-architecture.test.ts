import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pathFromTest } from "./helpers";

describe("步骤 2 运行时架构边界", () => {
  const sourceRoot = pathFromTest(import.meta.url, "../src/sim");
  const runtimeFiles = [
    "contracts/runtime.ts",
    "runtime-clock.ts",
    "runtime-random.ts",
    "runtime-state.ts",
    "runtime-events.ts",
    "runtime-history.ts",
    "runtime-integrity.ts",
    "runtime-archive.ts",
    "runtime-causality.ts",
  ].map((file) => resolve(sourceRoot, file));

  it("新运行时不依赖旧完整生成、预制时间线或反向影响链", () => {
    const offenders = runtimeFiles.flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return /timelineImpact|summarizeTimelineImpact|generateTimeline|generateUniverse|UniverseSummary/.test(content) ? [file] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("新运行时不读取墙上时间、浏览器随机数或后台计时器", () => {
    const offenders = runtimeFiles.flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return /Date\.now|new Date|Math\.random|setTimeout|setInterval|requestAnimationFrame|localStorage|indexedDB/.test(content) ? [file] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("默认运行产品壳不依赖旧静态生成与旧应用模型", () => {
    const applicationFiles = [
      pathFromTest(import.meta.url, "../src/App.tsx"),
      pathFromTest(import.meta.url, "../src/components/RuntimeApplication.tsx"),
      pathFromTest(import.meta.url, "../src/components/pages/RuntimePage.tsx"),
    ];
    const offenders = applicationFiles.flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return /generateUniverse|generateCausalUniverse|useUniverseAppModel|UniverseSummary|timelineImpact/.test(content) ? [file] : [];
    });
    expect(offenders).toEqual([]);

    const legacyApplication = readFileSync(pathFromTest(import.meta.url, "../src/components/LegacyApplication.tsx"), "utf8");
    expect(legacyApplication).toContain("旧版隔离兼容视图");
    expect(legacyApplication).toContain("不作为运行中宇宙的事实来源");
  });
});
