import type { UniverseTemplateId } from "../types";

export const UNIVERSE_STATE_VERSION = "ugs-universe-state@1";
export const SIMULATION_CLOCK_VERSION = "ugs-simulation-clock@1";
export const STATE_TRANSITION_VERSION = "ugs-state-transition@1";
export const RUNTIME_RANDOM_STATE_VERSION = "ugs-runtime-random@1";

export type SimulationRunStatus = "paused" | "running";
export type SimulationSpeed = 1 | 2 | 4 | 8;

export type SimulationClock = {
  version: typeof SIMULATION_CLOCK_VERSION;
  tick: number;
  step: number;
  status: SimulationRunStatus;
  speed: SimulationSpeed;
};

export type RuntimeRandomState = {
  version: typeof RUNTIME_RANDOM_STATE_VERSION;
  algorithmVersion: string;
  streamId: string;
  namespace: string;
  seedFingerprint: string;
  state: number;
  sampleCount: number;
};

export type UniverseRuntimeIdentity = {
  universeDefinitionId: string;
  seed: string;
  rulesetVersion: string;
  templateId: UniverseTemplateId;
};

export type RuntimeObjectStatus = "forming" | "stable" | "decaying" | "destroyed";

export type RuntimeWorldObject = {
  id: string;
  kind: string;
  status: RuntimeObjectStatus;
  revision: number;
  createdAtTick: number;
  updatedAtTick: number;
  attributes: Readonly<Record<string, string | number | boolean | null>>;
};

export type TransitionInput = {
  id: string;
  kind: string;
  order: number;
  payload: Readonly<Record<string, string | number | boolean | null>>;
};

export type StateDiffOperation = {
  operation: "create" | "update" | "delete";
  objectId: string;
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
};

export type StateTransition = {
  version: typeof STATE_TRANSITION_VERSION;
  id: string;
  beforeStateId: string;
  afterStateId: string;
  fromTick: number;
  toTick: number;
  inputIds: readonly string[];
  ruleIds: readonly string[];
  randomDecisionIds: readonly string[];
  differences: readonly StateDiffOperation[];
};

export type UniverseState = {
  version: typeof UNIVERSE_STATE_VERSION;
  id: string;
  identity: UniverseRuntimeIdentity;
  clock: SimulationClock;
  objects: Readonly<Record<string, RuntimeWorldObject>>;
  randomStreams: Readonly<Record<string, RuntimeRandomState>>;
  inputLog: readonly TransitionInput[];
  committedTransitionIds: readonly string[];
};
