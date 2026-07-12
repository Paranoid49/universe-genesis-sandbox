import type { EventType, MetricId, TimelineEvent } from "../types";

export type CreatorMode = "observer" | "miracle";

export type MiracleType =
  | "bless_planet"
  | "stabilize_star"
  | "seed_life"
  | "grant_magic"
  | "send_catastrophe"
  | "revive_civilization"
  | "seal_deity"
  | "repair_causality";

export type MiracleTargetKind = "universe" | "planet" | "star_system" | "civilization" | "mythology";
export type MiracleOveruseLevel = "none" | "strained" | "backlash";

export type EventEffect = {
  metric: MetricId | "timeline" | "laws";
  delta: number;
  description: string;
  influence: "metric" | "probability" | "law-pressure";
  affectsFuture: boolean;
};

export type MiracleCost = {
  miraclePoints: number;
  causalityStrain: number;
  stabilityDelta: number;
  lawPressureDelta: number;
};

export type InterventionProbabilityShift = {
  eventType: EventType;
  delta: number;
  explanation: string;
};

export type MiracleDefinition = {
  type: MiracleType;
  title: string;
  targetKind: MiracleTargetKind;
  description: string;
  cost: MiracleCost;
  effect: EventEffect;
  probabilityShift: InterventionProbabilityShift;
  longTermRisks: string[];
};

export type InterventionInput = {
  id: string;
  miracleType: MiracleType;
  targetId: string;
};

export type TargetMutation = {
  targetId: string;
  targetKind: MiracleTargetKind;
  field: string;
  before: number | string | null;
  after: number | string | null;
  explanation: string;
};

export type Miracle = {
  id: string;
  type: MiracleType;
  title: string;
  targetId: string;
  targetLabel: string;
  targetKind: MiracleTargetKind;
  cost: MiracleCost;
  immediateEffects: EventEffect[];
  probabilityShifts: InterventionProbabilityShift[];
  targetMutations: TargetMutation[];
  longTermRisks: string[];
};

export type InterventionLog = {
  id: string;
  age: number;
  ageLabel: string;
  miracleId: string;
  miracleType: MiracleType;
  targetId: string;
  targetLabel: string;
  resultEventIds: string[];
  directResult: string;
  longTermConsequence: string;
  sourceIds: string[];
};

export type MiracleState = {
  mode: CreatorMode;
  miraclePointBudget: number;
  spentMiraclePoints: number;
  remainingMiraclePoints: number;
  causalityStrain: number;
  overuseLevel: MiracleOveruseLevel;
  availableMiracles: MiracleDefinition[];
  appliedMiracles: Miracle[];
  interventionLog: InterventionLog[];
  metricDeltas: Record<MetricId, number>;
  probabilityShifts: InterventionProbabilityShift[];
  backlashEvents: TimelineEvent[];
  summary: string;
};
