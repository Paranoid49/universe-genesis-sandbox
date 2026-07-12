export function metricName(key: string): string {
  const names: Record<string, string> = {
    age: "宇宙年龄",
    stability: "稳定度",
    lifePotential: "生命潜力",
    civilizationPotential: "文明潜力",
    magicIntensity: "魔法强度",
    divineActivity: "神性活跃",
    causalityIntegrity: "因果完整",
    timeline: "时间线",
    laws: "法则压力",
  };
  return names[key] ?? key;
}

export function lawDomainName(key: string): string {
  const names: Record<string, string> = {
    physics: "物理",
    magic: "魔法",
    life: "生命",
    consciousness: "意识",
    divinity: "神性",
    causality: "因果",
  };
  return names[key] ?? key;
}

export function polarityName(value: string): string {
  const names: Record<string, string> = {
    support: "支撑",
    pressure: "压力",
    volatile: "波动",
  };
  return names[value] ?? value;
}

export function interactionKindName(value: string): string {
  const names: Record<string, string> = {
    synergy: "协同",
    conflict: "冲突",
    constraint: "约束",
  };
  return names[value] ?? value;
}

export function eventTypeName(value: string): string {
  const names: Record<string, string> = {
    creation: "创世事件",
    stars: "星辰事件",
    elements: "元素事件",
    life: "生命事件",
    civilization: "文明事件",
    myth: "神话事件",
    ascension: "飞升事件",
    ending: "终局事件",
    anomaly: "异常事件",
  };
  return names[value] ?? value;
}

export function eraName(era: string): string {
  const names: Record<string, string> = {
    creation: "创世",
    stars: "星辰",
    elements: "元素",
    life: "生命",
    civilization: "文明",
    myth: "神话",
    ascension: "飞升",
    ending: "终局",
  };
  return names[era] ?? era;
}

export function galaxyTypeName(value: string): string {
  const names: Record<string, string> = {
    spiral: "旋臂",
    elliptical: "椭圆",
    dwarf: "矮星系",
    irregular: "不规则",
    nebula_forge: "星云熔炉",
    arcane_cluster: "灵质星团",
    divine_remnant: "神性遗迹",
    causal_shard: "因果碎片",
  };
  return names[value] ?? value;
}

export function starSystemTypeName(value: string): string {
  const names: Record<string, string> = {
    single_star: "单恒星",
    binary_star: "双星",
    trinary_star: "三星",
    red_dwarf: "红矮星",
    giant_star: "巨星",
    white_dwarf: "白矮残系",
    black_hole_neighbor: "黑洞邻近",
    arcane_star: "魔法恒星",
  };
  return names[value] ?? value;
}

export function planetTypeName(value: string): string {
  const names: Record<string, string> = {
    rocky: "岩石行星",
    ocean: "海洋行星",
    desert: "荒漠行星",
    ice: "冰封行星",
    gas_giant: "气态巨行星",
    floating: "浮空行星",
    dream: "梦境行星",
    aether: "灵质行星",
    mechanical: "机械行星",
  };
  return names[value] ?? value;
}

export function orbitZoneName(value: string): string {
  const names: Record<string, string> = {
    inner: "内侧轨道",
    habitable: "宜居轨道",
    outer: "外侧轨道",
  };
  return names[value] ?? value;
}

export function biosphereLevelName(value: string): string {
  const names: Record<string, string> = {
    microbial: "原始生命",
    complex: "复杂生命",
    intelligent: "智慧生命",
    magical: "魔法生命",
    spiritual: "灵体生命",
    mechanical: "机械生命",
  };
  return names[value] ?? value;
}

export function speciesTypeName(value: string): string {
  const names: Record<string, string> = {
    biological: "生物物种",
    magical: "魔法物种",
    spiritual: "灵体物种",
    mechanical: "机械物种",
    hybrid: "混合物种",
  };
  return names[value] ?? value;
}

export function civilizationFateName(value: string): string {
  const names: Record<string, string> = {
    expansion: "扩张倾向",
    ascension: "飞升倾向",
    collapse: "崩溃风险",
    stagnation: "停滞倾向",
    symbiosis: "共生倾向",
    unknown: "未定命运",
  };
  return names[value] ?? value;
}

export function civilizationPathName(value: string): string {
  const names: Record<string, string> = {
    tribal: "原始部落",
    city_state: "城邦",
    planetary: "行星文明",
    galactic: "星系文明",
    arcane_empire: "魔法帝国",
    theocracy: "神权文明",
    collective_mind: "集体意识",
    ascended: "飞升文明",
    lost: "失落文明",
  };
  return names[value] ?? value;
}

export function mythologyTypeName(value: string): string {
  const names: Record<string, string> = {
    none: "无神",
    creator_deity: "造物主神",
    nature_deity: "自然神",
    faith_deity: "信仰神",
    stellar_deity: "恒星神",
    black_hole_deity: "黑洞神",
    death_or_dream_deity: "死亡或梦境神",
    machine_deity: "机械神",
  };
  return names[value] ?? value;
}

export function civilizationEventTypeName(value: string): string {
  const names: Record<string, string> = {
    first_fire_or_language: "火种与语言",
    first_magic: "第一次魔法",
    first_astronomy: "天文观测",
    first_deity_contact: "接触神明",
    world_war: "世界战争",
    star_voyage: "星海远航",
    ascension_rite: "飞升仪式",
    extinction: "文明灭绝",
  };
  return names[value] ?? value;
}

export function miracleTypeName(value: string): string {
  const names: Record<string, string> = {
    bless_planet: "祝福行星",
    stabilize_star: "稳定恒星",
    seed_life: "注入生命",
    grant_magic: "赐予魔法",
    send_catastrophe: "降下灾难",
    revive_civilization: "复活文明",
    seal_deity: "封印神明",
    repair_causality: "修复因果裂缝",
  };
  return names[value] ?? value;
}

export function miracleTargetKindName(value: string): string {
  const names: Record<string, string> = {
    universe: "宇宙",
    planet: "行星",
    star_system: "恒星系",
    civilization: "文明",
    mythology: "神话系统",
  };
  return names[value] ?? value;
}

export function miracleOveruseLevelName(value: string): string {
  const names: Record<string, string> = {
    none: "可控",
    strained: "压力偏高",
    backlash: "反噬",
  };
  return names[value] ?? value;
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
