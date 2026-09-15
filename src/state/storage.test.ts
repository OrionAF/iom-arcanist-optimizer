import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadPanels, loadTabs, pickTab, savePanel, saveTab } from './storage';

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
