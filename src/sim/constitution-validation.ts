import {
  CONSTITUTION_MODULE_VERSION,
  CONSTITUTION_PROTOCOL_VERSION,
  RULE_EXECUTOR_VERSION,
  type ConstitutionModule,
  type ConstitutionModuleCategory,
  type ConstitutionValidationIssue,
  type UniverseConstitution,
} from "./contracts/constitution";
import { validateConstitutionDomainReferences } from "./constitution-domain-validation";
import { runtimeFingerprint } from "./runtime-integrity";

export const REQUIRED_CONSTITUTION_CATEGORIES: readonly ConstitutionModuleCategory[] = Object.freeze([
  "ontology", "action", "constraint", "priority", "time", "topology", "cognition", "observable", "event", "intervention", "boundary",
]);

export function createConstitutionModule(input: Omit<ConstitutionModule, "version" | "contentFingerprint">): ConstitutionModule {
  const payload = {
    version: CONSTITUTION_MODULE_VERSION,
    ...input,
    dependencies: [...input.dependencies].sort(),
    conflicts: [...input.conflicts].sort(),
    spec: structuredClone(input.spec),
  } satisfies Omit<ConstitutionModule, "contentFingerprint">;
  return deepFreeze({ ...payload, contentFingerprint: runtimeFingerprint(payload) });
}

export function createUniverseConstitution(input: { name: string; description: string; modules: readonly ConstitutionModule[]; presetId?: string }): UniverseConstitution {
  const modules = [...input.modules].sort((left, right) => REQUIRED_CONSTITUTION_CATEGORIES.indexOf(left.category) - REQUIRED_CONSTITUTION_CATEGORIES.indexOf(right.category));
  const payload = {
    version: CONSTITUTION_PROTOCOL_VERSION,
    executorVersion: RULE_EXECUTOR_VERSION,
    name: input.name,
    description: input.description,
    ...(input.presetId ? { presetId: input.presetId } : {}),
    modules,
    moduleIds: modules.map((entry) => entry.id),
  } satisfies Omit<UniverseConstitution, "constitutionId" | "contentFingerprint">;
  const contentFingerprint = runtimeFingerprint(payload);
  const constitution = deepFreeze({ ...payload, constitutionId: "constitution:" + contentFingerprint, contentFingerprint });
  assertUniverseConstitution(constitution);
  return constitution;
}

export function validateUniverseConstitution(constitution: UniverseConstitution): readonly ConstitutionValidationIssue[] {
  const issues: ConstitutionValidationIssue[] = [];
  if (constitution.version !== CONSTITUTION_PROTOCOL_VERSION) addIssue(issues, "CONSTITUTION_VERSION", "version", "宇宙宪法版本不受支持。");
  if (constitution.executorVersion !== RULE_EXECUTOR_VERSION) addIssue(issues, "EXECUTOR_VERSION", "executorVersion", "规则执行器版本不受支持。");
  if (!constitution.name.trim()) addIssue(issues, "CONSTITUTION_NAME", "name", "宇宙宪法名称不能为空。");
  const ids = new Set<string>();
  for (const [index, module] of constitution.modules.entries()) {
    const path = "modules[" + index + "]";
    if (module.version !== CONSTITUTION_MODULE_VERSION) addIssue(issues, "MODULE_VERSION", path + ".version", "宪法模块协议版本不受支持。");
    if (!module.id || ids.has(module.id)) addIssue(issues, "MODULE_ID", path + ".id", "宪法模块 ID 为空或重复。");
    ids.add(module.id);
    const { contentFingerprint: _contentFingerprint, ...payload } = module;
    if (runtimeFingerprint(payload) !== module.contentFingerprint) addIssue(issues, "MODULE_FINGERPRINT", path + ".contentFingerprint", "宪法模块内容指纹不匹配。");
  }
  for (const category of REQUIRED_CONSTITUTION_CATEGORIES) {
    const count = constitution.modules.filter((entry) => entry.category === category).length;
    if (count !== 1) addIssue(issues, "MODULE_CATEGORY", "modules", "宪法必须且只能包含一个 " + category + " 模块。");
  }
  validateDependencies(constitution.modules, ids, issues);
  validateConstitutionDomainReferences(constitution.modules, issues);
  const expectedModuleIds = constitution.modules.map((entry) => entry.id);
  if (JSON.stringify(expectedModuleIds) !== JSON.stringify(constitution.moduleIds)) addIssue(issues, "MODULE_INDEX", "moduleIds", "宪法模块索引与模块顺序不一致。");
  const { constitutionId: _constitutionId, contentFingerprint: _fingerprint, ...payload } = constitution;
  const fingerprint = runtimeFingerprint(payload);
  if (fingerprint !== constitution.contentFingerprint || constitution.constitutionId !== "constitution:" + fingerprint) addIssue(issues, "CONSTITUTION_IDENTITY", "constitutionId", "宇宙宪法身份或内容指纹不匹配。");
  return Object.freeze(issues.map((entry) => Object.freeze(entry)));
}

export function assertUniverseConstitution(constitution: UniverseConstitution): UniverseConstitution {
  const issues = validateUniverseConstitution(constitution);
  if (issues.length > 0) throw new Error(issues.map((entry) => entry.code + "｜" + entry.fieldPath + "｜" + entry.message).join("；"));
  return constitution;
}

export function constitutionModule<T extends ConstitutionModule["spec"]>(constitution: UniverseConstitution, category: ConstitutionModuleCategory): ConstitutionModule & { spec: T } {
  const module = constitution.modules.find((entry) => entry.category === category);
  if (!module) throw new Error("宇宙宪法缺少 " + category + " 模块。");
  return module as ConstitutionModule & { spec: T };
}

function validateDependencies(modules: readonly ConstitutionModule[], ids: ReadonlySet<string>, issues: ConstitutionValidationIssue[]): void {
  const dependencies = new Map(modules.map((entry) => [entry.id, entry.dependencies]));
  for (const [index, module] of modules.entries()) {
    for (const dependency of module.dependencies) if (!ids.has(dependency)) addIssue(issues, "MODULE_DEPENDENCY", "modules[" + index + "].dependencies", "模块依赖不存在：" + dependency + "。");
    for (const conflict of module.conflicts) if (ids.has(conflict)) addIssue(issues, "MODULE_CONFLICT", "modules[" + index + "].conflicts", "冲突模块不能共存：" + conflict + "。");
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if ((dependencies.get(id) ?? []).some((dependency) => ids.has(dependency) && visit(dependency))) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  if (modules.some((entry) => visit(entry.id))) addIssue(issues, "MODULE_DEPENDENCY_CYCLE", "modules", "宪法模块依赖存在循环。");
}

function addIssue(issues: ConstitutionValidationIssue[], code: string, fieldPath: string, message: string): void {
  issues.push({ code, fieldPath, message });
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}
