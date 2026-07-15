import type { UniverseBranch } from "./branching";
import type { RuntimeArchiveEnvelope, UniverseDefinition } from "./runtime";

export const BRANCH_ARCHIVE_VERSION = "ugs-branch-archive@5";
export const GENESIS_PACKAGE_VERSION = "ugs-genesis-package@4";
export const HISTORY_BRANCH_PACKAGE_VERSION = "ugs-history-branch-package@5";

export type BranchArchiveEnvelope = {
  version: typeof BRANCH_ARCHIVE_VERSION;
  branchId: string;
  universeDefinitionId: string;
  stateHash: string;
  historyHash: string;
  branch: UniverseBranch;
  runtimeArchive: RuntimeArchiveEnvelope;
  checksum: string;
};

export type GenesisPackage = {
  version: typeof GENESIS_PACKAGE_VERSION;
  packageType: "genesis";
  universeDefinition: UniverseDefinition;
  checksum: string;
};

export type HistoryBranchPackage = {
  version: typeof HISTORY_BRANCH_PACKAGE_VERSION;
  packageType: "history-branch";
  branchArchive: BranchArchiveEnvelope;
  checksum: string;
};

export type BranchStorageAdapter = {
  readonly storageVersion: string;
  migrate: () => Promise<void>;
  put: (archive: BranchArchiveEnvelope) => Promise<void>;
  commit: (archive: BranchArchiveEnvelope, activate: boolean) => Promise<void>;
  get: (branchId: string) => Promise<BranchArchiveEnvelope | undefined>;
  list: (universeDefinitionId?: string) => Promise<readonly BranchArchiveEnvelope[]>;
  getActiveBranchId: (universeDefinitionId: string) => Promise<string | undefined>;
  remove: (branchId: string) => Promise<void>;
};
