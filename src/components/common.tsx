import type { ReactNode } from "react";
import { resultValueFingerprint } from "../ui/resultValueContract";

export function SectionHeader({ icon, title, text, subjectId, resultValue }: { icon: ReactNode; title: string; text: string; subjectId?: string; resultValue?: unknown }) {
  return (
    <header className="section-header">
      <div>{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{subjectId && resultValue !== undefined
          ? <ResultValue subjectId={subjectId} label={title} strategy="cause" value={resultValue}>{text}</ResultValue>
          : text}</p>
        {subjectId && resultValue === undefined && <TraceCauseButton subjectId={subjectId} label={title} />}
      </div>
    </header>
  );
}

export function StatTile({ label, value, subjectId }: { label: string; value: number; subjectId?: string }) {
  return (
    <div data-result-subject={subjectId} data-result-value={resultValueFingerprint(value)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subjectId && <TraceCauseButton subjectId={subjectId} label={label} />}
    </div>
  );
}

export function TraceCauseButton({ subjectId, label }: { subjectId: string; label: string }) {
  return <button className="trace" type="button" data-t={subjectId} aria-label={`追溯${label}原因`}>
    追因
  </button>;
}

export function TraceStateValueButton({ subjectId, label }: { subjectId: string; label: string }) {
  return <button
    className="trace"
    type="button"
    data-p={subjectId}
    data-causal-focus={`state-value.${subjectId}`}
    aria-label={`追溯${label}原因`}
  >追因</button>;
}

export function ResultValue({
  subjectId,
  label,
  strategy,
  value,
  children,
}: {
  subjectId: string;
  label: string;
  strategy: "cause" | "state";
  value: unknown;
  children: ReactNode;
}) {
  return <span className="result-value" data-result-subject={subjectId} data-result-strategy={strategy} data-result-value={resultValueFingerprint(value)}>
    <span>{children}</span>
    {strategy === "state"
      ? <TraceStateValueButton subjectId={subjectId} label={label} />
      : <TraceCauseButton subjectId={subjectId} label={label} />}
  </span>;
}

export function RegisteredResult({
  subjectId,
  value,
  children,
}: {
  subjectId: string;
  value: unknown;
  children: ReactNode;
}) {
  return <span className="registered-result" data-result-subject={subjectId} data-result-strategy="cause" data-result-value={resultValueFingerprint(value)}>{children}</span>;
}

export function AttributeBar({ label, value, subjectId }: { label: string; value: number; subjectId?: string }) {
  return (
    <div className="attribute-bar" data-result-subject={subjectId} data-result-value={resultValueFingerprint(value)}>
      <span>
        {label}
        <b>{value}</b>
      </span>
      <div aria-hidden="true">
        <i style={{ width: `${value}%` }} />
      </div>
      {subjectId && <TraceStateValueButton subjectId={subjectId} label={label} />}
    </div>
  );
}

export function SourceList({ title, ids, sourceLabelById }: { title: string; ids: string[]; sourceLabelById: Map<string, string> }) {
  return (
    <div className="source-list">
      <b>{title}</b>
      {ids.length > 0 ? ids.map((id) => <small key={id}>{sourceLabelById.get(id) ?? id}</small>) : <small>暂无来源</small>}
    </div>
  );
}

export function LogColumn({ title, items, subjectPrefix }: { title: string; items: string[]; subjectPrefix: string }) {
  return (
    <article>
      <h3>{title}</h3>
      {items.map((item, index) => (
        <div key={item}>
          <p><ResultValue subjectId={`${subjectPrefix}.${index + 1}`} label={item} strategy="cause" value={item}>{item}</ResultValue></p>
        </div>
      ))}
    </article>
  );
}
