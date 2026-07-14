import {
  CAUSAL_AXIOM_SUBJECT_IDS,
  CAUSAL_CYCLE_AUTHORITY_SUBJECT_ID,
  CAUSAL_CYCLE_REQUIRED_CONSTRAINTS,
  CAUSAL_GRAPH_VERSION,
  CAUSAL_INITIAL_STATE_SUBJECT_IDS,
  type CausalEdge,
  type CausalGraph,
  type CausalGenerationManifest,
  type CausalNode,
  type CausalNodeKind,
  type CausalRootKind,
  type CausalValidationIssue,
  type CausalValidationResult,
} from "./contracts/causality";
import { validateCausalGenerationManifest } from "./causality-generation";
import { validateCausalRandomEvidence } from "./causality-random-validation";
import { validateRandomResultBindings } from "./causality-random-binding-validation";

const knownAxiomSubjects = new Set<string>(CAUSAL_AXIOM_SUBJECT_IDS);
const knownInitialStateSubjects = new Set<string>(CAUSAL_INITIAL_STATE_SUBJECT_IDS);
const frozenQueryNodeMaps = new WeakMap<object, Map<string, CausalNode>>();

export function getDirectCauses(graph: CausalGraph, nodeId: string): CausalNode[] {
  const nodes = queryNodeMap(graph);
  return (nodes.get(nodeId)?.directCauseIds ?? []).map((id) => nodes.get(id)).filter(isDefined);
}

export function getDirectEffects(graph: CausalGraph, nodeId: string): CausalNode[] {
  const nodes = queryNodeMap(graph);
  return (nodes.get(nodeId)?.directEffectIds ?? []).map((id) => nodes.get(id)).filter(isDefined);
}

export function traceCausalAncestors(graph: CausalGraph, nodeId: string): CausalNode[] {
  return traceDirection(graph, nodeId, "directCauseIds");
}

export function traceCausalDescendants(graph: CausalGraph, nodeId: string): CausalNode[] {
  return traceDirection(graph, nodeId, "directEffectIds");
}

export function validateCausalGraphStructure(
  graph: CausalGraph,
  expectedGeneration: CausalGenerationManifest,
): CausalValidationResult {
  return validateGraph(graph, expectedGeneration);
}

