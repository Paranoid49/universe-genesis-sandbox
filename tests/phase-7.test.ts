import { describe, expect, it } from "vitest";
import { generateUniverse, RULESET_VERSION } from "../src/sim";
import { buildObservationProjection, observationHaloRadius, observationOverlayOptions } from "../src/ui/observationProjection";

describe("阶段 7：可视化宇宙观察台", () => {
  const universe = generateUniverse({ seed: "PHASE-7-OBSERVE", rulesetVersion: RULESET_VERSION, templateId: "high_magic" });

  it("同一宇宙会产生完全一致的稳定投影", () => {
    expect(buildObservationProjection(universe, "universe")).toEqual(buildObservationProjection(universe, "universe"));
  });

  it("支持宇宙、星系与恒星系三级只读投影", () => {
    const universeView = buildObservationProjection(universe, "universe");
    const galaxy = universe.galaxies[0];
    const system = galaxy.starSystems[0];
    const galaxyView = buildObservationProjection(universe, "galaxy", galaxy.id);
    const systemView = buildObservationProjection(universe, "system", galaxy.id, system.id);
    expect(universeView.nodes.map((node) => node.id)).toEqual(universe.galaxies.map((item) => item.id));
    expect(galaxyView.nodes.map((node) => node.id)).toEqual(galaxy.starSystems.map((item) => item.id));
    expect(systemView.nodes.map((node) => node.id)).toEqual(system.planets.map((item) => item.id));
  });

  it("所有节点都提供五种归一化叠层强度", () => {
    const projection = buildObservationProjection(universe, "universe");
    expect(observationOverlayOptions).toHaveLength(5);
    for (const node of projection.nodes) {
      expect(Object.keys(node.intensity).sort()).toEqual(observationOverlayOptions.map((item) => item.id).sort());
      expect(Object.values(node.intensity).every((value) => value >= 0 && value <= 100)).toBe(true);
    }
  });

  it("宇宙层节点保持可辨识间距且详情不暴露内部枚举", () => {
    const expanded = structuredClone(universe);
    expanded.galaxies = Array.from({ length: 48 }, (_, index) => ({
      ...structuredClone(universe.galaxies[index % universe.galaxies.length]),
      id: `dense-galaxy-${index}`,
      name: `密集星系 ${index}`,
    }));
    const denseGalaxy = expanded.galaxies[0];
    denseGalaxy.starSystems = Array.from({ length: 64 }, (_, index) => ({
      ...structuredClone(universe.galaxies[0].starSystems[index % universe.galaxies[0].starSystems.length]),
      id: `dense-system-${index}`,
      name: `密集恒星系 ${index}`,
    }));
    const denseSystem = denseGalaxy.starSystems[0];
    denseSystem.planets = Array.from({ length: 32 }, (_, index) => ({
      ...structuredClone(universe.galaxies[0].starSystems[0].planets[index % universe.galaxies[0].starSystems[0].planets.length]),
      id: `dense-planet-${index}`,
      name: `密集行星 ${index}`,
    }));
    const projections = [
      buildObservationProjection(expanded, "universe"),
      buildObservationProjection(expanded, "galaxy", denseGalaxy.id),
      buildObservationProjection(expanded, "system", denseGalaxy.id, denseSystem.id),
    ];
    projections.forEach(assertProjectionHasNoHaloCollisions);
    expect(projections.flatMap((projection) => projection.nodes).every((node) => !node.detail.includes("_") && !node.detail.includes("arcane_cluster"))).toBe(true);
  });

  it("按规格字段映射亮度、尺寸与五类叠层语义", () => {
    const galaxy = universe.galaxies[0];
    const system = galaxy.starSystems[0];
    const planet = system.planets[0];
    const civilization = universe.civilizations.find((item) => item.originPlanetId === planet.id);
    const changed = structuredClone(universe);
    const changedGalaxy = changed.galaxies.find((item) => item.id === galaxy.id)!;
    const changedSystem = changedGalaxy.starSystems.find((item) => item.id === system.id)!;
    const changedPlanet = changedSystem.planets.find((item) => item.id === planet.id)!;
    changedGalaxy.metallicity = Math.min(100, galaxy.metallicity + 20);
    changedSystem.stability = Math.min(100, system.stability + 20);
    changedPlanet.type = planet.type === "gas_giant" ? "rocky" : "gas_giant";
    changed.metrics.lifePotential.value = Math.min(100, universe.metrics.lifePotential.value + 20);
    changed.metrics.causalityIntegrity.value = Math.max(0, universe.metrics.causalityIntegrity.value - 20);
    if (civilization) {
      const changedCivilization = changed.civilizations.find((item) => item.id === civilization.id)!;
      changedCivilization.magicLevel = Math.min(100, civilization.magicLevel + 20);
      changedCivilization.faithIntensity = Math.min(100, civilization.faithIntensity + 20);
    }

    const baseGalaxy = buildObservationProjection(universe, "universe").nodes.find((node) => node.id === galaxy.id)!;
    const nextGalaxy = buildObservationProjection(changed, "universe").nodes.find((node) => node.id === galaxy.id)!;
    const baseSystem = buildObservationProjection(universe, "galaxy", galaxy.id).nodes.find((node) => node.id === system.id)!;
    const nextSystem = buildObservationProjection(changed, "galaxy", galaxy.id).nodes.find((node) => node.id === system.id)!;
    const basePlanet = buildObservationProjection(universe, "system", galaxy.id, system.id).nodes.find((node) => node.id === planet.id)!;
    const nextPlanet = buildObservationProjection(changed, "system", galaxy.id, system.id).nodes.find((node) => node.id === planet.id)!;
    expect(nextGalaxy.brightness).not.toBe(baseGalaxy.brightness);
    expect(nextSystem.brightness).not.toBe(baseSystem.brightness);
    expect(nextPlanet.size).not.toBe(basePlanet.size);
    expect(nextPlanet.intensity.life).not.toBe(basePlanet.intensity.life);
    expect(nextPlanet.intensity.causality).not.toBe(basePlanet.intensity.causality);
    if (civilization) {
      expect(nextPlanet.intensity.magic).not.toBe(basePlanet.intensity.magic);
      expect(nextPlanet.intensity.divinity).not.toBe(basePlanet.intensity.divinity);
    }
  });

  it("建立时间事件到稳定空间节点的关联索引", () => {
    const projections = universe.galaxies.flatMap((galaxy) => [
      buildObservationProjection(universe, "galaxy", galaxy.id),
      ...galaxy.starSystems.map((system) => buildObservationProjection(universe, "system", galaxy.id, system.id)),
    ]);
    const relatedNodes = projections.flatMap((projection) => projection.nodes).filter((node) => node.relatedEventIds.length > 0);
    expect(relatedNodes.length).toBeGreaterThan(0);
    expect(relatedNodes.every((node) => node.relatedEventIds.every((id) => universe.timeline.some((event) => event.id === id)))).toBe(true);
  });

  it("截断异常节点数量时给出明确摘要", () => {
    const expanded = structuredClone(universe);
    expanded.galaxies = Array.from({ length: 49 }, (_, index) => ({ ...structuredClone(universe.galaxies[0]), id: `galaxy-${index}`, name: `星系 ${index}` }));
    expanded.galaxies[0].starSystems = Array.from({ length: 65 }, (_, index) => ({ ...structuredClone(universe.galaxies[0].starSystems[0]), id: `system-${index}`, name: `恒星系 ${index}` }));
    expanded.galaxies[0].starSystems[0].planets = Array.from({ length: 33 }, (_, index) => ({ ...structuredClone(universe.galaxies[0].starSystems[0].planets[0]), id: `planet-${index}`, name: `行星 ${index}` }));
    expect(buildObservationProjection(expanded, "universe").textualSummary).toContain("共 49");
    expect(buildObservationProjection(expanded, "galaxy", "galaxy-0").textualSummary).toContain("共 65");
    expect(buildObservationProjection(expanded, "system", "galaxy-0", "system-0").textualSummary).toContain("共 33");
  });

  it("无效层级 ID 返回带原因的空投影而非静默替换目标", () => {
    const invalidGalaxy = buildObservationProjection(universe, "galaxy", "missing-galaxy");
    const invalidSystem = buildObservationProjection(universe, "system", universe.galaxies[0].id, "missing-system");
    expect(invalidGalaxy.nodes).toEqual([]);
    expect(invalidGalaxy.textualSummary).toContain("无效或已过期");
    expect(invalidSystem.nodes).toEqual([]);
    expect(invalidSystem.textualSummary).toContain("无效、已过期");
  });

  it("六颗行星的节点与尺寸全部保持在 SVG 可视边界内", () => {
    const expanded = structuredClone(universe);
    const galaxy = expanded.galaxies[0];
    const system = galaxy.starSystems[0];
    system.planets = Array.from({ length: 6 }, (_, index) => ({
      ...structuredClone(system.planets[0]), id: `safe-planet-${index}`, name: `边界行星 ${index}`,
    }));
    const projection = buildObservationProjection(expanded, "system", galaxy.id, system.id);
    expect(projection.nodes).toHaveLength(6);
    expect(projection.nodes.every((node) => node.x - node.size >= 0
      && node.x + node.size <= 100
      && node.y - node.size >= 0
      && node.y + node.size <= 100)).toBe(true);
  });

  it("投影不会修改原始宇宙结果", () => {
    const before = JSON.stringify(universe);
    buildObservationProjection(universe, "system", universe.galaxies[0].id, universe.galaxies[0].starSystems[0].id);
    expect(JSON.stringify(universe)).toBe(before);
  });
});

function assertProjectionHasNoHaloCollisions(projection: ReturnType<typeof buildObservationProjection>): void {
  for (let leftIndex = 0; leftIndex < projection.nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < projection.nodes.length; rightIndex += 1) {
      const left = projection.nodes[leftIndex];
      const right = projection.nodes[rightIndex];
      const distance = Math.hypot(left.x - right.x, left.y - right.y);
      for (const overlay of observationOverlayOptions) {
        expect(distance).toBeGreaterThan(observationHaloRadius(left, overlay.id) + observationHaloRadius(right, overlay.id));
      }
    }
  }
}
