# 阶段 4：星系、恒星、行星与生命样本

版本：1.0  
日期：2026-07-07  
状态：已完成

## 1. 当前结论

阶段 4 已实现可探索的局部对象样本。系统会在 `UniverseSummary.galaxies` 中生成代表性星系、恒星系、行星和可选生物圈，并在页面中提供从宇宙摘要进入星系、恒星系、行星详情的浏览路径。

阶段 4 不模拟完整宇宙天文对象总量，只生成能代表当前宇宙法则、时间线影响和局部环境倾向的样本集合。

## 2. 生成入口

当前新增模块：

```text
src/sim/galaxies.ts
src/sim/content/space.ts
```

生成顺序：

1. 在 `generateUniverse` 中完成法则、法则关系、指标、时间线和 `timelineImpact`。
2. 用 `root.fork("galaxies")` 创建局部对象生成随机流。
3. 星系数量、类型、异常密度读取 `timelineImpact.localBiases`。
4. 恒星系稳定性读取 `stellarStability`、`causalHazardLevel`、物理法则和因果法则。
5. 行星宜居性读取 `planetHabitability`、`biosphereChance`、生命法则、物理法则和局部轨道环境。
6. 生物圈读取行星环境、宇宙生命潜力、魔法强度和时间线生命偏置。
7. 阶段 5 的文明候选种子读取 `civilizationSeedChance`、文明潜力、意识法则、神性法则和行星生物圈结果。

## 3. 数据结构

局部对象结构：

```ts
type Galaxy = {
  id: string
  name: string
  type: GalaxyType
  mass: number
  metallicity: number
  magicFlux: number
  divineResidue: number
  causalHazard: number
  starSystems: StarSystem[]
  sourceEventIds: string[]
  sourceRuleIds: string[]
}

type StarSystem = {
  id: string
  name: string
  type: StarSystemType
  starClass: string
  stability: number
  luminosity: number
  anomalyLevel: number
  planets: Planet[]
  sourceEventIds: string[]
  sourceRuleIds: string[]
}

type Planet = {
  id: string
  name: string
  type: PlanetType
  orbitZone: "inner" | "habitable" | "outer"
  habitability: number
  magicSaturation: number
  atmosphere: number
  water: number
  stability: number
  biosphere?: Biosphere
  sourceEventIds: string[]
  sourceRuleIds: string[]
}

type Biosphere = {
  level: BiosphereLevel
  dominantForm: string
  complexity: number
  magicAdaptation: number
  civilizationChance: number
  civilizationSeed?: CivilizationSeed
  sourceEventIds: string[]
  sourceRuleIds: string[]
}
```

## 4. 阶段 5 前置契约

阶段 4 不生成独立 `Civilization` 实体，也不生成文明历史事件。阶段 5 可以从 `Biosphere.civilizationSeed` 读取文明开发入口。

```ts
type CivilizationSeed = {
  originPlanetId: string
  speciesType: SpeciesType
  technologyLevel: number
  magicLevel: number
  faithIntensity: number
  expansionDrive: number
  stability: number
  fate: CivilizationFate
  sourceEventIds: string[]
  sourceRuleIds: string[]
}
```

该契约满足阶段 5 开发前置：

- 能定位文明起源行星。
- 能给出物种类型、科技、魔法、信仰、扩张、稳定和命运倾向。
- 能追踪到时间线事件和结构化法则来源。
- 不提前承诺文明实体数量、文明历史事件数量或神话系统结果。

## 5. 页面浏览路径

页面在宇宙摘要后提供“局部探索”区域：

1. 用户从摘要区点击“探索星系”进入局部探索区。
2. 用户在星系列表中选择代表性星系。
3. 用户在恒星系列表中选择该星系下的恒星系。
4. 用户在行星列表中选择目标行星。
5. 页面显示行星详情、生物圈详情、阶段 5 文明入口、事件来源和法则来源。

首屏仍保持可用应用形态，不引入营销页或独立落地页。

## 6. 内容池边界

当前内容层：

```text
src/sim/content/laws.ts
src/sim/content/timeline.ts
src/sim/content/space.ts
```

阶段 4 继续把星系类型、恒星系类型、行星类型、名称素材和生命样本素材放在内容层，核心生成器只负责权重消费、确定性随机流和结构组装。

## 7. 必须保持的工程约束

- 不破坏 `seed + templateId + rulesetVersion` 的确定性复现。
- 新增生成模块不得直接使用 `Math.random()`。
- 新增数据结构必须从 `src/sim/types.ts` 导出。
- 局部对象必须能追踪到时间线事件或结构化法则来源。
- 分享链接只保证当前规则版本内复现；非当前规则短码只提示不受支持，不提供旧规则运行时兼容。
- CI 会运行 `npm run check`，阶段 4 改动必须保持测试和构建通过。

## 8. 验收覆盖

自动化测试已经覆盖：

- 每个宇宙生成不少于 12 个代表性星系。
- 每个星系包含 3 至 8 个代表性恒星系摘要。
- 每个恒星系包含 2 至 6 个代表性行星摘要。
- 行星生命结果受 `timelineImpact`、宇宙法则和局部环境共同影响。
- 每个局部对象能追踪到时间线事件和结构化法则来源。
- 同一 `seed + templateId + rulesetVersion` 的局部对象结果完全一致。
- 合格生物圈为阶段 5 保留可追踪的 `civilizationSeed`。
- 页面静态渲染包含星系、恒星系、行星详情和阶段 5 文明入口。

## 9. 明确不做

- 不生成数十亿真实天文对象。
- 不做真实 N 体引力模拟。
- 不做行星表面地图。
- 不生成独立文明实体。
- 不生成文明历史事件或神话系统。

## 10. 阶段 4 完成定义

阶段 4 视为完成，需同时满足：

- 阶段 4 文档与实现一致。
- `UniverseSummary.galaxies` 提供代表性星系、恒星系、行星和生物圈样本。
- 局部对象生成消费结构化法则、`timelineImpact` 和确定性随机流。
- 用户能从宇宙摘要进入局部探索，并逐级查看到某颗行星详情。
- 阶段 5 可从 `Biosphere.civilizationSeed` 开始生成文明。
- 自动化测试通过。
- 构建通过。
