import { galaxyTypeProfiles, planetTypeProfiles, starSystemTypeProfiles } from "./content/space";
import { findInterfaceStateValueDefinition } from "./state-value-interface-definitions";
import type { Civilization, CivilizationSeed, Galaxy, Planet, StarSystem, UniverseSummary } from "./types";

export type StateValueOperand = {
  label: string;
  value: unknown;
  causeSubjects: string[];
};

export type StateValueDefinition = {
  label: string;
  value: unknown;
  formulaId: string;
  formula: string;
  operands: StateValueOperand[];
  randomScopes: string[];
};

type Operand = StateValueOperand;

export function findStateValueDefinition(universe: UniverseSummary, subjectId: string): StateValueDefinition | undefined {
  const interfaceDefinition = findInterfaceStateValueDefinition(universe, subjectId);
  if (interfaceDefinition) return interfaceDefinition;
  for (const galaxy of universe.galaxies) {
    const galaxyDefinition = galaxyValue(universe, subjectId, galaxy);
    if (galaxyDefinition) return galaxyDefinition;
    for (const system of galaxy.starSystems) {
      const systemDefinition = systemValue(universe, subjectId, galaxy, system);
      if (systemDefinition) return systemDefinition;
      for (const planet of system.planets) {
        const planetDefinition = planetValue(universe, subjectId, galaxy, system, planet);
        if (planetDefinition) return planetDefinition;
      }
    }
  }
  for (const civilization of universe.civilizations) {
    const definition = civilizationValue(universe, subjectId, civilization);
    if (definition) return definition;
  }
  return undefined;
}

function galaxyValue(universe: UniverseSummary, subjectId: string, galaxy: Galaxy): StateValueDefinition | undefined {
  const profile = galaxyTypeProfiles.find((entry) => entry.id === galaxy.type);
  if (subjectId === `${galaxy.id}.type`) return define("星系类型", galaxy.type, "formula:galaxy.type@1",
    "按魔法、神性、因果偏置与生命潜力计算候选权重后进行确定性加权选择。",
    [operand("空间内容配置", galaxy.type, ["initial-state:template-configuration"]), operand("生命潜力", universe.metrics.lifePotential.value, ["metric.lifePotential"]),
      operand("魔法异常偏置", bias(universe, "magicAnomalyDensity"), ["timeline-bias.magicAnomalyDensity"]), operand("神性遗迹偏置", bias(universe, "divineRelicDensity"), ["timeline-bias.divineRelicDensity"]),
      operand("因果风险偏置", bias(universe, "causalHazardLevel"), ["timeline-bias.causalHazardLevel"])], [subjectId]);
  if (subjectId === `${galaxy.id}.causalHazard`) return define("星系因果风险", galaxy.causalHazard, "formula:galaxy.causal-hazard@1",
    "round(clamp((100 - 因果完整度) × 0.42 + 因果风险偏置 × 0.45 + 星系档案风险偏置 + 随机扰动[-8,8]))。",
    [operand("因果完整度", universe.metrics.causalityIntegrity.value, ["metric.causalityIntegrity"]), operand("因果风险偏置", bias(universe, "causalHazardLevel"), ["timeline-bias.causalHazardLevel"]),
      operand("星系档案风险偏置", profile?.hazardBias ?? 0, ["initial-state:template-configuration"])], [subjectId]);
  if (subjectId === `${galaxy.id}.starSystems.count`) return define("恒星系数量", galaxy.starSystems.length, "formula:galaxy.system-count@1",
    "round(clamp(3 + 星系质量 ÷ 24 + 确定性整数扰动[0,2], 3, 8))。",
    [operand("星系质量", galaxy.mass, [galaxy.id])], [subjectId]);
  return undefined;
}

