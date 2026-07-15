import {
  type CausalDomainLocator,
  type CausalNode,
  type CausalNodeKind,
  type CausalRandomSampleRef,
  type CausalRandomResultBinding,
} from "./contracts/causality";
import type { CausalUniverseSource } from "./causality-source";
import { createDomainLocator, domainLocatorFingerprint } from "./causality-domain-locators";

export class RandomBindingTranscript {
  private readonly bindings: CausalRandomResultBinding[] = [];

  constructor(private readonly universe: CausalUniverseSource) {}

  record(nodeId: string, subjectId: string, nodeKind: CausalNodeKind, references: readonly CausalRandomSampleRef[]): void {
    this.bindings.push(...createRandomResultBindingsForNode(this.universe, nodeId, subjectId, nodeKind, references));
  }

  materialize(publicId: (internalId: string) => string): CausalRandomResultBinding[] {
    return this.bindings.map((binding) => ({ ...binding, resultNodeId: publicId(binding.resultNodeId) })).sort(compareRandomBinding);
  }
}

export function buildRandomResultBindings(
  nodes: readonly CausalNode[],
  universe: CausalUniverseSource,
): CausalRandomResultBinding[] {
  return nodes.flatMap((node) => createRandomResultBindingsForNode(
    universe, node.id, node.subjectId, node.kind, node.randomSampleRefs,
  )).sort(compareRandomBinding);
}

function createRandomResultBindingsForNode(
  universe: CausalUniverseSource,
  resultNodeId: string,
  resultSubjectId: string,
  nodeKind: CausalNodeKind,
  references: readonly CausalRandomSampleRef[],
): CausalRandomResultBinding[] {
  if (references.length === 0) return [];
  const locator = createDomainLocator(resultSubjectId, nodeKind);
  const outputValueFingerprint = domainLocatorFingerprint(universe, locator);
  return references.map((reference) => ({
    decisionId: reference.decisionId,
    resultNodeId,
    resultSubjectId,
    nodeKind,
    bindingKind: randomBindingKind(locator),
    locator,
    outputValueFingerprint,
    scopeId: reference.scopeId,
  }));
}

export function assertRandomResultBindingsResolve(
  universe: CausalUniverseSource,
  bindings: readonly CausalRandomResultBinding[],
): void {
  const resolvedFingerprints = new Map<string, string>();
  for (const binding of bindings) {
    const locatorKey = domainLocatorKey(binding.locator);
    let resolvedFingerprint = resolvedFingerprints.get(locatorKey);
    if (!resolvedFingerprint) {
      resolvedFingerprint = domainLocatorFingerprint(universe, binding.locator);
      resolvedFingerprints.set(locatorKey, resolvedFingerprint);
    }
    if (resolvedFingerprint !== binding.outputValueFingerprint) {
      throw new Error("失配");
    }
  }
}

export function randomResultBindingsMatchExpected(
  actual: readonly CausalRandomResultBinding[],
  expected: readonly CausalRandomResultBinding[],
): boolean {
  return actual.length === expected.length && actual.every((binding, index) => {
    const counterpart = expected[index];
    return Boolean(counterpart)
      && binding.decisionId === counterpart.decisionId
      && binding.resultNodeId === counterpart.resultNodeId
      && binding.resultSubjectId === counterpart.resultSubjectId
      && binding.nodeKind === counterpart.nodeKind
      && binding.bindingKind === counterpart.bindingKind
      && binding.outputValueFingerprint === counterpart.outputValueFingerprint
      && binding.scopeId === counterpart.scopeId
      && domainLocatorKey(binding.locator) === domainLocatorKey(counterpart.locator);
  });
}

export function randomBindingKind(locator: CausalDomainLocator): CausalRandomResultBinding["bindingKind"] {
  if (locator.kind === "collection_quantity") return "collection_quantity";
  if (locator.kind === "negative_fact") return "negative_fact";
  if (locator.kind === "entity_id") return locator.containerKind;
  return "field";
}

function compareRandomBinding(left: CausalRandomResultBinding, right: CausalRandomResultBinding): number {
  return `${left.resultNodeId}\u0000${left.decisionId}`.localeCompare(`${right.resultNodeId}\u0000${right.decisionId}`);
}

function domainLocatorKey(locator: CausalDomainLocator): string {
  if (locator.kind === "root_field") return `${locator.kind}\u0000${locator.field}`;
  if (locator.kind === "mapping_key") return `${locator.kind}\u0000${locator.mapping}\u0000${locator.key}`;
  if (locator.kind === "entity_id") return `${locator.kind}\u0000${locator.entityKind}\u0000${locator.entityId}\u0000${locator.containerKind}`;
  if (locator.kind === "collection_quantity") return `${locator.kind}\u0000${locator.collection}\u0000${locator.ownerId ?? ""}`;
  return `${locator.kind}\u0000${locator.predicate}\u0000${locator.entityId}`;
}
