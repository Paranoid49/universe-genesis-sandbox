import type { UniverseBranch } from "./contracts/branching";
import { BRANCH_ARCHIVE_VERSION, type BranchArchiveEnvelope } from "./contracts/branch-persistence";
import { createRuntimeArchive, parseRuntimeArchive, serializeRuntimeArchive } from "./runtime-archive";
import { runtimeFingerprint } from "./runtime-integrity";
import { validateBranch } from "./branching";

export function createBranchArchive(branch: UniverseBranch): BranchArchiveEnvelope {
  const verified = validateBranch(branch);
  const payload = {
    version: BRANCH_ARCHIVE_VERSION,
    branchId: verified.branchId,
    universeDefinitionId: verified.universeDefinitionId,
    stateHash: verified.stateHash,
    historyHash: verified.historyHash,
    branch: verified,
    runtimeArchive: createRuntimeArchive(verified.state),
  } satisfies Omit<BranchArchiveEnvelope, "checksum">;
  return Object.freeze({ ...payload, checksum: runtimeFingerprint(payload) });
}

export function serializeBranchArchive(archive: BranchArchiveEnvelope): string {
  return JSON.stringify(archive);
}

export function parseBranchArchive(raw: string): BranchArchiveEnvelope {
  let parsed: BranchArchiveEnvelope;
  try { parsed = JSON.parse(raw) as BranchArchiveEnvelope; } catch { throw new Error("分支存档不是有效 JSON。"); }
  if (!parsed || parsed.version !== BRANCH_ARCHIVE_VERSION || typeof parsed.checksum !== "string") throw new Error("分支存档结构或版本无效。");
  const { checksum, ...payload } = parsed;
  if (runtimeFingerprint(payload) !== checksum) throw new Error("分支存档完整性校验失败。");
  const runtimeArchive = parseRuntimeArchive(serializeRuntimeArchive(parsed.runtimeArchive));
  const branch = validateBranch(parsed.branch);
  if (branch.branchId !== parsed.branchId || branch.universeDefinitionId !== parsed.universeDefinitionId || branch.stateHash !== parsed.stateHash || branch.historyHash !== parsed.historyHash) throw new Error("分支存档身份或哈希不匹配。");
  if (runtimeArchive.stateId !== branch.state.id) throw new Error("分支存档运行检查点不匹配。");
  return createBranchArchive(branch);
}
