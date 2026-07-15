import {
  RUNTIME_ARCHIVE_VERSION,
  UNIVERSE_STATE_VERSION,
  type RuntimeArchiveEnvelope,
  type UniverseState,
} from "./contracts/runtime";
import { runtimeFingerprint } from "./runtime-integrity";
import { restoreUniverseState, runtimeStateFingerprint } from "./runtime-state";
import { assertUniverseStateSemantics } from "./runtime-state-validation";

export type RuntimeArchiveErrorCode =
  | "runtime-archive.invalid-json"
  | "runtime-archive.invalid-shape"
  | "runtime-archive.unsupported-version"
  | "runtime-archive.checksum-mismatch"
  | "runtime-archive.identity-mismatch"
  | "runtime-archive.state-mismatch"
  | "runtime-archive.history-mismatch";

export class RuntimeArchiveError extends Error {
  constructor(readonly code: RuntimeArchiveErrorCode, message: string) {
    super(message);
    this.name = "RuntimeArchiveError";
  }
}

export function createRuntimeArchive(state: UniverseState): RuntimeArchiveEnvelope {
  const restored = restoreUniverseState(state);
  assertUniverseStateSemantics(restored);
  const payload = {
    version: RUNTIME_ARCHIVE_VERSION,
    stateVersion: UNIVERSE_STATE_VERSION,
    universeDefinitionId: restored.identity.universeDefinitionId,
    stateId: restored.id,
    stateFingerprint: runtimeStateFingerprint(restored),
    transitionCount: restored.transitions.length,
    lastTransitionId: restored.committedTransitionIds.at(-1) ?? null,
    state: restored,
  } satisfies Omit<RuntimeArchiveEnvelope, "checksum">;
  return Object.freeze({ ...payload, checksum: runtimeFingerprint(payload) });
}

export function serializeRuntimeArchive(envelope: RuntimeArchiveEnvelope): string {
  return JSON.stringify(envelope);
}

export function parseRuntimeArchive(raw: string): RuntimeArchiveEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RuntimeArchiveError("runtime-archive.invalid-json", "运行存档不是有效 JSON。");
  }
  if (!isRecord(parsed)) throw new RuntimeArchiveError("runtime-archive.invalid-shape", "运行存档顶层结构无效。");
  if (parsed.version !== RUNTIME_ARCHIVE_VERSION || parsed.stateVersion !== UNIVERSE_STATE_VERSION) {
    throw new RuntimeArchiveError("runtime-archive.unsupported-version", "运行存档版本不受支持。");
  }
  if (typeof parsed.checksum !== "string") throw new RuntimeArchiveError("runtime-archive.invalid-shape", "运行存档缺少完整性校验值。");
  const { checksum, ...payload } = parsed;
  if (runtimeFingerprint(payload) !== checksum) throw new RuntimeArchiveError("runtime-archive.checksum-mismatch", "运行存档完整性校验失败。");
  if (!isRecord(parsed.state)) throw new RuntimeArchiveError("runtime-archive.invalid-shape", "运行存档缺少宇宙状态。");

  let state: UniverseState;
  try {
    state = restoreUniverseState(parsed.state as UniverseState);
    assertUniverseStateSemantics(state);
  } catch (error) {
    throw new RuntimeArchiveError("runtime-archive.state-mismatch", error instanceof Error ? error.message : "运行状态校验失败。");
  }
  if (parsed.universeDefinitionId !== state.identity.universeDefinitionId || parsed.stateId !== state.id) {
    throw new RuntimeArchiveError("runtime-archive.identity-mismatch", "运行存档身份与内部状态不匹配。");
  }
  if (parsed.stateFingerprint !== runtimeStateFingerprint(state)) {
    throw new RuntimeArchiveError("runtime-archive.state-mismatch", "运行存档状态指纹不匹配。");
  }
  if (parsed.transitionCount !== state.transitions.length || parsed.lastTransitionId !== (state.committedTransitionIds.at(-1) ?? null)) {
    throw new RuntimeArchiveError("runtime-archive.history-mismatch", "运行存档转换历史不完整。");
  }
  return Object.freeze({ ...parsed, state }) as unknown as RuntimeArchiveEnvelope;
}

export function restoreRuntimeArchive(envelope: RuntimeArchiveEnvelope): UniverseState {
  return parseRuntimeArchive(serializeRuntimeArchive(envelope)).state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
