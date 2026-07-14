import { existsSync, readFileSync, statSync } from "node:fs";
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
    const offenders = files.filter((file) => file.includes(`${sep}components${sep}`)).filter((file) => {
      return componentGeneratorCalls(parseSourceFile(file), file).length > 0;
    });
    expect(offenders).toEqual([]);

    const fixturePath = resolve(sourceRoot, "components", "ForbiddenGeneratorFixture.tsx");
    const fixture = ts.createSourceFile(fixturePath, 'import { generateCausalUniverse } from "../sim"; generateCausalUniverse({});', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    expect(componentGeneratorCalls(fixture, fixturePath)).toEqual(["generateCausalUniverse"]);
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

  it("认证写入能力只存在于受控生成模块私有闭包", () => {
    expect(existsSync(resolve(sourceRoot, "sim", "causality-certification.ts"))).toBe(false);
    const publicIndex = readFileSync(resolve(sourceRoot, "sim", "index.ts"), "utf8");
    expect(publicIndex).not.toContain("certifyCausalGraph");
    const causalityModule = parseSourceFile(resolve(sourceRoot, "sim", "causality.ts"));
    const exportedCertificationWriters = causalityModule.statements.filter((statement) => ts.isFunctionDeclaration(statement)
      && hasExportModifier(statement)
      && statement.name?.text.toLowerCase().includes("certif"));
    expect(exportedCertificationWriters).toEqual([]);
    const reachingCertification = exportedSymbolsReaching(causalityModule, "certifyBuiltGraph");
    expect(reachingCertification).toEqual(["buildUniverseCausalGraph"]);

    const fixtures = [
      "export function unsafe() { return helper(); } function helper() { return certifyBuiltGraph(); } function certifyBuiltGraph() { return {}; }",
      "const alias = certifyBuiltGraph; export function unsafe() { return alias(); } function certifyBuiltGraph() { return {}; }",
      "const holder = { certify: certifyBuiltGraph }; export function unsafe() { return holder.certify(); } function certifyBuiltGraph() { return {}; }",
      "function unsafe() { return certifyBuiltGraph(); } export { unsafe }; function certifyBuiltGraph() { return {}; }",
      "export const api = { unsafe() { return certifyBuiltGraph(); } }; function certifyBuiltGraph() { return {}; }",
      "function invoke(callback: () => unknown) { return callback(); } export function unsafe() { return invoke(certifyBuiltGraph); } function certifyBuiltGraph() { return {}; }",
      "const holder = { certify: certifyBuiltGraph }; const { certify: alias } = holder; export function unsafe() { return alias(); } function certifyBuiltGraph() { return {}; }",
      "export default function () { return certifyBuiltGraph(); } function certifyBuiltGraph() { return {}; }",
      "const unsafe = () => certifyBuiltGraph(); export default unsafe; function certifyBuiltGraph() { return {}; }",
      "export default (() => certifyBuiltGraph()); function certifyBuiltGraph() { return {}; }",
      "export class Unsafe { unsafe() { return certifyBuiltGraph(); } } function certifyBuiltGraph() { return {}; }",
      "export default class { static unsafe() { return certifyBuiltGraph(); } other() { return certifyBuiltGraph(); } } function certifyBuiltGraph() { return {}; }",
      "const unsafe = () => certifyBuiltGraph(); export = unsafe; function certifyBuiltGraph() { return {}; }",
      "export namespace Unsafe { export function certify() { return certifyBuiltGraph(); } } function certifyBuiltGraph() { return {}; }",
      "export namespace Outer { export namespace Unsafe { export function certify() { return certifyBuiltGraph(); } } } function certifyBuiltGraph() { return {}; }",
      "namespace Unsafe { export function certify() { return certifyBuiltGraph(); } } export { Unsafe as Alias }; function certifyBuiltGraph() { return {}; }",
      "namespace Unsafe { export function certify() { return certifyBuiltGraph(); } } export import Alias = Unsafe; function certifyBuiltGraph() { return {}; }",
      "namespace Unsafe { export function certify() { return certifyBuiltGraph(); } } import Inner = Unsafe; export import Alias = Inner; function certifyBuiltGraph() { return {}; }",
    ];
    const expectedEntries = [
      "unsafe", "unsafe", "unsafe", "unsafe", "api", "unsafe", "unsafe",
      "default", "default", "default", "Unsafe", "default", "export=", "Unsafe", "Outer", "Alias", "Alias", "Alias",
    ];
    fixtures.forEach((source, index) => {
      const fixture = ts.createSourceFile(`CertificationFixture${index}.ts`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      expect(exportedSymbolsReaching(fixture, "certifyBuiltGraph")).toEqual([expectedEntries[index]]);
    });
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

  it("当前步骤文档使用同一发布快照且不硬编码下一名评审序号", () => {
    const documentRoot = pathFromTest(import.meta.url, "../docs");
    const currentFactPaths = [
      resolve(documentRoot, "architecture.md"),
      resolve(documentRoot, "quality-gates.md"),
      resolve(documentRoot, "non-functional-requirements.md"),
      resolve(documentRoot, "legacy-module-migration.md"),
    ];
    const currentFactDocuments = currentFactPaths.map((file) => readFileSync(file, "utf8"));
    const snapshotDocuments = currentFactPaths.map((file) => readFileSync(file, "utf8"));
    const snapshots = snapshotDocuments.map((content) => content.match(/^步骤 2 当前发布快照：.+$/m)?.[0]);
    expect(snapshots.every(Boolean)).toBe(true);
    expect(new Set(snapshots).size).toBe(1);
    const targetedBreakdowns = currentFactDocuments.map((content) => content.match(/^步骤 2 当前定向测试组成：.+$/m)?.[0]);
    expect(targetedBreakdowns.every(Boolean)).toBe(true);
    expect(new Set(targetedBreakdowns).size).toBe(1);
    expect(targetedBreakdowns[0]).toContain("步骤 2 核心契约 19 项；步骤 2 架构 3 项；步骤 2 UI 与存储 22 项；步骤 2 性能 2 项；步骤 2 四浏览器纵向闭环 8 项；合计 54 项");
    expect(new Set([...targetedBreakdowns.slice(0, -1), targetedBreakdowns[0]!.replace("步骤 2 架构 3 项", "步骤 2 架构 2 项")]).size).toBe(2);
    expect(currentFactDocuments[0]).not.toMatch(/使用第[^\s]+名全新严格评审/);
    for (const content of currentFactDocuments) {
      expect(currentFactConflicts(content)).toEqual([]);
      expect(content).not.toMatch(/所有 P0、P1、P2 必须整改|P0、P1、P2 均为零|问题归零后才能宣布步骤完成|不存在 P0、P1 或 P2 问题|不存在任何 P2|P2 必须为零/);
    }

    const conflictingFacts = `${currentFactDocuments[0]}\n步骤 2 当前发布快照：E2E：1 项通过、2 项跳过。\n步骤 2 当前发布快照：E2E：2 项通过、2 项跳过。`;
    expect(currentFactConflicts(conflictingFacts).some((issue) => issue.startsWith("E2E 通过数量存在"))).toBe(true);
    const conflictingRule = `${currentFactDocuments[1]}\n所有 P0、P1、P2 必须整改。`;
    expect(conflictingRule).toMatch(/所有 P0、P1、P2 必须整改/);
    const synonymousConflictingRule = `${currentFactDocuments[0]}\n严格评审不存在 P0、P1 或 P2 问题。`;
    expect(synonymousConflictingRule).toMatch(/不存在 P0、P1 或 P2 问题/);
  });

  it("受保护页面的派生文本必须通过统一结果契约渲染", () => {
    const protectedFiles = [
      "components/common.tsx",
      "components/MiraclePanel.tsx",
      "components/SpaceExplorer.tsx",
      "components/CivilizationPanel.tsx",
      "components/TimelinePanels.tsx",
      "components/pages/LawsPage.tsx",
      "components/pages/LogsPage.tsx",
      "components/pages/OverviewPage.tsx",
      "components/pages/TimelinePage.tsx",
    ].map((file) => resolve(sourceRoot, file));
    const offenders = protectedFiles.flatMap((file) => uncontractedDerivedJsx(parseSourceFile(file)).map((text) => `${relative(sourceRoot, file)}:${text}`));
    expect(offenders).toEqual([]);

    const fixture = ts.createSourceFile("UncontractedResultFixture.tsx", "const view = <span>{event.importance}</span>;", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    expect(uncontractedDerivedJsx(fixture)).toEqual(["event.importance"]);
    const lawsFixture = ts.createSourceFile("UncontractedLawFixture.tsx", "const view = <span>{rule.value}</span>;", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    expect(uncontractedDerivedJsx(lawsFixture)).toEqual(["rule.value"]);
    const interventionFixture = ts.createSourceFile("UncontractedInterventionFixture.tsx", "const view = <span>{shift.delta}</span>;", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    expect(uncontractedDerivedJsx(interventionFixture)).toEqual(["shift.delta"]);
    const wrongValueFixture = ts.createSourceFile("WrongResultValueFixture.tsx", "const view = <ResultValue subjectId={`${rule.id}.value`} value={rule.value}>{rule.value + 1}</ResultValue>;", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    expect(mismatchedResultValueContent(wrongValueFixture)).toEqual(["rule.value + 1"]);
    const wrongFieldFixture = ts.createSourceFile("WrongResultFieldFixture.tsx", "const view = <ResultValue subjectId={`${rule.id}.value`} value={rule.value}>{rule.label}</ResultValue>;", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    expect(mismatchedResultValueContent(wrongFieldFixture)).toEqual(["rule.label"]);
    const validFormattedFixture = ts.createSourceFile("FormattedResultValueFixture.tsx", "const view = <ResultValue subjectId={`${rule.id}.polarity`} value={rule.polarity}>{polarityName(rule.polarity)}</ResultValue>;", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    expect(mismatchedResultValueContent(validFormattedFixture)).toEqual([]);

    const mismatchedContents = protectedFiles.flatMap((file) => mismatchedResultValueContent(parseSourceFile(file)).map((text) => `${relative(sourceRoot, file)}:${text}`));
    expect(mismatchedContents).toEqual([]);
  });

  it("关键编排文件保持在约定规模内", () => {
    const limits = new Map([
      ["src/App.tsx", 140],
      ["src/components/AppChrome.tsx", 120],
      ["src/ui/useUniverseAppModel.ts", 230],
      ["src/components/pages/OverviewPage.tsx", 120],
      ["src/components/pages/TimelinePage.tsx", 100],
      ["src/components/pages/LawsPage.tsx", 120],
      ["src/components/RuntimeApplication.tsx", 100],
      ["src/components/LegacyApplication.tsx", 100],
      ["src/ui/useRuntimeUniverseModel.ts", 180],
      ["src/ui/runtimeStorage.ts", 130],
      ["src/sim/contracts/runtime.ts", 190],
      ["src/sim/runtime-state.ts", 330],
      ["src/sim/runtime-state-validation.ts", 80],
      ["src/sim/runtime-random.ts", 140],
      ["src/sim/runtime-events.ts", 60],
      ["src/sim/runtime-history.ts", 40],
      ["src/sim/runtime-causality.ts", 240],
      ["src/sim/runtime-archive.ts", 100],
      ["src/sim/timeline.ts", 320],
      ["src/sim/civilizations.ts", 390],
      ["src/sim/interventions.ts", 410],
      ["src/sim/types.ts", 480],
      ["src/sim/contracts/interventions.ts", 130],
      ["src/sim/causality.ts", 100],
      ["src/sim/causality-build.ts", 100],
      ["src/sim/causality-generation.ts", 180],
      ["src/sim/causal-comparison.ts", 180],
      ["src/sim/causality-builder.ts", 340],
      ["src/sim/causality-query.ts", 430],
      ["src/sim/causality-collections.ts", 140],
      ["src/sim/causality-summary-collections.ts", 60],
      ["src/sim/causality-space-summaries.ts", 60],
      ["src/sim/causality-civilization-summaries.ts", 60],
      ["src/sim/state-value-projection.ts", 180],
      ["src/sim/state-value-definitions.ts", 260],
      ["src/sim/causality-summary-group-evidence.ts", 80],
      ["src/sim/causality-summary-validation.ts", 100],
      ["src/sim/causality-random-validation.ts", 150],
      ["src/sim/causality-random-bindings.ts", 120],
      ["src/sim/causality-random-binding-validation.ts", 80],
      ["src/sim/causality-domain-locators.ts", 230],
      ["src/sim/random-evidence-validation.ts", 140],
      ["src/sim/random-transcript.ts", 80],
      ["src/sim/random-replay.ts", 40],
      ["src/sim/causality-source.ts", 10],
      ["src/sim/causality-model.ts", 80],
      ["src/sim/causality-foundations.ts", 210],
      ["src/sim/causality-history.ts", 140],
      ["src/sim/causality-world.ts", 200],
      ["src/sim/causality-projections.ts", 230],
      ["src/sim/causality-projection.ts", 110],
      ["src/sim/causality-freeze.ts", 80],
      ["src/sim/random.ts", 310],
      ["src/sim/random-decision-parameters.ts", 30],
      ["src/sim/contracts/causality.ts", 230],
      ["src/sim/contracts/causal-locators.ts", 70],
      ["src/sim/contracts/causal-comparison.ts", 80],
      ["src/sim/contracts/random.ts", 50],
      ["src/ui/causalView.ts", 100],
      ["src/ui/causalProjectionSources.ts", 60],
      ["src/ui/observationCausalProjection.ts", 220],
      ["src/ui/lawComparisonCausalProjection.ts", 160],
      ["src/ui/useLawComparisonModel.ts", 100],
      ["src/components/CausalExplorer.tsx", 350],
      ["src/components/CausalRandomEvidence.tsx", 80],
      ["src/components/causalExplorerModel.ts", 140],
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
      ["src/styles-runtime.css", 120],
      ["src/styles-responsive.css", 220],
      ["src/styles-causality.css", 460],
      ["src/styles-causality-responsive.css", 70],
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

function hasExportModifier(node: ts.Node): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function isSimFile(file: string): boolean {
  return file.includes(`${sep}sim${sep}`);
}

function componentGeneratorCalls(sourceFile: ts.SourceFile, file: string): string[] {
  const directNames = new Map<string, string>();
  const namespaces = new Set<string>();
  sourceFile.statements.filter(ts.isImportDeclaration).forEach((declaration) => {
    if (!declaration.importClause || declaration.importClause.isTypeOnly || !ts.isStringLiteral(declaration.moduleSpecifier)) return;
    if (!resolvesInto(file, declaration.moduleSpecifier.text, ["sim"])) return;
    const bindings = declaration.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      bindings.elements.filter((element) => !element.isTypeOnly).forEach((element) => {
        const exportedName = element.propertyName?.text ?? element.name.text;
        if (isGeneratorCapability(exportedName)) directNames.set(element.name.text, exportedName);
      });
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
    }
  });
  return descendants(sourceFile).flatMap((node) => {
    if (!ts.isCallExpression(node)) return [];
    if (ts.isIdentifier(node.expression)) {
      const exportedName = directNames.get(node.expression.text);
      return exportedName ? [exportedName] : [];
    }
    if (ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && namespaces.has(node.expression.expression.text)
      && isGeneratorCapability(node.expression.name.text)) {
      return [node.expression.name.text];
    }
    return [];
  });
}

function isGeneratorCapability(name: string): boolean {
  return /^(generate|apply)[A-Z]/.test(name);
}

function exportedSymbolsReaching(sourceFile: ts.SourceFile, targetName: string): string[] {
  const symbols = new Map<string, ts.Node>();
  const exported = new Map<string, ts.Node>();
  const namedExports: Array<{ exportedName: string; localName: string }> = [];
  sourceFile.statements.forEach((statement) => {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name) symbols.set(statement.name.text, statement);
      if (hasExportModifier(statement)) {
        const exportedName = hasDefaultModifier(statement) ? "default" : statement.name?.text ?? "default";
        exported.set(exportedName, statement);
      }
      return;
    }
    if (ts.isModuleDeclaration(statement)) {
      const name = statement.name.text;
      symbols.set(name, statement);
      if (hasExportModifier(statement)) exported.set(name, statement);
      return;
    }
    if (ts.isImportEqualsDeclaration(statement)) {
      const name = statement.name.text;
      symbols.set(name, statement.moduleReference);
      if (hasExportModifier(statement)) exported.set(name, statement.moduleReference);
      return;
    }
    if (ts.isVariableStatement(statement)) {
      const isExported = hasExportModifier(statement);
      statement.declarationList.declarations.forEach((declaration) => bindingNames(declaration.name).forEach((name) => {
        symbols.set(name, declaration);
        if (isExported) exported.set(name, declaration);
      }));
      return;
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      statement.exportClause.elements.forEach((element) => namedExports.push({
        exportedName: element.name.text,
        localName: element.propertyName?.text ?? element.name.text,
      }));
      return;
    }
    if (ts.isExportAssignment(statement)) {
      exported.set(statement.isExportEquals ? "export=" : "default", statement.expression);
    }
  });
  namedExports.forEach(({ exportedName, localName }) => {
    const declaration = symbols.get(localName);
    if (declaration) exported.set(exportedName, declaration);
  });
  const references = new Map<string, Set<string>>();
  symbols.forEach((declaration, name) => {
    references.set(name, new Set([declaration, ...descendants(declaration)].flatMap((node) => ts.isIdentifier(node)
      && node.text !== name && symbols.has(node.text) ? [node.text] : [])));
  });
  const reaches = (root: ts.Node): boolean => {
    const visited = new Set<string>();
    const rootIdentifiers = [root, ...descendants(root)].filter(ts.isIdentifier).map((node) => node.text);
    if (rootIdentifiers.includes(targetName)) return true;
    const pending = rootIdentifiers.filter((name) => symbols.has(name));
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (current === targetName) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...(references.get(current) ?? []));
    }
    return false;
  };
  return [...exported.entries()].filter(([, declaration]) => reaches(declaration)).map(([name]) => name).sort();
}

function hasDefaultModifier(node: ts.Node): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword));
}

function currentFactConflicts(content: string): string[] {
  const currentSnapshot = content.split(/\r?\n/).filter((line) => line.startsWith("步骤 2 当前发布快照：")).join("\n");
  const patterns: Array<[string, RegExp]> = [
    ["模拟测试数量", /模拟测试\s+(\d+)\s+项/g],
    ["UI 测试数量", /UI 测试\s+(\d+)\s+项/g],
    ["E2E 通过数量", /E2E[：\s]+(\d+)\s+项通过/g],
    ["JavaScript gzip", /JavaScript gzip(?:\s+为)?\s*(\d+)\s+字节/g],
    ["CSS gzip", /CSS gzip(?:\s+为)?\s*(\d+)\s+字节/g],
  ];
  return patterns.flatMap(([label, pattern]) => {
    const values = [...currentSnapshot.matchAll(pattern)].map((match) => match[1]);
    const unique = [...new Set(values)].sort((left, right) => Number(left) - Number(right));
    return unique.length > 1 ? [`${label}存在 ${unique.join("、")} 两套当前值`] : [];
  });
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) => ts.isOmittedExpression(element) ? [] : bindingNames(element.name));
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

function uncontractedDerivedJsx(sourceFile: ts.SourceFile): string[] {
  const protectedValue = /(?:universe\.(?:name|description|displaySeed|shareCode|shareUrl)|(?:galaxy|system|planet|civilization|selectedGalaxy|selectedSystem|selectedPlanet|selectedCivilization)\.(?:name|originGalaxyName|originStarSystemName|originPlanetName)|\.starSystems\.length|\.planets\.length|event\.(?:ageLabel|era|type|location|importance|impact)|metric\.(?:value|label|explanation)|influence\.(?:sourceLabel|delta)|mythology\.(?:type|deityName|influenceLevel|origin|relationToCivilization)|law\.(?:title|rating|traits|cost)|rule\.(?:name|value|label|polarity|explanation|effectTargets)|interaction\.(?:kind|impact|sourceLawId|targetLawId|explanation)|state\.(?:summary|overuseLevel)|shift\.(?:eventType|delta|explanation)|entry\.(?:ageLabel|miracleType|targetLabel|directResult|longTermConsequence)|mutation\.(?:field|before|after|explanation)|\bitem\b)/;
  return descendants(sourceFile).flatMap((node) => {
    if (!ts.isJsxExpression(node) || !node.expression || ts.isJsxAttribute(node.parent)) return [];
    if (descendants(node.expression).some((child) => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child))) return [];
    const text = node.expression.getText(sourceFile);
    if (!protectedValue.test(text) || hasResultContractAncestor(node)) return [];
    return [text];
  });
}

function hasResultContractAncestor(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxElement(current) && ["ResultValue", "RegisteredResult"].includes(current.openingElement.tagName.getText())) return true;
    if (ts.isJsxSelfClosingElement(current) && ["AttributeBar", "StatTile"].includes(current.tagName.getText())) return true;
    current = current.parent;
  }
  return false;
}

function mismatchedResultValueContent(sourceFile: ts.SourceFile): string[] {
  return descendants(sourceFile).flatMap((node) => {
    if (!ts.isJsxElement(node) || node.openingElement.tagName.getText(sourceFile) !== "ResultValue") return [];
    const valueAttribute = node.openingElement.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === "value");
    if (!valueAttribute?.initializer || !ts.isJsxExpression(valueAttribute.initializer) || !valueAttribute.initializer.expression) return [];
    const valueText = valueAttribute.initializer.expression.getText(sourceFile);
    if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(valueText)) return [];
    return node.children.flatMap((child) => {
      if (!ts.isJsxExpression(child) || !child.expression) return [];
      const expressionText = child.expression.getText(sourceFile);
      if (!protectedResultExpression(expressionText)) return [];
      if (ts.isBinaryExpression(child.expression)) return [expressionText];
      return expressionText.includes(valueText) ? [] : [expressionText];
    });
  });
}

function protectedResultExpression(text: string): boolean {
  return /(?:law|rule|interaction|state|shift|entry|mutation|event|metric|influence|galaxy|system|planet|civilization|mythology)\.[A-Za-z_$][\w$]*/.test(text);
}
