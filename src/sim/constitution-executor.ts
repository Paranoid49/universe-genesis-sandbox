import type {
  ActionModuleSpec,
  BoundaryModuleSpec,
  ConstitutionDifference,
  ConstitutionValue,
  ConstitutionWorldObject,
  ConstraintModuleSpec,
  DeclarativeRule,
  NumericOperator,
  RuleConditionRecord,
  RuleConstraintRecord,
  RuleCostRecord,
  RuleExecutionRecord,
  RuleExecutionResult,
  RuleRandomSource,
  UniverseConstitution,
} from "./contracts/constitution";
import { assertUniverseConstitution, constitutionModule } from "./constitution-validation";
import { runtimeFingerprint } from "./runtime-integrity";

export function executeConstitutionStep(
  constitution: UniverseConstitution,
  objects: Readonly<Record<string, ConstitutionWorldObject>>,
  random: RuleRandomSource,
  tick: number,
  adjustments: Readonly<Record<string, Readonly<Record<string, number>>>> = {},
  autonomousRuleIdsByObject: Readonly<Record<string, readonly string[]>> = {},
): RuleExecutionResult {
  assertUniverseConstitution(constitution);
  const actions = constitutionModule<ActionModuleSpec>(constitution, "action").spec;
  const constraints = constitutionModule<ConstraintModuleSpec>(constitution, "constraint").spec;
  const boundary = constitutionModule<BoundaryModuleSpec>(constitution, "boundary").spec;
  const objectValues = Object.values(objects);
  const evaluationCount = actions.rules.reduce((sum, rule) => sum + objectValues.filter((object) => object.kind === rule.targetKind && ruleEnabled(rule, object.id, autonomousRuleIdsByObject)).length, 0);
  if (evaluationCount > boundary.maximumRuleEvaluations) throw new Error("RULE_BUDGET｜rules｜单步规则评估超过宪法预算。");
  const maximumDifferenceCount = actions.rules.reduce((sum, rule) => sum + objectValues.filter((object) => object.kind === rule.targetKind && ruleEnabled(rule, object.id, autonomousRuleIdsByObject)).length * (rule.effects.length + (rule.cost ? 1 : 0)), 0)
    + Object.values(adjustments).reduce((sum, fields) => sum + Object.keys(fields).length, 0);
  if (maximumDifferenceCount > boundary.maximumEffectsPerStep) throw new Error("EFFECT_BUDGET｜effects｜单步效果数量超过宪法预算。");
  const mutable = new Map(Object.entries(objects).map(([id, object]) => [id, cloneObject(object)]));
  const differences: ConstitutionDifference[] = [];
  const records: RuleExecutionRecord[] = [];
  const randomDecisionIds: string[] = [];
  const claimedFields = new Map<string, { priority: number; ruleId: string }>();
  let autonomousActionCount = 0;
  const orderedRules = [...actions.rules].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  for (const rule of orderedRules) {
    const targets = [...mutable.values()].filter((object) => object.kind === rule.targetKind && ruleEnabled(rule, object.id, autonomousRuleIdsByObject)).sort((left, right) => left.id.localeCompare(right.id));
    for (const object of targets) {
      if (rule.trigger === "autonomous" && autonomousActionCount >= (boundary.maximumAutonomousActionsPerStep ?? 0)) {
        records.push(record(rule, object.id, "arbitration-rejected", [], [], undefined, rule.effects.map((entry) => entry.field), [], "自主行动预算已用尽。"));
        continue;
      }
      if (rule.trigger === "autonomous") autonomousActionCount += 1;
      const keyFields = rule.effects.map((effect) => object.id + ":" + effect.field);
      const conflict = keyFields.map((key) => claimedFields.get(key)).find(Boolean);
      if (conflict) {
        records.push(record(rule, object.id, "arbitration-rejected", [], [], undefined, [], [], "由 " + conflict.ruleId + " 以优先级 " + conflict.priority + " 获得写入权。"));
        continue;
      }
      const conditionRecords = evaluateConditions(rule, object);
      if (conditionRecords.some((entry) => !entry.satisfied)) {
        records.push(record(rule, object.id, "condition-rejected", conditionRecords, [], undefined, [], [], "条件未满足。"));
        continue;
      }
      const costRecord = evaluateCost(rule, object);
      if (costRecord && !costRecord.satisfied) {
        records.push(record(rule, object.id, "cost-rejected", conditionRecords, [], costRecord, [], [], "代价不足，未提交效果。"));
        continue;
      }
      const proposal = { ...object.attributes };
      if (costRecord) proposal[costRecord.field] = costRecord.after;
      random.checkpoint();
      const localDecisionIds: string[] = [];
      const effectDecision = new Map<string, string>();
      for (const effect of rule.effects) {
        const before = numeric(proposal[effect.field], rule.id + "." + effect.field);
        let randomValue = 0;
        if (effect.randomMinimum !== undefined && effect.randomMaximum !== undefined) {
          const decision = random.int(effect.randomMinimum, effect.randomMaximum);
          randomValue = decision.value;
          localDecisionIds.push(decision.id);
          effectDecision.set(effect.field, decision.id);
        }
        proposal[effect.field] = effect.operation === "set" ? effect.value + randomValue : before + effect.value + randomValue;
      }
      const constraintRecords = evaluateConstraints(constraints, rule, object, proposal);
      if (constraintRecords.some((entry) => !entry.satisfied)) {
        random.rollback();
        records.push(record(rule, object.id, "constraint-rejected", conditionRecords, constraintRecords, costRecord, rule.effects.map((entry) => entry.field), [], "约束拒绝，代价、效果与随机游标均未提交。"));
        continue;
      }
      const beforeAttributes = object.attributes;
      const nextObject = Object.freeze({
        ...object,
        revision: object.revision + 1,
        updatedAtTick: tick + 1,
        attributes: Object.freeze(proposal),
      });
      mutable.set(object.id, nextObject);
      for (const [field, after] of Object.entries(proposal)) {
        const before = beforeAttributes[field];
        if (before !== after) differences.push(Object.freeze({
          objectId: object.id,
          field: "attributes." + field,
          before,
          after,
          ruleId: rule.id,
          ...(effectDecision.has(field) ? { randomDecisionId: effectDecision.get(field) } : {}),
        }));
      }
      keyFields.forEach((key) => claimedFields.set(key, { priority: rule.priority, ruleId: rule.id }));
      randomDecisionIds.push(...localDecisionIds);
      records.push(record(rule, object.id, "applied", conditionRecords, constraintRecords, costRecord, rule.effects.map((entry) => entry.field), localDecisionIds, "按优先级与规则 ID 稳定提交。"));
      if (differences.length > boundary.maximumEffectsPerStep) throw new Error("EFFECT_BUDGET｜effects｜单步效果数量超过宪法预算。");
    }
  }
  applyAdjustments(mutable, adjustments, constraints, differences, tick);
  if (differences.length > boundary.maximumEffectsPerStep) throw new Error("EFFECT_BUDGET｜effects｜单步效果数量超过宪法预算。");
  return Object.freeze({
    objects: Object.freeze(Object.fromEntries([...mutable.entries()].map(([id, object]) => [id, Object.freeze(object)]))),
    differences: Object.freeze(differences),
    records: Object.freeze(records),
    randomDecisionIds: Object.freeze(randomDecisionIds),
  });
}

