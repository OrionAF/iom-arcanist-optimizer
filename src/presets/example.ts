/**
 * An example mid-game build: the first three altars unlocked, five spells, a
 * handful of cards. What the "Load example" button fills in, and a realistic
 * starting point for tests.
 */

import type { ArcanistInput } from '../calc/types';
import { FRESH_EXTERNAL, FRESH_INPUT, FRESH_WIZARD } from './fresh';

export const EXAMPLE_INPUT: ArcanistInput = {
  essence: {
    ...FRESH_INPUT.essence,
    essenceMine: 2,
    flatDamage1: 17,
    softMaxLoot: 2,
    shinyChance1: 7,
    critChance1: 9,
    flatDamage2: 12,
    denseMaxLoot: 1,
    armorPen: 5,
    superCrit1: 2,
    flatDamage3: 4,
    damagePct: 10,
    shinyLoot: 1,
    shinyChance2: 1,
    critChance2: 7,
    jaggedLoot: 1,
  },
  altars: {
    ...FRESH_INPUT.altars,
    ash: { unlocked: true, active: false, capacity: 8, travel: 10, craft: 4 },
    brine: { unlocked: true, active: true, capacity: 5, travel: 10, craft: 3 },
    chasm: { unlocked: true, active: false, capacity: 5, travel: 10, craft: 0 },
  },
  spells: {
    ...FRESH_INPUT.spells,
    runicSurge: { unlocked: true, level: 13, rank: 10 },
    rainbowRift: { unlocked: true, level: 1, rank: 2 },
    manaflow: { unlocked: true, level: 1, rank: 0 },
    radiancy: { unlocked: true, level: 3, rank: 0 },
    prismism: { unlocked: true, level: 1, rank: 4 },
  },
  exchange: {
    ...FRESH_INPUT.exchange,
    arcaneCardDamage: 1,
  },
  external: {
    ...FRESH_EXTERNAL,
    cards: {
      essence: { ...FRESH_EXTERNAL.cards.essence, soft: 'polychrome', dense: 'normal', jagged: 'normal' },
      rune: { ...FRESH_EXTERNAL.cards.rune, ash: 'polychrome', brine: 'gilded' },
      spell: {
        ...FRESH_EXTERNAL.cards.spell,
        runicSurge: 'gilded',
        rainbowRift: 'gilded',
        manaflow: 'normal',
      },
      orb: { ...FRESH_EXTERNAL.cards.orb, white: 'gilded', green: 'gilded', purple: 'normal' },
    },
    pets: { ...FRESH_EXTERNAL.pets, rhinoLevel: 5 },
    contractRuneCraftLevel: 16,
  },
  mining: 'soft',
  // Green and Purple unlocked; Orange still needs 30 more Purple traded.
  wizard: {
    ...FRESH_WIZARD,
    lootMulti: 1.1,
    partyChance: 6,
    wizardCount: 7,
    exchangeTimerLevel: 8,
    traded: { white: 420, green: 260, purple: 120, orange: 0, red: 0, yellow: 0 },  },
};
