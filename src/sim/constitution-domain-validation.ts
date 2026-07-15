import type {
  ActionModuleSpec,
  BoundaryModuleSpec,
  CognitionModuleSpec,
  ConstitutionModule,
  ConstitutionModuleCategory,
  ConstitutionValidationIssue,
  ConstraintModuleSpec,
  InterventionModuleSpec,
  ObservableModuleSpec,
  OntologyModuleSpec,
  TopologyModuleSpec,
} from "./contracts/constitution";
import { validateConstitutionAutonomy } from "./constitution-autonomy-validation";

export function validateConstitutionDomainReferences(modules: readonly ConstitutionModule[], issues: ConstitutionValidationIssue[]): void {
  const ontology = moduleSpec<OntologyModuleSpec>(modules, "ontology");
  const actions = moduleSpec<ActionModuleSpec>(modules, "action");
  const constraints = moduleSpec<ConstraintModuleSpec>(modules, "constraint");
  const observables = moduleSpec<ObservableModuleSpec>(modules, "observable");
  const interventions = moduleSpec<InterventionModuleSpec>(modules, "intervention");
  const topology = moduleSpec<TopologyModuleSpec>(modules, "topology");
  const cognition = moduleSpec<CognitionModuleSpec>(modules, "cognition");
  const boundary = moduleSpec<BoundaryModuleSpec>(modules, "boundary");
  if (!ontology || !actions || !constraints || !observables || !interventions || !topology || !cognition || !boundary) return;
  const kinds = new Map(ontology.objectKinds.map((kind) => [kind.id, new Set(kind.attributes.map((attribute) => attribute.id))]));
  if (kinds.size !== ontology.objectKinds.length) issue(issues, "ONTOLOGY_KIND", "ontology.objectKinds", "对象类型 ID 为空或重复。");
  for (const [kindIndex, kind] of ontology.objectKinds.entries()) {
    if (kind.initialCount !== undefined && (!Number.isSafeInteger(kind.initialCount) || kind.initialCount <= 0)) issue(issues, "ONTOLOGY_COUNT", `ontology.objectKinds[${kindIndex}].initialCount`, "对象初始数量必须是正安全整数。");
    const attributeIds = new Set<string>();
    for (const [attributeIndex, attribute] of kind.attributes.entries()) {
      const path = `ontology.objectKinds[${kindIndex}].attributes[${attributeIndex}]`;
      if (!attribute.id || attributeIds.has(attribute.id) || !finiteValue(attribute.initial)) issue(issues, "ONTOLOGY_ATTRIBUTE", path, "对象属性定义无效。");
      attributeIds.add(attribute.id);
      if (attribute.minimum !== undefined && (!Number.isFinite(attribute.minimum) || typeof attribute.initial !== "number")) issue(issues, "ONTOLOGY_RANGE", path + ".minimum", "数值下界无效。");
      if (attribute.maximum !== undefined && (!Number.isFinite(attribute.maximum) || typeof attribute.initial !== "number")) issue(issues, "ONTOLOGY_RANGE", path + ".maximum", "数值上界无效。");
      if (attribute.minimum !== undefined && attribute.maximum !== undefined && attribute.minimum > attribute.maximum) issue(issues, "ONTOLOGY_RANGE", path, "属性上下界顺序无效。");
    }
  }
  const ruleIds = new Set(actions.rules.map((rule) => rule.id));
  if (ruleIds.size !== actions.rules.length || actions.rules.some((rule) => !rule.id)) issue(issues, "RULE_ID", "action.rules", "规则 ID 为空或重复。");
  for (const [index, axiomId] of cognition.publicAxiomIds.entries()) if (!ruleIds.has(axiomId)) issue(issues, "COGNITION_AXIOM", `cognition.publicAxiomIds[${index}]`, "公开公理引用不存在。");
  const allFields = new Set([...kinds.values()].flatMap((fields) => [...fields]));
  for (const [index, field] of cognition.hiddenAttributeIds.entries()) if (!allFields.has(field)) issue(issues, "COGNITION_FIELD", `cognition.hiddenAttributeIds[${index}]`, "隐藏字段引用不存在。");
  validateTopology(topology, kinds, issues);
  for (const [index, rule] of actions.rules.entries()) {
    if (!kinds.has(rule.targetKind)) issue(issues, "RULE_TARGET", `action.rules[${index}].targetKind`, "规则目标类型不存在。");
    for (const condition of rule.conditions) validateField(kinds, rule.targetKind, condition.field, issues, "RULE_FIELD", `action.rules[${index}].conditions`);
    for (const effect of rule.effects) {
      validateField(kinds, rule.targetKind, effect.field, issues, "RULE_FIELD", `action.rules[${index}].effects`);
      if (![effect.value, effect.randomMinimum, effect.randomMaximum].filter((value) => value !== undefined).every(Number.isFinite)) issue(issues, "RULE_VALUE", `action.rules[${index}].effects`, "规则效果包含非有限数值。");
      if ((effect.randomMinimum === undefined) !== (effect.randomMaximum === undefined) || (effect.randomMinimum !== undefined && effect.randomMinimum > effect.randomMaximum!)) issue(issues, "RULE_RANDOM_RANGE", `action.rules[${index}].effects`, "规则随机范围无效。");
    }
    if (rule.cost) validateField(kinds, rule.targetKind, rule.cost.field, issues, "RULE_COST", `action.rules[${index}].cost`);
    if (rule.trigger !== undefined && rule.trigger !== "environment" && rule.trigger !== "autonomous") issue(issues, "RULE_TRIGGER", `action.rules[${index}].trigger`, "规则触发类型无效。");
  }
  validateConstitutionAutonomy(cognition, actions, kinds, boundary, issues);
  for (const [index, constraint] of constraints.constraints.entries()) validateField(kinds, constraint.targetKind, constraint.field, issues, "CONSTRAINT_FIELD", `constraint.constraints[${index}]`);
  validateObservables(observables, cognition, allFields, issues);
  validateInterventions(interventions, kinds, issues);
  for (const [field, value] of Object.entries(boundary)) {
    if (field !== "observationsAffectState" && (!Number.isSafeInteger(value) || (value as number) <= 0)) issue(issues, "BOUNDARY_BUDGET", "boundary." + field, "边界预算必须是正安全整数。");
  }
  const initialObjectCount = ontology.objectKinds.reduce((sum, kind) => sum + (kind.initialCount ?? 1), 0);
  if (Number.isSafeInteger(boundary.maximumObjects) && initialObjectCount > boundary.maximumObjects) issue(issues, "BOUNDARY_OBJECTS", "boundary.maximumObjects", "初始对象数量超过宪法预算。");
  if (Number.isSafeInteger(boundary.maximumRelations) && topology.initialRelations.length > boundary.maximumRelations) issue(issues, "BOUNDARY_RELATIONS", "boundary.maximumRelations", "初始关系数量超过宪法预算。");
  const initialEvaluations = actions.rules.reduce((sum, rule) => sum + (ontology.objectKinds.find((kind) => kind.id === rule.targetKind)?.initialCount ?? 1), 0);
  if (Number.isSafeInteger(boundary.maximumRuleEvaluations) && initialEvaluations > boundary.maximumRuleEvaluations) issue(issues, "BOUNDARY_RULES", "boundary.maximumRuleEvaluations", "初始规则评估数量超过宪法预算。");
  const initialEffects = actions.rules.reduce((sum, rule) => sum + (ontology.objectKinds.find((kind) => kind.id === rule.targetKind)?.initialCount ?? 1) * (rule.effects.length + (rule.cost ? 1 : 0)), 0);
  if (Number.isSafeInteger(boundary.maximumEffectsPerStep) && initialEffects > boundary.maximumEffectsPerStep) issue(issues, "BOUNDARY_EFFECTS", "boundary.maximumEffectsPerStep", "初始规则效果数量超过宪法预算。");
}

