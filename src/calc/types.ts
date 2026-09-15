/**
 * Domain types for the Arcanist calculator.
 *
 * Game data — prices, maxima, effects — follows arcanist_costs.md, read out of
 * the game's code.
 */

export type EssenceType = 'soft' | 'dense' | 'jagged' | 'necrotic';

/** Order matters: the index is what share links encode for `mining`. */
export const ESSENCE_TYPES: readonly EssenceType[] = ['soft', 'dense', 'jagged', 'necrotic'];

export type Resource =
  | 'whiteOrb'
  | 'greenOrb'
  | 'purpleOrb'
  | 'orangeOrb'
  | 'redOrb'
  | 'yellowOrb'
  | 'ashRune'
  | 'brineRune'
  | 'chasmRune'
  | 'driftRune'
  | 'echoRune'
  | 'softEssence'
  | 'denseEssence';

/** Drift and Echo arrived with Arcanist batch 2. */
export type AltarId = 'ash' | 'brine' | 'chasm' | 'drift' | 'echo';

/** In the game's spell order. */
export type SpellId =
  | 'runicSurge'
  | 'rainbowRift'
  | 'manaflow'
  | 'radiancy'
  | 'prismism'
  | 'veinboyant'
  // Arcanist batch 2.
  | 'diggyDiggyHole'
  | 'blueGiant'
  | 'draconicHoard'
  | 'rainbowRoad'
  | 'partyFever'
  | 'bombsBlessing'
  | 'bugMagnet';

export type EssenceUpgradeId =
  | 'essenceMine'
  | 'flatDamage1'
  | 'softMaxLoot'
  | 'shinyChance1'
  | 'critChance1'
  | 'flatDamage2'
  | 'denseMaxLoot'
  | 'armorPen'
  | 'superCrit1'
  | 'flatDamage3'
  | 'damagePct'
  | 'shinyLoot'
  | 'shinyChance2'
  | 'critChance2'
  | 'jaggedLoot'
  // Arcanist batch 2, in the order the game lists them.
  | 'regenRespawn'
  | 'superShinyChance1'
  | 'flatDamageWeakenNegate'
  | 'allMaxLoot'
  | 'damagePctBrittle'
  | 'superShinyLoot'
  | 'critChanceUltraCrit'
  | 'critDamageAttackSpeed'
  | 'allMinLoot'
  | 'flatDamageDebuffNegate'
  | 'critChanceRespawn'
  | 'superCritDamageDazeNegate'
  | 'shinyChanceUltraShiny'
  | 'allShinyLoot'
  | 'damagePctArmorPen'
  | 'superCritDamageStunNegate'
  | 'flatDamageSuperCrit'
  | 'critDamageUltraCrit'
  | 'superShinyChanceAttackSpeed';

/**
 * Only the Exchange upgrades the Arcanist's own maths reads.
 *
 * The Exchange sells thirty-six; the rest buy portal chances, wizard loot,
 * star caps and the like — real upgrades, but ones that move nothing on
 * this page. Carrying them here meant a section of levels a player could tune
 * all day without a single number changing, which is worse than not offering
 * them: it implies they matter. They are tracked in the game, not here.
 */
export type ExchangeUpgradeId =
  | 'arcaneCardDamage'
  | 'runeCraftMulti'
  // Arcanist batch 2.
  | 'spellPower'
  | 'runePolychromeCard';

/**
 * Effects granted by essence upgrades. Several upgrades grant two, and several
 * upgrades grant the same effect — `collectEffects` sums them by key.
 *
 * The numbered keys are the first fifteen rows; the unnumbered ones are the
 * same stats granted by batch 2 rows.
 */
