/**
 * Game icons, vendored from the Idle Obelisk Miner wiki into public/icons/.
 *
 * They are served from this origin rather than hotlinked: the set is only
 * ~300 KB, and hotlinking would leave the whole UI dependent on a third-party
 * host staying up and permitting it.
 *
 * Sources are recorded in ICON-CREDITS.md. To add one, drop the PNG in
 * public/icons/ and add a line here — the key is what the UI refers to.
 */

import type {
  AltarId,
  EssenceType,
  EssenceUpgradeId,
  ExchangeUpgradeId,
  OfferCategory,
  OrbCardId,
  Resource,
  RhinoCardTier,
  SpellId,
} from '../calc/types';

/** Vite serves public/ at the configured base path. */
const base = `${import.meta.env.BASE_URL}icons/`;
const icon = (file: string) => `${base}${file}`;

export const ESSENCE_ICONS: Record<EssenceType, string> = {
  soft: icon('Soft_Essence.png'),
  dense: icon('Dense_Essence.png'),
  jagged: icon('Jagged_Essence.png'),
  necrotic: icon('Necrotic_Essence.png'),
};

export const SECTION_ICONS = {
  essence: icon('Essence.png'),
  spells: icon('Spells.png'),
  altars: icon('Altars.png'),
  exchange: icon('Exchange_Wizard.png'),
  cards: icon('Card_Backing_Polychrome.png'),
  pets: icon('Rhino_Default.png'),
  unlocks: icon('Spell_Unlock.png'),
} as const;

/** Only resources the Arcanist can actually spend have icons. */
export const RESOURCE_ICONS: Partial<Record<Resource, string>> = {
  whiteOrb: icon('White_Orb.png'),
  greenOrb: icon('Green_Orb.png'),
  purpleOrb: icon('Purple_Orb.png'),
  orangeOrb: icon('Orange_Orb.png'),
  redOrb: icon('Red_Orb.png'),
  yellowOrb: icon('Yellow_Orb.png'),
  ashRune: icon('Ash_Rune.png'),
  brineRune: icon('Brine_Rune.png'),
  chasmRune: icon('Chasm_Rune.png'),
  driftRune: icon('Drift_Rune.png'),
  echoRune: icon('Echo_Rune.png'),
  softEssence: icon('Soft_Essence.png'),
  denseEssence: icon('Dense_Essence.png'),
};

export const ALTAR_ICONS: Record<AltarId, string> = {
  ash: icon('Ash_Rune.png'),
  brine: icon('Brine_Rune.png'),
  chasm: icon('Chasm_Rune.png'),
  drift: icon('Drift_Rune.png'),
  echo: icon('Echo_Rune.png'),
};

/** The spell item itself, shown on the spell rows you have unlocked. */
export const SPELL_ICONS: Record<SpellId, string> = {
  runicSurge: icon('Runic_Surge_Spell.png'),
  rainbowRift: icon('Rainbow_Rift_Spell.png'),
  manaflow: icon('Manaflow_Spell.png'),
  radiancy: icon('Radiancy_Spell.png'),
  prismism: icon('Prismism_Spell.png'),
  veinboyant: icon('Veinboyant_Spell.png'),
  diggyDiggyHole: icon('Diggy_Diggy_Hole_Spell.png'),
  blueGiant: icon('Blue_Giant_Spell.png'),
  draconicHoard: icon('Draconic_Hoard_Spell.png'),
  rainbowRoad: icon('Rainbow_Road_Spell.png'),
  partyFever: icon('Party_Fever_Spell.png'),
  bombsBlessing: icon('Bombs_Blessing_Spell.png'),
  bugMagnet: icon('Bug_Magnet_Spell.png'),
};

/**
 * The buff icon shown in game while a spell is running. Used on the spell rows
 * you have not unlocked yet, and as the art on the spell cards, which is what
 * the game draws on them.
 */
export const SPELL_ACTIVE_ICONS: Record<SpellId, string> = {
  runicSurge: icon('Runic_Surge.png'),
  rainbowRift: icon('Rainbow_Rift.png'),
  manaflow: icon('Manaflow.png'),
  radiancy: icon('Radiancy.png'),
  prismism: icon('Prismism.png'),
  veinboyant: icon('Veinboyant.png'),
  diggyDiggyHole: icon('Diggy_Diggy_Hole.png'),
  blueGiant: icon('Blue_Giant.png'),
  draconicHoard: icon('Draconic_Hoard.png'),
  rainbowRoad: icon('Rainbow_Road.png'),
  partyFever: icon('Party_Fever.png'),
  bombsBlessing: icon('Bombs_Blessing.png'),
  bugMagnet: icon('Bug_Magnet.png'),
};

