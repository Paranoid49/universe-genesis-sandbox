import { beforeAll, describe, expect, it } from "vitest";
import * as sim from "../src/sim";
import { summaryCollectionEvidenceIssues } from "../src/sim/causality-summary-validation";
import {
  appendCausalProjections,
  assertCausalGraph,
  buildLawComparisonEvidence,
  buildStateValueCausalProjection,
  CAUSAL_CYCLE_REQUIRED_CONSTRAINTS,
  CAUSAL_GENERATION_MANIFEST_VERSION,
  CAUSAL_GRAPH_VERSION,
  CAUSAL_RANDOM_BINDING_VERSION,
  generateCausalUniverse,
  generateUniverse,
  compareUniverseLaws,
  getDirectCauses,
  getDirectEffects,
  RANDOM_ALGORITHM_VERSION,
  RULESET_VERSION,
  serializeCausalGraph,
  traceCausalAncestors,
  traceCausalDescendants,
  validateCausalGraph,
  type CausalCycleAuthorization,
  type CausalEdge,
  type CausalGraph,
  type CausalGenerationManifest,
  type CausalInputRecord,
  type CausalNode,
  type CausalNodeKind,
  type CausalRandomSampleRef,
  type CausalRandomResultBinding,
  type CausalValidationIssue,
  type CausalValidationIssueCode,
  type GenerateUniverseInput,
  type RandomDecisionRecord,
  type RandomStreamMetadata,
  type RandomTraceSnapshot,
  type UniverseSummary,
} from "../src/sim";
import { causalGenerationManifestId } from "../src/sim/causality-generation";
import { randomCandidateSetId, randomSeedFingerprint } from "../src/sim/random";
import { replayRandomSample } from "../src/sim/random-replay";
import { validateCausalGraphStructure } from "../src/sim/causality-query";
import { CausalGraphBuilder, derived } from "../src/sim/causality-builder";
import { assertRandomResultBindingsResolve, randomResultBindingsMatchExpected } from "../src/sim/causality-random-bindings";
import { createDomainLocator } from "../src/sim/causality-domain-locators";
import { randomTraceMatchesExpected } from "../src/sim/random-transcript";

let causalInput: GenerateUniverseInput;
let generatedUniverse: UniverseSummary;

