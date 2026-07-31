/**
 * Domain types for the Arcanist calculator.
 *
 * Provenance notes throughout the calc module refer to cells on the "Arcanist"
 * sheet of the Obelisk Total Resources Calculator workbook (see README).
 */

export type EssenceType = 'soft' | 'dense' | 'jagged';

export const ESSENCE_TYPES: readonly EssenceType[] = ['soft', 'dense', 'jagged'];

export type Resource =
  | 'whiteOrb'
  | 'greenOrb'
  | 'purpleOrb'
  | 'orangeOrb'
  | 'redOrb'
  | 'ashRune'
  | 'brineRune'
  | 'chasmRune'
  | 'softEssence'
  | 'denseEssence'
  | 'stoneVein'
  | 'scorpioStar'
  | 'lynxStar'
  | 'aquariusStar'
  | 'superstars'
  | 'prestigePoints'
  | 'blueCow';

export type AltarId = 'ash' | 'brine' | 'chasm';

export type SpellId =
  | 'runicSurge'
  | 'rainbowRift'
  | 'manaflow'
  | 'radiancy'
  | 'prismism'
  | 'veinboyant';

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
  | 'jaggedLoot';

export type ExchangeUpgradeId =
  | 'exchangeWizards'
  | 'exchangeTimer'
  | 'arcaneCardDamage'
  | 'rainbowFloorMulti'
  | 'lootbugBankedCap'
  | 'goldenPortalChance'
  | 'starSupergiantMulti'
  | 'wizardLootMulti'
  | 'geminiStarCap'
  | 'unlockVeinboyant'
  | 'prismaticFloorChance'
  | 'shinyFishMulti'
  | 'runeCraftMulti';

/** Effects granted by essence upgrades. Several upgrades grant two. */
export type EffectKey =
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
  | 'stunNegate';

export type CardTier = 'none' | 'bronze' | 'silver' | 'gold' | 'rainbow';

export const CARD_TIERS: readonly CardTier[] = ['none', 'bronze', 'silver', 'gold', 'rainbow'];

// ---------------------------------------------------------------------------
// Cost curves
// ---------------------------------------------------------------------------

/**
 * Every non-tiered cost in the sheet reduces to one of these two shapes.
 * Both are evaluated in closed form so a goal-seek can call them in a hot loop.
 *
 * - geometric:  cost of level i is `base * ratio^(i-1)`
 * - arithmetic: cost of level i is `first + (i-1) * step`
 *
 * Flat one-off unlocks are `arithmetic` with step 0 and max 1; the altars'
 * fixed per-level costs are `arithmetic` with step 0; the Exchange Timer's
 * `sum(i * 500)` is `arithmetic` with first === step === 500.
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
}

export type CostSpec = ({ kind: 'curve'; resource: Resource } & { curve: CostCurve }) | TieredCost;

// ---------------------------------------------------------------------------
// Definitions (static game data)
// ---------------------------------------------------------------------------

export interface EffectDef {
  key: EffectKey;
  label: string;
  perLevel: number;
  display: 'flat' | 'percent';
}

export interface EssenceUpgradeDef {
  id: EssenceUpgradeId;
  /** Row on the Arcanist sheet, for provenance. */
  row: number;
  label: string;
  max: number;
  cost: CostSpec;
  effects: EffectDef[];
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

export interface ExchangeUpgradeDef {
  id: ExchangeUpgradeId;
  row: number;
  label: string;
  max: number;
  cost: CostSpec;
  /** Effect per level; omitted for pure unlocks. */
  perLevel?: number;
  display?: 'flat' | 'percent';
  note?: string;
}

/** Per-essence enemy stat block. Game constants — not user input. */
export interface EnemyDef {
  health: number;
  armor: number;
  respawn: number;
  stunChance: number;
  stunDuration: number;
  heal: number;
  healInterval: number;
  weakenChance: number;
  weakenMulti: number;
  weakenDuration: number;
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

/**
 * Values Arcanist reads from other sheets in the workbook. Modelled as direct
 * input here rather than porting six more sheets.
 */
export interface ExternalBonuses {
  /** Cards!X13 — multiplier applied to rainbow-tier card effects. */
  cardRainbowMultiplier: number;
  /** Cards!K422/K423/K424 — max essence loot per type. */
  cardSoftMaxLoot: CardTier;
  cardDenseMaxLoot: CardTier;
  cardJaggedMaxLoot: CardTier;
  /** Cards!K429/K430/K431 — altar craft multiplier. */
  cardAshCraft: CardTier;
  cardBrineCraft: CardTier;
  cardChasmCraft: CardTier;
  /** Cards!K438..K443 — per-spell potency multiplier. */
  cardSpell: Record<SpellId, CardTier>;
  /** Cards!K282 — essence super shiny chance (no rainbow tier in the source). */
  cardSuperShiny: CardTier;
  /** Cards!K456 — count of owned Arcanist card tiers across all four blocks. */
  arcaneCardCount: number;

