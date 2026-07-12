import { Link, ListFilter, RefreshCcw, Scale, Sparkles, Telescope, UsersRound } from "lucide-react";
import { LogColumn, SectionHeader } from "./components/common";
import { CivilizationPanel } from "./components/CivilizationPanel";
import { PageNavigation, UniverseToolbar } from "./components/AppChrome";
import { MiraclePanel } from "./components/MiraclePanel";
import { ObservationConsole } from "./components/ObservationConsole";
import { SpaceExplorer } from "./components/SpaceExplorer";
import { EventDetail, TimelineImpactPanel } from "./components/TimelinePanels";
import { UniverseLibrary } from "./components/UniverseLibrary";
import { eraName, eventTypeName, interactionKindName, lawDomainName, metricName, polarityName, signed } from "./ui/labels";
import { topInfluences } from "./ui/selectors";
import { eraFilterOptions, useUniverseAppModel, type AppPageId } from "./ui/useUniverseAppModel";
export type AppProps = {
  initialPage?: AppPageId;
  search?: string;
};
export function App({ initialPage = "overview", search }: AppProps = {}) {
  const {
    activePage,
    applySelectedMiracle,
    civilizationStats,
    clearInterventions,
    compareDraftSeed,
    comparison,
    copyShare,
    copyState,
    createUniverse,
    draftSeed,
    eraFilter,
    filteredTimeline,
    compareInputError,
    randomizeSeed,
    restoreArchivedUniverse,
    selectedCivilization,
    selectedEvent,
    selectedGalaxy,
    selectedMiracleTargetId,
    selectedMiracleType,
    selectedPlanet,
    selectedSystem,
    seedInputError,
    setActivePage,
    setCompareDraftSeed,
    setDraftSeed,
    setEraFilter,
    setSelectedMiracleTargetId,
    setSelectedMiracleType,
    setSelectedEventId,
    setTemplateId,
    shareWarnings,
    sourceLabelById,
    spaceStats,
    templateId,
    miracleTargetOptions,
    universe,
    compareSeedNow,
    selectCivilization,
    selectGalaxy,
    selectPlanet,
    selectSystem,
  } = useUniverseAppModel({ initialPage, search });
  return (
    <main className="app-shell">
      <UniverseToolbar
        draftSeed={draftSeed}
        templateId={templateId}
        copyState={copyState}
        inputError={seedInputError}
        onDraftSeedChange={setDraftSeed}
        onTemplateChange={setTemplateId}
        onCreate={createUniverse}
        onRandomize={randomizeSeed}
        onCopy={copyShare}
      />
      <PageNavigation activePage={activePage} onChange={setActivePage} />
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
      {activePage === "observe" && <ObservationConsole key={universe.shareCode} universe={universe} />}
      {activePage === "library" && <UniverseLibrary universe={universe} onRestore={restoreArchivedUniverse} />}

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

      {activePage === "miracles" && (
        <MiraclePanel
          universe={universe}
          targetOptions={miracleTargetOptions}
          selectedMiracleType={selectedMiracleType}
          selectedTargetId={selectedMiracleTargetId}
          onSelectMiracleType={setSelectedMiracleType}
          onSelectTarget={setSelectedMiracleTargetId}
          onApplyMiracle={applySelectedMiracle}
          onClearInterventions={clearInterventions}
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
          <div className="law-list" tabIndex={0} aria-label="宇宙法则列表">
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
            <h3>法则关系</h3>
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
          {comparison && <div className="comparison-panel" aria-label="seed 法则对比">
            <SectionHeader icon={<Scale size={18} />} title="Seed 法则对比" text={comparison.summary} />
            <div className="compare-controls">
              <label>
                <span>对比 Seed</span>
                <input aria-invalid={Boolean(compareInputError)} aria-describedby={compareInputError ? "compare-seed-error" : undefined} value={compareDraftSeed} onChange={(event) => setCompareDraftSeed(event.target.value)} />
              </label>
              <button type="button" onClick={compareSeedNow}>
                对比
              </button>
            </div>
            {compareInputError && <p className="input-error" id="compare-seed-error" role="alert">{compareInputError}</p>}
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
          </div>}
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
