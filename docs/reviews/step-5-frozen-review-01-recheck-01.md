# 步骤 5 首次独立评审第一轮有限复查报告喵

## 一、范围与结论喵

本次复查严格以 `docs/step-5-freeze.md`、`docs/reviews/step-5-frozen-review-01.md` 和 `docs/reviews/step-5-frozen-review-01-remediation.md` 为依据，只核验 P1-01 至 P1-05、P2-01、P2-02、本轮修改及其直接回归喵。

本次没有重新开放整个步骤 5，没有评价步骤 6 或步骤 7，也没有增加冻结基线之外的新要求喵。

复查结论为六项关闭、一项 P1 未关闭，当前仍不能关闭步骤 5 首次评审喵。

| 首次问题 | 复查结论 | 当前严重等级 | 简要理由 |
| --- | --- | --- | --- |
| P1-01 | 关闭喵 | 无喵 | 宪法拓扑已经形成版本化运行关系状态，并进入观察、状态身份、存档和恢复路径喵 |
| P1-02 | 未关闭喵 | P1 喵 | `publicAxiomIds` 为空时，规则追踪观察仍会公开实际执行规则 ID，认知边界仍可被绕过喵 |
| P1-03 | 关闭喵 | 无喵 | 四类预算完成正安全整数校验，初始状态和转换入口执行预算守卫，效果预算失败不消费随机流或提交记录喵 |
| P1-04 | 关闭喵 | 无喵 | 实验和干预支持显式对象与能力，合法大于二十的宪法范围可提交，页面使用动态目标和范围喵 |
| P1-05 | 关闭喵 | 无喵 | 随机节点只连接保存该随机决定 ID 的具体规则执行所属规则喵 |
| P2-01 | 关闭喵 | 无喵 | 对象标签使用本体中文名称，未知类型回退为受控中文占位喵 |
| P2-02 | 关闭喵 | 无喵 | 四份当前事实文档与本次同树构建均记录 JavaScript 123301 字节和 CSS 6492 字节喵 |

## 二、逐项复查喵

### P1-01：关闭喵

- 涉及位置为 `src/sim/contracts/runtime.ts:68` 至 `src/sim/contracts/runtime.ts:78`、`src/sim/runtime-topology.ts:5` 至 `src/sim/runtime-topology.ts:24`、`src/sim/runtime-state.ts:56`、`src/sim/observation-access.ts:19` 和 `tests/step-5-runtime.test.ts:68` 至 `tests/step-5-runtime.test.ts:70` 喵。
- 当前实现把拓扑模式、关系类型和实际关系记录写入 `UniverseState.topology`，初始状态从宪法拓扑模块和对象实例确定性构建关系，状态身份、冻结、存档与恢复均携带该结构喵。
- 咪亲自执行运行探针，三个参考预设分别得到 `hierarchical`、`relational`、`semantic` 模式，并形成“包含／邻接”“共鸣／传导／抑制”“相似／隐喻／反照”的运行关系记录喵。
- 定向测试证明三个参考预设的运行关系非空，观察访问读取运行关系数量与名称，多对象夹具还证明关系端点绑定实际对象而不是创世摘要喵。
- 判断依据为冻结基线 2.3 和 2.6 要求关系与拓扑进入通用状态并能在产品界面实际观察，原问题所述“只有摘要、状态仍是孤立对象表”的触发路径已经不存在喵。

### P1-02：未关闭喵