describe("步骤 1 因果闭包契约", () => {
  beforeAll(() => {
    const base = generateUniverse({
      rulesetVersion: RULESET_VERSION,
      seed: "CAUSE-TRACE-001",
      templateId: "high_magic",
    });
    causalInput = {
      rulesetVersion: RULESET_VERSION,
      seed: "CAUSE-TRACE-001",
      templateId: "high_magic",
      interventions: [{
        id: "step-1-blessing",
        miracleType: "bless_planet",
        targetId: base.galaxies[0].starSystems[0].planets[0].id,
      }],
    };
    generatedUniverse = generateCausalUniverse(causalInput);
  }, 30_000);

  it("显式因果 API 返回前完成闭包校验，兼容 API 保持非枚举惰性边界", () => {
    const cachedValidation = validateCausalGraph(generatedUniverse.causalGraph);
    expect(cachedValidation).toEqual({ valid: true, issues: [] });
    expect(Object.isFrozen(cachedValidation)).toBe(true);
    expect(Object.isFrozen(cachedValidation.issues)).toBe(true);
    expect(Reflect.set(cachedValidation, "valid", false)).toBe(false);
    expect(Reflect.set(cachedValidation, "issues", [{ code: "ORPHAN_NODE", message: "伪造问题" }])).toBe(false);
    expect(() => (cachedValidation.issues as CausalValidationIssue[]).push({ code: "ORPHAN_NODE", message: "伪造问题" })).toThrow();
    expect(validateCausalGraph(generatedUniverse.causalGraph)).toEqual({ valid: true, issues: [] });
    expect(() => assertCausalGraph(generatedUniverse.causalGraph)).not.toThrow();
    expect(Object.isFrozen(generatedUniverse.causalGraph)).toBe(true);
    expect(Object.isFrozen(generatedUniverse.causalGraph.generation)).toBe(true);
    expect(Object.isFrozen(generatedUniverse.causalGraph.generation.inputs)).toBe(true);
    expect(Object.isFrozen(generatedUniverse.causalGraph.nodes)).toBe(true);
    expect(Object.isFrozen(generatedUniverse.causalGraph.nodes[0])).toBe(true);
    const serializedBeforeMutation = serializeCausalGraph(generatedUniverse.causalGraph);
    const locatorPayloadFields = {
      root_field: "field",
      mapping_key: "key",
      entity_id: "entityId",
      collection_quantity: "collection",
      negative_fact: "predicate",
    } as const;
    for (const binding of generatedUniverse.causalGraph.randomResultBindings) {
      expect(Object.isFrozen(binding.locator)).toBe(true);
      expect(Reflect.set(binding.locator, "kind", "forged")).toBe(false);
      expect(Reflect.set(binding.locator, locatorPayloadFields[binding.locator.kind], "forged")).toBe(false);
    }
    expect(validateCausalGraph(generatedUniverse.causalGraph)).toEqual({ valid: true, issues: [] });
    expect(serializeCausalGraph(generatedUniverse.causalGraph)).toBe(serializedBeforeMutation);

    const compatible = generateUniverse(causalInput);
    const beforeGraphAccess = JSON.stringify(compatible);
    const descriptor = Object.getOwnPropertyDescriptor(compatible, "causalGraph");
    expect(descriptor?.enumerable).toBe(false);
    expect(beforeGraphAccess).not.toContain(CAUSAL_GRAPH_VERSION);
    expect(compatible.causalGraph).toEqual(generatedUniverse.causalGraph);
    expect(JSON.stringify(compatible)).toBe(beforeGraphAccess);

    const compactGraph = validFixture();
    expect(validateCausalGraphStructure(compactGraph, compactGraph.generation)).toEqual({ valid: true, issues: [] });
    const untrusted = validateCausalGraph(compactGraph);
    expect(Reflect.set(untrusted.issues[0], "message", "伪造问题内容")).toBe(true);
    expect(validateCausalGraph(compactGraph).issues[0].message).not.toBe("伪造问题内容");
    expect(() => serializeCausalGraph(compactGraph)).toThrow(/UNTRUSTED_CAUSAL_GRAPH/);
    expect(JSON.parse(serializeCausalGraph(generatedUniverse.causalGraph)).version).toBe(CAUSAL_GRAPH_VERSION);
  }, 30_000);

  it("为全部当前可见派生结果建立稳定且可查询的节点", () => {
    const graph = generatedUniverse.causalGraph;
    const expectedSubjects = visibleDerivedSubjects(generatedUniverse);
    for (const [kind, subjectIds] of Object.entries(expectedSubjects) as Array<[CausalNodeKind, string[]]>) {
      const actualNodes = graph.nodes.filter((node) => node.kind === kind);
      expect(actualNodes.map((node) => node.subjectId), `缺少 ${kind} 类型的可见结果节点`).toEqual(
        expect.arrayContaining(subjectIds),
      );
      const visibleNodes = kind === "collection_boundary"
        ? actualNodes.filter((node) => !node.subjectId.startsWith("civilization.stats.paths.member.")
          && !node.subjectId.startsWith("civilization.stats.paths.group.")
          && !node.subjectId.startsWith("civilization.stats.mythologies.member.")
          && !node.subjectId.startsWith("civilization.stats.mythologies.group.")
          && !node.subjectId.startsWith("civilization.stats.highRisk.member."))
        : actualNodes;
      expect(visibleNodes, `${kind} 类型存在未对应可见结果的重复节点`).toHaveLength(subjectIds.length);
    }
  }, 30_000);

  it("所有派生节点都有原因、规则和合法根路径，静态创世显式接入 initial_state", () => {
    const graph = generatedUniverse.causalGraph;
    const roots = new Set(graph.rootNodeIds);
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const reachability = new Map<string, boolean>();

    for (const node of graph.nodes) {
      if (node.root) {
        expect(roots.has(node.id)).toBe(true);
        expect(["input", "axiom", "initial_state"]).toContain(node.root);
        expect(node.kind).toBe(node.root);
        expect(node.directCauseIds).toEqual([]);
      } else {
        expect(node.directCauseIds.length, `派生节点 ${node.id} 没有直接原因`).toBeGreaterThan(0);
        expect(node.ruleIds.length, `派生节点 ${node.id} 没有适用规则`).toBeGreaterThan(0);
        expect(reachesLegalRoot(node.id, nodes, roots, reachability, new Set()), `节点 ${node.id} 没有合法根路径`).toBe(true);
      }
    }

    const initialSubjects = graph.nodes.filter((node) => node.root === "initial_state").map((node) => node.subjectId);
    expect(initialSubjects).toEqual(expect.arrayContaining([
      "initial-state:template-configuration",
      "initial-state:creation-origin",
    ]));
    const creationOrigin = graph.nodes.find((node) => node.subjectId === "initial-state:creation-origin");
    expect(creationOrigin).toBeDefined();
    expect(traceCausalDescendants(graph, creationOrigin!.id).some((node) => node.kind === "timeline_event")).toBe(true);

    const activeRoot = graph.nodes.find((node) => node.root && node.directEffectIds.length > 0);
    expect(activeRoot).toBeDefined();
    expect(traceCausalDescendants(graph, activeRoot!.id).length).toBeGreaterThan(0);

    expect(graph.generation.inputs.map((input) => input.kind)).toEqual([
      "seed",
      "ruleset_version",
      "creation_template",
      "intervention",
    ]);
    expect(graph.generation.inputs.map((input) => input.order)).toEqual([0, 1, 2, 3]);
    expect(graph.generation.inputs[0].value).toBe(generatedUniverse.seed);
    expect(graph.generation.inputs[1].value).toBe(generatedUniverse.rulesetVersion);
    expect(graph.generation.inputs[2].value).toBe(generatedUniverse.templateId);
    expect(graph.generation.inputs[3].value).toContain("step-1-blessing");
    expect(graph.randomTrace.generationId).toBe(graph.generation.id);
  });

  it("边端点与双向邻接索引保持一致", () => {
    const graph = generatedUniverse.causalGraph;
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const causesByEffect = new Map<string, string[]>();
    const effectsByCause = new Map<string, string[]>();
    for (const edge of graph.edges) {
      expect(nodes.has(edge.from), `边 ${edge.id} 缺少原因端点`).toBe(true);
      expect(nodes.has(edge.to), `边 ${edge.id} 缺少结果端点`).toBe(true);
      causesByEffect.set(edge.to, [...(causesByEffect.get(edge.to) ?? []), edge.from]);
      effectsByCause.set(edge.from, [...(effectsByCause.get(edge.from) ?? []), edge.to]);
    }
    for (const node of graph.nodes) {
      expect([...(causesByEffect.get(node.id) ?? [])].sort()).toEqual([...node.directCauseIds].sort());
      expect([...(effectsByCause.get(node.id) ?? [])].sort()).toEqual([...node.directEffectIds].sort());
    }
    const sample = graph.nodes.find((node) => node.directCauseIds.length > 0 && node.directEffectIds.length > 0)!;
    expect(getDirectCauses(graph, sample.id).map((node) => node.id).sort()).toEqual([...sample.directCauseIds].sort());
    expect(getDirectEffects(graph, sample.id).map((node) => node.id).sort()).toEqual([...sample.directEffectIds].sort());
  });

  it("每个随机引用绑定单次实际决策、候选集标识和选中值，不再复用整段命名空间", () => {
    const graph = generatedUniverse.causalGraph;
    const trace = graph.randomTrace;
    expect(trace.algorithmVersion).toBe(RANDOM_ALGORITHM_VERSION);
    expect(trace.generationId).toBe(graph.generation.id);
    expect(trace.totalSamples).toBe(trace.streams.reduce((sum, stream) => sum + stream.sampleCount, 0));

    const streams = new Map(trace.streams.map((stream) => [stream.streamId, stream]));
    const decisions = new Map(trace.streams.flatMap((stream) => (stream.decisions ?? []).map((decision) => [decision.decisionId, decision])));
    const references = graph.nodes.flatMap((node) => node.randomSampleRefs);
    expect(references.length).toBeGreaterThan(0);
    for (const stream of trace.streams) {
      expect(stream.lastSampleIndex).toBe(stream.sampleCount === 0 ? null : stream.sampleCount);
      expect(stream.decisions).toHaveLength(stream.sampleCount);
      expect((stream.decisions ?? []).map((decision) => decision.sampleIndex)).toEqual(
        Array.from({ length: stream.sampleCount }, (_, index) => index + 1),
      );
    }
    for (const reference of references) {
      const stream = streams.get(reference.streamId);
      const decision = decisions.get(reference.decisionId ?? "");
      expect(stream).toBeDefined();
      expect(decision).toBeDefined();
      expect(stream?.decisions.some((candidate) => candidate.decisionId === reference.decisionId)).toBe(true);
      expect(reference.sampleIndexes).toEqual([decision?.sampleIndex]);
      expect(reference.firstSampleIndex).toBe(reference.lastSampleIndex);
      expect(reference.firstSampleIndex).toBe(decision?.sampleIndex);
      expect(reference.candidateSetId).toBe(decision?.candidateSetId);
      expect(reference.candidateSetId).not.toBe("");
      expect(reference.selectedValue).toBe(decision?.selectedValue);
      expect(reference.purpose).not.toBe("");
    }

    const physicsLaws = graph.nodes.filter((node) => node.kind === "law" && node.subjectId.startsWith("physics."));
    expect(physicsLaws).toHaveLength(2);
    expect(intersection(decisionIds(physicsLaws[0]), decisionIds(physicsLaws[1]))).toEqual([]);
    const timelineEvents = graph.nodes.filter((node) => node.kind === "timeline_event" && !node.subjectId.startsWith("miracle")).slice(0, 2);
    expect(timelineEvents).toHaveLength(2);
    expect(intersection(decisionIds(timelineEvents[0]), decisionIds(timelineEvents[1]))).toEqual([]);

    const swappedStream = validFixture();
    const sharedDecision = (streamId: string): MutableDecision => ({
      decisionId: `${streamId}:1`,
      sampleIndex: 1,
      sampleValue: replayRandomSample("fixture-ruleset:fixture-template:fixture-seed", "shared", 1),
      operation: "pick",
      parameters: { kind: "pick", candidates: ["A", "B"] },
      candidateSetId: randomCandidateSetId(["A", "B"]),
      candidates: ["A", "B"],
      selectedValue: "A",
    });
    swappedStream.randomTrace.totalSamples = 2;
    swappedStream.randomTrace.streams = ["stream-a", "stream-b"].map((streamId) => ({
      algorithmVersion: RANDOM_ALGORITHM_VERSION,
      streamId,
      namespace: "shared",
      seedFingerprint: swappedStream.randomTrace.seedFingerprint,
      sampleCount: 1,
      lastSampleIndex: 1,
      decisions: [sharedDecision(streamId)],
    }));
    swappedStream.nodes.find((node) => node.id === "n1")!.randomSampleRefs = [{
      decisionId: "stream-a:1",
      streamId: "stream-b",
      namespace: "shared",
      sampleIndexes: [1],
      firstSampleIndex: 1,
      lastSampleIndex: 1,
      purpose: "交换随机流",
      candidateSetId: randomCandidateSetId(["A", "B"]),
      selectedValue: "A",
    }];
    expect(issueCodes(swappedStream)).toContain("INVALID_RANDOM_REFERENCE");

    const forgedSemantics = cloneGraph(graph);
    const forgedDecision = forgedSemantics.randomTrace.streams
      .flatMap((stream) => stream.decisions)
      .find((decision) => decision.operation === "pick" && decision.candidates.length > 1)!;
    forgedDecision.candidateSetId = "set:forged";
    forgedDecision.candidates = ["伪造候选"];
    forgedDecision.selectedValue = "不在候选集合中的结果";
    for (const node of forgedSemantics.nodes) {
      for (const reference of node.randomSampleRefs.filter((entry) => entry.decisionId === forgedDecision.decisionId)) {
        reference.candidateSetId = forgedDecision.candidateSetId;
        reference.selectedValue = forgedDecision.selectedValue;
      }
    }
    expect(issueCodes(forgedSemantics)).toContain("INVALID_RANDOM_TRACE");

    const unknownOperation = cloneGraph(graph);
    const unknownDecision = unknownOperation.randomTrace.streams.flatMap((stream) => stream.decisions)[0];
    unknownDecision.operation = "forged" as RandomDecisionRecord["operation"];
    expect(issueCodes(unknownOperation)).toContain("INVALID_RANDOM_TRACE");

    const movedReference = cloneGraph(graph);
    const sourceNode = movedReference.nodes.find((node) => node.kind === "negative_fact" && node.randomSampleRefs.length > 0)!;
    const targetNode = movedReference.nodes.find((node) => node.kind === "share_result" && node.subjectId === "share.code")!;
    const moved = sourceNode.randomSampleRefs.pop()!;
    moved.resultSubjectId = targetNode.subjectId;
    targetNode.randomSampleRefs.push(moved);
    const movedBinding = movedReference.randomResultBindings.find((binding) => binding.decisionId === moved.decisionId
      && binding.resultNodeId === sourceNode.id)!;
    movedBinding.resultNodeId = targetNode.id;
    movedBinding.resultSubjectId = targetNode.subjectId;
    movedBinding.nodeKind = targetNode.kind;
    movedBinding.bindingKind = "field";
    movedBinding.locator = { kind: "root_field", field: "shareCode" };
    expect(validateCausalGraphStructure(movedReference, movedReference.generation)).toEqual({ valid: true, issues: [] });
    expect(validateCausalGraph(movedReference).issues.map((issue) => issue.code)).toContain("UNTRUSTED_CAUSAL_GRAPH");
    expect(() => serializeCausalGraph(movedReference)).toThrow(/UNTRUSTED_CAUSAL_GRAPH/);

    expect("certifyCausalGraph" in sim).toBe(false);
    for (const operation of ["next", "range", "int", "bool", "pick", "weighted"] as const) {
      const converted = cloneGraph(graph);
      const decision = converted.randomTrace.streams.flatMap((stream) => stream.decisions)[0];
      rewriteDecisionOperation(decision, operation);
      for (const node of converted.nodes) {
        for (const reference of node.randomSampleRefs.filter((entry) => entry.decisionId === decision.decisionId)) {
          reference.candidateSetId = decision.candidateSetId;
          reference.selectedValue = decision.selectedValue;
        }
      }
      expect(validateCausalGraphStructure(converted, converted.generation), `${operation} 转录结构应保持自洽`).toEqual({ valid: true, issues: [] });
      expect(validateCausalGraph(converted).issues.map((issue) => issue.code), `${operation} 转录不得重新获得认证`).toContain("UNTRUSTED_CAUSAL_GRAPH");
    }

    for (const operation of ["range", "int", "bool", "pick", "weighted"] as const) {
      const mutated = cloneGraph(graph);
      const decision = mutated.randomTrace.streams.flatMap((stream) => stream.decisions).find((entry) => entry.operation === operation)!;
      const originalParameters = JSON.stringify(decision.parameters);
      rewriteDecisionOperation(decision, operation);
      if (JSON.stringify(decision.parameters) === originalParameters) rewriteDecisionOperationVariant(decision, operation);
      for (const node of mutated.nodes) {
        for (const reference of node.randomSampleRefs.filter((entry) => entry.decisionId === decision.decisionId)) {
          reference.candidateSetId = decision.candidateSetId;
          reference.selectedValue = decision.selectedValue;
        }
      }
      expect(JSON.stringify(decision.parameters)).not.toBe(originalParameters);
      expect(validateCausalGraphStructure(mutated, mutated.generation), `${operation} 同操作参数变异应保持内部自洽`).toEqual({ valid: true, issues: [] });
      expect(validateCausalGraph(mutated).issues.map((issue) => issue.code), `${operation} 同操作参数变异不得重新获得认证`).toContain("UNTRUSTED_CAUSAL_GRAPH");
    }

    const forgedSample = cloneGraph(graph);
    const sampleDecision = forgedSample.randomTrace.streams.flatMap((stream) => stream.decisions)[0];
    sampleDecision.sampleValue = sampleDecision.sampleValue === 0 ? 0.5 : 0;
    expect(issueCodes(forgedSample)).toContain("INVALID_RANDOM_TRACE");
  }, 30_000);

  it("每个确定性决定都进入至少一个因果节点，多场景不存在集合边界证据缺口", () => {
    const scenarios: GenerateUniverseInput[] = [
      { rulesetVersion: RULESET_VERSION, seed: "DECISION-COVERAGE-A", templateId: "hard_science" },
      { rulesetVersion: RULESET_VERSION, seed: "DECISION-COVERAGE-B", templateId: "high_magic" },
      { rulesetVersion: RULESET_VERSION, seed: "DECISION-COVERAGE-C", templateId: "mythic" },
      causalInput,
    ];
    for (const input of scenarios) {
      const universe = generateCausalUniverse(input);
      const graph = universe.causalGraph;
      const decisions = graph.randomTrace.streams.flatMap((stream) => stream.decisions).map((decision) => decision.decisionId);
      const references = new Set(graph.nodes.flatMap((node) => node.randomSampleRefs).map((reference) => reference.decisionId));
      expect(graph.randomResultBindings).toHaveLength(graph.nodes.reduce((sum, node) => sum + node.randomSampleRefs.length, 0));
      expect(graph.randomResultBindings.every((binding) => binding.outputValueFingerprint.startsWith("fnv1a32:"))).toBe(true);
      expect(graph.randomResultBindings.find((binding) => binding.resultSubjectId.startsWith("metric."))?.locator).toMatchObject({
        kind: "mapping_key",
        mapping: "metrics",
      });
      expect(new Set(graph.randomResultBindings.map((binding) => binding.locator.kind))).toEqual(new Set([
        "root_field",
        "mapping_key",
        "entity_id",
        "collection_quantity",
        "negative_fact",
      ]));
      expect(() => assertRandomResultBindingsResolve(universe, graph.randomResultBindings)).not.toThrow();
      expect(decisions.filter((decisionId) => !references.has(decisionId)), `${input.seed}/${input.templateId} 存在未挂接决定`).toEqual([]);
      expect(graph.nodes.some((node) => node.kind === "collection_boundary" && node.subjectId === "timeline.count")).toBe(true);
      expect(graph.nodes.some((node) => node.kind === "collection_boundary" && node.subjectId === "galaxies.count")).toBe(true);
      if (input.interventions?.length) {
        const finalBoundary = graph.nodes.find((node) => node.subjectId === "timeline.count")!;
        expect(getDirectCauses(graph, finalBoundary.id).some((node) => node.kind === "timeline_event" && node.subjectId.startsWith("miracle"))).toBe(true);
      }
    }
  }, 60_000);

  it("五类领域加权选择保留候选顺序、权重、资格参数和精确选中值", () => {
    const galaxy = generatedUniverse.galaxies[0];
    const system = galaxy.starSystems[0];
    const planet = system.planets[0];
    const civilization = generatedUniverse.civilizations[0];
    const scopeExpectations = [
      { scopeId: `${galaxy.id}.type`, requiredFields: ["id="] },
      { scopeId: `${system.id}.type`, requiredFields: ["id="] },
      { scopeId: `${planet.id}.type`, requiredFields: ["id="] },
      { scopeId: `${civilization.id}.path`, requiredFields: ["id=", "eligible=", "qualification="] },
      { scopeId: `${civilization.id}.mythology.type`, requiredFields: ["id="] },
    ];
    const decisions = generatedUniverse.causalGraph.randomTrace.streams.flatMap((stream) => stream.decisions);
    for (const expectation of scopeExpectations) {
      const matches = decisions.filter((decision) => decision.scopeId === expectation.scopeId);
      expect(matches, expectation.scopeId).toHaveLength(1);
      const decision = matches[0];
      expect(decision.operation).toBe("weighted");
      expect(decision.parameters.kind).toBe("weighted");
      if (decision.parameters.kind !== "weighted") throw new Error("测试夹具必须是加权决定。");
      expect(decision.parameters.candidates.map((candidate) => `${candidate.label}@${candidate.weight}`)).toEqual(decision.candidates);
      expect(decision.parameters.candidates.some((candidate) => candidate.label === decision.selectedValue)).toBe(true);
      expect(decision.parameters.candidates.every((candidate) => expectation.requiredFields.every((field) => candidate.label.includes(field)))).toBe(true);
    }

    const qualificationMutation = cloneGraph(generatedUniverse.causalGraph);
    const pathDecision = qualificationMutation.randomTrace.streams.flatMap((stream) => stream.decisions)
      .find((decision) => decision.scopeId === `${civilization.id}.path`)!;
    if (pathDecision.parameters.kind !== "weighted") throw new Error("文明路径必须使用加权决定。");
    const mutationIndex = pathDecision.parameters.candidates.findIndex((candidate) => candidate.label !== pathDecision.selectedValue);
    const originalCandidate = pathDecision.parameters.candidates[mutationIndex];
    const mutatedLabel = originalCandidate.label.replace(/qualification=[^|]+/, "qualification=forged");
    pathDecision.parameters = {
      kind: "weighted",
      candidates: pathDecision.parameters.candidates.map((candidate, index) => index === mutationIndex ? { ...candidate, label: mutatedLabel } : candidate),
    };
    pathDecision.candidates = pathDecision.parameters.candidates.map((candidate) => `${candidate.label}@${candidate.weight}`);
    pathDecision.candidateSetId = randomCandidateSetId(pathDecision.candidates);
    for (const node of qualificationMutation.nodes) {
      for (const reference of node.randomSampleRefs.filter((entry) => entry.decisionId === pathDecision.decisionId)) {
        reference.candidateSetId = pathDecision.candidateSetId;
      }
    }
    expect(validateCausalGraphStructure(qualificationMutation, qualificationMutation.generation)).toEqual({ valid: true, issues: [] });
    expect(validateCausalGraph(qualificationMutation).issues.map((issue) => issue.code)).toContain("UNTRUSTED_CAUSAL_GRAPH");
  }, 30_000);

  it("领域定位认证拒绝未知节点类型、缺失实体和结果值指纹变异", () => {
    expect(() => createDomainLocator("unknown.subject", "observation")).toThrow("领域定位失败");

    const missingEntity = structuredClone(generatedUniverse.causalGraph.randomResultBindings) as MutableBinding[];
    const entityBinding = missingEntity.find((binding) => binding.locator.kind === "entity_id")!;
    entityBinding.locator = {
      kind: "entity_id",
      entityKind: "timeline_event",
      entityId: "missing-event",
      containerKind: "collection_member",
    };
    expect(() => assertRandomResultBindingsResolve(generatedUniverse, missingEntity)).toThrow("领域定位失败");

    const mismatchedValue = structuredClone(generatedUniverse.causalGraph.randomResultBindings) as MutableBinding[];
    mismatchedValue[0].outputValueFingerprint = "fnv1a32:ffffffff";
    expect(() => assertRandomResultBindingsResolve(generatedUniverse, mismatchedValue)).toThrow("失配");
  });

  it("随机绑定语义由真实定位器容器决定并拒绝语义冲突", () => {
    const graph = generatedUniverse.causalGraph;
    for (const binding of graph.randomResultBindings) {
      const expectedKind = binding.locator.kind === "collection_quantity"
        ? "collection_quantity"
        : binding.locator.kind === "negative_fact"
          ? "negative_fact"
          : binding.locator.kind === "entity_id"
            ? binding.locator.containerKind
            : "field";
      expect(binding.bindingKind, `${binding.nodeKind}/${binding.resultSubjectId}`).toBe(expectedKind);
    }
    expect(graph.randomResultBindings.find((binding) => binding.locator.kind === "entity_id"
      && binding.locator.entityKind === "biosphere")?.bindingKind).toBe("field");
    expect(graph.randomResultBindings.find((binding) => binding.locator.kind === "entity_id"
      && binding.locator.entityKind === "civilization_seed")?.bindingKind).toBe("field");
    expect(graph.randomResultBindings.find((binding) => binding.locator.kind === "entity_id"
      && binding.locator.entityKind === "law")?.bindingKind).toBe("collection_member");
    expect(graph.randomResultBindings.find((binding) => binding.locator.kind === "entity_id"
      && binding.locator.entityKind === "intervention")?.bindingKind).toBe("collection_member");

    const mismatched = cloneGraph(graph);
    const binding = mismatched.randomResultBindings.find((entry) => entry.locator.kind === "entity_id"
      && entry.locator.entityKind === "biosphere")!;
    binding.bindingKind = "collection_member";
    expect(issueCodes(mismatched)).toContain("INVALID_RANDOM_BINDING");

    const wrongContainer = cloneGraph(graph);
    const wrongBinding = wrongContainer.randomResultBindings.find((entry) => entry.locator.kind === "entity_id"
      && entry.locator.entityKind === "biosphere")!;
    if (wrongBinding.locator.kind !== "entity_id") throw new Error("测试夹具必须是实体定位器。");
    wrongBinding.locator = { ...wrongBinding.locator, containerKind: "collection_member" };
    expect(issueCodes(wrongContainer)).toContain("INVALID_RANDOM_BINDING");
  });

  it("文明候选负事实只引用形成结论前的随机决定", () => {
    const graph = generatedUniverse.causalGraph;
    const absence = graph.nodes.find((node) => node.kind === "negative_fact"
      && node.subjectId.endsWith(".civilization-seed.absent"));
    expect(absence).toBeDefined();
    const allowedScopes = new Set([
      `${absence!.subjectId.replace(".civilization-seed.absent", "")}:biosphere-formation`,
      `${absence!.subjectId.replace(".civilization-seed.absent", "")}:civilization-chance`,
      `${absence!.subjectId.replace(".civilization-seed.absent", "")}:magic-adaptation`,
    ]);
    expect(absence!.randomSampleRefs.length).toBeGreaterThan(0);
    expect(absence!.randomSampleRefs.every((reference) => reference.scopeId && allowedScopes.has(reference.scopeId))).toBe(true);
    expect(absence!.randomSampleRefs.some((reference) => reference.selectedValue.includes("菌毯")
      || reference.selectedValue.includes("林海")
      || reference.selectedValue.includes("浮游群"))).toBe(false);
  });

  it("逐字段随机转录比较器拒绝全部操作互换和完整参数变异矩阵", () => {
    const productionTrace = generatedUniverse.causalGraph.randomTrace;
    const productionStream = productionTrace.streams[0];
    const productionDecision = productionStream.decisions[0];
    const baseline: MutableTrace = {
      ...structuredClone(productionTrace),
      totalSamples: 1,
      streams: [{
        ...structuredClone(productionStream),
        sampleCount: 1,
        lastSampleIndex: productionDecision.sampleIndex,
        decisions: [structuredClone(productionDecision) as MutableDecision],
      }],
    };
    const operations = ["next", "range", "int", "bool", "pick", "weighted"] as const;
    const mutate = (
      operation: RandomDecisionRecord["operation"],
      label: string,
      change: (decision: MutableDecision) => void,
    ) => {
      const expected = structuredClone(baseline) as MutableTrace;
      const expectedDecision = expected.streams.flatMap((stream) => stream.decisions)[0];
      rewriteDecisionOperation(expectedDecision, operation);
      const actual = structuredClone(expected) as MutableTrace;
      const decision = actual.streams.flatMap((stream) => stream.decisions)[0];
      change(decision);
      expect(randomTraceMatchesExpected(actual, expected), `${operation}/${label} 必须被逐字段比较器识别`).toBe(false);
    };

    operations.forEach((operation, index) => mutate(operation, "操作类型互换", (decision) => {
      decision.operation = operations[(index + 1) % operations.length];
    }));
    mutate("range", "下界", (decision) => {
      const parameters = decision.parameters as Extract<RandomDecisionRecord["parameters"], { kind: "range" }>;
      decision.parameters = { ...parameters, min: parameters.min + 1 };
    });
    mutate("range", "上界", (decision) => {
      const parameters = decision.parameters as Extract<RandomDecisionRecord["parameters"], { kind: "range" }>;
      decision.parameters = { ...parameters, max: parameters.max + 1 };
    });
    mutate("int", "下界", (decision) => {
      const parameters = decision.parameters as Extract<RandomDecisionRecord["parameters"], { kind: "int" }>;
      decision.parameters = { ...parameters, min: parameters.min + 1 };
    });
    mutate("int", "上界", (decision) => {
      const parameters = decision.parameters as Extract<RandomDecisionRecord["parameters"], { kind: "int" }>;
      decision.parameters = { ...parameters, max: parameters.max + 1 };
    });
    mutate("bool", "概率", (decision) => {
      const parameters = decision.parameters as Extract<RandomDecisionRecord["parameters"], { kind: "bool" }>;
      decision.parameters = { ...parameters, chance: parameters.chance === 0 ? 0.25 : 0 };
    });
    mutate("pick", "候选纯顺序", (decision) => {
      const parameters = decision.parameters as Extract<RandomDecisionRecord["parameters"], { kind: "pick" }>;
      decision.parameters = { ...parameters, candidates: [...parameters.candidates].reverse() };
    });
    mutate("pick", "候选纯内容", (decision) => {
      const parameters = decision.parameters as Extract<RandomDecisionRecord["parameters"], { kind: "pick" }>;
      decision.parameters = { ...parameters, candidates: parameters.candidates.map((entry, index) => index === 0 ? `${entry}-变异` : entry) };
    });
    mutate("weighted", "候选纯顺序", (decision) => {
      const parameters = decision.parameters as Extract<RandomDecisionRecord["parameters"], { kind: "weighted" }>;
      decision.parameters = { ...parameters, candidates: [...parameters.candidates].reverse() };
    });
    mutate("weighted", "标签纯内容", (decision) => {
      const parameters = decision.parameters as Extract<RandomDecisionRecord["parameters"], { kind: "weighted" }>;
      decision.parameters = { ...parameters, candidates: parameters.candidates.map((entry, index) => index === 0 ? { ...entry, label: `${entry.label}-变异` } : entry) };
    });
    mutate("weighted", "纯权重", (decision) => {
      const parameters = decision.parameters as Extract<RandomDecisionRecord["parameters"], { kind: "weighted" }>;
      decision.parameters = { ...parameters, candidates: parameters.candidates.map((entry, index) => index === 0 ? { ...entry, weight: entry.weight + 1 } : entry) };
    });
  });

  it("独立绑定转录能够识别节点引用与公开绑定表的同步搬运", () => {
    const fixture = validFixture();
    const builder = new CausalGraphBuilder(generatedUniverse);
    const reference = invalidReference();
    reference.decisionId = "decision:trusted";
    const eventId = generatedUniverse.timeline[0].id;
    reference.resultSubjectId = eventId;
    builder.add(derived("original", eventId, "timeline_event", "原始结果", "原始结果", [], [], [reference]));
    builder.add(derived("target", "share.code", "share_result", "目标结果", "目标结果", [], []));
    const { graph, expectedRandomBindings } = builder.finish(fixture.randomTrace, fixture.generation);
    expect(randomResultBindingsMatchExpected(graph.randomResultBindings, expectedRandomBindings)).toBe(true);

    const movedGraph = cloneGraph(graph);
    const source = movedGraph.nodes.find((node) => node.subjectId === eventId)!;
    const target = movedGraph.nodes.find((node) => node.subjectId === "share.code")!;
    const movedReference = source.randomSampleRefs.pop()!;
    movedReference.resultSubjectId = target.subjectId;
    target.randomSampleRefs.push(movedReference);
    const publicBinding = movedGraph.randomResultBindings[0];
    publicBinding.resultNodeId = target.id;
    publicBinding.resultSubjectId = target.subjectId;
    publicBinding.nodeKind = target.kind;
    publicBinding.bindingKind = "field";
    publicBinding.locator = { kind: "root_field", field: "shareCode" };
    expect(randomResultBindingsMatchExpected(movedGraph.randomResultBindings, expectedRandomBindings)).toBe(false);
  });

  it("领域对象通过来源束保留真实 sourceEventIds、sourceRuleIds、指标与时间线原因", () => {
    const universe = generatedUniverse;
    const graph = universe.causalGraph;
    const galaxy = universe.galaxies.find((entry) => entry.sourceEventIds.length > 0 && entry.sourceRuleIds.length > 0)!;
    const planet = universe.galaxies.flatMap((entry) => entry.starSystems).flatMap((entry) => entry.planets)
      .find((entry) => entry.sourceEventIds.length > 0 && entry.sourceRuleIds.length > 0)!;
    const biospherePlanet = universe.galaxies.flatMap((entry) => entry.starSystems).flatMap((entry) => entry.planets)
      .find((entry) => entry.biosphere && entry.biosphere.sourceEventIds.length > 0)!;
    const civilization = universe.civilizations.find((entry) => entry.sourceEventIds.length > 0 && entry.sourceRuleIds.length > 0)!;

    expectDeclaredSources(graph, galaxy.id, galaxy.sourceEventIds, galaxy.sourceRuleIds);
    expectDeclaredSources(graph, planet.id, planet.sourceEventIds, planet.sourceRuleIds);
    expectDeclaredSources(graph, `${biospherePlanet.id}.biosphere`, biospherePlanet.biosphere!.sourceEventIds, biospherePlanet.biosphere!.sourceRuleIds);
    expectDeclaredSources(graph, civilization.id, civilization.sourceEventIds, civilization.sourceRuleIds);
    expectDeclaredSources(graph, `${civilization.id}.mythology`, civilization.mythology.sourceEventIds, civilization.mythology.sourceRuleIds);

    const civilizationNode = graph.nodes.find((node) => node.subjectId === civilization.id)!;
    const ancestorSubjects = new Set(traceCausalAncestors(graph, civilizationNode.id).map((node) => node.subjectId));
    expect(ancestorSubjects.has("metric.civilizationPotential")).toBe(true);
    expect(ancestorSubjects.has("timeline-impact")).toBe(true);
  });

  it("名称、标语、描述、事件效果、目标变更、概率偏移、干预汇总与分享结果各自拥有真实依赖", () => {
    const graph = generatedUniverse.causalGraph;
    const name = graph.nodes.find((node) => node.subjectId === "universe.name")!;
    const tagline = graph.nodes.find((node) => node.subjectId === "universe.tagline")!;
    const description = graph.nodes.find((node) => node.subjectId === "universe.description")!;
    expect(name.randomSampleRefs.length).toBeGreaterThan(0);
    expect(getDirectCauses(graph, tagline.id).some((node) => node.kind === "metric")).toBe(true);
    expect(getDirectCauses(graph, description.id).some((node) => node.kind === "law_domain")).toBe(true);

    expect(graph.nodes.filter((node) => node.kind === "event_effect")).toHaveLength(
      generatedUniverse.timeline.reduce((sum, event) => sum + event.effects.length, 0),
    );
    expect(graph.nodes.filter((node) => node.kind === "target_mutation")).toHaveLength(
      generatedUniverse.miracleState.appliedMiracles.flatMap((miracle) => miracle.targetMutations).length,
    );
    expect(graph.nodes.filter((node) => node.kind === "probability_shift")).toHaveLength(
      generatedUniverse.miracleState.probabilityShifts.length,
    );
    expect(graph.nodes.filter((node) => node.kind === "intervention_metric")).toHaveLength(11);
    expect(graph.nodes.filter((node) => node.kind === "share_result").map((node) => node.subjectId).sort()).toEqual([
      "share.code",
      "share.text",
      "share.url",
    ]);
  });

  it("多 Seed、多模板、有无干预均由显式物化 API 构建有效闭包", () => {
    const scenarios: GenerateUniverseInput[] = [
      { rulesetVersion: RULESET_VERSION, seed: "CLOSURE-A", templateId: "hard_science" },
      { rulesetVersion: RULESET_VERSION, seed: "CLOSURE-B", templateId: "mythic" },
      { rulesetVersion: RULESET_VERSION, seed: "CLOSURE-C", templateId: "causal_fracture" },
      causalInput,
    ];
    for (const input of scenarios) {
      const universe = generateCausalUniverse(input);
      expect(validateCausalGraph(universe.causalGraph), `${input.seed}/${input.templateId}`).toEqual({ valid: true, issues: [] });
    }

    const left = generateCausalUniverse(scenarios[0]);
    const right = generateCausalUniverse(scenarios[1]);
    const mixed = cloneGraph(left.causalGraph);
    mixed.randomTrace = structuredClone(right.causalGraph.randomTrace) as MutableTrace;
    expect(issueCodes(mixed)).toEqual(expect.arrayContaining(["INVALID_INPUT_MANIFEST", "INVALID_RANDOM_TRACE"]));
  }, 60_000);

  it("代表性旧宇宙首次物化因果图并完成双向查询", () => {
    const startedAt = performance.now();
    const universe = generateUniverse({
      rulesetVersion: RULESET_VERSION,
      seed: "CAUSAL-PERFORMANCE-001",
      templateId: "high_magic",
    });
    const beforeMaterialization = JSON.stringify(universe);
    const graph = universe.causalGraph;
    expect(Object.isFrozen(graph)).toBe(true);
    expect(universe.causalGraph).toBe(graph);
    expect(JSON.stringify(universe)).toBe(beforeMaterialization);
    const target = graph.nodes.find((node) => node.kind === "metric"
      && node.directCauseIds.length > 0
      && node.directEffectIds.length > 0);
    expect(target).toBeDefined();
    const ancestors = traceCausalAncestors(graph, target!.id);
    const descendants = traceCausalDescendants(graph, target!.id);
    const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
    expect(ancestors.length).toBeGreaterThan(0);
    expect(descendants.length).toBeGreaterThan(0);
    expect([...ancestors, ...descendants].every((node) => graphNodeIds.has(node.id))).toBe(true);
    if (process.env.npm_lifecycle_event?.startsWith("test:coverage")) {
      expect(performance.now() - startedAt).toBeLessThan(3000);
    }
  }, 10_000);

  it("低层因果构建器不从公共 API 导出，生产图校验会拒绝损坏追踪", () => {
    expect("buildUniverseCausalGraph" in sim).toBe(false);
    const broken = cloneGraph(generatedUniverse.causalGraph);
    broken.randomTrace.algorithmVersion = "broken";
    expect(() => assertCausalGraph(broken)).toThrow(/因果闭包校验失败.*INVALID_RANDOM_TRACE/);
  }, 30_000);

  it("高阶公理和全部一致性约束可授权闭环，无授权或无效授权会被拒绝", () => {
    const authorized = validFixture();
    addCycle(authorized);
    authorized.cycleAuthorizations.push({
      id: "feedback-contract",
      nodeIds: ["n1", "n2"],
      edgeIds: ["e-n1-n2", "e-n2-n1"],
      axiomNodeId: "a-cycle",
      constraintIds: [...CAUSAL_CYCLE_REQUIRED_CONSTRAINTS],
    });
    expect(validateCausalGraphStructure(authorized, authorized.generation)).toEqual({ valid: true, issues: [] });

    const unauthorized = validFixture();
    addCycle(unauthorized);
    expect(issueCodes(unauthorized)).toContain("ILLEGAL_CYCLE");

    const invalidAuthorization = cloneGraph(authorized);
    invalidAuthorization.cycleAuthorizations[0].constraintIds = ["constraint:cycle-membership-exact"];
    expect(issueCodes(invalidAuthorization)).toEqual(expect.arrayContaining(["INVALID_CYCLE_AUTHORIZATION", "ILLEGAL_CYCLE"]));
  });

  it("全部校验问题码都有可复现的负向契约", () => {
    const cases: Array<[CausalValidationIssueCode, (graph: MutableGraph) => void]> = [
      ["DUPLICATE_NODE", (graph) => graph.nodes.push(structuredClone(graph.nodes[0]))],
      ["DUPLICATE_EDGE", (graph) => graph.edges.push(structuredClone(graph.edges[0]))],
      ["DUPLICATE_EDGE_ENDPOINTS", (graph) => graph.edges.push({ ...graph.edges[0], id: "e-duplicate-endpoints" })],
      ["DUPLICATE_ROOT", (graph) => graph.rootNodeIds.push(graph.rootNodeIds[0])],
      ["MISSING_EDGE_ENDPOINT", (graph) => { graph.edges[0].to = "missing"; }],
      ["ROOT_HAS_CAUSE", (graph) => addEdge(graph, "n1", "r-input", "derives")],
      ["INVALID_ROOT_KIND", (graph) => { graph.nodes.find((node) => node.id === "a-main")!.subjectId = "axiom:forged"; }],
      ["ORPHAN_NODE", (graph) => detachIncomingEdges(graph, "n2")],
      ["MISSING_RULE_REFERENCE", (graph) => { graph.nodes.find((node) => node.id === "n2")!.ruleIds = []; }],
      ["UNKNOWN_RULE_REFERENCE", (graph) => { graph.nodes.find((node) => node.id === "n2")!.ruleIds = ["missing-rule"]; }],
      ["ADJACENCY_MISMATCH", (graph) => { graph.nodes.find((node) => node.id === "n2")!.directCauseIds.push("r-input"); }],
      ["NO_ROOT_PATH", (graph) => {
        detachIncomingEdges(graph, "n1");
        detachIncomingEdges(graph, "n2");
        addEdge(graph, "n1", "n2", "derives");
        addEdge(graph, "n2", "n1", "derives");
      }],
      ["ILLEGAL_CYCLE", (graph) => addCycle(graph)],
      ["INVALID_CYCLE_AUTHORIZATION", (graph) => {
        addCycle(graph);
        graph.cycleAuthorizations.push({
          id: "bad-cycle",
          nodeIds: ["n1", "n2"],
          edgeIds: ["e-n1-n2", "e-n2-n1"],
          axiomNodeId: "a-cycle",
          constraintIds: ["constraint:cycle-membership-exact"],
        });
      }],
      ["INVALID_EDGE_RULE", (graph) => { delete graph.edges.find((edge) => edge.kind === "applies")!.ruleId; }],
      ["INVALID_GRAPH_VERSION", (graph) => { graph.version = "broken"; }],
      ["INVALID_INPUT_MANIFEST", (graph) => { graph.generation.inputs[0].value = "forged"; }],
      ["INVALID_RANDOM_TRACE", (graph) => { graph.randomTrace.totalSamples = -1; }],
      ["INVALID_RANDOM_REFERENCE", (graph) => { graph.nodes.find((node) => node.id === "n1")!.randomSampleRefs.push(invalidReference()); }],
      ["INVALID_RANDOM_BINDING", (graph) => { graph.randomResultBindings.push(invalidBinding()); }],
    ];
    for (const [expectedCode, mutate] of cases) {
      const graph = validFixture();
      mutate(graph);
      expect(issueCodes(graph), `问题码 ${expectedCode} 缺少负向覆盖`).toContain(expectedCode);
      expect(() => assertCausalGraph(graph)).toThrow(/因果闭包校验失败/);
    }

    const manifestMutations: Array<(graph: MutableGraph) => void> = [
      (graph) => { graph.generation.inputs.pop(); },
      (graph) => { [graph.generation.inputs[0], graph.generation.inputs[1]] = [graph.generation.inputs[1], graph.generation.inputs[0]]; },
      (graph) => { graph.generation.inputs[0].subjectId = "forged-seed"; },
      (graph) => { graph.randomTrace.generationId = "generation:other"; },
      (graph) => {
        graph.nodes.push(fixtureNode("r-extra", "extra-input", "input", "input", [], []));
        graph.rootNodeIds.push("r-extra");
      },
    ];
    for (const mutate of manifestMutations) {
      const graph = validFixture();
      mutate(graph);
      expect(issueCodes(graph)).toContain("INVALID_INPUT_MANIFEST");
    }

    const tamperedInput = cloneGraph(generatedUniverse.causalGraph);
    const interventionRecord = tamperedInput.generation.inputs.find((input) => input.kind === "intervention")!;
    const originalManifest = structuredClone(generatedUniverse.causalGraph.generation);
    interventionRecord.value = JSON.stringify({
      id: interventionRecord.subjectId,
      miracleType: "erase_memory",
      targetId: "forged-target",
    });
    tamperedInput.generation.id = causalGenerationManifestId(tamperedInput.generation.inputs);
    tamperedInput.randomTrace.generationId = tamperedInput.generation.id;
    expect(issueCodes(tamperedInput)).toContain("INVALID_INPUT_MANIFEST");

    const inputRoot = tamperedInput.nodes.find((node) => node.id === interventionRecord.rootNodeId)!;
    inputRoot.description = "erase_memory -> forged-target";
    inputRoot.input = {
      kind: interventionRecord.kind,
      order: interventionRecord.order,
      subjectId: interventionRecord.subjectId,
      value: interventionRecord.value,
    };
    expect(issueCodes(tamperedInput)).toContain("INVALID_INPUT_MANIFEST");

    const interventionNode = tamperedInput.nodes.find((node) => node.kind === "intervention")!;
    interventionNode.input = { ...inputRoot.input };
    expect(validateCausalGraphStructure(tamperedInput, originalManifest).issues.map((issue) => issue.code)).toContain("INVALID_INPUT_MANIFEST");
    expect(validateCausalGraph(tamperedInput).issues.map((issue) => issue.code)).toContain("UNTRUSTED_CAUSAL_GRAPH");
    expect(() => serializeCausalGraph(tamperedInput)).toThrow(/UNTRUSTED_CAUSAL_GRAPH/);
    expect(() => appendCausalProjections(tamperedInput, [])).toThrow(/UNTRUSTED_CAUSAL_GRAPH/);
    const rightUniverse = generateCausalUniverse({
      rulesetVersion: RULESET_VERSION,
      seed: "TRUSTED-COMPARISON-RIGHT",
      templateId: generatedUniverse.templateId,
    });
    const forgedUniverse = { ...generatedUniverse, causalGraph: tamperedInput };
    const forgedComparison = compareUniverseLaws(forgedUniverse.seed, rightUniverse.seed, forgedUniverse.templateId);
    expect(() => buildLawComparisonEvidence(forgedUniverse, rightUniverse, forgedComparison, "maximum")).toThrow(/UNTRUSTED_CAUSAL_GRAPH/);
  }, 30_000);

  it("观察与对比可通过纯模拟层投影 API 组合，不依赖 UI", () => {
    const graph = generatedUniverse.causalGraph;
    const source = graph.nodes.find((node) => !node.root && node.ruleIds.length > 0)!;
    const projected = appendCausalProjections(graph, [{
      id: "compare-result",
      subjectId: "compare.result",
      kind: "observation",
      label: "宇宙对比结果",
      description: "两个结果的可组合观察投影。",
      causeNodeIds: [source.id],
      ruleNodeId: source.ruleIds[0],
    }]);
    expect(validateCausalGraphStructure(projected, projected.generation)).toEqual({ valid: true, issues: [] });
    expect(validateCausalGraph(projected).issues.map((issue) => issue.code)).toContain("UNTRUSTED_CAUSAL_GRAPH");
    expect(() => serializeCausalGraph(projected)).toThrow(/UNTRUSTED_CAUSAL_GRAPH/);
    expect(projected.nodes.find((node) => node.subjectId === "compare.result")).toBeDefined();
    expect(graph.nodes.find((node) => node.subjectId === "compare.result")).toBeUndefined();

    const arbitraryProjection = appendCausalProjections(graph, [{
      id: "forged-share",
      subjectId: "share.code",
      kind: "observation",
      label: "任意声明",
      description: "与所选原因无关的描述。",
      causeNodeIds: [source.id],
      ruleNodeId: source.ruleIds[0],
    }]);
    expect(validateCausalGraph(arbitraryProjection).issues.map((issue) => issue.code)).toContain("UNTRUSTED_CAUSAL_GRAPH");
    expect(() => serializeCausalGraph(arbitraryProjection)).toThrow(/UNTRUSTED_CAUSAL_GRAPH/);

    const planet = generatedUniverse.galaxies[0].starSystems[0].planets[0];
    const stateSpec = buildStateValueCausalProjection(generatedUniverse, `${planet.id}.habitability`);
    const stateProjection = appendCausalProjections(graph, [stateSpec]);
    const stateNode = stateProjection.nodes.find((node) => node.subjectId === `${planet.id}.habitability`)!;
    expect(stateNode.kind).toBe("state_value");
    const directSubjects = getDirectCauses(stateProjection, stateNode.id).map((node) => node.subjectId);
    expect(directSubjects).toEqual(expect.arrayContaining([
      "formula:planet.habitability@1",
      `${planet.id}.habitability.operand.1`,
      `${planet.id}.habitability.operand.2`,
      `${planet.id}.habitability.operand.3`,
      `${planet.id}.habitability.operand.4`,
      `${planet.id}.habitability.operand.5`,
      "axiom:state-value-derivation",
    ]));
    const decisionEvidence = getDirectCauses(stateProjection, stateNode.id).find((node) => node.subjectId.startsWith("random-decision."))!;
    expect(decisionEvidence.description).toContain(`${planet.id}.habitability`);
    expect(stateSpec.evidence?.find((entry) => entry.subjectId === "formula:planet.habitability@1")?.description).toContain("轨道区域偏置");
    const forgedStateSpec = structuredClone(stateSpec);
    expect(() => appendCausalProjections(graph, [forgedStateSpec])).toThrow(/未经过受控公式/);
    expect(() => buildStateValueCausalProjection(generatedUniverse, "missing.state.value")).toThrow(/没有登记状态值主题/);
  });

  it("聚合统计逐项绑定完整成员、缺席与筛选证据", () => {
    const graph = generatedUniverse.causalGraph;
    expect(summaryCollectionEvidenceIssues(graph, generatedUniverse)).toEqual([]);
    const tampered = structuredClone(graph);
    const statistic = tampered.nodes.find((node) => node.subjectId === "space.stats.biospheres")!;
    const biosphereCause = statistic.directCauseIds.find((id) => tampered.nodes.find((node) => node.id === id)?.subjectId.endsWith(".biosphere"))!;
    (statistic as unknown as { directCauseIds: string[] }).directCauseIds = statistic.directCauseIds.filter((id) => id !== biosphereCause);
    expect(summaryCollectionEvidenceIssues(tampered, generatedUniverse)).toContainEqual(expect.stringContaining("space.stats.biospheres 缺少证据"));

    const changedDescription = structuredClone(graph);
    (changedDescription.nodes.find((node) => node.subjectId === "civilization.stats.highRisk") as unknown as { description: string }).description = "高风险 0。";
    expect(summaryCollectionEvidenceIssues(changedDescription, generatedUniverse)).toContainEqual(expect.stringContaining("描述与当前集合不一致"));

    const extraCause = structuredClone(graph);
    const highRisk = extraCause.nodes.find((node) => node.subjectId === "civilization.stats.highRisk")!;
    const unrelated = extraCause.nodes.find((node) => node.subjectId === "space.stats.galaxies")!;
    (highRisk as unknown as { directCauseIds: string[] }).directCauseIds = [...highRisk.directCauseIds, unrelated.id];
    expect(summaryCollectionEvidenceIssues(extraCause, generatedUniverse)).toContainEqual(expect.stringContaining("包含无关证据"));

    const pathGroup = graph.nodes.find((node) => node.subjectId.startsWith("civilization.stats.paths.group."));
    const riskMember = graph.nodes.find((node) => node.subjectId.startsWith("civilization.stats.highRisk.member."));
    expect(pathGroup?.directCauseIds.length).toBeGreaterThan(0);
    expect(riskMember?.description).toMatch(/灭绝风险 \d+ (不低于|低于)阈值 65/);

    const deepTampered = cloneGraph(graph);
    const civilization = generatedUniverse.civilizations[0];
    const pathField = deepTampered.nodes.find((node) => node.subjectId === `${civilization.id}.path`)!;
    pathField.description = "发展路径为伪造值。";
    expect(summaryCollectionEvidenceIssues(deepTampered, generatedUniverse)).toContainEqual(expect.stringContaining(`${civilization.id}.path 描述或值证据错误`));

    const pathMember = deepTampered.nodes.find((node) => node.subjectId === `civilization.stats.paths.member.${civilization.id}.path`)!;
    pathMember.description = "分组键为伪造分组。";
    expect(summaryCollectionEvidenceIssues(deepTampered, generatedUniverse)).toContainEqual(expect.stringContaining(`${pathMember.subjectId} 描述或值证据错误`));
    deepTampered.nodes.push({ ...structuredClone(pathMember), id: `${pathMember.id}-duplicate` });
    expect(summaryCollectionEvidenceIssues(deepTampered, generatedUniverse)).toContainEqual(expect.stringContaining("节点数量为 2"));

    const predicate = deepTampered.nodes.find((node) => node.subjectId === "civilization.stats.highRisk.predicate")!;
    predicate.description = "谓词版本 civilization-high-risk@1；字段 extinctionRisk；运算符 >=；阈值 70。";
    expect(summaryCollectionEvidenceIssues(deepTampered, generatedUniverse)).toContainEqual(expect.stringContaining("civilization.stats.highRisk.predicate 描述或值证据错误"));

    const member = deepTampered.nodes.find((node) => node.subjectId === `civilization.stats.highRisk.member.${civilization.id}`)!;
    member.label = member.label.includes("计入") ? member.label.replace("计入", "排除") : member.label.replace("排除", "计入");
    expect(summaryCollectionEvidenceIssues(deepTampered, generatedUniverse)).toContainEqual(expect.stringContaining(`${member.subjectId} 纳入结果错误`));

    const riskField = deepTampered.nodes.find((node) => node.subjectId === `${civilization.id}.extinctionRisk`)!;
    riskField.directCauseIds = riskField.directCauseIds.filter((id) => deepTampered.nodes.find((node) => node.id === id)?.subjectId !== civilization.id);
    expect(summaryCollectionEvidenceIssues(deepTampered, generatedUniverse)).toContainEqual(expect.stringContaining(`${riskField.subjectId} 原因集合错误`));
  });
});

