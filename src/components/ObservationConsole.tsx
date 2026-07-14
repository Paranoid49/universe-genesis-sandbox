import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Radar } from "./icons";
import { useMemo, useState } from "react";
import type { UniverseSummary } from "../sim";
import {
  buildObservationProjection,
  observationHaloRadius,
  observationOverlayOptions,
  type ObservationLevel,
  type ObservationNode,
  type ObservationOverlay,
} from "../ui/observationProjection";
import { eraName } from "../ui/labels";
import type { CausalProjectionRequest } from "../ui/causalView";
import {
  buildObservationCausalProjection,
  observationTraceOptions,
  type ObservationTraceAspect,
} from "../ui/observationCausalProjection";
import { SectionHeader, TraceCauseButton } from "./common";

export function ObservationConsole({ universe, onTraceCausalProjection }: {
  universe: UniverseSummary;
  onTraceCausalProjection: (request: CausalProjectionRequest) => void;
}) {
  const [level, setLevel] = useState<ObservationLevel>("universe");
  const [galaxyId, setGalaxyId] = useState<string>();
  const [systemId, setSystemId] = useState<string>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [overlay, setOverlay] = useState<ObservationOverlay>("life");
  const [eventIndex, setEventIndex] = useState(0);
  const projection = useMemo(
    () => buildObservationProjection(universe, level, galaxyId, systemId),
    [universe, level, galaxyId, systemId],
  );
  const selectedNode = projection.nodes.find((node) => node.id === selectedNodeId) ?? projection.nodes[0];
  const currentEvent = universe.timeline[eventIndex] ?? universe.timeline[0];

  function activateNode(node: ObservationNode) {
    setSelectedNodeId(node.id);
    if (node.kind === "galaxy") {
      setGalaxyId(node.id);
      setSystemId(undefined);
      setLevel("galaxy");
    } else if (node.kind === "system") {
      setSystemId(node.id);
      setLevel("system");
    }
  }

  function navigate(nextLevel: ObservationLevel) {
    setLevel(nextLevel);
    setSelectedNodeId(undefined);
    if (nextLevel === "universe") {
      setGalaxyId(undefined);
      setSystemId(undefined);
    } else if (nextLevel === "galaxy") {
      setSystemId(undefined);
    }
  }

  function traceObservation(aspect: ObservationTraceAspect, returnFocusKey: string) {
    if (!selectedNode) return;
    onTraceCausalProjection({
      universe,
      returnFocusKey,
      buildProjection: (causalUniverse) => buildObservationCausalProjection(causalUniverse, projection, selectedNode, aspect),
    });
  }

  return (
    <section className="observation-panel" aria-label="可视化宇宙观察台">
      <SectionHeader icon={<Radar size={18} />} title="可视化宇宙观察台" text="稳定二维投影，不改写宇宙生成结果" />
      <div className="observation-toolbar">
        <div className="observation-breadcrumbs" aria-label="观察层级">
          {projection.breadcrumbs.map((item, index) => (
            <button key={item.id} type="button" disabled={index === projection.breadcrumbs.length - 1} onClick={() => navigate(item.level)}>
              {item.label}
            </button>
          ))}
        </div>
        <label>
          <span>信息叠层</span>
          <select value={overlay} onChange={(event) => setOverlay(event.target.value as ObservationOverlay)}>
            {observationOverlayOptions.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.description}</option>)}
          </select>
        </label>
      </div>

      <div className="observation-layout">
        <div className="star-map-card">
          <div className="observation-heading">
            <div><h3>{projection.title}</h3><p>{projection.textualSummary}</p></div>
            <span>图例：节点尺寸表示结构规模，光环与数值表示{overlayLabel(overlay)}强度</span>
          </div>
          <svg className="star-map" viewBox="0 0 100 100" role="img" aria-label={`${projection.title}，${projection.nodes.length} 个节点`}>
            <title>{projection.title}</title>
            {projection.nodes.map((node) => {
              const intensity = node.intensity[overlay];
              const active = selectedNode?.id === node.id;
              const eventRelated = Boolean(currentEvent && node.relatedEventIds.includes(currentEvent.id));
              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  className={["observation-node", active ? "active" : "", eventRelated ? "event-related" : ""].filter(Boolean).join(" ")}
                  transform={`translate(${node.x} ${node.y})`}
                  role="button"
                  {...{ tabindex: 0 }}
                  aria-label={`${node.label}，${overlayLabel(overlay)}强度 ${intensity}${eventRelated ? "，与当前事件关联" : ""}`}
                  onClick={() => activateNode(node)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activateNode(node);
                    }
                  }}
                >
                  <circle className="node-halo" r={observationHaloRadius(node, overlay)} opacity={0.12 + intensity / 130} />
                  <circle className="node-core" r={node.size} opacity={0.35 + node.brightness / 155} />
                  <text y={node.size + 5} textAnchor="middle">{shortLabel(node.label)}</text>
                </g>
              );
            })}
          </svg>
          <div className="observation-node-list" aria-label="可操作节点列表">
            {projection.nodes.map((node) => (
              <button data-node-id={node.id} className={[selectedNode?.id === node.id ? "active" : "", currentEvent && node.relatedEventIds.includes(currentEvent.id) ? "event-related" : ""].filter(Boolean).join(" ")} key={node.id} type="button" onClick={() => activateNode(node)}>
                <span>{node.label}</span><small>{node.detail}</small><strong>{node.intensity[overlay]}</strong>
              </button>
            ))}
          </div>
        </div>

        <aside className="observation-detail" aria-live="polite">
          <h3>{selectedNode?.label ?? "暂无节点"}</h3>
          <p>{selectedNode?.detail ?? "当前层级没有可观察对象。"}</p>
          {selectedNode && <>
            <dl>{observationOverlayOptions.map((item) => <div key={item.id}><dt>{item.label}</dt><dd>{selectedNode.intensity[item.id]}</dd></div>)}</dl>
            <small>稳定 ID：{selectedNode.id}</small>
            <small>关联时间线事件：{selectedNode.relatedEventIds.length} 条</small>
            <section className="observation-causal-actions" aria-label="追溯当前观测">
              <h4>追溯当前观测</h4>
              <p>摘要以当前节点作为范围上下文；尚未手动选择时使用列表首节点。</p>
              <div>
                {observationTraceOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    data-causal-focus={`observation.${selectedNode.id}.action.${option.id}`}
                    onClick={() => traceObservation(option.id, `observation.${selectedNode.id}.action.${option.id}`)}
                  >{option.label}</button>
                ))}
              </div>
            </section>
          </>}
        </aside>
      </div>

      <section className="observation-timeline" aria-label="时间线逐事件浏览">
        <div className="timeline-playback-controls">
          <button type="button" onClick={() => setEventIndex(0)} disabled={eventIndex === 0} title="第一条事件"><ChevronsLeft size={16} />第一条</button>
          <button type="button" onClick={() => setEventIndex((value) => Math.max(0, value - 1))} disabled={eventIndex === 0} title="上一条事件"><ChevronLeft size={16} />上一条</button>
          <label><span>时间位置 {eventIndex + 1} / {universe.timeline.length}</span><input type="range" min="0" max={Math.max(0, universe.timeline.length - 1)} value={eventIndex} onChange={(event) => setEventIndex(Number(event.target.value))} /></label>
          <button type="button" onClick={() => setEventIndex((value) => Math.min(universe.timeline.length - 1, value + 1))} disabled={eventIndex >= universe.timeline.length - 1} title="下一条事件"><ChevronRight size={16} />下一条</button>
          <button type="button" onClick={() => setEventIndex(universe.timeline.length - 1)} disabled={eventIndex >= universe.timeline.length - 1} title="最后一条事件"><ChevronsRight size={16} />最后一条</button>
        </div>
        {currentEvent && <article>
          <span>{currentEvent.ageLabel}</span><strong>{currentEvent.title}</strong><p>{currentEvent.description}</p>
          <TraceCauseButton subjectId={currentEvent.id} label={currentEvent.title} />
          <small>{eraName(currentEvent.era)} · {currentEvent.location}</small>
          <small>关联来源：{currentEvent.sourceIds.length > 0 ? currentEvent.sourceIds.join("、") : "无显式来源"}</small>
          <small>当前层级关联节点：{relatedNodeLabels(projection.nodes, currentEvent.id)}</small>
          <button
            type="button"
            data-causal-focus={`observation.${selectedNode?.id}.timeline.related-events`}
            onClick={() => selectedNode && traceObservation("related-events", `observation.${selectedNode.id}.timeline.related-events`)}
            disabled={!selectedNode}
          >查看当前层级事件关联原因</button>
        </article>}
      </section>
    </section>
  );
}

function shortLabel(label: string): string {
  return label.length > 8 ? `${label.slice(0, 7)}…` : label;
}

function overlayLabel(overlay: ObservationOverlay): string {
  return observationOverlayOptions.find((item) => item.id === overlay)?.label ?? overlay;
}

function relatedNodeLabels(nodes: ObservationNode[], eventId: string): string {
  const labels = nodes.filter((node) => node.relatedEventIds.includes(eventId)).map((node) => node.label);
  return labels.length > 0 ? labels.join("、") : "无";
}