export const ESSENCE_UPGRADE_ICONS: Record<EssenceUpgradeId, string> = {
  essenceMine: icon('Essence.png'),
  flatDamage1: icon('Pickaxe_Damage.png'),
  softMaxLoot: icon('Soft_Essence_Multi.png'),
  shinyChance1: icon('Shiny_Essence_Chance.png'),
  critChance1: icon('Pickaxe_Crit_Chance.png'),
  flatDamage2: icon('Brittle_Essence_Chance.png'),
  denseMaxLoot: icon('Dense_Essence_Multi.png'),
  armorPen: icon('Obelisk_Armor_Reduction.png'),
  superCrit1: icon('Archaeology_Super_Crit_Chance.png'),
  flatDamage3: icon('Stun_Block_Chance.png'),
  damagePct: icon('Archaeology_Damage_Mult.png'),
  shinyLoot: icon('Shiny_Essence_Multi.png'),
  shinyChance2: icon('Shiny_Essence_Chance.png'),
  critChance2: icon('Archaeology_Crit_Chance.png'),
  jaggedLoot: icon('Jagged_Essence_Multi.png'),
  // Arcanist batch 2, as listed in Icon-ref-links.txt. The Hourglass rows are
  // the wiki's own art for them.
  regenRespawn: icon('Hourglass.png'),
  superShinyChance1: icon('Hourglass.png'),
  flatDamageWeakenNegate: icon('Hourglass.png'),
  allMaxLoot: icon('Hourglass.png'),
  damagePctBrittle: icon('Brittle_Essence_Chance.png'),
  superShinyLoot: icon('Hourglass.png'),
  critChanceUltraCrit: icon('Pickaxe_Ultra_Crit_Chance.png'),
  critDamageAttackSpeed: icon('Pickaxe_Crit_Damage.png'),
  allMinLoot: icon('Hourglass.png'),
  flatDamageDebuffNegate: icon('Hourglass.png'),
  critChanceRespawn: icon('Pickaxe_Crit_Chance.png'),
  superCritDamageDazeNegate: icon('Hourglass.png'),
  shinyChanceUltraShiny: icon('Hourglass.png'),
  allShinyLoot: icon('Hourglass.png'),
  damagePctArmorPen: icon('Obelisk_Armor_Reduction.png'),
  superCritDamageStunNegate: icon('Hourglass.png'),
  flatDamageSuperCrit: icon('Pickaxe_Super_Crit_Chance.png'),
  critDamageUltraCrit: icon('Pickaxe_Ultra_Crit_Chance.png'),
  superShinyChanceAttackSpeed: icon('Hourglass.png'),
};

export const EXCHANGE_UPGRADE_ICONS: Record<ExchangeUpgradeId, string> = {
  arcaneCardDamage: icon('Archaeology_Flat_Damage.png'),
  runeCraftMulti: icon('Rune_Craft_Multi.png'),
  spellPower: icon('Spell_Unlock.png'),
  runePolychromeCard: icon('Rune_Craft_Multi.png'),
};

export const MISC_ICONS = {
  mana: icon('Mana.png'),
  manaRegen: icon('Mana_Regen.png'),
  spellDuration: icon('Spell_Duration_Multi.png'),
  runeCraft: icon('Rune_Craft_Multi.png'),
  wizardLoot: icon('Exchange_Wizard_Loot_Multi.png'),
  shinyChance: icon('Shiny_Essence_Chance.png'),
  superShiny: icon('Shiny_Multiplier.png'),
  brittleChance: icon('Brittle_Essence_Chance.png'),
} as const;

/** Wizard settings, from the "Exchange Wizard scoring system" block of Icon-ref-links.txt. */
export const WIZARD_ICONS = {
  lootMulti: icon('Exchange_Wizard_Loot_Multi.png'),
  partyChance: icon('Party_Wizard_Chance.png'),
  partyMulti: icon('Party_Wizard_Multi.png'),
  blindChance: icon('Blind_Wizard_Chance.png'),
  discoChance: icon('Disco_Wizard_Chance.png'),
  flashbangChance: icon('Flashbang_Wizard_Chance.png'),
  wizardCount: icon('Exchange.png'),
  exchangeTimer: icon('Hourglass.png'),
  // The wiki gives Poly Orb Card Multi the Wizard Loot Multi art.
  polyOrb: icon('Exchange_Wizard_Loot_Multi.png'),
} as const;

