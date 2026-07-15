# 步骤 6 首次独立评审第二轮有限复查报告

复查日期：2026-07-15 喵。

复查身份：未参与步骤 6 实现、首次评审或第一轮复查的全新独立复查 Agent 喵。

唯一冻结验收基线：`docs/step-6-freeze.md` 喵。

复查范围仅包括第一轮仍未关闭的 P1-04 与 P1-05、第二轮修改、这些修改可能造成的直接回归，以及整改报告列明的兼容 UI `title` 清理和运行存档性能调整喵。

本轮没有重新开放已经关闭的 P1-01、P1-02、P1-03、P1-06 与 P2-01，没有评价步骤 7，也没有增加冻结基线之外的要求喵。

## 1. 有限复查结论

P1-04 已满足原关闭条件，可以关闭，等级维持原 P1 作为历史记录喵。

P1-05 的直接“状态变化”下钻泄漏已经修复，但递归路径仍可通过“自主行动 → 状态转换 → 状态事件”读取精确底层属性前后值，因此未满足原关闭条件，维持 P1 并继续阻塞步骤 6 完成喵。

本轮没有发现需要独立立项的新 P0、P1 或 P2 直接回归，新增发现属于 P1-05 原问题和原关闭条件覆盖的同一递归观察泄漏根因喵。

当前关闭统计为 1／2，仍有 1 项有效 P1，冻结 C16 仍不成立喵。

## 2. 逐项复查

### P1-04 分支状态哈希与状态比较没有覆盖自主状态

- 处置：关闭，等级维持原 P1 作为历史记录喵。
- 现实触发复查：克隆有效潮生状态并只修改主体名称与一条私有记忆摘要后，`branchStateHash` 发生变化，`compareBranchObjects` 分别产生 `autonomy.entity.name` 与 `autonomy.entity.memories`，不再只返回集合级 `autonomy.entity.state` 占位喵。
- 实现证据：`src/sim/branch-validation.ts:13-15` 将完整 `autonomy` 纳入状态哈希；`src/sim/branch-comparison-evidence.ts:68-93` 对实体顶层字段逐项比较，并只公开“左分支记录／右分支记录”，不会把私有记忆、信念或意图内容写入公开比较值喵。
- 页面证据：`src/components/pages/BranchesPage.tsx:35-39` 展示具体差异字段；`tests/ui/branch-laboratory.test.tsx:70-90` 验证页面显示 `autonomy.entity.memories` 和左右记录差异且不显示私有内容喵。
- 历史身份证据：`src/sim/runtime-state.ts:136-146` 将自主转换内容纳入转换 ID，`src/sim/branch-validation.ts:8-10` 将已提交转换 ID 纳入历史哈希，因此当前认知相同但自主历史不同的分支不会收敛为同一历史身份喵。
- 实际影响复查：玩家现在能够区分名称、生命周期状态、记忆、信念、最后意图和最后行动等具体自主语义类别，同时不会从比较页面读取私有认知正文喵。
- 判断依据：冻结 C10 与接口边界要求状态哈希、历史哈希和分支比较覆盖自主行动与认知历史；第一轮复查的原关闭条件要求仅自主认知不同的分支显示具体差异并保持历史身份差异喵。
- 验证证据：步骤 4 分支、步骤 6 自主和步骤 6 架构测试共 66 项通过，其中 `tests/step-6-autonomy.test.ts:118-128` 直接覆盖状态哈希、名称差异、记忆差异和私有内容不泄漏喵。

### P1-05 行动因果页面可递归读取私有认知和底层真相

- 处置：未关闭，维持 P1 喵。
- 已完成整改：`src/components/pages/AutonomousEntitiesPage.tsx:39-52` 已把感知、记忆、信念、意图、规则、裁决、输入、随机和直接状态差异投影为稳定受限标签；点击“状态变化”后只显示“已产生状态变化”，不再直接显示该差异节点的精确前后值喵。
- 仍可复现路径：创建潮生宇宙并推进两步，进入任一主体的“查看行动因果”，点击“状态转换”，再点击“历时变化、活性变化、交流变化”等状态事件，页面会显示形如 `attributes.*：数字 → 数字` 的精确底层属性差异喵。
- 涉及位置：`src/sim/runtime-causality-build.ts:147-165` 将自主行动连接到状态差异并把行动纳入转换原因，`src/sim/runtime-causality-build.ts:205-210` 使状态转换成为可继续下钻的节点，`src/sim/runtime-causality-build.ts:47-52` 又把运行事件连接为转换后果喵。
- 泄漏来源：`src/sim/runtime-events.ts:15-18` 把字段名与精确 `before → after` 写入状态事件描述，而 `src/components/pages/AutonomousEntitiesPage.tsx:50-52` 只脱敏 `difference` 和若干内部认知节点，没有脱敏 `event` 描述喵。
- 实际影响：玩家不需要取得对应观察方法或观察授权，就能绕过已修复的直接差异节点，沿同一行动因果网络的另一条递归路径读取宇宙底层属性名和精确值喵。
- 判断依据：冻结 C11、第 2.7 节和“界面泄漏”威胁模型要求玩家只能看到观察权限允许的行为证据，不得通过因果描述读取宇宙底层真相；第一轮复查的原关闭条件明确要求递归遍历全部行动因果节点时不出现底层真相喵。
- 现有测试缺口：`tests/ui/autonomous-entities-page.test.tsx:57-63` 只下钻直接“状态变化”节点并拒绝 `数字 → 数字`，没有继续经过“状态转换”进入事件节点喵。
- 亲自验证：咪建立一次性 UI 反向测试，按上述真实按钮路径完成三层下钻并确认页面包含状态事件的精确差异描述；反向测试通过后已立即删除，未留在工作区喵。
- 原问题关闭条件仍未满足：必须对自主行动因果可达的全部节点执行统一的观察授权投影，或者限制该页面只能遍历经过公开投影的因果子图，并补充递归遍历测试证明任何路径都不出现私有认知、内部标识、执行枚举或底层真相，同时保留授权公开证据的双向查询和实体上下文喵。

