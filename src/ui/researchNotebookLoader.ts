import {
  createResearchArchive,
  createResearchNotebook,
  migrateResearchNotebookToHistory,
  researchNotebookId,
  type ObservationAccess,
  type ResearchNotebook,
  type ResearchStorageAdapter,
} from "../sim/current";

export async function loadResearchNotebook(access: ObservationAccess, storage: ResearchStorageAdapter, allowLegacyRootMigration: boolean): Promise<ResearchNotebook> {
  const empty = createResearchNotebook(access.universeDefinitionId, access.runtimeHistoryId);
  const notebookId = researchNotebookId(access.universeDefinitionId, access.runtimeHistoryId);
  const archive = await storage.get(notebookId, access.validateSignal);
  if (archive) return archive.notebook;
  if (!allowLegacyRootMigration || access.runtimeHistoryId === access.universeDefinitionId) return empty;
  const legacy = await storage.get(researchNotebookId(access.universeDefinitionId), access.validateLegacySignal);
  if (!legacy) return empty;
  const migrated = migrateResearchNotebookToHistory(legacy.notebook, access);
  await storage.put(createResearchArchive(migrated, access.validateSignal), access.validateSignal);
  return migrated;
}
