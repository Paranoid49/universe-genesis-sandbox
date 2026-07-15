import { useState } from "preact/hooks";
import type { OntologyModuleSpec, RuntimeCausalNode, UniverseState } from "../../sim/current";

type CausalPort = { node?: RuntimeCausalNode; directCauses: readonly RuntimeCausalNode[]; directEffects: readonly RuntimeCausalNode[]; select: (nodeId: string | undefined) => void };

export function AutonomousEntitiesPage({ state, causal }: { state: UniverseState; causal: CausalPort }) {
  const entities = Object.values(state.autonomy.entities).sort((left, right) => left.id.localeCompare(right.id));
  const [selectedId, setSelectedId] = useState(entities[0]?.id ?? "");
  const selected = entities.find((entity) => entity.id === selectedId) ?? entities[0];
  if (!selected) return null;
  const relations = Object.values(state.autonomy.relations).filter((relation) => relation.sourceEntityId === selected.id || relation.targetEntityId === selected.id);
  const narratives = Object.values(state.autonomy.narratives).filter((narrative) => narrative.entityId === selected.id);
  const myths = Object.values(state.autonomy.mythArchives).map((archive) => ({ archive, narrative: state.autonomy.narratives[archive.sourceNarrativeId] })).filter((entry) => entry.narrative?.entityId === selected.id);
  const actions = state.transitions.flatMap((transition) => transition.autonomy.actions).filter((action) => action.entityId === selected.id);
  const object = state.objects[selected.objectId];
  const ontology = state.identity.constitution.modules.find((module) => module.category === "ontology")?.spec as OntologyModuleSpec | undefined;
  const objectTypeName = ontology?.objectKinds.find((kind) => kind.id === object?.kind)?.name ?? "未知承载类型";
  const entityName = (entityId: string) => state.autonomy.entities[entityId]?.name ?? "未知实体";
  return <section className="observation-workbench" aria-label="自主实体观察">
    <h2>自主实体</h2>
    <label><span>选择自主实体</span><select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
    <article className="observation-signal">
      <span>{selected.status === "active" ? "自主性有效" : "自主性终止"}</span>
      <h3>{selected.name}</h3>
      <p>承载类型：{objectTypeName}｜形成时刻：{selected.formedAtTick}{selected.ceasedAtTick === undefined ? "" : `｜终止时刻：${selected.ceasedAtTick}`}</p>
    </article>
    <section aria-label="自主行为证据"><h3>已发生行为</h3>{actions.length === 0 ? <p>尚无行为。</p> : actions.map((action) => <article key={action.id}><b>{action.status === "applied" ? "行动产生后果" : action.status === "rejected" ? "行动被规则拒绝" : "保持观察"}</b><p>{action.reason}</p><button type="button" onClick={() => causal.select("runtime-cause:" + action.id)}>查看行动因果</button></article>)}</section>
    <section aria-label="自主关系"><h3>实体关系</h3>{relations.length === 0 ? <p>尚无关系。</p> : relations.map((relation) => <p key={relation.id}>{relation.name}｜{relation.status === "active" ? "有效" : "已终止"}｜{entityName(relation.sourceEntityId)} → {entityName(relation.targetEntityId)}</p>)}</section>
    <section aria-label="公开叙述"><h3>公开叙述</h3>{narratives.length === 0 ? <p>尚无叙述。</p> : narratives.map((narrative) => <article key={narrative.id}><b>{narrative.title}</b><p>实体叙述：{narrative.claim}</p><p>叙述不等于事实</p></article>)}</section>
    <section aria-label="神话档案"><h3>神话档案</h3>{myths.length === 0 ? <p>尚无神话档案。</p> : myths.map(({ archive, narrative }) => <article key={archive.id}><b>{narrative!.title}</b><p>{narrative!.claim}</p><p>档案不等于事实</p></article>)}</section>
    {causal.node && <section className="runtime-causal-panel" aria-label="自主行动因果">
      <h3>行动因果</h3><article>{causal.node.root && <span>根因｜根因</span>}<b>{publicCausalLabel(causal.node)}</b><p>{publicCausalDescription(causal.node)}</p></article>
      <div className="runtime-causal-columns"><div><h4>为什么发生</h4>{causal.directCauses.length === 0 ? <p>{causal.node.root ? "合法根因。" : "无更多原因"}</p> : causal.directCauses.map((node) => <button type="button" key={node.id} onClick={() => causal.select(node.id)}>{publicCausalLabel(node)}</button>)}</div><div><h4>已经产生</h4>{causal.directEffects.length === 0 ? <p>尚无后果。</p> : causal.directEffects.map((node) => <button type="button" key={node.id} onClick={() => causal.select(node.id)}>{publicCausalLabel(node)}</button>)}</div></div>
      <button type="button" onClick={() => causal.select(undefined)}>关闭行动因果</button>
    </section>}
  </section>;
}

function publicCausalLabel(node: RuntimeCausalNode): string {
  if ("perception memory belief intent".includes(node.kind)) return "内部依据";
  if (node.kind === "rule") return "适用规则";
  if (node.kind === "evaluation") return "规则裁决";
  if (node.kind === "difference" || node.kind === "event") return "状态变化";
  if (node.kind === "input") return "外部输入";
  if (node.kind === "random") return "规则选择";
  if (node.kind === "action") return "自主行动";
  return node.label;
}

function publicCausalDescription(node: RuntimeCausalNode): string {
  if (node.kind === "difference" || node.kind === "event") return "已产生状态变化";
  return "perception memory belief intent evaluation input random rule".includes(node.kind) ? "内部依据" : node.description;
}
