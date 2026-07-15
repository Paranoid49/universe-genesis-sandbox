import type {
  ConstitutionModule,
  ConstitutionModuleCategory,
  ConstitutionModuleSpec,
  UniverseConstitution,
} from "./contracts/constitution";
import { createConstitutionModule, createUniverseConstitution } from "./constitution-validation";
import { LIVING_TIDE } from "./constitution-autonomy-catalog";
export { LIVING_TIDE } from "./constitution-autonomy-catalog";

export type ConstitutionPresetId = "material-expanse@1" | "arcane-weave@1" | "dream-flux@1" | "living-tide@1";

function module(category: ConstitutionModuleCategory, id: string, name: string, description: string, spec: ConstitutionModuleSpec): ConstitutionModule {
  return createConstitutionModule({
    id,
    moduleVersion: "1.0.0",
    category,
    name,
    description,
    dependencies: [],
    conflicts: [],
    spec,
  });
}

const sharedPriority = module("priority", "priority.rule-id@1", "稳定规则裁决", "优先级相同时按规则 ID 稳定裁决。", { tieBreaker: "rule-id" });
const sharedBoundary = module("boundary", "boundary.bounded-step@1", "有界演化", "限制单步规则、效果与对象规模。", {
  observationsAffectState: false,
  maximumRuleEvaluations: 32,
  maximumEffectsPerStep: 64,
  maximumObjects: 128,
  maximumRelations: 256,
});

const materialModules = Object.freeze([
  module("ontology", "ontology.material-expanse@1", "物质广域本体", "物质区域具有凝聚与能量属性。", {
    objectKinds: [{
      id: "matter-region",
      name: "物质区域",
      initialStatus: "forming",
      attributes: [
        { id: "cohesion", name: "凝聚度", initial: 28, minimum: 0, maximum: 100 },
        { id: "energy", name: "能量", initial: 70, minimum: 0, maximum: 100 },
      ],
    }],
  }),
  module("action", "action.material-dynamics@1", "物质演化作用", "凝聚与能量按照物质规则持续变化。", {
    rules: [{
      id: "rule.material-condensation@1",
      name: "物质凝聚",
      targetKind: "matter-region",
      priority: 100,
      conditions: [{ field: "energy", operator: "gt", value: 0 }],
      effects: [
        { field: "cohesion", operation: "add", value: 6, randomMinimum: -2, randomMaximum: 2 },
        { field: "energy", operation: "add", value: -1, randomMinimum: -1, randomMaximum: 1 },
      ],
    }],
  }),
  module("constraint", "constraint.material-bounds@1", "物质边界", "凝聚与能量保持在有限范围。", {
    constraints: [
      { id: "constraint.material.cohesion", targetKind: "matter-region", field: "cohesion", minimum: 0, maximum: 100 },
      { id: "constraint.material.energy", targetKind: "matter-region", field: "energy", minimum: 0, maximum: 100 },
    ],
  }),
  sharedPriority,
  module("time", "time.linear@1", "线性时间", "逻辑时刻按纪元步线性前进。", { mode: "linear", unitName: "纪元步" }),
  module("topology", "topology.hierarchical-space@1", "层级空间", "对象通过包含与邻接关系组织。", { mode: "hierarchical", relationNames: ["包含", "邻接"], initialRelations: [
    { id: "relation.contains", name: "包含", sourceKind: "*", targetKind: "*", directed: true },
    { id: "relation.adjacent", name: "邻接", sourceKind: "*", targetKind: "*", directed: false },
  ] }),
  module("cognition", "cognition.material@1", "物质认知边界", "公开物质凝聚公理，其余事实依赖观察。", { publicAxiomIds: ["rule.material-condensation@1"], hiddenAttributeIds: [] }),
  module("observable", "observable.material@1", "物质观察", "观察凝聚区间、能量趋势、变化与规则。", {
    methods: [
      { id: "structure", name: "结构观测", description: "判断凝聚度区间。", scale: "object", kind: "range", field: "cohesion", bands: [{ maximum: 39, label: "结构松散" }, { maximum: 69, label: "结构正在凝聚" }, { label: "结构高度凝聚" }] },
      { id: "energy-trend", name: "能量趋势", description: "比较相邻时刻能量方向。", scale: "history", kind: "trend", field: "energy" },
      { id: "recent-change", name: "近期变化", description: "检查已提交语义变化。", scale: "history", kind: "recent-change" },
      { id: "rule-trace", name: "规律追踪", description: "查看实际参与变化的公开规则。", scale: "rule", kind: "rule-trace" },
    ],
    metrics: [{ id: "metric.material.cohesion", name: "凝聚度", field: "cohesion", visibility: "observable" }, { id: "metric.material.energy", name: "能量", field: "energy", visibility: "observable" }],
  }),
  module("event", "event.material@1", "物质事件", "按凝聚与能量差异分类事件。", {
    classifiers: [{ id: "event.material.structure", name: "结构变化", field: "cohesion" }, { id: "event.material.energy", name: "能量变化", field: "energy" }],
  }),
  module("intervention", "intervention.material@1", "物质干预", "允许有限能量脉冲进入宇宙历史。", {
    capabilities: [{ id: "capability.material.energy-pulse", name: "能量脉冲", targetKinds: ["matter-region"], field: "energy", minimumDelta: -20, maximumDelta: 20 }],
  }),
  sharedBoundary,
]);

