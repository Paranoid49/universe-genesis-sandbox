import type { UniverseSummary } from "../../sim";
import { LogColumn } from "../common";

export function LogsPage({ universe }: { universe: UniverseSummary }) {
  return <section className="log-band" aria-label="观察日志">
    <LogColumn title="重要事件" items={universe.observationLog.importantEvents} subjectPrefix="observation.important" />
    <LogColumn title="稀有发现" items={universe.observationLog.rareFindings} subjectPrefix="observation.rare" />
    <LogColumn title="潜在终局" items={universe.observationLog.possibleEndings} subjectPrefix="observation.ending" />
  </section>;
}
