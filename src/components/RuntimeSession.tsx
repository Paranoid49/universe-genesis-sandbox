import { useMemo, useState } from "preact/hooks";
import { createObservationAccess, type UniverseConstitution } from "../sim/current";
import { createRuntimePageModel } from "../ui/runtimePageModel";
import { useObservationWorkbench } from "../ui/useObservationWorkbench";
import { useBranchLaboratory } from "../ui/useBranchLaboratory";
import { useRuntimeUniverseModel } from "../ui/useRuntimeUniverseModel";
import { createRuntimeSessionKnowledge } from "../ui/runtimeSessionKnowledge";
import { RuntimeNavigation, type RuntimePageId } from "./RuntimeNavigation";
import { ArchivePage } from "./pages/ArchivePage";
import { BranchesPage } from "./pages/BranchesPage";
import { ExperimentPage } from "./pages/ExperimentPage";
import { ObservationPage } from "./pages/ObservationPage";
import { ResearchPage } from "./pages/ResearchPage";
import { RuntimePage } from "./pages/RuntimePage";
import { AutonomousEntitiesPage } from "./pages/AutonomousEntitiesPage";

export function RuntimeSession({ seed, constitution, active, onOpenLegacy }: { seed: string; constitution: UniverseConstitution; active: boolean; onOpenLegacy: (seed: string) => void }) {
  const runtime = useRuntimeUniverseModel({ seed, constitution, active });
  const [page, setPage] = useState<RuntimePageId>("universe");
  const laboratory = useBranchLaboratory({ runtime, active });
  const observationAccess = useMemo(() => createObservationAccess(runtime.state, laboratory.currentBranch?.branchId), [laboratory.currentBranch?.branchId, runtime.state]);
  const workbench = useObservationWorkbench({ access: observationAccess, active, allowLegacyRootMigration: !laboratory.currentBranch?.parentBranchId });
  const knowledge = useMemo(() => createRuntimeSessionKnowledge(workbench.notebook, observationAccess), [observationAccess, workbench.notebook]);
  const baseModel = createRuntimePageModel(runtime, knowledge);
  const model = { ...baseModel, busy: baseModel.busy || laboratory.busy, error: laboratory.error ?? baseModel.error, status: laboratory.status ?? baseModel.status, onAdvance: laboratory.advanceCurrent, onToggleRunning: laboratory.toggleRunning, onRestoreLatest: laboratory.restoreLatestCheckpoint };
  const hasEntities = Object.keys(runtime.state.autonomy.entities).length > 0;
  return <>
    <RuntimeNavigation activePage={page === "entities" && !hasEntities ? "universe" : page} hasEntities={hasEntities} onChange={(nextPage) => { runtime.pause(); setPage(nextPage); }} disabled={runtime.busy || workbench.busy} onOpenLegacy={() => { runtime.pause(); onOpenLegacy(seed); }} />
    {page === "universe" && <RuntimePage model={model} view="current" />}
    {page === "observe" && <ObservationPage workbench={workbench} causal={{ node: runtime.causalNode, directCauses: runtime.directCauses, directEffects: runtime.directEffects, select: runtime.setCausalNodeId }} />}
    {page === "entities" && hasEntities && <AutonomousEntitiesPage state={runtime.state} causal={{ node: runtime.causalNode, directCauses: runtime.directCauses, directEffects: runtime.directEffects, select: runtime.setCausalNodeId }} />}
    {page === "research" && <ResearchPage workbench={workbench} />}
    {page === "experiment" && <ExperimentPage laboratory={laboratory} />}
    {page === "branches" && <BranchesPage laboratory={laboratory} />}
    {page === "history" && <RuntimePage model={model} view="history" />}
    {page === "archives" && <ArchivePage model={{ busy: runtime.busy || laboratory.busy, checkpoints: runtime.archiveSummaries, research: { revision: workbench.notebook.revision, signals: workbench.notebook.signals.length, focuses: workbench.notebook.focuses.length, notes: workbench.notebook.notes.length, hypotheses: workbench.notebook.hypotheses.length }, onSave: runtime.save, onRestoreLatest: laboratory.restoreLatestCheckpoint }} />}
  </>;
}
