import { BookMarked, Download, RotateCcw, Search, Star, Trash2, Upload } from "./icons";
import { useState } from "preact/hooks";
import type { UniverseSummary } from "../sim";
import type { UniverseArchiveController } from "../ui/useUniverseArchive";
import { SectionHeader } from "./common";

export function UniverseLibrary({ universe, archive, onRestore }: { universe: UniverseSummary; archive: UniverseArchiveController; onRestore: (shareCode: string) => string | undefined }) {
  const [title, setTitle] = useState(universe.name);
  const [importText, setImportText] = useState("");
  const [restoreError, setRestoreError] = useState<string>();

  function restore(shareCode: string) {
    setRestoreError(onRestore(shareCode));
  }

  return (
    <section className="library-panel" aria-label="本地宇宙图书馆">
      <SectionHeader icon={<BookMarked size={18} />} title="本地宇宙图书馆" text="存档只保存显式复现输入和用户元数据" />
      {(archive.error || restoreError) && <p className="input-error" role="alert">{archive.error ?? restoreError}</p>}
      {archive.status && <p className="library-status" role="status">{archive.status}</p>}
      <section className="library-save" aria-label="保存当前宇宙">
        <label><span>存档标题</span><input maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <div><small>{universe.displaySeed} · {universe.templateId}</small><strong>{universe.miracleState.appliedMiracles.length} 次干预</strong></div>
        <button className="primary-action" type="button" onClick={() => archive.saveCurrent(universe, title)}><BookMarked size={16} />保存当前宇宙</button>
      </section>
      <div className="library-filters">
        <label><span>搜索存档</span><div className="search-field"><Search size={15} /><input value={archive.query} onChange={(event) => archive.setQuery(event.target.value)} /></div></label>
        <label className="favorite-filter"><input type="checkbox" checked={archive.favoritesOnly} onChange={(event) => archive.setFavoritesOnly(event.target.checked)} /><span>只看收藏</span></label>
        <strong>{archive.visibleEntries.length} / {archive.entries.length} 条</strong>
      </div>
      <div className="library-list" aria-label="宇宙存档列表">
        {archive.visibleEntries.length === 0 && <p className="library-empty">{archive.entries.length === 0 ? "尚未保存任何宇宙。" : "没有匹配当前条件的存档。"}</p>}
        {archive.visibleEntries.map((entry) => (
          <article key={entry.id}>
            <div className="library-entry-heading"><div><h3>{entry.title}</h3><span>{entry.displaySeed} · {entry.templateId}</span></div>{entry.favorite && <Star size={17} aria-label="已收藏" />}</div>
            <p>{entry.shareCode}</p>
            <small>更新于 {formatArchiveTime(entry.updatedAt)} · {entry.rulesetVersion}</small>
            <div className="library-actions">
              <button type="button" onClick={() => restore(entry.shareCode)}><RotateCcw size={15} />恢复</button>
              <button type="button" onClick={() => archive.toggleFavorite(entry.id)}><Star size={15} />{entry.favorite ? "取消收藏" : "收藏"}</button>
              <button type="button" onClick={() => archive.remove(entry.id)}><Trash2 size={15} />删除</button>
            </div>
          </article>
        ))}
      </div>
      <section className="library-transfer" aria-label="导入导出存档">
        <div><h3><Download size={16} />导出</h3><button type="button" onClick={archive.exportAll}>生成导出 JSON</button><textarea aria-label="导出 JSON" readOnly value={archive.exportText} placeholder="点击生成导出 JSON" /></div>
        <div><h3><Upload size={16} />导入</h3><button type="button" disabled={archive.importing} onClick={() => archive.importAll(importText)}>{archive.importing ? "正在校验导入" : "导入 JSON"}</button><textarea aria-label="导入 JSON" value={importText} onInput={(event) => setImportText(event.currentTarget.value)} placeholder="粘贴 A1 存档 JSON" /></div>
      </section>
    </section>
  );
}

function formatArchiveTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