- 当前严重等级仍为 P1 喵。
- 涉及位置为 `src/sim/constitution-domain-validation.ts:40`、`src/sim/constitution-domain-validation.ts:80` 至 `src/sim/constitution-domain-validation.ts:85`、`src/sim/observation-access.ts:28` 和 `src/sim/observation.ts:90` 至 `src/sim/observation.ts:94` 喵。
- 可执行触发路径为基于物质预设创建一个合法认知模块，把 `publicAxiomIds` 设为空并保持 `hiddenAttributeIds` 为空，同时继续使用物质预设已经声明的 `rule-trace` 观察方式，随后创建宇宙、推进一步并执行规律追踪喵。
- 咪使用 Vite SSR 运行夹具亲自复现，宪法成功创建，`createObservationAccess(state).publicAxioms` 返回空数组，但同一访问端口的 `rule-trace` 观察结果仍返回 `rule.material-condensation@1` 喵。
- 根因是宪法校验只验证公开公理引用存在，并只对具有 `field` 的观察方式检查隐藏字段冲突，而 `rule-trace` 直接输出 `transition.ruleIds`，没有按认知模块的 `publicAxiomIds` 过滤喵。
- 实际影响为合规宪法无法隐藏未公开规则，玩家可以通过动态观察绕过认知声明读取内部规则身份，整改报告所述“观察访问端口只公开宪法明确允许的规则”尚未成立喵。
- 判断依据为冻结基线 2.3 要求认知模块定义可见性和知识边界，2.4 要求观察不得绕过步骤 3 认知边界，必要威胁模型明确列出认知边界泄漏，且这正是首次评审 P1-02 的原始关闭范围喵。
- 原关闭条件不变，即规则追踪只能公开 `publicAxiomIds` 允许的实际规则，或者宪法校验必须拒绝无法满足该边界的观察组合，并补充 `publicAxiomIds` 为空和仅公开部分规则时的运行回归测试喵。

### P1-03：关闭喵

- 涉及位置为 `src/sim/contracts/constitution.ts:166` 至 `src/sim/contracts/constitution.ts:172`、`src/sim/constitution-domain-validation.ts:57` 至 `src/sim/constitution-domain-validation.ts:65`、`src/sim/constitution-executor.ts:31` 至 `src/sim/constitution-executor.ts:37` 和 `src/sim/runtime-state.ts:42` 至 `src/sim/runtime-state.ts:57` 喵。
- 当前实现为边界模块增加 `maximumRelations`，并对规则评估、效果、对象和关系预算执行正安全整数校验及初始规模校验喵。
- 规则执行器在任何随机抽样前保守计算规则评估数和最大效果数，初始状态校验对象与关系规模，转换返回前再次校验对象规模喵。
- 咪亲自构造只允许两个规则效果的合法紧预算宪法，再附加一个界外实验输入，转换稳定返回 `EFFECT_BUDGET`，原状态随机样本数仍为 0，输入日志和转换数仍为 0，状态身份保持不变喵。
- 定向宪法测试同时证明 `Infinity`、零值预算和初始规模超限会被稳定拒绝喵。
- 判断依据为冻结基线 2.2 的有界执行和原问题要求的预算失败原子性，原触发路径已经关闭喵。

### P1-04：关闭喵

- 涉及位置为 `src/sim/branch-inputs.ts:14` 至 `src/sim/branch-inputs.ts:22`、`src/sim/branch-inputs.ts:25` 至 `src/sim/branch-inputs.ts:48`、`src/components/pages/ExperimentPage.tsx:35` 至 `src/components/pages/ExperimentPage.tsx:53`、`tests/step-5-runtime.test.ts:78` 至 `tests/step-5-runtime.test.ts:93` 和 `tests/ui/experiment-page.test.tsx:8` 至 `tests/ui/experiment-page.test.tsx:38` 喵。
- `createExperimentInput` 和 `createInterventionInput` 已支持显式 `objectId`，干预还支持显式 `capabilityId`，公共输入路径不再存在固定正负二十校验喵。
- 干预输入和转换重算均按当前宪法能力的目标类型、字段、最小值、最大值和代价校验，页面提供实验对象、干预对象和能力选择，数值范围来自属性边界或能力声明喵。
- 定向运行测试以两个对象和正负三十能力提交 `25`，证明只有所选第二对象发生变化，UI 测试证明所选对象、能力和动态数值被传给控制器喵。
- 判断依据为冻结基线 2.4、2.5、C8 和 C9，首次评审中的固定范围与首对象绑定均已消除喵。

### P1-05：关闭喵

- 涉及位置为 `src/sim/runtime-causality.ts:161` 至 `src/sim/runtime-causality.ts:178` 和 `tests/step-5-runtime.test.ts:96` 至 `tests/step-5-runtime.test.ts:112` 喵。
- 当前实现从 `transition.ruleExecutions` 查找实际保存随机决定 ID 的执行记录，随机节点只把该执行所属规则作为规则原因，并只连接对应执行节点喵。
- 定向测试在同一转换中运行两条都消费随机且写入不同字段的规则，逐个检查每个随机节点的规则原因，结果均只有其所属执行的唯一规则喵。
- 判断依据为冻结基线 2.2、2.7 和原问题的准确双向归因要求，整条转换全部规则被错误连接的触发路径已经不存在喵。

