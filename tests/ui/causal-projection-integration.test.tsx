import { render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/App";
import * as sim from "../../src/sim";
import {
  appendCausalProjections,
  buildLawComparisonEvidence,
  generateCausalUniverse,
  validateCausalGraph,
  RULESET_VERSION,
  type CausalGraph,
} from "../../src/sim";
import { assertLawComparisonEvidence } from "../../src/sim/causal-comparison";
import { causalNodeIdsForSubjects, requireCausalSubjectNode } from "../../src/ui/causalProjectionSources";
import {
  buildLawComparisonCausalProjection,
  buildLawComparisonView,
  generateLawComparisonUniverse,
  lawComparisonDomainOrder,
} from "../../src/ui/lawComparisonCausalProjection";
import {
  buildObservationCausalProjection,
  observationTraceOptions,
} from "../../src/ui/observationCausalProjection";
import { buildObservationProjection } from "../../src/ui/observationProjection";

describe("可见投影因果接入", () => {
  it("观察摘要、几何、五类强度和事件关联各自只追加一个闭包节点", () => {
    const universe = generateCausalUniverse({ seed: "OBSERVATION-CAUSES", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    const { galaxy, system, planet } = findPlanetContext(universe);
    const universeProjection = buildObservationProjection(universe, "universe");
    const galaxyNode = universeProjection.nodes.find((node) => node.id === galaxy.id)!;
    const galaxyProjection = buildObservationProjection(universe, "galaxy", galaxy.id);
    const systemNode = galaxyProjection.nodes.find((node) => node.id === system.id)!;
    const systemProjection = buildObservationProjection(universe, "system", galaxy.id, system.id);
    const planetNode = systemProjection.nodes.find((node) => node.id === planet.id)!;

    expect(buildObservationCausalProjection(universe, universeProjection, galaxyNode, "summary").description).toContain("当前层级文字摘要");
    expect(buildObservationCausalProjection(universe, galaxyProjection, systemNode, "summary").description).toContain("当前节点摘要");

    const descriptions = new Map<string, string>();
    const projectedByAspect = new Map<string, CausalGraph>();
    for (const option of observationTraceOptions) {
      const startedAt = performance.now();
      const spec = buildObservationCausalProjection(universe, systemProjection, planetNode, option.id);
      const projected = appendCausalProjections(universe.causalGraph, [spec]);
      const elapsed = performance.now() - startedAt;
      expect(projected.nodes).toHaveLength(universe.causalGraph.nodes.length + 1);
      expect(validateCausalGraph(projected).issues.map((issue) => issue.code)).toContain("UNTRUSTED_CAUSAL_GRAPH");
      const result = projected.nodes.find((node) => node.subjectId === spec.subjectId)!;
      expect(result).toBeDefined();
      expect(projected.nodes.filter((node) => node.subjectId === spec.subjectId)).toHaveLength(1);
      descriptions.set(option.id, result.description);
      projectedByAspect.set(option.id, projected);
      if (option.id === "related-events") expect(elapsed).toBeLessThan(1500);
    }

    expect(descriptions.get("geometry")).toMatch(/坐标 x=.*y=.*尺寸.*亮度/);
    for (const aspect of ["life", "civilization", "magic", "divinity", "causality"]) {
      expect(descriptions.get(aspect)).toMatch(/强度为 \d+ \/ 100/);
    }
    expect(descriptions.get("related-events")).toContain(`全部 ${universe.timeline.length} 条时间线事件候选`);

    const civilizationSpec = buildObservationCausalProjection(universe, systemProjection, planetNode, "civilization");
    const civilizationSubjects = directCauseSubjects(projectedByAspect.get("civilization")!, civilizationSpec.subjectId);
    const regionalCivilizations = universe.civilizations.filter((civilization) => civilization.originPlanetId === planet.id);
    const foreignCivilizations = universe.civilizations.filter((civilization) => civilization.originPlanetId !== planet.id);
    expect(foreignCivilizations.length).toBeGreaterThan(0);
    expect(regionalCivilizations.every((civilization) => civilizationSubjects.has(civilization.id))).toBe(true);
    expect(foreignCivilizations.every((civilization) => !civilizationSubjects.has(civilization.id))).toBe(true);

    const magicSpec = buildObservationCausalProjection(universe, systemProjection, planetNode, "magic");
    const magicSubjects = directCauseSubjects(projectedByAspect.get("magic")!, magicSpec.subjectId);
    expect(regionalCivilizations.every((civilization) => magicSubjects.has(civilization.id)
      && !magicSubjects.has(`${civilization.id}.mythology`))).toBe(true);
    expect(foreignCivilizations.every((civilization) => !magicSubjects.has(civilization.id)
      && !magicSubjects.has(`${civilization.id}.mythology`))).toBe(true);

    const divinitySpec = buildObservationCausalProjection(universe, systemProjection, planetNode, "divinity");
    const divinitySubjects = directCauseSubjects(projectedByAspect.get("divinity")!, divinitySpec.subjectId);
    expect(regionalCivilizations.every((civilization) => divinitySubjects.has(civilization.id)
      && divinitySubjects.has(`${civilization.id}.mythology`))).toBe(true);
    expect(foreignCivilizations.every((civilization) => !divinitySubjects.has(civilization.id)
      && !divinitySubjects.has(`${civilization.id}.mythology`))).toBe(true);

    expect(planetNode.intensity.life).toBe(clamp(
      clamp(planet.habitability * 0.55 + (planet.biosphere?.complexity ?? 0) * 0.45) * 0.75
      + universe.metrics.lifePotential.value * 0.25,
    ));
    expect(planetNode.intensity.civilization).toBe(clamp(average(regionalCivilizations.map((civilization) =>
      (civilization.technologyLevel + civilization.expansionDrive + civilization.stability) / 3))));
    expect(planetNode.intensity.magic).toBe(clamp(planet.magicSaturation * 0.65
      + average(regionalCivilizations.map((civilization) => civilization.magicLevel)) * 0.35));
    expect(planetNode.intensity.divinity).toBe(clamp(galaxy.divineResidue * 0.25
      + average(regionalCivilizations.map((civilization) => (civilization.faithIntensity + civilization.mythology.influenceLevel) / 2)) * 0.75));
    expect(planetNode.intensity.causality).toBe(clamp((galaxy.causalHazard * 0.35
      + system.anomalyLevel * 0.4 + (100 - planet.stability) * 0.25) * 0.7
      + (100 - universe.metrics.causalityIntegrity.value) * 0.3));

    const eventSpec = buildObservationCausalProjection(universe, systemProjection, planetNode, "related-events");
    const eventSubjects = directCauseSubjects(projectedByAspect.get("related-events")!, eventSpec.subjectId);
    expect(universe.timeline.every((event) => eventSubjects.has(event.id))).toBe(true);
  }, 30000);

  it("投影来源主题缺失或重复时拒绝静默降级", () => {
    const universe = generateCausalUniverse({ seed: "STRICT-SUBJECTS", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    expect(() => requireCausalSubjectNode(universe.causalGraph, "missing-subject")).toThrow(/缺少主题节点/);
    expect(() => causalNodeIdsForSubjects(universe.causalGraph, ["metric.lifePotential", "missing-subject"])).toThrow(/缺少主题节点/);

    const source = universe.causalGraph.nodes.find((node) => node.subjectId === "metric.lifePotential")!;
    const duplicateGraph = {
      ...universe.causalGraph,
      nodes: [...universe.causalGraph.nodes, { ...source, id: "duplicate-subject-node" }],
    } as CausalGraph;
    expect(() => requireCausalSubjectNode(duplicateGraph, "metric.lifePotential")).toThrow(/主题节点不唯一/);
  }, 15_000);

  it("法则对比普通渲染不物化右图，追溯时校验左右组合证据", () => {
    const left = generateCausalUniverse({ seed: "LAW-LEFT-CAUSES", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    const right = generateLawComparisonUniverse(left, "LAW-RIGHT-CAUSES");
    const guardedRight = new Proxy(right, {
      get(target, property, receiver) {
        if (property === "causalGraph") throw new Error("普通对比渲染不应访问右侧因果图");
        return Reflect.get(target, property, receiver);
      },
    });
    expect(() => buildLawComparisonView(left, guardedRight)).not.toThrow();
    const comparison = buildLawComparisonView(left, right);
    expect(comparison.summary).toMatch(/六个候选领域.*max\(abs\(右值 - 左值\)\).*固定顺序/);
    expect(comparison.domainDiffs).toHaveLength(6);

    const evidence = buildLawComparisonEvidence(left, right, comparison, "maximum");
    expect(evidence.left.generationId).toBe(left.causalGraph.generation.id);
    expect(evidence.right.generationId).toBe(right.causalGraph.generation.id);
    expect(evidence.left.sourceNodeIds.length).toBeGreaterThan(6);
    expect(evidence.right.sourceNodeIds.length).toBeGreaterThan(6);
    expect(() => assertLawComparisonEvidence(evidence, left, right, comparison, "maximum")).not.toThrow();

    const leftSpec = buildLawComparisonCausalProjection(left, right, comparison, "left", "maximum");
    const leftProjected = appendCausalProjections(left.causalGraph, [leftSpec]);
    const startedAt = performance.now();
    const rightSpec = buildLawComparisonCausalProjection(left, right, comparison, "right", "maximum");
    const rightProjected = appendCausalProjections(right.causalGraph, [rightSpec]);
    const rightMaterializationMs = performance.now() - startedAt;

    expect(rightMaterializationMs).toBeLessThan(1500);
    expect(validateCausalGraph(leftProjected).issues.map((issue) => issue.code)).toContain("UNTRUSTED_CAUSAL_GRAPH");
    expect(validateCausalGraph(rightProjected).issues.map((issue) => issue.code)).toContain("UNTRUSTED_CAUSAL_GRAPH");
    expect(leftProjected.nodes).toHaveLength(left.causalGraph.nodes.length + 1);
    expect(rightProjected.nodes).toHaveLength(right.causalGraph.nodes.length + 1);
    expect(leftProjected.randomTrace.seedFingerprint).not.toBe(rightProjected.randomTrace.seedFingerprint);
    expect(leftProjected.nodes.some((node) => node.subjectId === rightSpec.subjectId)).toBe(false);
    expect(rightProjected.nodes.some((node) => node.subjectId === leftSpec.subjectId)).toBe(false);
    expect(rightSpec.description).toMatch(/组合证据.*校验左右因果图/);
    const rightSubjects = directCauseSubjects(rightProjected, rightSpec.subjectId);
    expect(lawComparisonDomainOrder.every((domain) => rightSubjects.has(domain))).toBe(true);

    const tampered = structuredClone(evidence);
    (tampered.right.sourceNodeIds as string[]).pop();
    expect(() => assertLawComparisonEvidence(tampered, left, right, comparison, "maximum")).toThrow(/组合证据不完整/);

    const mismatchedRight = generateLawComparisonUniverse(left, "LAW-MISMATCHED-RIGHT");
    expect(() => buildLawComparisonEvidence(left, mismatchedRight, comparison, "maximum")).toThrow(/身份与比较结果不匹配/);

    const missingGraph = structuredClone(right.causalGraph) as CausalGraph;
    const missingNodeId = missingGraph.nodes.find((node) => node.subjectId === lawComparisonDomainOrder[0])!.id;
    const missingRight = { ...right, causalGraph: { ...missingGraph, nodes: missingGraph.nodes.filter((node) => node.id !== missingNodeId) } } as typeof right;
    expect(() => buildLawComparisonEvidence(left, missingRight, comparison, "maximum")).toThrow(/因果闭包校验失败|来源主题/);
  }, 30_000);

  it("最大差异在绝对值并列时按固定领域顺序稳定裁决", () => {
    const left = generateLawComparisonUniverse(
      generateCausalUniverse({ seed: "TIE-BASE", rulesetVersion: RULESET_VERSION, templateId: "high_magic" }),
      "TIE-LEFT",
    );
    const right = structuredClone(left) as typeof left;
    for (const domain of lawComparisonDomainOrder) right.laws[domain].rating.value = left.laws[domain].rating.value;
    right.laws.physics.rating.value += 8;
    right.laws.magic.rating.value += 8;
    expect(buildLawComparisonView(left, right).largestDiffDomain).toBe("physics");
  });

  it("观察入口支持键盘纵向进入投影并由主导航返回当前宇宙图", async () => {
    const user = userEvent.setup();
    const base = generateCausalUniverse({ seed: "LUX-7F3A-91C2", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });
    const { container } = render(<App initialPage="observe" />);
    const traceButton = screen.getByRole("button", { name: "查看几何原因" });
    traceButton.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { name: /观察几何：/ })).toBeTruthy();
    expect(screen.getByText(/投影坐标 x=.*尺寸.*亮度/)).toBeTruthy();
    expect(firstGraphSummaryValue(container as HTMLElement)).toBe(String(base.causalGraph.nodes.length + 1));
    expect((await axe(container)).violations).toEqual([]);

    await user.click(screen.getByRole("button", { name: /因果：结果、原因与影响链路/ }));
    expect(screen.queryByRole("heading", { name: /观察几何：/ })).toBeNull();
    expect(firstGraphSummaryValue(container as HTMLElement)).toBe(String(base.causalGraph.nodes.length));
  }, 15_000);

  it("法则页面显式展示公式并可用键盘分别追溯左右宇宙", async () => {
    const user = userEvent.setup();
    const appendSpy = vi.spyOn(sim, "appendCausalProjections");
    const { container } = render(<App initialPage="laws" />);
    expect(screen.getAllByText(/^右值 - 左值 =/)).toHaveLength(6);
    expect(screen.getByText(/六个候选领域.*max\(abs\(右值 - 左值\)\)/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "追溯左侧最大差异依据" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "追溯右侧最大差异依据" })).toBeTruthy();
    expect(appendSpy).not.toHaveBeenCalled();

    const rightTrace = screen.getByRole("button", { name: "追溯右值原因：物理" });
    rightTrace.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "物理法则：右值评分" })).toBeTruthy();
    expect(screen.getByText(/组合证据.*校验左右评分与差值/)).toBeTruthy();
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect((await axe(container)).violations).toEqual([]);

    await user.click(screen.getByRole("button", { name: /法则：法则、关系与对比/ }));
    const leftTrace = screen.getByRole("button", { name: "追溯左值原因：物理" });
    leftTrace.focus();
    await user.keyboard(" ");
    expect(screen.getByRole("heading", { name: "物理法则：左值评分" })).toBeTruthy();
    expect(appendSpy).toHaveBeenCalledTimes(2);
    appendSpy.mockRestore();
  }, 30_000);
});

function directCauseSubjects(graph: CausalGraph, projectionSubjectId: string): Set<string> {
  const projection = graph.nodes.find((node) => node.subjectId === projectionSubjectId)!;
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  return new Set(projection.directCauseIds.map((nodeId) => nodesById.get(nodeId)?.subjectId).filter((subject): subject is string => Boolean(subject)));
}

function findPlanetContext(universe: ReturnType<typeof generateCausalUniverse>) {
  for (const galaxy of universe.galaxies) {
    for (const system of galaxy.starSystems) {
      const planet = system.planets.find((candidate) => candidate.biosphere);
      if (planet && universe.civilizations.some((civilization) => civilization.originPlanetId !== planet.id)) {
        return { galaxy, system, planet };
      }
    }
  }
  const galaxy = universe.galaxies[0];
  const system = galaxy.starSystems[0];
  return { galaxy, system, planet: system.planets[0] };
}

function firstGraphSummaryValue(container: HTMLElement): string | null | undefined {
  return container.querySelector(".causal-explorer-summary dd")?.textContent;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
