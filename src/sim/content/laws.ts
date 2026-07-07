import type { LawDomainId, StructuredLaw } from "../types";

export const lawDomainNames: Record<LawDomainId, string> = {
  physics: "物理法则",
  magic: "魔法法则",
  life: "生命法则",
  consciousness: "意识法则",
  divinity: "神性法则",
  causality: "因果与时间法则",
};

export const lawSources: Record<LawDomainId, string[]> = {
  physics: ["真空涨落", "初始奇点", "黑洞蒸发残响", "暗物质潮汐", "第一束背景辐射"],
  magic: ["恒星死亡释放的灵质", "古老真名的回声", "维度膜间的渗漏", "生命梦境的沉积", "因果裂缝中的余焰"],
  life: ["重元素尘埃", "温和恒星风", "灵魂孢子", "深海热泉网络", "自复制矿物晶格"],
  consciousness: ["神经复杂度跃迁", "梦境底层海", "信息自指循环", "灵魂回声", "集体记忆沉积"],
  divinity: ["文明信仰反馈", "宇宙秩序自我人格化", "恒星意志", "机械计算神格", "死亡与梦境边界"],
  causality: ["时间箭头张力", "命运闭环", "观测者回声", "预言残留", "创世时的第一道选择"],
};

export const lawTraits: Record<LawDomainId, string[]> = {
  physics: ["恒星形成规律清晰", "重元素分布不均", "空间曲率存在局部褶皱", "真空衰变风险可测", "引力常数有微弱纪元漂移"],
  magic: ["施法需要代价", "魔力随恒星死亡增强", "灵质会污染物理常数", "命名能短暂改变实体边界", "仪式比天赋更可靠"],
  life: ["宜居窗口狭窄", "复杂生命依赖灾变筛选", "非碳基生命偶尔出现", "生命会改造局部魔法环境", "灭绝压力推动快速适应"],
  consciousness: ["梦境可影响现实", "灵魂可被记录", "记忆具备法则权重", "集体意识能形成实体", "自我认知会改变命运概率"],
  divinity: ["信仰能反向塑造神格", "神明受到法则约束", "奇迹存在冷却代价", "神战会污染纪元", "神性更偏向象征而非全能"],
  causality: ["预言并不总可靠", "局部时间可回流", "因果裂缝会吞噬解释", "命运存在弹性", "重大选择会形成历史锁点"],
};

export const lawCosts: Record<LawDomainId, string[]> = {
  physics: ["稳定来自低奇迹密度", "高能事件会放大结构缺陷", "过度稳定会压低异常可能"],
  magic: ["每次改写现实都会留下熵债", "魔法越强，因果越容易松动", "施法会消耗记忆、寿命或星光"],
  life: ["生命繁荣会提高灾变可见度", "复杂性越高，灭绝链越长", "意识出现后生态不再完全中立"],
  consciousness: ["梦境渗透会削弱客观历史", "灵魂保存需要付出记忆代价", "集体意识容易压制个体命运"],
  divinity: ["神性越活跃，凡世越难保持自主", "信仰失衡会引发神格饥荒", "奇迹会向未来转嫁风险"],
  causality: ["稳定因果会限制奇迹", "裂缝越多，复现难度越高", "时间回流会累积未偿还事件"],
};

export const lawRuleCatalog: Record<LawDomainId, Array<Omit<StructuredLaw, "id" | "domain" | "value" | "label" | "explanation">>> = {
  physics: [
    { name: "恒星形成效率", effectTargets: ["stability", "lifePotential"], polarity: "support" },
    { name: "重元素生成率", effectTargets: ["lifePotential", "civilizationPotential"], polarity: "support" },
    { name: "真空衰变压力", effectTargets: ["stability", "causalityIntegrity"], polarity: "pressure" },
    { name: "空间曲率弹性", effectTargets: ["age", "stability", "causalityIntegrity"], polarity: "volatile" },
  ],
  magic: [
    { name: "灵质通量", effectTargets: ["magicIntensity", "lifePotential"], polarity: "support" },
    { name: "施法代价", effectTargets: ["magicIntensity", "civilizationPotential"], polarity: "pressure" },
    { name: "魔法污染", effectTargets: ["stability", "causalityIntegrity"], polarity: "pressure" },
    { name: "命名术效率", effectTargets: ["magicIntensity", "civilizationPotential"], polarity: "volatile" },
  ],
  life: [
    { name: "宜居窗口宽度", effectTargets: ["lifePotential", "civilizationPotential"], polarity: "support" },
    { name: "复杂生命门槛", effectTargets: ["lifePotential", "civilizationPotential"], polarity: "pressure" },
    { name: "灭绝恢复力", effectTargets: ["lifePotential", "stability"], polarity: "support" },
    { name: "非碳基适应性", effectTargets: ["lifePotential", "magicIntensity"], polarity: "volatile" },
  ],
  consciousness: [
    { name: "意识独立性", effectTargets: ["civilizationPotential", "divineActivity"], polarity: "support" },
    { name: "灵魂可记录性", effectTargets: ["civilizationPotential", "causalityIntegrity"], polarity: "volatile" },
    { name: "梦境现实渗透", effectTargets: ["magicIntensity", "causalityIntegrity"], polarity: "volatile" },
    { name: "集体意识凝聚", effectTargets: ["civilizationPotential", "divineActivity"], polarity: "support" },
  ],
  divinity: [
    { name: "信仰反馈强度", effectTargets: ["divineActivity", "civilizationPotential"], polarity: "support" },
    { name: "奇迹冷却代价", effectTargets: ["divineActivity", "causalityIntegrity"], polarity: "pressure" },
    { name: "神战风险", effectTargets: ["stability", "divineActivity"], polarity: "pressure" },
    { name: "神格自洽度", effectTargets: ["divineActivity", "stability"], polarity: "support" },
  ],
  causality: [
    { name: "因果稳定度", effectTargets: ["causalityIntegrity", "stability"], polarity: "support" },
    { name: "时间线弹性", effectTargets: ["age", "causalityIntegrity", "civilizationPotential"], polarity: "support" },
    { name: "预言可靠性", effectTargets: ["civilizationPotential", "divineActivity"], polarity: "volatile" },
    { name: "裂缝扩散率", effectTargets: ["causalityIntegrity", "stability"], polarity: "pressure" },
  ],
};
