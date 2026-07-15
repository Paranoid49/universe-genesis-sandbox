# 步骤 5：多本体宇宙沙盒

状态：已完成。首次评审的五项 P1 和两项 P2 经过三轮有限复查后全部关闭。

冻结验收来源为 [步骤 5 冻结验收口径](step-5-freeze.md)。本文件只记录实现、验证和兼容证据，不修改冻结要求、非目标或完成条件。

## 1. 用户获得的产品

玩家可以选择物质广域、奥术织网和梦流连续体三个参考宇宙，也可以在兼容约束内组合十一类宪法模块。三个参考宇宙与合法组合都通过同一个状态转换、确定性随机、因果追踪、观察、实验、分支、保存和恢复基础设施运行。

宇宙宪法决定对象本体、作用、约束、优先级、时间、拓扑、认知边界、可观察量、指标、事件分类、干预能力和宇宙边界。页面不再要求星系、生命、文明、神话或奇迹必然存在。

## 2. 核心实现

- `contracts/constitution.ts` 定义版本化宇宙宪法、十一类模块、声明式规则、执行记录、动态指标和动态干预契约。
- `constitution-validation.ts` 校验模块身份、依赖、冲突、循环、字段、指标观察路径、干预代价和宪法内容指纹。
- `constitution-domain-validation.ts` 独立校验认知公开公理、隐藏字段、拓扑初始关系以及规则评估、效果、对象和关系预算。
- `constitution-executor.ts` 统一执行条件、效果、代价、约束、优先级裁决、确定性随机和原子提交。
- `constitution-catalog.ts` 提供三个参考预设与跨预设合法组合，不通过预设 ID 分支形成专用执行流程。
- `constitution-comparison.ts` 提供独立跨宇宙宪法比较，并明确双方没有共同历史，不伪造共同祖先或首个分歧点。
- `current.ts` 是新产品主链的当前公共入口，不导出旧固定模板、旧奇迹、旧空间树或固定观察上限。
- `runtime-state-legacy.ts` 与 `useLegacyRuntimeUniverseModel.ts` 是明确隔离的旧模板兼容适配器，旧 `templateId` 不进入当前运行公共入口。
- `observation-access.ts` 按宪法提供观察方式和指标目录，指标只有取得观察信号后才显示可知结果。
- `runtime-causality.ts` 将宪法、规则条件、约束、代价、裁决、效果、随机决定和显式输入组织为可双向查询的运行因果网络。
- `runtime-topology.ts` 按宪法拓扑模块建立实际关系状态，层级、关系网络和非空间语义拓扑使用同一运行契约。
- `ConstitutionCreator.tsx` 提供预设选择、模块组合、宪法摘要、校验结果和跨宇宙宪法比较。

## 3. 协议与存储边界

- 宇宙宪法为 `ugs-constitution@2`，宪法模块为 `ugs-constitution-module@2`，规则执行器为 `ugs-rule-executor@2`。
- 宇宙状态为 `ugs-universe-state@4`，宇宙定义为 `ugs-universe-definition@3`，状态转换为 `ugs-state-transition@3`。
- 运行存档为 `ugs-runtime-archive@4`，运行因果网络为 `ugs-runtime-causality@3`。
- 分支为 `ugs-branch@4`，分支存档为 `ugs-branch-archive@4`，创世条件包为 `ugs-genesis-package@3`，历史分支包为 `ugs-history-branch-package@4`。
- 观察为 `ugs-observation@3`，研究记录、存档和浏览器存储均使用版本 3。
- 运行、分支和研究浏览器数据库分别使用 `ugs.runtime.v4`、`ugs.branches.v4` 和 `ugs.research.v3`，避免旧步骤数据被静默重新解释。
- 步骤 4 运行、分支与分享版本会被明确拒绝；旧静态 UGS070、I1 和 A1 继续只在隔离兼容视图读取。

## 4. 当前验证证据

- 模拟全量测试 193 项通过，覆盖率为 92.64%／85.11%／95.49%／96.36%。
- UI 全量测试 102 项通过，覆盖率为 90.40%／79.42%／89.47%／94.40%。
- 六组独立性能测试分别通过因果、运行、暂停、观察、分支和宪法预算。
- 四浏览器 E2E 共 91 项通过、5 项按能力跳过，覆盖三个参考预设和 360 像素纯键盘完整闭环。
- 当前 JavaScript gzip 为 123319 字节，CSS gzip 为 6492 字节，并通过 [步骤 5 JavaScript 体积预算决策](decisions/bundle-budget-step-5.md)规定的保护线。
- 最终 `npm run check:release` 已在同一份代码上完整通过。

首次评审七项问题的逐项处置证据见 [步骤 5 首次评审第一轮整改报告](reviews/step-5-frozen-review-01-remediation.md)。

独立评审关闭证据见 [首次完整评审](reviews/step-5-frozen-review-01.md)、[第一轮有限复查](reviews/step-5-frozen-review-01-recheck-01.md)、[第二轮有限复查](reviews/step-5-frozen-review-01-recheck-02.md)、[第三轮有限复查](reviews/step-5-frozen-review-01-recheck-03.md) 和 [整改报告](reviews/step-5-frozen-review-01-remediation.md)。

## 5. 非目标与后续边界

步骤 5 不实现自主实体的感知、记忆、信念、意图和行动，不生成预制生命、文明路径或终局。上述职责继续由步骤 6 冻结和实现。

步骤 5 不实现长期跨版本创作档案、结构化编年史和正式创作文件导出，上述职责继续由步骤 7 处理。
