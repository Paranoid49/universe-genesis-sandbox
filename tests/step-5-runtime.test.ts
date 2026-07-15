import { describe, expect, it } from "vitest";
import {
  ARCANE_WEAVE,
  DREAM_FLUX,
  MATERIAL_EXPANSE,
  advanceUniverseBranch,
  advanceUniverseState,
  buildRuntimeCausalNetwork,
  compareUniverseBranches,
  constitutionTimeLabel,
  createBranchArchive,
  createConstitutionModule,
  createExperimentInput,
  createGenesisPackage,
  createHistoryBranchPackage,
  createInitialUniverseState,
  createInterventionInput,
  createObservationAccess,
  createRootBranch,
  forkUniverseBranch,
  parseBranchArchive,
  parseGenesisPackage,
  parseHistoryBranchPackage,
  parseRuntimeArchive,
  projectRuntimeEvents,
  restoreRuntimeArchive,
  serializeBranchArchive,
  serializeSharePackage,
  createRuntimeArchive,
  createUniverseConstitution,
  type GenesisPackage,
  type OntologyModuleSpec,
} from "../src/sim";
import { runtimeFingerprint } from "../src/sim/runtime-integrity";
import { createRuntimeTopology } from "../src/sim/runtime-topology";

describe("步骤 5 多本体运行纵向契约", () => {
  it("三个参考宇宙通过同一入口创建、演化、产生事件并完成因果闭包", () => {
    const states = [MATERIAL_EXPANSE, ARCANE_WEAVE, DREAM_FLUX].map((constitution) => {
      let state = createInitialUniverseState({ seed: "MULTI-ONTOLOGY-001", constitution });
      state = advanceUniverseState(advanceUniverseState(state));
      const events = projectRuntimeEvents(state);
      const network = buildRuntimeCausalNetwork(state);
      expect(events.length).toBeGreaterThan(0);
      expect(network.rootNodeIds).toContain("runtime-root:constitution");
      expect(network.nodes.some((entry) => entry.kind === "evaluation")).toBe(true);
      expect(network.nodes.every((entry) => entry.root || entry.directCauseIds.length > 0)).toBe(true);
      return state;
    });
    expect(new Set(states.map((state) => Object.values(state.objects)[0].kind)).size).toBe(3);
    expect(new Set(states.map((state) => state.transitions[0].ruleIds[0])).size).toBe(3);
  });

  it("时间、观察和干预能力随宪法变化", () => {
    expect(constitutionTimeLabel(MATERIAL_EXPANSE, 13)).toBe("纪元步 13");
    expect(constitutionTimeLabel(ARCANE_WEAVE, 13)).toBe("相位 2/12");
    expect(constitutionTimeLabel(DREAM_FLUX, 4)).toBe("变奏｜4");
    const material = createInitialUniverseState({ seed: "MULTI-CAPABILITY-001", constitution: MATERIAL_EXPANSE });
    const arcane = createInitialUniverseState({ seed: "MULTI-CAPABILITY-001", constitution: ARCANE_WEAVE });
    const dream = createInitialUniverseState({ seed: "MULTI-CAPABILITY-001", constitution: DREAM_FLUX });
    expect(createObservationAccess(material).methods.map((entry) => entry.id)).toContain("structure");
    expect(createObservationAccess(arcane).methods.map((entry) => entry.id)).toContain("arcane.aura");
    expect(createObservationAccess(dream).methods.map((entry) => entry.id)).toContain("dream.coherence");
    expect(createObservationAccess(material).metrics.map((entry) => entry.name)).toEqual(["凝聚度", "能量"]);
    expect(createObservationAccess(arcane).metrics.map((entry) => entry.name)).toEqual(["共鸣", "法力"]);
    expect(createObservationAccess(dream).metrics.map((entry) => entry.name)).toEqual(["连贯性", "可塑性"]);
    expect(createObservationAccess(dream).metrics.every((entry) => entry.visibility === "observable" && entry.methodIds.length > 0)).toBe(true);
    expect([material, arcane, dream].map((state) => state.topology.mode)).toEqual(["hierarchical", "relational", "semantic"]);
    expect([material, arcane, dream].every((state) => Object.keys(state.topology.relations).length > 0)).toBe(true);
    expect(createObservationAccess(material).topology.relationNames).toEqual(["包含", "邻接"]);
    expect(createObservationAccess(arcane).objects[0].label).toContain("奥术结点");
    expect(createObservationAccess(arcane).objects[0].label).not.toContain("arcane-knot");
    expect(createObservationAccess(material).publicAxioms.map((entry) => entry.id)).toEqual(["rule.material-condensation@1"]);
    expect(() => createInterventionInput(dream, "branch:dream", "coherence", 2, 1)).toThrow("不允许");
    expect(createInterventionInput(arcane, "branch:arcane", "resonance", 2, 1).payload.capabilityId).toBe("capability.arcane.attune");
  });

  it("动态干预使用宪法范围并能选择非首对象目标", () => {
    const baseOntology = MATERIAL_EXPANSE.modules.find((entry) => entry.category === "ontology")!.spec as OntologyModuleSpec;
    const ontology = createConstitutionModule({ id: "ontology.dynamic-targets@1", moduleVersion: "1.0.0", category: "ontology", name: "多目标物质本体", description: "创建两个可独立选择的物质对象。", dependencies: [], conflicts: [], spec: { objectKinds: baseOntology.objectKinds.map((kind) => ({ ...kind, initialCount: 2 })) } });
    const topology = createConstitutionModule({ id: "topology.dynamic-targets@1", moduleVersion: "1.0.0", category: "topology", name: "多目标关系", description: "在两个物质对象间建立有向连接。", dependencies: [], conflicts: [], spec: { mode: "relational", relationNames: ["连接"], initialRelations: [{ id: "relation.dynamic.link", name: "连接", sourceKind: "matter-region", targetKind: "matter-region", directed: true }] } });
    const intervention = createConstitutionModule({ id: "intervention.dynamic-range@1", moduleVersion: "1.0.0", category: "intervention", name: "大范围干预", description: "允许正负三十能量变化。", dependencies: [], conflicts: [], spec: { capabilities: [{ id: "capability.dynamic.energy", name: "大范围能量调整", targetKinds: ["matter-region"], field: "energy", minimumDelta: -30, maximumDelta: 30 }] } });
    const constitution = createUniverseConstitution({ name: "动态干预夹具", description: "无", modules: MATERIAL_EXPANSE.modules.map((entry) => entry.category === "ontology" ? ontology : entry.category === "topology" ? topology : entry.category === "intervention" ? intervention : entry) });
    const initial = createInitialUniverseState({ seed: "DYNAMIC-INTERVENTION-001", constitution });
    const [firstId, secondId] = Object.keys(initial.objects);
    expect(Object.values(initial.topology.relations)[0]).toMatchObject({ sourceObjectId: firstId, targetObjectId: secondId });
    expect(createRuntimeTopology(constitution, {}).relations).toEqual({});
    const input = createInterventionInput(initial, "branch:dynamic", "energy", 25, 1, secondId, "capability.dynamic.energy");
    const next = advanceUniverseState(initial, [input]);
    const adjustments = next.transitions[0].differences.filter((entry) => entry.ruleId === "constitution.input-adjustment@1");
    expect(adjustments.map((entry) => entry.objectId)).toEqual([secondId]);
    expect((adjustments[0].after as number) - (adjustments[0].before as number)).toBe(25);
    expect(adjustments.some((entry) => entry.objectId === firstId)).toBe(false);
  });

  it("规律追踪只公开认知模块明确声明的公理", () => {
    const cognition = createConstitutionModule({ id: "cognition.no-public-axioms@1", moduleVersion: "1.0.0", category: "cognition", name: "无公开公理", description: "规则可以运行，但不能被规律追踪直接公开。", dependencies: [], conflicts: [], spec: { publicAxiomIds: [], hiddenAttributeIds: [] } });
    const constitution = createUniverseConstitution({ name: "无公开公理夹具", description: "无", modules: MATERIAL_EXPANSE.modules.map((entry) => entry.category === "cognition" ? cognition : entry) });
    const state = advanceUniverseState(createInitialUniverseState({ seed: "COGNITION-PUBLIC-AXIOM-001", constitution }));
    const access = createObservationAccess(state);
    const signal = access.observe({ methodId: "rule-trace", objectId: Object.keys(state.objects)[0], tick: state.clock.tick });
    expect(access.publicAxioms).toEqual([]);
    expect(signal.visibleValue).toBe("尚无已应用公开规则证据");
    expect(signal.visibleValue).not.toContain("rule.material-condensation@1");
    expect(signal.knowledgeStatus).toBe("insufficient");
  });

  it("规律追踪在多规则实际执行时只显示公开子集", () => {
    const action = createConstitutionModule({ id: "action.partially-public@1", moduleVersion: "1.0.0", category: "action", name: "部分公开规则夹具", description: "两条规则实际执行，但只允许公开其中一条。", dependencies: [], conflicts: [], spec: { rules: [
      { id: "rule.public.cohesion@1", name: "公开凝聚", targetKind: "matter-region", priority: 20, conditions: [], effects: [{ field: "cohesion", operation: "add", value: 1 }] },
      { id: "rule.hidden.energy@1", name: "隐藏能量", targetKind: "matter-region", priority: 10, conditions: [], effects: [{ field: "energy", operation: "add", value: -1 }] },
    ] } });
    const cognition = createConstitutionModule({ id: "cognition.partially-public@1", moduleVersion: "1.0.0", category: "cognition", name: "部分公开认知", description: "只公开凝聚规则。", dependencies: [], conflicts: [], spec: { publicAxiomIds: ["rule.public.cohesion@1"], hiddenAttributeIds: [] } });
    const constitution = createUniverseConstitution({ name: "部分公开规则夹具", description: "无", modules: MATERIAL_EXPANSE.modules.map((entry) => entry.category === "action" ? action : entry.category === "cognition" ? cognition : entry) });
    const state = advanceUniverseState(createInitialUniverseState({ seed: "COGNITION-PARTIAL-AXIOM-001", constitution }));
    expect(state.transitions[0].ruleIds).toEqual(["rule.public.cohesion@1", "rule.hidden.energy@1"]);
    const access = createObservationAccess(state);
    const signal = access.observe({ methodId: "rule-trace", objectId: Object.keys(state.objects)[0], tick: state.clock.tick });
    expect(access.publicAxioms.map((entry) => entry.id)).toEqual(["rule.public.cohesion@1"]);
    expect(signal.visibleValue).toBe("rule.public.cohesion@1");
    expect(signal.visibleValue).not.toContain("rule.hidden.energy@1");
    expect(signal.knowledgeStatus).toBe("confirmed");
  });

  it("每个随机决定只引用实际生成该抽样的规则", () => {
    const action = createConstitutionModule({ id: "action.random-ownership@1", moduleVersion: "1.0.0", category: "action", name: "随机归属夹具", description: "两条规则分别写入不同字段。", dependencies: [], conflicts: [], spec: { rules: [
      { id: "rule.random.cohesion@1", name: "随机凝聚", targetKind: "matter-region", priority: 20, conditions: [], effects: [{ field: "cohesion", operation: "add", value: 1, randomMinimum: 0, randomMaximum: 1 }] },
      { id: "rule.random.energy@1", name: "随机能量", targetKind: "matter-region", priority: 10, conditions: [], effects: [{ field: "energy", operation: "add", value: -1, randomMinimum: 0, randomMaximum: 1 }] },
    ] } });
    const cognition = createConstitutionModule({ id: "cognition.random-ownership@1", moduleVersion: "1.0.0", category: "cognition", name: "随机归属认知", description: "公开两条夹具规则。", dependencies: [], conflicts: [], spec: { publicAxiomIds: ["rule.random.cohesion@1", "rule.random.energy@1"], hiddenAttributeIds: [] } });
    const constitution = createUniverseConstitution({ name: "随机归属夹具", description: "无", modules: MATERIAL_EXPANSE.modules.map((entry) => entry.category === "action" ? action : entry.category === "cognition" ? cognition : entry) });
    const state = advanceUniverseState(createInitialUniverseState({ seed: "RANDOM-OWNERSHIP-001", constitution }));
    const network = buildRuntimeCausalNetwork(state);
    for (const execution of state.transitions[0].ruleExecutions.filter((entry) => entry.randomDecisionIds.length > 0)) {
      for (const decisionId of execution.randomDecisionIds) {
        const node = network.nodes.find((entry) => entry.subjectId === decisionId)!;
        expect(node.directCauseIds.filter((id) => id.startsWith("rule."))).toEqual([execution.ruleId]);
      }
    }
  });

  it("非空间梦流完成实验、分支、保存、恢复和继续", () => {
    const initial = createInitialUniverseState({ seed: "DREAM-VERTICAL-001", constitution: DREAM_FLUX });
    const root = createRootBranch(initial);
    const input = createExperimentInput(initial, root.branchId, "coherence", 4, 1);
    const child = forkUniverseBranch(root, 0, [input]);
    expect(child.parentBranchId).toBe(root.branchId);
    expect(root.state.clock.tick).toBe(0);
    const restored = parseBranchArchive(serializeBranchArchive(createBranchArchive(child))).branch;
    expect(restored).toEqual(child);
    expect(advanceUniverseBranch(restored)).toEqual(advanceUniverseBranch(child));
    expect(Object.values(restored.state.objects)[0].kind).toBe("dream-motif");
    expect(JSON.stringify(restored)).not.toMatch(/galaxy|star|planet|life|civilization/i);
  });

  it("三个参考宇宙存档恢复后的下一步与未中断运行一致", () => {
    for (const constitution of [MATERIAL_EXPANSE, ARCANE_WEAVE, DREAM_FLUX]) {
      const state = advanceUniverseState(createInitialUniverseState({ seed: "MULTI-ARCHIVE-001", constitution }));
      const restored = restoreRuntimeArchive(createRuntimeArchive(state));
      expect(advanceUniverseState(restored)).toEqual(advanceUniverseState(state));
      expect(restored.identity.constitution).toEqual(constitution);
    }
  });

  it("跨宪法分支不能冒充共同祖先", () => {
    const material = createRootBranch(createInitialUniverseState({ seed: "CROSS-CONSTITUTION-001", constitution: MATERIAL_EXPANSE }));
    const dream = createRootBranch(createInitialUniverseState({ seed: "CROSS-CONSTITUTION-001", constitution: DREAM_FLUX }));
    expect(() => compareUniverseBranches(material, dream)).toThrow("跨宇宙");
  });

  it("规则执行与显式输入在因果网络中保留完整裁决证据", () => {
    const initial = createInitialUniverseState({ seed: "EXECUTION-EVIDENCE-001", constitution: ARCANE_WEAVE });
    const input = createInterventionInput(initial, "branch:evidence", "resonance", 2, 1);
    const state = advanceUniverseState(initial, [input]);
    expect(Object.values(state.objects)[0].attributes.mana).toBe((Object.values(initial.objects)[0].attributes.mana as number) - 3);
    const network = buildRuntimeCausalNetwork(state);
    const executionNodes = network.nodes.filter((entry) => entry.kind === "evaluation");
    const ruleEvidence = JSON.parse(executionNodes.find((entry) => JSON.parse(entry.description).conditions.length > 0)!.description) as Record<string, unknown>;
    expect(ruleEvidence).toHaveProperty("constraints");
    expect(ruleEvidence).toHaveProperty("cost");
    expect(ruleEvidence).toHaveProperty("effects");
    expect(ruleEvidence).toHaveProperty("randomDecisionIds");
    expect(ruleEvidence).toHaveProperty("arbitration");
    const inputExecution = executionNodes.find((entry) => entry.directCauseIds.includes("runtime-cause:" + input.id));
    expect(inputExecution).toBeTruthy();
    expect(JSON.parse(inputExecution!.description).inputIds).toEqual([input.id]);
    expect(JSON.parse(inputExecution!.description).effects).toEqual(["mana", "resonance"]);
    const adjustment = state.transitions[0].differences.find((entry) => entry.ruleId === "constitution.input-adjustment@1");
    const adjustmentNode = network.nodes.find((entry) => entry.subjectId.endsWith(".difference." + (state.transitions[0].differences.indexOf(adjustment!) + 1)));
    expect(adjustmentNode?.directCauseIds).toContain(inputExecution!.id);
  });

  it("创世条件包绑定完整宪法并拒绝模块内容重签篡改", () => {
    const state = createInitialUniverseState({ seed: "GENESIS-CONSTITUTION-001", constitution: ARCANE_WEAVE });
    const valid = createGenesisPackage(state.identity);
    expect(parseGenesisPackage(serializeSharePackage(valid))).toEqual(valid);
    const forged = structuredClone(valid) as GenesisPackage;
    (forged.universeDefinition.constitution.modules[0] as { name: string }).name = "伪造本体";
    const { checksum: _checksum, ...payload } = forged;
    const resigned = { ...payload, checksum: runtimeFingerprint(payload) };
    expect(() => parseGenesisPackage(JSON.stringify(resigned))).toThrow("定义无效");
  });

  it("评审整改前的运行、分支和分享版本会被明确拒绝而不会静默重解释", () => {
    const state = advanceUniverseState(createInitialUniverseState({ seed: "LEGACY-VERSION-001", constitution: MATERIAL_EXPANSE }));
    const runtimeArchive = createRuntimeArchive(state);
    expect(() => parseRuntimeArchive(JSON.stringify({ ...runtimeArchive, version: "ugs-runtime-archive@3" }))).toThrow("版本不受支持");
    const branch = createRootBranch(state);
    const branchArchive = createBranchArchive(branch);
    expect(() => parseBranchArchive(JSON.stringify({ ...branchArchive, version: "ugs-branch-archive@3" }))).toThrow("版本无效");
    const genesis = createGenesisPackage(state.identity);
    expect(() => parseGenesisPackage(JSON.stringify({ ...genesis, version: "ugs-genesis-package@2" }))).toThrow("版本无效");
    const history = createHistoryBranchPackage(branch);
    expect(() => parseHistoryBranchPackage(JSON.stringify({ ...history, version: "ugs-history-branch-package@3" }))).toThrow("版本无效");
  });
});
