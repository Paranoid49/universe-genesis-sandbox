import { useState } from "react";
import {
  assertGenerateUniverseInput,
  formatSeed,
  normalizeSeed,
  RULESET_VERSION,
  UniverseInputError,
  type UniverseTemplateId,
} from "../sim";
import { createClientSeed } from "../ui/clientSeed";
import { useRuntimeUniverseModel } from "../ui/useRuntimeUniverseModel";
import { RuntimeNavigation, UniverseToolbar } from "./AppChrome";
import { RuntimePage } from "./pages/RuntimePage";

const DEFAULT_SEED = "LUX-7F3A-91C2";
const DEFAULT_TEMPLATE_ID: UniverseTemplateId = "high_magic";

export function RuntimeApplication({
  active,
  onOpenLegacy,
}: {
  active: boolean;
  onOpenLegacy: (seed: string, templateId: UniverseTemplateId) => void;
}) {
  const [draftSeed, setDraftSeed] = useState(formatSeed(DEFAULT_SEED));
  const [activeSeed, setActiveSeed] = useState(normalizeSeed(DEFAULT_SEED));
  const [templateId, setTemplateId] = useState<UniverseTemplateId>(DEFAULT_TEMPLATE_ID);
  const [inputError, setInputError] = useState<string>();

  function createUniverse() {
    try {
      assertGenerateUniverseInput({ seed: draftSeed, rulesetVersion: RULESET_VERSION, templateId });
      setActiveSeed(normalizeSeed(draftSeed));
      setInputError(undefined);
    } catch (error) {
      setInputError(error instanceof UniverseInputError ? error.message : "输入无法用于启动运行中宇宙。");
    }
  }

  function randomizeSeed() {
    const seed = createClientSeed();
    setDraftSeed(formatSeed(seed));
    setActiveSeed(seed);
    setInputError(undefined);
  }

  return <main className="app-shell" hidden={!active}>
    <UniverseToolbar
      draftSeed={draftSeed}
      templateId={templateId}
      copyState=""
      inputError={inputError}
      onDraftSeedChange={(value) => { setDraftSeed(value); setInputError(undefined); }}
      onTemplateChange={(value) => { setTemplateId(value); setInputError(undefined); }}
      onCreate={createUniverse}
      onRandomize={randomizeSeed}
      onCopy={() => undefined}
      showShare={false}
    />
    <RuntimeSession key={`${activeSeed}:${templateId}`} seed={activeSeed} templateId={templateId} active={active} onOpenLegacy={onOpenLegacy} />
  </main>;
}

function RuntimeSession({
  seed,
  templateId,
  active,
  onOpenLegacy,
}: {
  seed: string;
  templateId: UniverseTemplateId;
  active: boolean;
  onOpenLegacy: (seed: string, templateId: UniverseTemplateId) => void;
}) {
  const runtime = useRuntimeUniverseModel({ seed, templateId, active });
  return <>
    <RuntimeNavigation disabled={runtime.busy} onOpenLegacy={() => {
      runtime.pause();
      onOpenLegacy(seed, templateId);
    }} />
    <RuntimePage runtime={runtime} />
  </>;
}
