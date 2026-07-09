import { Clipboard, Dices, Link, ListFilter, RefreshCcw, Scale, Sparkles, Telescope } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  compareUniverseLaws,
  decodeShareParams,
  filterTimelineByEra,
  formatSeed,
  generateUniverse,
  normalizeSeed,
  RULESET_VERSION,
  UNIVERSE_TEMPLATES,
  type EraId,
  type Galaxy,
  type Planet,
  type StarSystem,
  type UniverseTemplateId,
} from "./sim";
import { LogColumn, SectionHeader } from "./components/common";
import { CivilizationPanel } from "./components/CivilizationPanel";
import { SpaceExplorer } from "./components/SpaceExplorer";
import { EventDetail, TimelineImpactPanel } from "./components/TimelinePanels";
import { eraName, eventTypeName, interactionKindName, lawDomainName, metricName, polarityName, signed } from "./ui/labels";
import { buildSourceLabelMap, summarizeCivilizations, summarizeSpace, topInfluences } from "./ui/selectors";

const initialShare = typeof window !== "undefined" ? decodeShareParams(window.location.search) : undefined;
const initialSeed = initialShare?.seed ?? "LUX-7F3A-91C2";
const initialTemplate = initialShare?.templateId ?? "high_magic";
const eraFilterOptions: Array<{ id: EraId | "all"; label: string }> = [
  { id: "all", label: "全部" },
  { id: "creation", label: "创世" },
  { id: "stars", label: "星辰" },
  { id: "elements", label: "元素" },
  { id: "life", label: "生命" },
  { id: "civilization", label: "文明" },
  { id: "myth", label: "神话" },
  { id: "ascension", label: "飞升" },
  { id: "ending", label: "终局" },
];

export function App() {
  const [draftSeed, setDraftSeed] = useState(formatSeed(initialSeed));
  const [activeSeed, setActiveSeed] = useState(normalizeSeed(initialSeed));
  const [templateId, setTemplateId] = useState<UniverseTemplateId>(initialTemplate);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [copyState, setCopyState] = useState("复制分享");
  const [shareWarnings] = useState<string[]>(initialShare?.warnings ?? []);
  const [compareDraftSeed, setCompareDraftSeed] = useState("ASH-44DE-0101");
  const [compareSeed, setCompareSeed] = useState(normalizeSeed("ASH-44DE-0101"));
  const [eraFilter, setEraFilter] = useState<EraId | "all">("all");
  const [selectedGalaxyId, setSelectedGalaxyId] = useState<string | undefined>();
  const [selectedSystemId, setSelectedSystemId] = useState<string | undefined>();
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | undefined>();
  const [selectedCivilizationId, setSelectedCivilizationId] = useState<string | undefined>();
  const copyResetTimerRef = useRef<number | undefined>(undefined);

  const universe = useMemo(() => generateUniverse({ seed: activeSeed, templateId }), [activeSeed, templateId]);
  const filteredTimeline = useMemo(() => filterTimelineByEra(universe.timeline, eraFilter), [universe.timeline, eraFilter]);
  const selectedEvent = filteredTimeline.find((event) => event.id === selectedEventId) ?? filteredTimeline[0] ?? universe.timeline[0];
  const comparison = useMemo(() => compareUniverseLaws(activeSeed, compareSeed, templateId), [activeSeed, compareSeed, templateId]);
  const selectedGalaxy = universe.galaxies.find((galaxy) => galaxy.id === selectedGalaxyId) ?? universe.galaxies[0];
  const selectedSystem = selectedGalaxy?.starSystems.find((system) => system.id === selectedSystemId) ?? selectedGalaxy?.starSystems[0];
  const selectedPlanet = selectedSystem?.planets.find((planet) => planet.id === selectedPlanetId) ?? selectedSystem?.planets[0];
  const selectedCivilization = universe.civilizations.find((civilization) => civilization.id === selectedCivilizationId) ?? universe.civilizations[0];
  const spaceStats = useMemo(() => summarizeSpace(universe), [universe]);
  const civilizationStats = useMemo(() => summarizeCivilizations(universe), [universe]);
  const sourceLabelById = useMemo(() => buildSourceLabelMap(universe), [universe]);

  useEffect(() => {
    setSelectedEventId(universe.timeline[0]?.id);
    const firstGalaxy = universe.galaxies[0];
    const firstSystem = firstGalaxy?.starSystems[0];
    const firstPlanet = firstSystem?.planets[0];
    setSelectedGalaxyId(firstGalaxy?.id);
    setSelectedSystemId(firstSystem?.id);
    setSelectedPlanetId(firstPlanet?.id);
    setSelectedCivilizationId(universe.civilizations[0]?.id);
  }, [universe.shareCode]);

  useEffect(() => {
    setSelectedEventId((current) => {
      if (current && filteredTimeline.some((event) => event.id === current)) {
        return current;
      }
      return filteredTimeline[0]?.id ?? universe.timeline[0]?.id;
    });
  }, [filteredTimeline, universe.timeline]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== undefined) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  function createUniverse() {
    setActiveSeed(normalizeSeed(draftSeed));
  }

  function randomizeSeed() {
    const nextSeed = createClientSeed();
    setDraftSeed(formatSeed(nextSeed));
    setActiveSeed(nextSeed);
  }

  async function copyShare() {
    const shareLink = `${window.location.origin}${window.location.pathname}${universe.shareUrl}`;
    const text = `${universe.shareText}\n${shareLink}`;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("剪贴板接口不可用。");
      }
      await navigator.clipboard.writeText(text);
      setCopyState("已复制");
    } catch {
      if (typeof window.prompt === "function") {
        window.prompt("复制分享内容", text);
        setCopyState("已打开复制框");
      } else {
        setCopyState("复制失败");
      }
    }
    scheduleCopyStateReset();
  }

  function compareSeedNow() {
    setCompareSeed(normalizeSeed(compareDraftSeed));
  }

  function selectGalaxy(galaxy: Galaxy) {
    const firstSystem = galaxy.starSystems[0];
    const firstPlanet = firstSystem?.planets[0];
    setSelectedGalaxyId(galaxy.id);
    setSelectedSystemId(firstSystem?.id);
    setSelectedPlanetId(firstPlanet?.id);
  }

  function selectSystem(system: StarSystem) {
    setSelectedSystemId(system.id);
    setSelectedPlanetId(system.planets[0]?.id);
  }

  function selectPlanet(planet: Planet) {
    setSelectedPlanetId(planet.id);
  }

  function selectCivilization(civilization: NonNullable<typeof selectedCivilization>) {
    setSelectedCivilizationId(civilization.id);
  }

  function scheduleCopyStateReset() {
    if (copyResetTimerRef.current !== undefined) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyState("复制分享");
      copyResetTimerRef.current = undefined;
    }, 1400);
  }

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
          <a href="#space-explorer" title="查看代表性星系">
            <Telescope size={16} />
            探索星系
          </a>
        </div>
      </section>

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

      <CivilizationPanel
        universe={universe}
        stats={civilizationStats}
        selectedCivilization={selectedCivilization}
        sourceLabelById={sourceLabelById}
        onSelectCivilization={selectCivilization}
      />

      <section className="dashboard-grid">
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
      </section>

      <section className="log-band" aria-label="观察日志">
        <LogColumn title="重要事件" items={universe.observationLog.importantEvents} />
        <LogColumn title="稀有发现" items={universe.observationLog.rareFindings} />
        <LogColumn title="潜在终局" items={universe.observationLog.possibleEndings} />
      </section>
    </main>
  );
}

function createClientSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12)
    .toUpperCase();
}
