import { describe, expect, it } from "vitest";
import {
  ARCANE_WEAVE,
  DREAM_FLUX,
  LIVING_TIDE,
  MATERIAL_EXPANSE,
  advanceUniverseState,
  buildRuntimeCausalNetwork,
  completeAutonomyStep,
  createInitialUniverseState,
  createConstitutionModule,
  createUniverseConstitution,
  parseRuntimeArchive,
  prepareAutonomyStep,
  createRuntimeArchive,
  restoreRuntimeArchive,
  restoreUniverseState,
  type ActionModuleSpec,
  type BoundaryModuleSpec,
  type CognitionModuleSpec,
  type ConstraintModuleSpec,
  type InterventionModuleSpec,
  type OntologyModuleSpec,
  type TopologyModuleSpec,
  type UniverseState,
} from "../src/sim/current";
import { compareBranchObjects } from "../src/sim/branch-comparison-evidence";
import { branchStateHash } from "../src/sim/branch-validation";
import { runtimeFingerprint } from "../src/sim/runtime-integrity";
import { runtimeStateFingerprint } from "../src/sim/runtime-state";

describe("步骤 6 自主实体运行契约", () => {
  it("现有三个参考宇宙保持无主体运行", () => {
    for (const constitution of [MATERIAL_EXPANSE, ARCANE_WEAVE, DREAM_FLUX]) {
      let state = createInitialUniverseState({ seed: "STEP6-NO-AGENT-001", constitution });
      for (let index = 0; index < 5; index += 1) state = advanceUniverseState(state);
      expect(state.autonomy.entities).toEqual({});
      expect(state.transitions.every((transition) => transition.autonomy.actions.length === 0)).toBe(true);
    }
  });

  it("潮生体从非自主状态形成、基于错误信念行动并最终停止", () => {
    let state = createInitialUniverseState({ seed: "STEP6-LIFECYCLE-001", constitution: LIVING_TIDE });
    expect(state.autonomy.entities).toEqual({});
    state = advanceUniverseState(state);
    expect(state.autonomy.entities).toEqual({});
    state = advanceUniverseState(state);
    expect(Object.values(state.autonomy.entities)).toHaveLength(2);
    expect(Object.values(state.autonomy.entities).every((entity) => entity.status === "active" && entity.lastAction?.status === "applied")).toBe(true);
    const first = Object.values(state.autonomy.entities)[0];
    expect(first.beliefs.find((belief) => belief.field === "energy")?.believedValue).toBe(4);
    expect(state.objects[first.objectId].attributes.energy).toBe(1);
    expect(Object.values(state.autonomy.narratives)[0].claim).toContain("4");
    expect(Object.values(state.autonomy.mythArchives)[0].sourceNarrativeId).toBe(Object.values(state.autonomy.narratives)[0].id);
    expect(Object.values(state.autonomy.mythArchives)[0].id).not.toBe(Object.values(state.autonomy.narratives)[0].id);
    expect(Object.values(state.autonomy.relations)).toHaveLength(1);
    state = advanceUniverseState(state);
    expect(Object.values(state.autonomy.entities).every((entity) => entity.status === "active")).toBe(true);
    state = advanceUniverseState(state);
    expect(Object.values(state.autonomy.entities).every((entity) => entity.status === "ceased" && entity.ceasedAtTick === 3)).toBe(true);
    expect(Object.values(state.autonomy.relations).every((relation) => relation.status === "ceased")).toBe(true);
    expect(state.transitions.at(-1)?.autonomy.actions).toEqual([]);
  });

  it("自主记忆有界且恢复后的下一步完全一致", () => {
    let state = createInitialUniverseState({ seed: "STEP6-MEMORY-001", constitution: LIVING_TIDE });
    for (let index = 0; index < 3; index += 1) state = advanceUniverseState(state);
    expect(Object.values(state.autonomy.entities).every((entity) => entity.memories.length <= 4)).toBe(true);
    const restored = restoreRuntimeArchive(createRuntimeArchive(state));
    expect(advanceUniverseState(restored)).toEqual(advanceUniverseState(state));
  });

  it("容量为一的当前记忆窗口仍保留信念历史来源并可连续恢复", () => {
    const cognitionSpec = LIVING_TIDE.modules.find((module) => module.category === "cognition")!.spec as CognitionModuleSpec;
    const cognition = createConstitutionModule({ id: "cognition.memory-one@1", moduleVersion: "1.0.0", category: "cognition", name: "单记忆窗口", description: "当前只能回忆一条记录。", dependencies: [], conflicts: [], spec: { ...cognitionSpec, autonomyPolicies: cognitionSpec.autonomyPolicies?.map((policy) => ({ ...policy, memoryCapacity: 1 })) } });
    const constitution = createUniverseConstitution({ name: "单记忆窗口夹具", description: "无", modules: LIVING_TIDE.modules.map((module) => module.category === "cognition" ? cognition : module) });
    let state = createInitialUniverseState({ seed: "STEP6-MEMORY-ONE-001", constitution });
    for (let index = 0; index < 3; index += 1) state = advanceUniverseState(state);
    expect(Object.values(state.autonomy.entities).every((entity) => entity.memories.length === 1 && entity.beliefs.every((belief) => belief.memoryIds.length === 1))).toBe(true);
    const restored = restoreRuntimeArchive(createRuntimeArchive(state));
    expect(advanceUniverseState(restored)).toEqual(advanceUniverseState(state));
  });

  it("自主行动因果链包含感知、记忆、信念、意图、规则执行和后果", () => {
    let state = createInitialUniverseState({ seed: "STEP6-CAUSAL-001", constitution: LIVING_TIDE });
    state = advanceUniverseState(advanceUniverseState(state));
    const network = buildRuntimeCausalNetwork(state);
    const transition = state.transitions[1];
    const action = transition.autonomy.actions[0];
    const actionNode = network.nodes.find((node) => node.subjectId === action.id)!;
    expect(actionNode.kind).toBe("action");
    expect(actionNode.directCauseIds).toContain("runtime-cause:" + action.intentId);
    const differenceNode = network.nodes.find((node) => node.kind === "difference" && node.directCauseIds.includes(actionNode.id));
    expect(differenceNode).toBeTruthy();
    expect(network.nodes.some((node) => node.kind === "perception")).toBe(true);
    expect(network.nodes.some((node) => node.kind === "memory")).toBe(true);
    expect(network.nodes.some((node) => node.kind === "belief")).toBe(true);
    expect(network.nodes.some((node) => node.kind === "intent")).toBe(true);
    expect(network.nodes.every((node) => node.root || node.directCauseIds.length > 0)).toBe(true);
  });

  it("同一规则由多个主体执行时差异只连接所属主体的执行记录", () => {
    const state = formedState("STEP6-CAUSAL-OWNER-001");
    const transition = state.transitions[1];
    const network = buildRuntimeCausalNetwork(state);
    for (const [index, difference] of transition.differences.entries()) {
      const action = transition.autonomy.actions.find((entry) => entry.differenceIndexes.includes(index));
      if (!action) continue;
      const entity = state.autonomy.entities[action.entityId];
      const differenceNode = network.nodes.find((entry) => entry.subjectId === `${transition.id}.difference.${index + 1}`)!;
      const executionIds = differenceNode.directCauseIds.filter((id) => id.startsWith("runtime-cause:rule-execution:"));
      expect(executionIds).toEqual([`runtime-cause:${action.executionRecordId}:${transition.id}`]);
      expect(transition.ruleExecutions.find((entry) => `runtime-cause:${entry.id}:${transition.id}` === executionIds[0])?.objectId).toBe(entity.objectId);
      expect(difference.objectId).toBe(entity.objectId);
    }
  });

  it("自主状态进入分支状态哈希和状态比较", () => {
    const state = formedState("STEP6-BRANCH-AUTONOMY-001");
    const forged = structuredClone(state) as MutableUniverseState;
    Object.values(forged.autonomy.entities)[0].name = "不同主体名称";
    Object.values(forged.autonomy.entities)[0].memories[0].summary = "不同记忆摘要";
    expect(branchStateHash(forged)).not.toBe(branchStateHash(state));
    const differences = compareBranchObjects(state, forged);
    expect(differences.some((entry) => entry.field === "autonomy.entity.name")).toBe(true);
    expect(differences.some((entry) => entry.field === "autonomy.entity.memories")).toBe(true);
    expect(JSON.stringify(differences)).not.toContain("不同记忆摘要");
  });

  it("行动因果公开投影不泄露私有认知和内部标识", () => {
    const state = formedState("STEP6-PUBLIC-CAUSAL-001");
    const network = buildRuntimeCausalNetwork(state);
    const actionId = "runtime-cause:" + state.transitions[1].autonomy.actions[0].id;
    const pending = [actionId];
    const seen = new Set<string>();
    const visible: string[] = [];
    while (pending.length) {
      const id = pending.shift()!;
      if (seen.has(id) || id.startsWith("public:")) continue;
      seen.add(id);
      const node = network.nodes.find((entry) => entry.id === id);
      if (!node) continue;
      visible.push(node.label, node.description);
      for (const related of network.nodes.filter((entry) => node.directCauseIds.includes(entry.id) || node.directEffectIds.includes(entry.id))) {
        visible.push(related.label, related.description);
        pending.push(related.id);
      }
    }
    expect(visible.join("｜")).not.toMatch(/rule\.tide|autonomy-|runtime\.object|置信度|被感知为|确定性偏差|\bapplied\b/);
    expect(visible.join("｜")).toContain("内部依据");
  });

  it("自主行动被统一执行器拒绝时不产生部分后果", () => {
    const actionSpec = LIVING_TIDE.modules.find((module) => module.category === "action")!.spec as ActionModuleSpec;
    const action = createConstitutionModule({ id: "action.rejected-agent@1", moduleVersion: "1.0.0", category: "action", name: "高代价自主行动", description: "自主行动代价超过实体当前能量。", dependencies: [], conflicts: [], spec: { rules: actionSpec.rules.map((rule) => rule.trigger === "autonomous" ? { ...rule, cost: { field: "energy", amount: 5 } } : rule) } });
    const constitution = createUniverseConstitution({ name: "自主拒绝夹具", description: "无", modules: LIVING_TIDE.modules.map((module) => module.category === "action" ? action : module) });
    let state = createInitialUniverseState({ seed: "STEP6-REJECT-001", constitution });
    state = advanceUniverseState(advanceUniverseState(state));
    const transition = state.transitions[1];
    expect(transition.autonomy.actions.every((entry) => entry.status === "rejected" && entry.differenceIndexes.length === 0)).toBe(true);
    expect(Object.values(state.objects).every((object) => object.attributes.energy === 2 && object.attributes.signal === 0)).toBe(true);
    expect(transition.ruleExecutions.filter((record) => record.ruleId === "rule.tide.signal@1").every((record) => record.status === "cost-rejected")).toBe(true);
  });

  it("随机效果被约束拒绝时不消费随机游标", () => {
    const actionSpec = LIVING_TIDE.modules.find((module) => module.category === "action")!.spec as ActionModuleSpec;
    const action = createConstitutionModule({ id: "action.random-rejected@1", moduleVersion: "1.0.0", category: "action", name: "随机拒绝夹具", description: "随机效果必然越过属性上界。", dependencies: [], conflicts: [], spec: { rules: actionSpec.rules.map((rule) => rule.trigger === "autonomous" ? { ...rule, effects: [{ field: "signal", operation: "add" as const, value: 100, randomMinimum: 1, randomMaximum: 3 }] } : rule) } });
    const constitution = createUniverseConstitution({ name: "随机拒绝夹具", description: "无", modules: LIVING_TIDE.modules.map((module) => module.category === "action" ? action : module) });
    const state = advanceUniverseState(advanceUniverseState(createInitialUniverseState({ seed: "STEP6-RANDOM-REJECT-001", constitution })));
    const transition = state.transitions[1];
    expect(transition.autonomy.actions.every((entry) => entry.status === "rejected")).toBe(true);
    expect(transition.randomDecisions).toEqual([]);
    expect(Object.values(state.randomStreams)[0].sampleCount).toBe(0);
    expect(transition.ruleExecutions.filter((entry) => entry.ruleId === "rule.tide.signal@1").every((entry) => entry.randomDecisionIds.length === 0)).toBe(true);
  });

  it("自主行动预算超限形成稳定拒绝记录而不中止转换", () => {
    const boundarySpec = LIVING_TIDE.modules.find((module) => module.category === "boundary")!.spec as BoundaryModuleSpec;
    const boundary = createConstitutionModule({ id: "boundary.one-action@1", moduleVersion: "1.0.0", category: "boundary", name: "单行动预算", description: "每步只允许一个自主行动。", dependencies: [], conflicts: [], spec: { ...boundarySpec, maximumAutonomousActionsPerStep: 1 } });
    const constitution = createUniverseConstitution({ name: "单行动预算夹具", description: "无", modules: LIVING_TIDE.modules.map((module) => module.category === "boundary" ? boundary : module) });
    const state = advanceUniverseState(advanceUniverseState(createInitialUniverseState({ seed: "STEP6-ACTION-BUDGET-001", constitution })));
    const actions = state.transitions[1].autonomy.actions;
    expect(actions.map((entry) => entry.status).sort()).toEqual(["applied", "rejected"]);
    const rejected = actions.find((entry) => entry.status === "rejected")!;
    const record = state.transitions[1].ruleExecutions.find((entry) => entry.id === rejected.executionRecordId)!;
    expect(record.status).toBe("arbitration-rejected");
    expect(record.arbitration).toContain("自主行动预算");
    expect(record.randomDecisionIds).toEqual([]);
  });

  it.each([
    ["lt", 5],
    ["eq", 4],
    ["gt", 3],
  ] as const)("自主意图支持 %s 数值比较运算", (operator, value) => {
    const cognitionSpec = LIVING_TIDE.modules.find((module) => module.category === "cognition")!.spec as CognitionModuleSpec;
    const cognition = createConstitutionModule({ id: `cognition.operator-${operator}@1`, moduleVersion: "1.0.0", category: "cognition", name: "自主比较夹具", description: "覆盖自主意图数值比较分支。", dependencies: [], conflicts: [], spec: { ...cognitionSpec, autonomyPolicies: cognitionSpec.autonomyPolicies?.map((policy) => ({ ...policy, actions: policy.actions.map((action) => ({ ...action, operator, value })) })) } });
    const constitution = createUniverseConstitution({ name: "自主比较夹具", description: "无", modules: LIVING_TIDE.modules.map((module) => module.category === "cognition" ? cognition : module) });
    const state = advanceUniverseState(advanceUniverseState(createInitialUniverseState({ seed: `STEP6-OPERATOR-${operator}`, constitution })));
    expect(state.transitions[1].autonomy.actions.every((action) => action.status === "applied")).toBe(true);
  });

  it.each([
    ["condition-rejected", "条件不成立", (rule: ActionModuleSpec["rules"][number]) => ({ ...rule, conditions: [{ field: "energy", operator: "gte" as const, value: 10 }] })],
    ["constraint-rejected", "约束不允许", (rule: ActionModuleSpec["rules"][number]) => ({ ...rule, effects: [{ field: "signal", operation: "add" as const, value: 100 }] })],
  ] as const)("自主规则发生 %s 时提供中文拒绝原因", (status, reason, transform) => {
    const actionSpec = LIVING_TIDE.modules.find((module) => module.category === "action")!.spec as ActionModuleSpec;
    const action = createConstitutionModule({ id: `action.${status}@1`, moduleVersion: "1.0.0", category: "action", name: "自主拒绝原因夹具", description: "覆盖统一执行器拒绝原因。", dependencies: [], conflicts: [], spec: { rules: actionSpec.rules.map((rule) => rule.trigger === "autonomous" ? transform(rule) : rule) } });
    const constitution = createUniverseConstitution({ name: "自主拒绝原因夹具", description: "无", modules: LIVING_TIDE.modules.map((module) => module.category === "action" ? action : module) });
    const state = advanceUniverseState(advanceUniverseState(createInitialUniverseState({ seed: `STEP6-REJECTION-${status}`, constitution })));
    expect(state.transitions[1].ruleExecutions.filter((record) => record.ruleId === "rule.tide.signal@1").every((record) => record.status === status)).toBe(true);
    expect(state.transitions[1].autonomy.actions.every((entry) => entry.reason.includes(reason))).toBe(true);
  });

  it("自主规则在冲突裁决中被拒绝时提供中文原因", () => {
    const actionSpec = LIVING_TIDE.modules.find((module) => module.category === "action")!.spec as ActionModuleSpec;
    const competingRule = { id: "rule.tide.environment-signal@1", name: "环境信号", targetKind: "tide-organism", priority: 120, conditions: [{ field: "signal", operator: "gte" as const, value: 0 }], effects: [{ field: "signal", operation: "add" as const, value: 1 }] };
    const action = createConstitutionModule({ id: "action.arbitration-rejected@1", moduleVersion: "1.0.0", category: "action", name: "自主冲突夹具", description: "环境规则优先占用同一效果字段。", dependencies: [], conflicts: [], spec: { rules: [...actionSpec.rules, competingRule] } });
    const constitution = createUniverseConstitution({ name: "自主冲突夹具", description: "无", modules: LIVING_TIDE.modules.map((module) => module.category === "action" ? action : module) });
    const state = advanceUniverseState(advanceUniverseState(createInitialUniverseState({ seed: "STEP6-ARBITRATION-001", constitution })));
    expect(state.transitions[1].ruleExecutions.filter((record) => record.ruleId === "rule.tide.signal@1").every((record) => record.status === "arbitration-rejected")).toBe(true);
    expect(state.transitions[1].autonomy.actions.every((entry) => entry.reason.includes("规则或预算拒绝"))).toBe(true);
  });

  it("自主意图缺少执行记录时形成明确拒绝而不伪造后果", () => {
    const state = advanceUniverseState(createInitialUniverseState({ seed: "STEP6-MISSING-EXECUTION-001", constitution: LIVING_TIDE }));
    const preparation = prepareAutonomyStep(state);
    const completed = completeAutonomyStep(state, preparation, { objects: state.objects, differences: [], records: [], randomDecisionIds: [] }, 2);
    expect(Object.values(completed.state.entities).every((entity) => entity.lastAction?.status === "rejected")).toBe(true);
    expect(completed.transition.actions.every((action) => action.reason.includes("缺少执行记录") && action.differenceIndexes.length === 0)).toBe(true);
  });

  it("运行因果区分拒绝、静默行动和无执行记录差异", () => {
    const actionSpec = LIVING_TIDE.modules.find((module) => module.category === "action")!.spec as ActionModuleSpec;
    const rejectedAction = createConstitutionModule({ id: "action.causal-rejected@1", moduleVersion: "1.0.0", category: "action", name: "因果拒绝夹具", description: "无", dependencies: [], conflicts: [], spec: { rules: actionSpec.rules.map((rule) => rule.trigger === "autonomous" ? { ...rule, conditions: [{ field: "energy", operator: "gte" as const, value: 10 }] } : rule) } });
    const rejectedConstitution = createUniverseConstitution({ name: "因果拒绝夹具", description: "无", modules: LIVING_TIDE.modules.map((module) => module.category === "action" ? rejectedAction : module) });
    const rejected = buildRuntimeCausalNetwork(advanceUniverseState(advanceUniverseState(createInitialUniverseState({ seed: "STEP6-CAUSAL-REJECTED-001", constitution: rejectedConstitution }))));
    expect(rejected.nodes.some((node) => node.kind === "evaluation" && node.label === "已拒绝")).toBe(true);
    expect(rejected.nodes.some((node) => node.kind === "action" && node.label === "已拒绝")).toBe(true);

    const cognitionSpec = LIVING_TIDE.modules.find((module) => module.category === "cognition")!.spec as CognitionModuleSpec;
    const idleCognition = createConstitutionModule({ id: "cognition.causal-idle@1", moduleVersion: "1.0.0", category: "cognition", name: "因果静默夹具", description: "无", dependencies: [], conflicts: [], spec: { ...cognitionSpec, autonomyPolicies: cognitionSpec.autonomyPolicies?.map((policy) => ({ ...policy, actions: policy.actions.map((action) => ({ ...action, value: 99 })) })) } });
    const idleConstitution = createUniverseConstitution({ name: "因果静默夹具", description: "无", modules: LIVING_TIDE.modules.map((module) => module.category === "cognition" ? idleCognition : module) });
    const idle = buildRuntimeCausalNetwork(advanceUniverseState(advanceUniverseState(createInitialUniverseState({ seed: "STEP6-CAUSAL-IDLE-001", constitution: idleConstitution }))));
    expect(idle.nodes.some((node) => node.kind === "action" && node.label === "未行动")).toBe(true);

    const forged = structuredClone(formedState("STEP6-CAUSAL-FALLBACK-001")) as MutableUniverseState;
    forged.transitions[0].differences[0].ruleId = "fixture.no-execution@1";
    const fallback = buildRuntimeCausalNetwork(forged);
    const difference = fallback.nodes.find((node) => node.subjectId === `${forged.transitions[0].id}.difference.1`)!;
    expect(difference.directCauseIds).toContain("fixture.no-execution@1");
  });

  it("非生物回声主体通过同一自主协议形成和行动", () => {
    const constitution = nonBiologicalFixture();
    let state = createInitialUniverseState({ seed: "STEP6-NONBIO-001", constitution });
    state = advanceUniverseState(advanceUniverseState(state));
    expect(Object.values(state.objects).every((object) => object.kind === "echo-knot")).toBe(true);
    expect(Object.values(state.autonomy.entities).every((entity) => entity.name.startsWith("觉醒回声"))).toBe(true);
    expect(state.transitions[1].autonomy.actions.every((action) => action.status === "applied")).toBe(true);
  });

  it("重签篡改自主认知历史仍被语义重放拒绝", () => {
    let state = createInitialUniverseState({ seed: "STEP6-TAMPER-001", constitution: LIVING_TIDE });
    state = advanceUniverseState(advanceUniverseState(state));
    const forged = structuredClone(createRuntimeArchive(state));
    (forged.state.transitions[1].autonomy.beliefs[0] as { believedValue: number }).believedValue = 999;
    forged.stateFingerprint = runtimeStateFingerprint(forged.state);
    const { checksum: _checksum, ...payload } = forged;
    forged.checksum = runtimeFingerprint(payload);
    expect(() => parseRuntimeArchive(JSON.stringify(forged))).toThrow("语义校验失败");
  });

  it.each([
    ["主体对象", "AUTONOMY_ENTITY_OBJECT", (state: MutableRuntimeArchive) => {
      const entity = Object.values(state.state.autonomy.entities)[0];
      entity.objectId = "runtime.object.missing";
    }],
    ["记忆来源", "AUTONOMY_MEMORY_SOURCE", (state: MutableRuntimeArchive) => {
      state.state.transitions[1].autonomy.memories[0].sourceId = "autonomy-perception:missing";
    }],
    ["信念记忆", "AUTONOMY_BELIEF_MEMORY", (state: MutableRuntimeArchive) => {
      state.state.transitions[1].autonomy.beliefs[0].memoryIds = ["autonomy-memory:missing"];
    }],
    ["关系主体", "AUTONOMY_RELATION_ENTITY", (state: MutableRuntimeArchive) => {
      Object.values(state.state.autonomy.relations)[0].targetEntityId = "autonomy-entity:missing";
    }],
    ["叙述信念", "AUTONOMY_NARRATIVE_BELIEF", (state: MutableRuntimeArchive) => {
      Object.values(state.state.autonomy.narratives)[0].beliefId = "autonomy-belief:missing";
    }],
  ])("重签篡改%s引用时以稳定错误码拒绝", (_label, code, mutate) => {
    let state = createInitialUniverseState({ seed: "STEP6-INTEGRITY-001", constitution: LIVING_TIDE });
    state = advanceUniverseState(advanceUniverseState(state));
    const forged = structuredClone(createRuntimeArchive(state)) as MutableRuntimeArchive;
    mutate(forged);
    resignArchive(forged);
    expect(() => parseRuntimeArchive(JSON.stringify(forged))).toThrow(code);
  });

  it("重签伪造主体停止后的行动时被拒绝", () => {
    let state = createInitialUniverseState({ seed: "STEP6-CEASED-ACTION-001", constitution: LIVING_TIDE });
    for (let index = 0; index < 4; index += 1) state = advanceUniverseState(state);
    const forged = structuredClone(createRuntimeArchive(state)) as MutableRuntimeArchive;
    forged.state.transitions[2].autonomy.actions[0].tick = 4;
    resignArchive(forged);
    expect(() => parseRuntimeArchive(JSON.stringify(forged))).toThrow("AUTONOMY_ACTION_AFTER_CEASED");
  });

  it.each([
    ["协议版本", "AUTONOMY_VERSION", (state: MutableUniverseState) => { state.autonomy.version = "ugs-autonomy@0" as "ugs-autonomy@2"; }],
    ["实体映射键", "AUTONOMY_ENTITY_ID", (state: MutableUniverseState) => { Object.values(state.autonomy.entities)[0].id = "autonomy-entity:forged"; }],
    ["实体策略", "AUTONOMY_ENTITY_POLICY", (state: MutableUniverseState) => { Object.values(state.autonomy.entities)[0].policyId = "autonomy-policy:missing"; }],
    ["停止时刻", "AUTONOMY_ENTITY_LIFECYCLE", (state: MutableUniverseState) => { const entity = Object.values(state.autonomy.entities)[0]; entity.status = "ceased"; entity.ceasedAtTick = -1; }],
    ["活动停止时刻", "AUTONOMY_ENTITY_LIFECYCLE", (state: MutableUniverseState) => { Object.values(state.autonomy.entities)[0].ceasedAtTick = 2; }],
    ["最后行动", "AUTONOMY_ACTION_REFERENCE", (state: MutableUniverseState) => { Object.values(state.autonomy.entities)[0].lastAction!.id = "autonomy-action:missing"; }],
    ["记忆主体", "AUTONOMY_MEMORY_ENTITY", (state: MutableUniverseState) => { const memory = state.transitions[1].autonomy.memories[0]; state.transitions[1].autonomy.memories.push({ ...memory, id: "autonomy-memory:forged", entityId: "autonomy-entity:missing" }); }],
    ["行动主体", "AUTONOMY_ACTION_ENTITY", (state: MutableUniverseState) => { const action = state.transitions[1].autonomy.actions[0]; state.transitions[1].autonomy.actions.push({ ...action, id: "autonomy-action:forged", entityId: "autonomy-entity:missing" }); }],
    ["行动意图", "AUTONOMY_ACTION_INTENT", (state: MutableUniverseState) => { state.transitions[1].autonomy.actions[0].intentId = "autonomy-intent:missing"; }],
    ["关系映射键", "AUTONOMY_RELATION_ID", (state: MutableUniverseState) => { Object.values(state.autonomy.relations)[0].id = "autonomy-relation:forged"; }],
    ["叙述映射键", "AUTONOMY_NARRATIVE_ID", (state: MutableUniverseState) => { Object.values(state.autonomy.narratives)[0].id = "autonomy-narrative:forged"; }],
    ["叙述主体", "AUTONOMY_NARRATIVE_ENTITY", (state: MutableUniverseState) => { Object.values(state.autonomy.narratives)[0].entityId = "autonomy-entity:missing"; }],
    ["神话档案映射键", "AUTONOMY_MYTH_ID", (state: MutableUniverseState) => { Object.values(state.autonomy.mythArchives)[0].id = "autonomy-myth:forged"; }],
    ["神话档案叙述", "AUTONOMY_MYTH_NARRATIVE", (state: MutableUniverseState) => { Object.values(state.autonomy.mythArchives)[0].sourceNarrativeId = "autonomy-narrative:missing"; }],
    ["信念主体", "AUTONOMY_BELIEF_ENTITY", (state: MutableUniverseState) => { Object.values(state.autonomy.entities)[0].beliefs[0].entityId = "autonomy-entity:missing"; }],
    ["信念历史", "AUTONOMY_BELIEF_REFERENCE", (state: MutableUniverseState) => { Object.values(state.autonomy.entities)[0].beliefs[0].id = "autonomy-belief:missing"; }],
    ["意图主体", "AUTONOMY_INTENT_ENTITY", (state: MutableUniverseState) => { Object.values(state.autonomy.entities)[0].lastIntent!.entityId = "autonomy-entity:missing"; }],
    ["意图信念", "AUTONOMY_INTENT_BELIEF", (state: MutableUniverseState) => { state.transitions[1].autonomy.intents[0].beliefIds = ["autonomy-belief:missing"]; }],
    ["意图历史", "AUTONOMY_INTENT_REFERENCE", (state: MutableUniverseState) => { Object.values(state.autonomy.entities)[0].lastIntent!.id = "autonomy-intent:missing"; }],
  ])("恢复时拒绝%s完整性篡改", (_label, code, mutate) => {
    const state = formedState("STEP6-STRUCTURAL-TAMPER-001");
    const forged = structuredClone(state) as MutableUniverseState;
    mutate(forged);
    expect(() => restoreUniverseState(forged)).toThrow(code);
  });

  it("主体停止和关系终止均进入因果网络", () => {
    let state = createInitialUniverseState({ seed: "STEP6-CEASED-CAUSAL-001", constitution: LIVING_TIDE });
    for (let index = 0; index < 4; index += 1) state = advanceUniverseState(state);
    const network = buildRuntimeCausalNetwork(state);
    expect(network.nodes.some((node) => node.kind === "entity" && node.label === "自主性终止")).toBe(true);
    expect(network.nodes.some((node) => node.kind === "relation" && node.label === "自主关系终止")).toBe(true);
  });

  it.each([
    ["形成主体", (state: MutableUniverseState) => { delete state.autonomy.entities[state.transitions[1].autonomy.formedEntityIds[0]]; }, "AUTONOMY_REFERENCE｜formedEntityIds"],
    ["公开叙述", (state: MutableUniverseState) => { delete state.autonomy.narratives[state.transitions[1].autonomy.narrativeIds[0]]; }, "AUTONOMY_REFERENCE｜narrativeIds"],
    ["神话档案", (state: MutableUniverseState) => { delete state.autonomy.mythArchives[state.transitions[1].autonomy.mythArchiveIds[0]]; }, "AUTONOMY_REFERENCE｜mythArchiveIds"],
    ["神话来源", (state: MutableUniverseState) => { const id = state.transitions[1].autonomy.narrativeIds[0]; state.transitions[1].autonomy.narrativeIds = []; delete state.autonomy.narratives[id]; }, "AUTONOMY_REFERENCE｜sourceNarrativeId"],
    ["主体关系", (state: MutableUniverseState) => { delete state.autonomy.relations[state.transitions[1].autonomy.formedRelationIds[0]]; }, "AUTONOMY_REFERENCE｜formedRelationIds"],
  ])("因果构建拒绝缺失的%s记录", (_label, mutate, message) => {
    const forged = structuredClone(formedState("STEP6-CAUSAL-MISSING-001")) as MutableUniverseState;
    mutate(forged);
    expect(() => buildRuntimeCausalNetwork(forged)).toThrow(message);
  });
});

