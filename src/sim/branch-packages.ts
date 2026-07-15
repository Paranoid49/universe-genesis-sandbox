import type { UniverseBranch } from "./contracts/branching";
import { GENESIS_PACKAGE_VERSION, HISTORY_BRANCH_PACKAGE_VERSION, type GenesisPackage, type HistoryBranchPackage } from "./contracts/branch-persistence";
import type { UniverseDefinition } from "./contracts/runtime";
import { createBranchArchive, parseBranchArchive, serializeBranchArchive } from "./branch-archive";
import { continueSharedUniverseBranch, receiveSharedUniverseBranch } from "./branching";
import { runtimeFingerprint, runtimeStableSerialize } from "./runtime-integrity";
import { createInitialUniverseState } from "./runtime-state";

export class BranchPackageError extends Error {
  constructor(readonly code: string, readonly fieldPath: string, message: string) { super(message); }
}

export function createGenesisPackage(definition: UniverseDefinition): GenesisPackage {
  const payload = { version: GENESIS_PACKAGE_VERSION, packageType: "genesis" as const, universeDefinition: Object.freeze({ ...definition, initialInputIds: Object.freeze([...definition.initialInputIds]) }) } satisfies Omit<GenesisPackage, "checksum">;
  return Object.freeze({ ...payload, checksum: runtimeFingerprint(payload) });
}

export function createHistoryBranchPackage(branch: UniverseBranch): HistoryBranchPackage {
  const payload = { version: HISTORY_BRANCH_PACKAGE_VERSION, packageType: "history-branch" as const, branchArchive: createBranchArchive(branch) } satisfies Omit<HistoryBranchPackage, "checksum">;
  return Object.freeze({ ...payload, checksum: runtimeFingerprint(payload) });
}

export function parseGenesisPackage(raw: string): GenesisPackage {
  const parsed = parseJson(raw) as GenesisPackage;
  if (parsed.version !== GENESIS_PACKAGE_VERSION || parsed.packageType !== "genesis" || !parsed.universeDefinition) throw new BranchPackageError("BPKG_GENESIS_SHAPE", "package", "创世条件包：结构或版本无效。");
  const { checksum, ...payload } = parsed;
  if (runtimeFingerprint(payload) !== checksum) throw new BranchPackageError("BPKG_GENESIS_CHECKSUM", "checksum", "创世条件包：完整性失败。");
  let canonical: UniverseDefinition;
  try { canonical = createInitialUniverseState({ seed: parsed.universeDefinition.seed, constitution: parsed.universeDefinition.constitution }).identity; }
  catch { throw new BranchPackageError("BPKG_GENESIS_DEFINITION", "universeDefinition", "创世条件包：定义无效。"); }
  if (runtimeStableSerialize(canonical) !== runtimeStableSerialize(parsed.universeDefinition)) throw new BranchPackageError("BPKG_GENESIS_IDENTITY", "universeDefinition", "宇宙定义身份不匹配。");
  return createGenesisPackage(parsed.universeDefinition);
}

export function parseHistoryBranchPackage(raw: string): HistoryBranchPackage {
  const parsed = parseJson(raw) as HistoryBranchPackage;
  if (parsed.version !== HISTORY_BRANCH_PACKAGE_VERSION || parsed.packageType !== "history-branch" || !parsed.branchArchive) throw new BranchPackageError("BPKG_HISTORY_SHAPE", "package", "历史分支包：结构或版本无效。");
  const { checksum, ...payload } = parsed;
  if (runtimeFingerprint(payload) !== checksum) throw new BranchPackageError("BPKG_HISTORY_CHECKSUM", "checksum", "历史分支包：完整性失败。");
  let branchArchive;
  try { branchArchive = parseBranchArchive(serializeBranchArchive(parsed.branchArchive)); }
  catch (cause) { throw new BranchPackageError("BPKG_HISTORY_ARCHIVE", "branchArchive", cause instanceof Error ? cause.message : "历史分支包存档无效。"); }
  return createHistoryBranchPackage(branchArchive.branch);
}

export function continueHistoryBranchPackage(pack: HistoryBranchPackage): UniverseBranch {
  const verified = parseHistoryBranchPackage(JSON.stringify(pack));
  return continueSharedUniverseBranch(verified.branchArchive.branch);
}

export function receiveHistoryBranchPackage(pack: HistoryBranchPackage): UniverseBranch {
  const verified = parseHistoryBranchPackage(JSON.stringify(pack));
  return receiveSharedUniverseBranch(verified.branchArchive.branch);
}

export function serializeSharePackage(pack: GenesisPackage | HistoryBranchPackage): string {
  return JSON.stringify(pack);
}

function parseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { throw new BranchPackageError("BPKG_JSON", "package", "分享包不是有效 JSON。"); }
}
