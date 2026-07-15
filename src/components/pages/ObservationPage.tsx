import { useMemo, useState } from "preact/hooks";
import type { RuntimeCausalNode } from "../../sim/current";
import type { ObservationWorkbenchController } from "../../ui/useObservationWorkbench";
import { Radar } from "../icons";
import { SectionHeader } from "../common";
import { ObservationMetrics } from "../ObservationMetrics";
type CausalPort = { node?: RuntimeCausalNode; directCauses: readonly RuntimeCausalNode[]; directEffects: readonly RuntimeCausalNode[]; select: (nodeId: string | undefined) => void };
type EntryMode = "object" | "scale" | "time" | "phenomenon";
export function ObservationPage({ workbench, causal }: { workbench: ObservationWorkbenchController; causal: CausalPort }) {
  const [tags, setTags] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("object");
  const [objectId, setObjectId] = useState(workbench.access.objects[0]?.id ?? "");
  const [tick, setTick] = useState(workbench.access.currentTick);
  const selectedMethod = workbench.access.methods.find((entry) => entry.id === workbench.methodId) ?? workbench.access.methods[0];
  const observedObject = workbench.signal ? workbench.access.objects.find((entry) => entry.id === workbench.signal!.objectId) : undefined;
  const objectSignals = useMemo(() => workbench.notebook.signals.filter((entry) => entry.objectId === observedObject?.id), [observedObject?.id, workbench.notebook.signals]); const ruleMethodIds = useMemo(() => new Set(workbench.access.methods.filter((entry) => entry.kind === "rule-trace").map((entry) => entry.id)), [workbench.access.methods]);

  function selectScale(scale: string) {
    const method = workbench.access.methods.find((entry) => entry.scale === scale);
    if (method) workbench.setMethodId(method.id);
  }
  return <section className="observation-workbench" aria-label="自由观察台">
    <SectionHeader icon={<Radar size={18} />} title="自由观察台" text="从对象、尺度、时间或现象开始，获得有限信号与可追溯证据" />
    {workbench.error && <p className="input-error" role="alert">{workbench.error}</p>}
    {workbench.status && <p className="runtime-status" role="status">{workbench.status}</p>}
    <div className="observation-methods" aria-label="观察入口">
      {(["object", "scale", "time", "phenomenon"] as const).map((mode) => <button aria-pressed={entryMode === mode} className={entryMode === mode ? "active" : ""} key={mode} type="button" onClick={() => setEntryMode(mode)}>{entryLabel(mode)}</button>)}
    </div>
    <section aria-label={`${entryLabel(entryMode)}入口`}>
      {entryMode === "object" && <label><span>选择可见对象</span><select value={objectId} onChange={(event) => setObjectId(event.target.value)}>{workbench.access.objects.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>}
      {entryMode === "scale" && <label><span>选择观察尺度</span><select value={selectedMethod?.scale} onChange={(event) => selectScale(event.target.value)}>{[...new Set(workbench.access.methods.map((entry) => entry.scale))].map((scale) => <option key={scale} value={scale}>{scaleLabel(scale)}</option>)}</select></label>}
      {entryMode === "time" && <label><span>选择逻辑时刻：{tick}</span><input aria-label="观察逻辑时刻" type="range" min={0} max={workbench.access.currentTick} value={tick} onChange={(event) => setTick(Number(event.target.value))} /></label>}
      {entryMode === "phenomenon" && <label><span>选择现象</span><select value={workbench.methodId} onChange={(event) => workbench.setMethodId(event.target.value as typeof workbench.methodId)}>{workbench.access.methods.map((entry) => <option key={entry.id} value={entry.id}>{entry.phenomenon}</option>)}</select></label>}
    </section>
    <div className="observation-methods" aria-label="观察方式">
      {workbench.access.methods.map((method) => <button aria-pressed={workbench.methodId === method.id} className={workbench.methodId === method.id ? "active" : ""} key={method.id} type="button" onClick={() => workbench.setMethodId(method.id)}><b>{method.name}</b><small>{method.description}</small></button>)}
    </div>
    <div className="observation-actions">
      <span>对象 {objectId || "无"}｜逻辑时刻 {tick}</span>
      <button type="button" disabled={!objectId || workbench.busy || workbench.loading} onClick={() => workbench.observe({ methodId: workbench.methodId, objectId, tick })}>执行观察</button>
    </div>
    <section aria-label="当前宇宙拓扑">
      <h3>世界结构</h3><p>{topologyLabel(workbench.access.topology.mode)}｜{workbench.access.topology.relationCount} 条初始关系｜{workbench.access.topology.relationNames.join("、") || "无关系"}</p>
    </section>
    {workbench.notebook.signals.length > 0 && <label><span>选择已获得的观察信号</span><select value={workbench.signal?.id ?? ""} onChange={(event) => workbench.selectSignal(event.target.value)}><option value="">请选择观察信号</option>{workbench.notebook.signals.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}｜{entry.visibleValue}</option>)}</select></label>}
    {!workbench.signal && <p>尚未执行观察，底层事实不会自动展示。</p>}
    {workbench.signal && <article className="observation-signal">
      <span>认知状态：{knowledgeLabel(workbench.signal.knowledgeStatus)}</span>
      <h3>{workbench.signal.title}</h3><strong>{workbench.signal.visibleValue}</strong><p>{workbench.signal.uncertainty}</p>
      <h4>证据</h4>
      {workbench.signal.evidence.length === 0 ? <p>本次观察没有可用证据，产品不会补造答案。</p> : workbench.signal.evidence.map((entry) => <div key={entry.id}><p>{entry.summary}｜强度：{strengthLabel(entry.strength)}</p>{entry.causalNodeIds.map((nodeId) => <button key={nodeId} type="button" onClick={() => causal.select(nodeId)}>查看证据来源</button>)}</div>)}
      <label><span>关注标签，使用逗号分隔</span><input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
      <button type="button" disabled={workbench.busy || workbench.loading} onClick={() => workbench.addFocus(workbench.signal!.title, tags.split(",").map((entry) => entry.trim()).filter(Boolean))}>加入关注</button>
    </article>}
    <ObservationMetrics workbench={workbench} />
    <section aria-label="法则认知分层">
      <h3>法则认知</h3>
      <article><b>公开公理</b><p>{workbench.access.publicAxioms.map((entry) => entry.label).join("、") || "没有公开公理"}</p></article>
      <article><b>观察支持的规律</b><p>{workbench.notebook.signals.filter((entry) => ruleMethodIds.has(entry.methodId) && entry.evidence.length > 0).map((entry) => entry.visibleValue).join("、") || "尚无观察证据"}</p></article>
      <article><b>内部观点</b><p>实体私有信念不会自动公开；可观察行为和公开叙述请从条件自主实体入口查看。</p></article>
      <article><b>未知规则</b><p>{workbench.notebook.signals.some((entry) => ruleMethodIds.has(entry.methodId)) ? "仍可能存在未参与已观察变化的规则" : "尚未执行规律追踪"}</p></article>
    </section>
    {observedObject?.kind === "galaxy" && objectSignals.length > 0 && <section aria-label="传统空间条件视图"><h3>传统空间对象</h3><p>{observedObject.label}</p>{objectSignals.map((entry) => <article key={entry.id}><b>{entry.title}</b><p>{entry.visibleValue}</p></article>)}</section>}
    {causal.node && <section className="runtime-causal-panel" aria-label="观察证据来源">
      <h3>证据来源</h3><article><span>{causal.node.kind}{causal.node.root ? "｜根因" : ""}</span><b>{causal.node.label}</b><p>{causal.node.description}</p></article>
      <div className="runtime-causal-columns"><div><h4>为什么成立</h4>{causal.directCauses.length === 0 ? <p>该节点是合法根因。</p> : causal.directCauses.map((node) => <button type="button" key={node.id} onClick={() => causal.select(node.id)}>{node.label}</button>)}</div><div><h4>已经产生</h4>{causal.directEffects.length === 0 ? <p>当前尚无已发生后果。</p> : causal.directEffects.map((node) => <button type="button" key={node.id} onClick={() => causal.select(node.id)}>{node.label}</button>)}</div></div>
      <button type="button" onClick={() => causal.select(undefined)}>关闭证据来源</button>
    </section>}
  </section>;
}
function entryLabel(mode: EntryMode): string {
  return ({ object: "按对象开始", scale: "按尺度开始", time: "按时间开始", phenomenon: "按现象开始" } as const)[mode];
}

function scaleLabel(scale: string): string {
  return ({ object: "对象尺度", history: "历史尺度", rule: "规律尺度" } as Record<string, string>)[scale] ?? scale;
}

function topologyLabel(mode: string): string {
  return ({ hierarchical: "层级拓扑", relational: "关系网络", semantic: "语义拓扑" } as Record<string, string>)[mode] ?? "未知拓扑";
}

function knowledgeLabel(status: string): string {
  return ({ unobserved: "未观察", insufficient: "证据不足", "observed-no-result": "已观察但无结果", supported: "部分支持", conflicted: "解释冲突", confirmed: "已确认", "confirmed-absent": "确认未出现" } as Record<string, string>)[status] ?? status;
}

function strengthLabel(strength: string): string {
  return ({ weak: "弱", moderate: "中", strong: "强" } as Record<string, string>)[strength] ?? strength;
}