## 3. 第二轮修改与直接回归核验

### 分支比较实现与页面

实体顶层字段比较能够产生稳定、具体且不泄漏正文的类别，状态哈希和历史哈希边界保持成立，P1-04 可以关闭喵。

步骤 4、步骤 6 和分支页面定向测试均通过，未发现该修改引入的独立直接回归喵。

### 自主因果公开投影

直接差异节点、规则节点和私有认知节点的脱敏已生效，但事件节点没有纳入统一公开投影，P1-05 仍未关闭喵。

该结论不新增标准，只复现了原问题明确要求覆盖的递归因果路径喵。

### 运行存档解析与恢复性能调整

`src/sim/runtime-archive.ts:47-80` 在完整校验后直接返回带恢复状态的已解析信封，不再重复调用 `createRuntimeArchive`，同时仍保留 JSON、版本、校验和、身份、状态指纹、历史范围和语义校验喵。

步骤 2 运行存档 19 项测试、运行存储 UI 7 项测试和步骤 6 自主性能测试均通过，序列化往返、完整性拒绝、保存恢复等价性与性能预算没有发现直接回归喵。

### 兼容 UI 的 `title` 清理

删除与可见按钮文字重复的 `title` 后，可见文字和既有 `aria-label` 继续提供可访问名称喵。

自主页面与分支页面 UI 17 项、兼容应用交互 37 项和现有 axe 定向检查通过，未发现交互或可访问名称直接回归喵。

### 构建体积

生产构建与体积保护线通过，JavaScript gzip 为 127981 字节，CSS gzip 为 6492 字节，保护线未修改喵。

## 4. 亲自执行的验证

```text
npx vitest run tests/step-4-branching.test.ts tests/step-6-autonomy.test.ts tests/step-6-architecture.test.ts
```

结果：3 个测试文件、66 项测试全部通过喵。

```text
npx vitest run --config vitest.ui.config.ts tests/ui/autonomous-entities-page.test.tsx tests/ui/branch-laboratory.test.tsx
```

结果：2 个测试文件、17 项测试全部通过喵。

```text
npx vitest run tests/step-2-runtime.test.ts
npx vitest run --config vitest.ui.config.ts tests/ui/runtime-storage.test.tsx
```

结果：步骤 2 运行测试 19 项与运行存储 UI 测试 7 项全部通过喵。

```text
npx vitest run --config vitest.ui.config.ts tests/ui/app-interaction.test.tsx
```

结果：兼容应用交互 37 项全部通过喵。

```text
npm run typecheck
npm run lint
```

结果：TypeScript 类型检查与 ESLint 均通过喵。

```text
npm run build
npm run check:bundle
```

结果：生产构建成功，JavaScript gzip 127981 字节、CSS gzip 6492 字节，体积保护线通过喵。

```text
npx vitest run --config vitest.performance.config.ts tests/performance/autonomy.performance.ts
```

结果：三十二主体百步演化、行动批次和存档恢复性能测试 1 项通过，冻结 P50、P90 与恢复预算断言全部满足喵。

```text
npx vitest run tests/phase-1.test.ts
```

结果：阶段 1 哈希门禁 12 项全部通过，当前模拟核心内容哈希基线仍为 `ba2f3b893d1e88274ee1c97888b0a181c26d58aac6ccb20d81be429b6aea6aea` 喵。

本轮按复查边界没有重复完整 `npm run check:release`，整改报告已记录第二轮完整发布门禁退出 0，本轮新增定向验证足以覆盖限定修改及其直接回归喵。

## 5. 资源清理与后续边界

一次性 P1-05 反向测试文件已经删除，未保留临时测试代码喵。

`coverage`、`dist`、`playwright-report` 与 `test-results` 均已删除，4173 与 5173 监听数量为 0，命令行指向当前项目的 Node 进程数量为 0 喵。

下一轮整改与复查只能继续处理 P1-05 尚未满足的递归因果公开投影关闭条件、本轮相应修改及其直接回归，不得重新开放已关闭问题或提高冻结标准喵。

手动启动命令为 `npm run dev`，停止方式是在同一终端按 `Ctrl + C` 喵。
