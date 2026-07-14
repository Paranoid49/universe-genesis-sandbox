# 架构说明

状态：步骤 1 和步骤 2 已完成；步骤 2 的有效 P0、P1 已关闭，P2 均已明确处置；步骤 3 验收基线已冻结，尚未实现。

步骤 2 当前发布快照：模拟测试 126 项；模拟覆盖率 92.53%／83.8%／94.93%／96.19%；UI 测试 66 项；UI 覆盖率 89.72%／82.08%／91.37%／93.02%；独立性能测试 3 项；E2E 62 项通过、2 项跳过；JavaScript gzip 96633 字节；CSS gzip 6080 字节。
步骤 2 当前定向测试组成：步骤 2 核心契约 19 项；步骤 2 架构 3 项；步骤 2 UI 与存储 22 项；步骤 2 性能 2 项；步骤 2 四浏览器纵向闭环 8 项；合计 54 项。

本文件描述当前工作区中的实际可运行实现。目标产品边界以 [产品定义](product-definition.md) 为准，实施顺序以 [产品重构实施路线](milestones.md) 为准，旧模块去留以 [旧产品模块迁移矩阵](legacy-module-migration.md) 为准。

当前默认产品主流程只装配运行中宇宙，不再生成或消费完整旧 `UniverseSummary`。步骤 1 的静态宇宙、旧分享、旧页面和 A1 图书馆按需装配在明确标识的“旧版隔离兼容视图”中，不得成为运行状态、事件、指标或存档的事实来源。

步骤 2 运行时由独立版本的宇宙定义、`UniverseState`、逻辑时钟、状态转换、状态差异、持久对象、可恢复随机流、运行因果网络和运行存档组成。事件只从已提交差异投影，历史游标只投影过去对象，浏览器完整运行数据只经 IndexedDB 存储适配器访问。

## 1. 分层边界

```text
src/sim/contracts/causality.ts  因果图、节点、边、根、随机引用与校验问题的稳定契约
src/sim/contracts/runtime.ts    宇宙定义、运行状态、时钟、转换、差异、事件、存档与存储适配器契约
src/sim/runtime-state.ts        唯一运行事实、持久对象、状态转换与状态身份
src/sim/runtime-random.ts       可恢复随机流、内部状态、游标与精确随机决定
src/sim/runtime-events.ts       从已提交状态差异生成只读事件投影
src/sim/runtime-history.ts      不改写当前状态的历史对象投影
src/sim/runtime-causality.ts    运行转换、差异、规则、输入、随机与事件的双向因果网络
src/sim/runtime-archive.ts      版本化运行存档、校验和、拒绝错误码与恢复
src/sim/contracts/causal-comparison.ts 跨宇宙比较组合证据契约
src/sim/random.ts               确定性 PRNG、命名随机流与共享追踪快照
src/sim/causality-generation.ts 规范化显式输入清单、生成身份与输入根校验
src/sim/causal-comparison.ts     左右因果图组合证据构建与完整性校验
src/sim/causality-builder.ts    因果节点装配、主题索引、边连接与稳定公开 ID
src/sim/causality.ts            把旧领域结果投影为统一因果图
src/sim/causality-query.ts      双向查询、递归遍历、闭包校验与断言
src/sim/causality-freeze.ts     因果图、随机证据与嵌套集合的运行时冻结
src/sim/causality-projection.ts 为界面可见投影追加因果节点并重新校验、冻结
src/sim/universe.ts             兼容惰性生成与生产强制物化的双入口
src/ui/causalView.ts            单一因果查询会话、投影按需追加与宇宙归属校验
src/ui/observationCausalProjection.ts 观察摘要、几何、强度和事件关联的原因映射
src/ui/lawComparisonCausalProjection.ts 组合证据校验后的左右独立因果投影
src/ui                          页面状态、旧派生选择器和浏览器交互
src/ui/runtimeStorage.ts        IndexedDB 与内存运行存储适配器
src/ui/useRuntimeUniverseModel.ts 运行控制、历史游标、存档任务串行化与连续运行预算
src/components                  展示组件与因果查询界面
src/components/RuntimeApplication.tsx 默认运行产品壳，不依赖旧静态生成器
src/components/LegacyApplication.tsx 按需装配的步骤 1 隔离兼容查看器
src/components/causalExplorerModel.ts 因果界面的纯查询模型、路径枚举和中文标签
src/App.tsx                     页面装配入口
tests                           永久不变量、步骤契约、旧兼容、UI 与 E2E 验收
docs                            当前事实来源、迁移证据与退役登记
```

