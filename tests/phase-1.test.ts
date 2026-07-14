import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  decodeShareCode,
  decodeShareParams,
  generateUniverse,
  RULESET_SHORT_CODE,
  RULESET_VERSION,
  UNIVERSE_TEMPLATES,
} from "../src/sim";
import {
  expectedRulesetContentHash,
  expectCompleteUniverse,
  fixedSeeds,
  listSourceFiles,
  pathFromTest,
  rulesetContentHash,
} from "./helpers";

describe("阶段 1 宇宙生成", () => {
  it("同一 seed、模板和规则版本会生成完全一致的宇宙", () => {
    const first = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[0], templateId: "high_magic" });
    const second = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[0], templateId: "high_magic" });

    expect(first.rulesetVersion).toBe(RULESET_VERSION);
    expect(second).toEqual(first);
  });

  it("不同 seed 会产生可感知差异", () => {
    const first = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[0], templateId: "high_magic" });
    const second = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[1], templateId: "high_magic" });

    expect(second.name === first.name && second.tagline === first.tagline && second.timeline[0].title === first.timeline[0].title).toBe(false);
  });

  it("10 个模板都能生成非空宇宙", () => {
    for (const template of UNIVERSE_TEMPLATES) {
      const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[2], templateId: template.id });

      expectCompleteUniverse(universe);
      expect(universe.templateId).toBe(template.id);
      expect(universe.templateShortCode).toBe(template.shortCode);
    }
  });

  it("分享码和链接参数能恢复复现信息", () => {
    const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: fixedSeeds[3], templateId: "mechanical_divinity" });

    expect(universe.rulesetShortCode).toBe(RULESET_SHORT_CODE);
    expect(universe.shareCode.startsWith(`${RULESET_SHORT_CODE}-`)).toBe(true);
    expect(decodeShareCode(universe.shareCode)).toEqual({
      seed: universe.seed,
      templateId: universe.templateId,
      rulesetVersion: universe.rulesetVersion,
      interventions: [],
      warnings: [],
    });

    expect(decodeShareParams(universe.shareUrl)).toEqual({
      seed: universe.seed,
      templateId: universe.templateId,
      rulesetVersion: universe.rulesetVersion,
      interventions: [],
      warnings: [],
    });
  });

  it("无法识别分享短码时会回退并给出提示", () => {
    const decoded = decodeShareParams("?s=LUX7F3A91C2&t=NOPE&v=UNKNOWN");

    expect(decoded?.seed).toBe("LUX7F3A91C2");
    expect(decoded?.templateId).toBe("high_magic");
    expect(decoded?.rulesetVersion).toBe(RULESET_VERSION);
    expect(decoded?.warnings.length).toBe(2);
  });

  it("损坏的干预分享载荷会被忽略并给出提示", () => {
    const decoded = decodeShareParams(`?s=LUX7F3A91C2&t=HM&v=${RULESET_SHORT_CODE}&iv=1&i=broken`);
    expect(decoded?.interventions).toEqual([]);
    expect(decoded?.warnings.some((warning) => warning.includes("干预分享数据损坏"))).toBe(true);
  });

  it("空 Seed 和未知模板会被运行时边界拒绝", () => {
    expect(() => generateUniverse({ rulesetVersion: RULESET_VERSION, seed: "" })).toThrowError(/Seed/);
    expect(() => generateUniverse({ rulesetVersion: RULESET_VERSION, seed: "VALID", templateId: "unknown" as never })).toThrowError(/未知宇宙模板/);
  });

  it("缺失或不匹配的规则版本会被运行时边界拒绝", () => {
    expect(() => generateUniverse({ seed: "VALID" } as never)).toThrowError(/规则版本/);
    expect(() => generateUniverse({ seed: "VALID", rulesetVersion: "ugs-ruleset@0.5.0" })).toThrowError(/不受支持/);
  });

  it("非当前规则短码不做兼容解析，只按当前规则提示处理", () => {
    const decoded = decodeShareParams("?s=LUX7F3A91C2&t=HM&v=UGS03");

    expect(decoded?.seed).toBe("LUX7F3A91C2");
    expect(decoded?.templateId).toBe("high_magic");
    expect(decoded?.rulesetVersion).toBe(RULESET_VERSION);
    expect(decoded?.warnings.length).toBe(1);
    expect(decoded?.warnings[0]).toContain("不受当前版本支持");
  });

  it("50 个 seed 冒烟测试不出现空白字段或事件数量异常", () => {
    const start = performance.now();
    for (let index = 0; index < 50; index += 1) {
      const template = UNIVERSE_TEMPLATES[index % UNIVERSE_TEMPLATES.length];
      const universe = generateUniverse({ rulesetVersion: RULESET_VERSION, seed: `SMOKE-${String(index).padStart(2, "0")}-UGS`, templateId: template.id });
      expectCompleteUniverse(universe);
    }
    const elapsed = performance.now() - start;
    const performanceBudget = process.env.npm_lifecycle_event?.startsWith("test:coverage") ? 5000 : 2000;
    expect(elapsed).toBeLessThan(performanceBudget);
  });

  it("模拟核心不直接使用 Math.random", () => {
    const sourceRoot = pathFromTest(import.meta.url, "../src/sim");
    const offenders = listSourceFiles(sourceRoot).filter((file) => readFileSync(file, "utf8").includes("Math.random"));

    expect(offenders).toEqual([]);
  });
});

describe("规则与因果契约版本门禁", () => {
  it("模拟核心内容变化时必须同步更新对应版本哈希", () => {
    const sourceRoot = pathFromTest(import.meta.url, "../src/sim");
    const actualHash = rulesetContentHash(sourceRoot);

    if (actualHash !== expectedRulesetContentHash) {
      throw new Error(`模拟核心内容哈希已变化。若旧领域结果变化，请更新 RULESET_VERSION 与 RULESET_SHORT_CODE；若因果证据契约变化，请更新 CAUSAL_GRAPH_VERSION；若运行时语义变化，请更新对应运行时契约版本；随后更新该测试基线。当前哈希：${actualHash}`);
    }

    expect(actualHash).toBe(expectedRulesetContentHash);
  });
});
