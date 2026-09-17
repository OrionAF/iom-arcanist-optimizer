/**
 * The Arcanist's numbers: names, maxima, effects, prerequisites and prices.
 *
 * Every figure the calculator uses lives here and matches what the game
 * itself charges and grants, so a balance patch should be fixable by editing
 * this file alone.
 */

import type {
  AltarDef,
  AltarId,
  BlockDef,
  CardTier,
  EssenceType,
  EssenceUpgradeDef,
  ExchangeUpgradeDef,
  Resource,
  SpellDef,
  SpellId,
} from './types';

/** Arcanist base mining stats. */
export const BASE_STATS = {
  /** Damage is round½↑((10 + flat upgrades + arcane cards) × (1 + damage%)). */
  baseDamage: 10,
  /** Hits per second before Attack Speed: `atkSpd = 0.5 × (1 + attack speed)`. */
  attackRate: 0.5,
  /** Crit damage is 2 * (1 + Crit Damage). */
  critDamage: 2,
  /** Super crit damage is 2 * (1 + Super Crit Damage). */
  superCritDamage: 2,
  ultraCritChance: 0,
  /** Not changed by any known upgrade. */
  ultraCritDamage: 2,
  /** Shiny loot bonus is 3 + Shiny Essence Loot. */
  shinyBonusBase: 3,
  /** Super shiny adds this on top of the shiny bonus, plus Super Shiny Essence Loot. */
  superShinyBonus: 5,
  /**
   * Ultra shiny adds this on top of the super shiny bonus. Observed in game:
   * with All Shiny Essence Loot +1 the ultra shiny buff read +8.
   */
  ultraShinyBonus: 7,
  /** A brittle block spawns with this fraction of its max HP. */
  brittleMult: 0.2,
} as const;

export const RESOURCES: readonly Resource[] = [
  'whiteOrb',
  'greenOrb',
  'purpleOrb',
  'orangeOrb',
  'redOrb',
  'yellowOrb',
  'ashRune',
  'brineRune',
  'chasmRune',
  'driftRune',
  'echoRune',
  'softEssence',
  'denseEssence',
];

export const RESOURCE_LABELS: Record<Resource, string> = {
  whiteOrb: 'White Orb',
  greenOrb: 'Green Orb',
  purpleOrb: 'Purple Orb',
  orangeOrb: 'Orange Orb',
  redOrb: 'Red Orb',
  yellowOrb: 'Yellow Orb',
  ashRune: 'Ash Rune',
  brineRune: 'Brine Rune',
  chasmRune: 'Chasm Rune',
  driftRune: 'Drift Rune',
  echoRune: 'Echo Rune',
  softEssence: 'Soft Essence',
  denseEssence: 'Dense Essence',
};

/** Grouping used by the Total Resources panel. */
export const RESOURCE_GROUPS: { label: string; resources: Resource[] }[] = [
  {
    label: 'Orbs',
    resources: ['whiteOrb', 'greenOrb', 'purpleOrb', 'orangeOrb', 'redOrb', 'yellowOrb'],
  },
  { label: 'Runes', resources: ['ashRune', 'brineRune', 'chasmRune', 'driftRune', 'echoRune'] },
  { label: 'Essence', resources: ['softEssence', 'denseEssence'] },
];

export const ESSENCE_LABELS: Record<EssenceType, string> = {
  soft: 'Soft Essence',
  dense: 'Dense Essence',
  jagged: 'Jagged Essence',
  necrotic: 'Necrotic Essence',
};

// ---------------------------------------------------------------------------
// Card tiers
// ---------------------------------------------------------------------------

const cardScale = (normal: number, gilded: number, polychrome: number) =>
  ({ normal, gilded, polychrome }) as const;

export const CARD_SCALES = {
  /** Essence Cards, max essence loot. */
  essenceMaxLoot: cardScale(1, 2, 4),
  /** Rune Cards, altar craft multiplier. */
  altarCraft: cardScale(0.15, 0.3, 0.5),
  /** Spell Cards, spell effect. */
  spell: cardScale(0.1, 0.2, 0.35),
  /** Orb Cards, trade multiplier. Unused by the Arcanist. */
  orbTrade: cardScale(0.15, 0.3, 0.5),
  /** The Rhino's card. Not one of the counted Arcanist blocks. */
  superShiny: cardScale(0.01, 0.02, 0.04),
} as const;

/**
 * How many owned tiers a card at this tier represents.
 *
 * Tiers are cumulative in game — a Polychrome card means you own Normal,
 * Gilded and Polychrome — so each counts toward Essence Damage Per Arcanist
 * Card Tier Owned.
 */
export const CARD_TIER_COUNT: Record<CardTier, number> = {
  none: 0,
  normal: 1,
  gilded: 2,
  polychrome: 3,
};

export function cardValue(
  scale: (typeof CARD_SCALES)[keyof typeof CARD_SCALES],
  tier: CardTier,
): number {
  switch (tier) {
    case 'none':
      return 0;
    case 'normal':
      return scale.normal;
    case 'gilded':
      return scale.gilded;
    case 'polychrome':
      return scale.polychrome;
  }
}

// ---------------------------------------------------------------------------
// Essence blocks
// ---------------------------------------------------------------------------

/*
 * From the block constructors in `controllerArcanist_Create_0`
 * (docs/essence_block_combat.html, section 07). Chances are per 1-second roll;
 * weaken's multiplier scales damage and daze's scales attack speed. Every
 * block regenerates on a 10 s timer.
 */