function formedState(seed: string): UniverseState {
  return advanceUniverseState(advanceUniverseState(createInitialUniverseState({ seed, constitution: LIVING_TIDE })));
}

type DeepMutable<T> = T extends readonly (infer Entry)[]
  ? DeepMutable<Entry>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

type MutableRuntimeArchive = DeepMutable<ReturnType<typeof createRuntimeArchive>>;
type MutableUniverseState = DeepMutable<UniverseState>;

function resignArchive(archive: MutableRuntimeArchive): void {
  archive.stateFingerprint = runtimeStateFingerprint(archive.state);
  const { checksum: _checksum, ...payload } = archive;
  archive.checksum = runtimeFingerprint(payload);
}

function nonBiologicalFixture() {
  const ontologySpec = LIVING_TIDE.modules.find((module) => module.category === "ontology")!.spec as OntologyModuleSpec;
  const actionSpec = LIVING_TIDE.modules.find((module) => module.category === "action")!.spec as ActionModuleSpec;
  const constraintSpec = LIVING_TIDE.modules.find((module) => module.category === "constraint")!.spec as ConstraintModuleSpec;
  const topologySpec = LIVING_TIDE.modules.find((module) => module.category === "topology")!.spec as TopologyModuleSpec;
  const cognitionSpec = LIVING_TIDE.modules.find((module) => module.category === "cognition")!.spec as CognitionModuleSpec;
  const interventionSpec = LIVING_TIDE.modules.find((module) => module.category === "intervention")!.spec as InterventionModuleSpec;
  const replacements = new Map([
    ["ontology", createConstitutionModule({ id: "ontology.echo-knot@1", moduleVersion: "1.0.0", category: "ontology", name: "回声本体", description: "非生物回声结点。", dependencies: [], conflicts: [], spec: { objectKinds: ontologySpec.objectKinds.map((kind) => ({ ...kind, id: "echo-knot", name: "回声结点" })) } })],
    ["action", createConstitutionModule({ id: "action.echo-knot@1", moduleVersion: "1.0.0", category: "action", name: "回声作用", description: "复用统一环境与自主规则。", dependencies: [], conflicts: [], spec: { rules: actionSpec.rules.map((rule) => ({ ...rule, targetKind: "echo-knot" })) } })],
    ["constraint", createConstitutionModule({ id: "constraint.echo-knot@1", moduleVersion: "1.0.0", category: "constraint", name: "回声边界", description: "非生物属性边界。", dependencies: [], conflicts: [], spec: { constraints: constraintSpec.constraints.map((constraint) => ({ ...constraint, targetKind: "echo-knot" })) } })],
    ["topology", createConstitutionModule({ id: "topology.echo-knot@1", moduleVersion: "1.0.0", category: "topology", name: "回声关系", description: "回声结点之间的关系。", dependencies: [], conflicts: [], spec: { ...topologySpec, initialRelations: topologySpec.initialRelations.map((relation) => ({ ...relation, sourceKind: "echo-knot", targetKind: "echo-knot" })) } })],
    ["cognition", createConstitutionModule({ id: "cognition.echo-knot@1", moduleVersion: "1.0.0", category: "cognition", name: "回声认知", description: "非生物回声具有有限认知。", dependencies: [], conflicts: [], spec: { ...cognitionSpec, autonomyPolicies: cognitionSpec.autonomyPolicies?.map((policy) => ({ ...policy, name: "觉醒回声", targetKind: "echo-knot" })) } })],
    ["intervention", createConstitutionModule({ id: "intervention.echo-knot@1", moduleVersion: "1.0.0", category: "intervention", name: "回声干预", description: "有限回声能量调整。", dependencies: [], conflicts: [], spec: { capabilities: interventionSpec.capabilities.map((capability) => ({ ...capability, targetKinds: ["echo-knot"] })) } })],
  ]);
  return createUniverseConstitution({ name: "觉醒回声夹具", description: "证明自主实体协议不依赖生命或文明。", modules: LIVING_TIDE.modules.map((module) => replacements.get(module.category) ?? module) });
}
