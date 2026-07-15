import type { ObservationAccess } from "./contracts/observation";
import type { UniverseState } from "./contracts/runtime";
import type { CognitionModuleSpec, ObservableModuleSpec, OntologyModuleSpec } from "./contracts/constitution";
import { constitutionModule } from "./constitution-validation";
import { observationMethods, observeUniverse } from "./observation";
import { validateObservableSignalAgainstState } from "./observation-verification";

export function createObservationAccess(state: UniverseState, runtimeHistoryId = state.identity.universeDefinitionId): ObservationAccess {
  if (!runtimeHistoryId) throw new Error("观察访问缺少运行历史身份。");
  const observable = constitutionModule<ObservableModuleSpec>(state.identity.constitution, "observable").spec;
  const cognition = constitutionModule<CognitionModuleSpec>(state.identity.constitution, "cognition").spec;
  const ontology = constitutionModule<OntologyModuleSpec>(state.identity.constitution, "ontology").spec;
  const methods = observationMethods(state);
  return Object.freeze({
    universeDefinitionId: state.identity.universeDefinitionId,
    runtimeHistoryId,
    stateId: state.id,
    currentTick: state.clock.tick,
    topology: Object.freeze({ mode: state.topology.mode, relationNames: Object.freeze(Object.values(state.topology.relations).map((relation) => relation.name)), relationCount: Object.keys(state.topology.relations).length }),
    objects: Object.freeze(Object.values(state.objects).map((object) => Object.freeze({ id: object.id, kind: object.kind, label: `${ontology.objectKinds.find((kind) => kind.id === object.kind)?.name ?? "未知对象类型"}｜${object.id}` }))),
    methods,
    metrics: Object.freeze(observable.metrics.map((metric) => Object.freeze({
      id: metric.id,
      name: metric.name,
      visibility: metric.visibility,
      methodIds: Object.freeze(methods.filter((method) => method.field === metric.field).map((method) => method.id)),
    }))),
    publicAxioms: Object.freeze(state.rules.filter((rule) => cognition.publicAxiomIds.includes(rule.id)).map((rule) => Object.freeze({ id: rule.id, label: "公开公理｜" + rule.name }))),
    observe: (request) => observeUniverse(state, request, runtimeHistoryId),
    validateSignal: (signal) => validateObservableSignalAgainstState(state, signal, runtimeHistoryId),
    validateLegacySignal: (signal) => validateObservableSignalAgainstState(state, signal, state.identity.universeDefinitionId),
  });
}
