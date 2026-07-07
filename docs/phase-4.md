# 阶段 4：星系、恒星、行星与生命样本开发准备

版本：0.1  
日期：2026-07-07  
状态：准备开发

## 1. 当前结论

阶段 4 尚未实现星系、恒星系、行星和生命样本，但阶段 3 的输出已经具备阶段 4 可消费的数据基础。

阶段 4 开发可以直接读取：

- `UniverseSummary.timelineImpact`：由阶段 3 时间线折算出的局部对象生成摘要。
- `timelineImpact.localBiases`：星系密度、恒星稳定、行星宜居、生命出现、文明种子、魔法异常、神性遗迹和因果风险偏置。
- `timelineImpact.eraProfiles`：每个纪元的事件数量、后续影响数量、影响强度、主导事件类型和关键事件。
- `timelineImpact.metricDeltas`：时间线事件对宇宙指标倾向的累计影响。
- `timelineImpact.keySourceEventIds`：最适合作为局部对象生成来源的关键事件。

## 2. 阶段 4 生成入口建议

建议新增模块：

```text
src/sim/galaxies.ts
src/sim/star-systems.ts
src/sim/planets.ts
src/sim/biospheres.ts
```

推荐生成顺序：

1. 在 `generateUniverse` 中完成法则、指标、时间线和 `timelineImpact`。
2. 用 `root.fork("galaxies")` 创建星系生成随机流。
3. 让星系数量、类型和异常密度读取 `timelineImpact.localBiases`。
4. 让恒星稳定性读取 `stellarStability`、`causalHazardLevel` 和物理法则。
5. 让行星宜居性读取 `planetHabitability`、`biosphereChance`、生命法则和元素纪元事件。
6. 让文明种子读取 `civilizationSeedChance`、文明纪元事件和意识法则。

## 3. 内容池边界

当前法则和时间线素材已经拆入内容层：

```text
src/sim/content/laws.ts
src/sim/content/timeline.ts
```

阶段 4 应延续同一模式，把星系类型、恒星类型、行星类型、生命样本和文明种子文案放入内容层，不要把大段素材写进生成器主体。

## 4. 必须保持的工程约束

- 不破坏 `seed + templateId + rulesetVersion` 的确定性复现。
- 新增生成模块不得直接使用 `Math.random()`。
- 新增数据结构必须从 `src/sim/types.ts` 导出。
- 新增阶段验收必须补充到 `tests/universe.test.ts` 或拆出新的测试文件。
- 分享链接只保证当前规则版本内复现；非当前规则短码只提示不受支持，不提供旧规则运行时兼容。
- CI 会运行 `npm run check`，阶段 4 改动必须保持测试和构建通过。

## 5. 第一批验收建议

阶段 4 第一版至少补齐：

- 每个宇宙生成不少于 12 个代表性星系。
- 每个星系包含 3 至 8 个代表性恒星系摘要。
- 每个恒星系包含 2 至 6 个代表性行星摘要。
- 行星生命结果受 `timelineImpact`、宇宙法则和局部环境共同影响。
- 每个局部对象能追踪到至少一个 `sourceEventId` 或结构化法则来源。
- 同一 `seed + templateId + rulesetVersion` 的局部对象结果完全一致。