function visibleDerivedSubjects(universe: UniverseSummary): Partial<Record<CausalNodeKind, string[]>> {
  const laws = Object.values(universe.laws);
  const systems = universe.galaxies.flatMap((galaxy) => galaxy.starSystems);
  const planets = systems.flatMap((system) => system.planets);
  return {
    universe: [universe.seed],
    universe_name: ["universe.name"],
    universe_tagline: ["universe.tagline"],
    universe_description: ["universe.description"],
    template: [`template.${universe.templateId}`],
    law_domain: laws.map((domain) => domain.id),
    law: laws.flatMap((domain) => domain.rules).map((law) => law.id),
    law_interaction: universe.lawInteractions.map((interaction) => interaction.id),
    metric: Object.keys(universe.metrics).map((metricId) => `metric.${metricId}`),
    timeline_event: universe.timeline.map((event) => event.id),
    event_effect: universe.timeline.flatMap((event) => event.effects.map((_, index) => `${event.id}.effect.${index + 1}`)),
    timeline_impact: [
      "timeline-impact",
      ...universe.timelineImpact.localBiases.map((bias) => `timeline-bias.${bias.id}`),
      ...universe.timelineImpact.eraProfiles.map((profile) => `timeline-era.${profile.era}`),
    ],
    galaxy: universe.galaxies.map((galaxy) => galaxy.id),
    star_system: systems.map((system) => system.id),
    planet: planets.map((planet) => planet.id),
    biosphere: planets.filter((planet) => planet.biosphere).map((planet) => `${planet.id}.biosphere`),
    civilization_seed: planets.filter((planet) => planet.biosphere?.civilizationSeed).map((planet) => `${planet.id}.civilization-seed`),
    civilization: universe.civilizations.map((civilization) => civilization.id),
    mythology: universe.civilizations.map((civilization) => `${civilization.id}.mythology`),
    civilization_event: universe.civilizations.flatMap((civilization) => civilization.historyEvents).map((event) => event.id),
    intervention: universe.miracleState.appliedMiracles.map((miracle) => miracle.id),
    target_mutation: universe.miracleState.appliedMiracles.flatMap((miracle) => miracle.targetMutations.map((mutation) =>
      `${miracle.id}.mutation.${mutation.targetKind}.${mutation.targetId}.${mutation.field}`)),
    probability_shift: universe.miracleState.appliedMiracles.flatMap((miracle) => miracle.probabilityShifts.map((shift, index) =>
      `${miracle.id}.probability-shift.${shift.eventType}.${index + 1}`)),
    intervention_metric: [
      ...Object.keys(universe.miracleState.metricDeltas).map((metricId) => `miracle-state.metric-delta.${metricId}`),
      "miracle-state.budget",
      "miracle-state.spent",
      "miracle-state.remaining",
      "miracle-state.causality-strain",
    ],
    intervention_result: ["miracle-state", ...universe.miracleState.interventionLog.map((log) => log.id)],
    share_result: ["share.code", "share.url", "share.text"],
    explanation: universe.explanations.map((explanation) => explanation.id),
    observation: [
      ...universe.observationLog.importantEvents.map((_, index) => `observation.important.${index + 1}`),
      ...universe.observationLog.rareFindings.map((_, index) => `observation.rare.${index + 1}`),
      ...universe.observationLog.possibleEndings.map((_, index) => `observation.ending.${index + 1}`),
    ],
    collection_boundary: [
      "timeline.base-count",
      "timeline.count",
      "galaxies.count",
      "space.stats",
      "space.stats.galaxies",
      "space.stats.systems",
      "space.stats.planets",
      "space.stats.biospheres",
      "space.stats.civilizationSeeds",
      "civilization.stats",
      "civilization.stats.total",
      "civilization.stats.paths",
      "civilization.stats.mythologies",
      "civilization.stats.highRisk",
      ...universe.civilizations.map((civilization) => `${civilization.id}.history.count`),
    ],
    negative_fact: planets.flatMap((planet) => {
      if (!planet.biosphere) return [`${planet.id}.biosphere.absent`];
      return planet.biosphere.civilizationSeed ? [] : [`${planet.id}.civilization-seed.absent`];
    }),
  };
}

