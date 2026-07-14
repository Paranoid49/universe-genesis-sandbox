import type { CausalRandomSampleRef, RandomTraceSnapshot } from "../sim";

export function CausalRandomEvidence({ references, trace }: {
  references: readonly CausalRandomSampleRef[];
  trace: RandomTraceSnapshot;
}) {
  if (references.length === 0) return null;
  const decisions = new Map(trace.streams.flatMap((stream) => stream.decisions.map((decision) => [decision.decisionId, decision] as const)));

  return (
    <details className="causal-sample-list">
      <summary>查看确定性抽样记录</summary>
      {references.map((reference) => {
        const decision = decisions.get(reference.decisionId);
        const candidates = decision?.candidates ?? [];
        const visibleCandidates = candidates.slice(0, 6);
        return (
          <div className="causal-sample-entry" key={reference.decisionId}>
            <code>
              {reference.purpose}｜{reference.namespace}｜第 {reference.firstSampleIndex} 次抽样｜选中 {reference.selectedValue}
            </code>
            <small>
              候选集合 {reference.candidateSetId}：{visibleCandidates.join("、") || "未记录候选值"}
              {candidates.length > visibleCandidates.length ? `，另有 ${candidates.length - visibleCandidates.length} 项` : ""}
            </small>
          </div>
        );
      })}
    </details>
  );
}
