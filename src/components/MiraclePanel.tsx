import { ScrollText, Sparkles } from "./icons";
import type { MiracleType, UniverseSummary } from "../sim";
import { metricName, miracleOveruseLevelName, miracleTargetKindName, miracleTypeName, signed } from "../ui/labels";
import type { MiracleTargetOption } from "../ui/useUniverseAppModel";
import { ResultValue, SectionHeader, StatTile, TraceCauseButton } from "./common";

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
      <SectionHeader icon={<Sparkles size={18} />} title="造物主干预" text={state.summary} subjectId="miracle-state" resultValue={state.summary} />
      <div className="miracle-stats" aria-label="干预统计">
        <StatTile label="奇迹点" value={state.remainingMiraclePoints} subjectId="miracle-state.remaining" />
        <StatTile label="已消耗" value={state.spentMiraclePoints} subjectId="miracle-state.spent" />
        <StatTile label="因果压力" value={state.causalityStrain} subjectId="miracle-state.causality-strain" />
        <div>
          <span>反噬状态</span>
          <strong><ResultValue subjectId="miracle-state.overuseLevel" label="反噬状态" strategy="state" value={state.overuseLevel}>{miracleOveruseLevelName(state.overuseLevel)}</ResultValue></strong>
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
            state.appliedMiracles.flatMap((miracle) => miracle.probabilityShifts.map((shift, index) => (
              <article key={`${miracle.id}-${index}`}>
                <span><ResultValue subjectId={`${miracle.id}.type`} label="奇迹类型" strategy="state" value={miracle.type}>{miracleTypeName(miracle.type)}</ResultValue></span>
                <b>
                  <ResultValue subjectId={`${miracle.id}.probability-shift.${shift.eventType}.${index + 1}.eventType`} label="概率偏移事件类型" strategy="state" value={shift.eventType}>{shift.eventType}</ResultValue>{" "}
                  <ResultValue subjectId={`${miracle.id}.probability-shift.${shift.eventType}.${index + 1}.delta`} label="概率偏移量" strategy="state" value={shift.delta}>{signed(shift.delta)}</ResultValue>
                </b>
                <p><ResultValue subjectId={`${miracle.id}.probability-shift.${shift.eventType}.${index + 1}.explanation`} label="概率偏移解释" strategy="state" value={shift.explanation}>{shift.explanation}</ResultValue></p>
                <TraceCauseButton
                  subjectId={`${miracle.id}.probability-shift.${shift.eventType}.${index + 1}`}
                  label={`${shift.eventType}概率变化`}
                />
              </article>
            )))
          ) : (
            <p>当前尚未施加奇迹，后续事件概率未被干预。</p>
          )}
          <h4>指标变化</h4>
          <div className="miracle-deltas">
            {Object.entries(state.metricDeltas).map(([metricId, delta]) => (
              <span key={metricId}>
                {metricName(metricId)}
                <b><ResultValue subjectId={`miracle-state.metric-delta.${metricId}`} label={`${metricName(metricId)}指标变化`} strategy="cause" value={delta}>{signed(delta)}</ResultValue></b>
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
            state.interventionLog.map((entry) => {
              const miracle = state.appliedMiracles.find((candidate) => candidate.id === entry.miracleId);
              return <article key={entry.id}>
                <span>
                  <ResultValue subjectId={`${entry.id}.ageLabel`} label="干预纪元" strategy="state" value={entry.ageLabel}>{entry.ageLabel}</ResultValue>｜
                  <ResultValue subjectId={`${entry.id}.miracleType`} label="干预类型" strategy="state" value={entry.miracleType}>{miracleTypeName(entry.miracleType)}</ResultValue>｜
                  <ResultValue subjectId={`${entry.id}.targetLabel`} label="干预目标" strategy="state" value={entry.targetLabel}>{entry.targetLabel}</ResultValue>
                </span>
                <b><ResultValue subjectId={`${entry.id}.directResult`} label="干预直接结果" strategy="state" value={entry.directResult}>{entry.directResult}</ResultValue></b>
                <p><ResultValue subjectId={`${entry.id}.longTermConsequence`} label="干预长期后果" strategy="state" value={entry.longTermConsequence}>{entry.longTermConsequence}</ResultValue></p>
                <TraceCauseButton subjectId={entry.id} label={entry.directResult} />
                {(miracle?.targetMutations ?? []).map((mutation) => (
                  <small key={`${mutation.targetId}-${mutation.field}`}>
                    <ResultValue
                      subjectId={`${entry.miracleId}.mutation.${mutation.targetKind}.${mutation.targetId}.${mutation.field}`}
                      label={`${mutation.field}实体变化`}
                      strategy="cause"
                      value={{ field: mutation.field, before: mutation.before, after: mutation.after, explanation: mutation.explanation }}
                    >实体变化：{mutation.field} 从 {String(mutation.before ?? "无")} 变为 {String(mutation.after ?? "无")}，{mutation.explanation}</ResultValue>
                  </small>
                ))}
              </article>
            })
          ) : (
            <p>当前宇宙处于观察者模式，没有干预日志。</p>
          )}
          {state.backlashEvents.map((event) => (
            <article className="backlash-entry" key={event.id}>
              <span><ResultValue subjectId={event.id} label={`${event.title}元数据`} strategy="cause" value={{ ageLabel: event.ageLabel, type: event.type }}>{event.ageLabel}｜反噬</ResultValue></span>
              <b><ResultValue subjectId={event.id} label={`${event.title}标题`} strategy="cause" value={event.title}>{event.title}</ResultValue></b>
              <p><ResultValue subjectId={event.id} label={`${event.title}描述`} strategy="cause" value={event.description}>{event.description}</ResultValue></p>
              <TraceCauseButton subjectId={event.id} label={event.title} />
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