function expectDeclaredSources(graph: CausalGraph, subjectId: string, eventIds: string[], ruleIds: string[]): void {
  const node = graph.nodes.find((entry) => entry.subjectId === subjectId);
  expect(node, `缺少领域节点 ${subjectId}`).toBeDefined();
  const bundle = getDirectCauses(graph, node!.id).find((cause) => cause.kind === "provenance");
  expect(bundle, `${subjectId} 缺少来源束`).toBeDefined();
  const sourceSubjects = new Set(getDirectCauses(graph, bundle!.id).map((cause) => cause.subjectId));
  for (const sourceId of [...eventIds, ...ruleIds]) expect(sourceSubjects.has(sourceId), `${subjectId} 丢失来源 ${sourceId}`).toBe(true);
}

function decisionIds(node: CausalNode): string[] {
  return node.randomSampleRefs.map((reference) => reference.decisionId).filter((id): id is string => Boolean(id));
}

function intersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function reachesLegalRoot(
  nodeId: string,
  nodes: Map<string, CausalNode>,
  rootIds: Set<string>,
  memo: Map<string, boolean>,
  active: Set<string>,
): boolean {
  const cached = memo.get(nodeId);
  if (cached !== undefined) return cached;
  const node = nodes.get(nodeId);
  if (!node) return false;
  if (node.root) return rootIds.has(node.id);
  if (active.has(nodeId)) return false;
  active.add(nodeId);
  const result = node.directCauseIds.some((causeId) => reachesLegalRoot(causeId, nodes, rootIds, memo, active));
  active.delete(nodeId);
  memo.set(nodeId, result);
  return result;
}

