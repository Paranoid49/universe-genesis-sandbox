import type { RandomTraceSnapshot } from "./random";
import type { CausalDomainLocator } from "./causal-locators";

export type {
  CausalCollectionQuantityLocator,
  CausalDomainLocator,
  CausalEntityKind,
  CausalEntityLocator,
  CausalMappingKeyLocator,
  CausalNegativeFactLocator,
  CausalRootFieldLocator,
} from "./causal-locators";

export const CAUSAL_GRAPH_VERSION = "ugs-causality@13";
export const CAUSAL_GENERATION_MANIFEST_VERSION = "ugs-causal-inputs@1";
export const CAUSAL_RANDOM_BINDING_VERSION = "ugs-random-bindings@5";

export type CausalRootKind = "input" | "axiom" | "initial_state";

export type CausalInputKind = "seed" | "ruleset_version" | "creation_template" | "intervention";

export type CausalInputRecord = {
  readonly rootNodeId: string;
  readonly kind: CausalInputKind;
  readonly order: number;
  readonly subjectId: string;
  readonly value: string;
};

export type CausalGenerationManifest = {
  readonly version: string;
  readonly id: string;
  readonly inputs: readonly CausalInputRecord[];
};

export type CausalInputEvidence = Omit<CausalInputRecord, "rootNodeId">;

export type CausalNodeKind =
  | "input"
  | "axiom"
  | "initial_state"
  | "universe"
  | "template"
  | "law_domain"
  | "law"
  | "law_interaction"
  | "metric"
  | "timeline_event"
  | "timeline_impact"
  | "galaxy"
  | "star_system"
  | "planet"
  | "biosphere"
  | "civilization_seed"
  | "civilization"
  | "mythology"
  | "civilization_event"
  | "intervention"
  | "intervention_result"
  | "intervention_metric"
  | "target_mutation"
  | "probability_shift"
  | "event_effect"
  | "state_value"
  | "universe_name"
  | "universe_tagline"
  | "universe_description"
  | "share_result"
  | "provenance"
  | "collection_boundary"
  | "negative_fact"
  | "explanation"
  | "observation";

export type CausalEdgeKind =
  | "selects"
  | "derives"
  | "applies"
  | "triggers"
  | "contains"
  | "observes"
  | "intervenes"
  | "explains";

export type CausalRandomSampleRef = {
  readonly decisionId: string;
  readonly streamId: string;
  readonly namespace: string;
  readonly scopeId?: string;
  readonly sampleIndexes: readonly number[];
  readonly firstSampleIndex: number;
  readonly lastSampleIndex: number;
  readonly purpose: string;
  readonly resultSubjectId?: string;
  readonly candidateSetId: string;
  readonly selectedValue: string;
};

export type CausalRandomBindingKind = "field" | "collection_quantity" | "collection_member" | "negative_fact";

export type CausalRandomResultBinding = {
  readonly decisionId: string;
  readonly resultNodeId: string;
  readonly resultSubjectId: string;
  readonly nodeKind: CausalNodeKind;
  readonly bindingKind: CausalRandomBindingKind;
  readonly locator: CausalDomainLocator;
  readonly outputValueFingerprint: string;
  readonly scopeId?: string;
};

export type CausalNode = {
  readonly id: string;
  readonly subjectId: string;
  readonly kind: CausalNodeKind;
  readonly label: string;
  readonly description: string;
  readonly input?: CausalInputEvidence;
  readonly root?: CausalRootKind;
  readonly directCauseIds: readonly string[];
  readonly directEffectIds: readonly string[];
  readonly ruleIds: readonly string[];
  readonly randomSampleRefs: readonly CausalRandomSampleRef[];
};

export type CausalEdge = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: CausalEdgeKind;
  readonly label: string;
  readonly ruleId?: string;
};

export const CAUSAL_CYCLE_AUTHORITY_SUBJECT_ID = "axiom:authorized-feedback";

export const CAUSAL_AXIOM_SUBJECT_IDS = [
  "axiom:template-resolution",
  "axiom:universe-assembly",
  "axiom:law-generation",
  "axiom:law-interaction",
  "axiom:metric-derivation",
  "axiom:timeline-generation",
  "axiom:timeline-impact-projection",
  "axiom:space-generation",
  "axiom:biosphere-generation",
  "axiom:civilization-generation",
  "axiom:mythology-generation",
  "axiom:intervention-application",
  "axiom:explanation-projection",
  "axiom:observation-projection",
  "axiom:share-projection",
  "axiom:event-effect-projection",
  "axiom:state-value-derivation",
  "axiom:summary-grouping",
  "axiom:summary-filtering",
  CAUSAL_CYCLE_AUTHORITY_SUBJECT_ID,
] as const;

export const CAUSAL_INITIAL_STATE_SUBJECT_IDS = [
  "initial-state:template-configuration",
  "initial-state:creation-origin",
] as const;

export const CAUSAL_CYCLE_REQUIRED_CONSTRAINTS = [
  "constraint:cycle-membership-exact",
  "constraint:cycle-edges-explicit",
  "constraint:cycle-root-anchored",
  "constraint:no-root-in-cycle",
] as const;

export type CausalCycleAuthorization = {
  readonly id: string;
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly axiomNodeId: string;
  readonly constraintIds: readonly string[];
};

export type CausalGraph = {
  readonly version: string;
  readonly randomBindingVersion: string;
  readonly generation: CausalGenerationManifest;
  readonly rootNodeIds: readonly string[];
  readonly nodes: readonly CausalNode[];
  readonly edges: readonly CausalEdge[];
  readonly cycleAuthorizations: readonly CausalCycleAuthorization[];
  readonly randomTrace: RandomTraceSnapshot;
  readonly randomResultBindings: readonly CausalRandomResultBinding[];
};

export type CausalValidationIssueCode =
  | "DUPLICATE_NODE"
  | "DUPLICATE_EDGE"
  | "DUPLICATE_EDGE_ENDPOINTS"
  | "DUPLICATE_ROOT"
  | "MISSING_EDGE_ENDPOINT"
  | "ROOT_HAS_CAUSE"
  | "INVALID_ROOT_KIND"
  | "ORPHAN_NODE"
  | "MISSING_RULE_REFERENCE"
  | "UNKNOWN_RULE_REFERENCE"
  | "ADJACENCY_MISMATCH"
  | "NO_ROOT_PATH"
  | "ILLEGAL_CYCLE"
  | "INVALID_CYCLE_AUTHORIZATION"
  | "INVALID_EDGE_RULE"
  | "INVALID_GRAPH_VERSION"
  | "UNTRUSTED_CAUSAL_GRAPH"
  | "INVALID_INPUT_MANIFEST"
  | "INVALID_RANDOM_TRACE"
  | "INVALID_RANDOM_REFERENCE"
  | "INVALID_RANDOM_BINDING";

export type CausalValidationIssue = {
  readonly code: CausalValidationIssueCode;
  readonly nodeId?: string;
  readonly edgeId?: string;
  readonly message: string;
};

export type CausalValidationResult = {
  readonly valid: boolean;
  readonly issues: readonly CausalValidationIssue[];
};
