import type { TopologyModuleSpec, UniverseConstitution } from "./contracts/constitution";
import type { RuntimeTopology, RuntimeWorldObject } from "./contracts/runtime";
import { constitutionModule } from "./constitution-validation";

export function createRuntimeTopology(constitution: UniverseConstitution, objects: Readonly<Record<string, RuntimeWorldObject>>): RuntimeTopology {
  const spec = constitutionModule<TopologyModuleSpec>(constitution, "topology").spec;
  const objectList = Object.values(objects).sort((left, right) => left.id.localeCompare(right.id));
  const relations = spec.initialRelations.flatMap((definition) => {
    const sources = objectList.filter((object) => definition.sourceKind === "*" || object.kind === definition.sourceKind);
    const targets = objectList.filter((object) => definition.targetKind === "*" || object.kind === definition.targetKind);
    if (sources.length === 0 || targets.length === 0) return [];
    const source = sources[0];
    const target = targets.find((entry) => entry.id !== source.id) ?? targets[0];
    const relation = Object.freeze({
      id: "runtime.relation." + definition.id,
      typeId: definition.id,
      name: definition.name,
      sourceObjectId: source.id,
      targetObjectId: target.id,
      directed: definition.directed,
    });
    return [[relation.id, relation] as const];
  });
  return Object.freeze({ mode: spec.mode, relationTypeIds: Object.freeze(spec.initialRelations.map((entry) => entry.id)), relations: Object.freeze(Object.fromEntries(relations)) });
}
