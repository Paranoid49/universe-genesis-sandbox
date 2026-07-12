import { ARCHIVE_VERSION } from "./archive";

export const ARCHIVE_STORAGE_KEY = `ugs.universeArchive.${ARCHIVE_VERSION}`;

export type ArchiveStorage = {
  read: () => string | null;
  write: (value: string) => void;
};

export const browserArchiveStorage: ArchiveStorage = {
  read: () => window.localStorage.getItem(ARCHIVE_STORAGE_KEY),
  write: (value) => window.localStorage.setItem(ARCHIVE_STORAGE_KEY, value),
};