依赖方向必须保持单向：

```text
runtime contracts -> clock / random / state -> events / history / causality / archive
                                               -> runtime ui / RuntimeApplication
legacy content / recipes / contracts -> 旧领域生成器 -> legacy causality -> LegacyApplication
RuntimeApplication + LegacyApplication -> App 模式边界
```

具体约束如下：

- `src/sim/**` 不得依赖 React、`src/ui/**`、`src/components/**`、`App.tsx` 或浏览器状态。
- `src/components/**` 不得调用宇宙生成器；因果组件可以消费由上层传入的 `CausalGraph` 并调用只读查询 API。
- `src/ui/**` 不得反向依赖组件或应用装配入口。
- `src/App.tsx` 只装配页面，不实现生成规则、因果算法或存档协议。
- `src/sim/contracts/**` 只保存稳定契约，不反向依赖聚合 UI 类型。

## 2. 当前运行与兼容数据流

默认运行数据流如下：

```text
显式 Seed + 旧模板兼容预设 + 规则版本
  -> UniverseDefinition
  -> 初始 UniverseState + SimulationClock + RandomStreamState
  -> 有序 TransitionInput
  -> 规则校验 + 可恢复随机决定
  -> StateDiff 完整提交
  -> 新 UniverseState + 状态哈希 + 转换历史
  -> RuntimeEvent 只读投影
  -> RuntimeCausalNetwork 双向查询
  -> RuntimeArchiveEnvelope 完整性校验
  -> RuntimeStorageAdapter / IndexedDB
```

`UniverseState` 是新运行时唯一事实来源。规则、对象、随机流、输入日志和已提交转换均包含在不可变状态中；事件、历史对象、指标说明和界面缓存删除后可以重新投影。保存与恢复任务串行执行，运行期间进入存档任务会停止新的时间步调度，失败不会先提交内存成功状态。

连续运行每次最多自动提交 100 个确定性时间步，达到预算后自动暂停并给出可见说明。玩家可以确认后再次启动；预算只限制调度批次，不跳过转换、不合并因果记录，也不改变相同输入下的状态序列。

旧兼容生成边界仍提供两个用途不同的公共入口：

当前生成边界提供两个用途不同的公共入口：

- `generateUniverse` 是旧测试、分享解码、A1 恢复校验和其他兼容路径使用的惰性入口。它先生成旧领域字段，不主动支付因果重放成本；首次读取 `causalGraph` 时才以精确决策追踪重新运行生成流程、核对两次领域结果完全一致、构建并校验因果图。
- `generateCausalUniverse` 是当前产品装配使用的强制入口。它调用兼容入口后立即物化 `causalGraph`，因此只有通过确定性重放比对、闭包断言和运行时冻结的宇宙才会返回给主界面。

两条路径共享以下领域生成流程：

```text
seed + templateId + rulesetVersion + ordered InterventionInput[]
  -> input validation
  -> tracked root RandomStream
  -> laws / lawInteractions / metrics
  -> prebuilt timeline / timelineImpact
  -> galaxies / civilizations
  -> interventions / target mutations / miracleState
  -> explanations / observationLog / share
  -> legacy base UniverseSummary fields
  -> generateUniverse: define non-enumerable lazy causalGraph getter
  -> first causalGraph access: tracked deterministic replay
  -> exact RandomDecisionRecord snapshot
  -> assert replay fields equal initial fields
  -> build + assert + freeze CausalGraph
  -> generateCausalUniverse: force the getter before returning
```

因果图是旧领域结果的结构化只读投影，不反向修改法则、指标、事件、对象、干预、分享或存档数据。`causalGraph` 是不可配置、非枚举的只读 getter，避免 JSON、A1 和旧字段比较把整张图误当成旧存档载荷；首次物化后缓存同一实例。图及其节点、边、闭环授权、随机流、决策记录和嵌套数组均在运行时冻结，不能依赖 TypeScript 的只读声明而被外部代码修改。

