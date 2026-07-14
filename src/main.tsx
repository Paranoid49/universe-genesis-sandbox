import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./styles.css";
import "./styles-simulation.css";
import "./styles-causality.css";
import "./styles-features.css";
import "./styles-runtime.css";
import "./styles-responsive.css";
import "./styles-causality-responsive.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
