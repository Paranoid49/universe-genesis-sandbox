import { Link, RefreshCcw, Telescope, UsersRound } from "../icons";
import type { UniverseSummary } from "../../sim";
import { metricName, signed } from "../../ui/labels";
import type { CivilizationStats, SpaceStats } from "../../ui/selectors";
import { topInfluences } from "../../ui/selectors";
import type { AppPageId } from "../../ui/useUniverseAppModel";
import { ResultValue, SectionHeader, TraceCauseButton } from "../common";

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
        <p className="eyebrow"><ResultValue subjectId={`template.${universe.templateId}`} label="宇宙原型" strategy="cause" value={universe.archetype}>{universe.archetype}</ResultValue></p>
        <h2><ResultValue subjectId="universe.name" label="宇宙名称" strategy="cause" value={universe.name}>{universe.name}</ResultValue></h2>
        <p><ResultValue subjectId="universe.description" label="宇宙描述" strategy="cause" value={universe.description}>{universe.description}</ResultValue></p>
        <div className="result-traces">
          <TraceCauseButton subjectId={`template.${universe.templateId}`} label="宇宙原型" />
          <TraceCauseButton subjectId="universe.name" label="宇宙名称" />
          <TraceCauseButton subjectId="universe.description" label="宇宙描述" />
        </div>
        {shareWarnings.length > 0 && <div className="share-warning" role="status">
          {shareWarnings.map((warning) => <span key={warning}>{warning}</span>)}
        </div>}
      </div>
      <div className="share-panel">
        <div><span>标准 Seed</span><strong><ResultValue subjectId="input.seed" label="标准 Seed" strategy="cause" value={universe.seed}>{universe.displaySeed}</ResultValue></strong></div>
        <div><span>分享码</span><strong><ResultValue subjectId="share.code" label="分享码" strategy="cause" value={universe.shareCode}>{universe.shareCode}</ResultValue></strong></div>
        <ResultValue subjectId="share.url" label="分享链接" strategy="cause" value={universe.shareUrl}><a href={universe.shareUrl} title="打开当前宇宙分享链接"><Link size={16} />分享链接</a></ResultValue>
        <button type="button" onClick={() => onNavigate("space")} title="查看代表性星系"><Telescope size={16} />探索星系</button>
        <button type="button" onClick={() => onNavigate("civilizations")} title="查看文明演化"><UsersRound size={16} />查看文明</button>
      </div>
    </section>

    <section className="overview-snapshot" aria-label="宇宙快照">
      <article><span>纪元事件</span><strong><ResultValue subjectId="timeline.count" label="纪元事件数量" strategy="cause" value={universe.timeline.length}>{universe.timeline.length}</ResultValue></strong><small>当前筛选显示 {filteredTimelineCount} 条</small></article>
      <article><span>代表性星系</span><strong><ResultValue subjectId="space.stats.galaxies" label="星系数量" strategy="cause" value={spaceStats.galaxyCount}>{spaceStats.galaxyCount}</ResultValue></strong><small><ResultValue subjectId="space.stats.planets" label="行星数量" strategy="cause" value={spaceStats.planetCount}>{spaceStats.planetCount} 颗行星样本</ResultValue></small></article>
      <article><span>文明样本</span><strong><ResultValue subjectId="civilization.stats.total" label="文明数量" strategy="cause" value={civilizationStats.civilizationCount}>{civilizationStats.civilizationCount}</ResultValue></strong><small><ResultValue subjectId="civilization.stats.paths" label="文明路径数量" strategy="cause" value={civilizationStats.pathCount}>{civilizationStats.pathCount} 类文明路径</ResultValue></small></article>
      <article><span>神话系统</span><strong><ResultValue subjectId="civilization.stats.mythologies" label="神话类型数量" strategy="cause" value={civilizationStats.mythologyCount}>{civilizationStats.mythologyCount}</ResultValue></strong><small><ResultValue subjectId="civilization.stats.highRisk" label="高风险文明数量" strategy="cause" value={civilizationStats.highRiskCount}>{civilizationStats.highRiskCount} 个高风险文明</ResultValue></small></article>
    </section>

    <section className="metrics-panel" aria-label="宇宙指标">
      <SectionHeader icon={<RefreshCcw size={18} />} title="宇宙指标" text={universe.tagline} subjectId="universe.tagline" resultValue={universe.tagline} />
      <div className="metrics-grid">
        {Object.entries(universe.metrics).map(([key, metric]) => <article className="metric-tile" key={key}>
          <div className="metric-topline"><span>{metricName(key)}</span><strong><ResultValue subjectId={`metric.${key}`} label={metricName(key)} strategy="cause" value={metric.value}>{metric.value}</ResultValue></strong></div>
          <div className="meter" aria-hidden="true"><span style={{ width: `${metric.value}%` }} /></div>
          <b><ResultValue subjectId={`metric.${key}`} label={`${metricName(key)}标签`} strategy="cause" value={metric.label}>{metric.label}</ResultValue></b>
          <p><ResultValue subjectId={`metric.${key}`} label={`${metricName(key)}解释`} strategy="cause" value={metric.explanation}>{metric.explanation}</ResultValue></p>
          {metric.influences && metric.influences.length > 0 && <div className="metric-influences">
            {topInfluences(metric.influences).map((influence, index) => <ResultValue key={`${key}-${influence.sourceId}-${index}`} subjectId={`metric.${key}`} label={`${metricName(key)}影响来源`} strategy="cause" value={{ sourceId: influence.sourceId, sourceLabel: influence.sourceLabel, delta: influence.delta }}>
              {influence.sourceLabel}<b>{signed(influence.delta)}</b>
            </ResultValue>)}
          </div>}
        </article>)}
      </div>
    </section>
  </section>;
}
