import type {
  RuntimeCausalEdge,
  RuntimeCausalNetwork,
  RuntimeCausalNode,
  RuntimeCausalNodeKind,
  StateTransition,
  UniverseState,
} from "./contracts/runtime";
import { projectRuntimeEvents } from "./runtime-events";
import { validateRuntimeCausalNetwork } from "./runtime-causality-validation";
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
  addNode(node(definitionNodeId, state.identity.universeDefinitionId, "root", "宇宙定义", "定义运行起点。", true, []));
  const constitutionNodeId = "runtime-root:constitution";
  addNode(node(constitutionNodeId, state.identity.constitutionId, "root", "宇宙宪法", "宪法根因。", true, []));
  for (const rule of state.rules) {
    addNode(node(rule.id, rule.id, "rule", rule.name, "宪法规则。", false, [constitutionNodeId]));
    connect(constitutionNodeId, rule.id, "permits");
  }
  const declaredRuleIds = new Set(state.rules.map((entry) => entry.id));
  const projectedRuleIds = new Set(state.transitions.flatMap((transition) => transition.differences.map((difference) => difference.ruleId)).filter((id) => !declaredRuleIds.has(id)));
  for (const ruleId of projectedRuleIds) {
    addNode(node(ruleId, ruleId, "rule", "输入作用", "宪法允许的输入。", false, [constitutionNodeId]));
    connect(constitutionNodeId, ruleId, "permits");
  }
  for (const input of state.inputLog) {
    addNode(node(`runtime-cause:${input.id}`, input.id, "input", input.kind, JSON.stringify(input.payload), true, []));
  }

  const initialStateId = state.transitions[0]?.beforeStateId ?? state.id;
  const initialNodeId = stateNodeId(initialStateId);
  addNode(node(initialNodeId, initialStateId, "state", "初始状态", "运行起点。", false, [definitionNodeId, constitutionNodeId]));
  connect(definitionNodeId, initialNodeId, "changes");
  connect(constitutionNodeId, initialNodeId, "changes");

  for (const transition of state.transitions) addTransitionNodes(state, transition, addNode, connect);
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
    version: "ugs-runtime-causality@6",
    universeDefinitionId: state.identity.universeDefinitionId,
    stateId: state.id,
    rootNodeIds: Object.freeze(nodes.filter((entry) => entry.root).map((entry) => entry.id).sort()),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
  const issues = validateRuntimeCausalNetwork(network);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.code).join("；"));
  return network;
}