const arcaneModules = Object.freeze([
  module("ontology", "ontology.arcane-weave@1", "奥术织网本体", "奥术结点具有共鸣、法力与稳定性。", {
    objectKinds: [{
      id: "arcane-knot",
      name: "奥术结点",
      initialStatus: "attuning",
      attributes: [
        { id: "resonance", name: "共鸣", initial: 45, minimum: 0, maximum: 100 },
        { id: "mana", name: "法力", initial: 72, minimum: 0, maximum: 100 },
        { id: "stability", name: "稳定性", initial: 35, minimum: 0, maximum: 100 },
      ],
    }],
  }),
  module("action", "action.arcane-resonance@1", "奥术共鸣作用", "法力被消耗并推动共鸣与稳定性变化。", {
    rules: [{
      id: "rule.arcane-attunement@1",
      name: "奥术调谐",
      targetKind: "arcane-knot",
      priority: 120,
      conditions: [{ field: "mana", operator: "gte", value: 0 }],
      cost: { field: "mana", amount: 1 },
      effects: [
        { field: "resonance", operation: "add", value: 5, randomMinimum: -3, randomMaximum: 3 },
        { field: "stability", operation: "add", value: 2, randomMinimum: -2, randomMaximum: 2 },
      ],
    }],
  }),
  module("constraint", "constraint.arcane-bounds@1", "奥术边界", "奥术属性保持在可执行范围。", {
    constraints: [
      { id: "constraint.arcane.resonance", targetKind: "arcane-knot", field: "resonance", minimum: 0, maximum: 100 },
      { id: "constraint.arcane.mana", targetKind: "arcane-knot", field: "mana", minimum: 0, maximum: 100 },
      { id: "constraint.arcane.stability", targetKind: "arcane-knot", field: "stability", minimum: 0, maximum: 100 },
    ],
  }),
  sharedPriority,
  module("time", "time.cyclic@1", "循环时间", "逻辑时刻在十二相位中循环显示。", { mode: "cyclic", unitName: "相位", cycleLength: 12 }),
  module("topology", "topology.arcane-network@1", "奥术关系网", "结点通过共鸣与传导关系形成网络。", { mode: "relational", relationNames: ["共鸣", "传导", "抑制"], initialRelations: [
    { id: "relation.resonance", name: "共鸣", sourceKind: "*", targetKind: "*", directed: false },
    { id: "relation.transmission", name: "传导", sourceKind: "*", targetKind: "*", directed: true },
    { id: "relation.suppression", name: "抑制", sourceKind: "*", targetKind: "*", directed: true },
  ] }),
  module("cognition", "cognition.arcane@1", "奥术认知边界", "公开奥术调谐公理，其余织网事实依赖观察。", { publicAxiomIds: ["rule.arcane-attunement@1"], hiddenAttributeIds: [] }),
  module("observable", "observable.arcane@1", "奥术观察", "观察共鸣光谱、法力趋势、变化与规则。", {
    methods: [
      { id: "arcane.aura", name: "灵光光谱", description: "判断共鸣区间。", scale: "object", kind: "range", field: "resonance", bands: [{ maximum: 32, label: "共鸣微弱" }, { maximum: 66, label: "共鸣活跃" }, { label: "共鸣澎湃" }] },
      { id: "arcane.mana-trend", name: "法力潮汐", description: "比较相邻相位的法力方向。", scale: "history", kind: "trend", field: "mana" },
      { id: "arcane.change", name: "织网变化", description: "检查奥术结点的已提交变化。", scale: "history", kind: "recent-change" },
      { id: "arcane.rule", name: "奥术规律", description: "查看已应用奥术规则。", scale: "rule", kind: "rule-trace" },
    ],
    metrics: [{ id: "metric.arcane.resonance", name: "共鸣", field: "resonance", visibility: "observable" }, { id: "metric.arcane.mana", name: "法力", field: "mana", visibility: "observable" }],
  }),
  module("event", "event.arcane@1", "奥术事件", "按共鸣、法力与稳定性差异分类。", {
    classifiers: [{ id: "event.arcane.resonance", name: "共鸣跃迁", field: "resonance" }, { id: "event.arcane.mana", name: "法力潮汐", field: "mana" }, { id: "event.arcane.stability", name: "织网稳定变化", field: "stability" }],
  }),
  module("intervention", "intervention.arcane@1", "奥术干预", "允许界内调谐进入当前历史。", {
    capabilities: [{ id: "capability.arcane.attune", name: "调谐共鸣", targetKinds: ["arcane-knot"], field: "resonance", minimumDelta: -12, maximumDelta: 12, costField: "mana", costAmount: 2 }],
  }),
  sharedBoundary,
]);

