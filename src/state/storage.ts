/**
 * localStorage autosave and JSON export/import.
 *
 * Every read is defensive: a corrupt or stale entry must degrade to "no saved
 * build" rather than a blank screen.
 */

import type { ArcanistInput } from '../calc/types';
import { SCHEMA_VERSION, fromSavedBuild, toSavedBuild } from './schema';

const STORAGE_KEY = 'iom-arcanist-optimizer:build';

export function loadBuild(): ArcanistInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return fromSavedBuild(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveBuild(input: ArcanistInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSavedBuild(input)));
  } catch {
    // Private mode or a full quota: autosave is a convenience, not a requirement.
  }
}

export function clearBuild(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function exportToFile(input: ArcanistInput): void {
  const blob = new Blob([JSON.stringify(toSavedBuild(input), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `arcanist-build-v${SCHEMA_VERSION}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importFromFile(file: File): Promise<ArcanistInput> {
  const text = await file.text();
  return fromSavedBuild(JSON.parse(text));
}
