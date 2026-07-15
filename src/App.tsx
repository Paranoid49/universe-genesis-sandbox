import { useState } from "preact/hooks";
import { LegacyApplication } from "./components/LegacyApplication";
import { RuntimeApplication } from "./components/RuntimeApplication";
import { decodeShareParams, type UniverseTemplateId } from "./sim";
import type { AppPageId } from "./ui/appPages";

export type AppProps = {
  initialPage?: AppPageId;
  search?: string;
};

export function App({ initialPage = "runtime", search }: AppProps = {}) {
  const resolvedSearch = search ?? (typeof window === "undefined" ? undefined : window.location.search);
  const startsInLegacy = initialPage !== "runtime" || Boolean(resolvedSearch && decodeShareParams(resolvedSearch));
  const [legacyPage, setLegacyPage] = useState<Exclude<AppPageId, "runtime">>(
    initialPage === "runtime" ? "overview" : initialPage,
  );
  const [legacyOpen, setLegacyOpen] = useState(startsInLegacy);
  const [runtimeMounted, setRuntimeMounted] = useState(!startsInLegacy);
  const [legacySeed, setLegacySeed] = useState<string>();
  const [legacyTemplateId, setLegacyTemplateId] = useState<UniverseTemplateId>();

  function openLegacy(seed: string, templateId: UniverseTemplateId) {
    setLegacySeed(seed);
    setLegacyTemplateId(templateId);
    setLegacyPage("overview");
    setLegacyOpen(true);
  }

  function returnRuntime() {
    setRuntimeMounted(true);
    setLegacyOpen(false);
  }

  return <>
    {runtimeMounted && <RuntimeApplication active={!legacyOpen} onOpenLegacy={(seed) => openLegacy(seed, "hard_science")} />}
    {legacyOpen && <LegacyApplication
      initialPage={legacyPage}
      search={resolvedSearch}
      initialSeed={legacySeed}
      initialTemplateId={legacyTemplateId}
      onReturnRuntime={returnRuntime}
    />}
  </>;
}
