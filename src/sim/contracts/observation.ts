export const OBSERVATION_PROTOCOL_VERSION = "ugs-observation@3";
export const EVIDENCE_PROTOCOL_VERSION = "ugs-evidence@1";

export type ObservationMethodId = string;
export type KnowledgeStatus = "unobserved" | "insufficient" | "observed-no-result" | "supported" | "conflicted" | "confirmed" | "confirmed-absent";
export type EvidenceStrength = "weak" | "moderate" | "strong";

export type ObservationContext = {
  universeDefinitionId: string;
  stateId: string;
  runtimeHistoryId: string;
  tick: number;
  visibleObjectIds: readonly string[];
  availableMethodIds: readonly ObservationMethodId[];
};

export type ObservationMethod = {
  id: ObservationMethodId;
  version: typeof OBSERVATION_PROTOCOL_VERSION;
  name: string;
  description: string;
  scale: "object" | "history" | "rule";
  phenomenon: string;
  kind: "range" | "trend" | "recent-change" | "rule-trace";
  field?: string;
  bands?: readonly { maximum?: number; label: string }[];
};

export type ObservationRequest = {
  methodId: ObservationMethodId;
  objectId: string;
  tick: number;
};

export type EvidenceRecord = {
  version: typeof EVIDENCE_PROTOCOL_VERSION;
  id: string;
  universeDefinitionId: string;
  runtimeHistoryId: string;
  stateId: string;
  methodId: ObservationMethodId;
  objectId: string;
  tick: number;
  strength: EvidenceStrength;
  stance: "supports" | "opposes" | "neutral";
  summary: string;
  sourceSubjectIds: readonly string[];
  causalNodeIds: readonly string[];
};

export type ObservableSignal = {
  version: typeof OBSERVATION_PROTOCOL_VERSION;
  id: string;
  universeDefinitionId: string;
  runtimeHistoryId: string;
  stateId: string;
  methodId: ObservationMethodId;
  objectId: string;
  tick: number;
  title: string;
  visibleValue: string;
  knowledgeStatus: KnowledgeStatus;
  uncertainty: string;
  evidence: readonly EvidenceRecord[];
};

export type ObservationObjectReference = {
  id: string;
  kind: string;
  label: string;
};

export type PublicAxiomReference = {
  id: string;
  label: string;
};

export type ObservationMetricReference = {
  id: string;
  name: string;
  visibility: "public" | "observable";
  methodIds: readonly ObservationMethodId[];
};

export type ObservationAccess = {
  universeDefinitionId: string;
  runtimeHistoryId: string;
  stateId: string;
  currentTick: number;
  topology: { mode: "hierarchical" | "relational" | "semantic"; relationNames: readonly string[]; relationCount: number };
  objects: readonly ObservationObjectReference[];
  methods: readonly ObservationMethod[];
  metrics: readonly ObservationMetricReference[];
  publicAxioms: readonly PublicAxiomReference[];
  observe: (request: ObservationRequest) => ObservableSignal;
  validateSignal: (signal: ObservableSignal) => ObservableSignal;
  validateLegacySignal: (signal: ObservableSignal) => ObservableSignal;
};

export type InternalKnowledgeClaim = {
  id: string;
  entityId: string;
  statement: string;
  status: KnowledgeStatus;
  evidenceIds: readonly string[];
};
