import { useMemo, useState } from "preact/hooks";
import {
  assertGenerateUniverseInput,
  buildStateValueCausalProjection,
  decodeShareCode,
  filterTimelineByEra,
  formatSeed,
  generateCausalUniverse,
  miracleDefinitions,
  normalizeSeed,
  RULESET_VERSION,
  UniverseInputError,
  type EraId,
  type InterventionInput,
  type MiracleType,
  type UniverseTemplateId,
} from "../sim";
import { buildSourceLabelMap, summarizeCivilizations, summarizeSpace } from "./selectors";
import { createClientSeed } from "./clientSeed";
import { buildMiracleTargetOptions } from "./miracleTargets";
import { readInitialShare } from "./shareState";
import { useCausalViewController } from "./causalView";
import { useLawComparisonModel } from "./useLawComparisonModel";
import { useShareController } from "./useShareController";
import { useUniverseSelection } from "./useUniverseSelection";
import type { AppPageId } from "./appPages";

const DEFAULT_SEED = "LUX-7F3A-91C2";
const DEFAULT_TEMPLATE_ID: UniverseTemplateId = "high_magic";
export type { AppPageId } from "./appPages";

export type { MiracleTargetOption } from "./miracleTargets";

type UseUniverseAppModelInput = { initialPage?: AppPageId; search?: string; initialSeed?: string; initialTemplateId?: UniverseTemplateId };

