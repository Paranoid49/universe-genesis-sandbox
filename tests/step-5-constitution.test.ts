import { describe, expect, it } from "vitest";
import {
  ARCANE_WEAVE,
  COMPOSED_REFERENCE_CONSTITUTION,
  DREAM_FLUX,
  MATERIAL_EXPANSE,
  REFERENCE_CONSTITUTIONS,
  compareUniverseConstitutions,
  createConstitutionModule,
  createUniverseConstitution,
  executeConstitutionStep,
  validateUniverseConstitution,
  type ConstitutionModule,
  type ConstitutionWorldObject,
  type ActionModuleSpec,
  type ConstraintModuleSpec,
  type InterventionModuleSpec,
  type ObservableModuleSpec,
  type OntologyModuleSpec,
  type RuleRandomSource,
} from "../src/sim";

describe("步骤 5 宇宙宪法与统一规则执行", () => {
  it("三个参考预设和跨预设组合具有完整稳定身份", () => {
    expect(REFERENCE_CONSTITUTIONS.map((entry) => entry.presetId)).toEqual(["material-expanse@1", "arcane-weave@1", "dream-flux@1"]);
    for (const constitution of [...REFERENCE_CONSTITUTIONS, COMPOSED_REFERENCE_CONSTITUTION]) {
      expect(constitution.modules).toHaveLength(11);
      expect(new Set(constitution.modules.map((entry) => entry.category)).size).toBe(11);
      expect(validateUniverseConstitution(constitution)).toEqual([]);
      expect(Object.isFrozen(constitution)).toBe(true);
      expect(Object.isFrozen(constitution.modules)).toBe(true);
    }
    expect(COMPOSED_REFERENCE_CONSTITUTION.modules.find((entry) => entry.category === "time")?.id).toBe("time.linear@1");
    expect(COMPOSED_REFERENCE_CONSTITUTION.modules.find((entry) => entry.category === "topology")?.id).toBe("topology.semantic-dream@1");
  });

  it("跨宇宙比较只比较动态宪法并明确不存在共同历史", () => {
    const comparison = compareUniverseConstitutions(MATERIAL_EXPANSE, DREAM_FLUX);
    expect(comparison.hasCommonHistory).toBe(false);
    expect(comparison.leftConstitutionId).toBe(MATERIAL_EXPANSE.constitutionId);
    expect(comparison.rightConstitutionId).toBe(DREAM_FLUX.constitutionId);
    expect(comparison.differences).toHaveLength(11);
    expect(comparison.differences.find((entry) => entry.category === "ontology")).toMatchObject({ changed: true, leftModuleId: "ontology.material-expanse@1", rightModuleId: "ontology.dream-flux@1" });
    expect(compareUniverseConstitutions(MATERIAL_EXPANSE, MATERIAL_EXPANSE).differences.every((entry) => !entry.changed)).toBe(true);
    expect(() => compareUniverseConstitutions(MATERIAL_EXPANSE, { ...DREAM_FLUX, modules: DREAM_FLUX.modules.slice(1) })).toThrow("缺少对应宪法模块");
  });

  it("模块内容、模块索引和宪法身份篡改都会被拒绝", () => {
    const module = MATERIAL_EXPANSE.modules[0];
    const forgedModule = { ...module, name: "伪造名称" };
    expect(validateUniverseConstitution({ ...MATERIAL_EXPANSE, modules: [forgedModule, ...MATERIAL_EXPANSE.modules.slice(1)] }).map((entry) => entry.code)).toContain("MODULE_FINGERPRINT");
    expect(validateUniverseConstitution({ ...MATERIAL_EXPANSE, moduleIds: [...MATERIAL_EXPANSE.moduleIds].reverse() }).map((entry) => entry.code)).toContain("MODULE_INDEX");
    expect(validateUniverseConstitution({ ...MATERIAL_EXPANSE, constitutionId: "constitution:forged" }).map((entry) => entry.code)).toContain("CONSTITUTION_IDENTITY");
  });

  it("缺失类别、缺失依赖、冲突模块、循环依赖和无效字段会拒绝创建", () => {
    expect(() => createUniverseConstitution({ name: "缺失类别", description: "无", modules: MATERIAL_EXPANSE.modules.slice(1) })).toThrow("MODULE_CATEGORY");
    const dependency = replaceModule(MATERIAL_EXPANSE.modules, "time", { dependencies: ["module:missing"] });
    expect(() => createUniverseConstitution({ name: "缺失依赖", description: "无", modules: dependency })).toThrow("MODULE_DEPENDENCY");
    const conflict = replaceModule(MATERIAL_EXPANSE.modules, "time", { conflicts: [MATERIAL_EXPANSE.modules[0].id] });
    expect(() => createUniverseConstitution({ name: "冲突模块", description: "无", modules: conflict })).toThrow("MODULE_CONFLICT");
    const firstId = MATERIAL_EXPANSE.modules[0].id;
    const secondId = MATERIAL_EXPANSE.modules[1].id;
    const cycleFirst = replaceModule(MATERIAL_EXPANSE.modules, "ontology", { dependencies: [secondId] });
    const cycle = replaceModule(cycleFirst, "action", { dependencies: [firstId] });
    expect(() => createUniverseConstitution({ name: "循环依赖", description: "无", modules: cycle })).toThrow("MODULE_DEPENDENCY_CYCLE");
    const invalidObservable = createConstitutionModule({
      id: "observable.invalid@1",
      moduleVersion: "1.0.0",
      category: "observable",
      name: "无效观察",
      description: "引用不存在字段。",
      dependencies: [],
      conflicts: [],
      spec: { methods: [{ id: "invalid", name: "无效", description: "无效", scale: "object", kind: "range", field: "missing" }], metrics: [] },
    });
    expect(() => createUniverseConstitution({ name: "无效字段", description: "无", modules: MATERIAL_EXPANSE.modules.map((entry) => entry.category === "observable" ? invalidObservable : entry) })).toThrow("OBSERVABLE_FIELD");
  });

  it("宪法元数据协议、名称和模块身份异常会返回稳定问题码", () => {
    const duplicate = { ...MATERIAL_EXPANSE.modules[1], id: MATERIAL_EXPANSE.modules[0].id };
    const invalid = {
      ...MATERIAL_EXPANSE,
      version: "unknown" as typeof MATERIAL_EXPANSE.version,
      executorVersion: "unknown" as typeof MATERIAL_EXPANSE.executorVersion,
      name: "   ",
      modules: [{ ...MATERIAL_EXPANSE.modules[0], version: "unknown" as typeof MATERIAL_EXPANSE.modules[0]["version"] }, duplicate, ...MATERIAL_EXPANSE.modules.slice(2)],
    };
    const codes = validateUniverseConstitution(invalid).map((entry) => entry.code);
    expect(codes).toEqual(expect.arrayContaining(["CONSTITUTION_VERSION", "EXECUTOR_VERSION", "CONSTITUTION_NAME", "MODULE_VERSION", "MODULE_ID", "MODULE_FINGERPRINT", "CONSTITUTION_IDENTITY"]));
  });

  it("本体、规则、约束、指标和干预的全部非法引用均被结构化拒绝", () => {
    const ontology: OntologyModuleSpec = {
      objectKinds: [
        { id: "fixture-kind", name: "夹具对象", initialStatus: "active", attributes: [
          { id: "energy", name: "能量", initial: Number.NaN, minimum: 10, maximum: 5 },
          { id: "energy", name: "重复能量", initial: "invalid", minimum: 0 },
        ] },
        { id: "fixture-kind", name: "重复对象", initialStatus: "active", attributes: [] },
      ],
    };
    const action: ActionModuleSpec = { rules: [{
      id: "rule.invalid@1", name: "无效规则", targetKind: "missing-kind", priority: 1,
      conditions: [{ field: "missing-condition", operator: "gte", value: 0 }],
      effects: [{ field: "missing-effect", operation: "add", value: Number.NaN, randomMinimum: 5 }],
      cost: { field: "missing-cost", amount: 1 },
    }] };
    const constraint: ConstraintModuleSpec = { constraints: [{ id: "constraint.invalid@1", targetKind: "missing-kind", field: "missing-field" }] };
    const observable: ObservableModuleSpec = {
      methods: [{ id: "invalid-method", name: "无效观察", description: "引用缺失字段", scale: "object", kind: "range", field: "missing-field" }],
      metrics: [
        { id: "metric-duplicate", name: "缺失指标", field: "missing-metric", visibility: "observable" },
        { id: "metric-duplicate", name: "重复指标", field: "energy", visibility: "observable" },
      ],
    };
    const intervention: InterventionModuleSpec = { capabilities: [
      { id: "duplicate", name: "无效范围", targetKinds: ["missing-kind"], field: "missing-field", minimumDelta: 2, maximumDelta: 1, costField: "missing-cost", costAmount: -1 },
      { id: "duplicate", name: "缺失代价字段", targetKinds: ["fixture-kind"], field: "energy", minimumDelta: 0, maximumDelta: 1, costAmount: 1 },
    ] };
    const modules = replaceSpecs(MATERIAL_EXPANSE.modules, { ontology, action, constraint, observable, intervention });
    const codes = validateUniverseConstitution({ ...MATERIAL_EXPANSE, modules, moduleIds: modules.map((entry) => entry.id) }).map((entry) => entry.code);
    expect(codes).toEqual(expect.arrayContaining([
      "ONTOLOGY_KIND", "ONTOLOGY_ATTRIBUTE", "ONTOLOGY_RANGE", "RULE_TARGET", "RULE_FIELD", "RULE_VALUE", "RULE_RANDOM_RANGE", "RULE_COST",
      "CONSTRAINT_FIELD", "OBSERVABLE_FIELD", "METRIC_ID", "METRIC_FIELD", "METRIC_OBSERVATION", "INTERVENTION_ID", "INTERVENTION_FIELD",
      "INTERVENTION_RANGE", "INTERVENTION_COST", "INTERVENTION_COST_FIELD",
    ]));
  });

  it("认知、拓扑和边界模块会拒绝越权引用与无效预算", () => {
    const hiddenCognition = createConstitutionModule({ id: "cognition.hidden@1", moduleVersion: "1.0.0", category: "cognition", name: "隐藏凝聚", description: "凝聚字段不可观察。", dependencies: [], conflicts: [], spec: { publicAxiomIds: ["rule.material-condensation@1"], hiddenAttributeIds: ["cohesion"] } });
    expect(() => createUniverseConstitution({ name: "隐藏冲突", description: "无", modules: MATERIAL_EXPANSE.modules.map((entry) => entry.category === "cognition" ? hiddenCognition : entry) })).toThrow("COGNITION_OBSERVABLE_CONFLICT");
    const missingAxiom = createConstitutionModule({ id: "cognition.missing@1", moduleVersion: "1.0.0", category: "cognition", name: "缺失公理", description: "引用不存在规则。", dependencies: [], conflicts: [], spec: { publicAxiomIds: ["rule.missing@1"], hiddenAttributeIds: [] } });
    expect(() => createUniverseConstitution({ name: "缺失公理", description: "无", modules: MATERIAL_EXPANSE.modules.map((entry) => entry.category === "cognition" ? missingAxiom : entry) })).toThrow("COGNITION_AXIOM");
    const invalidTopology = createConstitutionModule({ id: "topology.invalid@1", moduleVersion: "1.0.0", category: "topology", name: "无效拓扑", description: "来源类型不存在。", dependencies: [], conflicts: [], spec: { mode: "relational", relationNames: ["连接"], initialRelations: [{ id: "relation.invalid", name: "连接", sourceKind: "missing-kind", targetKind: "*", directed: true }] } });
    expect(() => createUniverseConstitution({ name: "无效拓扑", description: "无", modules: MATERIAL_EXPANSE.modules.map((entry) => entry.category === "topology" ? invalidTopology : entry) })).toThrow("TOPOLOGY_SOURCE");
    const invalidBoundary = createConstitutionModule({ id: "boundary.invalid@1", moduleVersion: "1.0.0", category: "boundary", name: "无效预算", description: "预算必须有界。", dependencies: [], conflicts: [], spec: { observationsAffectState: false, maximumRuleEvaluations: Number.POSITIVE_INFINITY, maximumEffectsPerStep: 0, maximumObjects: 1, maximumRelations: 0 } });
    expect(() => createUniverseConstitution({ name: "无效预算", description: "无", modules: MATERIAL_EXPANSE.modules.map((entry) => entry.category === "boundary" ? invalidBoundary : entry) })).toThrow(/BOUNDARY_BUDGET|BOUNDARY_OBJECTS/);
  });

  it("三个参考预设通过同一执行器产生不同但可复现的状态差异", () => {
    const results = [MATERIAL_EXPANSE, ARCANE_WEAVE, DREAM_FLUX].map((constitution) => {
      const first = executeConstitutionStep(constitution, initialObjects(constitution), deterministicRandom(), 0);
      const second = executeConstitutionStep(constitution, initialObjects(constitution), deterministicRandom(), 0);
      expect(second).toEqual(first);
      expect(first.records.some((entry) => entry.status === "applied")).toBe(true);
      expect(first.differences.length).toBeGreaterThan(0);
      return first.differences.map((entry) => entry.field);
    });
    expect(new Set(results.map((entry) => entry.join("|"))).size).toBe(3);
  });

  it("优先级与规则 ID 稳定裁决同字段冲突", () => {
    const action = createConstitutionModule({
      id: "action.conflict-fixture@1",
      moduleVersion: "1.0.0",
      category: "action",
      name: "冲突夹具",
      description: "两个规则写入同一字段。",
      dependencies: [],
      conflicts: [],
      spec: {
        rules: [
          { id: "rule.z-low@1", name: "低优先级", targetKind: "matter-region", priority: 10, conditions: [], effects: [{ field: "cohesion", operation: "add", value: 20 }] },
          { id: "rule.a-high@1", name: "高优先级", targetKind: "matter-region", priority: 20, conditions: [], effects: [{ field: "cohesion", operation: "add", value: 5 }] },
        ],
      },
    });
    const cognition = createConstitutionModule({ id: "cognition.conflict-fixture@1", moduleVersion: "1.0.0", category: "cognition", name: "夹具认知", description: "公开夹具规则。", dependencies: [], conflicts: [], spec: { publicAxiomIds: ["rule.a-high@1", "rule.z-low@1"], hiddenAttributeIds: [] } });
    const constitution = createUniverseConstitution({ name: "裁决夹具", description: "无", modules: MATERIAL_EXPANSE.modules.map((entry) => entry.category === "action" ? action : entry.category === "cognition" ? cognition : entry) });
    const result = executeConstitutionStep(constitution, initialObjects(constitution), deterministicRandom(), 0);
    expect(result.records.map((entry) => [entry.ruleId, entry.status])).toEqual([
      ["rule.a-high@1", "applied"],
      ["rule.z-low@1", "arbitration-rejected"],
    ]);
    expect(Object.values(result.objects)[0].attributes.cohesion).toBe(33);
  });

  it("代价不足与约束失败不会留下部分修改", () => {
    const arcaneObjects = initialObjects(ARCANE_WEAVE);
    const arcaneId = Object.keys(arcaneObjects)[0];
    const noMana = { ...arcaneObjects, [arcaneId]: { ...arcaneObjects[arcaneId], attributes: { ...arcaneObjects[arcaneId].attributes, mana: 0 } } };
    const costRejected = executeConstitutionStep(ARCANE_WEAVE, noMana, deterministicRandom(), 0);
    expect(costRejected.records[0].status).toBe("cost-rejected");
    expect(costRejected.objects).toEqual(noMana);
    expect(costRejected.differences).toEqual([]);

    const materialObjects = initialObjects(MATERIAL_EXPANSE);
    const materialId = Object.keys(materialObjects)[0];
    const bounded = { ...materialObjects, [materialId]: { ...materialObjects[materialId], attributes: { ...materialObjects[materialId].attributes, cohesion: 100 } } };
    const constraintRejected = executeConstitutionStep(MATERIAL_EXPANSE, bounded, deterministicRandom(), 0);
    expect(constraintRejected.records[0].status).toBe("constraint-rejected");
    expect(constraintRejected.objects[materialId].attributes.cohesion).toBe(100);
    expect(constraintRejected.objects[materialId].attributes.energy).toBe(70);
  });

  it("界外调整遵守字段与约束并保持输入原子性", () => {
    const objects = initialObjects(DREAM_FLUX);
    const objectId = Object.keys(objects)[0];
    const adjusted = executeConstitutionStep(DREAM_FLUX, objects, deterministicRandom(), 0, { [objectId]: { coherence: 5 } });
    expect(adjusted.differences.some((entry) => entry.ruleId === "constitution.input-adjustment@1")).toBe(true);
    expect(() => executeConstitutionStep(DREAM_FLUX, objects, deterministicRandom(), 0, { [objectId]: { missing: 5 } })).toThrow("INPUT_FIELD");
    expect(() => executeConstitutionStep(DREAM_FLUX, objects, deterministicRandom(), 0, { [objectId]: { coherence: 500 } })).toThrow("INPUT_CONSTRAINT");
    expect(objects[objectId].attributes.coherence).toBe(50);
  });
});

