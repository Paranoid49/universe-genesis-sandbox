export type RandomDecisionOperation = "next" | "range" | "int" | "bool" | "pick" | "weighted";

export type RandomDecisionParameters =
  | { readonly kind: "next" }
  | { readonly kind: "range"; readonly min: number; readonly max: number }
  | { readonly kind: "int"; readonly min: number; readonly max: number }
  | { readonly kind: "bool"; readonly chance: number }
  | { readonly kind: "pick"; readonly candidates: readonly string[] }
  | { readonly kind: "weighted"; readonly candidates: readonly { readonly label: string; readonly weight: number }[] };

export type RandomDecisionRecord = {
  readonly decisionId: string;
  readonly sampleIndex: number;
  readonly sampleValue: number;
  readonly operation: RandomDecisionOperation;
  readonly parameters: RandomDecisionParameters;
  readonly scopeId?: string;
  readonly candidateSetId: string;
  readonly candidates: readonly string[];
  readonly selectedValue: string;
};

export type RandomStreamMetadata = {
  readonly algorithmVersion: string;
  readonly streamId: string;
  readonly namespace: string;
  readonly seedFingerprint: string;
  readonly sampleCount: number;
  readonly lastSampleIndex: number | null;
  readonly decisions: readonly RandomDecisionRecord[];
};

export type RandomTraceSnapshot = {
  readonly algorithmVersion: string;
  readonly generationId: string;
  readonly seedMaterial: string;
  readonly seedFingerprint: string;
  readonly totalSamples: number;
  readonly streams: readonly RandomStreamMetadata[];
};