export type EffectKey =
  | 'flatDamage'
  | 'flatDamage1'
  | 'flatDamage2'
  | 'flatDamage3'
  | 'damagePct'
  | 'softMaxLoot'
  | 'denseMaxLoot'
  | 'jaggedMinLoot'
  | 'jaggedMaxLoot'
  | 'shinyChance1'
  | 'shinyChance2'
  | 'shinyLoot'
  | 'critChance1'
  | 'critChance2'
  | 'critDamage'
  | 'superCritChance1'
  | 'superCritChance2'
  | 'superCritDamage'
  | 'brittleChance1'
  | 'brittleChance2'
  | 'armorPen'
  | 'stunNegate'
  // Batch 2.
  | 'critChance'
  | 'superCritChance'
  | 'shinyChance'
  | 'superShinyChance'
  | 'brittleChance'
  | 'allMaxLoot'
  | 'allMinLoot'
  | 'superShinyLoot'
  | 'ultraCritChance'
  | 'ultraShinyChance'
  /** Adds to the shiny, super shiny and ultra shiny loot bonuses alike. */
  | 'allShinyLoot'
  | 'attackSpeed'
  | 'weakenNegate'
  | 'dazeNegate'
  | 'debuffNegate'
  | 'regenReduction'
  | 'respawnReduction';

/**
 * Card tiers, named as the game names them.
 *
 * Tiers are cumulative: a single tier picker assumes you own every tier up to
 * the one selected. No Arcanist card can be transformed to Infernal, so that
 * tier is not offered here — only the Rhino's pet card reaches it.
 */
export type CardTier = 'none' | 'normal' | 'gilded' | 'polychrome';

/** Order matters: the index is what share links encode. */
export const CARD_TIERS: readonly CardTier[] = ['none', 'normal', 'gilded', 'polychrome'];

/**
 * The Rhino's pet card is not an Arcanist card, and since Arcanist batch 2 it
 * can be Infernal. Infernal keeps the Polychrome bonus and adds Essence Ultra
 * Shiny Chance on top, by an amount the player reads off the card.
 */
export type RhinoCardTier = CardTier | 'infernal';

/** Order matters, as for CARD_TIERS; Infernal is appended so indices hold. */
export const RHINO_CARD_TIERS: readonly RhinoCardTier[] = [...CARD_TIERS, 'infernal'];

// ---------------------------------------------------------------------------
// Cost curves
// ---------------------------------------------------------------------------

/**
 * Every non-tiered cost in the game reduces to one of these two shapes. The
 * game rounds each level's price half up to a whole unit before charging it,
 * and so does `curveCost`.
 *
 * - geometric:  cost of level i is `round(base * ratio^(i-1))`
 * - arithmetic: cost of level i is `round(first + (i-1) * step)`
 *
 * Flat one-off unlocks are `arithmetic` with step 0 and max 1; the altars'
 * fixed per-level costs are `arithmetic` with step 0.
 */
export type CostCurve =
  | { kind: 'geometric'; base: number; ratio: number }
  | { kind: 'arithmetic'; first: number; step: number };

/** A cost paid once when crossing into a given level, in one or more resources. */
export type ResourceBundle = Partial<Record<Resource, number>>;

/** Costs that are a fixed bundle per level rather than a curve (rune unlocks). */
export interface TieredCost {
  kind: 'tiered';
  /** tiers[i] is the cost to go from level i to level i+1. */
  tiers: ResourceBundle[];
  /**
   * Tiers from this index on are the game's placeholder prices for content not
   * yet released. The row still shows them; the totals leave them out.
   */
  placeholderFrom?: number;
}

export type CostSpec = ({ kind: 'curve'; resource: Resource } & { curve: CostCurve }) | TieredCost;

// ---------------------------------------------------------------------------
// Definitions (static game data)
// ---------------------------------------------------------------------------

/** How an effect prints. `minus` rows store a positive amount they subtract. */
export type EffectDisplay = 'flat' | 'percent' | 'minus' | 'minusSeconds';

export interface EffectDef {
  key: EffectKey;
  label: string;
  perLevel: number;
  display: EffectDisplay;
}

export interface EssenceUpgradeDef {
  id: EssenceUpgradeId;
  /** As the game names the upgrade. */
  label: string;
  max: number;
  /**
   * Undefined when the cost is not known. Distinct from free: the row is shown
   * unpriced and left out of every total.
   */
  cost?: CostSpec;
  effects: EffectDef[];
  /** The upgrade cannot be bought until another reaches this level. */
  requires?: { id: EssenceUpgradeId; level: number };
  note?: string;
}

