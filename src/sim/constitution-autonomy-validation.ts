import type { ActionModuleSpec, BoundaryModuleSpec, CognitionModuleSpec, ConstitutionValidationIssue } from "./contracts/constitution";

export function validateConstitutionAutonomy(
  cognition: CognitionModuleSpec,
  actions: ActionModuleSpec,
  kinds: ReadonlyMap<string, ReadonlySet<string>>,
  boundary: BoundaryModuleSpec,
  issues: ConstitutionValidationIssue[],
): void {
  const policies = cognition.autonomyPolicies ?? [];
  if (policies.length === 0) return;
  const policyIds = new Set<string>();
  const actionRules = new Map(actions.rules.map((rule) => [rule.id, rule]));
  for (const [policyIndex, policy] of policies.entries()) {
    const path = `cognition.autonomyPolicies[${policyIndex}]`;
    if (!policy.id || policyIds.has(policy.id)) issue(issues, "AUTONOMY_POLICY_ID", path + ".id");
    policyIds.add(policy.id);
    if (!kinds.has(policy.targetKind)) issue(issues, "AUTONOMY_TARGET", path + ".targetKind");
    validateField(kinds, policy.targetKind, policy.activation.field, issues, "AUTONOMY_FIELD", path + ".activation.field");
    if (!Number.isFinite(policy.activation.value)) issue(issues, "AUTONOMY_VALUE", path + ".activation.value");
    if (policy.deactivation) {
      validateField(kinds, policy.targetKind, policy.deactivation.field, issues, "AUTONOMY_FIELD", path + ".deactivation.field");
      if (!Number.isFinite(policy.deactivation.value)) issue(issues, "AUTONOMY_VALUE", path + ".deactivation.value");
    }
    if (!Number.isSafeInteger(policy.memoryCapacity) || policy.memoryCapacity <= 0) issue(issues, "AUTONOMY_MEMORY", path + ".memoryCapacity");
    const perceptionFields = new Set<string>();
    for (const [perceptionIndex, perception] of policy.perceptions.entries()) {
      validateField(kinds, policy.targetKind, perception.field, issues, "AUTONOMY_PERCEPTION_FIELD", `${path}.perceptions[${perceptionIndex}].field`);
      if (perceptionFields.has(perception.field)) issue(issues, "AUTONOMY_PERCEPTION_DUPLICATE", `${path}.perceptions[${perceptionIndex}].field`);
      perceptionFields.add(perception.field);
      if (perception.bias !== undefined && !Number.isFinite(perception.bias)) issue(issues, "AUTONOMY_PERCEPTION_BIAS", `${path}.perceptions[${perceptionIndex}].bias`);
      if (!perception.uncertainty.trim()) issue(issues, "AUTONOMY_PERCEPTION_UNCERTAINTY", `${path}.perceptions[${perceptionIndex}].uncertainty`);
    }
    const actionIds = new Set<string>();
    for (const [actionIndex, action] of policy.actions.entries()) {
      const actionPath = `${path}.actions[${actionIndex}]`;
      if (!action.id || actionIds.has(action.id)) issue(issues, "AUTONOMY_ACTION_ID", actionPath + ".id");
      actionIds.add(action.id);
      const rule = actionRules.get(action.ruleId);
      if (!rule || rule.trigger !== "autonomous" || rule.targetKind !== policy.targetKind) issue(issues, "AUTONOMY_ACTION_RULE", actionPath + ".ruleId");
      if (!perceptionFields.has(action.beliefField)) issue(issues, "AUTONOMY_ACTION_BELIEF", actionPath + ".beliefField");
      if (!Number.isFinite(action.value) || !Number.isFinite(action.priority)) issue(issues, "AUTONOMY_ACTION_VALUE", actionPath);
    }
    if (policy.narrative && !perceptionFields.has(policy.narrative.beliefField)) issue(issues, "AUTONOMY_NARRATIVE_BELIEF", path + ".narrative.beliefField");
  }
  const requiredBudgets = [boundary.maximumAutonomousEntities, boundary.maximumMemoriesPerEntity, boundary.maximumAutonomousActionsPerStep];
  if (requiredBudgets.some((value) => !Number.isSafeInteger(value) || (value as number) <= 0)) issue(issues, "AUTONOMY_BUDGET", "boundary");
  if (boundary.maximumMemoriesPerEntity !== undefined && policies.some((policy) => policy.memoryCapacity > boundary.maximumMemoriesPerEntity!)) issue(issues, "AUTONOMY_MEMORY_BUDGET", "boundary.maximumMemoriesPerEntity");
}

function validateField(kinds: ReadonlyMap<string, ReadonlySet<string>>, kind: string, field: string, issues: ConstitutionValidationIssue[], code: string, fieldPath: string): void {
  if (!kinds.get(kind)?.has(field)) issue(issues, code, fieldPath);
}

function issue(issues: ConstitutionValidationIssue[], code: string, fieldPath: string): void {
  issues.push({ code, fieldPath, message: "自主策略配置无效。" });
}
