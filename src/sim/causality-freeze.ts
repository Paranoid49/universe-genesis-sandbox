import type { CausalGraph } from "./contracts/causality";

export function freezeCausalGraph(graph: CausalGraph): CausalGraph {
  for (const node of graph.nodes) {
    if (node.input) Object.freeze(node.input);
    node.randomSampleRefs.forEach((reference) => {
      Object.freeze(reference.sampleIndexes);
      Object.freeze(reference);
    });
    Object.freeze(node.directCauseIds);
    Object.freeze(node.directEffectIds);
    Object.freeze(node.ruleIds);
    Object.freeze(node.randomSampleRefs);
    Object.freeze(node);
  }
  graph.edges.forEach(Object.freeze);
  graph.cycleAuthorizations.forEach((authorization) => {
    Object.freeze(authorization.nodeIds);
    Object.freeze(authorization.edgeIds);
    Object.freeze(authorization.constraintIds);
    Object.freeze(authorization);
  });
  graph.randomTrace.streams.forEach((stream) => {
    stream.decisions.forEach((decision) => {
      if (decision.parameters.kind === "pick") Object.freeze(decision.parameters.candidates);
      if (decision.parameters.kind === "weighted") {
        decision.parameters.candidates.forEach(Object.freeze);
        Object.freeze(decision.parameters.candidates);
      }
      Object.freeze(decision.parameters);
      Object.freeze(decision.candidates);
      Object.freeze(decision);
    });
    Object.freeze(stream.decisions);
    Object.freeze(stream);
  });
  graph.generation.inputs.forEach(Object.freeze);
  graph.randomResultBindings.forEach((binding) => {
    Object.freeze(binding.locator);
    Object.freeze(binding);
  });
  Object.freeze(graph.generation.inputs);
  Object.freeze(graph.generation);
  Object.freeze(graph.rootNodeIds);
  Object.freeze(graph.nodes);
  Object.freeze(graph.edges);
  Object.freeze(graph.cycleAuthorizations);
  Object.freeze(graph.randomTrace.streams);
  Object.freeze(graph.randomTrace);
  Object.freeze(graph.randomResultBindings);
  return Object.freeze(graph);
}
