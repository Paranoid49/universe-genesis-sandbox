# 阶段 6：造物主干预与奇迹系统

阶段 6 的目标是让用户在创世后施加有限、可记录、可复现的造物主干预。干预必须作为显式输入参与生成，不得静默改写阶段 0 至阶段 5 的既有确定性结果。

阶段 6 不实现阶段 7 的可视化宇宙观察台、星系点云、缩放层级、时间播放或信息叠层。

## 1. 目标

- 提供观察者模式和奇迹模式。
- 支持至少 6 种结构化奇迹。
- 每次奇迹必须消耗资源并产生可追踪后果。
- 干预日志必须能作为显式输入复现同一干预后宇宙。
- 奇迹过度使用必须触发负面后果。
- 为阶段 7 保留稳定目标 ID、结果事件 ID 和结构化影响摘要，但不实现任何可视化能力。

## 2. 输入边界

阶段 6 只允许从以下结构读取上下文：

- `UniverseSummary.seed`、`templateId` 和 `rulesetVersion`。
- 阶段 0 至阶段 5 已生成的法则、指标、时间线、星系、恒星系、行星、文明与神话系统。
- 显式传入的 `InterventionInput[]`。
- 确定性随机流。

阶段 6 不允许读取浏览器时间、网络状态、本地存储或任何不可复现输入。

## 3. 数据结构

阶段 6 新增干预输入、奇迹定义、奇迹结果和干预状态。

```ts
type CreatorMode = "observer" | "miracle"

type MiracleType =
  | "bless_planet"
  | "stabilize_star"
  | "seed_life"
  | "grant_magic"
  | "send_catastrophe"
  | "revive_civilization"
  | "seal_deity"
  | "repair_causality"

type InterventionInput = {
  id: string
  miracleType: MiracleType
  targetId: string
}

type MiracleCost = {
  miraclePoints: number
  causalityStrain: number
  stabilityDelta: number
  lawPressureDelta: number
}

type Miracle = {
  id: string
  type: MiracleType
  title: string
  targetId: string
  targetLabel: string
  cost: MiracleCost
  immediateEffects: EventEffect[]
  probabilityShifts: InterventionProbabilityShift[]
  longTermRisks: string[]
}

type InterventionLog = {
  id: string
  age: number
  miracleId: string
  resultEventIds: string[]
  directResult: string
  longTermConsequence: string
}

type MiracleState = {
  mode: CreatorMode
  miraclePointBudget: number
  spentMiraclePoints: number
  remainingMiraclePoints: number
  causalityStrain: number
  overuseLevel: "none" | "strained" | "backlash"
  availableMiracles: MiracleDefinition[]
  appliedMiracles: Miracle[]
  interventionLog: InterventionLog[]
  metricDeltas: Record<MetricId, number>
  probabilityShifts: InterventionProbabilityShift[]
  backlashEvents: TimelineEvent[]
  summary: string
}
```

`GenerateUniverseInput` 新增可选字段：

```ts
type GenerateUniverseInput = {
  seed: string
  templateId?: UniverseTemplateId
  interventions?: InterventionInput[]
}
```

## 4. 奇迹范围

阶段 6 至少支持以下奇迹：

- 祝福行星：提升生命潜力或文明潜力。
- 稳定恒星：提升稳定度，降低灾变概率。
- 注入生命：提升生命潜力和生命事件概率。
- 赐予魔法：提升魔法强度，增加神话或异常概率。
- 降下灾难：压低稳定度，但推动终局或重构事件概率。
- 复活文明：提升文明潜力，降低文明崩溃风险。
- 封印神明：降低神性活跃度与神话压力。
- 修复因果裂缝：提升因果完整度，降低异常概率。

每个奇迹必须包含：

- 目标类型与目标 ID。
- 奇迹点消耗。
- 因果压力。
- 至少一个指标变化或事件概率变化。
- 直接结果事件。
- 长期风险描述。

## 5. 生成规则

- 无干预时，阶段 6 只输出观察者模式状态，不改变既有宇宙结果。
- 有干预时，系统按输入顺序应用奇迹。
- 每个奇迹生成一条可追踪的时间线结果事件。
- 每个奇迹会改变至少一个指标或一个未来事件概率。
- 干预日志 ID、奇迹 ID 和结果事件 ID 必须稳定。
- 同一 `seed + templateId + rulesetVersion + InterventionInput[]` 必须生成同一干预后宇宙。
- 过度使用奇迹会进入压力或反噬状态，并追加负面后果事件。
- 干预只能作为创世后的显式覆盖层，不得悄悄重写阶段 0 至阶段 5 的来源对象 ID。

## 6. 页面要求

页面新增造物主干预区域：

- 展示当前模式、奇迹点、因果压力和反噬状态。
- 支持选择奇迹类型。
- 支持选择当前奇迹允许的目标。
- 支持施加奇迹。
- 展示已应用奇迹、干预日志、指标变化和概率变化。

页面新增内容不得破坏已有宇宙摘要、局部探索、文明演化、纪元时间线、法则对比和观察日志。

## 7. 阶段 7 禁区

阶段 6 严禁实现以下阶段 7 内容：

- 星系点云。
- 宇宙背景视觉。
- 可缩放宇宙、星系、恒星系或行星视图。
- 时间播放、暂停、拖动时间或关键事件播放控制。
- 生命热点、文明热点、魔法风暴、神性遗迹或因果裂缝的可视化叠层。
- Canvas、WebGL、Three.js 或 3D 场景。

阶段 6 只提供结构化数据，供阶段 7 将来读取。

## 8. 验收标准

- 至少支持 6 种奇迹。
- 每种奇迹都有明确目标类型、代价、直接效果、概率影响和长期风险。
- 每次奇迹会改变至少一个后续指标或事件概率。
- 奇迹过度使用会触发负面后果。
- 干预后的宇宙可通过 `seed + templateId + rulesetVersion + InterventionInput[]` 完全复现。
- 页面静态渲染包含造物主干预、奇迹点、因果压力、干预日志和概率变化入口。
- 阶段 6 不包含任何阶段 7 的可视化观察台能力。

## 9. 开发顺序

1. 定义奇迹、干预输入、干预日志和干预状态类型。
2. 增加奇迹内容素材池。
3. 增加干预应用器，生成奇迹结果事件、指标变化、概率变化和反噬事件。
4. 将干预输入接入 `generateUniverse`。
5. 增加页面造物主干预区域。
6. 增加阶段 6 自动化验收测试。
7. 更新 README、贡献指南、架构说明和仓库就绪文档。
