import type { KnowledgeStatus, ObservableSignal, ObservationMethodId } from "./observation";

export const RESEARCH_NOTEBOOK_VERSION = "ugs-research-notebook@3";

export type KnowledgeQuestion = {
  id: string;
  objectId: string;
  methodId: ObservationMethodId;
  title: string;
  status: KnowledgeStatus;
  signalIds: readonly string[];
  supportingEvidenceIds: readonly string[];
  opposingEvidenceIds: readonly string[];
  neutralEvidenceIds: readonly string[];
};

export type PlayerFocus = { id: string; subjectId: string; label: string; tags: readonly string[]; createdOrder: number };
export type PlayerNote = { id: string; text: string; evidenceIds: readonly string[]; createdOrder: number; updatedOrder: number };
export type PlayerHypothesis = { id: string; statement: string; status: "open" | "supported" | "conflicted" | "rejected"; supportingEvidenceIds: readonly string[]; opposingEvidenceIds: readonly string[]; createdOrder: number };
export type ObservationHistoryEntry = { id: string; order: number; signalId: string; methodId: ObservationMethodId; objectId: string; tick: number };

export type ResearchNotebook = {
  version: typeof RESEARCH_NOTEBOOK_VERSION;
  id: string;
  universeDefinitionId: string;
  runtimeHistoryId: string;
  revision: number;
  signals: readonly ObservableSignal[];
  questions: readonly KnowledgeQuestion[];
  focuses: readonly PlayerFocus[];
  notes: readonly PlayerNote[];
  hypotheses: readonly PlayerHypothesis[];
  observationHistory: readonly ObservationHistoryEntry[];
};

export type ResearchArchiveEnvelope = { version: "ugs-research-archive@3"; notebookId: string; universeDefinitionId: string; notebook: ResearchNotebook; checksum: string };

export type ObservableSignalValidator = (signal: ObservableSignal) => ObservableSignal;

export type ResearchStorageAdapter = {
  readonly storageVersion: string;
  migrate: () => Promise<void>;
  put: (archive: ResearchArchiveEnvelope, validateSignal?: ObservableSignalValidator) => Promise<void>;
  get: (notebookId: string, validateSignal?: ObservableSignalValidator) => Promise<ResearchArchiveEnvelope | undefined>;
  list: (validateSignal?: ObservableSignalValidator) => Promise<readonly ResearchArchiveEnvelope[]>;
  remove: (notebookId: string) => Promise<void>;
};
