import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CausalGenerationManifest,
  CausalGraph,
  CausalRandomResultBinding,
  GenerateUniverseInput,
  RandomTraceSnapshot,
} from "../src/sim";
import type { CausalUniverseSource } from "../src/sim/causality-model";

const input: GenerateUniverseInput = {
  seed: "FACTORY-GUARD",
  rulesetVersion: "fixture-ruleset",
  templateId: "hard_science",
};

const generation: CausalGenerationManifest = {
  version: "fixture-inputs",
  id: "fixture-generation",
  inputs: [],
};

const trace: RandomTraceSnapshot = {
  algorithmVersion: "fixture-random",
  generationId: generation.id,
  seedMaterial: "fixture-seed",
  seedFingerprint: "00000000",
  totalSamples: 0,
  streams: [],
};

const universe = {
  seed: input.seed,
  rulesetVersion: input.rulesetVersion,
  templateId: input.templateId,
} as CausalUniverseSource;

afterEach(() => {
  vi.doUnmock("../src/sim/universe-generation");
  vi.doUnmock("../src/sim/causality-build");
  vi.resetModules();
});

describe("生产因果工厂转录守卫", () => {
  it("通过完整生产入口命中随机调用转录不一致分支", async () => {
    const graph = fixtureGraph({ ...trace, totalSamples: 1 });
    const factory = await loadFactory({ graph, expectedRandomBindings: [] });
    expect(() => factory.buildUniverseCausalGraph(input, universe)).toThrow("因果图随机调用转录与受控重放结果不一致");
  });

  it("通过完整生产入口命中随机结果绑定转录不一致分支", async () => {
    const expectedBinding: CausalRandomResultBinding = {
      decisionId: "fixture-decision",
      resultNodeId: "fixture-node",
      resultSubjectId: "fixture-event",
      nodeKind: "timeline_event",
      bindingKind: "collection_member",
      locator: {
        kind: "entity_id",
        entityKind: "timeline_event",
        entityId: "fixture-event",
        containerKind: "collection_member",
      },
      outputValueFingerprint: "fnv1a32:00000000",
    };
    const factory = await loadFactory({ graph: fixtureGraph(trace), expectedRandomBindings: [expectedBinding] });
    expect(() => factory.buildUniverseCausalGraph(input, universe)).toThrow("因果图随机结果绑定与受控构建记录不一致");
  });
});

async function loadFactory(result: { graph: CausalGraph; expectedRandomBindings: CausalRandomResultBinding[] }) {
  vi.resetModules();
  vi.doMock("../src/sim/universe-generation", () => ({
    assertUniverseReplayMatches: vi.fn(),
    generateUniverseData: vi.fn(() => ({
      baseSummary: universe,
      generation,
      root: { getTrace: () => trace },
    })),
  }));
  vi.doMock("../src/sim/causality-build", () => ({
    buildCausalGraphStructure: vi.fn(() => result),
  }));
  return import("../src/sim/causality");
}

function fixtureGraph(randomTrace: RandomTraceSnapshot): CausalGraph {
  return {
    version: "fixture-causality",
    randomBindingVersion: "fixture-bindings",
    generation,
    rootNodeIds: [],
    nodes: [],
    edges: [],
    cycleAuthorizations: [],
    randomTrace,
    randomResultBindings: [],
  };
}
