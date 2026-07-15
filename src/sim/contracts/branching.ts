import type { StateDiffOperation, TransitionInput, UniverseState } from "./runtime";

export const BRANCH_PROTOCOL_VERSION = "ugs-branch@5";

export type ExperimentInput = TransitionInput & {
  kind: "experiment.adjust-condition@1";
  branchId: string;
  beforeStateId: string;
  ruleIds: readonly string[];
  payload: Readonly<{ objectId: string; field: string; delta: number }>;
};

export type InUniverseIntervention = TransitionInput & {
  kind: "intervention.apply-pulse@1";
  branchId: string;
  beforeStateId: string;
  ruleIds: readonly string[];
  payload: Readonly<{ objectId: string; field: string; delta: number; capabilityId: string }>;
};

export type BranchInputOutcome = {
  version: "ugs-branch-input-outcome@1";
  id: string;
  branchId: string;
  inputId: string;
  beforeStateId: string;
  status: "accepted" | "rejected";
  code: string;
  fieldPath: string;
  ruleIds: readonly string[];
  transitionId?: string;
  causalNodeIds: readonly string[];
};

export type BranchLineageEntry = {
  branchId: string;
  parentBranchId?: string;
  forkTick: number;
  forkStateId: string;
  creationInputIds: readonly string[];
};

export type UniverseBranch = {
  version: typeof BRANCH_PROTOCOL_VERSION;
  branchId: string;
  universeDefinitionId: string;
  parentBranchId?: string;
  forkTick: number;
  forkStateId: string;
  commonTransitionCount: number;
  lineage: readonly BranchLineageEntry[];
  branchInputs: readonly (ExperimentInput | InUniverseIntervention)[];
  branchInputIds: readonly string[];
  inputOutcomes: readonly BranchInputOutcome[];
  stateHash: string;
  historyHash: string;
  checkpointId: string;
  state: UniverseState;
  accessMode: "local" | "shared-readonly";
  rootCheckpointId?: string;
  sharedOriginBranchId?: string;
};

export type BranchDifferenceEvidence = {
  objectId: string;
  field: string;
  leftTransitionIds: readonly string[];
  rightTransitionIds: readonly string[];
  inputIds: readonly string[];
  ruleIds: readonly string[];
  causalNodeIds: readonly string[];
};

export type BranchComparison = {
  leftBranchId: string;
  rightBranchId: string;
  commonAncestorBranchId: string;
  commonTransitionCount: number;
  firstDifferentInput?: { leftId?: string; rightId?: string; order: number };
  stateDifferences: readonly StateDiffOperation[];
  leftOnlyTransitionIds: readonly string[];
  rightOnlyTransitionIds: readonly string[];
  leftOnlyCausalNodeIds: readonly string[];
  rightOnlyCausalNodeIds: readonly string[];
  leftOnlyCausalPaths: readonly (readonly string[])[];
  rightOnlyCausalPaths: readonly (readonly string[])[];
  commonCausalNodeIds: readonly string[];
  commonStateFieldCount: number;
  differenceEvidence: readonly BranchDifferenceEvidence[];
  historiesConvergedToSameState: boolean;
};