function validateGraph(
  graph: CausalGraph,
  expectedGeneration: CausalGenerationManifest,
): CausalValidationResult {
  const issues: CausalValidationIssue[] = [];
  if (graph.version !== CAUSAL_GRAPH_VERSION) {
    issues.push({ code: "INVALID_GRAPH_VERSION", message: `因果图版本 ${graph.version} 不受支持。` });
  }

  const nodes = nodeMapWithDuplicateCheck(graph, issues);
  const edges = edgeMapWithChecks(graph, nodes, issues);
  const validInputRootIds = validateCausalGenerationManifest(graph, nodes, issues, expectedGeneration);
  const expectedCauses = new Map<string, Set<string>>();
  const expectedEffects = new Map<string, Set<string>>();
  for (const edge of edges.values()) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue;
    addSetValue(expectedEffects, edge.from, edge.to);
    addSetValue(expectedCauses, edge.to, edge.from);
  }

  const rootIds = validateRootList(graph, issues);
  const validRootIds = new Set<string>();
  for (const node of graph.nodes) {
    const causes = expectedCauses.get(node.id) ?? new Set<string>();
    const effects = expectedEffects.get(node.id) ?? new Set<string>();
    if (!sameStringSet(node.directCauseIds, causes) || !sameStringSet(node.directEffectIds, effects)) {
      issues.push({ code: "ADJACENCY_MISMATCH", nodeId: node.id, message: `节点 ${node.id} 的双向邻接索引与因果边不一致。` });
    }
    if (node.root) {
      if (!validRootPair(node.kind, node.root) || !rootIds.has(node.id) || !authenticRoot(node, validInputRootIds)) {
        issues.push({ code: "INVALID_ROOT_KIND", nodeId: node.id, message: `节点 ${node.id} 不是当前规则集授权的事实根。` });
      } else {
        validRootIds.add(node.id);
      }
      if (causes.size > 0) {
        issues.push({ code: "ROOT_HAS_CAUSE", nodeId: node.id, message: `事实根 ${node.id} 不应拥有前置原因。` });
      }
    } else {
      if (causes.size === 0) issues.push({ code: "ORPHAN_NODE", nodeId: node.id, message: `派生节点 ${node.id} 没有直接原因。` });
      if (node.ruleIds.length === 0) issues.push({ code: "MISSING_RULE_REFERENCE", nodeId: node.id, message: `派生节点 ${node.id} 没有适用规则。` });
    }
    validateRuleReferences(node, nodes, issues);
  }

  for (const rootId of rootIds) {
    if (!nodes.get(rootId)?.root) {
      issues.push({ code: "INVALID_ROOT_KIND", nodeId: rootId, message: `根列表中的 ${rootId} 不是合法事实根。` });
    }
  }

  validateCausalRandomEvidence(graph, issues);
  validateRandomResultBindings(graph, issues);

  const components = findCycleComponents(graph);
  const authorizedComponents = validateCycleAuthorizations(graph, nodes, edges, validRootIds, components, issues);
  for (const component of components) {
    const key = componentKey(component);
    if (authorizedComponents.has(key)) continue;
    for (const nodeId of component) {
      issues.push({ code: "ILLEGAL_CYCLE", nodeId, message: `节点 ${nodeId} 位于未经高阶公理和一致性约束许可的因果循环中。` });
    }
  }

  const rootReachability = new Map<string, boolean>();
  for (const node of graph.nodes) {
    if (!node.root && !hasRootPath(node.id, nodes, validRootIds, rootReachability, new Set())) {
      issues.push({ code: "NO_ROOT_PATH", nodeId: node.id, message: `节点 ${node.id} 无法回溯到合法事实根。` });
    }
  }

  return { valid: issues.length === 0, issues };
}

export function assertCausalGraphStructure(graph: CausalGraph, expectedGeneration: CausalGenerationManifest): void {
  const result = validateCausalGraphStructure(graph, expectedGeneration);
  if (!result.valid) throw new Error(`因果闭包校验失败：${result.issues.map((issue) => `[${issue.code}] ${issue.message}`).join("；")}`);
}

function edgeMapWithChecks(
  graph: CausalGraph,
  nodes: Map<string, CausalNode>,
  issues: CausalValidationIssue[],
): Map<string, CausalEdge> {
  const edges = new Map<string, CausalEdge>();
  const endpointPairs = new Set<string>();
  for (const edge of graph.edges) {
    if (edges.has(edge.id)) {
      issues.push({ code: "DUPLICATE_EDGE", edgeId: edge.id, message: `因果边 ${edge.id} 重复。` });
      continue;
    }
    edges.set(edge.id, edge);
    const endpointKey = `${edge.from}\u0000${edge.to}`;
    if (endpointPairs.has(endpointKey)) {
      issues.push({ code: "DUPLICATE_EDGE_ENDPOINTS", edgeId: edge.id, message: `因果边 ${edge.id} 与已有边重复连接同一对端点。` });
    }
    endpointPairs.add(endpointKey);
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      issues.push({ code: "MISSING_EDGE_ENDPOINT", edgeId: edge.id, message: `因果边 ${edge.id} 的端点不存在。` });
    }
    const rule = edge.ruleId ? nodes.get(edge.ruleId) : undefined;
    const validApply = edge.kind === "applies" && edge.ruleId === edge.from && isRuleNode(rule);
    const validNonApply = edge.kind !== "applies" && edge.ruleId === undefined;
    if (!validApply && !validNonApply) {
      issues.push({ code: "INVALID_EDGE_RULE", edgeId: edge.id, message: `因果边 ${edge.id} 的规则引用与边类型不一致。` });
    }
  }
  return edges;
}

