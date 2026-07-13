import { CivilizationPanel } from "./components/CivilizationPanel";
import { PageNavigation, UniverseToolbar } from "./components/AppChrome";
import { MiraclePanel } from "./components/MiraclePanel";
import { ObservationConsole } from "./components/ObservationConsole";
import { LawsPage } from "./components/pages/LawsPage";
import { LogsPage } from "./components/pages/LogsPage";
import { OverviewPage } from "./components/pages/OverviewPage";
import { TimelinePage } from "./components/pages/TimelinePage";
import { SpaceExplorer } from "./components/SpaceExplorer";
import { UniverseLibrary } from "./components/UniverseLibrary";
import { useUniverseAppModel, type AppPageId } from "./ui/useUniverseAppModel";
import { useUniverseArchive } from "./ui/useUniverseArchive";

export type AppProps = {
  initialPage?: AppPageId;
  search?: string;
};

export function App({ initialPage = "overview", search }: AppProps = {}) {
  const model = useUniverseAppModel({ initialPage, search });
  const archive = useUniverseArchive();
  return <main className="app-shell">
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
    <PageNavigation activePage={model.activePage} onChange={model.setActivePage} />
    {model.activePage === "overview" && <OverviewPage
      universe={model.universe}
      shareWarnings={model.shareWarnings}
      filteredTimelineCount={model.filteredTimeline.length}
      spaceStats={model.spaceStats}
      civilizationStats={model.civilizationStats}
      onNavigate={model.setActivePage}
    />}
    {model.activePage === "observe" && <ObservationConsole key={model.universe.shareCode} universe={model.universe} />}
    {model.activePage === "library" && <UniverseLibrary universe={model.universe} archive={archive} onRestore={model.restoreArchivedUniverse} />}
    {model.activePage === "space" && <SpaceExplorer
      universe={model.universe}
      stats={model.spaceStats}
      selectedGalaxy={model.selectedGalaxy}
      selectedSystem={model.selectedSystem}
      selectedPlanet={model.selectedPlanet}
      sourceLabelById={model.sourceLabelById}
      onSelectGalaxy={model.selectGalaxy}
      onSelectSystem={model.selectSystem}
      onSelectPlanet={model.selectPlanet}
    />}
    {model.activePage === "civilizations" && <CivilizationPanel
      universe={model.universe}
      stats={model.civilizationStats}
      selectedCivilization={model.selectedCivilization}
      sourceLabelById={model.sourceLabelById}
      onSelectCivilization={model.selectCivilization}
    />}
    {model.activePage === "miracles" && <MiraclePanel
      universe={model.universe}
      targetOptions={model.miracleTargetOptions}
      selectedMiracleType={model.selectedMiracleType}
      selectedTargetId={model.selectedMiracleTargetId}
      onSelectMiracleType={model.setSelectedMiracleType}
      onSelectTarget={model.setSelectedMiracleTargetId}
      onApplyMiracle={model.applySelectedMiracle}
      onClearInterventions={model.clearInterventions}
    />}
    {model.activePage === "timeline" && <TimelinePage
      universe={model.universe}
      filteredTimeline={model.filteredTimeline}
      selectedEvent={model.selectedEvent}
      eraFilter={model.eraFilter}
      sourceLabelById={model.sourceLabelById}
      onEraFilterChange={model.setEraFilter}
      onEventSelect={model.setSelectedEventId}
    />}
    {model.activePage === "laws" && <LawsPage
      universe={model.universe}
      comparison={model.comparison}
      compareDraftSeed={model.compareDraftSeed}
      compareInputError={model.compareInputError}
      sourceLabelById={model.sourceLabelById}
      onCompareDraftSeedChange={model.setCompareDraftSeed}
      onCompare={model.compareSeedNow}
    />}
    {model.activePage === "logs" && <LogsPage universe={model.universe} />}
  </main>;
}