export interface AltarUpgradeDef {
  key: 'capacity' | 'travel' | 'craft';
  label: string;
  max: number;
  resource: Resource;
  curve: CostCurve;
}

export interface AltarDef {
  id: AltarId;
  label: string;
  /** Seconds; cycle time is `baseCycle * (1 - travel*0.05) * 2`. */
  baseCycle: number;
  rune: Resource;
  /** Which essence pool this altar drains while active. */
  consumes: EssenceType;
  unlockCost: ResourceBundle;
  upgrades: AltarUpgradeDef[];
}

export interface SpellEffectDef {
  label: string;
  base: number;
  display: 'flat' | 'percent';
  /** True when this effect feeds back into Arcanist's own numbers. */
  feedsBack?: boolean;
}

export interface SpellDef {
  id: SpellId;
  label: string;
  maxLevel: number;
  maxRank: number;
  potencyResource: Resource;
  potencyCurve: CostCurve;
  primary: SpellEffectDef;
  secondary: SpellEffectDef;
  castCost: ResourceBundle;
  manaCost: number;
  durationBase: number;
}

/**
 * An Exchange upgrade. No cost: Exchange upgrades are bought with resources
 * from elsewhere in the game that this app does not track.
 */
export interface ExchangeUpgradeDef {
  id: ExchangeUpgradeId;
  /** As the game names the upgrade. */
  label: string;
  max: number;
  /** The stat the effect text names; omitted for pure unlocks. */
  effectLabel?: string;
  /** Effect per level; omitted for pure unlocks. */
  perLevel?: number;
  display?: 'flat' | 'percent';
  note?: string;
}

