import { useErrorBoundary } from "preact/hooks";
import type { ReactNode } from "react";

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const [error] = useErrorBoundary();
  if (!error) return children;
  return (
    <main className="app-shell">
      <section className="share-warning" role="alert">
        <h1>应用无法继续运行</h1>
        <p>{error?.message || "错误。"}</p>
        <button type="button" onClick={() => window.location.reload()}>重新加载</button>
      </section>
    </main>
  );
}
