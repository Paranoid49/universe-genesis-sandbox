import type { LawDomainId } from "../types";

export const LAW_COMPARISON_EVIDENCE_VERSION = "ugs-law-comparison-evidence@1";

export type LawComparisonEvidenceTarget = LawDomainId | "maximum";

export type LawComparisonGraphEvidence = {
  readonly seed: string;
  readonly generationId: string;
  readonly sourceNodeIds: readonly string[];
};

export type LawComparisonValueEvidence = {
  readonly domain: LawDomainId;
  readonly leftValue: number;
  readonly rightValue: number;
  readonly delta: number;
};

export type LawComparisonEvidence = {
  readonly version: string;
  readonly id: string;
  readonly target: LawComparisonEvidenceTarget;
  readonly selectedDomain: LawDomainId;
  readonly values: readonly LawComparisonValueEvidence[];
  readonly left: LawComparisonGraphEvidence;
  readonly right: LawComparisonGraphEvidence;
};
