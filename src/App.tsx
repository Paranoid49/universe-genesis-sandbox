import { BarChart3, BookOpen, Clipboard, Dices, History, Link, ListFilter, RefreshCcw, Scale, ScrollText, Sparkles, Telescope, UsersRound } from "lucide-react";
import { RULESET_VERSION, UNIVERSE_TEMPLATES, type UniverseTemplateId } from "./sim";
import { LogColumn, SectionHeader } from "./components/common";
import { CivilizationPanel } from "./components/CivilizationPanel";
import { SpaceExplorer } from "./components/SpaceExplorer";
import { EventDetail, TimelineImpactPanel } from "./components/TimelinePanels";
import { eraName, eventTypeName, interactionKindName, lawDomainName, metricName, polarityName, signed } from "./ui/labels";
import { topInfluences } from "./ui/selectors";
import { eraFilterOptions, useUniverseAppModel, type AppPageId } from "./ui/useUniverseAppModel";

const appPageOptions: Array<{ id: AppPageId; label: string; description: string; icon: typeof BarChart3 }> = [
  { id: "overview", label: "概览", description: "宇宙摘要与指标", icon: BarChart3 },
  { id: "space", label: "星系", description: "星系、恒星系与行星", icon: Telescope },
  { id: "civilizations", label: "文明", description: "文明演化与神话", icon: UsersRound },
  { id: "timeline", label: "纪元", description: "时间线与阶段影响", icon: History },
  { id: "laws", label: "法则", description: "法则、关系与对比", icon: BookOpen },
  { id: "logs", label: "日志", description: "观察记录与终局", icon: ScrollText },
];

type AppProps = {
  initialPage?: AppPageId;
};