  /** Pets!E57 — +1 max essence loot on every type. */
  petMaxEssence: boolean;
  /** Pets!E38 — brittle chance. */
  petBrittle: number;
  /** Pets!E108 — essence shiny chance. */
  petShiny: number;
  /** Pets!E109 — spell potency multiplier. */
  petSpellPotency: number;

  /** Obelisks!H28 / H32. */
  obeliskShiny: boolean;
  obeliskSuperShiny: boolean;
  /** Skills!D158 / D159. */
  skillShiny: boolean;
  skillBrittle: boolean;
  /** Store!J111. */
  storeShiny: boolean;
  /** Construct!M352. */
  constructSuperShiny: number;

  /** Contracts!D45 — feeds the rune craft multiplier. */
  contractRuneCraft: number;
  /** Store!J112 — feeds the rune craft multiplier. */
  storeRuneCraft: number;
  /** Statmath!C368 — spell duration multiplier. */
  spellDurationMulti: number;
}

export interface ArcanistInput {
  essence: Record<EssenceUpgradeId, number>;
  altars: Record<AltarId, AltarInput>;
  spells: Record<SpellId, SpellInput>;
  exchange: Record<ExchangeUpgradeId, number>;
  external: ExternalBonuses;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** Arcanist combat stats — the sheet's M2:N17 panel. */
export interface Stats {
  damage: number;
  attackInterval: number;
  critChance: number;
  critDamage: number;
  superCritChance: number;
  superCritDamage: number;
  ultraCritChance: number;
  ultraCritDamage: number;
  armorPen: number;
  stunNegate: number;
  shinyChance: number;
  shinyBonus: number;
  superShinyChance: number;
  superShinyBonus: number;
  brittleChance: number;
}

/** One weighted outcome in a probability table (the sheet's Y/Z/AA columns). */
export interface WeightedOutcome {
  label: string;
  chance: number;
  value: number;
}

export interface Averages {
  shinyTable: WeightedOutcome[];
  /** Z10 — expected bonus loot per kill from shiny procs. */
  shinyBonus: number;
  critTable: WeightedOutcome[];
  /** Z23 — expected damage multiplier. */
  critMult: number;
  brittleTable: WeightedOutcome[];
  /** Z33 — expected fraction of nominal health that must be dealt. */
  brittleMult: number;
}

export interface EssenceOutcome {
  type: EssenceType;
  /** Enemy stats after upgrades and player mitigations. */
  armor: number;
  minLoot: number;
  maxLoot: number;
  avgStun: number;
  avgWeaken: number;
  avgHeal: number;
  effectiveDamagePerHit: number;
  hitsToKill: number;
  timeToKill: number;
  cycleTime: number;
  killsPerHour: number;
  minLootAvg: number;
  maxLootAvg: number;
  trueLootAvg: number;
  essencePerHour: number;
  brittleKillsPerHour: number;
  altarDrain: number;
  netEssencePerHour: number;
  /** True when damage output cannot outpace the enemy's healing. */
  unkillable: boolean;
}

export interface AltarOutcome {
  id: AltarId;
  unlocked: boolean;
  active: boolean;
  cycleTime: number;
  runesPerCycle: number;
  runesPerHour: number;
  essenceCostPerHour: number;
  consumes: EssenceType;
  rune: Resource;
}

export interface SpellOutcome {
  id: SpellId;
  unlocked: boolean;
  primary: number;
  secondary: number;
  duration: number;
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
  remaining: ResourceBundle;
  total: ResourceBundle;
  /** Human-readable effect at the current level. */
  effectText: string;
  note?: string;
  available: boolean;
}

export interface CompletionRow {
  label: string;
  current: number;
  max: number;
}

export interface ArcanistResult {
  stats: Stats;
  averages: Averages;
  /** Rune craft multiplier (Statmath!C372), resolved before altar output. */
  runeCraftMulti: number;
  essence: Record<EssenceType, EssenceOutcome>;
  altars: Record<AltarId, AltarOutcome>;
  spells: Record<SpellId, SpellOutcome>;
  drain: Record<EssenceType, number>;
  /** Per-row costs, grouped by section, in sheet order. */
  rows: {
    essence: UpgradeCost[];
    altars: Record<AltarId, UpgradeCost[]>;
    altarUnlocks: UpgradeCost[];
    spells: UpgradeCost[];
    exchange: UpgradeCost[];
  };
  /** Totals by resource, summed across every row. */
  totals: {
    remaining: Record<Resource, number>;
    total: Record<Resource, number>;
  };
  completion: {
    rows: CompletionRow[];
    current: number;
    max: number;
    /** Levels reserved on the sheet for unreleased content. */
    reserved: number;
  };
}