function ruleEnabled(rule: DeclarativeRule, objectId: string, autonomousRuleIdsByObject: Readonly<Record<string, readonly string[]>>): boolean {
  return rule.trigger !== "autonomous" || (autonomousRuleIdsByObject[objectId] ?? []).includes(rule.id);
}

function evaluateConditions(rule: DeclarativeRule, object: ConstitutionWorldObject): RuleConditionRecord[] {
  return rule.conditions.map((condition) => {
    const actual = numeric(object.attributes[condition.field], rule.id + "." + condition.field);
    return Object.freeze({ ...condition, expected: condition.value, actual, satisfied: compare(condition.operator, actual, condition.value) });
  });
}

function evaluateCost(rule: DeclarativeRule, object: ConstitutionWorldObject): RuleCostRecord | undefined {
  if (!rule.cost) return undefined;
  const before = numeric(object.attributes[rule.cost.field], rule.id + "." + rule.cost.field);
  return Object.freeze({ field: rule.cost.field, amount: rule.cost.amount, before, after: before - rule.cost.amount, satisfied: before >= rule.cost.amount });
}

function evaluateConstraints(spec: ConstraintModuleSpec, rule: DeclarativeRule, object: ConstitutionWorldObject, proposal: Readonly<Record<string, ConstitutionValue>>): RuleConstraintRecord[] {
  return spec.constraints.filter((entry) => entry.targetKind === object.kind && (rule.effects.some((effect) => effect.field === entry.field) || rule.cost?.field === entry.field)).map((constraint) => {
    const before = numeric(object.attributes[constraint.field], constraint.id);
    const proposed = numeric(proposal[constraint.field], constraint.id);
    const satisfied = (constraint.minimum === undefined || proposed >= constraint.minimum) && (constraint.maximum === undefined || proposed <= constraint.maximum);
    return Object.freeze({ constraintId: constraint.id, field: constraint.field, before, proposed, after: proposed, satisfied });
  });
}

