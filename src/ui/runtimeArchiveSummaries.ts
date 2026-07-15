import type { RuntimeArchiveEnvelope } from "../sim/current";

export function summarizeRuntimeArchives(archives: readonly RuntimeArchiveEnvelope[], universeDefinitionId: string) {
  return Object.freeze(archives
    .filter((archive) => archive.universeDefinitionId === universeDefinitionId)
    .map((archive) => Object.freeze({ stateId: archive.stateId, step: archive.state.clock.step, tick: archive.state.clock.tick }))
    .sort((left, right) => right.step - left.step));
}
