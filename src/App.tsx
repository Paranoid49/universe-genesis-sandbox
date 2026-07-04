import { Clipboard, Dices, Link, RefreshCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  decodeShareParams,
  formatSeed,
  generateUniverse,
  normalizeSeed,
  RULESET_VERSION,
  UNIVERSE_TEMPLATES,
  type TimelineEvent,
  type UniverseTemplateId,
} from "./sim";

const initialShare = typeof window !== "undefined" ? decodeShareParams(window.location.search) : undefined;
const initialSeed = initialShare?.seed ?? "LUX-7F3A-91C2";
const initialTemplate = initialShare?.templateId ?? "high_magic";

export function App() {
  const [draftSeed, setDraftSeed] = useState(formatSeed(initialSeed));
  const [activeSeed, setActiveSeed] = useState(normalizeSeed(initialSeed));
  const [templateId, setTemplateId] = useState<UniverseTemplateId>(initialTemplate);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [copyState, setCopyState] = useState("复制分享");
  const [shareWarnings] = useState<string[]>(initialShare?.warnings ?? []);

  const universe = useMemo(() => generateUniverse({ seed: activeSeed, templateId }), [activeSeed, templateId]);
  const selectedEvent = universe.timeline.find((event) => event.id === selectedEventId) ?? universe.timeline[0];

  useEffect(() => {
    setSelectedEventId(universe.timeline[0]?.id);
  }, [universe.shareCode]);

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
    await navigator.clipboard.writeText(text);
    setCopyState("已复制");
    window.setTimeout(() => setCopyState("复制分享"), 1200);
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
              </article>
            ))}
          </div>
        </section>

        <section className="timeline-panel" aria-label="纪元时间线">
          <SectionHeader icon={<Sparkles size={18} />} title="纪元时间线" text={`${universe.timeline.length} 条关键事件`} />
          <div className="timeline-list">
            {universe.timeline.map((event) => (
              <button
                className={event.id === selectedEvent.id ? "timeline-event active" : "timeline-event"}
                key={event.id}
                type="button"
                onClick={() => setSelectedEventId(event.id)}
              >
                <span>{event.ageLabel}</span>
                <strong>{event.title}</strong>
                <em>{eraName(event.era)}</em>
              </button>
            ))}
          </div>
          <EventDetail event={selectedEvent} />
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
                <small>{law.cost}</small>
              </article>
            ))}
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

function SectionHeader({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
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

function EventDetail({ event }: { event: TimelineEvent }) {
  return (
    <article className="event-detail">
      <span>{eraName(event.era)}｜重要度 {event.importance}</span>
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
            <small key={`${effect.metric}-${effect.description}`}>{effect.description}</small>
          ))}
        </div>
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
  };
  return names[key] ?? key;
}

function eraName(era: string): string {
  const names: Record<string, string> = {
    creation: "创世",
    stars: "星辰",
    life: "生命",
    civilization: "文明",
    myth: "神话",
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