const dreamModules = Object.freeze([
  module("ontology", "ontology.dream-flux@1", "梦流本体", "意象由连贯性与可塑性维持，不依赖传统空间。", {
    objectKinds: [{
      id: "dream-motif",
      name: "梦境意象",
      initialStatus: "emerging",
      attributes: [
        { id: "coherence", name: "连贯性", initial: 50, minimum: 0, maximum: 100 },
        { id: "mutability", name: "可塑性", initial: 62, minimum: 0, maximum: 100 },
      ],
    }],
  }),
  module("action", "action.dream-flux@1", "梦流作用", "意象在分段时间中改变连贯性与可塑性。", {
    rules: [{
      id: "rule.dream-reframing@1",
      name: "意象重构",
      targetKind: "dream-motif",
      priority: 90,
      conditions: [{ field: "mutability", operator: "gt", value: 0 }],
      effects: [
        { field: "coherence", operation: "add", value: 2, randomMinimum: -4, randomMaximum: 4 },
        { field: "mutability", operation: "add", value: -1, randomMinimum: -2, randomMaximum: 2 },
      ],
    }],
  }),
  module("constraint", "constraint.dream-bounds@1", "梦流边界", "连贯性与可塑性保持有限。", {
    constraints: [
      { id: "constraint.dream.coherence", targetKind: "dream-motif", field: "coherence", minimum: 0, maximum: 100 },
      { id: "constraint.dream.mutability", targetKind: "dream-motif", field: "mutability", minimum: 0, maximum: 100 },
    ],
  }),
  sharedPriority,
  module("time", "time.segmented@1", "分段时间", "逻辑时刻按浮现、变奏、沉降分段显示。", { mode: "segmented", unitName: "梦段", segmentNames: ["浮现", "变奏", "沉降"] }),
  module("topology", "topology.semantic-dream@1", "语义关系", "意象通过相似、隐喻与反照关系组织。", { mode: "semantic", relationNames: ["相似", "隐喻", "反照"], initialRelations: [
    { id: "relation.similarity", name: "相似", sourceKind: "*", targetKind: "*", directed: false },
    { id: "relation.metaphor", name: "隐喻", sourceKind: "*", targetKind: "*", directed: true },
    { id: "relation.reflection", name: "反照", sourceKind: "*", targetKind: "*", directed: true },
  ] }),
  module("cognition", "cognition.dream@1", "梦流认知边界", "公开意象重构公理，其余语义关系依赖观察。", { publicAxiomIds: ["rule.dream-reframing@1"], hiddenAttributeIds: [] }),
  module("observable", "observable.dream@1", "梦流观察", "观察连贯区间、可塑趋势、变化与规则。", {
    methods: [
      { id: "dream.coherence", name: "连贯感知", description: "判断意象连贯区间。", scale: "object", kind: "range", field: "coherence", bands: [{ maximum: 32, label: "意象破碎" }, { maximum: 66, label: "意象可辨" }, { label: "意象连贯" }] },
      { id: "dream.mutability-trend", name: "可塑趋势", description: "比较相邻梦段的可塑性。", scale: "history", kind: "trend", field: "mutability" },
      { id: "dream.change", name: "梦流变化", description: "检查意象的已提交变化。", scale: "history", kind: "recent-change" },
      { id: "dream.rule", name: "梦流规律", description: "查看已应用梦流规则。", scale: "rule", kind: "rule-trace" },
    ],
    metrics: [{ id: "metric.dream.coherence", name: "连贯性", field: "coherence", visibility: "observable" }, { id: "metric.dream.mutability", name: "可塑性", field: "mutability", visibility: "observable" }],
  }),
  module("event", "event.dream@1", "梦流事件", "按连贯性与可塑性差异分类。", {
    classifiers: [{ id: "event.dream.coherence", name: "意象重构", field: "coherence" }, { id: "event.dream.mutability", name: "可塑变化", field: "mutability" }],
  }),
  module("intervention", "intervention.none@1", "无界内干预", "梦流不允许宇宙内干预，但仍允许界外实验。", { capabilities: [] }),
  sharedBoundary,
]);