function systemValue(universe: UniverseSummary, subjectId: string, galaxy: Galaxy, system: StarSystem): StateValueDefinition | undefined {
  const profile = starSystemTypeProfiles.find((entry) => entry.id === system.type);
  if (subjectId === `${system.id}.type`) return define("恒星系类型", system.type, "formula:star-system.type@1",
    "按恒星稳定偏置、星系异常环境与魔法强度计算候选权重后进行确定性加权选择。",
    [operand("恒星稳定偏置", bias(universe, "stellarStability"), ["timeline-bias.stellarStability"]), operand("星系魔法通量", galaxy.magicFlux, [galaxy.id]),
      operand("星系因果风险", galaxy.causalHazard, [galaxy.id]), operand("魔法强度", universe.metrics.magicIntensity.value, ["metric.magicIntensity"])], [subjectId]);
  if (subjectId === `${system.id}.luminosity`) return define("恒星光度", system.luminosity, "formula:star-system.luminosity@1",
    "round(clamp(44 + 星系质量 × 0.25 + 恒星系档案光度偏置 + 随机扰动[-12,12]))。",
    [operand("星系质量", galaxy.mass, [galaxy.id]), operand("恒星系档案光度偏置", profile?.luminosityBias ?? 0, ["initial-state:template-configuration"])], [subjectId]);
  if (subjectId === `${system.id}.planets.count`) return define("行星数量", system.planets.length, "formula:star-system.planet-count@1",
    "round(clamp(2 + 恒星系稳定 ÷ 26 + 星系金属丰度 ÷ 35 + 确定性整数扰动[0,2], 2, 6))。",
    [operand("恒星系稳定", system.stability, [system.id]), operand("星系金属丰度", galaxy.metallicity, [galaxy.id])], [subjectId]);
  return undefined;
}

