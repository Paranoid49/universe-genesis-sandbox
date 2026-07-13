# 架构说明

状态：当前旧基线架构说明。

本文件描述当前可运行实现，不代表新产品的目标架构。后续迁移必须遵守 [产品重构实施路线](milestones.md) 与 [旧产品模块迁移矩阵](legacy-module-migration.md)，每个步骤完成前必须把本文件更新为实际实现；被矩阵标记为替换或删除的旧边界不得继续作为未来扩展要求。

这份文档描述 Universe Genesis Sandbox 当前实现的模块边界、数据流和后续扩展约束。阶段规格说明“要做什么”，本文件说明“代码应该如何组织”。

## 1. 分层边界

当前代码按以下边界组织：

```text
src/sim        确定性生成核心，只接收显式输入和命名随机流
src/sim/content 生成素材池，保存法则、时间线、空间对象和文明素材
src/sim/contracts 跨模块稳定数据契约
src/sim/recipes 权重公式、阈值和路径决策
src/ui         页面标签、派生选择器和页面 view-model
src/components 展示组件，只消费已生成数据和回调
src/components/pages 页面级展示组件，避免装配入口承载大段页面结构
src/App.tsx    页面装配入口，不承载生成规则
tests          阶段级自动化验收
docs           阶段规格、架构约束和仓库说明
```

依赖方向必须保持单向：

```text
content / contracts / recipes -> sim 编排 -> ui -> components -> App
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
  -> intervention domain mutations / miracleState / interventionLog
  -> explanations / observationLog / share
  -> UniverseSummary
```

在步骤 2 启动前，本流水线仍是旧基线的事实说明。步骤 2 必须由 `UniverseState`、模拟时钟和状态转换运行时替换该流水线，后续能力不得继续以扩展一次性 `UniverseSummary` 为默认方案。

## 3. 确定性约束

- 所有影响生成结果的输入必须显式进入 `seed + templateId + rulesetVersion` 或后续阶段定义的显式输入边界，`GenerateUniverseInput.rulesetVersion` 为必填字段且必须与当前运行时匹配。
- `src/sim/**` 不得直接使用 `Math.random()`、系统时间、浏览器状态或网络状态。
- 新生成模块必须使用 `RandomStream.fork("稳定命名空间")` 创建局部随机流。
- 生成规则、权重、素材池或字段语义变化时，必须同步评估 `RULESET_VERSION`、`RULESET_SHORT_CODE`、测试基线和阶段文档。
- 单纯 UI、测试或文档调整不得改变 `UniverseSummary` 的确定性输出。
- 阶段 6 之后，干预后的宇宙复现边界为 `seed + templateId + rulesetVersion + InterventionInput[]`。
- 分享码和链接必须携带版本化干预载荷，当前载荷版本为 `I1`。
- 运行时输入必须经过 `validation.ts` 校验，无效输入不得静默回退。

## 4. UI 容器边界

`src/ui/useUniverseAppModel.ts` 是页面 view-model 层，负责：

- 管理 seed、模板、页面、筛选和选择状态。
- 调用 `generateUniverse` 和只读派生选择器。
- 处理分享复制等浏览器交互。
- 向 `App.tsx` 和组件提供稳定的页面数据与回调。

浏览器分享、初始分享恢复、客户端 Seed 和奇迹目标选择已经拆为独立 UI 模块，页面模型不得重新吸收这些职责。

`App.tsx` 只负责页面结构装配。新增页面时，应优先新增展示组件和必要的 view-model 状态，不要把新业务状态直接堆回 `App.tsx`。

空间对象和文明选择状态由 `useUniverseSelection.ts` 独立管理；`useUniverseAppModel.ts` 不再直接维护各层级选择算法。

阶段 6 的干预状态属于 view-model 显式状态。页面可以构造 `InterventionInput[]` 并传入生成入口，但不得在模拟核心中读取浏览器状态。

阶段 7 的 `observationProjection.ts` 是只读 UI 投影层。它只能把 `UniverseSummary` 转换为稳定二维坐标、叠层强度和文字摘要；`ObservationConsole` 负责层级、叠层、节点与时间位置等瞬时视图状态。两者都不得修改模拟对象或反向进入生成流水线。

阶段 8 的 `archive.ts` 定义 A1 纯契约、校验和不可变集合操作，`archiveStorage.ts` 是唯一访问 `localStorage` 的模块，`useUniverseArchive.ts` 负责持久化成功后再提交内存状态。已持久化数据在启动时执行结构校验，外部导入按批次让出浏览器主线程并完整验证可恢复性。存档只保存分享码和用户元数据，恢复由 `useUniverseAppModel.ts` 解码分享码后重新进入生成器。

基础事件、纪元和指标类型位于 `contracts/foundations.ts`，干预契约只依赖基础契约，禁止 `contracts` 反向导入聚合 `types.ts`。

样式按基础布局、模拟浏览、观察台/图书馆功能和最终响应式覆盖拆分为四个入口文件；响应式文件必须最后加载，每个文件都受架构行数门禁约束。

## 5. 生成器扩展规则

当前时间线影响摘要和文明权重公式已经拆出，`galaxies` 仍承担部分空间权重公式。后续阶段继续扩展时，应保持以下分层：

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
tests/phase-5.test.ts  文明和神话
tests/phase-6.test.ts  造物主干预、奇迹复现和阶段 7 禁区
tests/phase-7.test.ts  观察投影确定性、三级层级、叠层和只读边界
tests/phase-8.test.ts  A1 存档、搜索排序、导入导出、容量和恢复契约
tests/helpers.ts       共享测试常量和断言
tests/architecture.test.ts 架构依赖和文件规模门禁
tests/ui/*.test.tsx    浏览器交互、键盘和无障碍验收
```

新产品步骤应新增独立纵向验收测试，并按照迁移矩阵迁移或退役旧阶段形状测试，不要把所有验收继续堆入单个聚合测试。

## 7. 干预领域边界

阶段 6 干预是创世后覆盖层，但覆盖层必须真实修改目标领域对象，不得只写描述日志。

- `bless_planet` 和 `seed_life` 修改目标行星及生物圈。
- `stabilize_star` 修改目标恒星系及所属行星的局部稳定度。
- 文明类奇迹修改目标文明或神话系统，不重新编号阶段 5 已有对象。
- 每项字段变化通过对象前后状态递归比较自动记录为 `TargetMutation`，包括对子行星、神话、命运和路径的附带修改，同时保留稳定奇迹事件和干预日志。
- 概率变化表示干预后的未来倾向，不反向重写阶段 0 至阶段 5 的历史事件。

## 8. 质量和非功能边界

质量门禁以 [quality-gates.md](quality-gates.md) 为准，性能、兼容性、无障碍和错误处理以 [non-functional-requirements.md](non-functional-requirements.md) 为准。
