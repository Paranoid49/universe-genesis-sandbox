import {
  CAUSAL_GRAPH_VERSION,
  CAUSAL_RANDOM_BINDING_VERSION,
  type CausalCycleAuthorization,
  type CausalEdge,
  type CausalEdgeKind,
  type CausalGraph,
  type CausalGenerationManifest,
  type CausalInputEvidence,
  type CausalNode,
  type CausalNodeKind,
  type CausalRandomSampleRef,
  type CausalRandomResultBinding,
  type CausalRootKind,
} from "./contracts/causality";
import type { CausalUniverseSource } from "./causality-source";
import type { RandomDecisionRecord, RandomStreamMetadata, RandomTraceSnapshot } from "./contracts/random";
import { buildRandomResultBindings, RandomBindingTranscript } from "./causality-random-bindings";
export type NodeSpec = {
  id: string;
  subjectId: string;
  kind: CausalNodeKind;
  label: string;
  description: string;
  input?: CausalInputEvidence;
  root?: CausalRootKind;
  causes?: string[];
  ruleIds?: string[];
  randomSampleRefs?: CausalRandomSampleRef[];
};
type MutableCausalNode = Omit<CausalNode, "directCauseIds" | "directEffectIds" | "ruleIds" | "randomSampleRefs"> & {
  directCauseIds: string[];
  directEffectIds: string[];
  ruleIds: string[];
  randomSampleRefs: CausalRandomSampleRef[];
};
type CycleAuthorizationSpec = {
  id: string;
  nodeIds: string[];
  edgeIds: string[];
  axiomNodeId: string;
  constraintIds: string[];
};

export function domainObjectNode(
  builder: CausalGraphBuilder,
  id: string,
  subjectId: string,
  kind: CausalNodeKind,
  label: string,
  description: string,
  sourceEventIds: string[],
  sourceRuleIds: string[],
  subjects: SubjectIndex,
  structuralCauses: string[],
  generationRuleId: string,
  refs: CausalRandomSampleRef[],
  includeDeclaredSources = true,
): NodeSpec {
  const resolvedEventSources = includeDeclaredSources ? sourceEventIds.flatMap((sourceId) => subjects.all(sourceId)) : [];
  const lawRules = includeDeclaredSources ? sourceRuleIds.flatMap((sourceId) => subjects.all(sourceId)).filter(isRuleNodeId) : [];
  const provenanceCause = includeDeclaredSources
    ? ensureProvenanceBundle(builder, subjects, resolvedEventSources, lawRules, generationRuleId)
    : undefined;
  return derived(
    id,
    subjectId,
    kind,
    label,
    description,
    unique([...structuralCauses, ...(provenanceCause ? [provenanceCause] : [])]),
    [generationRuleId],
    refs,
  );
}

