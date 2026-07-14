import { useMemo, useState } from "react";
import { assertGenerateUniverseInput, normalizeSeed, RULESET_VERSION, UniverseInputError, type UniverseSummary } from "../sim";
import type { CausalProjectionRequest } from "./causalView";
import {
  buildLawComparisonCausalProjection,
  buildLawComparisonView,
  generateLawComparisonUniverse,
  type LawComparisonSide,
  type LawComparisonTraceTarget,
} from "./lawComparisonCausalProjection";

const DEFAULT_COMPARE_SEED = "ASH-44DE-0101";

export function useLawComparisonModel(
  active: boolean,
  leftUniverse: UniverseSummary,
  openCausalProjection: (request: CausalProjectionRequest) => void,
) {
  const [draftSeed, setDraftSeed] = useState(DEFAULT_COMPARE_SEED);
  const [activeSeed, setActiveSeed] = useState(normalizeSeed(DEFAULT_COMPARE_SEED));
  const [inputError, setInputError] = useState<string>();
  const rightUniverse = useMemo(
    () => active ? generateLawComparisonUniverse(leftUniverse, activeSeed) : undefined,
    [active, activeSeed, leftUniverse],
  );
  const comparison = useMemo(
    () => rightUniverse ? buildLawComparisonView(leftUniverse, rightUniverse) : undefined,
    [leftUniverse, rightUniverse],
  );

  function compareNow() {
    try {
      assertGenerateUniverseInput({ seed: draftSeed, rulesetVersion: RULESET_VERSION, templateId: leftUniverse.templateId });
    } catch (error) {
      setInputError(`对比 Seed 无效：${error instanceof UniverseInputError ? error.message : "输入无法用于生成宇宙。"}`);
      return;
    }
    setInputError(undefined);
    setActiveSeed(normalizeSeed(draftSeed));
  }

  function changeDraftSeed(value: string) {
    setDraftSeed(value);
    if (inputError) setInputError(undefined);
  }

  function trace(side: LawComparisonSide, target: LawComparisonTraceTarget) {
    if (!comparison || !rightUniverse) return;
    const universe = side === "left" ? leftUniverse : rightUniverse;
    openCausalProjection({
      universe,
      returnFocusKey: `law-comparison.${side}.${target}`,
      buildProjection: (causalUniverse) => buildLawComparisonCausalProjection(
        side === "left" ? causalUniverse : leftUniverse,
        side === "right" ? causalUniverse : rightUniverse,
        comparison,
        side,
        target,
      ),
    });
  }

  return {
    clearInputError: () => setInputError(undefined),
    compareNow,
    comparison,
    draftSeed,
    inputError,
    setDraftSeed: changeDraftSeed,
    trace,
  };
}