function planetValue(universe: UniverseSummary, subjectId: string, galaxy: Galaxy, system: StarSystem, planet: Planet): StateValueDefinition | undefined {
  const profile = planetTypeProfiles.find((entry) => entry.id === planet.type);
  const profileCause = ["initial-state:template-configuration"];
  if (subjectId === `${planet.id}.type`) return define("行星类型", planet.type, "formula:planet.type@1",
    "按宜居偏置、魔法偏置与恒星光度计算候选权重后进行确定性加权选择。",
    [operand("宜居偏置", bias(universe, "planetHabitability"), ["timeline-bias.planetHabitability"]), operand("魔法异常偏置", bias(universe, "magicAnomalyDensity"), ["timeline-bias.magicAnomalyDensity"]),
      operand("恒星光度", system.luminosity, [system.id])], [subjectId]);
  if (subjectId === `${planet.id}.orbitZone`) return define("轨道区域", planet.orbitZone, "formula:planet.orbit-zone@1",
    "按照同一恒星系中的一基轨道序号判定：1 为内圈，2 至 3 为宜居带，其余为外圈。",
    [operand("轨道序号", planetIndex(system, planet), [system.id])], []);
  if (subjectId === `${planet.id}.habitability`) return define("宜居性", planet.habitability, "formula:planet.habitability@1",
    "round(clamp(生命潜力 × 0.35 + 时间线宜居偏置 × 0.35 + 恒星系稳定 × 0.22 + 行星档案宜居偏置 + 轨道区域偏置 + 随机扰动[-12,12]))。",
    [operand("生命潜力", universe.metrics.lifePotential.value, ["metric.lifePotential"]), operand("时间线宜居偏置", bias(universe, "planetHabitability"), ["timeline-bias.planetHabitability"]),
      operand("恒星系稳定", system.stability, [system.id]), operand("行星档案宜居偏置", profile?.habitabilityBias ?? 0, profileCause), operand("轨道区域偏置", orbitHabitability(planet), [planet.id])], [subjectId]);
  if (subjectId === `${planet.id}.magicSaturation`) return define("魔法饱和", planet.magicSaturation, "formula:planet.magic-saturation@1",
    "round(clamp(星系魔法通量 × 0.4 + 恒星系异常 × 0.28 + 行星档案魔法偏置 + 随机扰动[-10,10]))。",
    [operand("星系魔法通量", galaxy.magicFlux, [galaxy.id]), operand("恒星系异常", system.anomalyLevel, [system.id]), operand("行星档案魔法偏置", profile?.magicBias ?? 0, profileCause)], [subjectId]);
  if (subjectId === `${planet.id}.atmosphere`) return define("大气", planet.atmosphere, "formula:planet.atmosphere@1",
    "round(clamp(42 + 行星档案大气偏置 + 恒星系稳定 × 0.12 + 随机扰动[-18,18]))。",
    [operand("行星档案大气偏置", profile?.atmosphereBias ?? 0, profileCause), operand("恒星系稳定", system.stability, [system.id])], [subjectId]);
  if (subjectId === `${planet.id}.water`) return define("水量", planet.water, "formula:planet.water@1",
    "round(clamp(38 + 行星档案水量偏置 + 生物圈时间线偏置 × 0.18 + 随机扰动[-18,18]))。",
    [operand("行星档案水量偏置", profile?.waterBias ?? 0, profileCause), operand("生物圈时间线偏置", bias(universe, "biosphereChance"), ["timeline-bias.biosphereChance"])], [subjectId]);
  if (subjectId === `${planet.id}.stability`) return define("行星稳定", planet.stability, "formula:planet.stability@1",
    "round(clamp(恒星系稳定 × 0.62 + 行星档案稳定偏置 - 恒星系异常 × 0.18 + 随机扰动[-10,10]))。",
    [operand("恒星系稳定", system.stability, [system.id]), operand("行星档案稳定偏置", profile?.stabilityBias ?? 0, profileCause), operand("恒星系异常", system.anomalyLevel, [system.id])], [subjectId]);
  if (!planet.biosphere) return undefined;
  const biosphere = planet.biosphere;
  const biosphereSubject = `${planet.id}.biosphere`;
  if (subjectId === `${biosphereSubject}.magicAdaptation`) return define("生物圈魔法适应", biosphere.magicAdaptation, "formula:biosphere.magic-adaptation@1",
    "round(clamp(行星魔法饱和 × 0.65 + 魔法强度 × 0.25 + 随机扰动[-8,8]))。",
    [operand("行星魔法饱和", planet.magicSaturation, [planet.id]), operand("魔法强度", universe.metrics.magicIntensity.value, ["metric.magicIntensity"])], [`${planet.id}:magic-adaptation`]);
  if (subjectId === `${biosphereSubject}.civilizationChance`) return define("文明概率", biosphere.civilizationChance, "formula:biosphere.civilization-chance@1",
    "round(clamp(生物圈形成强度 × 0.35 + 文明候选时间线偏置 × 0.45 + 文明潜力 × 0.18 + 随机扰动[-10,10]))。",
    [operand("生物圈形成强度", biosphereFormationValue(universe, planet), [planet.id]), operand("文明候选时间线偏置", bias(universe, "civilizationSeedChance"), ["timeline-bias.civilizationSeedChance"]),
      operand("文明潜力", universe.metrics.civilizationPotential.value, ["metric.civilizationPotential"])], [`${planet.id}:civilization-chance`]);
  if (subjectId === `${biosphereSubject}.level`) return define("生物圈等级", biosphere.level, "formula:biosphere.level@1",
    "依次判断机械行星与文明概率、魔法适应阈值、文明概率阈值、生物圈形成强度阈值。",
    [operand("行星类型", planet.type, [planet.id]), operand("文明概率", biosphere.civilizationChance, [biosphereSubject]), operand("魔法适应", biosphere.magicAdaptation, [biosphereSubject]),
      operand("生物圈形成强度", biosphereFormationValue(universe, planet), [planet.id])], []);
  if (subjectId === `${biosphereSubject}.dominantForm`) return define("生物圈主导形态", biosphere.dominantForm, "formula:biosphere.dominant-form@1",
    "从当前规则版本的生物圈形态候选集中进行确定性选择。", [operand("生物圈形态候选集", "biosphereForms@1", ["initial-state:template-configuration"])], [subjectId]);
  if (subjectId === `${biosphereSubject}.complexity`) return define("生物圈复杂度", biosphere.complexity, "formula:biosphere.complexity@1",
    "round(clamp(生物圈形成强度 + 文明概率 × 0.2 + 随机扰动[-8,8]))。",
    [operand("生物圈形成强度", biosphereFormationValue(universe, planet), [planet.id]), operand("文明概率", biosphere.civilizationChance, [biosphereSubject])], [subjectId]);
  if (!biosphere.civilizationSeed) return undefined;
  return civilizationSeedValue(universe, subjectId, planet, biosphere.civilizationSeed);
}