上述旧生成流只在 `LegacyApplication` 中按需装配。`App.tsx`、`RuntimeApplication.tsx` 和 `RuntimePage.tsx` 均有架构门禁禁止依赖 `generateUniverse`、`generateCausalUniverse`、`useUniverseAppModel`、`UniverseSummary` 或 `timelineImpact`。

## 3. 因果契约

当前契约版本为 `ugs-causality@13`，随机结果绑定版本为 `ugs-random-bindings@5`，由以下结构组成：

- 输入根与对应干预节点保存相同的类型化输入证据，结构一致性校验与受控生成认证使用不同入口；认证写入状态只存在于 `causality.ts` 私有 `WeakSet` 中，公共成功结果及其问题数组被冻结，没有可供普通模块或测试调用的认证函数。
- 受控工厂只接收显式生成输入和首次领域结果，自行重新执行完整领域生成并核对领域 JSON、输入清单、完整随机调用转录、随机结果绑定和因果结构；只有通过全部核对的冻结图才能进入公共序列化、投影和比较流程。
- 观察与解释投影只生成冻结的非生产视图，不进入事实图认证集合，不能序列化或作为比较事实来源；查询界面可以读取其节点和边，但不得把投影陈述提升为宇宙事实。
- 基础时间线数量、最终时间线数量、星系数量和文明历史数量通过不同集合边界节点进入因果图，干预追加事件是最终时间线边界的直接原因。
- 未形成生物圈和未形成文明候选都通过明确负事实节点保留规则、状态和随机证据，并能从空间详情直接进入因果查询。
- 每个随机决定必须至少被一个因果节点精确引用，引用绑定结果主题与原始作用域；构建器在节点规格进入时独立记录期望绑定转录，最终节点引用和公开绑定表分别生成并执行三方比较。
- 随机结果使用根字段、映射键、实体 ID、集合数量或负事实谓词五类定位器；实体定位器通过统一位置注册表携带字段或集合成员容器语义和可选主题后缀，创建、解析、指纹与绑定类型共同消费该信息；受控认证针对重放领域对象解析定位器、确认实体或谓词成立，并核对规范化领域值指纹。
- 每项随机决定保存类型化操作参数，分别记录范围、整数范围、概率、候选集合或带权候选；结构校验核对内部语义，不授予认证能力的逐字段比较器再与完整生成重放产生的真实调用转录逐项比较。

- `CausalNode`：稳定 ID、领域目标 `subjectId`、中文标签、节点类型、直接原因、直接后果、规则引用和随机抽样引用。
- `CausalEdge`：原因端、结果端、关系类型、中文标签与可选规则引用。
- `CausalGraph`：契约版本、规范化生成清单、合法根列表、节点、边、完整随机追踪快照和随机结果绑定转录。
- `CausalGenerationManifest`：生成身份，以及按 Seed、规则版本、创世模板和有序干预排列的显式输入记录；每项记录绑定唯一输入根、类型、顺序、主题和值摘要。
- `CausalRootKind`：只允许 `input`、`axiom` 与 `initial_state`。
- `CausalRandomSampleRef`：随机流 ID、命名空间、作用域、一基抽样起止序号、候选标识、选中值和用途。
- `CausalRandomResultBinding`：决定 ID、结果节点、结果主题、节点类型、字段／集合数量／集合成员／负事实绑定类型、类型化领域定位器和领域值指纹。
- `CausalCycleAuthorization`：被授权强连通分量的精确节点、内部边、高阶公理和一致性约束集合。

`CausalGraphBuilder` 先使用内部领域 ID 建图，再按节点 ID 排序生成 `cause-000001` 形式的稳定公开 ID。边与双向邻接索引同步生成，并按稳定顺序输出。

当前静态兼容图创建以下事实根：

- Seed、规则版本、模板选择和每一项有序干预输入。
- 模板解析、宇宙装配、法则生成、指标派生、时间线、空间、生物圈、文明、神话、干预、解释和观察投影公理。
- `initial-state:template-configuration` 与 `initial-state:creation-origin` 两个独立 `initial_state` 根，分别表示规则集提供的创世配置和首个事件前的创世初态。

