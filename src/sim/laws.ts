import { clamp, round, type RandomStream } from "./random";
import type { LawDomain, LawDomainId, UniverseLaws } from "./types";
import type { UniverseTemplate } from "./templates";

const domainNames: Record<LawDomainId, string> = {
  physics: "物理法则",
  magic: "魔法法则",
  life: "生命法则",
  consciousness: "意识法则",
  divinity: "神性法则",
  causality: "因果与时间法则",
};

const sources: Record<LawDomainId, string[]> = {
  physics: ["真空涨落", "初始奇点", "黑洞蒸发残响", "暗物质潮汐", "第一束背景辐射"],
  magic: ["恒星死亡释放的灵质", "古老真名的回声", "维度膜间的渗漏", "生命梦境的沉积", "因果裂缝中的余焰"],
  life: ["重元素尘埃", "温和恒星风", "灵魂孢子", "深海热泉网络", "自复制矿物晶格"],
  consciousness: ["神经复杂度跃迁", "梦境底层海", "信息自指循环", "灵魂回声", "集体记忆沉积"],
  divinity: ["文明信仰反馈", "宇宙秩序自我人格化", "恒星意志", "机械计算神格", "死亡与梦境边界"],
  causality: ["时间箭头张力", "命运闭环", "观测者回声", "预言残留", "创世时的第一道选择"],
};

const traits: Record<LawDomainId, string[]> = {
  physics: ["恒星形成规律清晰", "重元素分布不均", "空间曲率存在局部褶皱", "真空衰变风险可测", "引力常数有微弱纪元漂移"],
  magic: ["施法需要代价", "魔力随恒星死亡增强", "灵质会污染物理常数", "命名能短暂改变实体边界", "仪式比天赋更可靠"],
  life: ["宜居窗口狭窄", "复杂生命依赖灾变筛选", "非碳基生命偶尔出现", "生命会改造局部魔法环境", "灭绝压力推动快速适应"],
  consciousness: ["梦境可影响现实", "灵魂可被记录", "记忆具备法则权重", "集体意识能形成实体", "自我认知会改变命运概率"],
  divinity: ["信仰能反向塑造神格", "神明受到法则约束", "奇迹存在冷却代价", "神战会污染纪元", "神性更偏向象征而非全能"],
  causality: ["预言并不总可靠", "局部时间可回流", "因果裂缝会吞噬解释", "命运存在弹性", "重大选择会形成历史锁点"],
};

const costs: Record<LawDomainId, string[]> = {
  physics: ["稳定来自低奇迹密度", "高能事件会放大结构缺陷", "过度稳定会压低异常可能"],
  magic: ["每次改写现实都会留下熵债", "魔法越强，因果越容易松动", "施法会消耗记忆、寿命或星光"],
  life: ["生命繁荣会提高灾变可见度", "复杂性越高，灭绝链越长", "意识出现后生态不再完全中立"],
  consciousness: ["梦境渗透会削弱客观历史", "灵魂保存需要付出记忆代价", "集体意识容易压制个体命运"],
  divinity: ["神性越活跃，凡世越难保持自主", "信仰失衡会引发神格饥荒", "奇迹会向未来转嫁风险"],
  causality: ["稳定因果会限制奇迹", "裂缝越多，复现难度越高", "时间回流会累积未偿还事件"],
};

export function generateLaws(template: UniverseTemplate, root: RandomStream): UniverseLaws {
  return {
    physics: generateDomain("physics", template, root.fork("laws.physics")),
    magic: generateDomain("magic", template, root.fork("laws.magic")),
    life: generateDomain("life", template, root.fork("laws.life")),
    consciousness: generateDomain("consciousness", template, root.fork("laws.consciousness")),
    divinity: generateDomain("divinity", template, root.fork("laws.divinity")),
    causality: generateDomain("causality", template, root.fork("laws.causality")),
  };
}

function generateDomain(id: LawDomainId, template: UniverseTemplate, rng: RandomStream): LawDomain {
  const value = round(clamp(template.weights[id] + rng.range(-13, 13)));
  const selectedTraits = uniquePicks(traits[id], rng, 3);
  const title = `${template.name}的${domainNames[id]}`;

  return {
    id,
    title,
    rating: {
      value,
      label: labelFor(value),
      explanation: explanationFor(id, value, template.name),
    },
    source: rng.pick(sources[id]),
    traits: selectedTraits,
    cost: rng.pick(costs[id]),
  };
}

function labelFor(value: number): string {
  if (value < 20) return "近乎沉寂";
  if (value < 40) return "微弱";
  if (value < 60) return "平衡";
  if (value < 80) return "强盛";
  return "极盛";
}

function explanationFor(id: LawDomainId, value: number, templateName: string): string {
  const direction = value >= 70 ? "成为主要驱动力" : value <= 30 ? "被压制到边缘" : "保持可观影响";
  return `${templateName}中，${domainNames[id]}${direction}，数值为 ${value}。`;
}

function uniquePicks(items: string[], rng: RandomStream, count: number): string[] {
  const pool = [...items];
  const result: string[] = [];
  while (pool.length > 0 && result.length < count) {
    const index = rng.int(0, pool.length - 1);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}
