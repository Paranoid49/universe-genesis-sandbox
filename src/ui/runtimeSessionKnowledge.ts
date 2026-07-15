import type { ObservationAccess, ResearchNotebook } from "../sim/current";

export function createRuntimeSessionKnowledge(notebook: ResearchNotebook, access: ObservationAccess) {
  return {
    focuses: notebook.focuses.map((entry) => entry.label),
    recentSignals: notebook.signals.slice(-4).map((entry) => ({ id: entry.id, title: entry.title, value: entry.visibleValue, tick: entry.tick })),
    recentChanges: notebook.signals.filter((entry) => access.methods.some((method) => method.id === entry.methodId && method.kind === "recent-change")).slice(-4).map((entry) => ({ id: entry.id, title: entry.title, value: entry.visibleValue, tick: entry.tick })),
    unknownMethods: access.methods.filter((method) => !notebook.signals.some((signal) => signal.methodId === method.id)).map((method) => method.name),
    publicAxioms: access.publicAxioms.map((entry) => entry.label),
  };
}
