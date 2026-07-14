import type { RuntimeUniverseController } from "../../ui/useRuntimeUniverseModel";
import type { SimulationSpeed } from "../../sim";
import { History, Sparkles } from "../icons";
import { SectionHeader } from "../common";

export function RuntimePage({ runtime }: { runtime: RuntimeUniverseController }) {
  const { state, viewedObject } = runtime;
  const visibleEvents = runtime.events.filter((event) => event.tick <= runtime.historyTick);
  return <section className="runtime-panel" aria-label="运行中宇宙">
    <SectionHeader icon={<Sparkles size={18} />} title="运行中宇宙" text="宇宙由状态转换持续形成历史" />
    {runtime.error && <p className="input-error" role="alert">{runtime.error}</p>}
    {runtime.status && <p className="runtime-status" role="status">{runtime.status}</p>}
    {runtime.busy && <p className="runtime-status" role="status">正在处理运行存档</p>}
    <div className="runtime-summary">
      <article><span>模拟位置</span><strong>第 {state.clock.step} 步</strong><small>逻辑时刻 {state.clock.tick}</small></article>
      <article><span>运行状态</span><strong>{state.clock.status === "running" ? "连续运行" : "已暂停"}</strong><small>{state.id}</small></article>
      <article><span>持久对象</span><strong>{viewedObject.kind}</strong><small>{viewedObject.id}</small></article>
    </div>
    <div className="runtime-controls" aria-label="模拟时钟控制">
      <button type="button" onClick={runtime.toggleRunning} disabled={runtime.busy}>{state.clock.status === "running" ? "暂停" : "连续运行"}</button>
      <button type="button" onClick={runtime.advance} disabled={runtime.busy || state.clock.status === "running"}>单步推进</button>
      <label><span>运行速度</span><select disabled={runtime.busy} value={state.clock.speed} onChange={(event) => runtime.changeSpeed(Number(event.target.value) as SimulationSpeed)}>
        {[1, 2, 4, 8].map((speed) => <option key={speed} value={speed}>{speed} 倍</option>)}
      </select></label>
      <button type="button" onClick={runtime.save} disabled={runtime.busy}>保存检查点</button>
      <button type="button" onClick={runtime.restoreLatest} disabled={runtime.busy}>恢复最近检查点</button>
    </div>
    <section className="runtime-history" aria-label="已发生历史浏览">
      <h3><History size={17} />已发生历史</h3>
      <label><span>历史浏览位置：{runtime.historyTick}</span><input aria-label="历史浏览位置" type="range" min={0} max={state.clock.tick} value={runtime.historyTick} onChange={(event) => runtime.setHistoryTick(Number(event.target.value))} /></label>
      <div className="runtime-history-actions">
        <button type="button" onClick={() => runtime.setHistoryTick(0)}>最初</button>
        <button type="button" disabled={runtime.historyTick === 0} onClick={() => runtime.setHistoryTick(Math.max(0, runtime.historyTick - 1))}>上一步</button>
        <button type="button" disabled={runtime.historyTick === state.clock.tick} onClick={() => runtime.setHistoryTick(Math.min(state.clock.tick, runtime.historyTick + 1))}>下一步</button>
        <button type="button" onClick={() => runtime.setHistoryTick(state.clock.tick)}>回到当前</button>
      </div>
      <article className="runtime-object-card">
        <h4>{viewedObject.id}</h4>
        <p>状态：{viewedObject.status}｜版本：{viewedObject.revision}</p>
        <p>凝聚度：{String(viewedObject.attributes.cohesion)}｜能量：{String(viewedObject.attributes.energy)}｜共振：{String(viewedObject.attributes.resonance)}</p>
      </article>
      <div className="runtime-event-list">
        {visibleEvents.length === 0 && <p>当前浏览位置尚无已发生事件。</p>}
        {visibleEvents.map((event) => <article key={event.id}>
          <span>逻辑时刻 {event.tick}</span>
          <b>{event.title}</b>
          <p>{event.description}</p>
          <small>原因：{event.causeSubjectIds.join("、")}</small>
          <button type="button" onClick={() => runtime.setCausalNodeId(`runtime-cause:${event.id}`)}>查看原因与后果</button>
        </article>)}
      </div>
    </section>
    {runtime.causalNode && <section className="runtime-causal-panel" aria-label="运行因果查询">
      <h3>运行因果查询</h3>
      <article>
        <span>{runtime.causalNode.kind}{runtime.causalNode.root ? "｜根因" : ""}</span>
        <b>{runtime.causalNode.label}</b>
        <p>{runtime.causalNode.description}</p>
      </article>
      <div className="runtime-causal-columns">
        <div><h4>为什么发生</h4>{runtime.directCauses.length === 0 ? <p>该节点是合法根因。</p> : runtime.directCauses.map((node) => <button type="button" key={node.id} onClick={() => runtime.setCausalNodeId(node.id)}>{node.label}</button>)}</div>
        <div><h4>产生了什么后果</h4>{runtime.directEffects.length === 0 ? <p>当前尚无已发生后果。</p> : runtime.directEffects.map((node) => <button type="button" key={node.id} onClick={() => runtime.setCausalNodeId(node.id)}>{node.label}</button>)}</div>
      </div>
      <button type="button" onClick={() => runtime.setCausalNodeId(undefined)}>关闭运行因果查询</button>
    </section>}
  </section>;
}