输入、宇宙公理和初始状态在契约中保持不同根类型；模板配置不能再用外部输入节点冒充，创世事件也必须显式引用创世初态。输入根必须与生成清单一一对应，额外、缺失、重排、类型错配、值错配或随机追踪生成身份不一致都会使图失效。

## 4. 覆盖与事实来源

内部因果装配器当前覆盖：

- 宇宙身份、模板、六个旧法则领域、结构化法则和法则关系。
- 七个旧兼容指标及其影响来源。
- 预制时间线事件、触发关系、事件效果和 `timelineImpact` 兼容投影。
- 星系、恒星系、行星、生物圈和文明候选种子。
- 文明、神话体系与文明历史事件。
- 显式干预输入、干预、干预状态和干预日志。
- 名称、描述、解释和旧观察日志等展示投影。

这份覆盖只证明旧基线中的可见结果已经进入统一查询模型，不代表固定领域、固定指标、预制时间线、传统空间、文明、神话或奇迹成为新产品永久本体。各旧形状的退出步骤见 [旧产品形状测试退役登记](legacy-test-retirement.md)。

解释和观察文案使用 `explanation` 与 `observation` 派生节点，不得拥有根标记，也不得作为其他世界事实的来源。名称与描述同样只是展示投影。

## 5. 随机追踪与确定性

当前随机算法版本为 `fnv1a32-mulberry32@1`。

- 根流与所有 `fork` 流共享同一追踪注册表。
- 流 ID 由 Seed 指纹、完整命名空间和同名流出现序号组成。
- `sampleCount` 表示该流已消费样本数。
- 抽样序号使用一基语义；未消费流的 `lastSampleIndex` 为 `null`。
- 每次 `next`、`range`、`int`、`bool`、`pick` 或 `weighted` 抽样都形成一条 `RandomDecisionRecord`，记录决策 ID、一基样本序号、操作类型、可选领域作用域、候选集标识、受大小约束的候选快照和实际选中值。
- `RandomTraceSnapshot` 按流 ID 排序，包含算法版本、Seed 指纹、总样本数、各流元数据和按样本序号记录的精确决策。
- 每个 `CausalRandomSampleRef` 只能绑定一条已存在的实际决策；校验器会同时核对流、命名空间、样本序号、候选集标识和选中值，不能再以整段命名空间近似代表一次选择。

完备原因相同时，旧领域字段和因果图都必须完全一致。相同可见状态允许来自不同原因，节点不得仅因标签或显示值相同而合并。

旧静态因果图中的随机追踪快照只用于解释和确定性证据，不能冒充可继续运行的随机流存档。步骤 2 已由 `runtime-random.ts` 建立独立版本的可序列化 PRNG 内部状态、命名流身份、游标和抽样序号，并通过恢复后下一次抽样及完整转换重放校验。

## 6. 查询与闭包校验

只读查询 API 包括：

- `getDirectCauses` 与 `getDirectEffects`：直接双向关系。
- `traceCausalAncestors` 与 `traceCausalDescendants`：递归可达节点。
- `validateCausalGraph`：返回稳定问题码和中文说明。
- `assertCausalGraph`：在校验失败时拒绝因果图。

当前校验器检查：

- 重复节点与重复边。
- 因果边端点不存在。
- 根类型非法、根列表不一致或根拥有原因。
- 派生节点没有原因或没有规则引用。
- 规则引用不存在或不是法则／公理节点。
- 节点双向邻接索引与边集合不一致。
- 随机流、命名空间或抽样区间无效。
- 随机决策不属于引用声明的随机流。
- 规范化显式输入清单与输入根、顺序、值或随机追踪生成身份不一致。
- 派生节点无法递归到达合法根。
- 未授权因果循环以及不满足约束的伪授权循环。

合法闭环必须由 `axiom:authorized-feedback` 高阶公理授权，并精确声明整个强连通分量的节点和内部边。授权必须完整包含“成员精确”“内部边显式”“存在外部合法根路径”和“根节点不得位于闭环内”四项一致性约束；缺失成员、边、公理、约束或外部根路径时，同时报告无效授权和非法循环。没有授权记录的循环一律拒绝。

