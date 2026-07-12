import { describe, expect, it } from "vitest";
import { filterTimelineByEra, generateUniverse, RULESET_VERSION, type EventType } from "../src/sim";
import { eraIds, fixedSeeds, metricIds } from "./helpers";

describe("阶段 3 宇宙时间线与纪元系统", () => {
  it("每个宇宙至少生成 30 条事件，并覆盖完整阶段 3 纪元", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[0], templateId: "high_magic" });
    const eras = new Set(universe.timeline.map((event) => event.era));

    expect(universe.timeline.length).toBeGreaterThanOrEqual(30);
    for (const era of eraIds) {
      expect(eras.has(era)).toBe(true);
    }
  });

  it("时间线能按纪元筛选，筛选不会改变原始事件集合", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[1], templateId: "mythic" });
    const allEvents = filterTimelineByEra(universe.timeline, "all");
    const lifeEvents = filterTimelineByEra(universe.timeline, "life");

    expect(allEvents).toEqual(universe.timeline);
    expect(lifeEvents.length).toBeGreaterThan(0);
    expect(lifeEvents.every((event) => event.era === "life")).toBe(true);
    expect(universe.timeline.length).toBeGreaterThan(lifeEvents.length);
  });

  it("关键事件包含因果解释和可追踪影响来源", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[2], templateId: "causal_fracture" });
    const keyEvents = universe.timeline.filter((event) => event.importance >= 75);

    expect(keyEvents.length).toBeGreaterThan(0);
    expect(keyEvents.every((event) => event.causalNotes.length > 0 && event.sourceIds.length > 0 && event.location)).toBe(true);
  });

  it("至少 5 类事件会影响后续生成结果", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[3], templateId: "chaotic_laws" });
    const futureAffectingTypes = new Set<EventType>();

    for (const event of universe.timeline) {
      if (event.effects.some((effect) => effect.affectsFuture)) {
        futureAffectingTypes.add(event.type);
      }
    }

    expect(futureAffectingTypes.size).toBeGreaterThanOrEqual(5);
  });

  it("部分事件会引用前序事件作为触发来源，且引用目标存在", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[4], templateId: "reincarnation_cycle" });
    const eventIds = new Set(universe.timeline.map((event) => event.id));
    const linkedEvents = universe.timeline.filter((event) => event.triggeredByEventIds.length > 0);

    expect(linkedEvents.length).toBeGreaterThan(0);
    expect(linkedEvents.every((event) => event.triggeredByEventIds.every((eventId) => eventIds.has(eventId)))).toBe(true);
  });

  it("同一 seed、模板和规则版本会生成完全一致的阶段 3 时间线", () => {
    const first = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[0], templateId: "mechanical_divinity" });
    const second = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[0], templateId: "mechanical_divinity" });

    expect(second.timeline).toEqual(first.timeline);
  });

  it("时间线影响摘要可作为阶段 4 局部对象生成上下文", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[0], templateId: "high_magic" });
    const eventIds = new Set(universe.timeline.map((event) => event.id));

    expect(universe.timelineImpact.eventCount).toBe(universe.timeline.length);
    expect(universe.timelineImpact.futureAffectingEventCount).toBeGreaterThan(0);
    expect(universe.timelineImpact.localBiases).toHaveLength(8);
    expect(universe.timelineImpact.eraProfiles).toHaveLength(eraIds.length);
    expect(universe.timelineImpact.keySourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);

    for (const metricId of metricIds) {
      expect(typeof universe.timelineImpact.metricDeltas[metricId]).toBe("number");
    }

    for (const bias of universe.timelineImpact.localBiases) {
      expect(bias.value).toBeGreaterThanOrEqual(0);
      expect(bias.value).toBeLessThanOrEqual(100);
      expect(bias.sourceEventIds.length).toBeGreaterThan(0);
      expect(bias.sourceEventIds.every((eventId) => eventIds.has(eventId))).toBe(true);
    }
  });
});
