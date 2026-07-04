export const RULESET_VERSION = "ugs-ruleset@0.1.0";
export const RULESET_SHORT_CODE = "UGS01";

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
};

export type LawDomain = {
  id: LawDomainId;
  title: string;
  rating: LawRating;
  source: string;
  traits: string[];
  cost: string;
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
  timeline: TimelineEvent[];
  explanations: Explanation[];
  observationLog: ObservationLog;
};

export type GenerateUniverseInput = {
  seed: string;
  templateId?: UniverseTemplateId;
};
