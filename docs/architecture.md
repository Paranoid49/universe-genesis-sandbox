# 架构说明

这份文档描述 Universe Genesis Sandbox 当前实现的模块边界、数据流和后续扩展约束。阶段规格说明“要做什么”，本文件说明“代码应该如何组织”。

## 1. 分层边界

当前代码按以下边界组织：

```text
src/sim        确定性生成核心，只接收显式输入和命名随机流
src/sim/content 生成素材池，保存法则、时间线、空间对象和文明素材
src/ui         页面标签、派生选择器和页面 view-model
src/components 展示组件，只消费已生成数据和回调
src/App.tsx    页面装配入口，不承载生成规则
tests          阶段级自动化验收
docs           阶段规格、架构约束和仓库说明
```

依赖方向必须保持单向：

```text
content -> sim -> ui -> components -> App
```

`sim` 不得依赖 `ui`、`components` 或浏览器 API。`components` 不得直接调用生成器；需要的宇宙数据由 `src/ui/useUniverseAppModel.ts` 或上层容器传入。

## 2. 生成数据流

宇宙生成入口是 `generateUniverse`，当前主流程为：

```text
seed + templateId + rulesetVersion
  -> root RandomStream
  -> laws
  -> lawInteractions
  -> metrics
  -> timeline
  -> timelineImpact
  -> galaxies
  -> civilizations
  -> explanations / observationLog / share
  -> UniverseSummary
```

后续阶段新增生成能力时，应优先作为显式输入或新阶段输出接入这条流水线，不应让后置模块反向修改前置结果。

## 3. 确定性约束

- 所有影响生成结果的输入必须显式进入 `seed + templateId + rulesetVersion` 或后续阶段定义的显式输入边界。
- `src/sim/**` 不得直接使用 `Math.random()`、系统时间、浏览器状态或网络状态。
- 新生成模块必须使用 `RandomStream.fork("稳定命名空间")` 创建局部随机流。
- 生成规则、权重、素材池或字段语义变化时，必须同步评估 `RULESET_VERSION`、`RULESET_SHORT_CODE`、测试基线和阶段文档。
- 单纯 UI、测试或文档调整不得改变 `UniverseSummary` 的确定性输出。

## 4. UI 容器边界

`src/ui/useUniverseAppModel.ts` 是页面 view-model 层，负责：

- 管理 seed、模板、页面、筛选和选择状态。
- 调用 `generateUniverse` 和只读派生选择器。
- 处理分享复制等浏览器交互。
- 向 `App.tsx` 和组件提供稳定的页面数据与回调。

`App.tsx` 只负责页面结构装配。新增页面时，应优先新增展示组件和必要的 view-model 状态，不要把新业务状态直接堆回 `App.tsx`。

## 5. 生成器扩展规则

当前 `timeline`、`galaxies`、`civilizations` 生成器仍承担较多权重公式。后续阶段继续扩展时，应逐步拆出 recipe/profile 层：

```text
content/*       静态素材和可枚举配置
recipes/*       权重公式、阈值和路径决策表
generators/*    消费上下文、随机流和 recipe，组装结构化结果
```

拆分时必须满足：

- 行为保持不变的纯重构，应先用现有测试确认输出未变。
- 会改变生成结果的拆分，必须按规则版本变更处理。
- 公式命名应表达领域含义，例如 `civilizationPathWeight`，不要只用 `score1`、`bias2`。
- 生成器函数只负责流程编排、来源追踪和结构组装，不应继续扩散大段硬编码权重。

## 6. 测试组织

测试按阶段拆分：

```text
tests/phase-1.test.ts  seed、分享、规则门禁和基础完整性
tests/phase-2.test.ts  法则、指标和法则对比
tests/phase-3.test.ts  时间线、纪元和后续影响
tests/phase-4.test.ts  星系、恒星系、行星和生命样本
tests/phase-5.test.ts  文明、神话和阶段 6 禁区
tests/helpers.ts       共享测试常量和断言
```

新增阶段应新增独立测试文件，不要把所有验收继续堆入单个聚合测试。