function civilizationSeedValue(universe: UniverseSummary, subjectId: string, planet: Planet, seed: CivilizationSeed): StateValueDefinition | undefined {
  const owner = `${planet.id}.civilization-seed`;
  const biosphere = planet.biosphere!;
  const numeric: Record<string, [string, number, string, string, Operand[]]> = {
    technologyLevel: ["文明候选科技", seed.technologyLevel, "formula:civilization-seed.technology@1", "文明概率 × 0.48 + 文明潜力 × 0.28 + 行星稳定 × 0.18 + 随机扰动[-8,8]。",
      [operand("文明概率", biosphere.civilizationChance, [`${planet.id}.biosphere`]), operand("文明潜力", universe.metrics.civilizationPotential.value, ["metric.civilizationPotential"]), operand("行星稳定", planet.stability, [planet.id])]],
    magicLevel: ["文明候选魔法", seed.magicLevel, "formula:civilization-seed.magic@1", "魔法适应 × 0.58 + 魔法强度 × 0.28 + 随机扰动[-8,8]。",
      [operand("魔法适应", biosphere.magicAdaptation, [`${planet.id}.biosphere`]), operand("魔法强度", universe.metrics.magicIntensity.value, ["metric.magicIntensity"])]],
    faithIntensity: ["文明候选信仰", seed.faithIntensity, "formula:civilization-seed.faith@1", "神性活跃 × 0.45 + 神性遗迹偏置 × 0.25 + 魔法适应 × 0.18 + 随机扰动[-10,10]。",
      [operand("神性活跃", universe.metrics.divineActivity.value, ["metric.divineActivity"]), operand("神性遗迹偏置", bias(universe, "divineRelicDensity"), ["timeline-bias.divineRelicDensity"]), operand("魔法适应", biosphere.magicAdaptation, [`${planet.id}.biosphere`])]],
    expansionDrive: ["文明候选扩张", seed.expansionDrive, "formula:civilization-seed.expansion@1", "文明概率 × 0.34 + 文明潜力 × 0.3 + 行星宜居性 × 0.2 - 魔法饱和 × 0.06 + 随机扰动[-8,8]。",
      [operand("文明概率", biosphere.civilizationChance, [`${planet.id}.biosphere`]), operand("文明潜力", universe.metrics.civilizationPotential.value, ["metric.civilizationPotential"]), operand("行星宜居性", planet.habitability, [planet.id]), operand("魔法饱和", planet.magicSaturation, [planet.id])]],
    stability: ["文明候选稳定", seed.stability, "formula:civilization-seed.stability@1", "行星稳定 × 0.54 + 因果完整度 × 0.24 + 宇宙稳定 × 0.18 - 因果风险偏置 × 0.18 + 随机扰动[-8,8]。",
      [operand("行星稳定", planet.stability, [planet.id]), operand("因果完整度", universe.metrics.causalityIntegrity.value, ["metric.causalityIntegrity"]), operand("宇宙稳定", universe.metrics.stability.value, ["metric.stability"]), operand("因果风险偏置", bias(universe, "causalHazardLevel"), ["timeline-bias.causalHazardLevel"])]],
  };
  const field = subjectId.slice(owner.length + 1);
  const found = numeric[field];
  if (found) return define(found[0], found[1], found[2], `round(clamp(${found[3]}))`, found[4], [subjectId]);
  if (subjectId === `${owner}.speciesType`) return define("文明候选物种", seed.speciesType, "formula:civilization-seed.species@1", "依据生物圈等级、行星类型与魔法适应阈值分类。",
    [operand("生物圈等级", biosphere.level, [`${planet.id}.biosphere`]), operand("行星类型", planet.type, [planet.id]), operand("魔法适应", biosphere.magicAdaptation, [`${planet.id}.biosphere`])], []);
  if (subjectId === `${owner}.fate`) return define("文明候选命运", seed.fate, "formula:civilization-seed.fate@1", "按稳定、魔法、信仰、扩张和科技阈值顺序分类。",
    [operand("科技", seed.technologyLevel, [owner]), operand("魔法", seed.magicLevel, [owner]), operand("信仰", seed.faithIntensity, [owner]), operand("扩张", seed.expansionDrive, [owner]), operand("稳定", seed.stability, [owner])], []);
  return undefined;
}

