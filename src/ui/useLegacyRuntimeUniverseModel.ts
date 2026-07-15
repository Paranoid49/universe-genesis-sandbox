import { MATERIAL_EXPANSE, type UniverseTemplateId } from "../sim";
import type { RuntimeStorageAdapter } from "./runtimeStorage";
import { useRuntimeUniverseModel } from "./useRuntimeUniverseModel";

export function useLegacyRuntimeUniverseModel({
  seed,
  templateId: _templateId,
  storage,
  active,
}: {
  seed: string;
  templateId: UniverseTemplateId;
  storage?: RuntimeStorageAdapter;
  active?: boolean;
}) {
  return useRuntimeUniverseModel({ seed, constitution: MATERIAL_EXPANSE, storage, active });
}