export const MATERIAL_EXPANSE = createUniverseConstitution({ presetId: "material-expanse@1", name: "物质广域", description: "线性时间与层级空间中的物质演化宇宙。", modules: materialModules });
export const ARCANE_WEAVE = createUniverseConstitution({ presetId: "arcane-weave@1", name: "奥术织网", description: "循环时间与奥术关系网中的共鸣宇宙。", modules: arcaneModules });
export const DREAM_FLUX = createUniverseConstitution({ presetId: "dream-flux@1", name: "梦流连续体", description: "没有传统空间、生命或文明指标的语义梦境宇宙。", modules: dreamModules });
export const REFERENCE_CONSTITUTIONS: readonly UniverseConstitution[] = Object.freeze([MATERIAL_EXPANSE, ARCANE_WEAVE, DREAM_FLUX]);
export const PRODUCT_CONSTITUTIONS: readonly UniverseConstitution[] = Object.freeze([...REFERENCE_CONSTITUTIONS, LIVING_TIDE]);
export const CONSTITUTION_MODULE_CATALOG: readonly ConstitutionModule[] = Object.freeze([
  ...new Map(PRODUCT_CONSTITUTIONS.flatMap((entry) => entry.modules).map((entry) => [entry.id, entry])).values(),
]);

export const COMPOSED_REFERENCE_CONSTITUTION = createUniverseConstitution({
  name: "奥术梦网组合",
  description: "奥术本体采用线性时间与梦境语义拓扑的合法组合夹具。",
  modules: arcaneModules.map((entry) => {
    if (entry.category === "time") return materialModules.find((candidate) => candidate.category === "time")!;
    if (entry.category === "topology") return dreamModules.find((candidate) => candidate.category === "topology")!;
    return entry;
  }),
});

export function getReferenceConstitution(presetId: ConstitutionPresetId): UniverseConstitution {
  const constitution = PRODUCT_CONSTITUTIONS.find((entry) => entry.presetId === presetId);
  if (!constitution) throw new Error("未知宇宙宪法预设。");
  return constitution;
}
