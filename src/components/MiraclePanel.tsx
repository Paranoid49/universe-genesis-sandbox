import { ScrollText, Sparkles } from "./icons";
import type { MiracleType, UniverseSummary } from "../sim";
import { metricName, miracleOveruseLevelName, miracleTargetKindName, miracleTypeName, signed } from "../ui/labels";
import type { MiracleTargetOption } from "../ui/useUniverseAppModel";
import { SectionHeader, StatTile } from "./common";

export function MiraclePanel({
  universe,
  targetOptions,
  selectedMiracleType,
  selectedTargetId,
  onSelectMiracleType,
  onSelectTarget,
  onApplyMiracle,
  onClearInterventions,
}: {
  universe: UniverseSummary;
  targetOptions: MiracleTargetOption[];
  selectedMiracleType: MiracleType;
  selectedTargetId?: string;
  onSelectMiracleType: (type: MiracleType) => void;
  onSelectTarget: (targetId: string) => void;
  onApplyMiracle: () => void;
  onClearInterventions: () => void;
}) {
  const state = universe.miracleState;
  const selectedDefinition = state.availableMiracles.find((definition) => definition.type === selectedMiracleType) ?? state.availableMiracles[0];
  const canApply = targetOptions.length > 0 && Boolean(selectedTargetId);

  return (
    <section className="miracle-panel" aria-label="造物主干预">
      <SectionHeader icon={<Sparkles size={18} />} title="造物主干预" text={state.summary} />
      <div className="miracle-stats" aria-label="干预统计">
        <StatTile label="奇迹点" value={state.remainingMiraclePoints} />
        <StatTile label="已消耗" value={state.spentMiraclePoints} />
        <StatTile label="因果压力" value={state.causalityStrain} />
        <div>
          <span>反噬状态</span>
          <strong>{miracleOveruseLevelName(state.overuseLevel)}</strong>
        </div>
      </div>

      <div className="miracle-grid">
        <section className="miracle-controls" aria-label="奇迹选择">
          <h4>奇迹模式</h4>
          <label>
            <span>奇迹类型</span>
            <select value={selectedMiracleType} onChange={(event) => onSelectMiracleType(event.target.value as MiracleType)}>
              {state.availableMiracles.map((definition) => (
                <option key={definition.type} value={definition.type}>
                  {definition.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>干预目标</span>
            <select value={selectedTargetId ?? ""} onChange={(event) => onSelectTarget(event.target.value)} disabled={targetOptions.length === 0}>
              {targetOptions.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          <div className="miracle-definition">
            <b>{selectedDefinition.title}</b>
            <p>{selectedDefinition.description}</p>
            <small>目标类型：{miracleTargetKindName(selectedDefinition.targetKind)}</small>
            <small>
              代价：{selectedDefinition.cost.miraclePoints} 奇迹点 / 因果压力 {selectedDefinition.cost.causalityStrain}
            </small>
            <small>
              效果：{metricName(selectedDefinition.effect.metric)} {signed(selectedDefinition.effect.delta)} / {selectedDefinition.probabilityShift.explanation}
            </small>
          </div>
          <div className="miracle-actions">
            <button className="primary-action" type="button" onClick={onApplyMiracle} disabled={!canApply}>
              <Sparkles size={16} />
              施加奇迹
            </button>
            <button type="button" onClick={onClearInterventions} disabled={state.appliedMiracles.length === 0}>
              清除干预
            </button>
          </div>
        </section>

        <section className="miracle-summary" aria-label="概率变化">
          <h4>概率变化</h4>
          {state.probabilityShifts.length > 0 ? (
            state.probabilityShifts.map((shift, index) => (
              <article key={`${shift.eventType}-${index}`}>
                <span>{miracleTypeName(state.appliedMiracles[index]?.type ?? selectedMiracleType)}</span>
                <b>
                  {shift.eventType} {signed(shift.delta)}
                </b>
                <p>{shift.explanation}</p>
              </article>
            ))
          ) : (
            <p>当前尚未施加奇迹，后续事件概率未被干预。</p>
          )}
          <h4>指标变化</h4>
          <div className="miracle-deltas">
            {Object.entries(state.metricDeltas).map(([metricId, delta]) => (
              <span key={metricId}>
                {metricName(metricId)}
                <b>{signed(delta)}</b>
              </span>
            ))}
          </div>
        </section>

        <section className="intervention-log" aria-label="干预日志">
          <h4>
            <ScrollText size={16} />
            干预日志
          </h4>
          {state.interventionLog.length > 0 ? (
            state.interventionLog.map((entry) => (
              <article key={entry.id}>
                <span>
                  {entry.ageLabel}｜{miracleTypeName(entry.miracleType)}｜{entry.targetLabel}
                </span>
                <b>{entry.directResult}</b>
                <p>{entry.longTermConsequence}</p>
                {(state.appliedMiracles.find((miracle) => miracle.id === entry.miracleId)?.targetMutations ?? []).map((mutation) => (
                  <small key={`${mutation.targetId}-${mutation.field}`}>
                    实体变化：{mutation.field} 从 {String(mutation.before ?? "无")} 变为 {String(mutation.after ?? "无")}，{mutation.explanation}
                  </small>
                ))}
              </article>
            ))
          ) : (
            <p>当前宇宙处于观察者模式，没有干预日志。</p>
          )}
          {state.backlashEvents.map((event) => (
            <article className="backlash-entry" key={event.id}>
              <span>{event.ageLabel}｜反噬</span>
              <b>{event.title}</b>
              <p>{event.description}</p>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
