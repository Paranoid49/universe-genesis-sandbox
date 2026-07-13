import { readFileSync, statSync } from "node:fs";
import { dirname, normalize, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { listSourceFiles, pathFromTest } from "./helpers";

describe("架构边界门禁", () => {
  const sourceRoot = pathFromTest(import.meta.url, "../src");
  const files = listSourceFiles(sourceRoot);

  it("模拟核心不依赖 UI、组件、React 或浏览器状态", () => {
    const offenders = files.filter(isSimFile).filter((file) => {
      const sourceFile = parseSourceFile(file);
      const imports = importedModules(sourceFile);
      const hasForbiddenDependency = imports.some((moduleName) => moduleName === "react" || resolvesInto(file, moduleName, ["ui", "components", "App"]));
      const hasBrowserState = descendants(sourceFile).some((node) => ts.isPropertyAccessExpression(node)
        && ts.isIdentifier(node.expression)
        && ["window", "document", "navigator", "localStorage"].includes(node.expression.text));
      return hasForbiddenDependency || hasBrowserState;
    });
    expect(offenders).toEqual([]);
  });

  it("展示组件不直接调用生成器", () => {
    const generatorExports = new Set(["generateUniverse", "generateGalaxies", "generateCivilizations", "applyInterventions"]);
    const offenders = files.filter((file) => file.includes(`${sep}components${sep}`)).filter((file) => {
      const sourceFile = parseSourceFile(file);
      const localGeneratorNames = new Set<string>();
      sourceFile.statements.filter(ts.isImportDeclaration).forEach((declaration) => {
        if (!declaration.importClause || !ts.isStringLiteral(declaration.moduleSpecifier)) return;
        if (!resolvesInto(file, declaration.moduleSpecifier.text, ["sim"])) return;
        const bindings = declaration.importClause.namedBindings;
        if (!bindings || !ts.isNamedImports(bindings)) return;
        bindings.elements.forEach((element) => {
          const exportedName = element.propertyName?.text ?? element.name.text;
          if (generatorExports.has(exportedName)) localGeneratorNames.add(element.name.text);
        });
      });
      return descendants(sourceFile).some((node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && localGeneratorNames.has(node.expression.text));
    });
    expect(offenders).toEqual([]);
  });

  it("UI 和组件依赖保持向上单向流动", () => {
    const offenders = files.filter((file) => file.includes(`${sep}ui${sep}`) || file.includes(`${sep}components${sep}`)).filter((file) => {
      const imports = importedModules(parseSourceFile(file));
      if (file.includes(`${sep}ui${sep}`)) return imports.some((moduleName) => resolvesInto(file, moduleName, ["components", "App"]));
      return imports.some((moduleName) => resolvesInto(file, moduleName, ["App"]));
    });
    expect(offenders).toEqual([]);
  });

  it("模拟核心内部不存在导入循环", () => {
    const simFiles = files.filter(isSimFile);
    const graph = new Map(simFiles.map((file) => [normalize(file), importedModules(parseSourceFile(file))
      .filter((moduleName) => moduleName.startsWith("."))
      .map((moduleName) => resolveModuleFile(file, moduleName, simFiles))
      .filter((target): target is string => Boolean(target))]));
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const active = new Set<string>();
    const stack: string[] = [];
    const visit = (file: string) => {
      if (active.has(file)) {
        const start = stack.indexOf(file);
        cycles.push([...stack.slice(start), file].map((item) => relative(sourceRoot, item)));
        return;
      }
      if (visited.has(file)) return;
      visited.add(file);
      active.add(file);
      stack.push(file);
      graph.get(file)?.forEach(visit);
      stack.pop();
      active.delete(file);
    };
    simFiles.map(normalize).forEach(visit);
    expect(cycles).toEqual([]);
  });

  it("浏览器本地存储只允许由存档适配器访问", () => {
    const offenders = files.filter((file) => {
      const accessesStorage = descendants(parseSourceFile(file)).some((node) => ts.isPropertyAccessExpression(node)
        && ((ts.isIdentifier(node.expression) && node.expression.text === "window" && node.name.text === "localStorage")
          || (ts.isIdentifier(node.expression) && node.expression.text === "localStorage")));
      return accessesStorage && !file.endsWith(`${sep}ui${sep}archiveStorage.ts`);
    });
    expect(offenders).toEqual([]);
  });

  it("关键编排文件保持在约定规模内", () => {
    const limits = new Map([
      ["src/App.tsx", 140],
      ["src/components/AppChrome.tsx", 120],
      ["src/ui/useUniverseAppModel.ts", 230],
      ["src/components/pages/OverviewPage.tsx", 120],
      ["src/components/pages/TimelinePage.tsx", 100],
      ["src/components/pages/LawsPage.tsx", 120],
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
    const styleLimits = new Map([
      ["src/styles.css", 700],
      ["src/styles-simulation.css", 760],
      ["src/styles-features.css", 420],
      ["src/styles-responsive.css", 220],
    ]);
    for (const [relativePath, limit] of styleLimits) {
      const file = pathFromTest(import.meta.url, `../${relativePath}`);
      expect(readFileSync(file, "utf8").split(/\r?\n/).length, `${relativePath} 超过 ${limit} 行，应按功能继续拆分。`).toBeLessThanOrEqual(limit);
    }
  });
});

function parseSourceFile(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function importedModules(sourceFile: ts.SourceFile): string[] {
  return sourceFile.statements.flatMap((statement) => {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      return [statement.moduleSpecifier.text];
    }
    return [];
  });
}

function resolveModuleFile(file: string, moduleName: string, candidates: string[]): string | undefined {
  const base = resolve(dirname(file), moduleName);
  return candidates.map(normalize).find((candidate) => candidate === normalize(base)
    || candidate === normalize(`${base}.ts`)
    || candidate === normalize(`${base}.tsx`)
    || candidate === normalize(resolve(base, "index.ts")));
}

function resolvesInto(file: string, moduleName: string, segments: string[]): boolean {
  if (!moduleName.startsWith(".")) return false;
  const target = normalize(relative(sourceRootPath(), resolve(dirname(file), moduleName)));
  return segments.some((segment) => target === segment || target.startsWith(`${segment}${sep}`) || target.startsWith(`${segment}.`));
}

function sourceRootPath(): string {
  return pathFromTest(import.meta.url, "../src");
}

function isSimFile(file: string): boolean {
  return file.includes(`${sep}sim${sep}`);
}

function descendants(root: ts.Node): ts.Node[] {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    nodes.push(node);
    node.forEachChild(visit);
  };
  root.forEachChild(visit);
  return nodes;
}
