import type { TimelineEvent, TimelineImpactSummary } from "../sim";
import { eraName, eventTypeName } from "../ui/labels";
import { ResultValue, TraceCauseButton } from "./common";

export function EventDetail({ event, sourceLabelById }: {
  event: TimelineEvent;
  sourceLabelById: Map<string, string>;
}) {
  return (
    <article className="event-detail">
      <ResultValue subjectId={event.id} label={`${event.title}元数据`} strategy="cause" value={{ era: event.era, type: event.type, location: event.location, importance: event.importance }}>
        {eraName(event.era)}｜{eventTypeName(event.type)}｜{event.location}｜重要度 {event.importance}
      </ResultValue>
      <h3><ResultValue subjectId={event.id} label={`${event.title}标题`} strategy="cause" value={event.title}>{event.title}</ResultValue></h3>
      <p><ResultValue subjectId={event.id} label={`${event.title}描述`} strategy="cause" value={event.description}>{event.description}</ResultValue></p>
      <TraceCauseButton subjectId={event.id} label={event.title} />
      <div className="detail-columns">
        <div>
          <b>原因</b>
          {event.causes.map((cause) => (
            <small key={cause}>{cause}</small>
          ))}
        </div>
        <div>
          <b>后果</b>
          {event.effects.map((effect, index) => (
            <small key={`${effect.metric}-${effect.description}`}>
              <ResultValue subjectId={`${event.id}.effect.${index + 1}`} label={`${event.title}效果`} strategy="cause" value={{ description: effect.description, affectsFuture: effect.affectsFuture }}>
              {effect.description}
              {effect.affectsFuture ? "（影响后续）" : ""}
              </ResultValue>
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
        <TraceCauseButton subjectId="timeline-impact" label="时间线影响摘要" />
      </div>
      <div className="phase4-bias-grid">
        {topBiases.map((bias) => (
          <section key={bias.id}>
            <div>
              <b>{bias.label}</b>
              <strong><ResultValue subjectId={`timeline-bias.${bias.id}`} label={bias.label} strategy="cause" value={bias.value}>{bias.value}</ResultValue></strong>
            </div>
            <p><ResultValue subjectId={`timeline-bias.${bias.id}`} label={`${bias.label}解释`} strategy="cause" value={bias.explanation}>{bias.explanation}</ResultValue></p>
            <small>{bias.sourceEventIds.map((eventId) => sourceLabelById.get(eventId) ?? eventId).join(" / ")}</small>
          </section>
        ))}
      </div>
    </article>
  );
}
