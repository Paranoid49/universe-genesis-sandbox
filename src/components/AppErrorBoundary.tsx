import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryState = {
  error?: Error;
};

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("应用发生未处理异常。", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell">
          <section className="share-warning" role="alert">
            <h1>应用无法继续运行</h1>
            <p>{this.state.error.message || "发生未知错误。"}</p>
            <button type="button" onClick={() => window.location.reload()}>重新加载</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