type MutableReference = {
  -readonly [K in Exclude<keyof CausalRandomSampleRef, "sampleIndexes" | "resultSubjectId" | "scopeId">]: CausalRandomSampleRef[K]
} & { sampleIndexes: number[]; resultSubjectId?: string; scopeId?: string };
type MutableInputEvidence = Omit<MutableInput, "rootNodeId">;
type MutableNode = Omit<CausalNode, "input" | "directCauseIds" | "directEffectIds" | "ruleIds" | "randomSampleRefs"> & {
  id: string;
  subjectId: string;
  label: string;
  description: string;
  input?: MutableInputEvidence;
  directCauseIds: string[];
  directEffectIds: string[];
  ruleIds: string[];
  randomSampleRefs: MutableReference[];
};
type MutableEdge = { -readonly [K in keyof CausalEdge]: CausalEdge[K] };
type MutableAuthorization = Omit<CausalCycleAuthorization, "nodeIds" | "edgeIds" | "constraintIds"> & {
  nodeIds: string[];
  edgeIds: string[];
  constraintIds: string[];
};
type MutableDecision = { -readonly [K in keyof RandomDecisionRecord]: RandomDecisionRecord[K] };
type MutableStream = Omit<RandomStreamMetadata, "decisions"> & { decisions: MutableDecision[] };
type MutableTrace = { -readonly [K in Exclude<keyof RandomTraceSnapshot, "streams">]: RandomTraceSnapshot[K] } & { streams: MutableStream[] };
type MutableInput = { -readonly [K in keyof CausalInputRecord]: CausalInputRecord[K] };
type MutableGeneration = Omit<CausalGenerationManifest, "inputs"> & { version: string; id: string; inputs: MutableInput[] };
type MutableBinding = { -readonly [K in keyof CausalRandomResultBinding]: CausalRandomResultBinding[K] };
type MutableGraph = Omit<CausalGraph, "generation" | "rootNodeIds" | "nodes" | "edges" | "cycleAuthorizations" | "randomTrace" | "randomResultBindings"> & {
  version: string;
  generation: MutableGeneration;
  rootNodeIds: string[];
  nodes: MutableNode[];
  edges: MutableEdge[];
  cycleAuthorizations: MutableAuthorization[];
  randomTrace: MutableTrace;
  randomResultBindings: MutableBinding[];
};

