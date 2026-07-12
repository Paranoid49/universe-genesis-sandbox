import type { ReactNode } from "react";

export function SectionHeader({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <header className="section-header">
      <div>{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </header>
  );
}

export function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AttributeBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="attribute-bar">
      <span>
        {label}
        <b>{value}</b>
      </span>
      <div aria-hidden="true">
        <i style={{ width: `${value}%` }} />
      </div>
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

export function LogColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <article>
      <h3>{title}</h3>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </article>
  );
}
