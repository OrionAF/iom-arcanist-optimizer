import type { ArcanistInput, ExternalBonuses, WizardInput } from '../calc/types';

const LOCKED_ALTAR = { unlocked: false, active: false, capacity: 0, travel: 0, craft: 0 };
const LOCKED_SPELL = { unlocked: false, level: 0, rank: 0 };

/** A fresh account: no cards, no pet, nothing unlocked. */
export const FRESH_EXTERNAL: ExternalBonuses = {
  cards: {
    essence: { soft: 'none', dense: 'none', jagged: 'none', necrotic: 'none' },
    rune: { ash: 'none', brine: 'none', chasm: 'none', drift: 'none', echo: 'none' },
    spell: {
      runicSurge: 'none',
      rainbowRift: 'none',
      manaflow: 'none',
      radiancy: 'none',
      prismism: 'none',
      veinboyant: 'none',
      diggyDiggyHole: 'none',
      blueGiant: 'none',
      draconicHoard: 'none',
      rainbowRoad: 'none',
      partyFever: 'none',
      bombsBlessing: 'none',
      bugMagnet: 'none',
    },
    orb: {
      white: 'none',
      green: 'none',
      purple: 'none',
      orange: 'none',
      red: 'none',
      yellow: 'none',
    },
  },
  pets: {
    rhinoLevel: 0,
    rhinoSkin: false,
    rhinoQuestSkin: false,
    rhinoQuestLevel: 0,
    rhinoCard: 'none',
    rhinoInfernalUltraShiny: 0,
  },
  unlocks: {
    worldQuest25: false,
    worldQuest29: false,
    straightOuttaYanille: false,
    arcanistBundle: false,
    spellslingerBundle: false,
    statueOfNatureGilded: false,
    w4GildedStatues: 0,
    blackHole30: false,
    divineChallenge23: false,
    hydraStarLevel: 0,
  },
  contractRuneCraftLevel: 0,
};

const NO_ORBS = { white: 0, green: 0, purple: 0, orange: 0, red: 0, yellow: 0 };

/**
 * Wizard Exchange at its base stats. Disco and Flashbang start at 0.1%; the
 * Currency Preference order is only a starting point for the player to drag.
 */
export const FRESH_WIZARD: WizardInput = {
  lootMulti: 1,
  partyChance: 0,
  partyMulti: 3,
  blindChance: 0,
  discoChance: 0.1,
  flashbangChance: 0.1,
  wizardCount: 6,
  exchangeTimerLevel: 0,
  polyOrbLevel: 0,
  comfortHours: 1,
  ppPer100Packs: 0,
  preference: [
    'stars',
    'bars',
    'veins',
    'fish',
    'commonItems',
    'food',
    'gems',
    'fragments',
    'rareItems',
  ],
  // Both bars start out of the way, so the order alone spaces the rows evenly.
  negligibleBar: 0,
  gapBar: 9,
  traded: { ...NO_ORBS },
};

/** A freshly unlocked Arcanist: nothing bought, nothing unlocked. */
export const FRESH_INPUT: ArcanistInput = {
  essence: {
    essenceMine: 0,
    flatDamage1: 0,
    softMaxLoot: 0,
    shinyChance1: 0,
    critChance1: 0,
    flatDamage2: 0,
    denseMaxLoot: 0,
    armorPen: 0,
    superCrit1: 0,
    flatDamage3: 0,
    damagePct: 0,
    shinyLoot: 0,
    shinyChance2: 0,
    critChance2: 0,
    jaggedLoot: 0,
    regenRespawn: 0,
    superShinyChance1: 0,
    flatDamageWeakenNegate: 0,
    allMaxLoot: 0,
    damagePctBrittle: 0,
    superShinyLoot: 0,
    critChanceUltraCrit: 0,
    critDamageAttackSpeed: 0,
    allMinLoot: 0,
    flatDamageDebuffNegate: 0,
    critChanceRespawn: 0,
    superCritDamageDazeNegate: 0,
    shinyChanceUltraShiny: 0,
    allShinyLoot: 0,
    damagePctArmorPen: 0,
    superCritDamageStunNegate: 0,
    flatDamageSuperCrit: 0,
    critDamageUltraCrit: 0,
    superShinyChanceAttackSpeed: 0,
  },
  altars: {
    // The Ash Altar has no unlock cost; it is available from the start.
    ash: { ...LOCKED_ALTAR, unlocked: true },
    brine: { ...LOCKED_ALTAR },
    chasm: { ...LOCKED_ALTAR },
    drift: { ...LOCKED_ALTAR },
    echo: { ...LOCKED_ALTAR },
  },
  spells: {
    runicSurge: { ...LOCKED_SPELL },
    rainbowRift: { ...LOCKED_SPELL },
    manaflow: { ...LOCKED_SPELL },
    radiancy: { ...LOCKED_SPELL },
    prismism: { ...LOCKED_SPELL },
    veinboyant: { ...LOCKED_SPELL },
    diggyDiggyHole: { ...LOCKED_SPELL },
    blueGiant: { ...LOCKED_SPELL },
    draconicHoard: { ...LOCKED_SPELL },
    rainbowRoad: { ...LOCKED_SPELL },
    partyFever: { ...LOCKED_SPELL },
    bombsBlessing: { ...LOCKED_SPELL },
    bugMagnet: { ...LOCKED_SPELL },
  },
  exchange: {
    arcaneCardDamage: 0,
    runeCraftMulti: 0,
    spellPower: 0,
    runePolychromeCard: 0,
  },
  external: FRESH_EXTERNAL,
  // Soft is the only essence a fresh Arcanist can actually break.
  mining: 'soft',
  wizard: FRESH_WIZARD,
};
