export const RULESET_VERSION = "ugs-ruleset@0.4.0";
export const RULESET_SHORT_CODE = "UGS04";

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
  | "elements"
  | "life"
  | "civilization"
  | "myth"
  | "ascension"
  | "ending";

export type EventType =
  | "creation"
  | "stars"
  | "elements"
  | "life"
  | "civilization"
  | "myth"
  | "ascension"
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
  influence: "metric" | "probability" | "law-pressure";
  affectsFuture: boolean;
};

export type LocalGenerationBiasId =
  | "galaxyDensity"
  | "stellarStability"
  | "planetHabitability"
  | "biosphereChance"
  | "civilizationSeedChance"
  | "magicAnomalyDensity"
  | "divineRelicDensity"
  | "causalHazardLevel";

export type LocalGenerationBias = {
  id: LocalGenerationBiasId;
  label: string;
  value: number;
  sourceEventIds: string[];
  explanation: string;
};

export type TimelineEraProfile = {
  era: EraId;
  eventCount: number;
  futureAffectingEventCount: number;
  influenceScore: number;
  dominantType: EventType;
  keyEventIds: string[];
};

export type TimelineImpactSummary = {
  eventCount: number;
  futureAffectingEventCount: number;
  metricDeltas: Record<MetricId, number>;
  pressureDeltas: Record<"timeline" | "laws", number>;
  localBiases: LocalGenerationBias[];
  eraProfiles: TimelineEraProfile[];
  keySourceEventIds: string[];
  summary: string;
};

export type GalaxyType =
  | "spiral"
  | "elliptical"
  | "dwarf"
  | "irregular"
  | "nebula_forge"
  | "arcane_cluster"
  | "divine_remnant"
  | "causal_shard";

export type StarSystemType =
  | "single_star"
  | "binary_star"
  | "trinary_star"
  | "red_dwarf"
  | "giant_star"
  | "white_dwarf"
  | "black_hole_neighbor"
  | "arcane_star";

export type PlanetType =
  | "rocky"
  | "ocean"
  | "desert"
  | "ice"
  | "gas_giant"
  | "floating"
  | "dream"
  | "aether"
  | "mechanical";

export type BiosphereLevel =
  | "microbial"
  | "complex"
  | "intelligent"
  | "magical"
  | "spiritual"
  | "mechanical";

export type SpeciesType =
  | "biological"
  | "magical"
  | "spiritual"
  | "mechanical"
  | "hybrid";

export type CivilizationFate =
  | "expansion"
  | "ascension"
  | "collapse"
  | "stagnation"
  | "symbiosis"
  | "unknown";

export type CivilizationSeed = {
  originPlanetId: string;
  speciesType: SpeciesType;
  technologyLevel: number;
  magicLevel: number;
  faithIntensity: number;
  expansionDrive: number;
  stability: number;
  fate: CivilizationFate;
  sourceEventIds: string[];
  sourceRuleIds: string[];
};

export type Biosphere = {
  level: BiosphereLevel;
  dominantForm: string;
  complexity: number;
  magicAdaptation: number;
  civilizationChance: number;
  civilizationSeed?: CivilizationSeed;
  sourceEventIds: string[];
  sourceRuleIds: string[];
};

export type Planet = {
  id: string;
  name: string;
  type: PlanetType;
  orbitZone: "inner" | "habitable" | "outer";
  habitability: number;
  magicSaturation: number;
  atmosphere: number;
  water: number;
  stability: number;
  biosphere?: Biosphere;
  sourceEventIds: string[];
  sourceRuleIds: string[];
};

export type StarSystem = {
  id: string;
  name: string;
  type: StarSystemType;
  starClass: string;
  stability: number;
  luminosity: number;
  anomalyLevel: number;
  planets: Planet[];
  sourceEventIds: string[];
  sourceRuleIds: string[];
};

export type Galaxy = {
  id: string;
  name: string;
  type: GalaxyType;
  mass: number;
  metallicity: number;
  magicFlux: number;
  divineResidue: number;
  causalHazard: number;
  starSystems: StarSystem[];
  sourceEventIds: string[];
  sourceRuleIds: string[];
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
  location: string;
  sourceIds: string[];
  triggeredByEventIds: string[];
  causalNotes: string[];
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
  timelineImpact: TimelineImpactSummary;
  galaxies: Galaxy[];
  explanations: Explanation[];
  observationLog: ObservationLog;
};

export type GenerateUniverseInput = {
  seed: string;
  templateId?: UniverseTemplateId;
};
