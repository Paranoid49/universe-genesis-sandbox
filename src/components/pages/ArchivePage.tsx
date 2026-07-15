import { BookMarked } from "../icons";
import { SectionHeader } from "../common";

export type ArchivePageModel = {
  busy: boolean;
  checkpoints: readonly { stateId: string; step: number; tick: number }[];
  research: { revision: number; signals: number; focuses: number; notes: number; hypotheses: number };
  onSave: () => void;
  onRestoreLatest: () => void;
};

export function ArchivePage({ model }: { model: ArchivePageModel }) {
  return <section className="runtime-panel" aria-label="存档组织页面">
    <SectionHeader icon={<BookMarked size={18} />} title="存档" text="分别组织运行检查点与玩家研究记录" />
    <div className="runtime-controls" aria-label="存档操作">
      <button type="button" disabled={model.busy} onClick={model.onSave}>保存运行检查点</button>
      <button type="button" disabled={model.busy || model.checkpoints.length === 0} onClick={model.onRestoreLatest}>恢复最近检查点</button>
    </div>
    <section aria-label="运行检查点">
      <h3>运行检查点</h3>
      {model.checkpoints.length === 0 ? <p>当前宇宙尚无运行检查点。</p> : model.checkpoints.map((entry) => <article key={entry.stateId}>
        <b>第 {entry.step} 步</b><p>逻辑时刻 {entry.tick}</p><small>{entry.stateId}</small>
      </article>)}
    </section>
    <section aria-label="研究记录存档">
      <h3>研究记录</h3>
      <article><b>记录版本 {model.research.revision}</b><p>{model.research.signals} 条信号｜{model.research.focuses} 项关注｜{model.research.notes} 条笔记｜{model.research.hypotheses} 条推测</p></article>
      <p>研究记录与运行检查点独立保存，不会改写宇宙状态。</p>
    </section>
  </section>;
}