/** What each wizard cost category is drawn as. Item tiers show one of their items. */
export const CATEGORY_ICONS: Record<OfferCategory, string> = {
  stars: icon('Telescope.png'),
  bars: icon('Tin_Bar.png'),
  veins: icon('Stone_Vein.png'),
  fragments: icon('Archaeology_Fragment_Gain.png'),
  fish: icon('Bass.png'),
  gems: icon('Gem.png'),
  commonItems: icon('Apple.png'),
  food: icon('Rainbow_Lollipop.png'),
  rareItems: icon('Cosmic_Candy.png'),
  pp: icon('Prestige_Point.png'),
};

/** The items a wizard can ask, keyed by WIZARD_ITEMS ids. */
export const ITEM_ICONS: Record<string, string> = {
  apple: icon('Apple.png'),
  bananaCoffee: icon('Banana_Coffee.png'),
  rockCake: icon('Rock_Cake.png'),
  primalMeat: icon('Primal_Meat.png'),
  bread: icon('Bread.png'),
  pike: icon('Pike.png'),
  juicyPlums: icon('Juicy_Plums.png'),
  strawberries: icon('Strawberries.png'),
  chargeMagnet: icon('Charge_Magnet.png'),
  chaosTotem: icon('Chaos_Totem.png'),
  droneJuice: icon('Drone_Juice.png'),
  eyeOfNewt: icon('Eye_of_Newt.png'),
  hamburger: icon('Hamburger.png'),
  starfruit: icon('Starfruit.png'),
  rainbowLollipop: icon('Rainbow_Lollipop.png'),
  lasagna: icon('Lasagna.png'),
  iceCream: icon('Ice_Cream.png'),
  blueCow: icon('Blue_Cow.png'),
  lootbugLantern: icon('Lootbug_Lantern.png'),
  frogspawn: icon('Frogspawn.png'),
  goldFlakeSteak: icon('Gold_Flake_Steak.png'),
  cosmicCandy: icon('Cosmic_Candy.png'),
};

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** The frame a card is drawn in. Locked cards have none. */
export const CARD_BACKINGS: Record<Exclude<RhinoCardTier, 'none'>, string> = {
  normal: icon('Card_Backing_Standard.png'),
  gilded: icon('Card_Backing_Gilded.png'),
  polychrome: icon('Card_Backing_Polychrome.png'),
  /** Only the Rhino's pet card can reach this; no Arcanist card can. */
  infernal: icon('Card_Backing_Infernal.png'),
};

/** What each Orb Trade card depicts. */
export const ORB_CARD_ICONS: Record<OrbCardId, string> = {
  white: icon('White_Orb.png'),
  green: icon('Green_Orb.png'),
  purple: icon('Purple_Orb.png'),
  orange: icon('Orange_Orb.png'),
  red: icon('Red_Orb.png'),
  yellow: icon('Yellow_Orb.png'),
};

/** Essence cards depict the max-loot icon for their essence type. */
export const ESSENCE_CARD_ICONS: Record<EssenceType, string> = {
  soft: icon('Soft_Essence_Multi.png'),
  dense: icon('Dense_Essence_Multi.png'),
  jagged: icon('Jagged_Essence_Multi.png'),
  // No max-loot art recorded for Necrotic yet; the essence itself stands in.
  necrotic: icon('Necrotic_Essence.png'),
};

// ---------------------------------------------------------------------------
// Pets and unlocks
// ---------------------------------------------------------------------------

export const PET_ICONS = {
  rhino: icon('Rhino_Default.png'),
  rhinoSkin: icon('Rhino_Skin.png'),
  rhinoQuest: icon('Rhino_Quest.png'),
} as const;

export const UNLOCK_ICONS = {
  worldQuest25: icon('Shiny_Essence_Chance.png'),
  worldQuest29: icon('Shiny_Multiplier.png'),
  straightOuttaYanille: icon('Straight_Outta_Yanille.png'),
  arcanistBundle: icon('Arcanist_VP.png'),
  // No wiki art recorded for the Spellslinger Bundle yet; placeholder.
  spellslingerBundle: icon('Spell_Duration_Multi.png'),
  statueOfNature: icon('22_Statue_Nature_Gilded.png'),
  blackHole30: icon('BlackHole.png'),
  divineChallenge24: icon('Divine_Challenge_Coin.png'),
  hydraStar: icon('Hydra_Full.png'),
} as const;
