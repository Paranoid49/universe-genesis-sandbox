import { render } from "preact";
import { App } from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./styles.css";
import "./styles-simulation.css";
import "./styles-causality.css";
import "./styles-features.css";
import "./styles-runtime.css";
import "./styles-observation.css";
import "./styles-responsive.css";
import "./styles-causality-responsive.css";

render(<AppErrorBoundary><App /></AppErrorBoundary>, document.getElementById("root")!);