function civilizationValue(universe: UniverseSummary, subjectId: string, civilization: Civilization): StateValueDefinition | undefined {
  const seedOwner = `${civilization.originPlanetId}.civilization-seed`;
  const system = findSystem(universe, civilization.originStarSystemId);
  const planet = findPlanet(universe, civilization.originPlanetId);
  const galaxy = findGalaxy(universe, civilization.originGalaxyId);
  const numeric: Record<string, [string, number, string, string, Operand[]]> = {
    technologyLevel: ["文明科技", civilization.technologyLevel, "formula:civilization.technology@1", "候选科技 × 0.62 + 文明潜力 × 0.18 + 恒星系稳定 × 0.12 + 随机扰动[-7,7]。",
      [operand("候选科技", planet.biosphere!.civilizationSeed!.technologyLevel, [seedOwner]), operand("文明潜力", universe.metrics.civilizationPotential.value, ["metric.civilizationPotential"]), operand("恒星系稳定", system.stability, [system.id])]],
    magicLevel: ["文明魔法", civilization.magicLevel, "formula:civilization.magic@1", "候选魔法 × 0.62 + 魔法强度 × 0.18 + 行星魔法饱和 × 0.16 + 随机扰动[-7,7]。",
      [operand("候选魔法", planet.biosphere!.civilizationSeed!.magicLevel, [seedOwner]), operand("魔法强度", universe.metrics.magicIntensity.value, ["metric.magicIntensity"]), operand("行星魔法饱和", planet.magicSaturation, [planet.id])]],
    faithIntensity: ["文明信仰", civilization.faithIntensity, "formula:civilization.faith@1", "候选信仰 × 0.56 + 神性活跃 × 0.22 + 神性遗迹偏置 × 0.16 + 随机扰动[-8,8]。",
      [operand("候选信仰", planet.biosphere!.civilizationSeed!.faithIntensity, [seedOwner]), operand("神性活跃", universe.metrics.divineActivity.value, ["metric.divineActivity"]), operand("神性遗迹偏置", bias(universe, "divineRelicDensity"), ["timeline-bias.divineRelicDensity"])]],
    expansionDrive: ["文明扩张", civilization.expansionDrive, "formula:civilization.expansion@1", "候选扩张 × 0.6 + 文明潜力 × 0.18 + 文明候选偏置 × 0.16 + 随机扰动[-7,7]。",
      [operand("候选扩张", planet.biosphere!.civilizationSeed!.expansionDrive, [seedOwner]), operand("文明潜力", universe.metrics.civilizationPotential.value, ["metric.civilizationPotential"]), operand("文明候选偏置", bias(universe, "civilizationSeedChance"), ["timeline-bias.civilizationSeedChance"])]],
    stability: ["文明稳定", civilization.stability, "formula:civilization.stability@1", "候选稳定 × 0.46 + 宇宙稳定 × 0.24 + 恒星系稳定 × 0.16 + 行星稳定 × 0.16 - 因果风险偏置 × 0.06 + 随机扰动[-8,8]。",
      [operand("候选稳定", planet.biosphere!.civilizationSeed!.stability, [seedOwner]), operand("宇宙稳定", universe.metrics.stability.value, ["metric.stability"]), operand("恒星系稳定", system.stability, [system.id]), operand("行星稳定", planet.stability, [planet.id]), operand("因果风险偏置", bias(universe, "causalHazardLevel"), ["timeline-bias.causalHazardLevel"])]],
    extinctionRisk: ["文明灭绝风险", civilization.extinctionRisk, "formula:civilization.extinction-risk@1", "78 - 文明稳定 × 0.65 + 因果风险偏置 × 0.18 + 星系因果风险 × 0.12 - 因果完整度 × 0.18 + 随机扰动[-8,8]。",
      [operand("文明稳定", civilization.stability, [civilization.id]), operand("因果风险偏置", bias(universe, "causalHazardLevel"), ["timeline-bias.causalHazardLevel"]), operand("星系因果风险", galaxy.causalHazard, [galaxy.id]), operand("因果完整度", universe.metrics.causalityIntegrity.value, ["metric.causalityIntegrity"])]],
  };
  const field = subjectId.slice(civilization.id.length + 1);
  const found = numeric[field];
  if (found) return define(found[0], found[1], found[2], `round(clamp(${found[3]}))`, found[4], [subjectId]);
  if (subjectId === `${civilization.id}.speciesType`) return define("文明物种", civilization.speciesType, "formula:civilization.species@1", "文明物种直接继承产生该文明的候选种子。",
    [operand("候选物种", planet.biosphere!.civilizationSeed!.speciesType, [seedOwner])], []);
  if (subjectId === `${civilization.id}.path`) return define("文明路径", civilization.path, "formula:civilization.path@1", "先按文明数值与意识、神性、魔法法则筛选合格路径，再计算情境权重并进行确定性加权选择。",
    [operand("科技", civilization.technologyLevel, [civilization.id]), operand("魔法", civilization.magicLevel, [civilization.id]), operand("信仰", civilization.faithIntensity, [civilization.id]), operand("扩张", civilization.expansionDrive, [civilization.id]), operand("稳定", civilization.stability, [civilization.id]), operand("灭绝风险", civilization.extinctionRisk, [civilization.id]),
      operand("意识法则", universe.laws.consciousness.rating.value, ["consciousness"]), operand("神性法则", universe.laws.divinity.rating.value, ["divinity"]), operand("魔法法则", universe.laws.magic.rating.value, ["magic"])], [subjectId]);
  if (subjectId === `${civilization.id}.fate`) return define("文明命运", civilization.fate, "formula:civilization.fate@1", "依据文明路径、文明数值与候选命运按照当前文明配方分类。",
    [operand("文明路径", civilization.path, [civilization.id]), operand("候选命运", planet.biosphere!.civilizationSeed!.fate, [seedOwner]), operand("文明数值", numericFingerprint(civilization), [civilization.id])], []);
  const mythology = civilization.mythology;
  const mythologySubject = `${civilization.id}.mythology`;
  if (subjectId === `${mythologySubject}.type`) return define("神话类型", mythology.type, "formula:mythology.type@1", "按文明信仰、魔法、科技、神性活跃与起源环境计算候选权重后进行确定性加权选择。",
    [operand("文明信仰", civilization.faithIntensity, [civilization.id]), operand("文明魔法", civilization.magicLevel, [civilization.id]), operand("文明科技", civilization.technologyLevel, [civilization.id]), operand("神性活跃", universe.metrics.divineActivity.value, ["metric.divineActivity"]), operand("起源环境", `${galaxy.id}/${system.id}/${planet.id}/${civilization.path}`, [galaxy.id, system.id, planet.id, civilization.id])], [subjectId]);
  if (subjectId === `${mythologySubject}.deityName`) return define("神名", mythology.deityName, "formula:mythology.deity-name@1", "无神类型固定为无主神，其余类型从神名候选集中确定性选择名称并附加神话类型标签。",
    [operand("神话类型", mythology.type, [mythologySubject]), operand("神名候选集", "deityNameCores@1", ["initial-state:template-configuration"])], mythology.type === "none" ? [] : [subjectId]);
  if (subjectId === `${mythologySubject}.influenceLevel`) return define("神话影响", mythology.influenceLevel, "formula:mythology.influence@1", "文明信仰 × 0.48 + 神性活跃 × 0.26 + 文明魔法 × 0.14 + 神话档案神性偏置 + 随机扰动[-6,6]。",
    [operand("文明信仰", civilization.faithIntensity, [civilization.id]), operand("神性活跃", universe.metrics.divineActivity.value, ["metric.divineActivity"]), operand("文明魔法", civilization.magicLevel, [civilization.id]), operand("神话类型", mythology.type, [mythologySubject])], [subjectId]);
  if (subjectId === `${mythologySubject}.origin`) return define("神话起源", mythology.origin, "formula:mythology.origin@1", "依据神话类型与起源行星、恒星系环境选择固定语义分支。",
    [operand("神话类型", mythology.type, [mythologySubject]), operand("起源行星", planet.name, [planet.id]), operand("起源恒星系", system.name, [system.id])], []);
  if (subjectId === `${mythologySubject}.relationToCivilization`) return define("神话文明关系", mythology.relationToCivilization, "formula:mythology.relation@1", "依据神话类型、文明路径与信仰强度按固定优先级选择关系语义。",
    [operand("神话类型", mythology.type, [mythologySubject]), operand("文明路径", civilization.path, [civilization.id]), operand("信仰强度", civilization.faithIntensity, [civilization.id])], []);
  return undefined;
}

