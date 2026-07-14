import { ListFilter, Sparkles } from "../icons";
import type { EraId, TimelineEvent, UniverseSummary } from "../../sim";
import { eraName, eventTypeName } from "../../ui/labels";
import { ResultValue, SectionHeader, TraceCauseButton } from "../common";
import { EventDetail, TimelineImpactPanel } from "../TimelinePanels";

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

export function TimelinePage({
  universe,
  filteredTimeline,
  selectedEvent,
  eraFilter,
  sourceLabelById,
  onEraFilterChange,
  onEventSelect,
}: {
  universe: UniverseSummary;
  filteredTimeline: TimelineEvent[];
  selectedEvent: TimelineEvent;
  eraFilter: EraId | "all";
  sourceLabelById: Map<string, string>;
  onEraFilterChange: (era: EraId | "all") => void;
  onEventSelect: (eventId: string) => void;
}) {
  return <section className="timeline-panel" aria-label="纪元时间线">
    <SectionHeader icon={<Sparkles size={18} />} title="纪元时间线" text={`${universe.timeline.length} 条关键事件，当前显示 ${filteredTimeline.length} 条`} subjectId="timeline.count" />
    <div className="era-filter" aria-label="纪元筛选">
      {eraFilterOptions.map((option) => <button className={eraFilter === option.id ? "active" : ""} key={option.id} type="button" onClick={() => onEraFilterChange(option.id)} title={`筛选${option.label}事件`}>
        <ListFilter size={14} />{option.label}
      </button>)}
    </div>
    <div className="timeline-list">
      {filteredTimeline.map((event) => <div className="timeline-choice" key={event.id}>
        <button className={event.id === selectedEvent.id ? "timeline-event active" : "timeline-event"} type="button" onClick={() => onEventSelect(event.id)} aria-label={`选择事件${event.title}`}>选择</button>
        <ResultValue subjectId={event.id} label={`${event.title}列表元数据`} strategy="cause" value={{ ageLabel: event.ageLabel, title: event.title, era: event.era, affectsFuture: event.effects.some((effect) => effect.affectsFuture), type: event.type }}>
          {event.ageLabel}｜{event.title}｜{eraName(event.era)}｜{event.effects.some((effect) => effect.affectsFuture) ? "影响后续" : eventTypeName(event.type)}
        </ResultValue>
        <TraceCauseButton subjectId={event.id} label={event.title} />
      </div>)}
    </div>
    <EventDetail event={selectedEvent} sourceLabelById={sourceLabelById} />
    <TimelineImpactPanel impact={universe.timelineImpact} sourceLabelById={sourceLabelById} />
  </section>;
}
