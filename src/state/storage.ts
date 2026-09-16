/**
 * localStorage autosave and JSON export/import.
 *
 * Every read is defensive: a corrupt or stale entry must degrade to "no saved
 * build" rather than a blank screen.
 */

import type { ArcanistInput, WizardOffer } from '../calc/types';
import { SCHEMA_VERSION, fromSavedBuild, toSavedBuild } from './schema';

const STORAGE_KEY = 'iom-arcanist-optimizer:build';
const BACKUP_KEY = 'iom-arcanist-optimizer:build.previous';
const PANELS_KEY = 'iom-arcanist-optimizer:panels';
const TABS_KEY = 'iom-arcanist-optimizer:tabs';
const VIEW_KEY = 'iom-arcanist-optimizer:view';
const OFFERS_KEY = 'iom-arcanist-optimizer:wizard-offers';

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

/**
 * The build that was on file before something replaced it wholesale — a link
 * that was kept, Reset, Load example, Import.
 *
 * One step back, not a history: the value of this is that replacing a build is
 * never final, and a single slot buys that. Passing null clears it, so a
 * restore cannot hand back a build that was never there.
 */
export function backupBuild(input: ArcanistInput | null): void {
  try {
    if (input === null) localStorage.removeItem(BACKUP_KEY);
    else localStorage.setItem(BACKUP_KEY, JSON.stringify(toSavedBuild(input)));
  } catch {
    // Same bargain as the autosave: convenience, not a requirement.
  }
}

export function loadBackup(): ArcanistInput | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    return fromSavedBuild(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Which panels are open, keyed by panel id.
 *
 * Kept out of the build so it never travels in a share link or an export — how
 * someone has arranged their own screen is not part of the build they are
 * sharing. A missing entry means "whatever the panel's default is", so adding a
 * panel does not need a migration.
 */
export function loadPanels(): Record<string, boolean> {
  return loadFlags(PANELS_KEY);
}

export function savePanel(id: string, open: boolean): void {
  saveFlag(PANELS_KEY, id, open);
}

/**
 * Display filters, such as hiding maxed upgrades. Same bargain as
 * `loadPanels`: how a screen is filtered is not part of the build.
 */
export function loadViewFlags(): Record<string, boolean> {
  return loadFlags(VIEW_KEY);
}

export function saveViewFlag(id: string, on: boolean): void {
  saveFlag(VIEW_KEY, id, on);
}

function loadFlags(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') out[id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function saveFlag(key: string, id: string, on: boolean): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...loadFlags(key), [id]: on }));
  } catch {
    // Same bargain as the build autosave: a convenience, not a requirement.
  }
}

/**
 * Which tab each tabbed panel shows, keyed by panel id. Same bargain as
 * `loadPanels`: layout, not build, and a missing entry means the default.
 */
export function loadTabs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveTab(panelId: string, tabId: string): void {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify({ ...loadTabs(), [panelId]: tabId }));
  } catch {
    // A convenience, not a requirement.
  }
}

/**
 * The saved tab if the panel still has it, otherwise the first. A tab can
 * disappear between visits — renamed, or moved to another panel — and a stale
 * id must not leave a panel with nothing selected.
 */
export function pickTab(saved: string | undefined, tabIds: readonly string[]): string {
  return saved !== undefined && tabIds.includes(saved) ? saved : (tabIds[0] ?? '');
}

/**
 * The Wizard Exchange offers on screen. Browser-only: they are replaced every
 * refresh, so they have no place in a build or a share link.
 */
export function loadOffers(): unknown {
  try {
    const raw = localStorage.getItem(OFFERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOffers(offers: readonly WizardOffer[]): void {
  try {
    localStorage.setItem(OFFERS_KEY, JSON.stringify(offers));
  } catch {
    // A convenience, not a requirement.
  }
}

/**
 * Clear the traded flags on whatever offers are stored.
 *
 * Orbs Traded belongs to the build; the offers do not. When the build is
 * replaced wholesale the flags refer to a tally that no longer exists, and
 * pressing Undo on one would take orbs off a count that never gained them.
 * The offers themselves are left alone: what the wizards are asking for this
 * refresh is still true.
 */
export function untradeOffers(): void {
  try {
    const raw = localStorage.getItem(OFFERS_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const cleared = parsed.map((offer) =>
      offer !== null && typeof offer === 'object' ? { ...offer, traded: false } : offer,
    );
    localStorage.setItem(OFFERS_KEY, JSON.stringify(cleared));
  } catch {
    // A convenience, not a requirement.
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
  // Not in the same tick as the click: some browsers have not started reading
  // the blob by then and cancel the download outright.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importFromFile(file: File): Promise<ArcanistInput> {
  const text = await file.text();
  return fromSavedBuild(JSON.parse(text));
}
