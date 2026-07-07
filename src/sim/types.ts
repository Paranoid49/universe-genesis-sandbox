export const RULESET_VERSION = "ugs-ruleset@0.2.0";
export const RULESET_SHORT_CODE = "UGS02";

export type UniverseTemplateId =
  | "hard_science"
  | "low_magic"
  | "high_magic"
  | "mythic"
  | "polytheistic_war"
  | "dream_realm"
  | "reincarnation_cycle"
  | "mechanical_divinity"
  | "causal_fracture"
  | "chaotic_laws";

export type LawDomainId =
  | "physics"
  | "magic"
  | "life"
  | "consciousness"
  | "divinity"
  | "causality";

export type MetricId =
  | "age"
  | "stability"
  | "lifePotential"
  | "civilizationPotential"
  | "magicIntensity"
  | "divineActivity"
  | "causalityIntegrity";

export type EraId =
  | "creation"
  | "stars"
  | "life"
  | "civilization"
  | "myth"
  | "ending";

export type EventType =
  | "creation"
  | "stars"
  | "life"
  | "civilization"
  | "myth"
  | "ending"
  | "anomaly";

export type LawRating = {
  value: number;
  label: string;
  explanation: string;
  influences?: MetricInfluence[];
};

export type StructuredLaw = {
  id: string;
  domain: LawDomainId;
  name: string;
  value: number;
  label: string;
  effectTargets: MetricId[];
  polarity: "support" | "pressure" | "volatile";
  explanation: string;
};

export type LawInteraction = {
  id: string;
  sourceLawId: string;
  targetLawId: string;
  kind: "synergy" | "conflict" | "constraint";
  impact: number;
  explanation: string;
};

export type MetricInfluence = {
  sourceId: string;
  sourceLabel: string;
  targetMetric: MetricId;
  delta: number;
  explanation: string;
};

export type LawDomain = {
  id: LawDomainId;
  title: string;
  rating: LawRating;
  source: string;
  traits: string[];
  cost: string;
  rules: StructuredLaw[];
};

export type UniverseLaws = {
  physics: LawDomain;
  magic: LawDomain;
  life: LawDomain;
  consciousness: LawDomain;
  divinity: LawDomain;
  causality: LawDomain;
};

export type UniverseMetrics = {
  age: LawRating;
  stability: LawRating;
  lifePotential: LawRating;
  civilizationPotential: LawRating;
  magicIntensity: LawRating;
  divineActivity: LawRating;
  causalityIntegrity: LawRating;
};

export type EventEffect = {
  metric: MetricId | "timeline" | "laws";
  delta: number;
  description: string;
};

export type TimelineEvent = {
  id: string;
  age: number;
  ageLabel: string;
  era: EraId;
  type: EventType;
  title: string;
  description: string;
  causes: string[];
  effects: EventEffect[];
  importance: number;
};

export type Explanation = {
  id: string;
  targetId: string;
  text: string;
};

export type ObservationLog = {
  importantEvents: string[];
  rareFindings: string[];
  possibleEndings: string[];
};

export type DomainLawDiff = {
  domain: LawDomainId;
  leftValue: number;
  rightValue: number;
  delta: number;
  strongestLeftRule: string;
  strongestRightRule: string;
};

export type LawComparison = {
  leftSeed: string;
  rightSeed: string;
  templateId: UniverseTemplateId;
  domainDiffs: DomainLawDiff[];
  largestDiffDomain: LawDomainId;
  summary: string;
};

export type UniverseSummary = {
  seed: string;
  displaySeed: string;
  rulesetVersion: string;
  rulesetShortCode: string;
  templateId: UniverseTemplateId;
  templateShortCode: string;
  shareCode: string;
  shareUrl: string;
  shareText: string;
  name: string;
  archetype: string;
  tagline: string;
  description: string;
  metrics: UniverseMetrics;
  laws: UniverseLaws;
  lawInteractions: LawInteraction[];
  timeline: TimelineEvent[];
  explanations: Explanation[];
  observationLog: ObservationLog;
};

export type GenerateUniverseInput = {
  seed: string;
  templateId?: UniverseTemplateId;
};
