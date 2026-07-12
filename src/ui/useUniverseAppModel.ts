import { useMemo, useState } from "react";
import {
  compareUniverseLaws,
  filterTimelineByEra,
  formatSeed,
  generateUniverse,
  miracleDefinitions,
  normalizeSeed,
  type Civilization,
  type EraId,
  type Galaxy,
  type InterventionInput,
  type MiracleType,
  type Planet,
  type StarSystem,
  type UniverseTemplateId,
} from "../sim";
import { buildSourceLabelMap, summarizeCivilizations, summarizeSpace } from "./selectors";
import { createClientSeed } from "./clientSeed";
import { buildMiracleTargetOptions } from "./miracleTargets";
import { readInitialShare } from "./shareState";
import { useShareController } from "./useShareController";

const DEFAULT_SEED = "LUX-7F3A-91C2";
const DEFAULT_TEMPLATE_ID: UniverseTemplateId = "high_magic";
const DEFAULT_COMPARE_SEED = "ASH-44DE-0101";

export type AppPageId = "overview" | "space" | "civilizations" | "miracles" | "timeline" | "laws" | "logs";

export type { MiracleTargetOption } from "./miracleTargets";

export const eraFilterOptions: Array<{ id: EraId | "all"; label: string }> = [
  { id: "all", label: "全部" },
  { id: "creation", label: "创世" },
  { id: "stars", label: "星辰" },
  { id: "elements", label: "元素" },
  { id: "life", label: "生命" },
  { id: "civilization", label: "文明" },
  { id: "myth", label: "神话" },
  { id: "ascension", label: "飞升" },
  { id: "ending", label: "终局" },
];

type UseUniverseAppModelInput = {
  initialPage?: AppPageId;
  search?: string;
};

