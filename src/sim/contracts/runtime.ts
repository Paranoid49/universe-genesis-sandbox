import type { UniverseTemplateId } from "../types";

export const UNIVERSE_STATE_VERSION = "ugs-universe-state@2";
export const UNIVERSE_DEFINITION_VERSION = "ugs-universe-definition@1";
export const SIMULATION_CLOCK_VERSION = "ugs-simulation-clock@1";
export const STATE_TRANSITION_VERSION = "ugs-state-transition@2";
export const RUNTIME_RANDOM_STATE_VERSION = "ugs-runtime-random@1";
export const RUNTIME_ARCHIVE_VERSION = "ugs-runtime-archive@2";

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

export type RuntimeRandomDecision = {
  id: string;
  streamId: string;
  namespace: string;
  sampleIndex: number;
  sampleValue: number;
  operation: "next" | "int" | "bool";
  parameters: Readonly<Record<string, number>>;
  selectedValue: string;
};

export type UniverseDefinition = {
  version: typeof UNIVERSE_DEFINITION_VERSION;
  universeDefinitionId: string;
  seed: string;
  rulesetVersion: string;
  templateId: UniverseTemplateId;
  initialInputIds: readonly string[];
};

export type UniverseRuntimeIdentity = UniverseDefinition;

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

export type RuntimeRule = {
  id: string;
  kind: "object-evolution";
  parameters: Readonly<Record<string, number>>;
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
  ruleId: string;
  randomDecisionId?: string;
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
  randomDecisions: readonly RuntimeRandomDecision[];
  differences: readonly StateDiffOperation[];
};

export type UniverseState = {
  version: typeof UNIVERSE_STATE_VERSION;
  id: string;
  identity: UniverseRuntimeIdentity;
  clock: SimulationClock;
  rules: readonly RuntimeRule[];
  objects: Readonly<Record<string, RuntimeWorldObject>>;
  randomStreams: Readonly<Record<string, RuntimeRandomState>>;
  inputLog: readonly TransitionInput[];
  transitions: readonly StateTransition[];
  committedTransitionIds: readonly string[];
};

export type RuntimeEvent = {
  id: string;
  transitionId: string;
  tick: number;
  objectId: string;
  title: string;
  description: string;
  differenceIndexes: readonly number[];
  causeSubjectIds: readonly string[];
};

export type RuntimeArchiveEnvelope = {
  version: typeof RUNTIME_ARCHIVE_VERSION;
  stateVersion: typeof UNIVERSE_STATE_VERSION;
  universeDefinitionId: string;
  stateId: string;
  stateFingerprint: string;
  transitionCount: number;
  lastTransitionId: string | null;
  state: UniverseState;
  checksum: string;
};

export type RuntimeStorageAdapter = {
  readonly storageVersion: string;
  migrate: () => Promise<void>;
  put: (archive: RuntimeArchiveEnvelope) => Promise<void>;
  get: (stateId: string) => Promise<RuntimeArchiveEnvelope | undefined>;
  list: () => Promise<readonly RuntimeArchiveEnvelope[]>;
  remove: (stateId: string) => Promise<void>;
};

export type RuntimeCausalNodeKind = "root" | "rule" | "state" | "input" | "random" | "difference" | "transition" | "event";

export type RuntimeCausalNode = {
  id: string;
  subjectId: string;
  kind: RuntimeCausalNodeKind;
  label: string;
  description: string;
  root: boolean;
  directCauseIds: readonly string[];
  directEffectIds: readonly string[];
};

export type RuntimeCausalEdge = {
  id: string;
  from: string;
  to: string;
  relation: "permits" | "precedes" | "selects" | "changes" | "projects";
};

export type RuntimeCausalNetwork = {
  version: "ugs-runtime-causality@1";
  universeDefinitionId: string;
  stateId: string;
  rootNodeIds: readonly string[];
  nodes: readonly RuntimeCausalNode[];
  edges: readonly RuntimeCausalEdge[];
};