function define(label: string, value: unknown, formulaId: string, formula: string, operands: Operand[], randomScopes: string[]): StateValueDefinition {
  return { label, value, formulaId, formula, operands, randomScopes };
}

function operand(label: string, value: unknown, causeSubjects: string[]): Operand {
  return { label, value, causeSubjects };
}

function bias(universe: UniverseSummary, id: string): number {
  return universe.timelineImpact.localBiases.find((entry) => entry.id === id)?.value ?? 50;
}

function planetIndex(system: StarSystem, planet: Planet): number {
  return system.planets.findIndex((entry) => entry.id === planet.id) + 1;
}

function orbitHabitability(planet: Planet): number {
  return planet.orbitZone === "habitable" ? 12 : planet.orbitZone === "inner" ? -8 : -10;
}

function biosphereFormationValue(universe: UniverseSummary, planet: Planet): number {
  const decision = requireScopedDecision(universe, `${planet.id}:biosphere-formation`)[0].decision;
  return Math.round(Math.max(0, Math.min(100, planet.habitability * 0.46 + bias(universe, "biosphereChance") * 0.32
    + universe.metrics.lifePotential.value * 0.2 + planet.magicSaturation * 0.08 - Math.max(0, 35 - planet.stability) * 0.35
    + Number(decision.selectedValue))));
}

