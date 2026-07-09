import type { TimelineEvent, TimelineImpactSummary } from "../sim";
import { eraName, eventTypeName } from "../ui/labels";

export function EventDetail({ event, sourceLabelById }: { event: TimelineEvent; sourceLabelById: Map<string, string> }) {
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

export function TimelineImpactPanel({ impact, sourceLabelById }: { impact: TimelineImpactSummary; sourceLabelById: Map<string, string> }) {
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