function validFixture(): MutableGraph {
  const generationInputs: MutableInput[] = [
    { rootNodeId: "r-input", kind: "seed", order: 0, subjectId: "fixture-seed", value: "fixture-seed" },
    { rootNodeId: "r-ruleset", kind: "ruleset_version", order: 1, subjectId: "fixture-ruleset", value: "fixture-ruleset" },
    { rootNodeId: "r-template", kind: "creation_template", order: 2, subjectId: "fixture-template", value: "fixture-template" },
  ];
  const generationId = causalGenerationManifestId(generationInputs);
  const nodes: MutableNode[] = [
    fixtureNode("r-input", "fixture-seed", "input", "input", [], ["n1"], [], generationInputs[0]),
    fixtureNode("r-ruleset", "fixture-ruleset", "input", "input", [], ["n1"], [], generationInputs[1]),
    fixtureNode("r-template", "fixture-template", "input", "input", [], ["n1"], [], generationInputs[2]),
    fixtureNode("a-main", "axiom:universe-assembly", "axiom", "axiom", [], ["n1", "n2"]),
    fixtureNode("a-cycle", "axiom:authorized-feedback", "axiom", "axiom", [], []),
    fixtureNode("n1", "fixture.result", "universe", undefined, ["a-main", "r-input", "r-ruleset", "r-template"], ["n2"], ["a-main"]),
    fixtureNode("n2", "fixture.observation", "observation", undefined, ["a-main", "n1"], [], ["a-main"]),
  ];
  return {
    version: CAUSAL_GRAPH_VERSION,
    randomBindingVersion: CAUSAL_RANDOM_BINDING_VERSION,
    generation: { version: CAUSAL_GENERATION_MANIFEST_VERSION, id: generationId, inputs: generationInputs },
    rootNodeIds: ["r-input", "r-ruleset", "r-template", "a-main", "a-cycle"],
    nodes,
    edges: [
      { id: "e-input-n1", from: "r-input", to: "n1", kind: "derives", label: "输入原因" },
      { id: "e-ruleset-n1", from: "r-ruleset", to: "n1", kind: "derives", label: "规则版本原因" },
      { id: "e-template-n1", from: "r-template", to: "n1", kind: "derives", label: "模板原因" },
      { id: "e-main-n1", from: "a-main", to: "n1", kind: "applies", label: "适用规则", ruleId: "a-main" },
      { id: "e-n1-n2", from: "n1", to: "n2", kind: "observes", label: "观察来源" },
      { id: "e-main-n2", from: "a-main", to: "n2", kind: "applies", label: "适用规则", ruleId: "a-main" },
    ],
    cycleAuthorizations: [],
    randomTrace: {
      algorithmVersion: RANDOM_ALGORITHM_VERSION,
      generationId,
      seedMaterial: "fixture-ruleset:fixture-template:fixture-seed",
      seedFingerprint: randomSeedFingerprint("fixture-ruleset:fixture-template:fixture-seed"),
      totalSamples: 0,
      streams: [],
    },
    randomResultBindings: [],
  };
}

