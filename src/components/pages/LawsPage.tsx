import { RefreshCcw, Scale } from "../icons";
import type { LawComparison, UniverseSummary } from "../../sim";
import { interactionKindName, lawDomainName, metricName, polarityName, signed } from "../../ui/labels";
import type { LawComparisonSide, LawComparisonTraceTarget } from "../../ui/lawComparisonCausalProjection";
import { ResultValue, SectionHeader, TraceCauseButton } from "../common";

export function LawsPage({ universe, comparison, compareDraftSeed, compareInputError, sourceLabelById, onCompareDraftSeedChange, onCompare, onTraceComparison }: {
  universe: UniverseSummary;
  comparison?: LawComparison;
  compareDraftSeed: string;
  compareInputError?: string;
  sourceLabelById: Map<string, string>;
  onCompareDraftSeedChange: (value: string) => void;
  onCompare: () => void;
  onTraceComparison: (side: LawComparisonSide, target: LawComparisonTraceTarget) => void;
}) {
  return <section className="laws-panel" aria-label="宇宙法则">
    <SectionHeader icon={<RefreshCcw size={18} />} title="法则与解释" text="结构化法则会影响指标与事件" />
    <div className="law-list" tabIndex={0} aria-label="宇宙法则列表">
      {Object.values(universe.laws).map((law) => <article className="law-row" key={law.id}>
        <div className="law-heading">
          <ResultValue subjectId={`${law.id}.title`} label={`${law.title}标题`} strategy="state" value={law.title}>{law.title}</ResultValue>
          <strong><ResultValue subjectId={`${law.id}.rating.label`} label={`${law.title}评级`} strategy="state" value={law.rating.label}>{law.rating.label}</ResultValue></strong>
        </div>
        <TraceCauseButton subjectId={law.id} label={law.title} />
        <p><ResultValue subjectId={`${law.id}.rating.explanation`} label={`${law.title}评级解释`} strategy="state" value={law.rating.explanation}>{law.rating.explanation}</ResultValue></p>
        <div className="law-tags"><ResultValue subjectId={`${law.id}.traits`} label={`${law.title}特征`} strategy="state" value={law.traits}>{law.traits.map((trait) => <span key={trait}>{trait}</span>)}</ResultValue></div>
        <div className="structured-rules">{law.rules.map((rule) => <div className="structured-rule" key={rule.id}>
          <div>
            <b><ResultValue subjectId={`${rule.id}.name`} label={`${rule.name}名称`} strategy="state" value={rule.name}>{rule.name}</ResultValue></b>
            <strong><ResultValue subjectId={`${rule.id}.value`} label={`${rule.name}数值`} strategy="state" value={rule.value}>{rule.value}</ResultValue></strong>
          </div>
          <TraceCauseButton subjectId={rule.id} label={rule.name} />
          <span>
            <ResultValue subjectId={`${rule.id}.label`} label={`${rule.name}标签`} strategy="state" value={rule.label}>{rule.label}</ResultValue>｜
            <ResultValue subjectId={`${rule.id}.polarity`} label={`${rule.name}极性`} strategy="state" value={rule.polarity}>{polarityName(rule.polarity)}</ResultValue>
          </span>
          <p><ResultValue subjectId={`${rule.id}.explanation`} label={`${rule.name}解释`} strategy="state" value={rule.explanation}>{rule.explanation}</ResultValue></p>
          <div className="effect-list"><ResultValue subjectId={`${rule.id}.effectTargets`} label={`${rule.name}影响目标`} strategy="state" value={rule.effectTargets}>{rule.effectTargets.map((target) => <em key={`${rule.id}-${target}`}>{metricName(target)}</em>)}</ResultValue></div>
        </div>)}</div>
        <small><ResultValue subjectId={`${law.id}.cost`} label={`${law.title}代价`} strategy="state" value={law.cost}>{law.cost}</ResultValue></small>
      </article>)}
    </div>
    <div className="interaction-list">
      <h3>法则关系</h3>
      {universe.lawInteractions.map((interaction) => <article key={interaction.id}>
        <div>
          <b><ResultValue subjectId={`${interaction.id}.kind`} label="法则关系类型" strategy="state" value={interaction.kind}>{interactionKindName(interaction.kind)}</ResultValue></b>
          <strong><ResultValue subjectId={`${interaction.id}.impact`} label="法则关系影响" strategy="state" value={interaction.impact}>{signed(interaction.impact)}</ResultValue></strong>
        </div>
        <TraceCauseButton subjectId={interaction.id} label="法则关系" />
        <p>
          <ResultValue subjectId={`${interaction.id}.sourceLawId`} label="来源规则" strategy="state" value={interaction.sourceLawId}>{sourceLabelById.get(interaction.sourceLawId)}</ResultValue> →
          <ResultValue subjectId={`${interaction.id}.targetLawId`} label="目标规则" strategy="state" value={interaction.targetLawId}>{sourceLabelById.get(interaction.targetLawId)}</ResultValue>
        </p>
        <small><ResultValue subjectId={`${interaction.id}.explanation`} label="法则关系解释" strategy="state" value={interaction.explanation}>{interaction.explanation}</ResultValue></small>
      </article>)}
    </div>
    {comparison && <div className="comparison-panel" aria-label="seed 法则对比">
      <SectionHeader icon={<Scale size={18} />} title="Seed 法则对比" text={comparison.summary} />
      <div className="compare-controls">
        <label><span>对比 Seed</span><input aria-invalid={Boolean(compareInputError)} aria-describedby={compareInputError ? "compare-seed-error" : undefined} value={compareDraftSeed} onChange={(event) => onCompareDraftSeedChange(event.target.value)} /></label>
        <button type="button" onClick={onCompare}>对比</button>
      </div>
      {compareInputError && <p className="input-error" id="compare-seed-error" role="alert">{compareInputError}</p>}
      <div className="comparison-trace-actions" aria-label="最大差异总结追因">
        <button type="button" data-causal-focus="law-comparison.left.maximum" onClick={() => onTraceComparison("left", "maximum")}>追溯左侧最大差异依据</button>
        <button type="button" data-causal-focus="law-comparison.right.maximum" onClick={() => onTraceComparison("right", "maximum")}>追溯右侧最大差异依据</button>
      </div>
      <div className="comparison-grid">{comparison.domainDiffs.map((diff) => <article key={diff.domain}>
        <div><span>{lawDomainName(diff.domain)}</span><strong>{signed(diff.delta)}</strong></div>
        <p>右值 - 左值 = {diff.rightValue} - {diff.leftValue} = {signed(diff.delta)}</p>
        <small>{diff.strongestLeftRule} / {diff.strongestRightRule}</small>
        <div className="comparison-trace-actions">
          <button type="button" data-causal-focus={`law-comparison.left.${diff.domain}`} onClick={() => onTraceComparison("left", diff.domain)}>追溯左值原因：{lawDomainName(diff.domain)}</button>
          <button type="button" data-causal-focus={`law-comparison.right.${diff.domain}`} onClick={() => onTraceComparison("right", diff.domain)}>追溯右值原因：{lawDomainName(diff.domain)}</button>
        </div>
      </article>)}</div>
    </div>}
  </section>;
}
