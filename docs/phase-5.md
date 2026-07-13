# 阶段 5：文明演化与神话生成

阶段 5 的目标是让阶段 4 的生命样本继续发展为可追踪的文明、文明路径、神话系统和文明历史事件。

阶段 5 不实现造物主干预、奇迹点、用户改写历史或任何阶段 6 的任务。

## 1. 目标

- 从阶段 4 暴露的 `Biosphere.civilizationSeed` 生成独立文明实体。
- 让文明路径、神话系统和文明历史消费结构化法则、时间线影响和起源行星局部环境。
- 在页面中提供文明概览、文明详情、文明历史和神话关系浏览。
- 保持 `seed + templateId + rulesetVersion` 的确定性复现。
- 为阶段 6 保留稳定来源追踪，但不提前实现阶段 6 的干预机制。

## 2. 输入边界

阶段 5 只允许从以下结构读取生成上下文：

- `Biosphere.civilizationSeed`。
- 起源行星、恒星系和星系的局部环境。
- `UniverseSummary.laws` 与结构化法则。
- `UniverseSummary.metrics`。
- `UniverseSummary.timelineImpact`。
- `UniverseSummary.timeline` 中已有事件的来源与纪元影响。
- 确定性随机流。

阶段 5 不允许凭空生成没有起源行星的文明。

## 3. 数据结构

阶段 5 新增独立 `Civilization` 实体。

```ts
type Civilization = {
  id: string
  name: string
  originGalaxyId: string
  originStarSystemId: string
  originPlanetId: string
  speciesType: SpeciesType
  technologyLevel: number
  magicLevel: number
  faithIntensity: number
  expansionDrive: number
  stability: number
  extinctionRisk: number
  path: CivilizationPath
  mythology: MythologySystem
  fate: CivilizationFate
  historyEvents: CivilizationEvent[]
  sourceEventIds: string[]
  sourceRuleIds: string[]
}
```

文明路径至少覆盖：

- 原始部落。
- 城邦。
- 行星文明。
- 星系文明。
- 魔法帝国。
- 神权文明。
- 集体意识。
- 飞升文明。
- 失落文明。

神话系统至少覆盖：

- 无神。
- 造物主神。
- 自然神。
- 信仰神。
- 恒星神。
- 黑洞神。
- 死亡或梦境神。
- 被文明制造的机械神。

文明历史事件至少覆盖：

- 第一次火种或语言。
- 第一次魔法。
- 第一次天文观测。
- 第一次接触神明。
- 世界大战。
- 星海远航。
- 飞升仪式。
- 文明灭绝。

## 4. 生成规则

- 文明必须从生命行星的 `civilizationSeed` 派生。
- 技术等级、魔法等级、信仰强度、扩张倾向和稳定度继承候选种子，再叠加宇宙法则、时间线影响和局部环境。
- 文明路径必须与文明数值和宇宙法则一致，例如高魔法倾向更容易形成魔法帝国，高神性倾向更容易形成神权文明，高意识倾向更容易形成集体意识。
- 神话系统必须读取神性法则、意识法则、魔法强度、信仰强度和起源环境。
- 文明历史事件必须有 8 至 15 条，并包含可追踪来源。
- 文明终局沿用 `CivilizationFate`，至少支持扩张、飞升、崩溃、停滞、共生和未定命运。

## 5. 页面要求

页面新增文明浏览区域：

- 展示文明总数、活跃路径、神话系统数量和高风险文明数量。
- 支持选择文明。
- 文明数量超过单页承载能力时，必须支持搜索、路径筛选和分页，单页最多渲染 30 个文明选择项。
- 展示文明起源行星、文明路径、终局、核心数值、神话系统和来源。
- 展示 8 至 15 条文明历史事件。

页面新增内容不得破坏已有宇宙摘要、局部探索、指标、时间线、法则对比和观察日志。

## 6. 阶段 6 禁区

阶段 5 严禁实现以下阶段 6 内容：

- 造物主模式。
- 奇迹点或干预资源。
- 用户对宇宙、行星、文明或神明的主动干预。
- 干预日志。
- 干预代价。
- 复活文明、封印神明、修复因果裂缝或改写局部法则等交互。

阶段 5 只保留稳定 ID、起源对象和来源追踪，供阶段 6 将来读取。

## 7. 验收标准

- 生命行星中的候选种子能按规则生成文明。
- 文明路径与宇宙法则、时间线影响和起源行星环境一致。
- 系统支持至少 5 类文明终局。
- 每个重要文明有 8 至 15 条历史事件。
- 文明、神话系统和文明事件都能追踪到已有事件或法则来源。
- 同一 `seed + templateId + rulesetVersion` 的文明结果完全一致。
- 不同模板或不同 seed 会产生可感知的文明差异。
- 代表性模板不得把全部文明长期压缩为单一路径。
- 页面静态渲染包含文明演化、文明详情、神话系统和文明历史入口。
- `src/sim/**` 不直接使用 `Math.random()`。
- 不包含任何阶段 6 的造物主干预或奇迹交互能力。

## 8. 开发顺序

1. 定义文明、文明路径、神话系统和文明事件类型。
2. 增加文明内容素材池。
3. 从 `Biosphere.civilizationSeed` 生成文明实体。
4. 将文明结果接入 `UniverseSummary`。
5. 增加页面文明浏览区域。
6. 增加阶段 5 自动化验收测试。
7. 更新 README、贡献指南和仓库就绪文档。
