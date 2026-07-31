/**
 * The state of the Arcanist sheet in the source workbook.
 *
 * This doubles as the golden-test input: engine.test.ts asserts that computing
 * from these values reproduces the workbook's cached cell values. Do not edit
 * without regenerating the fixture from the same workbook.
 */

import type { ArcanistInput } from '../calc/types';

export const EXAMPLE_INPUT: ArcanistInput = {
  essence: {
    essenceMine: 2, // A4
    flatDamage1: 17, // A5
    softMaxLoot: 2, // A6
    shinyChance1: 7, // A7
    critChance1: 9, // A8
    flatDamage2: 12, // A10
    denseMaxLoot: 1, // A12
    armorPen: 5, // A13
    superCrit1: 2, // A14
    flatDamage3: 4, // A16
    damagePct: 10, // A18
    shinyLoot: 1, // A19
    shinyChance2: 1, // A20
    critChance2: 7, // A22
    jaggedLoot: 1, // A24
  },
  altars: {
    ash: { unlocked: true, active: false, capacity: 8, travel: 10, craft: 4 }, // K27, A29:A31
    brine: { unlocked: true, active: true, capacity: 5, travel: 10, craft: 3 }, // A33, K32, A34:A36
    chasm: { unlocked: true, active: false, capacity: 5, travel: 10, craft: 0 }, // A38, K37, A39:A41
  },
  spells: {
    runicSurge: { unlocked: true, level: 13, rank: 10 }, // A43, A45, A46
    rainbowRift: { unlocked: true, level: 1, rank: 2 }, // A48, A49, A50
    manaflow: { unlocked: true, level: 1, rank: 0 }, // A52, A53, A54
    radiancy: { unlocked: true, level: 3, rank: 0 }, // A56, A57, A58
    prismism: { unlocked: true, level: 1, rank: 4 }, // A60, A61, A62
    veinboyant: { unlocked: false, level: 0, rank: 0 }, // A64
  },
  exchange: {
    exchangeWizards: 3, // A69
    exchangeTimer: 15, // A70
    arcaneCardDamage: 1, // A71
    rainbowFloorMulti: 11, // A72
    lootbugBankedCap: 3, // A73
    goldenPortalChance: 10, // A74
    starSupergiantMulti: 0, // A75
    wizardLootMulti: 0, // A76
    geminiStarCap: 0, // A77
    unlockVeinboyant: 0, // A78
    prismaticFloorChance: 0, // A79
    shinyFishMulti: 0, // A80
    runeCraftMulti: 0, // A81
  },
  external: {
    cardRainbowMultiplier: 3.9159538438466259, // Cards!X13
    cardSoftMaxLoot: 'gold', // Cards!K422 = 4
    cardDenseMaxLoot: 'bronze', // Cards!K423 = 1
    cardJaggedMaxLoot: 'bronze', // Cards!K424 = 1
    cardAshCraft: 'gold', // Cards!K429 = 0.5
    cardBrineCraft: 'silver', // Cards!K430 = 0.3
    cardChasmCraft: 'none', // Cards!K431 = 0
    cardSpell: {
      runicSurge: 'silver', // Cards!K438 = 0.2
      rainbowRift: 'silver', // Cards!K439 = 0.2
      manaflow: 'bronze', // Cards!K440 = 0.1
      radiancy: 'none', // Cards!K441 = 0
      prismism: 'none', // Cards!K442 = 0
      veinboyant: 'none', // Cards!K443 = 0
    },
    cardSuperShiny: 'none', // Cards!K282 = 0
    arcaneCardCount: 20, // Cards!K456
    petMaxEssence: false, // Pets!E57 = 0
    petBrittle: 0.05, // Pets!E38
    petShiny: 0, // Pets!E108
    petSpellPotency: 0, // Pets!E109
    obeliskShiny: false, // Obelisks!H28 = 0
    obeliskSuperShiny: false, // Obelisks!H32 = 0
    skillShiny: false, // Skills!D158 = 0
    skillBrittle: false, // Skills!D159 = 0
    storeShiny: false, // Store!J111 = 0
    constructSuperShiny: 0, // Construct!M352 = 0
    contractRuneCraft: 0.08, // Contracts!D45 (Statmath!F372 = 1.08)
    storeRuneCraft: 0, // Store!J112 (Statmath!J372 = 1)
    spellDurationMulti: 1, // Statmath!C368
  },
};
