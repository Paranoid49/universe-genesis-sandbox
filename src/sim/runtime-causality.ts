import type {
  RuntimeCausalEdge,
  RuntimeCausalNetwork,
  RuntimeCausalNode,
  RuntimeCausalNodeKind,
  StateTransition,
  UniverseState,
} from "./contracts/runtime";
import { projectRuntimeEvents } from "./runtime-events";

export type RuntimeCausalValidationIssueCode =
  | "DUPLICATE_NODE"
  | "DUPLICATE_EDGE"
  | "MISSING_CAUSE"
  | "INVALID_ROOT"
  | "ORPHAN_NODE"
  | "NO_ROOT_PATH"
  | "ADJACENCY_MISMATCH"
  | "ILLEGAL_CYCLE";

export type RuntimeCausalValidationIssue = {
  code: RuntimeCausalValidationIssueCode;
  nodeId?: string;
  edgeId?: string;
  message: string;
};

type NodeInput = Omit<RuntimeCausalNode, "directEffectIds">;

export function buildRuntimeCausalNetwork(state: UniverseState): RuntimeCausalNetwork {
  const inputs: NodeInput[] = [];
  const edges: RuntimeCausalEdge[] = [];
  const addNode = (node: NodeInput) => inputs.push(node);
  const connect = (from: string, to: string, relation: RuntimeCausalEdge["relation"]) => edges.push(Object.freeze({
    id: `runtime-edge:${from}:${relation}:${to}`,
    from,
    to,
    relation,
  }));

  const definitionNodeId = "runtime-root:universe-definition";
  addNode(node(definitionNodeId, state.identity.universeDefinitionId, "root", "宇宙定义", "Seed、规则版本和模板共同定义运行起点。", true, []));
  for (const rule of state.rules) {
    addNode(node(rule.id, rule.id, "rule", "运行规则", JSON.stringify(rule.parameters), true, []));
  }
  for (const input of state.inputLog) {
    addNode(node(`runtime-cause:${input.id}`, input.id, "input", input.kind, JSON.stringify(input.payload), true, []));
  }

  const initialStateId = state.transitions[0]?.beforeStateId ?? state.id;
  const initialNodeId = stateNodeId(initialStateId);
  addNode(node(initialNodeId, initialStateId, "state", "初始运行状态", "运行时开始前的完整状态。", false, [definitionNodeId]));
  connect(definitionNodeId, initialNodeId, "changes");

  for (const transition of state.transitions) addTransitionNodes(transition, addNode, connect);
  for (const event of projectRuntimeEvents(state)) {
    const eventNodeId = `runtime-cause:${event.id}`;
    const transitionNodeId = transitionNode(event.transitionId);
    addNode(node(eventNodeId, event.id, "event", event.title, event.description, false, [transitionNodeId]));
    connect(transitionNodeId, eventNodeId, "projects");
  }

  const effects = new Map<string, string[]>();
  for (const edge of edges) effects.set(edge.from, [...(effects.get(edge.from) ?? []), edge.to]);
  const nodes = inputs.map((entry) => Object.freeze({
    ...entry,
    directCauseIds: Object.freeze([...entry.directCauseIds]),
    directEffectIds: Object.freeze([...(effects.get(entry.id) ?? [])].sort()),
  }));
  const network: RuntimeCausalNetwork = Object.freeze({
    version: "ugs-runtime-causality@1",
    universeDefinitionId: state.identity.universeDefinitionId,
    stateId: state.id,
    rootNodeIds: Object.freeze(nodes.filter((entry) => entry.root).map((entry) => entry.id).sort()),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
  const issues = validateRuntimeCausalNetwork(network);
  if (issues.length > 0) throw new Error(`运行因果网络校验失败：${issues.map((issue) => `[${issue.code}] ${issue.message}`).join("；")}`);
  return network;
}

export function validateRuntimeCausalNetwork(network: RuntimeCausalNetwork): RuntimeCausalValidationIssue[] {
  const issues: RuntimeCausalValidationIssue[] = [];
  const nodes = new Map<string, RuntimeCausalNode>();
  const edgeIds = new Set<string>();
  for (const entry of network.nodes) {
    if (nodes.has(entry.id)) issues.push({ code: "DUPLICATE_NODE", nodeId: entry.id, message: "运行因果节点 ID 重复。" });
    nodes.set(entry.id, entry);
  }
  for (const edge of network.edges) {
    if (edgeIds.has(edge.id)) issues.push({ code: "DUPLICATE_EDGE", edgeId: edge.id, message: "运行因果边 ID 重复。" });
    edgeIds.add(edge.id);
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) issues.push({ code: "MISSING_CAUSE", edgeId: edge.id, message: "运行因果边端点不存在。" });
  }
  const roots = new Set(network.rootNodeIds);
  for (const entry of network.nodes) {
    if (entry.root !== roots.has(entry.id) || (entry.root && entry.directCauseIds.length > 0)) {
      issues.push({ code: "INVALID_ROOT", nodeId: entry.id, message: "运行因果根标记或原因列表无效。" });
    }
    if (!entry.root && entry.directCauseIds.length === 0) issues.push({ code: "ORPHAN_NODE", nodeId: entry.id, message: "运行派生节点没有直接原因。" });
    if (entry.directCauseIds.some((causeId) => !nodes.has(causeId))) issues.push({ code: "MISSING_CAUSE", nodeId: entry.id, message: "运行节点引用了不存在的原因。" });
    const expectedCauses = network.edges.filter((edge) => edge.to === entry.id).map((edge) => edge.from).sort();
    if (JSON.stringify(expectedCauses) !== JSON.stringify([...entry.directCauseIds].sort())) {
      issues.push({ code: "ADJACENCY_MISMATCH", nodeId: entry.id, message: "运行节点原因索引与边集合不一致。" });
    }
    const expectedEffects = network.edges.filter((edge) => edge.from === entry.id).map((edge) => edge.to).sort();
    if (JSON.stringify(expectedEffects) !== JSON.stringify([...entry.directEffectIds].sort())) {
      issues.push({ code: "ADJACENCY_MISMATCH", nodeId: entry.id, message: "运行节点后果索引与边集合不一致。" });
    }
  }
  const reachable = new Set<string>(network.rootNodeIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of network.edges) {
      if (reachable.has(edge.from) && !reachable.has(edge.to)) {
        reachable.add(edge.to);
        changed = true;
      }
    }
  }
  for (const entry of network.nodes) {
    if (!entry.root && !reachable.has(entry.id)) issues.push({ code: "NO_ROOT_PATH", nodeId: entry.id, message: "运行节点无法追溯到合法根因。" });
  }
  if (hasCycle(network)) issues.push({ code: "ILLEGAL_CYCLE", message: "步骤 2 运行因果网络不允许未授权循环。" });
  return issues;
}

