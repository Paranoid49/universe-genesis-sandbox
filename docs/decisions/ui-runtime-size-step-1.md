# 步骤 1 用户界面运行时体积决策

决策日期：2026-07-14

状态：生效

## 背景

第九轮整改要求把概览、空间、时间线、法则、日志、文明和奇迹页面的可见结果全部接入就地追因，并在返回时保留筛选、分页、选中对象、焦点和滚动位置。完成纵向闭环后，原 React 生产包超过 110 KiB JavaScript gzip 扩展保护线约 1.3 KiB。

这些新增能力直接关闭步骤 1 的 P1 与 P2 问题，不能通过删除入口、缩减因果证据或提高体积保护线规避。当前界面只使用 React 的函数组件、Hooks、事件和错误边界兼容能力，不依赖服务端渲染、React Server Components、并发服务端协议或 React 专有渲染器。

## 决策

- 生产构建和界面测试使用 Preact React-compat 作为用户界面运行时。
- 应用源码继续使用 React 兼容 API，别名统一定义在 `ui-runtime.config.ts`，由 Vite 和 UI Vitest 配置共同消费。
- UI 测试使用 `@testing-library/preact`，不得在生产构建与测试中形成两套不同的组件运行语义。
- React 类型包继续提供现有源码的类型契约；React 与 React DOM 包只作为开发工具兼容依赖，不得进入生产构建产物。
- JavaScript gzip 保护线继续保持 110 KiB，硬上限继续保持 115 KiB，不因运行时迁移而放宽。

## 兼容边界

当前允许使用的兼容表面包括函数组件、基础 Hooks、上下文、合成事件类型、错误边界、`react/jsx-runtime` 和 `react-dom/client` 的浏览器挂载入口。

以下能力不在本决策保证范围内：

- React Server Components 与服务端动作。
- React DOM 服务端渲染和流式注水协议。
- 依赖 React 私有内部字段、Fiber 结构或 React 专属调度细节的第三方组件。
- 未经真实浏览器验证的并发渲染时序假设。

新增界面依赖前必须确认其能够在 Preact React-compat 下运行，并通过 TypeScript、UI 单元测试、axe 与四类真实浏览器 E2E。

## 验证要求

- `ui-runtime.config.ts` 必须同时被 `vite.config.ts` 与 `vitest.ui.config.ts` 引用。
- 生产构建中不得包含独立 React 与 Preact 双运行时。
- UI 测试必须覆盖页面状态保留、事件委托、焦点恢复、错误边界和键盘交互。
- 完整 `npm run check:release` 必须在 Chromium、Firefox、WebKit 和移动端 Chromium 中通过。
- `npm run check:bundle` 必须统计全部 JavaScript 资产的 gzip 总和，不允许通过拆包隐藏总体积。

## 回退条件

出现以下任一情况时，必须重新评估并可回退到 React 运行时：

- 新产品必需能力无法在兼容层中正确实现，并且存在可复现的语义差异。
- 必需第三方组件明确依赖 Preact 无法兼容的 React 行为。
- 真实浏览器或无障碍门禁出现无法通过局部整改关闭的运行时缺陷。
- 后续步骤拆除旧界面后，React 生产包能够重新满足体积保护线，且迁回收益高于兼容层维护成本。

回退不得通过降低测试覆盖、放宽因果闭包、移除用户能力或直接提高体积预算完成。

## 结果

本决策只改变界面运行时装配，不改变模拟规则、因果契约、存档格式、分享格式或产品事实。当前最终体积和完整门禁数字以最新整改报告中的发布快照为准。
