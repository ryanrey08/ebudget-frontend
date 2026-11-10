/**
 * Optional persistence for the mock database (NEXT_PUBLIC_MOCK_API_PERSIST=true).
 * The in-memory tables in ./db.ts are saved to localStorage after every
 * successful write and restored on load, so mock changes survive a reload.
 *
 * This lives entirely inside the mock layer; the real API mode never loads it.
 * Bump MOCK_DB_VERSION when the seed data changes shape so stale copies are dropped.
 */

const STORAGE_KEY = "ebudget.mock-db";
export const MOCK_DB_VERSION = 1;

type Tables = Record<string, unknown>;

let source: (() => Tables) | null = null;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Registers the tables to persist and returns the saved copy, if any. */
export function registerMockDb(getTables: () => Tables): Tables | null {
  source = getTables;
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version: number; tables: Tables };
    return parsed.version === MOCK_DB_VERSION ? parsed.tables : null;
  } catch {
    return null;
  }
}

export function persistMockDb() {
  if (!source) return;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify({ version: MOCK_DB_VERSION, tables: source() }));
  } catch (error) {
    console.warn("[mock api] could not persist the mock database", error);
  }
}

/** Drops the saved copy; the seed data is used again after a reload. */
export function clearPersistedMockDb() {
  storage()?.removeItem(STORAGE_KEY);
}
