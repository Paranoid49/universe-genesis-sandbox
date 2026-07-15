# 贡献指南

这份文档说明如何在 Universe Genesis Sandbox 中进行开发。产品范围以产品定义为准，实施顺序以产品重构路线为准，README 只作为稳定项目入口；贡献指南既描述长期有效的工程原则，也明确标注仍在兼容期的旧基线约束及其退出责任。

## 开发前先读

开始动手前，请先确认本次变更对应的当前事实来源：

- [docs/README.md](docs/README.md)：当前文档导航与事实来源优先级。
- [docs/product-definition.md](docs/product-definition.md)：产品范围、核心体验与产品原则。
- [docs/milestones.md](docs/milestones.md)：产品重构步骤、可运行产物与完成标准。
- [docs/legacy-module-migration.md](docs/legacy-module-migration.md)：旧模块的保留、增强、降级、替换和删除要求。
- [docs/step-1.md](docs/step-1.md)：当前步骤的因果契约、兼容边界和验收标准。
- [docs/step-2-freeze.md](docs/step-2-freeze.md)：步骤 2 已冻结的运行时需求、非目标、完成条件、兼容边界和质量要求。
- [docs/step-3-freeze.md](docs/step-3-freeze.md)：步骤 3 已冻结的观察、研究、主流程隔离和质量要求。
- [docs/step-3.md](docs/step-3.md)：步骤 3 当前实现、验证证据与待关闭事项。
- [docs/step-4-freeze.md](docs/step-4-freeze.md)：步骤 4 已冻结的分支、实验、比较、存储和分享要求。
- [docs/step-4.md](docs/step-4.md)：步骤 4 当前实现、验证证据、兼容边界和评审状态。
- [docs/step-5-freeze.md](docs/step-5-freeze.md)：步骤 5 已冻结的宇宙宪法、统一规则执行、动态观察、动态干预和质量要求。
- [docs/step-5.md](docs/step-5.md)：步骤 5 当前实现、协议版本、整改证据和评审状态。
- [docs/step-6-freeze.md](docs/step-6-freeze.md)：步骤 6 已冻结的自主实体、生命过程、认知、行动、叙述分层和质量要求。
- [docs/step-6.md](docs/step-6.md)：步骤 6 的实际协议、数据流、兼容边界和验证证据。
- [docs/architecture.md](docs/architecture.md)：模块边界、依赖方向、生成数据流和测试组织。
- [docs/quality-gates.md](docs/quality-gates.md)：自动化测试、覆盖率和发布门禁。
- [docs/non-functional-requirements.md](docs/non-functional-requirements.md)：性能、兼容性、可靠性和无障碍要求。

旧阶段规格和历史评审统一位于 [docs/archive](docs/archive/README.md)，只用于理解已有实现，不作为新开发依据。

如果变更会改变产品范围、旧模块去留、数据契约、实施步骤、质量门禁或用户路径，应先更新对应的当前文档，再改代码。

`CONTRIBUTING.md` 本身也受 [旧产品模块迁移矩阵](docs/legacy-module-migration.md) 约束。步骤 2 至步骤 7 替换 current-only 分享、`timelineImpact`、文明种子、固定奇迹、I1 或 A1 等旧能力时，必须在同一步骤同步删除或改写本文中的旧基线规则，不能让已经退役的约束继续指导新实现。

当前步骤 1 至步骤 6 已完成，步骤 6 首次独立评审问题经过三轮有限复查全部关闭；不得提前实现步骤 7 创作导出。

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

提交前必须运行发布级检查：

```text
npm run check:release
```

## 目录约定

```text
src/sim/random      Seed、PRNG、命名随机流与精确决策追踪
src/sim/causality*  因果装配、查询、投影、校验与运行时冻结
src/sim/causal-comparison 跨宇宙比较组合证据与左右图完整性校验
src/sim/runtime-*  步骤 2 状态、时钟、随机恢复、差异事件、历史、运行因果和存档
src/sim/constitution-* 步骤 5 宇宙宪法目录、校验、执行、投影与跨宇宙比较
src/sim/autonomy* 步骤 6 主体形成、有限认知、意图、行动、关系、叙述与完整性校验
src/sim/contracts/autonomy* 步骤 6 自主运行协议与宪法策略声明
src/sim/runtime-topology 步骤 5 宪法驱动的运行关系状态
src/sim/templates   旧基线宇宙模板与短码，只在隔离兼容路径使用
src/sim/laws        旧固定领域法则兼容实现，只在隔离兼容路径使用
src/sim/metrics     旧固定指标兼容实现，只在隔离兼容视图使用
src/sim/timeline    旧预制纪元事件兼容实现，只在隔离兼容视图使用；运行历史由 `runtime-events.ts` 产生
src/sim/galaxies    旧传统空间样本兼容实现；当前运行主流程使用宪法驱动的对象与拓扑关系
src/sim/civilizations 旧文明、神话与预制历史兼容实现，步骤 6 由自主实体替换
src/sim/content     旧基线展示素材池，不得继续作为新运行时的事实或历史来源
src/sim/contracts   稳定跨模块数据契约
src/sim/recipes     旧阈值、权重和路径决策，步骤 2、5、6 迁入状态转换或规则包
src/ui              页面标签、选择器和派生视图数据
src/ui/runtimeStorage 版本化 IndexedDB 运行存储适配器
src/ui/useRuntimeUniverseModel 运行控制、历史游标、任务串行化与连续运行预算
src/components      可复用展示组件
src/sim/names       名称、摘要和描述生成
src/sim/share       旧基线分享码、发布内容与链接参数恢复
src/sim/universe    旧兼容懒物化入口与步骤 1 强制因果入口，不得被默认运行产品壳调用
src/components/RuntimeApplication 默认运行产品壳
src/components/LegacyApplication  按需加载的步骤 1 隔离兼容视图
src/App.tsx         运行产品与旧版兼容视图的模式边界
tests/              自动化验收测试
docs/               当前事实来源与历史文档归档
```

