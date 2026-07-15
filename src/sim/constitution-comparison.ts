import type { ConstitutionModuleCategory, UniverseConstitution } from "./contracts/constitution";

export type ConstitutionModuleDifference = {
  category: ConstitutionModuleCategory;
  leftModuleId: string;
  rightModuleId: string;
  leftModuleName: string;
  rightModuleName: string;
  changed: boolean;
};

export type ConstitutionComparison = {
  leftConstitutionId: string;
  rightConstitutionId: string;
  hasCommonHistory: false;
  differences: readonly ConstitutionModuleDifference[];
};

export function compareUniverseConstitutions(left: UniverseConstitution, right: UniverseConstitution): ConstitutionComparison {
  const rightByCategory = new Map(right.modules.map((module) => [module.category, module]));
  const differences = left.modules.map((module) => {
    const counterpart = rightByCategory.get(module.category);
    if (!counterpart) throw new Error("跨宇宙比较缺少对应宪法模块。");
    return Object.freeze({
      category: module.category,
      leftModuleId: module.id,
      rightModuleId: counterpart.id,
      leftModuleName: module.name,
      rightModuleName: counterpart.name,
      changed: module.contentFingerprint !== counterpart.contentFingerprint,
    });
  });
  return Object.freeze({
    leftConstitutionId: left.constitutionId,
    rightConstitutionId: right.constitutionId,
    hasCommonHistory: false,
    differences: Object.freeze(differences),
  });
}
