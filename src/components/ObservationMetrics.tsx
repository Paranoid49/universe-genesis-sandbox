import type { ObservationWorkbenchController } from "../ui/useObservationWorkbench";

export function ObservationMetrics({ workbench }: { workbench: ObservationWorkbenchController }) {
  return <section aria-label="宪法动态指标">
    <h3>宪法指标</h3>
    {workbench.access.metrics.length === 0 ? <p>当前宇宙宪法没有定义指标。</p> : workbench.access.metrics.map((metric) => {
      const known = workbench.notebook.signals.filter((signal) => metric.methodIds.includes(signal.methodId)).at(-1);
      return <article key={metric.id}><b>{metric.name}</b><p>{known ? known.visibleValue : "尚未通过观察获得证据"}</p></article>;
    })}
  </section>;
}
