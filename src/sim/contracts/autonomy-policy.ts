import type { NumericOperator } from "./values";

export type AutonomousConditionDefinition = {
  field: string;
  operator: NumericOperator;
  value: number;
};

export type AutonomousPerceptionDefinition = {
  field: string;
  bias?: number;
  uncertainty: string;
};

export type AutonomousActionDefinition = {
  id: string;
  ruleId: string;
  beliefField: string;
  operator: NumericOperator;
  value: number;
  priority: number;
  goal: string;
};

export type AutonomousNarrativeDefinition = {
  id: string;
  title: string;
  beliefField: string;
  template: string;
  archiveAsMyth?: boolean;
};

export type AutonomousEntityPolicy = {
  id: string;
  name: string;
  targetKind: string;
  activation: AutonomousConditionDefinition;
  deactivation?: AutonomousConditionDefinition;
  perceptions: readonly AutonomousPerceptionDefinition[];
  memoryCapacity: number;
  actions: readonly AutonomousActionDefinition[];
  narrative?: AutonomousNarrativeDefinition;
};
