import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listSourceFiles, pathFromTest } from "./helpers";

describe("架构边界门禁", () => {
  const sourceRoot = pathFromTest(import.meta.url, "../src");
  const files = listSourceFiles(sourceRoot);

  it("模拟核心不依赖 UI、组件、React 或浏览器状态", () => {
    const offenders = files.filter((file) => file.includes(`${pathSeparator()}sim${pathSeparator()}`)).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /from\s+["'][^"']*(?:ui|components)[^"']*["']/.test(source) || /from\s+["']react/.test(source) || /\b(?:window|document|navigator|localStorage)\s*\./.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("展示组件不直接调用生成器", () => {
    const offenders = files.filter((file) => file.includes(`${pathSeparator()}components${pathSeparator()}`)).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /\b(?:generateUniverse|generateGalaxies|generateCivilizations|applyInterventions)\s*\(/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("关键编排文件保持在约定规模内", () => {
    const limits = new Map([
      ["src/App.tsx", 340],
      ["src/components/AppChrome.tsx", 120],
      ["src/ui/useUniverseAppModel.ts", 260],
      ["src/sim/timeline.ts", 320],
      ["src/sim/civilizations.ts", 390],
      ["src/sim/interventions.ts", 410],
      ["src/sim/types.ts", 480],
      ["src/sim/contracts/interventions.ts", 130],
    ]);
    for (const [relativePath, limit] of limits) {
      const file = pathFromTest(import.meta.url, `../${relativePath}`);
      const lines = readFileSync(file, "utf8").split(/\r?\n/).length;
      expect(lines, `${relativePath} 超过 ${limit} 行，应继续拆分职责。`).toBeLessThanOrEqual(limit);
      expect(statSync(file).size).toBeGreaterThan(0);
    }
  });
});

function pathSeparator(): string {
  return process.platform === "win32" ? "\\" : "/";
}
