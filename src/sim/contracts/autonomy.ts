import type { ConstitutionValue, NumericOperator } from "./values";

export const AUTONOMY_PROTOCOL_VERSION = "ugs-autonomy@2";

export type AutonomousEntityStatus = "active" | "ceased";

export type AutonomousPerception = {
  id: string;
  entityId: string;
  objectId: string;
  field: string;
  perceivedValue: ConstitutionValue;
  uncertainty: string;
  sourceStateId: string;
  tick: number;
};

export type AutonomousMemory = {
  id: string;
  entityId: string;
  kind: "perception" | "action";
  sourceId: string;
  summary: string;
  tick: number;
};

export type AutonomousBelief = {
  id: string;
  entityId: string;
  field: string;
  believedValue: ConstitutionValue;
  confidence: number;
  memoryIds: readonly string[];
  formedAtTick: number;
};

export type AutonomousIntent = {
  id: string;
  entityId: string;
  goal: string;
  actionRuleId?: string;
  beliefIds: readonly string[];
  status: "act" | "idle";
  formedAtTick: number;
};

export type AutonomousAction = {
  id: string;
  entityId: string;
  intentId: string;
  ruleId?: string;
  status: "applied" | "rejected" | "idle";
  executionRecordId?: string;
  differenceIndexes: readonly number[];
  reason: string;
  tick: number;
};

export type AutonomousEntity = {
  id: string;
  objectId: string;
  policyId: string;
  name: string;
  status: AutonomousEntityStatus;
  formedAtTick: number;
  ceasedAtTick?: number;
  memories: readonly AutonomousMemory[];
  beliefs: readonly AutonomousBelief[];
  lastIntent?: AutonomousIntent;
  lastAction?: AutonomousAction;
};

export type AutonomousRelation = {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  typeId: string;
  name: string;
  status: "active" | "ceased";
  formedAtTick: number;
  ceasedAtTick?: number;
};

export type AutonomousNarrative = {
  id: string;
  entityId: string;
  definitionId: string;
  title: string;
  claim: string;
  beliefId: string;
  formedAtTick: number;
};

export type AutonomousMythArchive = {
  id: string;
  sourceNarrativeId: string;
  formedAtTick: number;
};

export type AutonomyState = {
  version: typeof AUTONOMY_PROTOCOL_VERSION;
  entities: Readonly<Record<string, AutonomousEntity>>;
  relations: Readonly<Record<string, AutonomousRelation>>;
  narratives: Readonly<Record<string, AutonomousNarrative>>;
  mythArchives: Readonly<Record<string, AutonomousMythArchive>>;
};

export type AutonomyTransition = {
  formedEntityIds: readonly string[];
  ceasedEntityIds: readonly string[];
  perceptions: readonly AutonomousPerception[];
  memories: readonly AutonomousMemory[];
  beliefs: readonly AutonomousBelief[];
  intents: readonly AutonomousIntent[];
  actions: readonly AutonomousAction[];
  formedRelationIds: readonly string[];
  ceasedRelationIds: readonly string[];
  narrativeIds: readonly string[];
  mythArchiveIds: readonly string[];
};

export type AutonomousActionCondition = {
  field: string;
  operator: NumericOperator;
  value: number;
};
