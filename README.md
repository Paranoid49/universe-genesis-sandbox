# Universe Genesis Sandbox

一个 seed 驱动的宇宙创世沙盒。

用户播下一组初始法则，系统基于确定性随机过程生成一个自洽宇宙。这个宇宙可以接近现实物理，也可以包含魔法、神明、灵魂、奇迹、轮回、因果裂缝与文明飞升。

## 项目定位

这不是严格的学术宇宙模拟器，而是一个兴趣向、造物主视角、硬科幻与神话幻想混合的宇宙生成神话引擎。

核心体验：

- 输入或随机生成 seed。
- 生成一个可复现宇宙。
- 查看宇宙法则、时间线、生命潜力、文明命运与神话事件。
- 未来支持造物主干预、奇迹系统、可视化宇宙观察台与宇宙图书馆。

## 当前阶段

当前项目已完成阶段 1：可复现宇宙卡片最小可用版本。

已完成：

- 项目愿景定义。
- 核心玩法说明。
- seed 确定性原则。
- 宇宙法则分类。
- 演进里程碑拆解。
- MVP 范围锁定。
- 暂不做清单。
- 第一版页面结构。
- 第一批宇宙模板列表。
- 核心数据模块建议。
- 阶段 1 实施规格。
- Vite、React、TypeScript 网页应用。
- 确定性 PRNG 与命名随机流。
- 10 个宇宙模板。
- `UniverseSummary`、`UniverseLaws`、`TimelineEvent` 类型。
- 宇宙指标、结构化法则和 8 至 12 条关键纪元事件生成。
- 分享码与分享链接复现。
- 固定 seed 与 50 seed 冒烟测试。

主要规格文档：

- [docs/phase-0.md](docs/phase-0.md)
- [docs/phase-1.md](docs/phase-1.md)
- [docs/milestones.md](docs/milestones.md)
- [docs/repository-readiness.md](docs/repository-readiness.md)

## 仓库状态

- 当前分支：`master`
- 当前阶段：阶段 1 已实现，准备验收与提交
- 开源协议：MIT，见 [LICENSE.md](LICENSE.md)
- 协作规则：见 [CONTRIBUTING.md](CONTRIBUTING.md)
- 安全报告：见 [SECURITY.md](SECURITY.md)

## 本地运行

```text
npm install
npm run dev
```

常用检查：

```text
npm test
npm run build
```

## 推荐下一步

1. 提交并推送阶段 1 产物。
2. 基于固定 seed 做人工读感验收。
3. 进入阶段 2：宇宙法则引擎。

## 一句话

播下一组法则，观察物理、魔法、生命、文明与神明如何在同一个确定性宇宙中生长、冲突并走向命运。
