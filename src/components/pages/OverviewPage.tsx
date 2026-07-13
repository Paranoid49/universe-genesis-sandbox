import { Link, RefreshCcw, Telescope, UsersRound } from "../icons";
import type { UniverseSummary } from "../../sim";
import { metricName, signed } from "../../ui/labels";
import type { CivilizationStats, SpaceStats } from "../../ui/selectors";
import { topInfluences } from "../../ui/selectors";
import type { AppPageId } from "../../ui/useUniverseAppModel";
import { SectionHeader } from "../common";

export function OverviewPage({
  universe,
  shareWarnings,
  filteredTimelineCount,
  spaceStats,
  civilizationStats,
  onNavigate,
}: {
  universe: UniverseSummary;
  shareWarnings: string[];
  filteredTimelineCount: number;
  spaceStats: SpaceStats;
  civilizationStats: CivilizationStats;
  onNavigate: (page: AppPageId) => void;
}) {
  return <section className="page-stack" aria-label="创世总览">
    <section className="overview-band">
      <div className="universe-title">
        <p className="eyebrow">{universe.archetype}</p>
        <h2>{universe.name}</h2>
        <p>{universe.description}</p>
        {shareWarnings.length > 0 && <div className="share-warning" role="status">
          {shareWarnings.map((warning) => <span key={warning}>{warning}</span>)}
        </div>}
      </div>
      <div className="share-panel">
        <div><span>标准 Seed</span><strong>{universe.displaySeed}</strong></div>
        <div><span>分享码</span><strong>{universe.shareCode}</strong></div>
        <a href={universe.shareUrl} title="打开当前宇宙分享链接"><Link size={16} />分享链接</a>
        <button type="button" onClick={() => onNavigate("space")} title="查看代表性星系"><Telescope size={16} />探索星系</button>
        <button type="button" onClick={() => onNavigate("civilizations")} title="查看文明演化"><UsersRound size={16} />查看文明</button>
      </div>
    </section>

    <section className="overview-snapshot" aria-label="宇宙快照">
      <article><span>纪元事件</span><strong>{universe.timeline.length}</strong><small>当前筛选显示 {filteredTimelineCount} 条</small></article>
      <article><span>代表性星系</span><strong>{spaceStats.galaxyCount}</strong><small>{spaceStats.planetCount} 颗行星样本</small></article>
      <article><span>文明样本</span><strong>{civilizationStats.civilizationCount}</strong><small>{civilizationStats.pathCount} 类文明路径</small></article>
      <article><span>神话系统</span><strong>{civilizationStats.mythologyCount}</strong><small>{civilizationStats.highRiskCount} 个高风险文明</small></article>
    </section>

    <section className="metrics-panel" aria-label="宇宙指标">
      <SectionHeader icon={<RefreshCcw size={18} />} title="宇宙指标" text={universe.tagline} />
      <div className="metrics-grid">
        {Object.entries(universe.metrics).map(([key, metric]) => <article className="metric-tile" key={key}>
          <div className="metric-topline"><span>{metricName(key)}</span><strong>{metric.value}</strong></div>
          <div className="meter" aria-hidden="true"><span style={{ width: `${metric.value}%` }} /></div>
          <b>{metric.label}</b>
          <p>{metric.explanation}</p>
          {metric.influences && metric.influences.length > 0 && <div className="metric-influences">
            {topInfluences(metric.influences).map((influence) => <span key={`${key}-${influence.sourceId}`}>
              {influence.sourceLabel}<b>{signed(influence.delta)}</b>
            </span>)}
          </div>}
        </article>)}
      </div>
    </section>
  </section>;
}