export const BLOCKS: Record<EssenceType, BlockDef> = {
  soft: {
    health: 1000,
    armor: 3,
    respawn: 10,
    stunChance: 0,
    stunDuration: 1,
    regen: 5,
    regenInterval: 10,
    weakenChance: 0,
    weakenMulti: 1,
    weakenDuration: 0,
    dazeChance: 0,
    dazeMulti: 1,
    dazeDuration: 0,
    baseMinLoot: 1,
    baseMaxLoot: 3,
  },
  dense: {
    health: 2000,
    armor: 5,
    respawn: 12,
    stunChance: 0.05,
    stunDuration: 2,
    regen: 7,
    regenInterval: 10,
    weakenChance: 0,
    weakenMulti: 1,
    weakenDuration: 0,
    dazeChance: 0,
    dazeMulti: 1,
    dazeDuration: 0,
    baseMinLoot: 1,
    baseMaxLoot: 3,
  },
  jagged: {
    health: 5000,
    armor: 10,
    respawn: 15,
    stunChance: 0.06,
    stunDuration: 3,
    regen: 10,
    regenInterval: 10,
    weakenChance: 0.02,
    weakenMulti: 0.5,
    weakenDuration: 8,
    dazeChance: 0,
    dazeMulti: 1,
    dazeDuration: 0,
    baseMinLoot: 1,
    baseMaxLoot: 3,
  },
  necrotic: {
    health: 7500,
    armor: 15,
    respawn: 20,
    stunChance: 0.08,
    stunDuration: 4,
    regen: 20,
    regenInterval: 10,
    weakenChance: 0.04,
    weakenMulti: 0.4,
    weakenDuration: 10,
    dazeChance: 0.02,
    dazeMulti: 0.5,
    dazeDuration: 5,
    baseMinLoot: 1,
    baseMaxLoot: 3,
  },
};

// ---------------------------------------------------------------------------
// Essence upgrades, in the game's order
// ---------------------------------------------------------------------------

const geo = (base: number, ratio: number) => ({ kind: 'geometric' as const, base, ratio });
const arith = (first: number, step: number) => ({ kind: 'arithmetic' as const, first, step });
const curveOn = (resource: Resource, curve: ReturnType<typeof geo> | ReturnType<typeof arith>) =>
  ({ kind: 'curve' as const, resource, curve }) as const;

/*
 * Every row after the first two unlocks at a level of the row before it
 * The game's `L + L·step` prices are arithmetic curves:
 * level 1 costs `first`.
 */
