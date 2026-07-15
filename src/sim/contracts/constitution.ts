import type { AutonomousEntityPolicy } from "./autonomy-policy";
import type { ConstitutionValue, NumericOperator } from "./values";

export type { AutonomousActionDefinition, AutonomousConditionDefinition, AutonomousEntityPolicy, AutonomousNarrativeDefinition, AutonomousPerceptionDefinition } from "./autonomy-policy";
export type { ConstitutionValue, NumericOperator } from "./values";

export const CONSTITUTION_PROTOCOL_VERSION = "ugs-constitution@3";
export const CONSTITUTION_MODULE_VERSION = "ugs-constitution-module@3";
export const RULE_EXECUTOR_VERSION = "ugs-rule-executor@3";

export type ConstitutionModuleCategory =
  | "ontology"
  | "action"
  | "constraint"
  | "priority"
  | "time"
  | "topology"
  | "cognition"
  | "observable"
  | "event"
  | "intervention"
  | "boundary";

export type AttributeDefinition = {
  id: string;
  name: string;
  initial: ConstitutionValue;
  minimum?: number;
  maximum?: number;
};

export type ObjectKindDefinition = {
  id: string;
  name: string;
  initialStatus: string;
  initialCount?: number;
  attributes: readonly AttributeDefinition[];
};

export type OntologyModuleSpec = {
  objectKinds: readonly ObjectKindDefinition[];
};

export type RuleCondition = {
  field: string;
  operator: NumericOperator;
  value: number;
};

export type RuleEffect = {
  field: string;
  operation: "add" | "set";
  value: number;
  randomMinimum?: number;
  randomMaximum?: number;
};

export type RuleCost = {
  field: string;
  amount: number;
};

export type DeclarativeRule = {
  id: string;
  name: string;
  targetKind: string;
  priority: number;
  conditions: readonly RuleCondition[];
  effects: readonly RuleEffect[];
  cost?: RuleCost;
  trigger?: "environment" | "autonomous";
};

export type ActionModuleSpec = {
  rules: readonly DeclarativeRule[];
};

export type FieldConstraint = {
  id: string;
  targetKind: string;
  field: string;
  minimum?: number;
  maximum?: number;
};

export type ConstraintModuleSpec = {
  constraints: readonly FieldConstraint[];
};

export type PriorityModuleSpec = {
  tieBreaker: "rule-id";
};

export type TimeModuleSpec = {
  mode: "linear" | "cyclic" | "segmented";
  unitName: string;
  cycleLength?: number;
  segmentNames?: readonly string[];
};

export type TopologyModuleSpec = {
  mode: "hierarchical" | "relational" | "semantic";
  relationNames: readonly string[];
  initialRelations: readonly {
    id: string;
    name: string;
    sourceKind: string;
    targetKind: string;
    directed: boolean;
  }[];
};

export type CognitionModuleSpec = {
  publicAxiomIds: readonly string[];
  hiddenAttributeIds: readonly string[];
  autonomyPolicies?: readonly AutonomousEntityPolicy[];
};

export type ObservableBand = {
  maximum?: number;
  label: string;
};

export type ObservableMethodDefinition = {
  id: string;
  name: string;
  description: string;
  scale: "object" | "history" | "rule";
  kind: "range" | "trend" | "recent-change" | "rule-trace";
  field?: string;
  bands?: readonly ObservableBand[];
};

export type MetricDefinition = {
  id: string;
  name: string;
  field: string;
  visibility: "public" | "observable";
};

export type ObservableModuleSpec = {
  methods: readonly ObservableMethodDefinition[];
  metrics: readonly MetricDefinition[];
};

export type EventClassifier = {
  id: string;
  name: string;
  field: string;
};

export type EventModuleSpec = {
  classifiers: readonly EventClassifier[];
};

export type InterventionCapability = {
  id: string;
  name: string;
  targetKinds: readonly string[];
  field: string;
  minimumDelta: number;
  maximumDelta: number;
  costField?: string;
  costAmount?: number;
};

export type InterventionModuleSpec = {
  capabilities: readonly InterventionCapability[];
};

export type BoundaryModuleSpec = {
  observationsAffectState: boolean;
  maximumRuleEvaluations: number;
  maximumEffectsPerStep: number;
  maximumObjects: number;
  maximumRelations: number;
  maximumAutonomousEntities?: number;
  maximumMemoriesPerEntity?: number;
  maximumAutonomousActionsPerStep?: number;
};

export type ConstitutionModuleSpec =
  | OntologyModuleSpec
  | ActionModuleSpec
  | ConstraintModuleSpec
  | PriorityModuleSpec
  | TimeModuleSpec
  | TopologyModuleSpec
  | CognitionModuleSpec
  | ObservableModuleSpec
  | EventModuleSpec
  | InterventionModuleSpec
  | BoundaryModuleSpec;

export type ConstitutionModule = {
  version: typeof CONSTITUTION_MODULE_VERSION;
  id: string;
  moduleVersion: string;
  category: ConstitutionModuleCategory;
  name: string;
  description: string;
  dependencies: readonly string[];
  conflicts: readonly string[];
  spec: ConstitutionModuleSpec;
  contentFingerprint: string;
};

export type UniverseConstitution = {
  version: typeof CONSTITUTION_PROTOCOL_VERSION;
  executorVersion: typeof RULE_EXECUTOR_VERSION;
  constitutionId: string;
  presetId?: string;
  name: string;
  description: string;
  modules: readonly ConstitutionModule[];
  moduleIds: readonly string[];
  contentFingerprint: string;
};

export type ConstitutionValidationIssue = {
  code: string;
  fieldPath: string;
  message: string;
};

export type RuleConditionRecord = {
  field: string;
  operator: NumericOperator;
  expected: number;
  actual: number;
  satisfied: boolean;
};

export type RuleConstraintRecord = {
  constraintId: string;
  field: string;
  before: number;
  proposed: number;
  after: number;
  satisfied: boolean;
};

export type RuleCostRecord = {
  field: string;
  amount: number;
  before: number;
  after: number;
  satisfied: boolean;
};

export type RuleExecutionRecord = {
  id: string;
  ruleId: string;
  objectId: string;
  priority: number;
  status: "applied" | "condition-rejected" | "cost-rejected" | "constraint-rejected" | "arbitration-rejected";
  conditionRecords: readonly RuleConditionRecord[];
  constraintRecords: readonly RuleConstraintRecord[];
  costRecord?: RuleCostRecord;
  effectFields: readonly string[];
  randomDecisionIds: readonly string[];
  inputIds: readonly string[];
  arbitration: string;
};

export type ConstitutionWorldObject = {
  id: string;
  kind: string;
  status: string;
  revision: number;
  createdAtTick: number;
  updatedAtTick: number;
  attributes: Readonly<Record<string, ConstitutionValue>>;
};

export type ConstitutionDifference = {
  objectId: string;
  field: string;
  before: ConstitutionValue;
  after: ConstitutionValue;
  ruleId: string;
  randomDecisionId?: string;
};

export type RuleRandomDecision = {
  id: string;
  value: number;
};

export type RuleRandomSource = {
  int: (minimum: number, maximum: number) => RuleRandomDecision; checkpoint: () => void; rollback: () => void;
};

export type RuleExecutionResult = {
  objects: Readonly<Record<string, ConstitutionWorldObject>>;
  differences: readonly ConstitutionDifference[];
  records: readonly RuleExecutionRecord[];
  randomDecisionIds: readonly string[];
};
