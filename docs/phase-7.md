# 阶段 7：可视化宇宙观察台

阶段 7 的目标是把既有宇宙、空间对象、文明和时间线投影为轻量、只读、可操作的二维观察台。可视化只解释 `UniverseSummary`，不得参与生成、修改模拟结果或引入新的隐式随机输入。

## 1. 目标

- 提供宇宙、星系与恒星系三个观察层级。
- 使用稳定 ID 派生确定性二维坐标，同一宇宙每次呈现一致。
- 支持生命、文明、魔法、神性和因果风险信息叠层。
- 支持按既有时间线浏览关键事件，并突出事件关联目标。
- 保留完整文字浏览路径，图形不可用时仍能理解和操作。
- 可视化实现保持轻量，不引入 Canvas、WebGL、Three.js 或外部图形运行时。

## 2. 输入与边界

观察台只消费以下只读输入：

- `UniverseSummary.seed`、`name`、`metrics` 和 `timeline`。
- `Galaxy[]`、`StarSystem[]`、`Planet[]` 与 `Civilization[]`。
- 阶段 6 已提供的稳定对象 ID、来源 ID 和干预结果事件 ID。

观察台不得：

- 调用 `generateUniverse`、`generateGalaxies`、`generateCivilizations` 或干预应用器。
- 修改传入的宇宙对象或把视图状态写回模拟核心。
- 使用系统时间、网络状态或 `Math.random()` 决定投影结果。
- 因缩放、叠层或时间浏览改变分享码和确定性宇宙结果。

## 3. 投影契约

阶段 7 在 `src/ui` 中定义只读投影类型：

```ts
type ObservationLevel = "universe" | "galaxy" | "system"

type ObservationOverlay =
  | "life"
  | "civilization"
  | "magic"
  | "divinity"
  | "causality"

type ObservationNode = {
  id: string
  parentId?: string
  kind: "galaxy" | "system" | "planet"
  label: string
  detail: string
  x: number
  y: number
  size: number
  brightness: number
  intensity: Record<ObservationOverlay, number>
  relatedEventIds: string[]
}

type ObservationProjection = {
  level: ObservationLevel
  title: string
  nodes: ObservationNode[]
  breadcrumbs: Array<{ id: string; label: string; level: ObservationLevel }>
  textualSummary: string
}
```

- 坐标、尺寸和基础颜色只由稳定 ID 与结构化字段派生。
- 所有数值归一化到明确范围，渲染组件不重复领域计算。
- 投影函数必须是纯函数，并对空集合提供明确降级摘要。
- 投影类型属于 UI 读取模型，不加入 `UniverseSummary`，因此不升级规则版本。

## 4. 观察层级

### 4.1 宇宙层

- 每个代表性星系显示为可聚焦节点。
- 节点尺寸反映质量，基础亮度反映金属丰度。
- 选择星系进入星系层。

### 4.2 星系层

- 每个恒星系显示为可聚焦节点。
- 节点尺寸反映光度，基础亮度反映稳定度。
- 选择恒星系进入恒星系层。

### 4.3 恒星系层

- 行星按轨道次序投影。
- 节点尺寸反映宜居度与行星类型。
- 选择行星后显示结构化详情，不进入新的生成层级。

## 5. 信息叠层

- 生命叠层：使用行星宜居度、生物圈复杂度和生命潜力。
- 文明叠层：使用文明存在性、技术、扩张与稳定度。
- 魔法叠层：使用星系魔法通量、行星魔法饱和度和文明魔法等级。
- 神性叠层：使用星系神性残留、文明信仰与神话影响。
- 因果叠层：使用星系因果危险、恒星系异常和宇宙因果完整度的反向风险。

同一时间只启用一个主叠层，必须提供图例、文字数值和非颜色提示，不能只依赖颜色表达强度。

## 6. 时间浏览

- 时间控制只读取既有 `TimelineEvent[]`。
- 支持第一条、上一条、下一条、最后一条和范围滑块定位。
- 当前事件显示纪元、年龄、标题、描述与关联来源。
- 事件关联节点通过 `sourceIds`、`location` 和稳定对象 ID 进行只读匹配。
- 阶段 7 不提供自动计时播放，避免后台计时器和不可见资源占用；“播放”在本阶段定义为用户逐事件浏览。

## 7. 页面与无障碍要求

- 主导航新增“观察台”页面。
- 图形使用内联 SVG，节点必须可通过键盘聚焦和激活。
- 当前层级、叠层、时间位置和选择结果具有可访问名称。
- SVG 后方提供同一节点的文字列表，保证图形失败或视觉受限时仍可操作。
- 360 像素宽度下不得横向溢出。
- `prefers-reduced-motion` 下不得依赖动画传达状态。

## 8. 性能与降级

- 不新增第三方可视化依赖。
- 投影按当前宇宙与观察层级记忆化计算。
- 单层只渲染当前层级节点，不同时渲染完整宇宙树。
- 节点数量异常时必须截断到文档化上限并在文字摘要中说明。
- 文字页面不依赖观察台初始化即可继续使用。

## 9. 验收标准

- 同一 `UniverseSummary` 的投影结果完全一致。
- 宇宙、星系、恒星系三级均可通过鼠标和键盘进入或返回。
- 五种信息叠层均产生可解释的结构化强度。
- 时间控制可定位首尾及相邻事件，且不修改宇宙结果。
- 图形节点与文字节点列表表达同一组稳定 ID。
- 观察台不直接调用生成器，不使用浏览器时间和随机数。
- 阶段 0 至阶段 6 的全部测试继续通过。
- 新增阶段 7 单元测试、组件交互测试和真实浏览器路径。
- `npm run check` 与 `npm run check:release` 继续通过现有质量和体积预算。

## 10. 开发顺序

1. 定义观察投影类型与纯函数。
2. 增加观察台独立组件和 SVG 图形。
3. 接入层级、叠层、节点选择与时间浏览状态。
4. 增加文字降级路径和无障碍语义。
5. 增加阶段 7 自动化验收。
6. 更新架构、里程碑、README 与仓库就绪文档。
