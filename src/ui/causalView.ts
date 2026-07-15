import { useState } from "preact/hooks";
import {
  appendCausalProjections,
  type CausalGraph,
  type CausalProjectionSpec,
  type UniverseSummary,
} from "../sim";
export type CausalViewRequest = { universe: UniverseSummary; graph: CausalGraph; initialNodeId?: string };
export type CausalProjectionRequest = {
  universe: UniverseSummary; returnFocusKey: string; buildProjection: (universe: UniverseSummary) => CausalProjectionSpec;
};
type OwnedCausalView = {
  ownerShareCode: string;
  returnContext: {
    page: string;
    focusKey?: string;
    focusSubjectId?: string;
    focusOrdinal?: number;
    scrollX: number;
    scrollY: number;
  };
  request: CausalViewRequest;
};

export function useCausalViewController<PageId extends string>(initialPage: PageId, currentUniverse: UniverseSummary) {
  const [activePage, setActivePageState] = useState<PageId>(initialPage);
  const [override, setOverride] = useState<OwnedCausalView>();
  const validOverride = override?.ownerShareCode === currentUniverse.shareCode ? override : undefined;
  const causalView: CausalViewRequest = validOverride?.request ?? {
    universe: currentUniverse,
    graph: currentUniverse.causalGraph,
  };

  function navigate(page: PageId) {
    if (page === "causality") setOverride(undefined);
    setActivePageState(page);
  }

  function openCausalView(request: CausalViewRequest, focusSubjectId?: string, focusOrdinal?: number, focusKey?: string) {
    const activeElement = document.activeElement as HTMLElement | null;
    const returnFocusSubjectId = focusSubjectId ?? activeElement?.dataset.t;
    const matchingFocusTargets = returnFocusSubjectId
      ? [...document.querySelectorAll<HTMLElement>(`[data-t="${returnFocusSubjectId}"]`)]
      : [];
    const returnFocusOrdinal = focusOrdinal ?? (activeElement ? matchingFocusTargets.indexOf(activeElement) : -1);
    setOverride({
      ownerShareCode: currentUniverse.shareCode,
      returnContext: {
        page: activePage,
        focusKey,
        focusSubjectId: returnFocusSubjectId,
        focusOrdinal: returnFocusOrdinal >= 0 ? returnFocusOrdinal : undefined,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      },
      request,
    });
    setActivePageState("causality" as PageId);
  }

  function returnToOrigin() {
    if (!validOverride) return;
    const context = validOverride.returnContext;
    setActivePageState(context.page as PageId);
    setOverride(undefined);
    requestAnimationFrame(() => {
      if (context.focusKey) {
        document.querySelector<HTMLElement>(`[data-causal-focus="${context.focusKey}"]`)?.focus({ preventScroll: true });
      } else if (context.focusSubjectId) {
        const targets = document.querySelectorAll<HTMLElement>(`[data-t="${context.focusSubjectId}"]`);
        targets[context.focusOrdinal ?? 0]?.focus({ preventScroll: true });
      }
      window.scrollTo(context.scrollX, context.scrollY);
    });
  }

  function openCausalProjection(request: CausalProjectionRequest) {
    const projection = request.buildProjection(request.universe);
    const graph = appendCausalProjections(request.universe.causalGraph, [projection]);
    openCausalView({
      universe: request.universe,
      graph,
      initialNodeId: `projection:${projection.id}`,
    }, undefined, undefined, request.returnFocusKey);
  }

  return {
    activePage,
    causalView,
    canReturn: Boolean(validOverride),
    contentPage: (validOverride?.returnContext.page ?? activePage) as PageId,
    navigate,
    openCausalProjection,
    openCausalView,
    returnToOrigin,
  };
}
