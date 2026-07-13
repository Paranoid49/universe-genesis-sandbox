# 贡献指南

这份文档说明如何在 Universe Genesis Sandbox 中进行开发。产品范围以产品定义为准，实施顺序以产品重构路线为准，README 只作为稳定项目入口，贡献指南只描述长期有效的开发约定。

## 开发前先读

开始动手前，请先确认本次变更对应的当前事实来源：

- [docs/README.md](docs/README.md)：当前文档导航与事实来源优先级。
- [docs/product-definition.md](docs/product-definition.md)：产品范围、核心体验与产品原则。
- [docs/milestones.md](docs/milestones.md)：产品重构步骤、可运行产物与完成标准。
- [docs/architecture.md](docs/architecture.md)：模块边界、依赖方向、生成数据流和测试组织。
- [docs/quality-gates.md](docs/quality-gates.md)：自动化测试、覆盖率和发布门禁。
- [docs/non-functional-requirements.md](docs/non-functional-requirements.md)：性能、兼容性、可靠性和无障碍要求。

旧阶段规格和历史评审统一位于 [docs/archive](docs/archive/README.md)，只用于理解已有实现，不作为新开发依据。

如果变更会改变产品范围、数据契约、实施步骤、质量门禁或用户路径，应先更新对应的当前文档，再改代码。

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
src/sim/contracts   稳定跨模块数据契约
src/sim/recipes     权重公式、阈值和路径决策
src/ui              页面标签、选择器和派生视图数据
src/components      可复用展示组件
src/sim/names       名称、摘要和描述生成
src/sim/share       分享码与链接参数恢复
src/sim/universe    UniverseSummary 总生成入口
src/App.tsx         第一版网页应用界面
tests/              自动化验收测试
docs/               当前事实来源与历史文档归档
```

## 确定性规则

确定性是本项目的核心工程约束。

- 同一 `seed + rulesetVersion + templateId` 必须生成同一宇宙。
- 模拟核心不得直接使用 `Math.random()`。
- 所有模拟随机值必须来自确定性 PRNG。
- 新模块应使用稳定的命名随机流。
- 会影响生成结果的规则、权重、名称池、事件池或解释池变更，必须更新 `rulesetVersion`。
- 分享码或分享链接必须能恢复 `seed`、`templateId` 和当前 `rulesetVersion`。
- `GenerateUniverseInput` 必须显式传入 `rulesetVersion`，缺失或不匹配时不得生成。
- 当前应用只保证同一当前规则版本内复现，非当前规则短码只提示不受支持，不提供旧规则运行时兼容。

## 数据与内容规则

- 法则、指标、事件和解释必须保持结构化，不要只写成叙述文本。
- 新增字段应有清晰名称、含义和使用位置。
- 生成内容不能只是随机拼词，重要结果应能解释来源。
- 分享体验应保持轻量：用户可见文案优先简短，完整复现信息由分享码或链接参数承载。
- 新增内容池优先放入 `src/sim/content/`，核心生成器只保留算法、权重消费和结构组装。
- 当前局部对象生成应消费 `UniverseSummary.timelineImpact`，不要从页面文案反推生成倾向。
- 当前文明生成应从 `Biosphere.civilizationSeed` 或明确的生命行星来源派生，不要脱离局部对象凭空生成。
- 当前干预必须来自显式 `InterventionInput[]`，不要读取浏览器时间、本地存储或任何不可复现输入。
- 当前局部奇迹必须产生真实目标字段变化和 `TargetMutation`，不能只生成叙述日志。
- 干预分享格式必须携带版本号，损坏载荷必须警告并回退。
- 当前可视化只能通过 `src/ui` 只读投影消费结构化数据，不得把视图状态写回模拟核心。
- 当前实现只有 `archiveStorage.ts` 可以访问本地存储，存档恢复必须通过版本化分享码重新生成宇宙。

## 测试要求

涉及生成逻辑时，至少检查：

- 固定 seed 的复现性。
- 不同 seed 的差异性。
- 模板生成结果非空。
- 事件数量和事件覆盖范围。
- 分享码或链接参数能恢复复现信息。
- `src/sim/**` 中没有直接使用 `Math.random()`。
- 生成规则内容哈希门禁保持通过；如果本次变更会影响生成结果，应同步更新 `RULESET_VERSION`、`RULESET_SHORT_CODE`、相关文档和测试基线。
- ESLint、架构依赖、覆盖率、组件交互、键盘、无障碍和构建体积门禁保持通过。
- 发布候选还必须按文档在可见终端手动启动预览服务并运行 `npm run test:e2e`，测试后立即停止服务。

完整门禁与阈值见 [docs/quality-gates.md](docs/quality-gates.md)，非功能要求见 [docs/non-functional-requirements.md](docs/non-functional-requirements.md)。

如果新增实施步骤的验收要求，请把测试补到 `tests/` 中。

## 合并请求检查清单

- 变更对应的实施步骤和当前文档已经明确。
- 代码、测试、文档三者保持一致。
- 涉及生成逻辑时，已检查固定 seed 行为。
- 没有引入无关重构。
- 没有提交密钥、构建产物、依赖目录或本地编辑器文件。
- 已运行 `npm run check`，或在说明中解释为什么没有运行。