function fixtureNode(
  id: string,
  subjectId: string,
  kind: CausalNodeKind,
  root: "input" | "axiom" | "initial_state" | undefined,
  directCauseIds: string[],
  directEffectIds: string[],
  ruleIds: string[] = [],
  input?: MutableInput,
): MutableNode {
  return {
    id,
    subjectId,
    kind,
    root,
    label: subjectId,
    description: subjectId,
    input: input ? { kind: input.kind, order: input.order, subjectId: input.subjectId, value: input.value } : undefined,
    directCauseIds,
    directEffectIds,
    ruleIds,
    randomSampleRefs: [],
  };
}

function addCycle(graph: MutableGraph): void {
  addEdge(graph, "n2", "n1", "derives", "e-n2-n1");
}

function addEdge(
  graph: MutableGraph,
  from: string,
  to: string,
  kind: CausalEdge["kind"],
  id = `test-edge:${from}->${to}`,
): void {
  graph.edges.push({ id, from, to, kind, label: "测试边" });
  graph.nodes.find((node) => node.id === from)?.directEffectIds.push(to);
  graph.nodes.find((node) => node.id === to)?.directCauseIds.push(from);
}

function detachIncomingEdges(graph: MutableGraph, nodeId: string): void {
  const incoming = graph.edges.filter((edge) => edge.to === nodeId);
  graph.edges = graph.edges.filter((edge) => edge.to !== nodeId);
  const node = graph.nodes.find((entry) => entry.id === nodeId);
  if (node) node.directCauseIds = [];
  for (const edge of incoming) {
    const cause = graph.nodes.find((entry) => entry.id === edge.from);
    if (cause) cause.directEffectIds = cause.directEffectIds.filter((id) => id !== nodeId);
  }
}

