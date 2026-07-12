# 贡献指南

这份文档说明如何在 Universe Genesis Sandbox 中进行开发。项目进度以阶段文档和里程碑文档为准；README 只作为稳定项目入口；贡献指南只描述长期有效的开发约定。

## 开发前先读

开始动手前，请先确认本次变更对应的阶段和规格：

- [docs/milestones.md](docs/milestones.md)：长期路线图与阶段边界。
- [docs/phase-0.md](docs/phase-0.md)：产品边界、非目标、确定性原则。
- [docs/phase-1.md](docs/phase-1.md)：第一版可复现宇宙卡片的实现规格。
- [docs/phase-2.md](docs/phase-2.md)：结构化法则、法则关系和指标影响来源。
- [docs/phase-3.md](docs/phase-3.md)：纪元时间线、事件因果和时间线影响摘要。
- [docs/phase-4.md](docs/phase-4.md)：星系、恒星、行星、生命样本、局部探索路径和阶段 5 前置契约。
- [docs/phase-5.md](docs/phase-5.md)：文明实体、文明路径、神话系统、文明历史和阶段 6 禁区。
- [docs/phase-6.md](docs/phase-6.md)：造物主干预、结构化奇迹、干预日志、反噬状态和阶段 7 禁区。
- [docs/architecture.md](docs/architecture.md)：模块边界、依赖方向、生成数据流和测试组织。

如果你的变更会改变产品范围、数据契约、阶段门禁或用户路径，应先更新对应文档，再改代码。

## 本地开发

安装依赖：

```text
npm install
```

启动开发服务器：

```text
npm run dev
```

在启动它的可见终端中按 `Ctrl + C` 可关闭开发服务器。

运行检查：

```text
npm test
npm run build
```

提交前建议运行：

```text
npm run check
```

## 目录约定

```text
src/sim/random      seed、PRNG、命名随机流
src/sim/templates   宇宙模板与模板短码
src/sim/laws        结构化宇宙法则生成
src/sim/metrics     宇宙指标生成
src/sim/timeline    纪元事件生成
src/sim/galaxies    星系、恒星系、行星和生物圈样本生成
src/sim/civilizations 文明、神话系统和文明历史生成
src/sim/content     法则、时间线、空间对象和后续阶段的内容素材池
src/ui              页面标签、选择器和派生视图数据
src/components      可复用展示组件
src/sim/names       名称、摘要和描述生成
src/sim/share       分享码与链接参数恢复
src/sim/universe    UniverseSummary 总生成入口
src/App.tsx         第一版网页应用界面
tests/              自动化验收测试
docs/               阶段规格与项目文档
```

## 确定性规则

确定性是本项目的核心工程约束。

- 同一 `seed + rulesetVersion + templateId` 必须生成同一宇宙。
- 模拟核心不得直接使用 `Math.random()`。
- 所有模拟随机值必须来自确定性 PRNG。
- 新模块应使用稳定的命名随机流。
- 会影响生成结果的规则、权重、名称池、事件池或解释池变更，必须更新 `rulesetVersion`。
- 分享码或分享链接必须能恢复 `seed`、`templateId` 和当前 `rulesetVersion`。
- 当前应用只保证同一当前规则版本内复现，非当前规则短码只提示不受支持，不提供旧规则运行时兼容。

## 数据与内容规则

- 法则、指标、事件和解释必须保持结构化，不要只写成叙述文本。
- 新增字段应有清晰名称、含义和使用位置。
- 生成内容不能只是随机拼词，重要结果应能解释来源。
- 分享体验应保持轻量：用户可见文案优先简短，完整复现信息由分享码或链接参数承载。
- 新增内容池优先放入 `src/sim/content/`，核心生成器只保留算法、权重消费和结构组装。
- 阶段 4 局部对象生成应消费 `UniverseSummary.timelineImpact`，不要从页面文案反推生成倾向。
- 阶段 5 文明生成应从 `Biosphere.civilizationSeed` 或明确的生命行星来源派生，不要脱离阶段 4 局部对象凭空生成。
- 阶段 6 干预必须来自显式 `InterventionInput[]`，不要读取浏览器时间、本地存储或任何不可复现输入。
- 阶段 6 只能输出结构化干预数据，不要提前实现阶段 7 的可视化观察台。

## 测试要求

涉及生成逻辑时，至少检查：

- 固定 seed 的复现性。
- 不同 seed 的差异性。
- 模板生成结果非空。
- 事件数量和事件覆盖范围。
- 分享码或链接参数能恢复复现信息。
- `src/sim/**` 中没有直接使用 `Math.random()`。
- 生成规则内容哈希门禁保持通过；如果本次变更会影响生成结果，应同步更新 `RULESET_VERSION`、`RULESET_SHORT_CODE`、相关文档和测试基线。

如果新增阶段验收要求，请把测试补到 `tests/` 中。

## 合并请求检查清单

- 变更对应的阶段和文档已经明确。
- 代码、测试、文档三者保持一致。
- 涉及生成逻辑时，已检查固定 seed 行为。
- 没有引入无关重构。
- 没有提交密钥、构建产物、依赖目录或本地编辑器文件。
- 已运行 `npm run check`，或在说明中解释为什么没有运行。
