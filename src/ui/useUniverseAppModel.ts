import { useEffect, useMemo, useRef, useState } from "react";
import {
  compareUniverseLaws,
  decodeShareParams,
  filterTimelineByEra,
  formatSeed,
  generateUniverse,
  normalizeSeed,
  type Civilization,
  type EraId,
  type Galaxy,
  type Planet,
  type StarSystem,
  type UniverseTemplateId,
} from "../sim";
import { buildSourceLabelMap, summarizeCivilizations, summarizeSpace } from "./selectors";

const DEFAULT_SEED = "LUX-7F3A-91C2";
const DEFAULT_TEMPLATE_ID: UniverseTemplateId = "high_magic";
const DEFAULT_COMPARE_SEED = "ASH-44DE-0101";

export type AppPageId = "overview" | "space" | "civilizations" | "timeline" | "laws" | "logs";

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
  const [copyState, setCopyState] = useState("复制分享");
  const [shareWarnings] = useState<string[]>(initialShare?.warnings ?? []);
  const [compareDraftSeed, setCompareDraftSeed] = useState(DEFAULT_COMPARE_SEED);
  const [compareSeed, setCompareSeed] = useState(normalizeSeed(DEFAULT_COMPARE_SEED));
  const [eraFilter, setEraFilter] = useState<EraId | "all">("all");
  const [selectedGalaxyId, setSelectedGalaxyId] = useState<string | undefined>();
  const [selectedSystemId, setSelectedSystemId] = useState<string | undefined>();
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | undefined>();
  const [selectedCivilizationId, setSelectedCivilizationId] = useState<string | undefined>();
  const copyResetTimerRef = useRef<number | undefined>(undefined);

  const universe = useMemo(() => generateUniverse({ seed: activeSeed, templateId }), [activeSeed, templateId]);
  const filteredTimeline = useMemo(() => filterTimelineByEra(universe.timeline, eraFilter), [universe.timeline, eraFilter]);
  const selectedEvent = filteredTimeline.find((event) => event.id === selectedEventId) ?? filteredTimeline[0] ?? firstItem(universe.timeline, "时间线事件");
  const comparison = useMemo(() => compareUniverseLaws(activeSeed, compareSeed, templateId), [activeSeed, compareSeed, templateId]);
  const selectedGalaxy = universe.galaxies.find((galaxy) => galaxy.id === selectedGalaxyId) ?? universe.galaxies[0];
  const selectedSystem = selectedGalaxy?.starSystems.find((system) => system.id === selectedSystemId) ?? selectedGalaxy?.starSystems[0];
  const selectedPlanet = selectedSystem?.planets.find((planet) => planet.id === selectedPlanetId) ?? selectedSystem?.planets[0];
  const selectedCivilization = universe.civilizations.find((civilization) => civilization.id === selectedCivilizationId) ?? universe.civilizations[0];
  const spaceStats = useMemo(() => summarizeSpace(universe), [universe]);
  const civilizationStats = useMemo(() => summarizeCivilizations(universe), [universe]);
  const sourceLabelById = useMemo(() => buildSourceLabelMap(universe), [universe]);

  useEffect(() => {
    setSelectedEventId(universe.timeline[0]?.id);
    const firstGalaxy = universe.galaxies[0];
    const firstSystem = firstGalaxy?.starSystems[0];
    const firstPlanet = firstSystem?.planets[0];
    setSelectedGalaxyId(firstGalaxy?.id);
    setSelectedSystemId(firstSystem?.id);
    setSelectedPlanetId(firstPlanet?.id);
    setSelectedCivilizationId(universe.civilizations[0]?.id);
  }, [universe.shareCode, universe.timeline, universe.galaxies, universe.civilizations]);

  useEffect(() => {
    setSelectedEventId((current) => {
      if (current && filteredTimeline.some((event) => event.id === current)) {
        return current;
      }
      return filteredTimeline[0]?.id ?? universe.timeline[0]?.id;
    });
  }, [filteredTimeline, universe.timeline]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== undefined && typeof window !== "undefined") {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  function createUniverse() {
    setActiveSeed(normalizeSeed(draftSeed));
  }

  function randomizeSeed() {
    const nextSeed = createClientSeed();
    setDraftSeed(formatSeed(nextSeed));
    setActiveSeed(nextSeed);
  }

  async function copyShare() {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      setCopyState("复制失败");
      scheduleCopyStateReset();
      return;
    }

    const shareLink = `${window.location.origin}${window.location.pathname}${universe.shareUrl}`;
    const text = `${universe.shareText}\n${shareLink}`;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("剪贴板接口不可用。");
      }
      await navigator.clipboard.writeText(text);
      setCopyState("已复制");
    } catch {
      if (typeof window.prompt === "function") {
        window.prompt("复制分享内容", text);
        setCopyState("已打开复制框");
      } else {
        setCopyState("复制失败");
      }
    }
    scheduleCopyStateReset();
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

  function scheduleCopyStateReset() {
    if (typeof window === "undefined") {
      return;
    }
    if (copyResetTimerRef.current !== undefined) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyState("复制分享");
      copyResetTimerRef.current = undefined;
    }, 1400);
  }

  return {
    activePage,
    civilizationStats,
    compareDraftSeed,
    comparison,
    copyShare,
    copyState,
    createUniverse,
    draftSeed,
    eraFilter,
    filteredTimeline,
    randomizeSeed,
    selectedCivilization,
    selectedEvent,
    selectedGalaxy,
    selectedPlanet,
    selectedSystem,
    setActivePage,
    setCompareDraftSeed,
    setDraftSeed,
    setEraFilter,
    setSelectedEventId,
    setTemplateId,
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

function readInitialShare(search?: string) {
  if (search !== undefined) {
    return decodeShareParams(search);
  }
  if (typeof window === "undefined") {
    return undefined;
  }
  return decodeShareParams(window.location.search);
}

function createClientSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12)
    .toUpperCase();
}

function firstItem<T>(items: readonly T[], label: string): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error(`${label}不能为空。`);
  }
  return item;
}
