import { constitutionTimeLabel, type RuntimeCausalNode, type SimulationSpeed } from "../sim/current";
import type { RuntimeUniverseController } from "./useRuntimeUniverseModel";

export type RuntimeKnowledgeOverview = {
  focuses: readonly string[];
  recentSignals: readonly { id: string; title: string; value: string; tick: number }[];
  recentChanges: readonly { id: string; title: string; value: string; tick: number }[];
  unknownMethods: readonly string[];
  publicAxioms: readonly string[];
};

export type RuntimePageModel = {
  step: number;
  tick: number;
  timeLabel: string;
  constitutionName: string;
  runStatus: "paused" | "running";
  speed: SimulationSpeed;
  stateId: string;
  error?: string;
  status?: string;
  busy: boolean;
  historyTick: number;
  events: readonly { id: string; tick: number; title: string }[];
  causalNode?: RuntimeCausalNode;
  directCauses: readonly RuntimeCausalNode[];
  directEffects: readonly RuntimeCausalNode[];
  knowledge?: RuntimeKnowledgeOverview;
  onToggleRunning: () => void;
  onAdvance: () => void;
  onChangeSpeed: (speed: SimulationSpeed) => void;
  onSave: () => void;
  onRestoreLatest: () => void;
  onSetHistoryTick: (tick: number) => void;
  onSetCausalNodeId: (nodeId: string | undefined) => void;
};

export function createRuntimePageModel(runtime: RuntimeUniverseController, knowledge?: RuntimeKnowledgeOverview): RuntimePageModel {
  return Object.freeze({
    step: runtime.state.clock.step,
    tick: runtime.state.clock.tick,
    timeLabel: constitutionTimeLabel(runtime.state.identity.constitution, runtime.state.clock.tick),
    constitutionName: runtime.state.identity.constitution.name,
    runStatus: runtime.state.clock.status,
    speed: runtime.state.clock.speed,
    stateId: runtime.state.id,
    error: runtime.error,
    status: runtime.status,
    busy: runtime.busy,
    historyTick: runtime.historyTick,
    events: Object.freeze(runtime.events.filter((event) => event.tick <= runtime.historyTick).map((event) => Object.freeze({ id: event.id, tick: event.tick, title: event.title }))),
    causalNode: runtime.causalNode,
    directCauses: runtime.directCauses,
    directEffects: runtime.directEffects,
    knowledge,
    onToggleRunning: runtime.toggleRunning,
    onAdvance: runtime.advance,
    onChangeSpeed: runtime.changeSpeed,
    onSave: runtime.save,
    onRestoreLatest: runtime.restoreLatest,
    onSetHistoryTick: runtime.setHistoryTick,
    onSetCausalNodeId: runtime.setCausalNodeId,
  });
}
