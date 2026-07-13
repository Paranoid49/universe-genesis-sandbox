import type { UniverseSummary } from "../../sim";
import { LogColumn } from "../common";

export function LogsPage({ universe }: { universe: UniverseSummary }) {
  return <section className="log-band" aria-label="观察日志">
    <LogColumn title="重要事件" items={universe.observationLog.importantEvents} />
    <LogColumn title="稀有发现" items={universe.observationLog.rareFindings} />
    <LogColumn title="潜在终局" items={universe.observationLog.possibleEndings} />
  </section>;
}
