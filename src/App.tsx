import { Clipboard, Dices, Link, ListFilter, RefreshCcw, Scale, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  type TimelineImpactSummary,
  type TimelineEvent,
  type UniverseTemplateId,
} from "./sim";

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
  const copyResetTimerRef = useRef<number | undefined>(undefined);

  const universe = useMemo(() => generateUniverse({ seed: activeSeed, templateId }), [activeSeed, templateId]);
  const filteredTimeline = useMemo(() => filterTimelineByEra(universe.timeline, eraFilter), [universe.timeline, eraFilter]);
  const selectedEvent = filteredTimeline.find((event) => event.id === selectedEventId) ?? filteredTimeline[0] ?? universe.timeline[0];
  const comparison = useMemo(() => compareUniverseLaws(activeSeed, compareSeed, templateId), [activeSeed, compareSeed, templateId]);
  const sourceLabelById = useMemo(() => {
    const lawEntries = Object.values(universe.laws).flatMap((domain) => domain.rules.map((rule) => [rule.id, `${rule.name}（${rule.value}）`] as const));
    const interactionEntries = universe.lawInteractions.map((interaction) => [interaction.id, interactionKindName(interaction.kind)] as const);
    const metricEntries = Object.keys(universe.metrics).map((metricId) => [`metric.${metricId}`, metricName(metricId)] as const);
    const eventEntries = universe.timeline.map((event) => [event.id, event.title] as const);
    const entries = [...lawEntries, ...interactionEntries, ...metricEntries, ...eventEntries];
    return new Map(entries);
  }, [universe.laws, universe.lawInteractions, universe.metrics, universe.timeline]);

  useEffect(() => {
    setSelectedEventId(universe.timeline[0]?.id);
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
        </div>
      </section>

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

function SectionHeader({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <header className="section-header">
      <div>{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </header>
  );
}

function EventDetail({ event, sourceLabelById }: { event: TimelineEvent; sourceLabelById: Map<string, string> }) {
  return (
    <article className="event-detail">
      <span>
        {eraName(event.era)}｜{eventTypeName(event.type)}｜{event.location}｜重要度 {event.importance}
      </span>
      <h3>{event.title}</h3>
      <p>{event.description}</p>
      <div className="detail-columns">
        <div>
          <b>原因</b>
          {event.causes.map((cause) => (
            <small key={cause}>{cause}</small>
          ))}
        </div>
        <div>
          <b>后果</b>
          {event.effects.map((effect) => (
            <small key={`${effect.metric}-${effect.description}`}>
              {effect.description}
              {effect.affectsFuture ? "（影响后续）" : ""}
            </small>
          ))}
        </div>
      </div>
      <div className="event-causality">
        <div>
          <b>影响来源</b>
          {[...new Set(event.sourceIds)].map((sourceId) => (
            <small key={sourceId}>{sourceLabelById.get(sourceId) ?? sourceId}</small>
          ))}
        </div>
        <div>
          <b>前序事件</b>
          {event.triggeredByEventIds.length > 0 ? (
            event.triggeredByEventIds.map((sourceId) => <small key={sourceId}>{sourceLabelById.get(sourceId) ?? sourceId}</small>)
          ) : (
            <small>纪元锚点事件</small>
          )}
        </div>
        <div>
          <b>因果解释</b>
          {event.causalNotes.map((note) => (
            <small key={note}>{note}</small>
          ))}
        </div>
      </div>
    </article>
  );
}

function TimelineImpactPanel({ impact, sourceLabelById }: { impact: TimelineImpactSummary; sourceLabelById: Map<string, string> }) {
  const topBiases = [...impact.localBiases].sort((left, right) => right.value - left.value).slice(0, 4);

  return (
    <article className="phase4-panel">
      <div>
        <h4>局部对象线索</h4>
        <span>{impact.summary}</span>
      </div>
      <div className="phase4-bias-grid">
        {topBiases.map((bias) => (
          <section key={bias.id}>
            <div>
              <b>{bias.label}</b>
              <strong>{bias.value}</strong>
            </div>
            <p>{bias.explanation}</p>
            <small>{bias.sourceEventIds.map((eventId) => sourceLabelById.get(eventId) ?? eventId).join(" / ")}</small>
          </section>
        ))}
      </div>
    </article>
  );
}

function LogColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <article>
      <h3>{title}</h3>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </article>
  );
}

function metricName(key: string): string {
  const names: Record<string, string> = {
    age: "宇宙年龄",
    stability: "稳定度",
    lifePotential: "生命潜力",
    civilizationPotential: "文明潜力",
    magicIntensity: "魔法强度",
    divineActivity: "神性活跃",
    causalityIntegrity: "因果完整",
    timeline: "时间线",
    laws: "法则压力",
  };
  return names[key] ?? key;
}

function lawDomainName(key: string): string {
  const names: Record<string, string> = {
    physics: "物理",
    magic: "魔法",
    life: "生命",
    consciousness: "意识",
    divinity: "神性",
    causality: "因果",
  };
  return names[key] ?? key;
}

function polarityName(value: string): string {
  const names: Record<string, string> = {
    support: "支撑",
    pressure: "压力",
    volatile: "波动",
  };
  return names[value] ?? value;
}

function interactionKindName(value: string): string {
  const names: Record<string, string> = {
    synergy: "协同",
    conflict: "冲突",
    constraint: "约束",
  };
  return names[value] ?? value;
}

function eventTypeName(value: string): string {
  const names: Record<string, string> = {
    creation: "创世事件",
    stars: "星辰事件",
    elements: "元素事件",
    life: "生命事件",
    civilization: "文明事件",
    myth: "神话事件",
    ascension: "飞升事件",
    ending: "终局事件",
    anomaly: "异常事件",
  };
  return names[value] ?? value;
}

function topInfluences(influences: NonNullable<ReturnType<typeof generateUniverse>["metrics"]["age"]["influences"]>) {
  return [...influences].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta)).slice(0, 2);
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function eraName(era: string): string {
  const names: Record<string, string> = {
    creation: "创世",
    stars: "星辰",
    elements: "元素",
    life: "生命",
    civilization: "文明",
    myth: "神话",
    ascension: "飞升",
    ending: "终局",
  };
  return names[era] ?? era;
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