function addTransitionNodes(
  state: UniverseState,
  transition: StateTransition,
  addNode: (node: NodeInput) => void,
  connect: (from: string, to: string, relation: RuntimeCausalEdge["relation"]) => void,
): void {
  const beforeNodeId = stateNodeId(transition.beforeStateId);
  const afterNodeId = stateNodeId(transition.afterStateId);
  const inputNodeIds = transition.inputIds.map((id) => `runtime-cause:${id}`);
  for (const decision of transition.randomDecisions) {
    const decisionNodeId = randomNode(decision.id);
    const owner = transition.ruleExecutions.find((execution) => execution.randomDecisionIds.includes(decision.id));
    if (!owner) throw new Error("RANDOM_OWNER");
    addNode(node(decisionNodeId, decision.id, "random", "确定性随机决定", `${decision.operation}(${JSON.stringify(decision.parameters)}) = ${decision.selectedValue}，原始样本 ${decision.sampleValue}`, false, [beforeNodeId, owner.ruleId]));
    connect(beforeNodeId, decisionNodeId, "precedes");
    connect(owner.ruleId, decisionNodeId, "permits");
  }
  const autonomyNodeIds: string[] = [];
  for (const entityId of transition.autonomy.formedEntityIds) {
    const entity = state.autonomy.entities[entityId];
    if (!entity) throw new Error("AUTONOMY_REFERENCE｜formedEntityIds");
    const entityNodeId = autonomyNode(entityId);
    addNode(node(entityNodeId, entityId, "entity", entity.name, `逻辑时刻 ${entity.formedAtTick} 形成自主主体。`, false, [beforeNodeId, "runtime-root:constitution"]));
    connect(beforeNodeId, entityNodeId, "precedes");
    connect("runtime-root:constitution", entityNodeId, "permits");
    autonomyNodeIds.push(entityNodeId);
  }
  for (const perception of transition.autonomy.perceptions) {
    const perceptionNodeId = autonomyNode(perception.id);
    const entityNodeId = autonomyNode(perception.entityId);
    addNode(node(perceptionNodeId, perception.id, "perception", "内部依据", "私有认知。", false, [beforeNodeId, entityNodeId]));
    connect(beforeNodeId, perceptionNodeId, "precedes");
    connect(entityNodeId, perceptionNodeId, "perceives");
    autonomyNodeIds.push(perceptionNodeId);
  }
  for (const memory of transition.autonomy.memories) {
    const memoryNodeId = autonomyNode(memory.id);
    const sourceNodeId = autonomyNode(memory.sourceId);
    const entityNodeId = autonomyNode(memory.entityId);
    addNode(node(memoryNodeId, memory.id, "memory", "内部依据", "私有认知。", false, [sourceNodeId, entityNodeId]));
    connect(sourceNodeId, memoryNodeId, "remembers");
    connect(entityNodeId, memoryNodeId, "remembers");
    autonomyNodeIds.push(memoryNodeId);
  }
  for (const belief of transition.autonomy.beliefs) {
    const beliefNodeId = autonomyNode(belief.id);
    const causes = [autonomyNode(belief.entityId), ...belief.memoryIds.map(autonomyNode)];
    addNode(node(beliefNodeId, belief.id, "belief", "内部依据", "私有认知。", false, causes));
    causes.forEach((causeId) => connect(causeId, beliefNodeId, "believes"));
    autonomyNodeIds.push(beliefNodeId);
  }
  for (const intent of transition.autonomy.intents) {
    const intentNodeId = autonomyNode(intent.id);
    const causes = [autonomyNode(intent.entityId), ...intent.beliefIds.map(autonomyNode)];
    addNode(node(intentNodeId, intent.id, "intent", "内部依据", "私有认知。", false, causes));
    causes.forEach((causeId) => connect(causeId, intentNodeId, "intends"));
    autonomyNodeIds.push(intentNodeId);
  }
  const executionNodeIds = transition.ruleExecutions.map((execution) => {
    const executionNodeId = `runtime-cause:${execution.id}:${transition.id}`;
    const executionInputs = execution.inputIds.map((id) => `runtime-cause:${id}`);
    const action = transition.autonomy.actions.find((entry) => entry.executionRecordId === execution.id);
    const causes = [beforeNodeId, execution.ruleId, ...execution.randomDecisionIds.map(randomNode), ...executionInputs, ...(action ? [autonomyNode(action.intentId)] : [])];
    const description = JSON.stringify({ priority: execution.priority, conditions: execution.conditionRecords, constraints: execution.constraintRecords, cost: execution.costRecord ?? null, effects: execution.effectFields, randomDecisionIds: execution.randomDecisionIds, inputIds: execution.inputIds, arbitration: execution.arbitration });
    addNode(node(executionNodeId, execution.id, "evaluation", execution.status === "applied" ? "已执行" : "已拒绝", description, false, causes));
    connect(beforeNodeId, executionNodeId, "precedes");
    connect(execution.ruleId, executionNodeId, "evaluates");
    execution.randomDecisionIds.forEach((decisionId) => connect(randomNode(decisionId), executionNodeId, "selects"));
    executionInputs.forEach((inputNodeId) => connect(inputNodeId, executionNodeId, "evaluates"));
    if (action) connect(autonomyNode(action.intentId), executionNodeId, "acts");
    return executionNodeId;
  });
  for (const action of transition.autonomy.actions) {
    const actionNodeId = autonomyNode(action.id);
    const causes = [autonomyNode(action.intentId), ...(action.executionRecordId ? [`runtime-cause:${action.executionRecordId}:${transition.id}`] : [])];
    addNode(node(actionNodeId, action.id, "action", action.status === "applied" ? "有后果" : action.status === "rejected" ? "已拒绝" : "未行动", action.reason, false, causes));
    causes.forEach((causeId) => connect(causeId, actionNodeId, "acts"));
    autonomyNodeIds.push(actionNodeId);
  }
  const differenceNodeIds = transition.differences.map((difference, index) => {
    const differenceNodeId = `runtime-cause:${transition.id}:difference:${index + 1}`;
    const execution = transition.ruleExecutions.find((entry) => entry.ruleId === difference.ruleId && entry.objectId === difference.objectId && entry.status === "applied");
    const action = transition.autonomy.actions.find((entry) => entry.differenceIndexes.includes(index));
    const causes = [beforeNodeId, execution ? `runtime-cause:${execution.id}:${transition.id}` : difference.ruleId, ...(difference.randomDecisionId ? [randomNode(difference.randomDecisionId)] : []), ...(action ? [autonomyNode(action.id)] : [])];
    addNode(node(differenceNodeId, `${transition.id}.difference.${index + 1}`, "difference", difference.field, `${String(difference.before)} → ${String(difference.after)}`, false, causes));
    connect(beforeNodeId, differenceNodeId, "precedes");
    connect(execution ? `runtime-cause:${execution.id}:${transition.id}` : difference.ruleId, differenceNodeId, "permits");
    if (difference.randomDecisionId) connect(randomNode(difference.randomDecisionId), differenceNodeId, "selects");
    if (action) connect(autonomyNode(action.id), differenceNodeId, "acts");
    return differenceNodeId;
  });
  for (const narrativeId of transition.autonomy.narrativeIds) {
    const narrative = state.autonomy.narratives[narrativeId];
    if (!narrative) throw new Error("AUTONOMY_REFERENCE｜narrativeIds");
    const narrativeNodeId = autonomyNode(narrative.id);
    const causes = [autonomyNode(narrative.entityId), autonomyNode(narrative.beliefId)];
    addNode(node(narrativeNodeId, narrative.id, "narrative", narrative.title, narrative.claim, false, causes));
    causes.forEach((causeId) => connect(causeId, narrativeNodeId, "narrates"));
    autonomyNodeIds.push(narrativeNodeId);
  }
  for (const mythArchiveId of transition.autonomy.mythArchiveIds) {
    const archive = state.autonomy.mythArchives[mythArchiveId]; if (!archive) throw new Error("AUTONOMY_REFERENCE｜mythArchiveIds");
    const narrative = state.autonomy.narratives[archive.sourceNarrativeId]; if (!narrative) throw new Error("AUTONOMY_REFERENCE｜sourceNarrativeId");
    const narrativeNodeId = autonomyNode(archive.sourceNarrativeId);
    addNode(node(autonomyNode(archive.id), archive.id, "myth", narrative.title, narrative.claim, false, [narrativeNodeId]));
    connect(narrativeNodeId, autonomyNode(archive.id), "archives"); autonomyNodeIds.push(autonomyNode(archive.id));
  }
  for (const relationId of transition.autonomy.formedRelationIds) {
    const relation = state.autonomy.relations[relationId];
    if (!relation) throw new Error("AUTONOMY_REFERENCE｜formedRelationIds");
    const relationNodeId = autonomyNode(relation.id);
    const causes = [autonomyNode(relation.sourceEntityId), autonomyNode(relation.targetEntityId), beforeNodeId];
    addNode(node(relationNodeId, relation.id, "relation", relation.name, "主体关系。", false, causes));
    causes.forEach((causeId) => connect(causeId, relationNodeId, "relates"));
    autonomyNodeIds.push(relationNodeId);
  }
  for (const relationId of transition.autonomy.ceasedRelationIds) {
    const ceasedNodeId = autonomyNode(`${relationId}:ceased:${transition.id}`);
    const causes = [autonomyNode(relationId), beforeNodeId];
    addNode(node(ceasedNodeId, relationId, "relation", "自主关系终止", `关系在逻辑时刻 ${transition.toTick} 终止。`, false, causes));
    causes.forEach((causeId) => connect(causeId, ceasedNodeId, "changes"));
    autonomyNodeIds.push(ceasedNodeId);
  }
  for (const entityId of transition.autonomy.ceasedEntityIds) {
    const ceasedNodeId = autonomyNode(`${entityId}:ceased:${transition.id}`);
    const causes = [autonomyNode(entityId), beforeNodeId];
    addNode(node(ceasedNodeId, entityId, "entity", "自主性终止", `主体在逻辑时刻 ${transition.toTick} 停止行动。`, false, causes));
    causes.forEach((causeId) => connect(causeId, ceasedNodeId, "changes"));
    autonomyNodeIds.push(ceasedNodeId);
  }
  const transitionNodeId = transitionNode(transition.id);
  const transitionCauses = [...differenceNodeIds, ...inputNodeIds, ...executionNodeIds, ...autonomyNodeIds];
  addNode(node(transitionNodeId, transition.id, "transition", "状态转换", `逻辑时刻 ${transition.fromTick} → ${transition.toTick}`, false, transitionCauses));
  transitionCauses.forEach((causeId) => connect(causeId, transitionNodeId, "changes"));
  addNode(node(afterNodeId, transition.afterStateId, "state", "转换后状态", `逻辑时刻 ${transition.toTick}。`, false, [transitionNodeId]));
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

function autonomyNode(subjectId: string): string {
  return `runtime-cause:${subjectId}`;
}
