import { assertCausalGraphStructure } from "./causality-query";
import type { CausalEdge, CausalGraph, CausalNode } from "./contracts/causality";

type MutableProjectionNode = Omit<CausalNode, "directCauseIds" | "directEffectIds" | "ruleIds" | "randomSampleRefs"> & {
  directCauseIds: string[];
  directEffectIds: string[];
  ruleIds: string[];
  randomSampleRefs: CausalNode["randomSampleRefs"][number][];
};

export type CausalProjectionSpec = {
  readonly id: string;
  readonly subjectId: string;
  readonly kind: "observation" | "explanation" | "state_value";
  readonly label: string;
  readonly description: string;
  readonly causeNodeIds: readonly string[];
  readonly ruleNodeId: string;
  readonly evidence?: readonly CausalProjectionEvidenceSpec[];
};

export type CausalProjectionEvidenceSpec = {
  readonly id: string;
  readonly subjectId: string;
  readonly label: string;
  readonly description: string;
  readonly causeNodeIds: readonly string[];
  readonly ruleNodeId: string;
};

export function appendCausalProjectionStructure(graph: CausalGraph, specs: readonly CausalProjectionSpec[]): CausalGraph {
  const nodes: MutableProjectionNode[] = graph.nodes.map((node) => ({
    ...node,
    directCauseIds: [...node.directCauseIds],
    directEffectIds: [...node.directEffectIds],
    ruleIds: [...node.ruleIds],
    randomSampleRefs: [...node.randomSampleRefs],
  }));
  const edges: CausalEdge[] = [...graph.edges];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  let edgeSequence = edges.length;

  for (const spec of specs) {
    for (const evidence of spec.evidence ?? []) {
      appendProjectionNode({
        ...evidence,
        kind: "state_value",
      });
    }
    appendProjectionNode(spec);
  }

  function appendProjectionNode(spec: Omit<CausalProjectionSpec, "evidence">): void {
    const nodeId = `projection:${spec.id}`;
    if (nodesById.has(nodeId)) throw new Error(`投影节点 ID 重复：${nodeId}`);
    const causes = [...new Set([...spec.causeNodeIds, spec.ruleNodeId])];
    if (causes.some((causeId) => !nodesById.has(causeId))) throw new Error(`投影 ${spec.id} 引用了不存在的原因节点。`);
    const node: MutableProjectionNode = {
      id: nodeId,
      subjectId: spec.subjectId,
      kind: spec.kind,
      label: spec.label,
      description: spec.description,
      directCauseIds: [...causes].sort(),
      directEffectIds: [],
      ruleIds: [spec.ruleNodeId],
      randomSampleRefs: [],
    };
    nodes.push(node);
    nodesById.set(nodeId, node);
    for (const causeId of causes) {
      edgeSequence += 1;
      const kind = causeId === spec.ruleNodeId ? "applies"
        : spec.kind === "observation" ? "observes" : spec.kind === "explanation" ? "explains" : "derives";
      edges.push({
        id: `projection-edge-${String(edgeSequence).padStart(6, "0")}`,
        from: causeId,
        to: nodeId,
        kind,
        label: kind === "applies" ? "适用投影规则" : "投影来源",
        ruleId: kind === "applies" ? causeId : undefined,
      });
      const cause = nodesById.get(causeId);
      if (cause) {
        cause.directEffectIds.push(nodeId);
        cause.directEffectIds.sort();
      }
    }
  }

  const projected: CausalGraph = {
    ...graph,
    cycleAuthorizations: graph.cycleAuthorizations ?? [],
    nodes: [...nodes].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges].sort((left, right) => left.id.localeCompare(right.id)),
  };
  assertCausalGraphStructure(projected, graph.generation);
  return projected;
}
