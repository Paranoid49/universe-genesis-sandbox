import type {
  CausalDomainLocator,
  CausalGraph,
  CausalNode,
  CausalRandomResultBinding,
  CausalValidationIssue,
} from "./contracts/causality";
import { CAUSAL_RANDOM_BINDING_VERSION } from "./contracts/causality";
import { createDomainLocator, domainLocatorsEqual } from "./causality-domain-locators";
import { randomBindingKind } from "./causality-random-bindings";

export function validateRandomResultBindings(graph: CausalGraph, issues: CausalValidationIssue[]): void {
  const expected = new Map<string, { node: CausalNode; locator: CausalDomainLocator }>();
  for (const node of graph.nodes) {
    let locator: CausalDomainLocator | undefined;
    try {
      if (node.randomSampleRefs.length > 0) locator = createDomainLocator(node.subjectId, node.kind);
    } catch {
      locator = undefined;
    }
    if (!locator && node.randomSampleRefs.length > 0) {
      issues.push({ code: "INVALID_RANDOM_BINDING", nodeId: node.id, message: "随机决定对应的领域主题无法定位。" });
      return;
    }
    for (const reference of node.randomSampleRefs) {
      expected.set(randomBindingIdentity(node.id, reference.decisionId), { node, locator: locator! });
    }
  }
  const seen = new Set<string>();
  const actual = graph.randomResultBindings ?? [];
  const valid = graph.randomBindingVersion === CAUSAL_RANDOM_BINDING_VERSION
    && actual.length === expected.size
    && actual.every((binding) => {
      const identity = randomBindingIdentity(binding.resultNodeId, binding.decisionId);
      const entry = expected.get(identity);
      if (!entry || seen.has(identity)) return false;
      seen.add(identity);
      return bindingMatchesNode(binding, entry.node, entry.locator);
    });
  if (!valid) issues.push({ code: "INVALID_RANDOM_BINDING", message: "随机决定与领域结果绑定记录不一致。" });
}

function bindingMatchesNode(
  binding: CausalRandomResultBinding,
  node: CausalNode,
  expectedLocator: CausalDomainLocator,
): boolean {
  if (binding.resultSubjectId !== node.subjectId
    || binding.nodeKind !== node.kind
    || binding.bindingKind !== randomBindingKind(expectedLocator)
    || !node.randomSampleRefs.some((reference) => reference.decisionId === binding.decisionId)
    || !binding.outputValueFingerprint.startsWith("fnv1a32:")) return false;
  return domainLocatorsEqual(binding.locator, expectedLocator);
}

function randomBindingIdentity(nodeId: string, decisionId: string): string {
  return `${nodeId}\u0000${decisionId}`;
}
