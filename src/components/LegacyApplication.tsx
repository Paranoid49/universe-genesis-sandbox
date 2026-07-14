import type { MouseEvent } from "react";
import { CivilizationPanel } from "./CivilizationPanel";
import { CausalExplorer } from "./CausalExplorer";
import { PageNavigation, UniverseToolbar } from "./AppChrome";
import { MiraclePanel } from "./MiraclePanel";
import { ObservationConsole } from "./ObservationConsole";
import { LawsPage } from "./pages/LawsPage";
import { LogsPage } from "./pages/LogsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { TimelinePage } from "./pages/TimelinePage";
import { SpaceExplorer } from "./SpaceExplorer";
import { UniverseLibrary } from "./UniverseLibrary";
import { useUniverseAppModel } from "../ui/useUniverseAppModel";
import type { AppPageId } from "../ui/appPages";
import { useUniverseArchive } from "../ui/useUniverseArchive";
import type { UniverseTemplateId } from "../sim";

export function LegacyApplication({
  initialPage,
  search,
  initialSeed,
  initialTemplateId,
  onReturnRuntime,
}: {
  initialPage: Exclude<AppPageId, "runtime">;
  search?: string;
  initialSeed?: string;
  initialTemplateId?: UniverseTemplateId;
  onReturnRuntime: () => void;
}) {
  const model = useUniverseAppModel({ initialPage, search, initialSeed, initialTemplateId });
  const archive = useUniverseArchive();
  function traceVisibleResult(event: MouseEvent<HTMLElement>) {
    const projectionTrigger = (event.target as Element).closest<HTMLElement>("[data-p]");
    const projectionSubjectId = projectionTrigger?.dataset.p;
    if (projectionSubjectId) {
      model.openStateValueProjection(projectionSubjectId);
      return;
    }
    const trigger = (event.target as Element).closest<HTMLElement>("[data-t]");
    const subjectId = trigger?.dataset.t;
    if (!trigger || !subjectId) return;
    const focusOrdinal = [...document.querySelectorAll<HTMLElement>(`[data-t="${subjectId}"]`)].indexOf(trigger);
    model.openCausalSubject(subjectId, focusOrdinal);
  }
  return <main className="app-shell" onClick={traceVisibleResult}>
    <UniverseToolbar
      draftSeed={model.draftSeed}
      templateId={model.templateId}
      copyState={model.copyState}
      inputError={model.seedInputError}
      onDraftSeedChange={model.setDraftSeed}
      onTemplateChange={model.setTemplateId}
      onCreate={model.createUniverse}
      onRandomize={model.randomizeSeed}
      onCopy={model.copyShare}
    />
    <section className="legacy-compatibility-banner" aria-label="旧版隔离兼容说明">
      <div><strong>旧版隔离兼容视图</strong><span>这里展示步骤 1 的静态宇宙、旧分享与 A1 能力，不作为运行中宇宙的事实来源。</span></div>
      <button type="button" onClick={onReturnRuntime}>返回运行中宇宙</button>
    </section>
    <PageNavigation activePage={model.activePage} onChange={model.setActivePage} />
    {model.traceError && <p className="input-error" role="alert">{model.traceError}</p>}
    {model.activePage === "causality" && <CausalExplorer
      key={`${model.causalView.universe.shareCode}:${model.causalView.initialNodeId ?? "base"}`}
      universe={model.causalView.universe}
      graph={model.causalView.graph}
      initialNodeId={model.causalView.initialNodeId}
      onReturn={model.returnTrace}
    />}
    <div hidden={model.activePage === "causality"}>
      {model.contentPage === "overview" && <OverviewPage universe={model.universe} shareWarnings={model.shareWarnings} filteredTimelineCount={model.filteredTimeline.length} spaceStats={model.spaceStats} civilizationStats={model.civilizationStats} onNavigate={model.setActivePage} />}
      {model.contentPage === "observe" && <ObservationConsole key={model.universe.shareCode} universe={model.universe} onTraceCausalProjection={model.openCausalProjection} />}
      {model.contentPage === "library" && <UniverseLibrary universe={model.universe} archive={archive} onRestore={model.restoreArchivedUniverse} />}
      {model.contentPage === "space" && <SpaceExplorer universe={model.universe} stats={model.spaceStats} selectedGalaxy={model.selectedGalaxy} selectedSystem={model.selectedSystem} selectedPlanet={model.selectedPlanet} sourceLabelById={model.sourceLabelById} onSelectGalaxy={model.selectGalaxy} onSelectSystem={model.selectSystem} onSelectPlanet={model.selectPlanet} />}
      {model.contentPage === "civilizations" && <CivilizationPanel universe={model.universe} stats={model.civilizationStats} selectedCivilization={model.selectedCivilization} sourceLabelById={model.sourceLabelById} onSelectCivilization={model.selectCivilization} />}
      {model.contentPage === "miracles" && <MiraclePanel universe={model.universe} targetOptions={model.miracleTargetOptions} selectedMiracleType={model.selectedMiracleType} selectedTargetId={model.selectedMiracleTargetId} onSelectMiracleType={model.setSelectedMiracleType} onSelectTarget={model.setSelectedMiracleTargetId} onApplyMiracle={model.applySelectedMiracle} onClearInterventions={model.clearInterventions} />}
      {model.contentPage === "timeline" && <TimelinePage universe={model.universe} filteredTimeline={model.filteredTimeline} selectedEvent={model.selectedEvent} eraFilter={model.eraFilter} sourceLabelById={model.sourceLabelById} onEraFilterChange={model.setEraFilter} onEventSelect={model.setSelectedEventId} />}
      {model.contentPage === "laws" && <LawsPage universe={model.universe} comparison={model.comparison} compareDraftSeed={model.compareDraftSeed} compareInputError={model.compareInputError} sourceLabelById={model.sourceLabelById} onCompareDraftSeedChange={model.setCompareDraftSeed} onCompare={model.compareSeedNow} onTraceComparison={model.traceLawComparison} />}
      {model.contentPage === "logs" && <LogsPage universe={model.universe} />}
    </div>
  </main>;
}