function findGalaxy(universe: UniverseSummary, id: string): Galaxy {
  const value = universe.galaxies.find((entry) => entry.id === id);
  if (!value) throw new Error(`找不到星系 ${id}。`);
  return value;
}

function findSystem(universe: UniverseSummary, id: string): StarSystem {
  const value = universe.galaxies.flatMap((entry) => entry.starSystems).find((entry) => entry.id === id);
  if (!value) throw new Error(`找不到恒星系 ${id}。`);
  return value;
}

function findPlanet(universe: UniverseSummary, id: string): Planet {
  const value = universe.galaxies.flatMap((entry) => entry.starSystems).flatMap((entry) => entry.planets).find((entry) => entry.id === id);
  if (!value) throw new Error(`找不到行星 ${id}。`);
  return value;
}

function numericFingerprint(civilization: Civilization): string {
  return [civilization.technologyLevel, civilization.magicLevel, civilization.faithIntensity, civilization.expansionDrive, civilization.stability, civilization.extinctionRisk].join("/");
}


function requireScopedDecision(universe: UniverseSummary, scopeId: string) {
  const matches = universe.causalGraph.randomTrace.streams.flatMap((stream) =>
    stream.decisions.filter((decision) => decision.scopeId === scopeId).map((decision) => ({ stream, decision })),
  );
  if (matches.length !== 1) throw new Error(`状态值随机作用域“${scopeId}”必须对应一个精确决定，当前为 ${matches.length} 个。`);
  return matches;
}
