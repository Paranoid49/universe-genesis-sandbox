import { RefreshCcw, Scale } from "../icons";
import type { LawComparison, UniverseSummary } from "../../sim";
import { interactionKindName, lawDomainName, metricName, polarityName, signed } from "../../ui/labels";
import { SectionHeader } from "../common";

export function LawsPage({ universe, comparison, compareDraftSeed, compareInputError, sourceLabelById, onCompareDraftSeedChange, onCompare }: {
  universe: UniverseSummary;
  comparison?: LawComparison;
  compareDraftSeed: string;
  compareInputError?: string;
  sourceLabelById: Map<string, string>;
  onCompareDraftSeedChange: (value: string) => void;
  onCompare: () => void;
}) {
  return <section className="laws-panel" aria-label="宇宙法则">
    <SectionHeader icon={<RefreshCcw size={18} />} title="法则与解释" text="结构化法则会影响指标与事件" />
    <div className="law-list" tabIndex={0} aria-label="宇宙法则列表">
      {Object.values(universe.laws).map((law) => <article className="law-row" key={law.id}>
        <div className="law-heading"><span>{law.title}</span><strong>{law.rating.label}</strong></div>
        <p>{law.rating.explanation}</p>
        <div className="law-tags">{law.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
        <div className="structured-rules">{law.rules.map((rule) => <div className="structured-rule" key={rule.id}>
          <div><b>{rule.name}</b><strong>{rule.value}</strong></div>
          <span>{rule.label}｜{polarityName(rule.polarity)}</span>
          <p>{rule.explanation}</p>
          <div className="effect-list">{rule.effectTargets.map((target) => <em key={`${rule.id}-${target}`}>{metricName(target)}</em>)}</div>
        </div>)}</div>
        <small>{law.cost}</small>
      </article>)}
    </div>
    <div className="interaction-list">
      <h3>法则关系</h3>
      {universe.lawInteractions.map((interaction) => <article key={interaction.id}>
        <div><b>{interactionKindName(interaction.kind)}</b><strong>{signed(interaction.impact)}</strong></div>
        <p>{sourceLabelById.get(interaction.sourceLawId)} → {sourceLabelById.get(interaction.targetLawId)}</p>
        <small>{interaction.explanation}</small>
      </article>)}
    </div>
    {comparison && <div className="comparison-panel" aria-label="seed 法则对比">
      <SectionHeader icon={<Scale size={18} />} title="Seed 法则对比" text={comparison.summary} />
      <div className="compare-controls">
        <label><span>对比 Seed</span><input aria-invalid={Boolean(compareInputError)} aria-describedby={compareInputError ? "compare-seed-error" : undefined} value={compareDraftSeed} onChange={(event) => onCompareDraftSeedChange(event.target.value)} /></label>
        <button type="button" onClick={onCompare}>对比</button>
      </div>
      {compareInputError && <p className="input-error" id="compare-seed-error" role="alert">{compareInputError}</p>}
      <div className="comparison-grid">{comparison.domainDiffs.map((diff) => <article key={diff.domain}>
        <div><span>{lawDomainName(diff.domain)}</span><strong>{signed(diff.delta)}</strong></div>
        <p>{diff.leftValue} → {diff.rightValue}</p>
        <small>{diff.strongestLeftRule} / {diff.strongestRightRule}</small>
      </article>)}</div>
    </div>}
  </section>;
}