function validateTopology(topology: TopologyModuleSpec, kinds: ReadonlyMap<string, ReadonlySet<string>>, issues: ConstitutionValidationIssue[]): void {
  const ids = new Set<string>();
  for (const [index, relation] of topology.initialRelations.entries()) {
    const path = `topology.initialRelations[${index}]`;
    if (!relation.id || ids.has(relation.id)) issue(issues, "TOPOLOGY_RELATION_ID", path + ".id", "拓扑关系 ID 为空或重复。");
    ids.add(relation.id);
    if (!topology.relationNames.includes(relation.name)) issue(issues, "TOPOLOGY_RELATION_NAME", path + ".name", "拓扑关系名称未在关系目录中声明。");
    if (relation.sourceKind !== "*" && !kinds.has(relation.sourceKind)) issue(issues, "TOPOLOGY_SOURCE", path + ".sourceKind", "拓扑关系来源类型不存在。");
    if (relation.targetKind !== "*" && !kinds.has(relation.targetKind)) issue(issues, "TOPOLOGY_TARGET", path + ".targetKind", "拓扑关系目标类型不存在。");
  }
}

function validateObservables(observables: ObservableModuleSpec, cognition: CognitionModuleSpec, fields: ReadonlySet<string>, issues: ConstitutionValidationIssue[]): void {
  for (const [index, method] of observables.methods.entries()) {
    if (method.field && !fields.has(method.field)) issue(issues, "OBSERVABLE_FIELD", `observable.methods[${index}].field`, "观察字段不存在。");
    if (method.field && cognition.hiddenAttributeIds.includes(method.field)) issue(issues, "COGNITION_OBSERVABLE_CONFLICT", `observable.methods[${index}].field`, "观察方式不得读取认知模块隐藏字段。");
  }
  const ids = new Set<string>();
  for (const [index, metric] of observables.metrics.entries()) {
    const path = `observable.metrics[${index}]`;
    if (!metric.id || ids.has(metric.id)) issue(issues, "METRIC_ID", path + ".id", "指标 ID 为空或重复。");
    ids.add(metric.id);
    if (!fields.has(metric.field)) issue(issues, "METRIC_FIELD", path + ".field", "指标字段不存在。");
    if (metric.visibility === "observable" && !observables.methods.some((method) => method.field === metric.field)) issue(issues, "METRIC_OBSERVATION", path + ".field", "可观察指标缺少对应观察方式。");
  }
}

