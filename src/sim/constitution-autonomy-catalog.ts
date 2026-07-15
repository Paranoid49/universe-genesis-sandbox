import type { ConstitutionModule, ConstitutionModuleCategory, ConstitutionModuleSpec } from "./contracts/constitution";
import { createConstitutionModule, createUniverseConstitution } from "./constitution-validation";

function module(category: ConstitutionModuleCategory, id: string, name: string, _description: string, spec: ConstitutionModuleSpec): ConstitutionModule {
  return createConstitutionModule({ id, moduleVersion: "1.0.0", category, name, description: name, dependencies: [], conflicts: [], spec });
}

const livingTideModules = Object.freeze([
  module("ontology", "ontology.living-tide@1", "潮生本体", "定义潮生体。", {
    objectKinds: [{
      id: "tide-organism",
      name: "潮生体",
      initialStatus: "dormant",
      initialCount: 2,
      attributes: [
        { id: "age", name: "历时", initial: 0, minimum: 0, maximum: 10 },
        { id: "energy", name: "活性能量", initial: 2, minimum: 0, maximum: 10 },
        { id: "signal", name: "交流信号", initial: 0, minimum: 0, maximum: 10 },
      ],
    }],
  }),
  module("action", "action.living-tide@1", "潮生作用", "定义演化与交流。", {
    rules: [
      { id: "rule.tide.age@1", name: "历时增长", targetKind: "tide-organism", priority: 100, conditions: [{ field: "age", operator: "lt", value: 10 }], effects: [{ field: "age", operation: "add", value: 1 }] },
      { id: "rule.tide.signal@1", name: "自主交流", targetKind: "tide-organism", priority: 90, trigger: "autonomous", conditions: [{ field: "energy", operator: "gte", value: 0 }], cost: { field: "energy", amount: 1 }, effects: [{ field: "signal", operation: "add", value: 1 }] },
    ],
  }),
  module("constraint", "constraint.living-tide@1", "潮生边界", "限制属性。", {
    constraints: [
      { id: "constraint.tide.age", targetKind: "tide-organism", field: "age", minimum: 0, maximum: 10 },
      { id: "constraint.tide.energy", targetKind: "tide-organism", field: "energy", minimum: 0, maximum: 10 },
      { id: "constraint.tide.signal", targetKind: "tide-organism", field: "signal", minimum: 0, maximum: 10 },
    ],
  }),
  module("priority", "priority.rule-id@1", "稳定规则裁决", "按规则标识裁决。", { tieBreaker: "rule-id" }),
  module("time", "time.living-tide@1", "潮汐时间", "按潮次演化。", { mode: "linear", unitName: "潮次" }),
  module("topology", "topology.living-tide@1", "潮生关系", "定义共潮关系。", { mode: "relational", relationNames: ["共潮"], initialRelations: [{ id: "relation.tide.kin", name: "共潮", sourceKind: "tide-organism", targetKind: "tide-organism", directed: false }] }),
  module("cognition", "cognition.living-tide@1", "潮生认知", "定义有限认知。", {
    publicAxiomIds: ["rule.tide.age@1", "rule.tide.signal@1"],
    hiddenAttributeIds: [],
    autonomyPolicies: [{
      id: "autonomy.tide-organism@1",
      name: "潮生主体",
      targetKind: "tide-organism",
      activation: { field: "age", operator: "gte", value: 1 },
      deactivation: { field: "energy", operator: "lte", value: 0 },
      perceptions: [{ field: "energy", bias: 2, uncertainty: "确定性偏差" }, { field: "signal", uncertainty: "确定" }],
      memoryCapacity: 4,
      actions: [{ id: "action.tide.signal@1", ruleId: "rule.tide.signal@1", beliefField: "energy", operator: "gte", value: 1, priority: 100, goal: "尝试交流" }],
      narrative: { id: "narrative.tide.abundance@1", title: "丰潮传说", beliefField: "energy", template: "相信活性为 {value}。", archiveAsMyth: true },
    }],
  }),
  module("observable", "observable.living-tide@1", "潮生观察", "观察潮生变化。", {
    methods: [
      { id: "tide.energy", name: "活性观察", description: "观察活性。", scale: "object", kind: "range", field: "energy", bands: [{ maximum: 0, label: "活性消失" }, { maximum: 2, label: "活性有限" }, { label: "活性充足" }] },
      { id: "tide.signal-trend", name: "信号趋势", description: "观察信号。", scale: "history", kind: "trend", field: "signal" },
      { id: "tide.change", name: "潮生变化", description: "观察变化。", scale: "history", kind: "recent-change" },
      { id: "tide.rule", name: "潮生规律", description: "追踪规则。", scale: "rule", kind: "rule-trace" },
    ],
    metrics: [{ id: "metric.tide.energy", name: "活性能量", field: "energy", visibility: "observable" }, { id: "metric.tide.signal", name: "交流信号", field: "signal", visibility: "observable" }],
  }),
  module("event", "event.living-tide@1", "潮生事件", "分类状态差异。", { classifiers: [
    { id: "event.tide.age", name: "历时变化", field: "age" },
    { id: "event.tide.energy", name: "活性变化", field: "energy" },
    { id: "event.tide.signal", name: "交流变化", field: "signal" },
  ] }),
  module("intervention", "intervention.living-tide@1", "潮生干预", "允许活性脉冲。", { capabilities: [{ id: "capability.tide.energy", name: "活性脉冲", targetKinds: ["tide-organism"], field: "energy", minimumDelta: -2, maximumDelta: 2 }] }),
  module("boundary", "boundary.living-tide@1", "潮生有界演化", "限制规模。", {
    observationsAffectState: false,
    maximumRuleEvaluations: 16,
    maximumEffectsPerStep: 32,
    maximumObjects: 16,
    maximumRelations: 16,
    maximumAutonomousEntities: 8,
    maximumMemoriesPerEntity: 4,
    maximumAutonomousActionsPerStep: 4,
  }),
]);

export const LIVING_TIDE = createUniverseConstitution({ presetId: "living-tide@1", name: "潮生世界", description: "主体由状态形成并行动。", modules: livingTideModules });