/** Stats of the essence block you mine, per essence. Game constants — not user input. */
export interface BlockDef {
  health: number;
  armor: number;
  respawn: number;
  stunChance: number;
  stunDuration: number;
  regen: number;
  regenInterval: number;
  weakenChance: number;
  weakenMulti: number;
  weakenDuration: number;
  /** Daze slows attack speed, as weaken slows damage. Necrotic is the first to have it. */
  dazeChance: number;
  dazeMulti: number;
  dazeDuration: number;
  baseMinLoot: number;
  baseMaxLoot: number;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface AltarInput {
  unlocked: boolean;
  active: boolean;
  capacity: number;
  travel: number;
  craft: number;
}

export interface SpellInput {
  unlocked: boolean;
  level: number;
  rank: number;
}

/** The six Orb Trade cards. */
export type OrbCardId = 'white' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';

export const ORB_CARD_IDS: readonly OrbCardId[] = [
  'white',
  'green',
  'purple',
  'orange',
  'red',
  'yellow',
];

/**
 * The Arcanist's own card collection: one card per essence, rune, spell and
 * orb, released slots only.
 *
 * Orb Trade cards change no Arcanist maths, but they are Arcanist cards and so
 * count toward Essence Damage +1 Per Arcanist Card Tier Owned — which is why they are here.
 */
export interface CardCollection {
  /** Max essence loot per type. */
  essence: Record<EssenceType, CardTier>;
  /** Altar craft multiplier. */
  rune: Record<AltarId, CardTier>;
  /** Per-spell effect multiplier. */
  spell: Record<SpellId, CardTier>;
  /** Orb trade multiplier; no effect on the Arcanist. */
  orb: Record<OrbCardId, CardTier>;
}

/** The Rhino, the Arcanist's pet. */
export interface PetBonuses {
  /** Max 20. Each level is +1% Essence Brittle Chance. */
  rhinoLevel: number;
  /** The Rhino Skin, worth +1 Essence Max Loot. */
  rhinoSkin: boolean;
  /** Whether the Rhino Quest Skin is unlocked at all. */
  rhinoQuestSkin: boolean;
  /** Max 11. Level 0 already grants the first step. */
  rhinoQuestLevel: number;
  /** The Rhino's card. Grants Essence Super Shiny Chance. */
  rhinoCard: RhinoCardTier;
  /**
   * The Infernal Rhino card's Essence Ultra Shiny Chance, in percent as the
   * card prints it (1.25 means +1.25%). Its value varies, so it is typed in
   * rather than looked up. Ignored unless the card is Infernal.
   */
  rhinoInfernalUltraShiny: number;
}

/** One-off account unlocks that feed the Arcanist. */
export interface UnlockBonuses {
  /** +1% Essence Shiny Chance. */
  worldQuest25: boolean;
  /** +2% Essence Super Shiny Chance. */
  worldQuest29: boolean;
  /** +1% shiny, +1% brittle (and mana regen, which is unmodelled). */
  straightOuttaYanille: boolean;
  /** +2% shiny, +2% brittle, +10% rune craft, +10% wizard loot (unmodelled). */
  arcanistBundle: boolean;
  /** +10% spell duration, +5% spell power, +10% spell level-up chance. */
  spellslingerBundle: boolean;
  /** Enables the per-statue super shiny bonus below. */
  statueOfNatureGilded: boolean;
  /** W4 gilded statues owned; +1% super shiny each. */
  w4GildedStatues: number;
  /** Black Hole Level 30 — +10% Arcanist Spell Power. */
  blackHole30: boolean;
  /** Divine Challenge 23 — +4% Arcanist Spell Power. */
  divineChallenge23: boolean;
  /** Hydra Star level, max 50 — +0.25% Arcanist Spell Power per level. */
  hydraStarLevel: number;
}

/**
 * Everything the Arcanist reads from elsewhere in the game.
 *
 * Modelled as the player-facing thing that grants the bonus — a pet level, an
 * unlock, a card tier — rather than a derived number, so it can be filled in by
 * looking at the game.
 */
export interface ExternalBonuses {
  cards: CardCollection;
  pets: PetBonuses;
  unlocks: UnlockBonuses;
  /** Max 19. Each level is +0.5% Rune Craft Multi. */
  contractRuneCraftLevel: number;
}

export interface ArcanistInput {
  essence: Record<EssenceUpgradeId, number>;
  altars: Record<AltarId, AltarInput>;
  spells: Record<SpellId, SpellInput>;
  exchange: Record<ExchangeUpgradeId, number>;
  external: ExternalBonuses;
  /**
   * Which essence the Arcanist is currently mining.
   *
   * The Arcanist mines one essence at a time. Every essence still reports its
   * own income — that is what makes the other two answerable as "if you
   * switched" — but only this one is actually being earned, and only this one
   * can keep an altar fed.
   */
  mining: EssenceType;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** Arcanist mining stats. */
export interface Stats {
  damage: number;
  /** Seconds between attacks, after Attack Speed. */
  attackInterval: number;
  /** Total Attack Speed bonus, 0.09 for +9%. */
  attackSpeed: number;
  critChance: number;
  critDamage: number;
  superCritChance: number;
  superCritDamage: number;
  ultraCritChance: number;
  ultraCritDamage: number;
  armorPen: number;
  /** Each negate includes All Debuff Negate Chance. */
  stunNegate: number;
  weakenNegate: number;
  dazeNegate: number;
  shinyChance: number;
  shinyBonus: number;
  superShinyChance: number;
  superShinyBonus: number;
  /** Chance for a block that already went super shiny to go ultra shiny. */
  ultraShinyChance: number;
  /** Loot an ultra shiny adds on top of the shiny and super shiny bonuses. */
  ultraShinyBonus: number;
  brittleChance: number;
  /** Flat reduction to every block's regeneration per interval. */
  regenReduction: number;
  /** Seconds taken off every block's respawn timer. */
  respawnReduction: number;
}

/** One weighted outcome in a probability table. */
export interface WeightedOutcome {
  label: string;
  chance: number;
  value: number;
}

/**
 * Probability tables. Chances are what the game's integer rolls can hit, not
 * the displayed stat: crit rolls out of 100, shiny out of 1,000, brittle out
 * of 10,000.
 */
export interface Averages {
  shinyTable: WeightedOutcome[];
  /** Expected bonus loot per block from shiny procs. */
  shinyBonus: number;
  critTable: WeightedOutcome[];
  /** Expected damage multiplier. */
  critMult: number;
  brittleTable: WeightedOutcome[];
  /** Chance a block spawns brittle. */
  brittleChance: number;
  /** Expected share of max HP a block spawns with. */
  brittleMult: number;
}

/**
 * One essence's income. The combat figures are averages over replayed blocks
 * (see combat.ts), so hits and time are not whole numbers.
 */
export interface EssenceOutcome {
  type: EssenceType;
  /** Block armour left after your pen. */
  armor: number;
  minLoot: number;
  maxLoot: number;
  /** A normal hit after armour, before crits. */
  hitDamage: number;
  /** A weakened hit: damage × weaken rounded half up, then armour. */
  weakenedHitDamage: number;
  /** `hitDamage` times the expected crit multiplier. */
  expectedHitDamage: number;
  /** HP the block heals every regen interval. */
  regenAmount: number;
  /** Chance per 1-second roll that each debuff lands on you, negate included. */
  stunChancePerRoll: number;
  weakenChancePerRoll: number;
  dazeChancePerRoll: number;
  /** Average hits per block, the opening hit included. */
  hitsToMine: number;
  /** Average seconds from spawn to the killing hit. Infinity when unmineable. */
  timeToMine: number;
  /** Standard error of `timeToMine` from the replay. */
  timeToMineStdErr: number;
  /** Share of hits that land weakened. */
  weakenedShare: number;
  /** Average regen bursts per block. */
  healsPerBlock: number;
  /** Average seconds per block spent stunned. */
  stunnedTime: number;
  /** Average seconds per block spent dazed. */
  dazedTime: number;
  /** Respawn after reductions. */
  respawn: number;
  cycleTime: number;
  blocksPerHour: number;
  minLootAvg: number;
  maxLootAvg: number;
  /**
   * The most a single block can drop: a top roll that also procs ultra shiny.
   *
   * Above `maxLoot`, because shiny is added on top of the roll rather than
   * being part of it. Each bonus is only counted where its chance is non-zero,
   * so a player with no super shiny source is not shown a number they cannot
   * hit. This is the top of the range a player actually observes, which is why
   * it is here rather than left as `maxLoot` — that one is only the roll.
   */
  luckiestLoot: number;
  trueLootAvg: number;
  essencePerHour: number;
  brittleBlocksPerHour: number;
  altarDrain: number;
  /**
   * Income less the full altar drain.
   *
   * It can go negative, which the game cannot: altars stall rather than
   * overdraw a pool. Use `sustainedNet` for anything user-facing.
   */
  netEssencePerHour: number;
  /**
   * Steady-state net, once altars have throttled to what the pool can feed.
   *
   * Zero for an essence you are not mining but whose altars are running: they
   * drain the stock, then stall. Equal to `netEssencePerHour` whenever the pool
   * is being mined faster than it is drained. Never negative — a pool cannot
   * lose more per hour than it holds, and the transient draw-down is the
   * potency path's business, not the steady state's.
   */
  sustainedNet: number;
  /**
   * True when your damage cannot outpace the block's regen, or a block would
   * take longer than `KILL_TIME_CAP` to die.
   */
  unmineable: boolean;
}

export interface AltarOutcome {
  id: AltarId;
  unlocked: boolean;
  active: boolean;
  cycleTime: number;
  runesPerCycle: number;
  /** Rate with essence assumed infinite. What the altar would do if fed. */
  runesPerHour: number;
  essenceCostPerHour: number;
  /**
   * Share of its nominal rate this altar can actually sustain, 0..1.
   *
   * An altar stalls on an empty pool, so its long-run output is capped by what
   * you mine, not by how well it is tuned. 1 means the pool it drains is being
   * mined faster than the altars on it consume.
   */
  supplyFactor: number;
  /** `runesPerHour * supplyFactor`. The rate a plan can count on. */
  sustainedRunesPerHour: number;
  consumes: EssenceType;
  rune: Resource;
}

export interface SpellOutcome {
  id: SpellId;
  unlocked: boolean;
  primary: number;
  secondary: number;
  duration: number;
  /**
   * Multiplier on the spell's level-up chance: `(1 + 0.05 × potency)` times
   * the Spellslinger Bundle's bonus.
   */
  levelUpChanceMulti: number;
  /** Cost of the next potency rank alone. Zero at max rank. */
  potencyCostNext: number;
  potencyCostRemaining: number;
  potencyCostTotal: number;
  potencyResource: Resource;
}

/** A single purchasable row, as the UI and the future optimizer both need it. */
export interface UpgradeCost {
  id: string;
  label: string;
  level: number;
  max: number;
  /** Undefined for tiered rune costs, which span several resources. */
  resource?: Resource;
  /**
   * Cost of the single next level, `level` to `level + 1`.
   *
   * The number a player can act on today, as distinct from `remaining`, which
   * is the whole run to max. Empty at max level, where there is no next level.
   */
  next: ResourceBundle;
  /** Empty for rows with no known cost. */
  remaining: ResourceBundle;
  total: ResourceBundle;
  /**
   * What the Total Resources panel sums for this row, when that differs from
   * `remaining` and `total` because part of the price is a placeholder.
   */
  counted?: { remaining: ResourceBundle; total: ResourceBundle };
  /** False when this row has no cost data at all, rather than a cost of zero. */
  priced: boolean;
  /** Human-readable effect at the current level. */
  effectText: string;
  note?: string;
  /** False at max level, or while `blockedBy` is set. */
  available: boolean;
  /** The prerequisite this row is still waiting on, if any. */
  blockedBy?: { label: string; level: number };
}

/**
 * External bonuses, resolved from what the player owns into the numbers the
 * rest of the calculation consumes. The input is the pet level; this is where
 * it becomes a percentage, so a balance change is a constants edit rather than
 * a hunt through the model.
 */
export interface DerivedBonuses {
  /** Sum of owned card tiers across the Arcanist's card blocks. */
  arcaneCardCount: number;
  /** Rhino level's Essence Brittle Chance. */
  petBrittle: number;
  /** Rhino Quest Skin's Essence Shiny Chance. */
  petQuestShiny: number;
  /** The Rhino Quest Skin's share of Arcanist Spell Power. */
  petSpellPower: number;
  /**
   * Arcanist Spell Power from every source — the quest skin, the Spellslinger
   * Bundle, Black Hole Level 30, Divine Challenge 23, the Hydra Star and the
   * Exchange. They multiply: this is `∏(1 + source) − 1`.
   */
  spellPower: number;
  /** The Infernal Rhino card's Essence Ultra Shiny Chance, as a fraction. */
  rhinoUltraShiny: number;
  /** The Rhino Skin's Essence Max Loot. */
  petMaxEssenceLoot: number;
  /** Statue of Nature's Essence Super Shiny Chance. */
  statueSuperShiny: number;
  spellDurationMulti: number;
  /** The additive rune craft terms from outside the Arcanist. */
  storeRuneCraft: number;
  contractRuneCraft: number;
}

export interface ArcanistResult {
  stats: Stats;
  averages: Averages;
  /** External bonuses resolved from owned levels/unlocks into usable numbers. */
  derived: DerivedBonuses;
  /** Rune craft multiplier, resolved before altar output. */
  runeCraftMulti: number;
  essence: Record<EssenceType, EssenceOutcome>;
  altars: Record<AltarId, AltarOutcome>;
  spells: Record<SpellId, SpellOutcome>;
  drain: Record<EssenceType, number>;
  /** Per-row costs, grouped by section, in game order. */
  rows: {
    essence: UpgradeCost[];
    altars: Record<AltarId, UpgradeCost[]>;
    altarUnlocks: UpgradeCost[];
    spells: UpgradeCost[];
    exchange: UpgradeCost[];
  };
  /** Totals by resource, summed across every priced row. */
  totals: {
    remaining: Record<Resource, number>;
    total: Record<Resource, number>;
    /** Resources that some priced upgrade actually costs, in canonical order. */
    spendable: Resource[];
  };
}
