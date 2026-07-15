import { useState } from "preact/hooks";
import type { ObservationWorkbenchController } from "../../ui/useObservationWorkbench";
import { BookMarked } from "../icons";
import { SectionHeader } from "../common";

export function ResearchPage({ workbench }: { workbench: ObservationWorkbenchController }) {
  const [note, setNote] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  return <section className="research-notebook" aria-label="研究记录簿">
    <SectionHeader icon={<BookMarked size={18} />} title="研究记录簿" text="记录关注、观察历史、笔记与玩家自己的推测" />
    {workbench.error && <p className="input-error" role="alert">{workbench.error}</p>}
    {workbench.status && <p className="runtime-status" role="status">{workbench.status}</p>}
    <div className="research-summary">
      <article><span>关注</span><strong>{workbench.notebook.focuses.length}</strong></article>
      <article><span>观察记录</span><strong>{workbench.notebook.observationHistory.length}</strong></article>
      <article><span>笔记与推测</span><strong>{workbench.notebook.notes.length + workbench.notebook.hypotheses.length}</strong></article>
    </div>
    <section><h3>关注内容</h3>{workbench.notebook.focuses.length === 0 ? <p>尚未关注任何对象或现象。</p> : workbench.notebook.focuses.map((entry) => <article key={entry.id}><b>{entry.label}</b><p>{entry.tags.join("、") || "无标签"}</p></article>)}</section>
    <section><h3>添加笔记</h3><label><span>玩家笔记，不会改变宇宙事实</span><textarea value={note} onInput={(event) => setNote(event.currentTarget.value)} /></label><button disabled={workbench.busy || workbench.loading} type="button" onClick={async () => { if (await workbench.addNote(note)) setNote(""); }}>保存笔记</button></section>
    <section><h3>提出推测</h3><label><span>玩家推测会与事实分层保存</span><textarea value={hypothesis} onInput={(event) => setHypothesis(event.currentTarget.value)} /></label><button disabled={workbench.busy || workbench.loading} type="button" onClick={async () => { if (await workbench.addHypothesis(hypothesis)) setHypothesis(""); }}>保存推测</button></section>
    <section><h3>已有记录</h3>
      {workbench.notebook.signals.map((entry) => <article key={entry.id}><span>观察证据｜逻辑时刻 {entry.tick}</span><b>{entry.title}</b><p>{entry.visibleValue}｜{entry.uncertainty}</p></article>)}
      {workbench.notebook.notes.map((entry) => <article key={entry.id}><span>笔记</span><p>{entry.text}</p></article>)}
      {workbench.notebook.hypotheses.map((entry) => <article key={entry.id}><span>玩家推测｜{entry.status}</span><p>{entry.statement}</p></article>)}
      {workbench.notebook.questions.map((entry) => <article key={entry.id}><span>认知问题｜{entry.status}</span><b>{entry.title}</b><p>支持证据 {entry.supportingEvidenceIds.length} 条｜反对证据 {entry.opposingEvidenceIds.length} 条</p></article>)}
    </section>
  </section>;
}