内部因果装配器只接受同一次受控重放形成的领域结果、显式输入清单和随机追踪信封，不从公共 `src/sim` API 导出。它与 `appendCausalProjections` 都在返回前执行 `assertCausalGraph`，随后冻结结果；主产品使用 `generateCausalUniverse` 强制物化，因此无效图不能延迟到界面查询时才暴露。`generateUniverse` 的惰性行为只属于明确的旧兼容和低成本校验路径。

## 7. 因果查询界面

`AppPageId` 包含 `causality`，`PageNavigation` 提供“因果｜结果、原因与影响链路”一级入口。`useCausalViewController` 为当前宇宙维护单一因果查询会话，记录图、所属宇宙和初始节点；宇宙分享身份改变后，旧会话自动失效，不能把旧投影带入新宇宙。

`CausalExplorer` 提供：

- 结果筛选与分批加载。
- 调用方指定的初始或受控节点不存在时显示包含原目标标识的明确错误态，不得回退到其他结果。
- “为什么发生”和“产生了什么后果”两个方向。
- 直接关系、全部可达节点和完整文字路径。
- 节点、规则和随机抽样元数据。
- 方向键连续浏览、标签键盘切换和可访问名称。
- 空关系、缺失节点、路径截断与循环路径的明确文字说明。
- 从主要旧页面进入查询后返回原页面继续浏览的上下文恢复。

`causalExplorerModel.ts` 负责纯查询模型，不持有 React 状态。当前保护线为首批 80 个结果、最多渲染 24 条路径和 80 个可达节点预览；这些是渲染降级参数，不得截断底层因果图或让搜索失去对完整节点集的访问。

观察和比较页面不在常规渲染阶段批量复制因果图。玩家点击具体“查看原因”入口时，UI 才构造一个 `CausalProjectionSpec`，由 `appendCausalProjections` 在对应基础图上追加一个观察或解释节点，重新校验并冻结后进入 `CausalExplorer`。概览、时间线、文明、神话和干预页面使用领域主题定位唯一生产节点，不要求玩家搜索内部 ID；定位失败时显示明确错误。

- 二维观察分别提供当前层级摘要、节点坐标／尺寸／亮度、五类强度和事件关联的原因入口；每项投影引用实际空间对象、指标、文明、神话或时间线候选集。
- Seed 法则对比跨越两张分别拥有随机追踪快照的因果图。每个领域差异和最大差异总结都提供左值与右值两个独立入口，分别在对应宇宙图上追加投影；系统禁止把右 Seed 的证据伪装成左图节点，也不合并两张随机历史。

## 8. UI、兼容与存档边界

`UniverseSummary` 在步骤 1 仍是旧界面的兼容读取模型。非枚举、运行时冻结的 `causalGraph` 不能让它重新成为未来事实聚合中心，也不能被 A1、分享 JSON 或旧字段序列化隐式携带。

以下旧路径只在明确标识的“旧版隔离兼容视图”中保持可运行：

- Seed 与固定模板创世。
- 概览、观察台、传统空间、文明、奇迹、纪元、法则、日志和图书馆页面。
- UGS070 分享码、I1 干预载荷与 current-only 恢复。
- A1 `localStorage` 图书馆及 JSON 导入导出。

默认启动、主导航、运行控制、历史浏览和运行存档均不依赖上述路径。旧分享查询会直接进入隔离兼容视图，不会自动升级为等价运行历史；离开运行页进入兼容视图前，连续运行会暂停并释放计时器。

样式当前按六个入口拆分，并保持以下加载顺序：

```text
styles.css
styles-simulation.css
styles-causality.css
styles-features.css
styles-runtime.css
styles-responsive.css
styles-causality-responsive.css
```

响应式覆盖必须位于对应基础样式之后。步骤 1 新增的因果组件、查询模型、因果编排文件和两份因果样式必须纳入文件规模门禁。

## 9. 前端运行时基线

当前受控前端基线为 `react@18.3.1`、`react-dom@18.3.1`、`@types/react@18.3.31` 和 `@types/react-dom@18.3.7`。当前代码只使用 React 18 已提供的 `createRoot`、Hooks、`useId`、类错误边界和静态服务端渲染 API；选择该基线用于满足当前总体积门禁，不表示永久拒绝 React 19。

出现以下任一条件时必须重新评估 React 19，并将结论、构建体积和完整门禁结果写入当前文档：

