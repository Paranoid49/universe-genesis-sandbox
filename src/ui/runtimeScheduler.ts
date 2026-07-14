import type { SimulationSpeed } from "../sim";

export type RuntimeStepScheduler = {
  stop: () => void;
};

export function startRuntimeStepScheduler(speed: SimulationSpeed, onStep: () => void): RuntimeStepScheduler {
  const interval = globalThis.setInterval(onStep, Math.max(50, Math.round(800 / speed)));
  let stopped = false;
  return Object.freeze({
    stop: () => {
      if (stopped) return;
      stopped = true;
      globalThis.clearInterval(interval);
    },
  });
}