function replaceModule(modules: readonly ConstitutionModule[], category: ConstitutionModule["category"], changes: Partial<Pick<ConstitutionModule, "dependencies" | "conflicts">>): ConstitutionModule[] {
  return modules.map((entry) => entry.category === category ? createConstitutionModule({
    id: entry.id,
    moduleVersion: entry.moduleVersion,
    category: entry.category,
    name: entry.name,
    description: entry.description,
    dependencies: changes.dependencies ?? entry.dependencies,
    conflicts: changes.conflicts ?? entry.conflicts,
    spec: entry.spec,
  }) : entry);
}

function replaceSpecs(modules: readonly ConstitutionModule[], specs: Partial<Record<ConstitutionModule["category"], ConstitutionModule["spec"]>>): ConstitutionModule[] {
  return modules.map((entry) => specs[entry.category] ? createConstitutionModule({
    id: entry.id,
    moduleVersion: entry.moduleVersion,
    category: entry.category,
    name: entry.name,
    description: entry.description,
    dependencies: entry.dependencies,
    conflicts: entry.conflicts,
    spec: specs[entry.category]!,
  }) : entry);
}

function initialObjects(constitution: typeof MATERIAL_EXPANSE): Readonly<Record<string, ConstitutionWorldObject>> {
  const ontology = constitution.modules.find((entry) => entry.category === "ontology");
  const kind = (ontology?.spec as OntologyModuleSpec).objectKinds[0];
  const object: ConstitutionWorldObject = Object.freeze({
    id: "object:primary",
    kind: kind.id,
    status: kind.initialStatus,
    revision: 0,
    createdAtTick: 0,
    updatedAtTick: 0,
    attributes: Object.freeze(Object.fromEntries(kind.attributes.map((entry) => [entry.id, entry.initial]))),
  });
  return Object.freeze({ [object.id]: object });
}

function deterministicRandom(): RuleRandomSource {
  let index = 0;
  let checkpoint = 0;
  return {
    int(minimum, maximum) {
      index += 1;
      const value = minimum + ((index * 7) % (maximum - minimum + 1));
      return { id: "decision:" + index + ":" + minimum + ":" + maximum, value };
    },
    checkpoint() { checkpoint = index; },
    rollback() { index = checkpoint; },
  };
}
