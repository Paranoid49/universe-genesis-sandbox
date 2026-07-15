import type { RuntimeCausalNetwork, RuntimeCausalNode } from "./contracts/runtime";

export type RuntimeCausalValidationIssueCode =
  | "DUPLICATE_NODE"
  | "DUPLICATE_EDGE"
  | "MISSING_CAUSE"
  | "INVALID_ROOT"
  | "ORPHAN_NODE"
  | "NO_ROOT_PATH"
  | "ADJACENCY_MISMATCH"
  | "ILLEGAL_CYCLE";

export type RuntimeCausalValidationIssue = { code: RuntimeCausalValidationIssueCode; nodeId?: string; edgeId?: string };

export function validateRuntimeCausalNetwork(network: RuntimeCausalNetwork): RuntimeCausalValidationIssue[] {
  const issues: RuntimeCausalValidationIssue[] = [];
  const nodeIssue = (code: RuntimeCausalValidationIssueCode, nodeId: string) => issues.push({ code, nodeId });
  const edgeIssue = (code: RuntimeCausalValidationIssueCode, edgeId: string) => issues.push({ code, edgeId });
  const nodes = new Map<string, RuntimeCausalNode>();
  const edgeIds = new Set<string>();
  for (const entry of network.nodes) {
    if (nodes.has(entry.id)) nodeIssue("DUPLICATE_NODE", entry.id);
    nodes.set(entry.id, entry);
  }
  for (const edge of network.edges) {
    if (edgeIds.has(edge.id)) edgeIssue("DUPLICATE_EDGE", edge.id);
    edgeIds.add(edge.id);
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) edgeIssue("MISSING_CAUSE", edge.id);
  }
  const roots = new Set(network.rootNodeIds);
  for (const entry of network.nodes) {
    if (entry.root !== roots.has(entry.id) || (entry.root && entry.directCauseIds.length > 0)) nodeIssue("INVALID_ROOT", entry.id);
    if (!entry.root && entry.directCauseIds.length === 0) nodeIssue("ORPHAN_NODE", entry.id);
    if (entry.directCauseIds.some((causeId) => !nodes.has(causeId))) nodeIssue("MISSING_CAUSE", entry.id);
    const expectedCauses = network.edges.filter((edge) => edge.to === entry.id).map((edge) => edge.from).sort();
    if (JSON.stringify(expectedCauses) !== JSON.stringify([...entry.directCauseIds].sort())) nodeIssue("ADJACENCY_MISMATCH", entry.id);
    const expectedEffects = network.edges.filter((edge) => edge.from === entry.id).map((edge) => edge.to).sort();
    if (JSON.stringify(expectedEffects) !== JSON.stringify([...entry.directEffectIds].sort())) nodeIssue("ADJACENCY_MISMATCH", entry.id);
  }
  const reachable = new Set<string>(network.rootNodeIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of network.edges) if (reachable.has(edge.from) && !reachable.has(edge.to)) { reachable.add(edge.to); changed = true; }
  }
  for (const entry of network.nodes) if (!entry.root && !reachable.has(entry.id)) nodeIssue("NO_ROOT_PATH", entry.id);
  if (hasCycle(network)) issues.push({ code: "ILLEGAL_CYCLE" });
  return issues;
}

export function runtimeDirectCauses(network: RuntimeCausalNetwork, nodeId: string): readonly RuntimeCausalNode[] {
  return runtimeRelated(network, nodeId, "directCauseIds");
}

export function runtimeDirectEffects(network: RuntimeCausalNetwork, nodeId: string): readonly RuntimeCausalNode[] {
  return runtimeRelated(network, nodeId, "directEffectIds");
}

function runtimeRelated(network: RuntimeCausalNetwork, nodeId: string, key: "directCauseIds" | "directEffectIds"): readonly RuntimeCausalNode[] {
  const nodes = new Map(network.nodes.map((entry) => [entry.id, entry]));
  const target = nodes.get(nodeId);
  if (!target) throw new Error("CAUSAL_NODE");
  return Object.freeze(target[key].map((id) => nodes.get(id)!).filter(Boolean));
}

function hasCycle(network: RuntimeCausalNetwork): boolean {
  const effects = new Map<string, string[]>();
  for (const edge of network.edges) effects.set(edge.from, [...(effects.get(edge.from) ?? []), edge.to]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    if ((effects.get(nodeId) ?? []).some(visit)) return true;
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };
  return network.nodes.some((entry) => visit(entry.id));
}
