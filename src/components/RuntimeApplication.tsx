import { useState } from "preact/hooks";
import {
  CONSTITUTION_MODULE_CATALOG,
  PRODUCT_CONSTITUTIONS,
  createUniverseConstitution,
  formatSeed,
  getReferenceConstitution,
  normalizeSeed,
  type ConstitutionModuleCategory,
  type ConstitutionPresetId,
  type UniverseConstitution,
} from "../sim/current";
import { createClientSeed } from "../ui/clientSeed";
import { ConstitutionCreator } from "./ConstitutionCreator";
import { RuntimeSession } from "./RuntimeSession";

const DEFAULT_SEED = "LUX-7F3A-91C2";
const DEFAULT_CONSTITUTION = PRODUCT_CONSTITUTIONS[0];
if (!DEFAULT_CONSTITUTION?.presetId) throw new Error("缺少默认宇宙宪法预设。");

export function RuntimeApplication({
  active,
  onOpenLegacy,
}: {
  active: boolean;
  onOpenLegacy: (seed: string) => void;
}) {
  const [draftSeed, setDraftSeed] = useState(formatSeed(DEFAULT_SEED));
  const [activeSeed, setActiveSeed] = useState(normalizeSeed(DEFAULT_SEED));
  const [draftConstitution, setDraftConstitution] = useState<UniverseConstitution>(DEFAULT_CONSTITUTION);
  const [activeConstitution, setActiveConstitution] = useState<UniverseConstitution>(DEFAULT_CONSTITUTION);
  const [presetId, setPresetId] = useState<ConstitutionPresetId | "custom">(DEFAULT_CONSTITUTION.presetId as ConstitutionPresetId);
  const [inputError, setInputError] = useState<string>();

  function createUniverse() {
    try {
      if (!draftSeed.trim()) throw new Error("Seed 不能为空。");
      setActiveSeed(normalizeSeed(draftSeed));
      setActiveConstitution(draftConstitution);
      setInputError(undefined);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "输入无法用于启动运行中宇宙。");
    }
  }

  function randomizeSeed() {
    const seed = createClientSeed();
    setDraftSeed(formatSeed(seed));
    setActiveSeed(seed);
    setActiveConstitution(draftConstitution);
    setInputError(undefined);
  }

  function selectPreset(nextPresetId: ConstitutionPresetId) {
    setDraftConstitution(getReferenceConstitution(nextPresetId));
    setPresetId(nextPresetId);
    setInputError(undefined);
  }

  function selectModule(category: ConstitutionModuleCategory, moduleId: string) {
    try {
      const modules = draftConstitution.modules.map((entry) => entry.category === category
        ? CONSTITUTION_MODULE_CATALOG.find((candidate) => candidate.id === moduleId) ?? entry
        : entry);
      const next = createUniverseConstitution({ name: "自定义组合宪法", description: "由兼容参考模块组成的宇宙宪法。", modules });
      setDraftConstitution(next);
      setPresetId("custom");
      setInputError(undefined);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "宪法模块组合无效。");
    }
  }

  return <main className="app-shell" hidden={!active}>
    <ConstitutionCreator
      draftSeed={draftSeed}
      constitution={draftConstitution}
      activeConstitution={activeConstitution}
      presetId={presetId}
      inputError={inputError}
      onDraftSeedChange={(value) => { setDraftSeed(value); setInputError(undefined); }}
      onPresetChange={selectPreset}
      onModuleChange={selectModule}
      onCreate={createUniverse}
      onRandomize={randomizeSeed}
    />
    <RuntimeSession key={activeSeed + ":" + activeConstitution.constitutionId} seed={activeSeed} constitution={activeConstitution} active={active} onOpenLegacy={onOpenLegacy} />
  </main>;
}