function ensureProvenanceBundle(
  builder: CausalGraphBuilder,
  subjects: SubjectIndex,
  eventNodeIds: string[],
  lawNodeIds: string[],
  generationRuleId: string,
): string | undefined {
  const causes = unique([...eventNodeIds, ...lawNodeIds]);
  if (causes.length === 0) return undefined;
  const signature = `${generationRuleId}\u0000${causes.sort().join("\u0000")}`;
  const alias = `provenance-signature:${stableHash(signature)}`;
  const existing = subjects.first(alias);
  if (existing) return existing;
  const id = `provenance:${stableHash(signature)}`;
  add(builder, subjects, derived(
    id,
    `provenance.${stableHash(signature)}`,
    "provenance",
    "领域来源束",
    `保留 ${eventNodeIds.length} 个事件来源与 ${lawNodeIds.length} 个法则来源。`,
    causes,
    unique([generationRuleId, ...lawNodeIds]),
  ), [alias]);
  return id;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function root(
  id: string,
  subjectId: string,
  kind: Extract<CausalNodeKind, CausalRootKind>,
  label: string,
  description: string,
  input?: CausalInputEvidence,
): NodeSpec {
  return { id, subjectId, kind, label, description, input, root: kind, causes: [], ruleIds: [], randomSampleRefs: [] };
}

export function derived(
  id: string,
  subjectId: string,
  kind: CausalNodeKind,
  label: string,
  description: string,
  causes: string[],
  ruleIds: string[],
  randomSampleRefs: CausalRandomSampleRef[] = [],
): NodeSpec {
  return { id, subjectId, kind, label, description, causes: unique(causes), ruleIds: unique(ruleIds), randomSampleRefs };
}

export function add(builder: CausalGraphBuilder, subjects: SubjectIndex, spec: NodeSpec, aliases: string[] = []): void {
  builder.add(spec);
  subjects.add(spec.subjectId, spec.id);
  aliases.forEach((alias) => subjects.add(alias, spec.id));
}

export function randomRefs(
  trace: RandomTraceSnapshot,
  namespaces: string[],
  purpose: string,
  scopeIds?: string[],
): CausalRandomSampleRef[] {
  const index = randomDecisionIndex(trace);
  const entries = scopeIds
    ? namespaces.flatMap((namespace) => scopeIds.flatMap((scopeId) => index.byNamespaceScope.get(`${namespace}\u0000${scopeId}`) ?? []))
    : namespaces.flatMap((namespace) => index.byNamespace.get(namespace) ?? []);
  return entries.map(({ stream, decision }) => ({
    decisionId: decision.decisionId,
    streamId: stream.streamId,
    namespace: stream.namespace,
    scopeId: decision.scopeId,
    sampleIndexes: [decision.sampleIndex],
    firstSampleIndex: decision.sampleIndex,
    lastSampleIndex: decision.sampleIndex,
    purpose,
    candidateSetId: decision.candidateSetId,
    selectedValue: decision.selectedValue,
  }));
}

type IndexedDecision = { stream: RandomStreamMetadata; decision: RandomDecisionRecord };
type RandomDecisionIndex = {
  byNamespace: Map<string, IndexedDecision[]>;
  byNamespaceScope: Map<string, IndexedDecision[]>;
};

const randomIndexes = new WeakMap<object, RandomDecisionIndex>();

function randomDecisionIndex(trace: RandomTraceSnapshot): RandomDecisionIndex {
  const cached = randomIndexes.get(trace);
  if (cached) return cached;
  const index: RandomDecisionIndex = { byNamespace: new Map(), byNamespaceScope: new Map() };
  for (const stream of trace.streams) {
    for (const decision of stream.decisions ?? []) {
      appendIndexed(index.byNamespace, stream.namespace, { stream, decision });
      if (decision.scopeId) appendIndexed(index.byNamespaceScope, `${stream.namespace}\u0000${decision.scopeId}`, { stream, decision });
    }
  }
  randomIndexes.set(trace, index);
  return index;
}

function appendIndexed(map: Map<string, IndexedDecision[]>, key: string, value: IndexedDecision): void {
  const entries = map.get(key) ?? [];
  entries.push(value);
  map.set(key, entries);
}

export function isRuleNodeId(nodeId: string): boolean {
  return nodeId.startsWith("law:") || nodeId.startsWith("axiom:");
}

export function compact<T>(values: Array<T | undefined>): T[] {
  return values.filter(isDefined);
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export class SubjectIndex {
  private readonly nodesBySubject = new Map<string, string[]>();

  add(subjectId: string, nodeId: string): void {
    const current = this.nodesBySubject.get(subjectId) ?? [];
    if (!current.includes(nodeId)) this.nodesBySubject.set(subjectId, [...current, nodeId]);
  }

  all(subjectId: string): string[] {
    return this.nodesBySubject.get(subjectId) ?? [];
  }

  first(subjectId: string): string | undefined {
    return this.all(subjectId)[0];
  }
}

export class CausalGraphBuilder {
  private readonly nodes = new Map<string, MutableCausalNode>();
  private readonly edges = new Map<string, CausalEdge>();
  private readonly cycleAuthorizations: CycleAuthorizationSpec[] = [];
  private readonly randomBindingTranscript: RandomBindingTranscript;
  private edgeSequence = 0;
  constructor(private readonly universe: CausalUniverseSource) { this.randomBindingTranscript = new RandomBindingTranscript(universe); }
  add(spec: NodeSpec): void {
    if (this.nodes.has(spec.id)) throw new Error(`因果节点 ID 重复：${spec.id}`);
    this.randomBindingTranscript.record(spec.id, spec.subjectId, spec.kind, spec.randomSampleRefs ?? []);
    this.nodes.set(spec.id, {
      id: spec.id,
      subjectId: spec.subjectId,
      kind: spec.kind,
      label: spec.label,
      description: spec.description,
      input: spec.input,
      root: spec.root,
      directCauseIds: [],
      directEffectIds: [],
      ruleIds: unique(spec.ruleIds ?? []),
      randomSampleRefs: (spec.randomSampleRefs ?? []).map((reference) => ({
        ...reference,
        resultSubjectId: spec.subjectId,
      })),
    });
    if (!spec.root) this.derive(spec.id, spec.causes ?? [], spec.ruleIds ?? []);
  }
  derive(effectId: string, causeIds: string[], ruleIds: string[], edgeKind: CausalEdgeKind = "derives"): void {
    const effect = this.nodes.get(effectId);
    if (!effect) throw new Error(`待派生因果节点不存在：${effectId}`);
    effect.ruleIds = unique([...effect.ruleIds, ...ruleIds]);
    for (const causeId of unique([...causeIds, ...ruleIds])) {
      const kind = ruleIds.includes(causeId) ? "applies" : edgeKind;
      this.connect(causeId, effectId, kind, kind === "applies" ? "适用规则" : "直接原因");
    }
  }
  authorizeCycle(spec: CycleAuthorizationSpec): void {
    this.cycleAuthorizations.push({
      ...spec,
      nodeIds: unique(spec.nodeIds),
      edgeIds: unique(spec.edgeIds),
      constraintIds: unique(spec.constraintIds),
    });
  }

  finish(randomTrace: RandomTraceSnapshot, generation: CausalGenerationManifest):
  { graph: CausalGraph; expectedRandomBindings: CausalRandomResultBinding[] } {
    const orderedNodes = [...this.nodes.values()].sort((left, right) => compareText(left.id, right.id));
    const publicIdByInternalId = new Map(orderedNodes.map((node, index) => [
      node.id,
      `cause-${String(index + 1).padStart(6, "0")}`,
    ]));
    const publicId = (internalId: string) => publicIdByInternalId.get(internalId) ?? internalId;
    const nodes: CausalNode[] = orderedNodes
      .map((node) => ({
        ...node,
        id: publicId(node.id),
        directCauseIds: node.directCauseIds.map(publicId),
        directEffectIds: node.directEffectIds.map(publicId),
        ruleIds: node.ruleIds.map(publicId),
        randomSampleRefs: node.randomSampleRefs.length > 1
          ? [...node.randomSampleRefs].sort((left, right) => compareText(left.streamId, right.streamId))
          : [...node.randomSampleRefs],
      }));
    const randomResultBindings = buildRandomResultBindings(nodes, this.universe);
    const expectedRandomBindings = this.randomBindingTranscript.materialize(publicId);
    const graph: CausalGraph = {
      version: CAUSAL_GRAPH_VERSION,
      randomBindingVersion: CAUSAL_RANDOM_BINDING_VERSION,
      generation: {
        ...generation,
        inputs: generation.inputs.map((input) => ({ ...input, rootNodeId: publicId(input.rootNodeId) })),
      },
      rootNodeIds: nodes.filter((node) => node.root).map((node) => node.id),
      nodes,
      edges: [...this.edges.values()]
        .map((edge) => ({
          ...edge,
          from: publicId(edge.from),
          to: publicId(edge.to),
          ruleId: edge.ruleId ? publicId(edge.ruleId) : undefined,
        })),
      cycleAuthorizations: this.cycleAuthorizations.map((authorization): CausalCycleAuthorization => ({
        ...authorization,
        nodeIds: authorization.nodeIds.map(publicId).sort(),
        axiomNodeId: publicId(authorization.axiomNodeId),
        constraintIds: [...authorization.constraintIds].sort(),
        edgeIds: [...authorization.edgeIds].sort(),
      })),
      randomTrace,
      randomResultBindings,
    };
    return { graph, expectedRandomBindings };
  }

  private connect(from: string, to: string, kind: CausalEdgeKind, label: string): void {
    const key = `${from}\u0000${to}`;
    if (this.edges.has(key)) return;
    this.edgeSequence += 1;
    const edge: CausalEdge = {
      id: `causal-edge-${String(this.edgeSequence).padStart(6, "0")}`,
      from,
      to,
      kind,
      label,
      ruleId: kind === "applies" ? from : undefined,
    };
    this.edges.set(key, edge);
    this.nodes.get(from)?.directEffectIds.push(to);
    this.nodes.get(to)?.directCauseIds.push(from);
  }
}

function isDefined<T>(value: T | undefined): value is T { return value !== undefined; }

function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