### P2-01：关闭喵

- 涉及位置为 `src/sim/observation-access.ts:20`、`src/components/pages/ExperimentPage.tsx:65` 至 `src/components/pages/ExperimentPage.tsx:67` 和 `tests/step-5-runtime.test.ts:71` 至 `tests/step-5-runtime.test.ts:72` 喵。
- 当前观察与实验标签均从本体模块按对象 `kind` 查找中文名称，不再直接展示内部类型 ID 喵。
- 咪亲自构造未知类型访问探针，标签稳定返回“未知对象类型｜runtime.object.01”，没有回退泄露 `internal-secret-kind` 喵。
- 三参考预设定向测试同时证明奥术对象显示“奥术结点”且不包含 `arcane-knot` 喵。
- 判断依据为冻结基线 2.5 的动态中文标签和未知类型受控回退要求，原问题已经关闭喵。

### P2-02：关闭喵

- 涉及位置为 `docs/step-5.md:44`、`docs/quality-gates.md:11`、`docs/non-functional-requirements.md:14` 和 `docs/legacy-module-migration.md:223` 喵。
- 四份当前事实文档均记录 JavaScript gzip 123301 字节和 CSS gzip 6492 字节喵。
- 咪在当前工作树重新执行生产构建和 `npm run check:bundle`，实测结果仍为 JavaScript 123301 字节和 CSS 6492 字节，两个保护线检查均通过喵。
- 判断依据为冻结基线 C16 的门禁证据可审计性，首次评审所述同树快照漂移已经消除喵。

## 三、本轮修改直接回归喵

除 P1-02 的原问题残余外，咪没有在本轮限定修改范围内发现具有现实触发路径、直接违反步骤 5 冻结基线的新 P0、P1 或 P2 回归喵。

协议版本升级后的步骤 4 分支与校验定向测试通过，证明本轮状态、因果、分支、存档和分享协议升级没有在已覆盖的直接路径中静默重解释旧语义喵。

步骤 6、步骤 7、旧产品开放式缺陷和冻结范围外设计均未纳入本次结论喵。

## 四、亲自执行的验证证据喵

- `npm run typecheck` 退出码为 0 喵。
- `npm run lint` 退出码为 0 喵。
- 步骤 5 宪法、步骤 5 运行、步骤 4 分支和步骤 4 校验四个定向测试文件共 40 项通过喵。
- 动态实验页、宪法创世页和观察工作台三个 UI 定向测试文件共 10 项通过喵。
- 生产构建和体积门禁通过，JavaScript gzip 为 123301 字节，CSS gzip 为 6492 字节喵。
- 咪执行了三个不落盘的 Vite SSR 运行探针，分别核验三预设运行拓扑、未知对象中文回退、预算失败原子性以及 P1-02 规则追踪泄漏，探针均在命令结束前关闭 Vite 服务喵。
- 本轮没有把整改报告中的完整 `npm run check:release` 结果冒充为咪亲自重跑结果，完整门禁结果只作为整改背景，本次结论使用上述定向验证喵。

## 五、清理与进程确认喵

咪已删除本轮生成的 `coverage`、`dist`、`playwright-report` 和 `test-results`，并确认这些路径均不存在喵。

咪已确认端口 4173 和 5173 均无监听，本轮启动的 Vite SSR 实例和 Node 探针均已结束，没有项目开发服务器或测试进程残留喵。

当前仍存在的工作区 Node 进程仅为 Codex 自身的执行内核，不是本轮启动的项目服务，咪没有终止宿主进程喵。

用户手动启动开发服务器的命令如下喵。

```text
npm run dev
```

用户手动停止开发服务器的方式为在启动该命令的同一终端按 `Ctrl + C` 喵。

## 六、最终意见喵

P1-01、P1-03、P1-04、P1-05、P2-01 和 P2-02 可以关闭，P1-02 仍为有效 P1 阻塞项喵。

在 P1-02 按原冻结认知边界关闭条件修复并由全新独立 Agent 进行下一轮有限复查前，本轮不允许宣告步骤 5 首次评审关闭喵。
