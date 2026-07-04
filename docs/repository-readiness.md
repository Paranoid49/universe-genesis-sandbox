# 仓库就绪检查

日期：2026-07-04  
状态：已准备进入阶段 1

## 1. GitHub 仓库健康度

| 检查项 | 状态 | 证据 |
| --- | --- | --- |
| Git 仓库已初始化 | 通过 | 本地仓库已有提交历史，并配置了 `origin`。 |
| 远端仓库已配置 | 通过 | `origin` 指向 GitHub 仓库。 |
| 本次审计前工作树干净 | 通过 | 整改前 `master` 与 `origin/master` 对齐。 |
| README 已存在 | 通过 | [README.md](../README.md) 说明了项目定位、当前阶段和下一步。 |
| `.gitignore` 已存在 | 通过 | [.gitignore](../.gitignore) 覆盖依赖目录、构建产物、本地环境、日志、系统文件和编辑器文件。 |
| 开源协议明确 | 通过 | [LICENSE.md](../LICENSE.md) 使用 MIT 协议。 |
| 贡献指南已存在 | 通过 | [CONTRIBUTING.md](../CONTRIBUTING.md) 定义阶段纪律和确定性规则。 |
| 安全策略已存在 | 通过 | [SECURITY.md](../SECURITY.md) 定义报告方式和当前安全约束。 |
| 议题模板已存在 | 通过 | `.github/ISSUE_TEMPLATE` 下已有缺陷、功能和阶段任务模板。 |
| 合并请求模板已存在 | 通过 | `.github/pull_request_template.md` 包含阶段与确定性检查项。 |

## 2. 阶段 0 完成检查

| 要求 | 状态 | 证据 |
| --- | --- | --- |
| 项目愿景 | 通过 | [docs/phase-0.md](phase-0.md) 第 2、3 节。 |
| 核心玩法 | 通过 | [docs/phase-0.md](phase-0.md) 第 2、7 节。 |
| seed 确定性原则 | 通过 | [docs/phase-0.md](phase-0.md) 第 5.1 节。 |
| 宇宙法则分类 | 通过 | [docs/phase-0.md](phase-0.md) 第 9 节。 |
| 最小可用版本范围 | 通过 | [docs/phase-0.md](phase-0.md) 第 6 节。 |
| 明确非目标 | 通过 | [docs/phase-0.md](phase-0.md) 第 4、6.3 节。 |
| 第一版页面结构 | 通过 | [docs/phase-0.md](phase-0.md) 第 8 节。 |
| 初始宇宙模板 | 通过 | [docs/phase-0.md](phase-0.md) 第 10 节。 |
| 核心数据模型草案 | 通过 | [docs/phase-0.md](phase-0.md) 第 11 节。 |
| 版本与兼容策略 | 通过 | [docs/phase-0.md](phase-0.md) 第 14 节。 |
| 阶段 1 验收门槛 | 通过 | [docs/phase-0.md](phase-0.md) 第 15 节。 |
| 阶段 1 开工门禁 | 通过 | [docs/phase-0.md](phase-0.md) 第 18 节。 |

## 3. 阶段 1 就绪判断

阶段 1 可以开始。当前仓库已有足够约束，可以降低范围漂移风险：

- 第一版用户路径已经定义。
- 第一版页面区域已经定义。
- 确定性生成不变量已经明确。
- `rulesetVersion`、`seed` 和 `templateId` 是内部复现所需的必备信息。
- 分享体验已约束为轻量文案，完整复现信息由分享码或链接参数承载。
- 第一批 10 个宇宙模板已经命名。
- 最小可用版本的时间线规模限制为 8 至 12 条关键事件。
- 阶段 1 已有明确验收证据要求，覆盖确定性、字段完整性、固定 seed 样本和 50 seed 冒烟检查。
- 阶段 2 及之后的能力已明确不进入第一轮实现。

## 4. 剩余负责人决策

这些不是阶段 1 开工阻塞项，但建议在更公开协作前解决：

- 决定是否把默认分支从 `master` 改为 `main`。
- 决定是否启用 GitHub 讨论区、项目看板或版本发布功能。
- 在 Vite、React、TypeScript 应用骨架创建后补充 CI。

## 5. 建议的阶段 1 进入顺序

1. 创建 Vite、React、TypeScript 应用骨架。
2. 添加格式化、lint 和测试命令。
3. 实现 seed 标准化与 `rulesetVersion`。
4. 实现确定性 PRNG 与命名随机流。
5. 添加固定 seed 复现性测试。
6. 实现核心类型与初始宇宙模板。
7. 生成宇宙摘要、法则、指标和关键时间线事件。