export const ESSENCE_UPGRADES: EssenceUpgradeDef[] = [
  {
    id: 'essenceMine',
    label: 'Unlock Next Essence Mine',
    max: 4,
    cost: {
      kind: 'tiered',
      tiers: [
        { ashRune: 1000 },
        { brineRune: 5000 },
        { chasmRune: 20000 },
        { driftRune: 999999999 },
      ],
      placeholderFrom: 3,
    },
    effects: [],
    note: 'Mine 3 is Necrotic Essence. Mine 4 has not been released yet; the game lists it at 999,999,999 Drift Runes, which Total Resources leaves out.',
  },
  {
    id: 'flatDamage1',
    label: 'Flat Damage +1',
    max: 25,
    cost: curveOn('whiteOrb', geo(1, 1.2)),
    effects: [{ key: 'flatDamage1', label: 'Flat Damage', perLevel: 1, display: 'flat' }],
  },
  {
    id: 'softMaxLoot',
    label: 'Soft Essence Max Loot +1',
    max: 3,
    cost: curveOn('whiteOrb', arith(10, 30)),
    requires: { id: 'flatDamage1', level: 3 },
    effects: [{ key: 'softMaxLoot', label: 'Soft Essence Max Loot', perLevel: 1, display: 'flat' }],
  },
  {
    id: 'shinyChance1',
    label: 'Shiny Chance +0.30%',
    max: 25,
    cost: curveOn('whiteOrb', geo(3, 1.2)),
    requires: { id: 'softMaxLoot', level: 1 },
    effects: [{ key: 'shinyChance1', label: 'Shiny Chance', perLevel: 0.003, display: 'percent' }],
  },
  {
    id: 'critChance1',
    label: 'Crit Chance +0.25%, Crit Damage +1%',
    max: 25,
    cost: curveOn('greenOrb', geo(2, 1.2)),
    requires: { id: 'shinyChance1', level: 3 },
    effects: [
      { key: 'critChance1', label: 'Crit Chance', perLevel: 0.0025, display: 'percent' },
      { key: 'critDamage', label: 'Crit Damage', perLevel: 0.01, display: 'percent' },
    ],
  },
  {
    id: 'flatDamage2',
    label: 'Flat Damage +1, Brittle Chance +0.15%',
    max: 25,
    cost: curveOn('greenOrb', geo(3, 1.2)),
    requires: { id: 'critChance1', level: 5 },
    effects: [
      { key: 'flatDamage2', label: 'Flat Damage', perLevel: 1, display: 'flat' },
      { key: 'brittleChance1', label: 'Brittle Chance', perLevel: 0.0015, display: 'percent' },
    ],
  },
  {
    id: 'denseMaxLoot',
    label: 'Dense Essence Max Loot +1',
    max: 3,
    cost: curveOn('greenOrb', arith(10, 30)),
    requires: { id: 'flatDamage2', level: 5 },
    effects: [
      { key: 'denseMaxLoot', label: 'Dense Essence Max Loot', perLevel: 1, display: 'flat' },
    ],
  },
  {
    id: 'armorPen',
    label: 'Essence Armor Pen +1, Attack Speed +1%',
    max: 5,
    cost: curveOn('purpleOrb', arith(5, 5)),
    requires: { id: 'denseMaxLoot', level: 1 },
    effects: [
      { key: 'armorPen', label: 'Essence Armor Pen', perLevel: 1, display: 'flat' },
      { key: 'attackSpeed', label: 'Attack Speed', perLevel: 0.01, display: 'percent' },
    ],
  },
  {
    id: 'superCrit1',
    label: 'Super Crit Chance +0.50%, Super Crit Damage +1%',
    max: 20,
    cost: curveOn('purpleOrb', geo(5, 1.2)),
    requires: { id: 'armorPen', level: 3 },
    effects: [
      { key: 'superCritChance1', label: 'Super Crit Chance', perLevel: 0.005, display: 'percent' },
      { key: 'superCritDamage', label: 'Super Crit Damage', perLevel: 0.01, display: 'percent' },
    ],
  },
  {
    id: 'flatDamage3',
    label: 'Flat Damage +1, Stun Negate Chance +2%',
    max: 10,
    cost: curveOn('purpleOrb', geo(8, 1.2)),
    requires: { id: 'superCrit1', level: 2 },
    effects: [
      { key: 'flatDamage3', label: 'Flat Damage', perLevel: 1, display: 'flat' },
      { key: 'stunNegate', label: 'Stun Negate Chance', perLevel: 0.02, display: 'percent' },
    ],
  },
  {
    id: 'damagePct',
    label: 'Flat Damage +2%',
    max: 20,
    cost: curveOn('whiteOrb', geo(3, 1.2)),
    requires: { id: 'flatDamage3', level: 2 },
    effects: [{ key: 'damagePct', label: 'Flat Damage', perLevel: 0.02, display: 'percent' }],
  },
  {
    id: 'shinyLoot',
    label: 'Shiny Essence Loot +1',
    max: 3,
    cost: curveOn('greenOrb', arith(15, 15)),
    requires: { id: 'damagePct', level: 5 },
    effects: [{ key: 'shinyLoot', label: 'Shiny Essence Loot', perLevel: 1, display: 'flat' }],
  },
  {
    id: 'shinyChance2',
    label: 'Shiny Chance +1%, Brittle Chance +1%',
    max: 3,
    cost: curveOn('purpleOrb', arith(20, 20)),
    requires: { id: 'shinyLoot', level: 1 },
    effects: [
      { key: 'shinyChance2', label: 'Shiny Chance', perLevel: 0.01, display: 'percent' },
      { key: 'brittleChance2', label: 'Brittle Chance', perLevel: 0.01, display: 'percent' },
    ],
  },
  {
    id: 'critChance2',
    label: 'Crit Chance +0.35%, Super Crit Chance +0.25%',
    max: 20,
    cost: curveOn('orangeOrb', geo(3, 1.2)),
    requires: { id: 'shinyChance2', level: 1 },
    effects: [
      { key: 'critChance2', label: 'Crit Chance', perLevel: 0.0035, display: 'percent' },
      { key: 'superCritChance2', label: 'Super Crit Chance', perLevel: 0.0025, display: 'percent' },
    ],
  },
  {
    id: 'jaggedLoot',
    label: 'Jagged Essence Min Loot +1, Jagged Essence Max Loot +1',
    max: 2,
    cost: curveOn('whiteOrb', arith(20, 20)),
    requires: { id: 'critChance2', level: 3 },
    effects: [
      { key: 'jaggedMinLoot', label: 'Jagged Essence Min Loot', perLevel: 1, display: 'flat' },
      { key: 'jaggedMaxLoot', label: 'Jagged Essence Max Loot', perLevel: 1, display: 'flat' },
    ],
  },

  // Arcanist batch 2.
  {
    id: 'regenRespawn',
    label: 'Regeneration -1, Essence Respawn Time -1s',
    max: 3,
    cost: curveOn('greenOrb', arith(15, 15)),
    requires: { id: 'jaggedLoot', level: 1 },
    effects: [
      { key: 'regenReduction', label: 'Regeneration', perLevel: 1, display: 'minus' },
      {
        key: 'respawnReduction',
        label: 'Essence Respawn Time',
        perLevel: 1,
        display: 'minusSeconds',
      },
    ],
  },
  {
    id: 'superShinyChance1',
    label: 'Super Shiny Chance +0.30%',
    max: 25,
    cost: curveOn('purpleOrb', geo(3, 1.2)),
    requires: { id: 'regenRespawn', level: 1 },
    effects: [
      { key: 'superShinyChance', label: 'Super Shiny Chance', perLevel: 0.003, display: 'percent' },
    ],
  },
  {
    id: 'flatDamageWeakenNegate',
    label: 'Flat Damage +1, Weaken Negate Chance +2%',
    max: 10,
    cost: curveOn('orangeOrb', geo(8, 1.2)),
    requires: { id: 'superShinyChance1', level: 5 },
    effects: [
      { key: 'flatDamage', label: 'Flat Damage', perLevel: 1, display: 'flat' },
      { key: 'weakenNegate', label: 'Weaken Negate Chance', perLevel: 0.02, display: 'percent' },
    ],
  },
  {
    id: 'allMaxLoot',
    label: 'All Essence Max Loot +1',
    max: 2,
    cost: curveOn('redOrb', arith(30, 30)),
    requires: { id: 'flatDamageWeakenNegate', level: 3 },
    effects: [{ key: 'allMaxLoot', label: 'All Essence Max Loot', perLevel: 1, display: 'flat' }],
  },
  {
    id: 'damagePctBrittle',
    label: 'Flat Damage +1.50%, Brittle Chance +0.15%',
    max: 15,
    cost: curveOn('greenOrb', geo(5, 1.2)),
    requires: { id: 'allMaxLoot', level: 1 },
    effects: [
      { key: 'damagePct', label: 'Flat Damage', perLevel: 0.015, display: 'percent' },
      { key: 'brittleChance', label: 'Brittle Chance', perLevel: 0.0015, display: 'percent' },
    ],
  },
  {
    id: 'superShinyLoot',
    label: 'Super Shiny Essence Loot +2',
    max: 2,
    cost: curveOn('purpleOrb', arith(25, 25)),
    requires: { id: 'damagePctBrittle', level: 5 },
    effects: [
      { key: 'superShinyLoot', label: 'Super Shiny Essence Loot', perLevel: 2, display: 'flat' },
    ],
  },
  {
    id: 'critChanceUltraCrit',
    label: 'Crit Chance +0.35%, Ultra Crit Chance +0.25%',
    max: 20,
    cost: curveOn('redOrb', geo(3, 1.2)),
    requires: { id: 'superShinyLoot', level: 1 },
    effects: [
      { key: 'critChance', label: 'Crit Chance', perLevel: 0.0035, display: 'percent' },
      { key: 'ultraCritChance', label: 'Ultra Crit Chance', perLevel: 0.0025, display: 'percent' },
    ],
  },
  {
    id: 'critDamageAttackSpeed',
    label: 'Crit Damage +2%, Attack Speed +0.50%',
    max: 10,
    cost: curveOn('whiteOrb', geo(12, 1.2)),
    requires: { id: 'critChanceUltraCrit', level: 5 },
    effects: [
      { key: 'critDamage', label: 'Crit Damage', perLevel: 0.02, display: 'percent' },
      { key: 'attackSpeed', label: 'Attack Speed', perLevel: 0.005, display: 'percent' },
    ],
  },
  {
    id: 'allMinLoot',
    label: 'All Essence Min Loot +1',
    max: 2,
    cost: curveOn('orangeOrb', arith(50, 50)),
    requires: { id: 'critDamageAttackSpeed', level: 3 },
    effects: [{ key: 'allMinLoot', label: 'All Essence Min Loot', perLevel: 1, display: 'flat' }],
  },
  {
    id: 'flatDamageDebuffNegate',
    label: 'Flat Damage +2, All Debuff Negate Chance +0.35%',
    max: 15,
    cost: curveOn('yellowOrb', geo(5, 1.2)),
    requires: { id: 'allMinLoot', level: 1 },
    effects: [
      { key: 'flatDamage', label: 'Flat Damage', perLevel: 2, display: 'flat' },
      {
        key: 'debuffNegate',
        label: 'All Debuff Negate Chance',
        perLevel: 0.0035,
        display: 'percent',
      },
    ],
  },
  {
    id: 'critChanceRespawn',
    label: 'Crit Chance +4%, Respawn Time -1s',
    max: 2,
    cost: curveOn('greenOrb', arith(40, 40)),
    requires: { id: 'flatDamageDebuffNegate', level: 5 },
    effects: [
      { key: 'critChance', label: 'Crit Chance', perLevel: 0.04, display: 'percent' },
      { key: 'respawnReduction', label: 'Respawn Time', perLevel: 1, display: 'minusSeconds' },
    ],
  },
  {
    id: 'superCritDamageDazeNegate',
    label: 'Super Crit Damage +3%, Daze Negate Chance +2%',
    max: 10,
    cost: curveOn('purpleOrb', geo(12, 1.2)),
    requires: { id: 'critChanceRespawn', level: 1 },
    effects: [
      { key: 'superCritDamage', label: 'Super Crit Damage', perLevel: 0.03, display: 'percent' },
      { key: 'dazeNegate', label: 'Daze Negate Chance', perLevel: 0.02, display: 'percent' },
    ],
  },
  {
    id: 'shinyChanceUltraShiny',
    label: 'Shiny Chance +0.30%, Ultra Shiny Chance +0.40%',
    max: 20,
    cost: curveOn('redOrb', geo(10, 1.2)),
    requires: { id: 'superCritDamageDazeNegate', level: 3 },
    effects: [
      { key: 'shinyChance', label: 'Shiny Chance', perLevel: 0.003, display: 'percent' },
      { key: 'ultraShinyChance', label: 'Ultra Shiny Chance', perLevel: 0.004, display: 'percent' },
    ],
  },
  {
    id: 'allShinyLoot',
    label: 'All Shiny Essence Loot +1',
    max: 3,
    cost: curveOn('yellowOrb', arith(30, 30)),
    requires: { id: 'shinyChanceUltraShiny', level: 5 },
    effects: [
      { key: 'allShinyLoot', label: 'All Shiny Essence Loot', perLevel: 1, display: 'flat' },
    ],
  },
  {
    id: 'damagePctArmorPen',
    label: 'Flat Damage +3%, Essence Armor Pen +2',
    max: 5,
    cost: curveOn('whiteOrb', arith(20, 15)),
    requires: { id: 'allShinyLoot', level: 1 },
    effects: [
      { key: 'damagePct', label: 'Flat Damage', perLevel: 0.03, display: 'percent' },
      { key: 'armorPen', label: 'Essence Armor Pen', perLevel: 2, display: 'flat' },
    ],
  },
  {
    id: 'superCritDamageStunNegate',
    label: 'Super Crit Damage +4%, Stun Negate Chance +1.50%',
    max: 15,
    cost: curveOn('orangeOrb', geo(10, 1.2)),
    requires: { id: 'damagePctArmorPen', level: 2 },
    effects: [
      { key: 'superCritDamage', label: 'Super Crit Damage', perLevel: 0.04, display: 'percent' },
      { key: 'stunNegate', label: 'Stun Negate Chance', perLevel: 0.015, display: 'percent' },
    ],
  },
  {
    id: 'flatDamageSuperCrit',
    label: 'Flat Damage +4, Super Crit Chance +2%',
    max: 5,
    cost: curveOn('yellowOrb', arith(20, 15)),
    requires: { id: 'superCritDamageStunNegate', level: 5 },
    effects: [
      { key: 'flatDamage', label: 'Flat Damage', perLevel: 4, display: 'flat' },
      { key: 'superCritChance', label: 'Super Crit Chance', perLevel: 0.02, display: 'percent' },
    ],
  },
  {
    id: 'critDamageUltraCrit',
    label: 'Crit Damage +2.50%, Ultra Crit Chance +0.25%',
    max: 20,
    cost: curveOn('whiteOrb', geo(15, 1.2)),
    requires: { id: 'flatDamageSuperCrit', level: 2 },
    effects: [
      { key: 'critDamage', label: 'Crit Damage', perLevel: 0.025, display: 'percent' },
      { key: 'ultraCritChance', label: 'Ultra Crit Chance', perLevel: 0.0025, display: 'percent' },
    ],
  },
  {
    id: 'superShinyChanceAttackSpeed',
    label: 'Super Shiny Chance +0.40%, Attack Speed +0.20%',
    max: 20,
    cost: curveOn('yellowOrb', geo(8, 1.2)),
    requires: { id: 'critDamageUltraCrit', level: 5 },
    effects: [
      { key: 'superShinyChance', label: 'Super Shiny Chance', perLevel: 0.004, display: 'percent' },
      { key: 'attackSpeed', label: 'Attack Speed', perLevel: 0.002, display: 'percent' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Altars
// ---------------------------------------------------------------------------

/**
 * The game prices altar capacity and travel at a flat amount
 * per level, and craft multi at `craftFirst + craftStep × level`.
 */
const altarUpgrades = (
  capacityResource: Resource,
  capacityPer: number,
  travelResource: Resource,
  travelPer: number,
  craftResource: Resource,
  craftFirst: number,
  craftStep: number,
) => [
  {
    key: 'capacity' as const,
    label: 'Capacity',
    max: 25,
    resource: capacityResource,
    curve: arith(capacityPer, 0),
  },
  {
    key: 'travel' as const,
    label: 'Travel Time',
    max: 10,
    resource: travelResource,
    curve: arith(travelPer, 0),
  },
  {
    key: 'craft' as const,
    label: 'Craft Multi',
    max: 10,
    resource: craftResource,
    curve: arith(craftFirst, craftStep),
  },
];

/**
 * `baseCycle` and `consumes` are the altar's own cycle time and essence. The Flora and
 * Ghost altars are not released yet, so they are not
 * modelled.
 */
export const ALTARS: Record<AltarId, AltarDef> = {
  ash: {
    id: 'ash',
    label: 'Ash Altar',
    baseCycle: 60,
    rune: 'ashRune',
    consumes: 'soft',
    unlockCost: {},
    upgrades: altarUpgrades('whiteOrb', 3, 'whiteOrb', 4, 'whiteOrb', 10, 3),
  },
  brine: {
    id: 'brine',
    label: 'Brine Altar',
    baseCycle: 90,
    rune: 'brineRune',
    consumes: 'soft',
    unlockCost: { ashRune: 1000 },
    upgrades: altarUpgrades('whiteOrb', 4, 'whiteOrb', 5, 'greenOrb', 10, 3),
  },
  chasm: {
    id: 'chasm',
    label: 'Chasm Altar',
    baseCycle: 120,
    rune: 'chasmRune',
    consumes: 'dense',
    unlockCost: { ashRune: 5000, brineRune: 2500 },
    upgrades: altarUpgrades('whiteOrb', 5, 'greenOrb', 5, 'purpleOrb', 10, 3),
  },
  drift: {
    id: 'drift',
    label: 'Drift Altar',
    baseCycle: 150,
    rune: 'driftRune',
    consumes: 'dense',
    unlockCost: { ashRune: 20000, brineRune: 15000, chasmRune: 10000 },
    upgrades: altarUpgrades('greenOrb', 7, 'purpleOrb', 8, 'orangeOrb', 11, 4),
  },
  echo: {
    id: 'echo',
    label: 'Echo Altar',
    baseCycle: 180,
    rune: 'echoRune',
    consumes: 'jagged',
    unlockCost: { brineRune: 100000, chasmRune: 75000, driftRune: 25000 },
    upgrades: altarUpgrades('purpleOrb', 9, 'orangeOrb', 10, 'redOrb', 12, 4),
  },
};

export const ALTAR_IDS: readonly AltarId[] = ['ash', 'brine', 'chasm', 'drift', 'echo'];

/** Per level: travel time reduces cycle length, craft multi raises output. */
export const ALTAR_TRAVEL_PER_LEVEL = 0.05;
export const ALTAR_CRAFT_PER_LEVEL = 0.2;

// ---------------------------------------------------------------------------
// Spells
// ---------------------------------------------------------------------------

/*
 * Potency, cast costs, mana, duration and effect bases are the game's. The
 * primary effect is the spell's active base and the secondary its passive
 * base. The game states no spell level cap; 50 is used for all.
 */
export const SPELLS: Record<SpellId, SpellDef> = {
  runicSurge: {
    id: 'runicSurge',
    label: 'Runic Surge',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'ashRune',
    potencyCurve: geo(2000, 1.25),
    primary: { label: 'Drone Exp Gain', base: 0.15, display: 'percent' },
    secondary: {
      label: 'Essence Shiny Chance',
      base: 0.01,
      display: 'percent',
      feedsBack: true,
    },
    castCost: { ashRune: 5, brineRune: 1 },
    manaCost: 1,
    durationBase: 300,
  },
  rainbowRift: {
    id: 'rainbowRift',
    label: 'Rainbow Rift',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'brineRune',
    potencyCurve: geo(3500, 1.25),
    primary: { label: 'Rainbow Portal Multi', base: 0.2, display: 'percent' },
    secondary: { label: 'Void Portal Chance', base: 0.01, display: 'percent' },
    castCost: { ashRune: 16, brineRune: 8 },
    manaCost: 3,
    durationBase: 300,
  },
  manaflow: {
    id: 'manaflow',
    label: 'Manaflow',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'chasmRune',
    potencyCurve: geo(2500, 1.25),
    primary: { label: 'Mana Regeneration', base: 0.25, display: 'percent' },
    secondary: { label: 'Mana Capacity', base: 0.15, display: 'percent' },
    castCost: { brineRune: 15, chasmRune: 5 },
    manaCost: 4,
    durationBase: 480,
  },
  radiancy: {
    id: 'radiancy',
    label: 'Radiancy',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'ashRune',
    potencyCurve: geo(4000, 1.25),
    primary: { label: 'Star Radiant Chance', base: 0.03, display: 'percent' },
    secondary: { label: 'Star Radiant Multi', base: 0.1, display: 'percent' },
    castCost: { ashRune: 25, brineRune: 10 },
    manaCost: 4,
    durationBase: 360,
  },
  prismism: {
    id: 'prismism',
    label: 'Prismism',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'brineRune',
    potencyCurve: geo(2750, 1.25),
    primary: { label: 'Prismatic Floor Chance', base: 0.07, display: 'percent' },
    secondary: {
      label: 'Rune Craft Multi',
      base: 0.15,
      display: 'percent',
      feedsBack: true,
    },
    castCost: { ashRune: 12, brineRune: 12 },
    manaCost: 3,
    durationBase: 400,
  },
  veinboyant: {
    id: 'veinboyant',
    label: 'Veinboyant',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'brineRune',
    potencyCurve: geo(4000, 1.25),
    primary: { label: 'Rainbow Vein Chance', base: 0.05, display: 'percent' },
    secondary: { label: 'Rainbow Vein Multi', base: 0.15, display: 'percent' },
    castCost: { ashRune: 20, brineRune: 10 },
    manaCost: 3,
    durationBase: 360,
  },
  diggyDiggyHole: {
    id: 'diggyDiggyHole',
    label: 'Diggy Diggy Hole',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'chasmRune',
    potencyCurve: geo(4000, 1.25),
    primary: { label: 'Pickaxe Damage', base: 1.2, display: 'percent' },
    secondary: { label: 'Arch Fragment Gain', base: 0.15, display: 'percent' },
    castCost: { brineRune: 15, chasmRune: 10 },
    manaCost: 4,
    durationBase: 200,
  },
  blueGiant: {
    id: 'blueGiant',
    label: 'Blue Giant',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'chasmRune',
    potencyCurve: geo(10000, 1.25),
    primary: { label: 'Super Star Supergiant Chance', base: 0.03, display: 'percent' },
    secondary: { label: 'All Supergiant Multi', base: 0.1, display: 'percent' },
    castCost: { chasmRune: 30, driftRune: 5 },
    manaCost: 5,
    durationBase: 220,
  },
  draconicHoard: {
    id: 'draconicHoard',
    label: 'Draconic Hoard',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'driftRune',
    potencyCurve: geo(8500, 1.25),
    primary: { label: 'Gems from Freebie', base: 0.25, display: 'percent' },
    secondary: { label: 'Golden Ore Multi', base: 0.05, display: 'percent' },
    castCost: { ashRune: 80, driftRune: 20 },
    manaCost: 7,
    durationBase: 180,
  },
  rainbowRoad: {
    id: 'rainbowRoad',
    label: 'Rainbow Road',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'echoRune',
    potencyCurve: geo(5500, 1.25),
    primary: { label: 'Rainbow Ore Multi', base: 0.12, display: 'percent' },
    secondary: { label: 'Rainbow Ore Chance', base: 0.06, display: 'percent' },
    castCost: { driftRune: 20, echoRune: 15 },
    manaCost: 5,
    durationBase: 240,
  },
  partyFever: {
    id: 'partyFever',
    label: 'Party Fever',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'echoRune',
    potencyCurve: geo(6500, 1.25),
    primary: { label: 'Gleaming Vein Chance', base: 0.05, display: 'percent' },
    secondary: { label: 'Party Wizard Multi', base: 0.03, display: 'percent' },
    castCost: { brineRune: 75, echoRune: 15 },
    manaCost: 6,
    durationBase: 200,
  },
  bombsBlessing: {
    id: 'bombsBlessing',
    label: "Bomb's Blessing",
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'driftRune',
    potencyCurve: geo(9500, 1.25),
    primary: { label: 'All Floor Multi', base: 0.025, display: 'percent' },
    secondary: { label: 'Bomb Recharge Speed', base: 0.03, display: 'percent' },
    castCost: { chasmRune: 40, driftRune: 25 },
    manaCost: 7,
    durationBase: 160,
  },
  bugMagnet: {
    id: 'bugMagnet',
    label: 'Bug Magnet',
    maxLevel: 50,
    maxRank: 10,
    potencyResource: 'brineRune',
    potencyCurve: geo(12500, 1.25),
    primary: { label: 'Coal Production', base: 0.09, display: 'percent' },
    secondary: { label: 'Banked Lootbug Cap', base: 0.1, display: 'percent' },
    castCost: { brineRune: 40, driftRune: 10 },
    manaCost: 3,
    durationBase: 280,
  },
};

export const SPELL_IDS: readonly SpellId[] = [
  'runicSurge',
  'rainbowRift',
  'manaflow',
  'radiancy',
  'prismism',
  'veinboyant',
  'diggyDiggyHole',
  'blueGiant',
  'draconicHoard',
  'rainbowRoad',
  'partyFever',
  'bombsBlessing',
  'bugMagnet',
];

/** Each spell level adds this share of the base effect. */
export const SPELL_EFFECT_PER_LEVEL = 0.05;

/**
 * Each potency rank adds this share to the spell's effect, its duration and
 * its level-up chance (`spell_chance_multi = (1 + 0.05 × potency) ×
 * statSpellLevelUpMulti`). Cast cost does not scale with it.
 */
export const POTENCY_PER_RANK = 0.05;

// ---------------------------------------------------------------------------
// Exchange
// ---------------------------------------------------------------------------

/**
 * Only the Exchange upgrades that change an Arcanist number — see
 * ExchangeUpgradeId for why the rest are not here. The game's ids are 12, 9,
 * 27 and 35. They are bought with resources from elsewhere in the game that
 * this app does not track, so they carry no cost.
 */
export const EXCHANGE_UPGRADES: ExchangeUpgradeDef[] = [
  {
    id: 'arcaneCardDamage',
    label: 'Essence Damage +1 Per Arcanist Card Tier Owned',
    max: 1,
    note: 'Grants flat damage equal to the number of Arcanist card tiers you own (see Cards).',
  },
  {
    id: 'runeCraftMulti',
    label: 'Rune Craft Multi +1%',
    max: 15,
    effectLabel: 'Rune Craft Multi',
    perLevel: 0.01,
    display: 'percent',
  },
  {
    id: 'spellPower',
    label: 'Arcanist Spell Power +0.50%',
    max: 15,
    effectLabel: 'Arcanist Spell Power',
    perLevel: 0.005,
    display: 'percent',
  },
  {
    id: 'runePolychromeCard',
    label: 'Poly Rune Multi +2%',
    max: 20,
    effectLabel: 'Poly Rune Multi',
    perLevel: 0.02,
    display: 'percent',
    note: "Adds to a Polychrome Rune card's craft multiplier: +50% becomes +90% at max level. It has no effect on lower tiers.",
  },
];

// ---------------------------------------------------------------------------
// External bonuses
// ---------------------------------------------------------------------------

/** The Rhino, the Arcanist's pet. */
export const PET = {
  maxLevel: 20,
  /** Essence Brittle Chance per level. */
  brittlePerLevel: 0.01,
  /** The Rhino Skin's flat Essence Max Loot bonus. */
  skinMaxLoot: 1,
  maxQuestLevel: 11,
  /** (level * step) + step, so level 0 already grants one step and level 11 grants twelve. */
  questShinyPerStep: 0.005,
  questSpellPowerPerStep: 0.015,
} as const;

/** One-off account unlocks. */
export const UNLOCKS = {
  worldQuest25Shiny: 0.01,
  worldQuest29SuperShiny: 0.02,
  /** Straight Outta Yanille. Its mana regen bonus is not modelled. */
  yanilleShiny: 0.01,
  yanilleBrittle: 0.01,
  /** Arcanist Bundle. Its wizard loot bonus is not modelled. */
  bundleShiny: 0.02,
  bundleBrittle: 0.02,
  bundleRuneCraft: 0.1,
  /** Spellslinger Bundle. */
  spellslingerSpellDuration: 0.1,
  spellslingerSpellPower: 0.05,
  spellslingerLevelUpChance: 0.1,
  /** Per W4 gilded statue, gated on the gilded Statue of Nature. */
  statueSuperShinyPerStatue: 0.01,
  /** Nine gildable statues in W4, the Statue of Nature itself included. */
  maxW4GildedStatues: 9,
  /** Black Hole Level 30. */
  blackHole30SpellPower: 0.1,
  /** Divine Challenge 24. */
  divineChallenge24SpellPower: 0.04,
  /** Hydra Star, per level. */
  hydraStarSpellPowerPerLevel: 0.0025,
  maxHydraStarLevel: 50,
} as const;

/** Rune Craft Multi contract. */
export const CONTRACT_RUNE_CRAFT = {
  maxLevel: 19,
  perLevel: 0.005,
} as const;

// ---------------------------------------------------------------------------
// Wizard Exchange
// ---------------------------------------------------------------------------

/**
 * Wizard Exchange offer rules, as the game builds them.
 *
 * Arrays indexed by orb colour run White, Green, Purple, Orange, Red, Yellow.
 * Arrays indexed by cost category follow the game's own twelve:
 * 0 Stars, 1 Bars, 2 Veins, 3 Fragments, 4 Fish, 5 Gems, 6 PP, 7 Essence,
 * 8 Runes, 9 common items, 10 food, 11 rare (tier 3) items.
 */
export const WIZARD = {
  /** Seconds to bank a refresh: 2 hours minus 2 minutes per Exchange Timer level. */
  refreshBaseSeconds: 7200,
  refreshSecondsPerLevel: 120,
  maxTimerLevel: 30,
  polyOrbPerLevel: 0.025,
  maxPolyOrbLevel: 10,
  minWizards: 6,
  maxWizards: 9,

  colourWeights: [40, 30, 25, 20, 15, 10],
  /** Orbs of the previous colour that must be traded before this colour appears. */
  unlockGates: [0, 100, 150, 150, 150, 150],

  costBase: [1, 1.05, 1.125, 1.2, 1.3, 1.425],
  costAmp: [1.001, 1.0012, 1.0015, 1.0018, 1.002, 1.0025],
  costScale: [0.0015, 0.001875, 0.0024, 0.003375, 0.0045, 0.006],
  orbCountMaxed: [857, 643, 535, 429, 321, 214],
  scalingThreshold: 3000,

  /** Slot 1 tier pick: weights over picks, gated by trades. */
  tradesPerEssenceTier: 100,
  essenceTierWeights: [50, 30, 20, 0],
  runeChance: 0.3,
  /** The unseeded essence divisor, 1 / U(1.5, 2). Runes use ×2 instead. */
  essenceDivisorMin: 1.5,
  essenceDivisorMax: 2,
  runeMulti: 2,
  /** A Jagged/Chasm ask pays this much more. */
  tier2RewardMulti: 1.2,

  categoryWeights: [10, 8, 10, 10, 10, 10, 4, 0, 0, 10, 5, 1],
  categoryResourceMulti: [5e13, 5e43, 2e19, 25000, 2e12, 75000, 1e25, 1, 1, 25000, 2500, 1],

  /** A Large Resource Pack bundle: 100 packs for this many gems. */
  gemsPer100LargePacks: 37500,

  /** Offers sampled per colour when building the distribution. */
  samplesPerColour: 4000,
} as const;

export type WizardItemTier = 'commonItems' | 'food' | 'rareItems';

export interface WizardItem {
  id: string;
  name: string;
  /** The most one trade can ask, before the ±5% roll. Null when it always asks exactly one. */
  cap: number | null;
}

/**
 * The items each item tier can ask, with their caps.
 *
 * Tier 1 asks are capped at 40,000 and Tier 2 at 30,000, each ×0.95–1.05, and
 * then some items divide that down. Below the cap the ask grows with your
 * trades, so early offers ask less. Tier 3 items always ask exactly one.
 * Sushi appears in the game's Tier 2 list but can never be picked.
 */
export const WIZARD_ITEMS: Record<WizardItemTier, readonly WizardItem[]> = {
  commonItems: [
    { id: 'apple', name: 'Apple', cap: 40000 },
    { id: 'bananaCoffee', name: 'Banana Coffee', cap: 40000 },
    { id: 'rockCake', name: 'Rock Cake', cap: 20000 },
    { id: 'primalMeat', name: 'Primal Meat', cap: 10000 },
    { id: 'bread', name: 'Bread', cap: 40000 },
    { id: 'pike', name: 'Pike', cap: 40000 },
    { id: 'juicyPlums', name: 'Juicy Plums', cap: 20000 },
    { id: 'strawberries', name: 'Strawberries', cap: 10000 },
    { id: 'chargeMagnet', name: 'Charge Magnet', cap: 10000 },
    { id: 'chaosTotem', name: 'Chaos Totem', cap: 20000 },
    { id: 'droneJuice', name: 'Drone Juice', cap: 40000 },
    { id: 'eyeOfNewt', name: 'Eye of Newt', cap: 40000 },
  ],
  food: [
    { id: 'hamburger', name: 'Hamburger', cap: 30000 },
    { id: 'starfruit', name: 'Starfruit', cap: 30000 },
    { id: 'rainbowLollipop', name: 'Rainbow Lollipop', cap: 750 },
    { id: 'lasagna', name: 'Lasagna', cap: 30000 },
    { id: 'iceCream', name: 'Ice Cream', cap: 30000 },
    { id: 'blueCow', name: 'Blue Cow', cap: 3000 },
  ],
  rareItems: [
    { id: 'lootbugLantern', name: 'Lootbug Lantern', cap: null },
    { id: 'frogspawn', name: 'Frogspawn', cap: null },
    { id: 'goldFlakeSteak', name: 'Gold Flake Steak', cap: null },
    { id: 'cosmicCandy', name: 'Cosmic Candy', cap: null },
  ],
};
