import type { CausalUniverseSource } from "./causality-source";
import type { CausalGraph, CausalValidationResult } from "./contracts/causality";
import type { GenerateUniverseInput } from "./types";
import {
  getDirectCauses,
  getDirectEffects,
  traceCausalAncestors,
  traceCausalDescendants,
  validateCausalGraphStructure,
} from "./causality-query";
import { freezeCausalGraph } from "./causality-freeze";
import { appendCausalProjectionStructure, type CausalProjectionSpec } from "./causality-projection";
import { assertUniverseReplayMatches, generateUniverseData } from "./universe-generation";
import { buildCausalGraphStructure } from "./causality-build";
import { assertRandomResultBindingsResolve, randomResultBindingsMatchExpected } from "./causality-random-bindings";
import { randomTraceMatchesExpected } from "./random-transcript";
import { isCertifiedStateValueProjectionSpec } from "./state-value-projection";

export { getDirectCauses, getDirectEffects, traceCausalAncestors, traceCausalDescendants };
export type { CausalProjectionSpec };

const certifiedGraphs = new WeakSet<object>();
const validCertificationResult: CausalValidationResult = Object.freeze({
  valid: true,
  issues: Object.freeze([]),
});

export function buildUniverseCausalGraph(
  input: GenerateUniverseInput,
  initialUniverse: CausalUniverseSource,
): CausalGraph {
  const replay = generateUniverseData(input, true);
  assertUniverseReplayMatches(initialUniverse, replay.baseSummary);
  const randomTrace = replay.root.getTrace();
  const expectedRandomTrace = structuredClone(randomTrace);
  const { graph, expectedRandomBindings } = buildCausalGraphStructure({
    universe: replay.baseSummary,
    randomTrace,
    interventions: input.interventions ?? [],
    generation: replay.generation,
  });
  if (!randomTraceMatchesExpected(graph.randomTrace, expectedRandomTrace)) {
    throw new Error("因果图随机调用转录与受控重放结果不一致。");
  }
  if (!randomResultBindingsMatchExpected(graph.randomResultBindings, expectedRandomBindings)) {
    throw new Error("因果图随机结果绑定与受控构建记录不一致。");
  }
  assertRandomResultBindingsResolve(replay.baseSummary, graph.randomResultBindings);
  return certifyBuiltGraph(graph);
}

export function validateCausalGraph(graph: CausalGraph): CausalValidationResult {
  if (certifiedGraphs.has(graph)) return validCertificationResult;
  const structure = validateCausalGraphStructure(graph, graph.generation);
  return {
    valid: false,
    issues: [
      { code: "UNTRUSTED_CAUSAL_GRAPH", message: "因果图未经过受控完整生成认证。" },
      ...structure.issues,
    ],
  };
}

export function assertCausalGraph(graph: CausalGraph): void {
  const result = validateCausalGraph(graph);
  if (!result.valid) throw new Error(`因果闭包校验失败：${result.issues.map((issue) => `[${issue.code}] ${issue.message}`).join("；")}`);
}

export function serializeCausalGraph(graph: CausalGraph): string {
  assertCausalGraph(graph);
  return JSON.stringify(graph);
}

export function appendCausalProjections(graph: CausalGraph, specs: readonly CausalProjectionSpec[]): CausalGraph {
  assertCausalGraph(graph);
  if (specs.some((spec) => !isCertifiedStateValueProjectionSpec(spec))) {
    throw new Error("状态值投影未经过受控公式、操作数与随机决定认证。");
  }
  const projected = appendCausalProjectionStructure(graph, specs);
  if (JSON.stringify(projected.randomTrace) !== JSON.stringify(graph.randomTrace)
    || JSON.stringify(projected.randomResultBindings) !== JSON.stringify(graph.randomResultBindings)) {
    throw new Error("观察投影不得改写随机调用转录或结果绑定。");
  }
  return freezeCausalGraph(projected);
}

function certifyBuiltGraph(graph: CausalGraph): CausalGraph {
  const frozen = freezeCausalGraph(graph);
  certifiedGraphs.add(frozen);
  return frozen;
}
