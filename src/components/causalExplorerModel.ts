import type { CausalGraph, CausalNode } from "../sim";

export type QueryDirection = "causes" | "effects";

export type TracePath = {
  nodeIds: string[];
  hasCycle: boolean;
};

export const maximumRenderedPaths = 24;
export const resultPageSize = 80;
export const reachablePreviewLimit = 80;

const kindLabels: Record<string, string> = {
  input: "外部输入",
  axiom: "宇宙公理",
  initial_state: "初始状态",
  universe: "宇宙结果",
  template: "创世预设",
  law_domain: "法则领域",
  law: "宇宙法则",
  law_interaction: "法则关系",
  metric: "派生指标",
  timeline_event: "历史事件",
  timeline_impact: "事件影响",
  galaxy: "星系",
  star_system: "恒星系",
  planet: "行星",
  biosphere: "生物圈",
  civilization_seed: "文明前兆",
  civilization: "文明",
  mythology: "神话体系",
  civilization_event: "文明事件",
  intervention: "宇宙内干预",
  intervention_result: "干预结果",
  intervention_metric: "干预指标",
  target_mutation: "目标变化",
  probability_shift: "概率变化",
  event_effect: "事件效果",
  state_value: "状态值",
  universe_name: "宇宙名称",
  universe_tagline: "宇宙标语",
  universe_description: "宇宙说明",
  share_result: "分享结果",
  collection_boundary: "集合边界",
  negative_fact: "未形成事实",
  explanation: "解释投影",
  observation: "观测结果",
};

export function buildTracePaths(startNodeId: string, direction: QueryDirection, nodeById: Map<string, CausalNode>): { paths: TracePath[]; truncated: boolean } {
  const paths: TracePath[] = [];
  let truncated = false;

  function visit(nodeId: string, path: string[], seen: Set<string>) {
    if (paths.length >= maximumRenderedPaths) {
      truncated = true;
      return;
    }
    const nextIds = relationIds(nodeById.get(nodeId), direction);
    if (nextIds.length === 0) {
      paths.push({ nodeIds: direction === "causes" ? [...path].reverse() : path, hasCycle: false });
      return;
    }

    for (const nextId of nextIds) {
      if (paths.length >= maximumRenderedPaths) {
        truncated = true;
        return;
      }
      if (seen.has(nextId)) {
        const cyclePath = [...path, nextId];
        paths.push({ nodeIds: direction === "causes" ? cyclePath.reverse() : cyclePath, hasCycle: true });
        continue;
      }
      if (!nodeById.has(nextId)) {
        const missingPath = [...path, nextId];
        paths.push({ nodeIds: direction === "causes" ? missingPath.reverse() : missingPath, hasCycle: false });
        continue;
      }
      visit(nextId, [...path, nextId], new Set([...seen, nextId]));
    }
  }

  visit(startNodeId, [startNodeId], new Set([startNodeId]));
  return { paths, truncated };
}

export function reachableNodes(startNodeId: string, direction: QueryDirection, nodeById: Map<string, CausalNode>): CausalNode[] {
  const visited = new Set<string>();
  const queue = [...relationIds(nodeById.get(startNodeId), direction)];
  const result: CausalNode[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node) continue;
    result.push(node);
    queue.push(...relationIds(node, direction));
  }
  return result;
}

export function rootNodeCount(graph: CausalGraph): number {
  return graph.rootNodeIds.length;
}

export function pickInitialNodeId(graph: CausalGraph): string {
  return graph.nodes.find((node) => !node.root)?.id ?? graph.nodes[0]?.id ?? "";
}

export function kindLabel(kind: string): string {
  return kindLabels[kind] ?? "因果节点";
}

export function nodeLabel(nodeId: string, nodeById: Map<string, CausalNode>): string {
  return nodeById.get(nodeId)?.label ?? `缺失节点 ${nodeId}`;
}

function relationIds(node: CausalNode | undefined, direction: QueryDirection): readonly string[] {
  if (!node) return [];
  return direction === "causes" ? node.directCauseIds : node.directEffectIds;
}
