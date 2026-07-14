export type CausalRootFieldLocator = {
  readonly kind: "root_field";
  readonly field: "name" | "tagline" | "description" | "shareCode" | "shareUrl" | "shareText";
};

export type CausalMappingKeyLocator = {
  readonly kind: "mapping_key";
  readonly mapping: "metrics" | "laws";
  readonly key: string;
};

export type CausalEntityKind =
  | "law"
  | "law_interaction"
  | "timeline_event"
  | "galaxy"
  | "star_system"
  | "planet"
  | "biosphere"
  | "civilization_seed"
  | "civilization"
  | "mythology"
  | "civilization_event"
  | "intervention";

export type CausalEntityLocator = {
  readonly kind: "entity_id";
  readonly entityKind: CausalEntityKind;
  readonly entityId: string;
  readonly containerKind: "field" | "collection_member";
};

export type CausalCollectionQuantityLocator = {
  readonly kind: "collection_quantity";
  readonly collection: "base_timeline" | "timeline" | "galaxies" | "civilization_history";
  readonly ownerId?: string;
};

export type CausalNegativeFactLocator = {
  readonly kind: "negative_fact";
  readonly predicate: "biosphere_absent" | "civilization_seed_absent";
  readonly entityId: string;
};

export type CausalDomainLocator =
  | CausalRootFieldLocator
  | CausalMappingKeyLocator
  | CausalEntityLocator
  | CausalCollectionQuantityLocator
  | CausalNegativeFactLocator;