function invalidReference(): MutableReference {
  return {
    decisionId: "missing:1",
    streamId: "missing",
    namespace: "missing",
    sampleIndexes: [1],
    firstSampleIndex: 1,
    lastSampleIndex: 1,
    purpose: "无效引用",
    candidateSetId: "missing",
    selectedValue: "missing",
  };
}

function invalidBinding(): MutableBinding {
  return {
    decisionId: "missing:1",
    resultNodeId: "n1",
    resultSubjectId: "fixture.result",
    nodeKind: "universe",
    bindingKind: "field",
    locator: {
      kind: "entity_id",
      entityKind: "timeline_event",
      entityId: "fixture.result",
      containerKind: "collection_member",
    },
    outputValueFingerprint: "fnv1a32:00000000",
  };
}

function rewriteDecisionOperation(decision: MutableDecision, operation: RandomDecisionRecord["operation"]): void {
  decision.operation = operation;
  if (operation === "next") {
    decision.parameters = { kind: "next" };
    decision.candidateSetId = "unit-interval";
    decision.candidates = [];
    decision.selectedValue = String(decision.sampleValue);
    return;
  }
  if (operation === "range") {
    decision.parameters = { kind: "range", min: 0, max: 10 };
    decision.candidateSetId = "range:0:10";
    decision.candidates = ["0", "10"];
    decision.selectedValue = String(decision.sampleValue * 10);
    return;
  }
  if (operation === "int") {
    decision.parameters = { kind: "int", min: 0, max: 9 };
    decision.candidateSetId = "integer:0:9";
    decision.candidates = ["0", "9"];
    decision.selectedValue = String(Math.floor(decision.sampleValue * 10));
    return;
  }
  if (operation === "bool") {
    decision.parameters = { kind: "bool", chance: 0.5 };
    decision.candidateSetId = "probability:0.5";
    decision.candidates = ["true", "false"];
    decision.selectedValue = String(decision.sampleValue < 0.5);
    return;
  }
  if (operation === "pick") {
    decision.candidates = ["A", "B"];
    decision.parameters = { kind: "pick", candidates: [...decision.candidates] };
    decision.candidateSetId = randomCandidateSetId(decision.candidates);
    decision.selectedValue = decision.candidates[Math.floor(decision.sampleValue * decision.candidates.length)];
    return;
  }
  decision.candidates = ["A@1", "B@2"];
  decision.parameters = { kind: "weighted", candidates: [{ label: "A", weight: 1 }, { label: "B", weight: 2 }] };
  decision.candidateSetId = randomCandidateSetId(decision.candidates);
  decision.selectedValue = decision.sampleValue * 3 <= 1 ? "A" : "B";
}

function rewriteDecisionOperationVariant(
  decision: MutableDecision,
  operation: Exclude<RandomDecisionRecord["operation"], "next">,
): void {
  if (operation === "range") {
    decision.parameters = { kind: "range", min: 20, max: 40 };
    decision.candidateSetId = "range:20:40";
    decision.candidates = ["20", "40"];
    decision.selectedValue = String(20 + decision.sampleValue * 20);
    return;
  }
  if (operation === "int") {
    decision.parameters = { kind: "int", min: 20, max: 29 };
    decision.candidateSetId = "integer:20:29";
    decision.candidates = ["20", "29"];
    decision.selectedValue = String(Math.floor(20 + decision.sampleValue * 10));
    return;
  }
  if (operation === "bool") {
    decision.parameters = { kind: "bool", chance: 0.75 };
    decision.candidateSetId = "probability:0.75";
    decision.candidates = ["true", "false"];
    decision.selectedValue = String(decision.sampleValue < 0.75);
    return;
  }
  if (operation === "pick") {
    decision.candidates = ["C", "B", "A"];
    decision.parameters = { kind: "pick", candidates: [...decision.candidates] };
    decision.candidateSetId = randomCandidateSetId(decision.candidates);
    decision.selectedValue = decision.candidates[Math.floor(decision.sampleValue * decision.candidates.length)];
    return;
  }
  decision.candidates = ["C@3", "D@1"];
  decision.parameters = { kind: "weighted", candidates: [{ label: "C", weight: 3 }, { label: "D", weight: 1 }] };
  decision.candidateSetId = randomCandidateSetId(decision.candidates);
  decision.selectedValue = decision.sampleValue * 4 <= 3 ? "C" : "D";
}

function issueCodes(graph: CausalGraph): CausalValidationIssueCode[] {
  return validateCausalGraphStructure(graph, graph.generation).issues.map((issue) => issue.code);
}

function cloneGraph(graph: CausalGraph): MutableGraph {
  return structuredClone(graph) as MutableGraph;
}