export function runtimeDirectCauses(network: RuntimeCausalNetwork, nodeId: string): readonly RuntimeCausalNode[] {
  const nodes = new Map(network.nodes.map((entry) => [entry.id, entry]));
  const target = nodes.get(nodeId);
  if (!target) throw new Error("运行因果查询目标不存在。");
  return Object.freeze(target.directCauseIds.map((id) => nodes.get(id)!).filter(Boolean));
}

export function runtimeDirectEffects(network: RuntimeCausalNetwork, nodeId: string): readonly RuntimeCausalNode[] {
  const nodes = new Map(network.nodes.map((entry) => [entry.id, entry]));
  const target = nodes.get(nodeId);
  if (!target) throw new Error("运行因果查询目标不存在。");
  return Object.freeze(target.directEffectIds.map((id) => nodes.get(id)!).filter(Boolean));
}

function addTransitionNodes(
  transition: StateTransition,
  addNode: (node: NodeInput) => void,
  connect: (from: string, to: string, relation: RuntimeCausalEdge["relation"]) => void,
): void {
  const beforeNodeId = stateNodeId(transition.beforeStateId);
  const afterNodeId = stateNodeId(transition.afterStateId);
  const ruleIds = [...transition.ruleIds];
  const inputNodeIds = transition.inputIds.map((id) => `runtime-cause:${id}`);
  for (const decision of transition.randomDecisions) {
    const decisionNodeId = randomNode(decision.id);
    addNode(node(decisionNodeId, decision.id, "random", "确定性随机决定", `${decision.operation}(${JSON.stringify(decision.parameters)}) = ${decision.selectedValue}，原始样本 ${decision.sampleValue}`, false, [beforeNodeId, ...ruleIds]));
    connect(beforeNodeId, decisionNodeId, "precedes");
    ruleIds.forEach((ruleId) => connect(ruleId, decisionNodeId, "permits"));
  }
  const differenceNodeIds = transition.differences.map((difference, index) => {
    const differenceNodeId = `runtime-cause:${transition.id}:difference:${index + 1}`;
    const causes = [beforeNodeId, difference.ruleId, ...(difference.randomDecisionId ? [randomNode(difference.randomDecisionId)] : [])];
    addNode(node(differenceNodeId, `${transition.id}.difference.${index + 1}`, "difference", difference.field, `${String(difference.before)} → ${String(difference.after)}`, false, causes));
    connect(beforeNodeId, differenceNodeId, "precedes");
    connect(difference.ruleId, differenceNodeId, "permits");
    if (difference.randomDecisionId) connect(randomNode(difference.randomDecisionId), differenceNodeId, "selects");
    return differenceNodeId;
  });
  const transitionNodeId = transitionNode(transition.id);
  const transitionCauses = [...differenceNodeIds, ...inputNodeIds];
  addNode(node(transitionNodeId, transition.id, "transition", "状态转换", `逻辑时刻 ${transition.fromTick} → ${transition.toTick}`, false, transitionCauses));
  transitionCauses.forEach((causeId) => connect(causeId, transitionNodeId, "changes"));
  addNode(node(afterNodeId, transition.afterStateId, "state", "转换后状态", `逻辑时刻 ${transition.toTick} 的完整运行状态。`, false, [transitionNodeId]));
  connect(transitionNodeId, afterNodeId, "changes");
}

function node(
  id: string,
  subjectId: string,
  kind: RuntimeCausalNodeKind,
  label: string,
  description: string,
  root: boolean,
  directCauseIds: string[],
): NodeInput {
  return { id, subjectId, kind, label, description, root, directCauseIds };
}

function stateNodeId(stateId: string): string {
  return `runtime-cause:state:${stateId}`;
}

function transitionNode(transitionId: string): string {
  return `runtime-cause:transition:${transitionId}`;
}

function randomNode(decisionId: string): string {
  return `runtime-cause:random:${decisionId}`;
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
