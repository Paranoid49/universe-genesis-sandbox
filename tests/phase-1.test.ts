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
    const first = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const second = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });

    expect(first.rulesetVersion).toBe(RULESET_VERSION);
    expect(second).toEqual(first);
  });

  it("不同 seed 会产生可感知差异", () => {
    const first = generateUniverse({ seed: fixedSeeds[0], templateId: "high_magic" });
    const second = generateUniverse({ seed: fixedSeeds[1], templateId: "high_magic" });

    expect(second.name === first.name && second.tagline === first.tagline && second.timeline[0].title === first.timeline[0].title).toBe(false);
  });

  it("10 个模板都能生成非空宇宙", () => {
    for (const template of UNIVERSE_TEMPLATES) {
      const universe = generateUniverse({ seed: fixedSeeds[2], templateId: template.id });

      expectCompleteUniverse(universe);
      expect(universe.templateId).toBe(template.id);
      expect(universe.templateShortCode).toBe(template.shortCode);
    }
  });

  it("分享码和链接参数能恢复复现信息", () => {
    const universe = generateUniverse({ seed: fixedSeeds[3], templateId: "mechanical_divinity" });

    expect(universe.rulesetShortCode).toBe(RULESET_SHORT_CODE);
    expect(universe.shareCode.startsWith(`${RULESET_SHORT_CODE}-`)).toBe(true);
    expect(decodeShareCode(universe.shareCode)).toEqual({
      seed: universe.seed,
      templateId: universe.templateId,
      rulesetVersion: universe.rulesetVersion,
      warnings: [],
    });

    expect(decodeShareParams(universe.shareUrl)).toEqual({
      seed: universe.seed,
      templateId: universe.templateId,
      rulesetVersion: universe.rulesetVersion,
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
      const universe = generateUniverse({ seed: `SMOKE-${String(index).padStart(2, "0")}-UGS`, templateId: template.id });
      expectCompleteUniverse(universe);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it("模拟核心不直接使用 Math.random", () => {
    const sourceRoot = pathFromTest(import.meta.url, "../src/sim");
    const offenders = listSourceFiles(sourceRoot).filter((file) => readFileSync(file, "utf8").includes("Math.random"));

    expect(offenders).toEqual([]);
  });
});

describe("规则版本门禁", () => {
  it("生成规则内容变化时必须同步更新规则版本哈希", () => {
    const sourceRoot = pathFromTest(import.meta.url, "../src/sim");
    const actualHash = rulesetContentHash(sourceRoot);

    if (actualHash !== expectedRulesetContentHash) {
      throw new Error(`生成规则内容哈希已变化。若本次变更会影响生成结果，请更新 RULESET_VERSION、RULESET_SHORT_CODE 和该测试基线。当前哈希：${actualHash}`);
    }

    expect(actualHash).toBe(expectedRulesetContentHash);
  });
});
