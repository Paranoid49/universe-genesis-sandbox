import type { RuntimePageModel } from "../../ui/runtimePageModel";
import type { SimulationSpeed } from "../../sim/current";
import { History, Sparkles } from "../icons";
import { SectionHeader } from "../common";

export function RuntimePage({ model, view = "all" }: { model: RuntimePageModel; view?: "all" | "current" | "history" }) {
  return <section className="runtime-panel" aria-label={view === "history" ? "已发生历史页面" : "运行中宇宙"}>
    {view !== "history" && <>
    <SectionHeader icon={<Sparkles size={18} />} title="运行中宇宙" text="宇宙持续演化并形成历史" />
    {model.error && <p className="input-error" role="alert">{model.error}</p>}
    {model.status && <p className="runtime-status" role="status">{model.status}</p>}
    {model.busy && <p className="runtime-status" role="status">正在处理运行存档</p>}
    <div className="runtime-summary">
      <article><span>模拟位置</span><strong>第 {model.step} 步</strong><small>{model.constitutionName}｜{model.timeLabel}｜逻辑时刻 {model.tick}</small></article>
      <article><span>运行状态</span><strong>{model.runStatus === "running" ? "连续运行" : "已暂停"}</strong><small>{model.stateId}</small></article>
      <article><span>玩家关注</span><strong>{model.knowledge?.focuses.length ?? 0} 项</strong><small>{model.knowledge?.focuses.join("、") || "尚未关注对象或现象"}</small></article>
      <article><span>未知区域</span><strong>{model.knowledge?.unknownMethods.length ?? 0} 类</strong><small>{model.knowledge?.unknownMethods.join("、") || "暂无未知观察方式"}</small></article>
    </div>
    <section className="runtime-history" aria-label="当前可知状态">
      <h3>当前可知状态</h3>
      {!model.knowledge || model.knowledge.recentSignals.length === 0 ? <p>暂无观察结论，底层事实未展示。</p> : model.knowledge.recentSignals.map((entry) => <article key={entry.id}><span>逻辑时刻 {entry.tick}</span><b>{entry.title}</b><p>{entry.value}</p></article>)}
      <h4>公开公理</h4><p>{model.knowledge?.publicAxioms.join("、") || "没有可公开展示的创世公理"}</p>
    </section>
    <section className="runtime-history" aria-label="近期可观察变化">
      <h3>近期可观察变化</h3>
      {!model.knowledge || model.knowledge.recentChanges.length === 0 ? <p>暂无近期变化证据，不代表没有变化。</p> : model.knowledge.recentChanges.map((entry) => <article key={entry.id}><span>逻辑时刻 {entry.tick}</span><b>{entry.title}</b><p>{entry.value}</p></article>)}
    </section>
    <div className="runtime-controls" aria-label="模拟时钟控制">
      <button type="button" onClick={model.onToggleRunning} disabled={model.busy}>{model.runStatus === "running" ? "暂停" : "连续运行"}</button>
      <button type="button" onClick={model.onAdvance} disabled={model.busy || model.runStatus === "running"}>单步推进</button>
      <label><span>运行速度</span><select disabled={model.busy} value={model.speed} onChange={(event) => model.onChangeSpeed(Number(event.target.value) as SimulationSpeed)}>
        {[1, 2, 4, 8].map((speed) => <option key={speed} value={speed}>{speed} 倍</option>)}
      </select></label>
      <button type="button" onClick={model.onSave} disabled={model.busy}>保存检查点</button>
      <button type="button" onClick={model.onRestoreLatest} disabled={model.busy}>恢复最近检查点</button>
    </div>
    </>}
    {view !== "current" && <section className="runtime-history" aria-label="已发生历史浏览">
      <h3><History size={17} />已发生历史</h3>
      <label><span>历史浏览位置：{model.historyTick}</span><input aria-label="历史浏览位置" type="range" min={0} max={model.tick} value={model.historyTick} onChange={(event) => model.onSetHistoryTick(Number(event.target.value))} /></label>
      <div className="runtime-history-actions">
        <button type="button" onClick={() => model.onSetHistoryTick(0)}>最初</button>
        <button type="button" disabled={model.historyTick === 0} onClick={() => model.onSetHistoryTick(Math.max(0, model.historyTick - 1))}>上一步</button>
        <button type="button" disabled={model.historyTick === model.tick} onClick={() => model.onSetHistoryTick(Math.min(model.tick, model.historyTick + 1))}>下一步</button>
        <button type="button" onClick={() => model.onSetHistoryTick(model.tick)}>回到当前</button>
      </div>
      <div className="runtime-event-list">
        {model.events.length === 0 && <p>当前浏览位置尚无已发生事件。</p>}
        {model.events.map((event) => <article key={event.id}>
          <span>逻辑时刻 {event.tick}</span>
          <b>{event.title}</b>
          <p>变化已提交，详情须经观察取得。</p>
          <button type="button" onClick={() => model.onSetCausalNodeId(`runtime-cause:${event.id}`)}>查看原因与后果</button>
        </article>)}
      </div>
    </section>}
    {model.causalNode && <section className="runtime-causal-panel" aria-label="运行因果查询">
      <h3>运行因果查询</h3>
      <article>
        <span>{model.causalNode.kind}{model.causalNode.root ? "｜根因" : ""}</span>
        <b>{model.causalNode.label}</b>
        <p>{model.causalNode.description}</p>
      </article>
      <div className="runtime-causal-columns">
        <div><h4>为什么发生</h4>{model.directCauses.length === 0 ? <p>该节点是合法根因。</p> : model.directCauses.map((node) => <button type="button" key={node.id} onClick={() => model.onSetCausalNodeId(node.id)}>{node.label}</button>)}</div>
        <div><h4>产生了什么后果</h4>{model.directEffects.length === 0 ? <p>当前尚无已发生后果。</p> : model.directEffects.map((node) => <button type="button" key={node.id} onClick={() => model.onSetCausalNodeId(node.id)}>{node.label}</button>)}</div>
      </div>
      <button type="button" onClick={() => model.onSetCausalNodeId(undefined)}>关闭运行因果查询</button>
    </section>}
  </section>;
}
