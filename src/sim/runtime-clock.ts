import {
  SIMULATION_CLOCK_VERSION,
  type SimulationClock,
  type SimulationRunStatus,
  type SimulationSpeed,
} from "./contracts/runtime";

export function createSimulationClock(): SimulationClock {
  return freezeClock({
    version: SIMULATION_CLOCK_VERSION,
    tick: 0,
    step: 0,
    status: "paused",
    speed: 1,
  });
}

export function advanceSimulationClock(clock: SimulationClock, ticks = 1): SimulationClock {
  if (!Number.isSafeInteger(ticks) || ticks <= 0) throw new Error("模拟时钟推进量必须是正安全整数。");
  return freezeClock({
    ...clock,
    tick: clock.tick + ticks,
    step: clock.step + 1,
  });
}

export function setSimulationRunStatus(clock: SimulationClock, status: SimulationRunStatus): SimulationClock {
  return freezeClock({ ...clock, status });
}

export function setSimulationSpeed(clock: SimulationClock, speed: SimulationSpeed): SimulationClock {
  return freezeClock({ ...clock, speed });
}

function freezeClock(clock: SimulationClock): SimulationClock {
  return Object.freeze(clock);
}
