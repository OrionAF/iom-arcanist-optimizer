import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ALTAR_IDS,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  SPELL_IDS,
} from '../calc/constants';
import { ESSENCE_TYPES } from '../calc/types';
import {
  ALTAR_ICONS,
  ESSENCE_ICONS,
  ESSENCE_UPGRADE_ICONS,
  EXCHANGE_UPGRADE_ICONS,
  MISC_ICONS,
  RESOURCE_ICONS,
  SECTION_ICONS,
  SPELL_ACTIVE_ICONS,
  SPELL_ICONS,
} from './icons';

/**
 * A missing icon is a silent broken image at runtime, so every path in the
 * catalog is checked against public/icons/ here rather than discovered in a
 * screenshot.
 */
const everyIcon = [
  ...Object.values(ESSENCE_ICONS),
  ...Object.values(SECTION_ICONS),
  ...Object.values(RESOURCE_ICONS),
  ...Object.values(ALTAR_ICONS),
  ...Object.values(SPELL_ICONS),
  ...Object.values(SPELL_ACTIVE_ICONS),
  ...Object.values(ESSENCE_UPGRADE_ICONS),
  ...Object.values(EXCHANGE_UPGRADE_ICONS),
  ...Object.values(MISC_ICONS),
].filter((value): value is string => typeof value === 'string');

const fileFor = (url: string) => join('public', 'icons', url.split('/').pop()!);

describe('icon catalog', () => {
  it('points every entry at a file that exists', () => {
    const missing = [...new Set(everyIcon)].filter((url) => !existsSync(fileFor(url)));
    expect(missing, 'icons with no file in public/icons').toEqual([]);
  });

  it('covers every upgrade, spell, altar and essence type', () => {
    for (const type of ESSENCE_TYPES) expect(ESSENCE_ICONS[type], type).toBeTruthy();
    for (const id of ALTAR_IDS) expect(ALTAR_ICONS[id], id).toBeTruthy();
    for (const id of SPELL_IDS) {
      expect(SPELL_ICONS[id], id).toBeTruthy();
      expect(SPELL_ACTIVE_ICONS[id], `${id} active`).toBeTruthy();
    }
    for (const def of ESSENCE_UPGRADES) {
      expect(ESSENCE_UPGRADE_ICONS[def.id], def.id).toBeTruthy();
    }
    for (const def of EXCHANGE_UPGRADES) {
      expect(EXCHANGE_UPGRADE_ICONS[def.id], def.id).toBeTruthy();
    }
  });

  it('serves icons under the configured base path', () => {
    for (const url of everyIcon) expect(url).toMatch(/\/icons\/[^/]+\.png$/);
  });
});