export function App({ initialPage = "overview" }: AppProps = {}) {
  const {
    activePage,
    civilizationStats,
    compareDraftSeed,
    comparison,
    copyShare,
    copyState,
    createUniverse,
    draftSeed,
    eraFilter,
    filteredTimeline,
    randomizeSeed,
    selectedCivilization,
    selectedEvent,
    selectedGalaxy,
    selectedPlanet,
    selectedSystem,
    setActivePage,
    setCompareDraftSeed,
    setDraftSeed,
    setEraFilter,
    setSelectedEventId,
    setTemplateId,
    shareWarnings,
    sourceLabelById,
    spaceStats,
    templateId,
    universe,
    compareSeedNow,
    selectCivilization,
    selectGalaxy,
    selectPlanet,
    selectSystem,
  } = useUniverseAppModel({ initialPage });

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="创世工具栏">
        <div className="brand-block">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <div>
            <h1>Universe Genesis Sandbox</h1>
            <p>{RULESET_VERSION}</p>
          </div>
        </div>

        <div className="tool-strip">
          <label className="seed-field">
            <span>Seed</span>
            <input value={draftSeed} onChange={(event) => setDraftSeed(event.target.value)} />
          </label>

          <label className="template-field">
            <span>模板</span>
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value as UniverseTemplateId)}>
              {UNIVERSE_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          <button className="primary-action" type="button" onClick={createUniverse} title="按当前 seed 创世">
            <Sparkles size={17} />
            创世
          </button>
          <button className="icon-action" type="button" onClick={randomizeSeed} title="随机 seed">
            <Dices size={17} />
            随机
          </button>
          <button className="icon-action" type="button" onClick={copyShare} title="复制分享文本和链接">
            <Clipboard size={17} />
            {copyState}
          </button>
        </div>
      </section>

      <nav className="page-navigation" aria-label="主页面导航">
        {appPageOptions.map((page) => {
          const Icon = page.icon;
          return (
            <button
              className={activePage === page.id ? "active" : ""}
              key={page.id}
              type="button"
              onClick={() => setActivePage(page.id)}
              title={page.description}
            >
              <Icon size={17} />
              <span>{page.label}</span>
              <small>{page.description}</small>
            </button>
          );
        })}
      </nav>

      {activePage === "overview" && (
        <section className="page-stack" aria-label="创世总览">
          <section className="overview-band">
            <div className="universe-title">
              <p className="eyebrow">{universe.archetype}</p>
              <h2>{universe.name}</h2>
              <p>{universe.description}</p>
              {shareWarnings.length > 0 && (
                <div className="share-warning" role="status">
                  {shareWarnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="share-panel">
              <div>
                <span>标准 Seed</span>
                <strong>{universe.displaySeed}</strong>
              </div>
              <div>
                <span>分享码</span>
                <strong>{universe.shareCode}</strong>
              </div>
              <a href={universe.shareUrl} title="打开当前宇宙分享链接">
                <Link size={16} />
                分享链接
              </a>
              <button type="button" onClick={() => setActivePage("space")} title="查看代表性星系">
                <Telescope size={16} />
                探索星系
              </button>
              <button type="button" onClick={() => setActivePage("civilizations")} title="查看文明演化">
                <UsersRound size={16} />
                查看文明
              </button>
            </div>
          </section>

          <section className="overview-snapshot" aria-label="宇宙快照">
            <article>
              <span>纪元事件</span>
              <strong>{universe.timeline.length}</strong>
              <small>当前筛选显示 {filteredTimeline.length} 条</small>
            </article>
            <article>
              <span>代表性星系</span>
              <strong>{spaceStats.galaxyCount}</strong>
              <small>{spaceStats.planetCount} 颗行星样本</small>
            </article>
            <article>
              <span>文明样本</span>
              <strong>{civilizationStats.civilizationCount}</strong>
              <small>{civilizationStats.pathCount} 类文明路径</small>
            </article>
            <article>
              <span>神话系统</span>
              <strong>{civilizationStats.mythologyCount}</strong>
              <small>{civilizationStats.highRiskCount} 个高风险文明</small>
            </article>
          </section>

          <section className="metrics-panel" aria-label="宇宙指标">
          <SectionHeader icon={<RefreshCcw size={18} />} title="宇宙指标" text={universe.tagline} />
          <div className="metrics-grid">
            {Object.entries(universe.metrics).map(([key, metric]) => (
              <article className="metric-tile" key={key}>
                <div className="metric-topline">
                  <span>{metricName(key)}</span>
                  <strong>{metric.value}</strong>
                </div>
                <div className="meter" aria-hidden="true">
                  <span style={{ width: `${metric.value}%` }} />
                </div>
                <b>{metric.label}</b>
                <p>{metric.explanation}</p>
                {metric.influences && metric.influences.length > 0 && (
                  <div className="metric-influences">
                    {topInfluences(metric.influences).map((influence) => (
                      <span key={`${key}-${influence.sourceId}`}>
                        {influence.sourceLabel}
                        <b>{signed(influence.delta)}</b>
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
        </section>
      )}

      {activePage === "space" && (
        <SpaceExplorer
          universe={universe}
          stats={spaceStats}
          selectedGalaxy={selectedGalaxy}
          selectedSystem={selectedSystem}
          selectedPlanet={selectedPlanet}
          sourceLabelById={sourceLabelById}
          onSelectGalaxy={selectGalaxy}
          onSelectSystem={selectSystem}
          onSelectPlanet={selectPlanet}
        />
      )}

      {activePage === "civilizations" && (
        <CivilizationPanel
          universe={universe}
          stats={civilizationStats}
          selectedCivilization={selectedCivilization}
          sourceLabelById={sourceLabelById}
          onSelectCivilization={selectCivilization}
        />
      )}

      {activePage === "timeline" && (
        <section className="timeline-panel" aria-label="纪元时间线">
          <SectionHeader icon={<Sparkles size={18} />} title="纪元时间线" text={`${universe.timeline.length} 条关键事件，当前显示 ${filteredTimeline.length} 条`} />
          <div className="era-filter" aria-label="纪元筛选">
            {eraFilterOptions.map((option) => (
              <button
                className={eraFilter === option.id ? "active" : ""}
                key={option.id}
                type="button"
                onClick={() => setEraFilter(option.id)}
                title={`筛选${option.label}事件`}
              >
                <ListFilter size={14} />
                {option.label}
              </button>
            ))}
          </div>
          <div className="timeline-list">
            {filteredTimeline.map((event) => (
              <button
                className={event.id === selectedEvent.id ? "timeline-event active" : "timeline-event"}
                key={event.id}
                type="button"
                onClick={() => setSelectedEventId(event.id)}
              >
                <span>{event.ageLabel}</span>
                <strong>{event.title}</strong>
                <em>{eraName(event.era)}｜{event.effects.some((effect) => effect.affectsFuture) ? "影响后续" : eventTypeName(event.type)}</em>
              </button>
            ))}
          </div>
          <EventDetail event={selectedEvent} sourceLabelById={sourceLabelById} />
          <TimelineImpactPanel impact={universe.timelineImpact} sourceLabelById={sourceLabelById} />
        </section>
      )}

      {activePage === "laws" && (
        <section className="laws-panel" aria-label="宇宙法则">
          <SectionHeader icon={<RefreshCcw size={18} />} title="法则与解释" text="结构化法则会影响指标与事件" />
          <div className="law-list">
            {Object.values(universe.laws).map((law) => (
              <article className="law-row" key={law.id}>
                <div className="law-heading">
                  <span>{law.title}</span>
                  <strong>{law.rating.label}</strong>
                </div>
                <p>{law.rating.explanation}</p>
                <div className="law-tags">
                  {law.traits.map((trait) => (
                    <span key={trait}>{trait}</span>
                  ))}
                </div>
                <div className="structured-rules">
                  {law.rules.map((rule) => (
                    <div className="structured-rule" key={rule.id}>
                      <div>
                        <b>{rule.name}</b>
                        <strong>{rule.value}</strong>
                      </div>
                      <span>
                        {rule.label}｜{polarityName(rule.polarity)}
                      </span>
                      <p>{rule.explanation}</p>
                      <div className="effect-list">
                        {rule.effectTargets.map((target) => (
                          <em key={`${rule.id}-${target}`}>{metricName(target)}</em>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <small>{law.cost}</small>
              </article>
            ))}
          </div>
          <div className="interaction-list">
            <h4>法则关系</h4>
            {universe.lawInteractions.map((interaction) => (
              <article key={interaction.id}>
                <div>
                  <b>{interactionKindName(interaction.kind)}</b>
                  <strong>{signed(interaction.impact)}</strong>
                </div>
                <p>
                  {sourceLabelById.get(interaction.sourceLawId)} → {sourceLabelById.get(interaction.targetLawId)}
                </p>
                <small>{interaction.explanation}</small>
              </article>
            ))}
          </div>
          <div className="comparison-panel" aria-label="seed 法则对比">
            <SectionHeader icon={<Scale size={18} />} title="Seed 法则对比" text={comparison.summary} />
            <div className="compare-controls">
              <label>
                <span>对比 Seed</span>
                <input value={compareDraftSeed} onChange={(event) => setCompareDraftSeed(event.target.value)} />
              </label>
              <button type="button" onClick={compareSeedNow}>
                对比
              </button>
            </div>
            <div className="comparison-grid">
              {comparison.domainDiffs.map((diff) => (
                <article key={diff.domain}>
                  <div>
                    <span>{lawDomainName(diff.domain)}</span>
                    <strong>{signed(diff.delta)}</strong>
                  </div>
                  <p>
                    {diff.leftValue} → {diff.rightValue}
                  </p>
                  <small>
                    {diff.strongestLeftRule} / {diff.strongestRightRule}
                  </small>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {activePage === "logs" && (
        <section className="log-band" aria-label="观察日志">
          <LogColumn title="重要事件" items={universe.observationLog.importantEvents} />
          <LogColumn title="稀有发现" items={universe.observationLog.rareFindings} />
          <LogColumn title="潜在终局" items={universe.observationLog.possibleEndings} />
        </section>
      )}
    </main>
  );
}