- 新产品步骤确实需要 React 19 独有能力，或关键依赖不再支持 React 18。
- React 18 出现无法通过受支持补丁解决的安全、浏览器兼容或维护问题。
- React 19 构建经过真实优化后能够显著释放当前 110 KiB 日常保护线余量，或者经正式架构决策再次调整总体积预算模型。
- 每个新产品步骤开始前执行依赖基线复核，最迟不得晚于步骤 2 发布评审。

不得仅替换运行时而保留另一主版本的类型定义或锁文件；四个 React 包、`package-lock.json`、类型检查、UI 测试、E2E 和体积证据必须一起更新。

## 10. 测试组织

```text
tests/step-1-causality.test.ts       步骤 1 因果契约、覆盖、确定性与负向校验
tests/step-2-runtime.test.ts         步骤 2 状态、时钟、随机恢复、事件、历史、存档与运行因果契约
tests/step-2-architecture.test.ts    步骤 2 主流程隔离、墙上时间与旧链路依赖门禁
tests/causality-factory-guards.test.ts 生产工厂随机调用与绑定转录守卫
tests/ui/causal-explorer.test.tsx    因果组件、路径、键盘与 axe
tests/ui/causal-projection-integration.test.tsx 观察与 Seed 对比投影、按点击追加和左右独立查询
tests/ui/app-interaction.test.tsx    真实应用入口与旧基线 UI 兼容
tests/ui/runtime-page.test.tsx       运行控制、历史游标、资源预算、存档与运行因果界面
tests/ui/runtime-storage.test.tsx    运行存储原子性、并发检查点与 IndexedDB 适配器
tests/e2e/app.spec.ts                真实浏览器因果闭环与发布级兼容
tests/performance/runtime.performance.ts 步骤 2 单步、一百步、快照与恢复预算
tests/performance/runtime-pause.performance.ts 步骤 2 各运行速度暂停调度预算
tests/phase-1.test.ts ... phase-8    旧基线兼容，按退役登记逐步退出
tests/architecture.test.ts           依赖方向、浏览器边界与文件规模
tests/helpers.ts                     旧兼容断言与共享测试工具
```

测试的权威分类、逐条退役步骤和替代契约见 [旧产品形状测试退役登记](legacy-test-retirement.md)。任何固定事件、纪元、法则、指标、对象、文明、奇迹、叠层、页面或存档数量都不得被解释为新产品永久要求。

步骤 1 的非覆盖率性能门禁在两次预热后测量十二个多模板样本，因果图首次强制物化和双向查询的 P50 与 P90 均须小于 1500 毫秒，覆盖率环境代表性场景预算为 3000 毫秒。字段值建模为经过认证、点击时追加的 `state_value` 公式投影：目标节点直接引用公式版本、逐项操作数和精确随机决定证据，复制或删改投影规格会被认证边界拒绝。五类领域加权选择保留完整候选顺序、权重、资格条件和精确选中值。路径与神话统计通过字段值、分组成员和分组节点证明去重结果，高风险统计通过独立谓词、字段值及逐成员纳入／排除判定证明筛选结果；深层校验拒绝错值、错组、重复成员、阈值改写、纳入反转和来源断开。受保护页面使用统一结果契约声明主题、原始值指纹和追因策略，AST 与 UI 门禁拒绝裸派生文本、漏登值和主题值错配。生产与 UI 测试通过统一别名使用 Preact React-compat，兼容边界与回退条件见 `docs/decisions/ui-runtime-size-step-1.md`。

## 11. 后续步骤不得跨越的边界

- 步骤 2：`UniverseState` 成为运行事实来源，事件由状态差异产生，随机流可继续恢复。
- 步骤 3：观察消费信号和认知边界，不直接平铺完整事实。
- 步骤 4：实验与宇宙内干预分离，不可变分支和历史身份进入因果模型。
- 步骤 5：宇宙宪法和规则包取代固定模板、领域、指标、空间与奇迹。
- 步骤 6：自主实体通过感知、记忆、意图和行动形成历史。
- 步骤 7：完整状态、因果网络、分支、观察记录和创作档案使用正式版本化存储与导出。

质量门禁以 [quality-gates.md](quality-gates.md) 为准，性能、兼容性、无障碍与可靠性以 [non-functional-requirements.md](non-functional-requirements.md) 为准。