function validateRootList(graph: CausalGraph, issues: CausalValidationIssue[]): Set<string> {
  const roots = new Set<string>();
  for (const rootId of graph.rootNodeIds) {
    if (roots.has(rootId)) issues.push({ code: "DUPLICATE_ROOT", nodeId: rootId, message: `事实根 ${rootId} 在根列表中重复。` });
    roots.add(rootId);
  }
  return roots;
}

function validateRuleReferences(node: CausalNode, nodes: Map<string, CausalNode>, issues: CausalValidationIssue[]): void {
  for (const ruleId of node.ruleIds) {
    const rule = nodes.get(ruleId);
    if (!isRuleNode(rule) || (rule.kind === "axiom" && !authenticRoot(rule))) {
      issues.push({ code: "UNKNOWN_RULE_REFERENCE", nodeId: node.id, message: `节点 ${node.id} 引用了不存在或无效的规则 ${ruleId}。` });
    }
  }
}

function validateCycleAuthorizations(
  graph: CausalGraph,
  nodes: Map<string, CausalNode>,
  edges: Map<string, CausalEdge>,
  validRootIds: Set<string>,
  components: string[][],
  issues: CausalValidationIssue[],
): Set<string> {
  const authorized = new Set<string>();
  const authorizationIds = new Set<string>();
  const componentsByKey = new Map(components.map((component) => [componentKey(component), component]));
  for (const authorization of graph.cycleAuthorizations ?? []) {
    let valid = true;
    if (!authorization.id || authorizationIds.has(authorization.id)) valid = false;
    authorizationIds.add(authorization.id);
    const nodeKey = componentKey(authorization.nodeIds);
    const component = componentsByKey.get(nodeKey);
    const axiom = nodes.get(authorization.axiomNodeId);
    const internalEdgeIds = component
      ? [...edges.values()].filter((edge) => component.includes(edge.from) && component.includes(edge.to)).map((edge) => edge.id)
      : [];
    valid &&= Boolean(component)
      && sameStringSet(authorization.constraintIds, new Set(CAUSAL_CYCLE_REQUIRED_CONSTRAINTS))
      && sameStringSet(authorization.edgeIds, new Set(internalEdgeIds))
      && axiom?.kind === "axiom"
      && axiom.root === "axiom"
      && axiom.subjectId === CAUSAL_CYCLE_AUTHORITY_SUBJECT_ID
      && authorization.nodeIds.every((id) => nodes.has(id) && !validRootIds.has(id))
      && authorization.edgeIds.every((id) => edges.has(id))
      && Boolean(component && cycleHasExternalRootPath(component, nodes, validRootIds));
    if (!valid) {
      issues.push({ code: "INVALID_CYCLE_AUTHORIZATION", message: `闭环授权 ${authorization.id || "<空>"} 未满足高阶公理或一致性约束。` });
      continue;
    }
    authorized.add(nodeKey);
  }
  return authorized;
}

function cycleHasExternalRootPath(component: string[], nodes: Map<string, CausalNode>, validRootIds: Set<string>): boolean {
  const members = new Set(component);
  return component.some((nodeId) => nodes.get(nodeId)?.directCauseIds.some((causeId) => !members.has(causeId)
    && hasRootPath(causeId, nodes, validRootIds, new Map(), new Set())));
}