function applyAdjustments(
  objects: Map<string, ConstitutionWorldObject>,
  adjustments: Readonly<Record<string, Readonly<Record<string, number>>>>,
  constraints: ConstraintModuleSpec,
  differences: ConstitutionDifference[],
  tick: number,
): void {
  for (const [objectId, fields] of Object.entries(adjustments)) {
    const object = objects.get(objectId);
    if (!object) throw new Error("INPUT_TARGET｜objectId｜实验或干预目标不存在。");
    const attributes = { ...object.attributes };
    for (const [field, delta] of Object.entries(fields)) {
      if (!Number.isFinite(delta) || delta === 0) throw new Error("INPUT_VALUE｜delta｜实验或干预变化必须是非零有限数值。");
      const constraint = constraints.constraints.find((entry) => entry.targetKind === object.kind && entry.field === field);
      if (!constraint) throw new Error("INPUT_FIELD｜field｜实验或干预字段不受宪法支持。");
      const before = numeric(attributes[field], objectId + "." + field);
      const after = before + delta;
      if ((constraint.minimum !== undefined && after < constraint.minimum) || (constraint.maximum !== undefined && after > constraint.maximum)) throw new Error("INPUT_CONSTRAINT｜delta｜实验或干预结果违反宪法约束。");
      attributes[field] = after;
      differences.push(Object.freeze({ objectId, field: "attributes." + field, before, after, ruleId: "constitution.input-adjustment@1" }));
    }
    objects.set(objectId, Object.freeze({ ...object, revision: object.revision + 1, updatedAtTick: tick + 1, attributes: Object.freeze(attributes) }));
  }
}

function record(
  rule: DeclarativeRule,
  objectId: string,
  status: RuleExecutionRecord["status"],
  conditionRecords: readonly RuleConditionRecord[],
  constraintRecords: readonly RuleConstraintRecord[],
  costRecord: RuleCostRecord | undefined,
  effectFields: readonly string[],
  randomDecisionIds: readonly string[],
  arbitration: string,
): RuleExecutionRecord {
  const payload = { ruleId: rule.id, objectId, priority: rule.priority, status, conditionRecords, constraintRecords, ...(costRecord ? { costRecord } : {}), effectFields, randomDecisionIds, inputIds: Object.freeze([]), arbitration };
  return Object.freeze({ ...payload, id: "rule-execution:" + runtimeFingerprint(payload) });
}

function compare(operator: NumericOperator, actual: number, expected: number): boolean {
  if (operator === "lt") return actual < expected;
  if (operator === "lte") return actual <= expected;
  if (operator === "eq") return actual === expected;
  if (operator === "gte") return actual >= expected;
  return actual > expected;
}

function numeric(value: ConstitutionValue | undefined, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("RULE_FIELD｜" + field + "｜规则字段不是有限数值。");
  return value;
}

function cloneObject(object: ConstitutionWorldObject): ConstitutionWorldObject {
  return { ...object, attributes: { ...object.attributes } };
}
