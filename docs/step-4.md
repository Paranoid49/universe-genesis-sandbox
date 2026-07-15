# 步骤 4：可分支的宇宙实验室

状态：已完成。第二轮有限复查关闭全部剩余 P1 与 P2。

冻结验收来源为 [步骤 4 冻结验收口径](step-4-freeze.md)。本文件只记录实现和证据，不修改冻结要求、非目标或完成条件。

## 1. 用户获得的产品

玩家可以从当前状态或已发生历史时刻创建界外实验分支，也可以在当前活动分支提交宇宙内干预。父分支保持不可变，所有新输入进入有序历史；玩家可以切换分支、比较共同祖先后的状态与因果差异、保存分支，并分别分享创世条件包和可继续历史分支包。

新主导航增加“实验”和“历史分支”。旧固定奇迹、清空干预、单一分享码和独立 Seed 静态对比继续只存在于明确隔离的旧版兼容视图，不再进入新运行事实来源。

## 2. 实现与边界

- `contracts/branching.ts` 与 `contracts/branch-persistence.ts` 分离分支运行契约和存档、分享、存储契约，当前版本分别为 `ugs-branch@2`、`ugs-branch-archive@2` 与 `ugs-history-branch-package@2`。
- `branching.ts`、`branch-validation.ts`、`branch-replay.ts` 和 `branch-inputs.ts` 实现根分支、检查点根分支、任意有效逻辑时刻分叉、可信重放、父分支不可变、谱系认证和稳定输入结果。
- `branch-comparison.ts` 与 `branch-comparison-evidence.ts` 比较共同祖先、首个不同输入、状态与转换差异、实际规则、输入、因果节点、因果路径和仍然相同部分；跨宇宙内容明确拒绝冒充分支比较。
- `branch-archive.ts` 和 `branch-packages.ts` 对分支、运行检查点、随机流、历史及分享包执行完整性校验和明确拒绝。
- `branchStorage.ts` 与 `branchIndexedDb.ts` 使用 `ugs-branch-storage@2` IndexedDB 适配器，分支记录和活动分支指针在同一事务提交；不可用、阻塞、读取失败、事务中止和二十条容量上限均保持旧值。
- `useBranchLaboratory.ts` 只承担流程协调，集合加载、操作串行化、分享解析、检查点转换和运行状态激活已拆分；页面成功状态只在底层操作成功后提交。
- `ExperimentPage.tsx` 和 `BranchesPage.tsx` 提供界外实验、宇宙内干预、分类型分享、正式分支身份、共同祖先比较和保存入口。
- 观察访问使用正式 `branchId` 作为运行历史身份；步骤 3 根研究记录只有在可信状态重算完全匹配时才能迁移，分支切换后研究记录不会跨分支拼接。

## 3. 保持的兼容边界

- 步骤 1 因果闭包、步骤 2 状态转换和可恢复随机流、步骤 3 认知边界继续保持。
- `ugs-ruleset@0.7.0` 的旧领域结果和步骤 2 无分支状态序列不变。
- 旧 UGS070、I1、A1、`MiraclePanel` 和旧 Seed 对比只在 `LegacyApplication` 中读取，不自动升级为正式分支。
- 步骤 4 不实现动态规则包、分支合并、多人协作、自主实体或静态创作档案。

## 4. 验证证据

- `tests/step-4-branching.test.ts` 覆盖分叉、权限、确定性重放、比较、状态收敛、分享和研究身份迁移。
- `tests/step-4-validation.test.ts` 覆盖身份、哈希、检查点、输入、重放、存档、包类型和跨宇宙拒绝路径。
- `tests/step-4-architecture.test.ts` 禁止旧奇迹、旧分享、旧 Seed 对比和旧聚合模型进入新分支主流程。
- `tests/ui/branch-laboratory.test.tsx` 与 `branch-storage.test.tsx` 覆盖页面、axe、导入、错误、容量、IndexedDB 和事务旧值保持。
- `tests/performance/branching.performance.ts` 以十二个样本验证分支创建、百步重放、比较、保存和恢复预算。
- `tests/e2e/app.spec.ts` 在 Chromium、Firefox、WebKit 和移动 Chromium 验证创建、实验、干预、比较、保存、刷新、恢复、继续以及研究记录分支隔离。

完整 `npm run check:release` 已通过：模拟测试 165 项，覆盖率为 92.47%／84.79%／95.12%／96.07%；UI 测试 98 项，覆盖率为 89.82%／80.09%／88.69%／93.70%；独立性能测试 5 项；E2E 87 项通过、5 项按能力跳过；JavaScript gzip 112627 字节，CSS gzip 6326 字节。

当前模拟核心内容哈希为 `e6aa11c0471dfa89726c58bde2979b12514284f153e2b215dd7e67c7d8666cbc`。首次独立评审发现的问题已完成根因整改和完整门禁，有限复查关闭前本步骤不得标记完成。

## 5. 完成状态

第一轮有限复查关闭六项问题，将 P1-03 降为 P2，并保留 P1-07。第二轮整改让共同历史范围与谱系分叉边界严格一致，并在 360 像素纯键盘四浏览器场景中覆盖创建、切换、比较、保存、刷新恢复、两类分享和首次继续。第二轮有限复查确认 P1-07 与降级后的 P2 均已关闭，限定范围内没有新的 P0、P1 或 P2 直接回归。

评审证据见 `reviews/step-4-frozen-review-01.md`、`reviews/step-4-frozen-review-01-remediation.md`、`reviews/step-4-frozen-review-01-recheck-01.md` 与 `reviews/step-4-frozen-review-01-recheck-02.md`。

步骤 4 已满足冻结完成条件，可以开始整理步骤 5 冻结验收基线；在步骤 5 基线冻结前不得实现多本体规则包。