function findCycleComponents(graph: CausalGraph): string[][] {
  const nodes = nodeMap(graph);
  const indexByNode = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let index = 0;
  const visit = (nodeId: string) => {
    indexByNode.set(nodeId, index);
    lowLink.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    onStack.add(nodeId);
    for (const effectId of nodes.get(nodeId)?.directEffectIds ?? []) {
      if (!indexByNode.has(effectId)) {
        visit(effectId);
        lowLink.set(nodeId, Math.min(lowLink.get(nodeId) ?? 0, lowLink.get(effectId) ?? 0));
      } else if (onStack.has(effectId)) {
        lowLink.set(nodeId, Math.min(lowLink.get(nodeId) ?? 0, indexByNode.get(effectId) ?? 0));
      }
    }
    if (lowLink.get(nodeId) !== indexByNode.get(nodeId)) return;
    const component: string[] = [];
    let current: string | undefined;
    do {
      current = stack.pop();
      if (!current) break;
      onStack.delete(current);
      component.push(current);
    } while (current !== nodeId);
    const selfCycle = component.length === 1 && nodes.get(component[0])?.directEffectIds.includes(component[0]);
    if (component.length > 1 || selfCycle) components.push(component.sort());
  };
  graph.nodes.forEach((node) => {
    if (!indexByNode.has(node.id)) visit(node.id);
  });
  return components.sort((left, right) => componentKey(left).localeCompare(componentKey(right)));
}

function nodeMap(graph: CausalGraph): Map<string, CausalNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function nodeMapWithDuplicateCheck(graph: CausalGraph, issues: CausalValidationIssue[]): Map<string, CausalNode> {
  const result = new Map<string, CausalNode>();
  for (const node of graph.nodes) {
    if (result.has(node.id)) issues.push({ code: "DUPLICATE_NODE", nodeId: node.id, message: `因果节点 ${node.id} 重复。` });
    else result.set(node.id, node);
  }
  return result;
}

function traceDirection(graph: CausalGraph, nodeId: string, key: "directCauseIds" | "directEffectIds"): CausalNode[] {
  const nodes = queryNodeMap(graph);
  const visited = new Set<string>();
  const queue = [...(nodes.get(nodeId)?.[key] ?? [])];
  const result: CausalNode[] = [];
  let cursor = 0;
  while (cursor < queue.length) {
    const currentId = queue[cursor];
    cursor += 1;
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);
    const node = nodes.get(currentId);
    if (!node) continue;
    result.push(node);
    queue.push(...node[key]);
  }
  return result;
}

function queryNodeMap(graph: CausalGraph): Map<string, CausalNode> {
  if (!Object.isFrozen(graph) || !Object.isFrozen(graph.nodes)) return nodeMap(graph);
  const cached = frozenQueryNodeMaps.get(graph);
  if (cached) return cached;
  const nodes = nodeMap(graph);
  frozenQueryNodeMaps.set(graph, nodes);
  return nodes;
}

function hasRootPath(
  nodeId: string,
  nodes: Map<string, CausalNode>,
  validRootIds: Set<string>,
  memo: Map<string, boolean>,
  active: Set<string>,
): boolean {
  const cached = memo.get(nodeId);
  if (cached !== undefined) return cached;
  const node = nodes.get(nodeId);
  if (!node) return false;
  if (node.root) return validRootIds.has(node.id);
  if (active.has(nodeId)) return false;
  active.add(nodeId);
  const result = node.directCauseIds.some((causeId) => hasRootPath(causeId, nodes, validRootIds, memo, active));
  active.delete(nodeId);
  memo.set(nodeId, result);
  return result;
}

function authenticRoot(node: CausalNode, validInputRootIds: Set<string> = new Set()): boolean {
  if (node.root === "axiom") return knownAxiomSubjects.has(node.subjectId);
  if (node.root === "initial_state") return knownInitialStateSubjects.has(node.subjectId);
  return node.root === "input" && validInputRootIds.has(node.id);
}


function validRootPair(kind: CausalNodeKind, rootKind: CausalRootKind): boolean {
  return kind === rootKind && (kind === "input" || kind === "axiom" || kind === "initial_state");
}

function isRuleNode(node: CausalNode | undefined): node is CausalNode {
  return Boolean(node && (node.kind === "axiom" || node.kind === "law"));
}

function addSetValue(map: Map<string, Set<string>>, key: string, value: string): void {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}

function sameStringSet(actual: readonly string[], expected: Set<string>): boolean {
  return actual.length === expected.size && actual.every((value) => expected.has(value));
}

function componentKey(nodeIds: readonly string[]): string {
  return [...new Set(nodeIds)].sort().join("\u0000");
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