export function useUniverseAppModel({ initialPage = "overview", search }: UseUniverseAppModelInput = {}) {
  const initialShare = useMemo(() => readInitialShare(search), [search]);
  const initialSeed = initialShare?.seed ?? DEFAULT_SEED;
  const initialTemplate = initialShare?.templateId ?? DEFAULT_TEMPLATE_ID;
  const [draftSeed, setDraftSeed] = useState(formatSeed(initialSeed));
  const [activeSeed, setActiveSeed] = useState(normalizeSeed(initialSeed));
  const [templateId, setTemplateId] = useState<UniverseTemplateId>(initialTemplate);
  const [activePage, setActivePage] = useState<AppPageId>(initialPage);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [shareWarnings] = useState<string[]>(initialShare?.warnings ?? []);
  const [compareDraftSeed, setCompareDraftSeed] = useState(DEFAULT_COMPARE_SEED);
  const [compareSeed, setCompareSeed] = useState(normalizeSeed(DEFAULT_COMPARE_SEED));
  const [eraFilter, setEraFilter] = useState<EraId | "all">("all");
  const [selectedGalaxyId, setSelectedGalaxyId] = useState<string | undefined>();
  const [selectedSystemId, setSelectedSystemId] = useState<string | undefined>();
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | undefined>();
  const [selectedCivilizationId, setSelectedCivilizationId] = useState<string | undefined>();
  const [interventionInputs, setInterventionInputs] = useState<InterventionInput[]>(initialShare?.interventions ?? []);
  const [selectedMiracleType, setSelectedMiracleType] = useState<MiracleType>(miracleDefinitions[0].type);
  const [selectedMiracleTargetId, setSelectedMiracleTargetId] = useState<string | undefined>();

  const universe = useMemo(() => generateUniverse({ seed: activeSeed, templateId, interventions: interventionInputs }), [activeSeed, templateId, interventionInputs]);
  const filteredTimeline = useMemo(() => filterTimelineByEra(universe.timeline, eraFilter), [universe.timeline, eraFilter]);
  const selectedEvent = filteredTimeline.find((event) => event.id === selectedEventId) ?? filteredTimeline[0] ?? firstItem(universe.timeline, "时间线事件");
  const comparison = useMemo(
    () => activePage === "laws" ? compareUniverseLaws(activeSeed, compareSeed, templateId) : undefined,
    [activePage, activeSeed, compareSeed, templateId],
  );
  const selectedGalaxy = universe.galaxies.find((galaxy) => galaxy.id === selectedGalaxyId) ?? universe.galaxies[0];
  const selectedSystem = selectedGalaxy?.starSystems.find((system) => system.id === selectedSystemId) ?? selectedGalaxy?.starSystems[0];
  const selectedPlanet = selectedSystem?.planets.find((planet) => planet.id === selectedPlanetId) ?? selectedSystem?.planets[0];
  const selectedCivilization = universe.civilizations.find((civilization) => civilization.id === selectedCivilizationId) ?? universe.civilizations[0];
  const spaceStats = useMemo(() => summarizeSpace(universe), [universe]);
  const civilizationStats = useMemo(() => summarizeCivilizations(universe), [universe]);
  const sourceLabelById = useMemo(() => buildSourceLabelMap(universe), [universe]);
  const miracleTargetOptions = useMemo(() => buildMiracleTargetOptions(universe, selectedMiracleType), [universe, selectedMiracleType]);
  const activeMiracleTargetId = selectedMiracleTargetId && miracleTargetOptions.some((option) => option.id === selectedMiracleTargetId)
    ? selectedMiracleTargetId
    : miracleTargetOptions[0]?.id;
  const { copyShare, copyState } = useShareController(universe);

  function createUniverse() {
    setActiveSeed(normalizeSeed(draftSeed));
    setInterventionInputs([]);
  }

  function randomizeSeed() {
    const nextSeed = createClientSeed();
    setDraftSeed(formatSeed(nextSeed));
    setActiveSeed(nextSeed);
    setInterventionInputs([]);
  }

  function compareSeedNow() {
    setCompareSeed(normalizeSeed(compareDraftSeed));
  }

  function selectGalaxy(galaxy: Galaxy) {
    const firstSystem = galaxy.starSystems[0];
    const firstPlanet = firstSystem?.planets[0];
    setSelectedGalaxyId(galaxy.id);
    setSelectedSystemId(firstSystem?.id);
    setSelectedPlanetId(firstPlanet?.id);
  }

  function selectSystem(system: StarSystem) {
    setSelectedSystemId(system.id);
    setSelectedPlanetId(system.planets[0]?.id);
  }

  function selectPlanet(planet: Planet) {
    setSelectedPlanetId(planet.id);
  }

  function selectCivilization(civilization: Civilization) {
    setSelectedCivilizationId(civilization.id);
  }

  function changeTemplateId(nextTemplateId: UniverseTemplateId) {
    setTemplateId(nextTemplateId);
    setInterventionInputs([]);
  }

  function applySelectedMiracle() {
    if (!activeMiracleTargetId) {
      return;
    }
    setInterventionInputs((current) => [
      ...current,
      {
        id: `ui-${String(current.length + 1).padStart(2, "0")}`,
        miracleType: selectedMiracleType,
        targetId: activeMiracleTargetId,
      },
    ]);
    setActivePage("miracles");
  }

  function clearInterventions() {
    setInterventionInputs([]);
  }

  return {
    activePage,
    applySelectedMiracle,
    civilizationStats,
    clearInterventions,
    compareDraftSeed,
    comparison,
    copyShare,
    copyState,
    createUniverse,
    draftSeed,
    eraFilter,
    filteredTimeline,
    miracleTargetOptions,
    randomizeSeed,
    selectedCivilization,
    selectedEvent,
    selectedGalaxy,
    selectedMiracleTargetId: activeMiracleTargetId,
    selectedMiracleType,
    selectedPlanet,
    selectedSystem,
    setActivePage,
    setCompareDraftSeed,
    setDraftSeed,
    setEraFilter,
    setSelectedMiracleTargetId,
    setSelectedMiracleType,
    setSelectedEventId,
    setTemplateId: changeTemplateId,
    shareWarnings,
    sourceLabelById,
    spaceStats,
    templateId,
    universe,
    compareSeedNow,
    selectCivilization,
    selectGalaxy,
    selectPlanet,
    selectSystem,
  };
}

function firstItem<T>(items: readonly T[], label: string): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error(`${label}不能为空。`);
  }
  return item;
}
