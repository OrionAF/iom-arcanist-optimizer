import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXAMPLE_INPUT } from '../presets/example';
import {
  backupBuild,
  loadBackup,
  loadOffers,
  loadPanels,
  loadTabs,
  loadViewFlags,
  pickTab,
  savePanel,
  saveTab,
  saveViewFlag,
  untradeOffers,
} from './storage';

/** A Map-backed stand-in: the suite runs under Node, which has no localStorage. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

describe('tab state', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remembers the active tab per panel', () => {
    saveTab('upgrades', 'spells');
    saveTab('account', 'pets');
    expect(loadTabs()).toEqual({ upgrades: 'spells', account: 'pets' });
  });

  it('remembers folded state alongside the sections', () => {
    savePanel('Optimizer', true);
    savePanel('tabs:upgrades', false);
    expect(loadPanels()).toEqual({ Optimizer: true, 'tabs:upgrades': false });
  });

  it('keeps display filters apart from folded panels', () => {
    saveViewFlag('essence.hideMaxed', true);
    savePanel('Optimizer', false);
    expect(loadViewFlags()).toEqual({ 'essence.hideMaxed': true });
    expect(loadPanels()).toEqual({ Optimizer: false });
  });

  it('ignores saved entries that are not tab ids', () => {
    localStorage.setItem('iom-arcanist-optimizer:tabs', JSON.stringify({ a: 'x', b: 3, c: null }));
    expect(loadTabs()).toEqual({ a: 'x' });
    localStorage.setItem('iom-arcanist-optimizer:tabs', '{not json');
    expect(loadTabs()).toEqual({});
  });

  it('falls back to defaults when storage throws', () => {
    const broken = memoryStorage();
    broken.getItem = () => {
      throw new Error('blocked');
    };
    broken.setItem = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', broken);
    expect(loadTabs()).toEqual({});
    expect(() => saveTab('upgrades', 'spells')).not.toThrow();
  });
});

describe('the build that was replaced', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('comes back exactly as it went in', () => {
    backupBuild(EXAMPLE_INPUT);
    expect(loadBackup()).toEqual(EXAMPLE_INPUT);
  });

  it('is nothing until something has been replaced', () => {
    expect(loadBackup()).toBeNull();
  });

  it('is cleared rather than kept when there was no build to save', () => {
    backupBuild(EXAMPLE_INPUT);
    backupBuild(null);
    expect(loadBackup()).toBeNull();
  });

  it('survives a corrupt entry without taking the page with it', () => {
    localStorage.setItem('iom-arcanist-optimizer:build.previous', '{not json');
    expect(loadBackup()).toBeNull();
  });
});

describe('offers after a build is replaced', () => {
  const OFFERS = 'iom-arcanist-optimizer:wizard-offers';

  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keep what the wizards are asking, and lose only the traded flag', () => {
    localStorage.setItem(
      OFFERS,
      JSON.stringify([
        { id: 'a', colour: 'white', orbs: 120, traded: true },
        { id: 'b', colour: 'green', orbs: 90, traded: false },
      ]),
    );
    untradeOffers();
    expect(loadOffers()).toEqual([
      { id: 'a', colour: 'white', orbs: 120, traded: false },
      { id: 'b', colour: 'green', orbs: 90, traded: false },
    ]);
  });

  it('leaves junk alone instead of throwing', () => {
    localStorage.setItem(OFFERS, '{not json');
    expect(() => untradeOffers()).not.toThrow();
    localStorage.setItem(OFFERS, '{"not":"an array"}');
    expect(() => untradeOffers()).not.toThrow();
    expect(localStorage.getItem(OFFERS)).toBe('{"not":"an array"}');
  });

  it('does nothing when no offers were ever stored', () => {
    untradeOffers();
    expect(localStorage.getItem(OFFERS)).toBeNull();
  });
});

describe('pickTab', () => {
  const ids = ['essence', 'altars', 'spells', 'cards'];

  it('keeps a saved tab the panel still has', () => {
    expect(pickTab('spells', ids)).toBe('spells');
  });

  it('falls back to the first tab for a stale or missing id', () => {
    expect(pickTab('exchange', ids)).toBe('essence');
    expect(pickTab(undefined, ids)).toBe('essence');
  });
});