function validateInterventions(interventions: InterventionModuleSpec, kinds: ReadonlyMap<string, ReadonlySet<string>>, issues: ConstitutionValidationIssue[]): void {
  const ids = new Set<string>();
  for (const [index, capability] of interventions.capabilities.entries()) {
    const path = `intervention.capabilities[${index}]`;
    if (!capability.id || ids.has(capability.id)) issue(issues, "INTERVENTION_ID", path + ".id", "干预能力 ID 为空或重复。");
    ids.add(capability.id);
    for (const kind of capability.targetKinds) validateField(kinds, kind, capability.field, issues, "INTERVENTION_FIELD", path);
    if (!Number.isFinite(capability.minimumDelta) || !Number.isFinite(capability.maximumDelta) || capability.minimumDelta > capability.maximumDelta) issue(issues, "INTERVENTION_RANGE", path, "干预范围无效。");
    if ((capability.costField === undefined) !== (capability.costAmount === undefined) || (capability.costAmount !== undefined && (!Number.isFinite(capability.costAmount) || capability.costAmount <= 0))) issue(issues, "INTERVENTION_COST", path + ".costAmount", "干预代价定义无效。");
    if (capability.costField) for (const kind of capability.targetKinds) validateField(kinds, kind, capability.costField, issues, "INTERVENTION_COST_FIELD", path + ".costField");
  }
}

function moduleSpec<T>(modules: readonly ConstitutionModule[], category: ConstitutionModuleCategory): T | undefined {
  return modules.find((entry) => entry.category === category)?.spec as T | undefined;
}

function validateField(kinds: ReadonlyMap<string, ReadonlySet<string>>, kind: string, field: string, issues: ConstitutionValidationIssue[], code: string, fieldPath: string): void {
  if (!kinds.get(kind)?.has(field)) issue(issues, code, fieldPath, `字段 ${kind}.${field} 不存在。`);
}

function finiteValue(value: unknown): boolean {
  return typeof value !== "number" || Number.isFinite(value);
}

function issue(issues: ConstitutionValidationIssue[], code: string, fieldPath: string, message: string): void {
  issues.push({ code, fieldPath, message });
}