export function useUniverseAppModel({ initialPage = "runtime", search, initialSeed: providedSeed, initialTemplateId: providedTemplateId }: UseUniverseAppModelInput = {}) {
  const initialShare = useMemo(() => readInitialShare(search), [search]);
  const initialSeed = initialShare?.seed ?? providedSeed ?? DEFAULT_SEED;
  const initialTemplate = initialShare?.templateId ?? providedTemplateId ?? DEFAULT_TEMPLATE_ID;
  const [draftSeed, setDraftSeed] = useState(formatSeed(initialSeed));
  const [activeSeed, setActiveSeed] = useState(normalizeSeed(initialSeed));
  const [templateId, setTemplateId] = useState<UniverseTemplateId>(initialTemplate);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [shareWarnings] = useState<string[]>(initialShare?.warnings ?? []);
  const [eraFilter, setEraFilter] = useState<EraId | "all">("all");
  const [interventionInputs, setInterventionInputs] = useState<InterventionInput[]>(initialShare?.interventions ?? []);
  const [selectedMiracleType, setSelectedMiracleType] = useState<MiracleType>(miracleDefinitions[0].type);
  const [selectedMiracleTargetId, setSelectedMiracleTargetId] = useState<string | undefined>();
  const [seedInputError, setSeedInputError] = useState<string | undefined>();
  const [causalTraceError, setCausalTraceError] = useState<string | undefined>();

  const universe = useMemo(
    () => generateCausalUniverse({ seed: activeSeed, rulesetVersion: RULESET_VERSION, templateId, interventions: interventionInputs }),
    [activeSeed, templateId, interventionInputs],
  );
  const causalViewController = useCausalViewController<AppPageId>(initialPage, universe);
  const lawComparison = useLawComparisonModel(
    causalViewController.activePage === "laws",
    universe,
    causalViewController.openCausalProjection,
  );
  const filteredTimeline = useMemo(() => filterTimelineByEra(universe.timeline, eraFilter), [universe.timeline, eraFilter]);
  const selectedEvent = filteredTimeline.find((event) => event.id === selectedEventId) ?? filteredTimeline[0] ?? firstItem(universe.timeline, "时间线事件");
  const selection = useUniverseSelection(universe);
  const spaceStats = useMemo(() => summarizeSpace(universe), [universe]);
  const civilizationStats = useMemo(() => summarizeCivilizations(universe), [universe]);
  const sourceLabelById = useMemo(() => buildSourceLabelMap(universe), [universe]);
  const miracleTargetOptions = useMemo(() => buildMiracleTargetOptions(universe, selectedMiracleType), [universe, selectedMiracleType]);
  const activeMiracleTargetId = selectedMiracleTargetId && miracleTargetOptions.some((option) => option.id === selectedMiracleTargetId)
    ? selectedMiracleTargetId
    : miracleTargetOptions[0]?.id;
  const { copyShare, copyState } = useShareController(universe);

  function createUniverse() {
    try {
      assertGenerateUniverseInput({ seed: draftSeed, rulesetVersion: RULESET_VERSION, templateId });
    } catch (error) {
      setSeedInputError(inputErrorMessage(error));
      return;
    }
    setSeedInputError(undefined);
    setActiveSeed(normalizeSeed(draftSeed));
    setInterventionInputs([]);
  }

  function randomizeSeed() {
    const nextSeed = createClientSeed();
    setDraftSeed(formatSeed(nextSeed));
    setSeedInputError(undefined);
    setActiveSeed(nextSeed);
    setInterventionInputs([]);
  }

  function changeTemplateId(nextTemplateId: UniverseTemplateId) {
    setTemplateId(nextTemplateId);
    setSeedInputError(undefined);
    lawComparison.clearInputError();
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
    causalViewController.navigate("miracles");
  }

  function clearInterventions() {
    setInterventionInputs([]);
  }

  function restoreArchivedUniverse(shareCode: string): string | undefined {
    const decoded = decodeShareCode(shareCode);
    if (!decoded || decoded.warnings.length > 0 || decoded.rulesetVersion !== RULESET_VERSION) return "存档分享码无效或不受当前版本支持。";
    try {
      assertGenerateUniverseInput(decoded);
      generateCausalUniverse(decoded);
    } catch {
      return "存档分支无法通过当前生成契约恢复。";
    }
    setDraftSeed(formatSeed(decoded.seed));
    setActiveSeed(decoded.seed);
    setTemplateId(decoded.templateId);
    setInterventionInputs(decoded.interventions);
    setSeedInputError(undefined);
    lawComparison.clearInputError();
    causalViewController.navigate("overview");
    return undefined;
  }

  function openCausalSubject(subjectId: string, focusOrdinal?: number) {
    const matches = universe.causalGraph.nodes.filter((node) => node.subjectId === subjectId);
    if (matches.length !== 1) {
      setCausalTraceError(matches.length === 0
        ? `追因失败：未找到“${subjectId}”对应的因果节点。`
        : `追因失败：“${subjectId}”对应 ${matches.length} 个因果节点。`);
      return;
    }
    setCausalTraceError(undefined);
    causalViewController.openCausalView({ universe, graph: universe.causalGraph, initialNodeId: matches[0].id }, subjectId, focusOrdinal);
  }

  function openStateValueProjection(subjectId: string) {
    setCausalTraceError(undefined);
    causalViewController.openCausalProjection({ universe, returnFocusKey: `state-value.${subjectId}`,
      buildProjection: (causalUniverse) => buildStateValueCausalProjection(causalUniverse, subjectId) });
  }

  function changeDraftSeed(value: string) {
    setDraftSeed(value);
    if (seedInputError) setSeedInputError(undefined);
  }

  return {
    activePage: causalViewController.activePage,
    contentPage: causalViewController.contentPage,
    applySelectedMiracle,
    activeSeed,
    causalView: causalViewController.causalView,
    traceError: causalTraceError,
    civilizationStats,
    clearInterventions,
    compareDraftSeed: lawComparison.draftSeed,
    comparison: lawComparison.comparison,
    copyShare,
    copyState,
    createUniverse,
    draftSeed,
    eraFilter,
    filteredTimeline,
    compareInputError: lawComparison.inputError,
    miracleTargetOptions,
    randomizeSeed,
    restoreArchivedUniverse,
    selectedCivilization: selection.selectedCivilization,
    selectedEvent,
    selectedGalaxy: selection.selectedGalaxy,
    selectedMiracleTargetId: activeMiracleTargetId,
    selectedMiracleType,
    selectedPlanet: selection.selectedPlanet,
    selectedSystem: selection.selectedSystem,
    seedInputError,
    openCausalProjection: causalViewController.openCausalProjection,
    openCausalSubject,
    openStateValueProjection,
    returnTrace: causalViewController.canReturn ? causalViewController.returnToOrigin : undefined,
    setActivePage: causalViewController.navigate,
    setCompareDraftSeed: lawComparison.setDraftSeed,
    setDraftSeed: changeDraftSeed,
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
    compareSeedNow: lawComparison.compareNow,
    selectCivilization: selection.selectCivilization,
    selectGalaxy: selection.selectGalaxy,
    selectPlanet: selection.selectPlanet,
    selectSystem: selection.selectSystem,
    traceLawComparison: lawComparison.trace,
  };
}

function inputErrorMessage(error: unknown): string {
  return error instanceof UniverseInputError ? error.message : "输入无法用于生成宇宙。";
}

function firstItem<T>(items: readonly T[], label: string): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error(`${label}不能为空。`);
  }
  return item;
}