## 确定性规则

确定性是本项目的核心工程约束。

- 同一完整显式输入，包括 Seed、规则版本、模板和有序干预输入，必须生成完全相同的旧领域结果与因果图。
- 模拟核心不得直接使用 `Math.random()`。
- 所有模拟随机值必须来自确定性 PRNG。
- 新模块应使用稳定的命名随机流。
- 步骤 2 运行时必须保存随机算法版本、流身份、内部状态、游标、抽样序号和精确决定；恢复后的下一抽样必须与未中断路径一致。
- 会影响生成结果的规则、权重、名称池、事件池或解释池变更，必须更新 `rulesetVersion`。
- 当前旧基线分享码或分享链接必须能恢复 Seed、模板、当前规则版本和有序旧干预输入；该兼容格式由步骤 4、7 替换，不能被扩展为新产品的共同身份。
- `GenerateUniverseInput` 必须显式传入 `rulesetVersion`，缺失或不匹配时不得生成。
- current-only 恢复只是旧基线兼容策略，由步骤 4、7 替换；未知版本在新产品中只能受控迁移、明确拒绝或作为静态只读快照打开，禁止按当前规则重生成并冒充原宇宙。

## 数据与内容规则

- 法则、指标、事件和解释必须保持结构化，不要只写成叙述文本。
- 新增字段应有清晰名称、含义和使用位置。
- 生成内容不能只是随机拼词，重要结果应能解释来源。
- 分享发布与分享接收恢复必须分开设计。发布侧明确内容属于创世条件、历史分支还是静态创作档案，接收侧独立执行类型识别、版本校验、迁移、拒绝或只读打开，并保留文件与手动复制回退。
- 旧基线展示素材可以继续放入 `src/sim/content/`，但新产品事实必须由规则包、状态转换和显式因果输入产生；禁止通过扩充预制事件、文明或奇迹素材池制造新历史。
- 以下约束只保护“旧版隔离兼容视图”，不是当前运行架构：旧局部对象消费 `UniverseSummary.timelineImpact`，旧文明从 `Biosphere.civilizationSeed` 派生，固定奇迹使用 `InterventionInput[]`、`TargetMutation` 与 I1，A1 通过 `archiveStorage.ts` 和版本化分享码恢复。上述能力不得从 `LegacyApplication` 回流到默认运行产品；其剩余责任由步骤 4、5、6、7 按迁移矩阵继续关闭。
- 纯观察投影必须保持只读；如果某个宇宙规定观察本身会产生作用，该观察必须作为显式因果输入进入历史，不能借由界面状态暗中修改模拟结果。

## 测试要求

涉及生成逻辑时，至少检查：

- 固定 seed 的复现性。
- 相同完整输入的领域结果、因果图、随机追踪和有序输入复现性。
- 所有非根结果的规则引用、直接原因、合法根可达性和双向邻接一致性。
- 分享发布前与存档写入前的生产因果校验，以及旧分享接收恢复的显式错误结果。
- `src/sim/**` 中没有直接使用 `Math.random()`。
- 模拟核心内容哈希门禁必须保持通过；领域结果变化时同步更新 `RULESET_VERSION` 与 `RULESET_SHORT_CODE`，仅因果证据契约变化时同步更新 `CAUSAL_GRAPH_VERSION`，两类变化都必须更新相关文档和哈希基线。
- 运行时语义变化必须评估并更新宇宙定义、状态、时钟、随机、转换、因果或存档中的对应独立版本，不能只修改旧规则版本或哈希基线。
- ESLint、架构依赖、覆盖率、组件交互、键盘、无障碍和构建体积门禁保持通过。
- 发布候选必须运行 `npm run check:release`；该命令在未提供 `E2E_BASE_URL` 时自管预览服务并在测试结束后退出。需要手动调试真实浏览器时，按质量门禁文档在可见终端启动预览服务，完成后立即按 `Ctrl + C` 停止。
- 固定模板、事件、纪元、空间对象、文明和奇迹数量只属于登记过的旧基线测试，不得作为新步骤的永久门禁；退出时间以 [旧产品形状测试退役登记](docs/legacy-test-retirement.md) 为准。

完整门禁与阈值见 [docs/quality-gates.md](docs/quality-gates.md)，非功能要求见 [docs/non-functional-requirements.md](docs/non-functional-requirements.md)。

如果新增实施步骤的验收要求，请把测试补到 `tests/` 中。

## 合并请求检查清单

- 变更对应的实施步骤和当前文档已经明确。
- 代码、测试、文档三者保持一致。
- 涉及生成逻辑时，已检查固定 seed 行为。
- 没有引入无关重构。
- 没有提交密钥、构建产物、依赖目录或本地编辑器文件。
- 已运行 `npm run check`，或在说明中解释为什么没有运行。
