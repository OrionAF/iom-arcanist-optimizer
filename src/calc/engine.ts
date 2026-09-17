/**
 * The Arcanist calculator.
 *
 * `compute` is a pure function of its inputs. How long a block takes to die is
 * replayed by `combat.ts`, which caches by combat inputs, so the optimizer can
 * call this in a loop.
 *
 * Order matters in one place: Prismism's secondary effect and the Rune Craft
 * Multi exchange upgrade both feed `runeCraftMulti`, which feeds altar output,
 * so it is resolved first.
 */

import {
  ALTARS,
  ALTAR_CRAFT_PER_LEVEL,
  ALTAR_IDS,
  ALTAR_TRAVEL_PER_LEVEL,
  BASE_STATS,
  BLOCKS,
  CARD_SCALES,
  CARD_TIER_COUNT,
  CONTRACT_RUNE_CRAFT,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  PET,
  RESOURCES,
  SPELLS,
  POTENCY_PER_RANK,
  SPELL_EFFECT_PER_LEVEL,
  SPELL_IDS,
  UNLOCKS,
  cardValue,
} from './constants';
import {
  BRITTLE_HP_FRACTION,
  COMBAT_SAMPLES,
  averageKill,
  chanceOf,
  critOutcomes,
  critRollChance,
  roundHalfUp,
  shinyRollChance,
  tenThousandthChance,
  type CombatParams,
  type KillAverages,
} from './combat';
import { addBundle, curveCost, tieredCost } from './costs';
import { displayLabel, formatEffect } from './format';
import type {
  AltarId,
  AltarOutcome,
  ArcanistInput,
  ArcanistResult,
  Averages,
  BlockDef,
  CardTier,
  DerivedBonuses,
  EffectKey,
  EssenceOutcome,
  EssenceType,
  EssenceUpgradeDef,
  ExchangeUpgradeId,
  ExternalBonuses,
  Resource,
  ResourceBundle,
  SpellId,
  SpellOutcome,
  Stats,
  UpgradeCost,
  WeightedOutcome,
} from './types';
import { ESSENCE_TYPES } from './types';

type Effects = Record<EffectKey, number>;

const clampLevel = (level: number, max: number) =>
  Number.isFinite(level) ? Math.min(Math.max(Math.trunc(level), 0), max) : 0;

const emptyResourceRecord = (): Record<Resource, number> => {
  const out = {} as Record<Resource, number>;
  for (const r of RESOURCES) out[r] = 0;
  return out;
};

/** An Exchange upgrade's total effect at the player's level. */
function exchangeEffect(input: ArcanistInput, id: ExchangeUpgradeId): number {
  const def = EXCHANGE_UPGRADES.find((d) => d.id === id);
  if (!def) return 0;
  return clampLevel(input.exchange[id], def.max) * (def.perLevel ?? 0);
}

function deriveBonuses(input: ArcanistInput): DerivedBonuses {
  const ext = input.external;
  const { cards, pets, unlocks } = ext;

  // Tiers are cumulative: a Polychrome card counts as three owned tiers.
  const countTiers = (tiers: Record<string, CardTier>) =>
    Object.values(tiers).reduce((n, tier) => n + CARD_TIER_COUNT[tier], 0);

  const rhinoLevel = clampLevel(pets.rhinoLevel, PET.maxLevel);
  const questLevel = clampLevel(pets.rhinoQuestLevel, PET.maxQuestLevel);
  // Level 0 already grants the first step, hence the +1.
  const questSteps = pets.rhinoQuestSkin ? questLevel + 1 : 0;
  const petSpellPower = questSteps * PET.questSpellPowerPerStep;

  return {
    arcaneCardCount:
      countTiers(cards.essence) +
      countTiers(cards.rune) +
      countTiers(cards.spell) +
      countTiers(cards.orb),
    petBrittle: rhinoLevel * PET.brittlePerLevel,
    petQuestShiny: questSteps * PET.questShinyPerStep,
    petSpellPower,
    // The sources multiply in game: each is its own (1 + bonus) factor. A
    // levelled source (Hydra Star, the Exchange, the quest skin) adds up its own
    // levels first. Stored as the combined bonus, so 0 still means none.
    spellPower:
      [
        petSpellPower,
        unlocks.spellslingerBundle ? UNLOCKS.spellslingerSpellPower : 0,
        unlocks.blackHole30 ? UNLOCKS.blackHole30SpellPower : 0,
        unlocks.divineChallenge24 ? UNLOCKS.divineChallenge24SpellPower : 0,
        clampLevel(unlocks.hydraStarLevel, UNLOCKS.maxHydraStarLevel) *
          UNLOCKS.hydraStarSpellPowerPerLevel,
        exchangeEffect(input, 'spellPower'),
      ].reduce((multi, bonus) => multi * (1 + bonus), 1) - 1,
    // Typed in as the card prints it, in percent.
    rhinoUltraShiny:
      pets.rhinoCard === 'infernal' && Number.isFinite(pets.rhinoInfernalUltraShiny)
        ? Math.max(pets.rhinoInfernalUltraShiny, 0) / 100
        : 0,
    petMaxEssenceLoot: pets.rhinoSkin ? PET.skinMaxLoot : 0,
    statueSuperShiny: unlocks.statueOfNatureGilded
      ? Math.max(unlocks.w4GildedStatues, 0) * UNLOCKS.statueSuperShinyPerStatue
      : 0,
    spellDurationMulti: 1 + (unlocks.spellslingerBundle ? UNLOCKS.spellslingerSpellDuration : 0),
    storeRuneCraft: unlocks.arcanistBundle ? UNLOCKS.bundleRuneCraft : 0,
    contractRuneCraft:
      clampLevel(ext.contractRuneCraftLevel, CONTRACT_RUNE_CRAFT.maxLevel) *
      CONTRACT_RUNE_CRAFT.perLevel,
  };
}

/** Sum every essence upgrade's per-level effects at their current levels. */
function collectEffects(input: ArcanistInput): Effects {
  const effects = {} as Effects;
  for (const def of ESSENCE_UPGRADES) {
    const level = clampLevel(input.essence[def.id], def.max);
    for (const effect of def.effects) {
      effects[effect.key] = (effects[effect.key] ?? 0) + level * effect.perLevel;
    }
  }
  // Ensure every key is present even when no upgrade touched it.
  for (const def of ESSENCE_UPGRADES) {
    for (const effect of def.effects) effects[effect.key] ??= 0;
  }
  return effects;
}

/** A spell's effect. A locked spell grants nothing. */
function spellEffect(
  base: number,
  unlocked: boolean,
  level: number,
  rank: number,
  cardBonus: number,
  spellPower: number,
): number {
  if (!unlocked) return 0;
  return (
    base *
    (1 + cardBonus) *
    (1 + level * SPELL_EFFECT_PER_LEVEL) *
    (1 + rank * POTENCY_PER_RANK) *
    (1 + spellPower)
  );
}

function computeSpells(input: ArcanistInput, ext: ExternalBonuses, derived: DerivedBonuses) {
  const outcomes = {} as Record<SpellId, SpellOutcome>;

  for (const id of SPELL_IDS) {
    const def = SPELLS[id];
    const raw = input.spells[id];
    const unlocked = raw.unlocked;
    const level = clampLevel(raw.level, def.maxLevel);
    const rank = clampLevel(raw.rank, def.maxRank);
    const cardBonus = cardValue(CARD_SCALES.spell, ext.cards.spell[id]);
    const spellPower = derived.spellPower;

    outcomes[id] = {
      id,
      unlocked,
      primary: spellEffect(def.primary.base, unlocked, level, rank, cardBonus, spellPower),
      secondary: spellEffect(def.secondary.base, unlocked, level, rank, cardBonus, spellPower),
      duration: def.durationBase * (1 + rank * POTENCY_PER_RANK) * derived.spellDurationMulti,
      levelUpChanceMulti:
        (1 + rank * POTENCY_PER_RANK) *
        (1 + (ext.unlocks.spellslingerBundle ? UNLOCKS.spellslingerLevelUpChance : 0)),
      potencyCostNext: rank >= def.maxRank ? 0 : curveCost(def.potencyCurve, rank, rank + 1),
      potencyCostRemaining: curveCost(def.potencyCurve, rank, def.maxRank),
      potencyCostTotal: curveCost(def.potencyCurve, 0, def.maxRank),
      potencyResource: def.potencyResource,
    };
  }

  return outcomes;
}

function computeStats(
  effects: Effects,
  spells: Record<SpellId, SpellOutcome>,
  exchangeLevels: ArcanistInput['exchange'],
  ext: ExternalBonuses,
  derived: DerivedBonuses,
): Stats {
  const { pets, unlocks } = ext;
  const arcaneCardDamage = exchangeLevels.arcaneCardDamage >= 1 ? derived.arcaneCardCount : 0;

  const flatDamage =
    BASE_STATS.baseDamage +
    effects.flatDamage +
    effects.flatDamage1 +
    effects.flatDamage2 +
    effects.flatDamage3 +
    arcaneCardDamage;

  // Rhino Infernal keeps its Polychrome super shiny bonus; the ultra shiny it
  // adds is resolved in `derived`.
  const rhinoTier = pets.rhinoCard === 'infernal' ? 'polychrome' : pets.rhinoCard;

  return {
    // The game rounds damage to a whole number once, after the percentage.
    damage: roundHalfUp(flatDamage * (1 + effects.damagePct)),
    // Attack Speed scales the rate, so +10% speed is 1/1.1 of the interval.
    attackInterval: 1 / (BASE_STATS.attackRate * (1 + effects.attackSpeed)),
    attackSpeed: effects.attackSpeed,
    critChance: effects.critChance1 + effects.critChance2 + effects.critChance,
    critDamage: BASE_STATS.critDamage * (1 + effects.critDamage),
    superCritChance: effects.superCritChance1 + effects.superCritChance2 + effects.superCritChance,
    superCritDamage: BASE_STATS.superCritDamage * (1 + effects.superCritDamage),
    ultraCritChance: BASE_STATS.ultraCritChance + effects.ultraCritChance,
    ultraCritDamage: BASE_STATS.ultraCritDamage,
    armorPen: effects.armorPen,
    stunNegate: effects.stunNegate + effects.debuffNegate,
    weakenNegate: effects.weakenNegate + effects.debuffNegate,
    dazeNegate: effects.dazeNegate + effects.debuffNegate,
    shinyChance:
      effects.shinyChance1 +
      effects.shinyChance2 +
      effects.shinyChance +
      spells.runicSurge.secondary +
      (unlocks.worldQuest25 ? UNLOCKS.worldQuest25Shiny : 0) +
      (unlocks.straightOuttaYanille ? UNLOCKS.yanilleShiny : 0) +
      (unlocks.arcanistBundle ? UNLOCKS.bundleShiny : 0) +
      derived.petQuestShiny,
    shinyBonus: BASE_STATS.shinyBonusBase + effects.shinyLoot + effects.allShinyLoot,
    superShinyChance:
      cardValue(CARD_SCALES.superShiny, rhinoTier) +
      derived.statueSuperShiny +
      effects.superShinyChance +
      (unlocks.worldQuest29 ? UNLOCKS.worldQuest29SuperShiny : 0),
    superShinyBonus:
      BASE_STATS.superShinyBonus + effects.superShinyLoot + effects.allShinyLoot,
    ultraShinyChance: effects.ultraShinyChance + derived.rhinoUltraShiny,
    ultraShinyBonus: BASE_STATS.ultraShinyBonus + effects.allShinyLoot,
    brittleChance:
      effects.brittleChance1 +
      effects.brittleChance2 +
      effects.brittleChance +
      (unlocks.straightOuttaYanille ? UNLOCKS.yanilleBrittle : 0) +
      (unlocks.arcanistBundle ? UNLOCKS.bundleBrittle : 0) +
      derived.petBrittle,
    regenReduction: effects.regenReduction,
    respawnReduction: effects.respawnReduction,
  };
}

/** Crit tier chances as the game's rolls out of 100 can hit them. */
function critChances(stats: Stats) {
  return {
    critP: critRollChance(stats.critChance),
    superP: critRollChance(stats.superCritChance),
    ultraP: critRollChance(stats.ultraCritChance),
  };
}

/**
 * The shiny, crit and brittle probability tables, kept as tables so the UI can
 * show them. Every chance is what the game's integer rolls can actually hit:
 * crits roll out of 100, shiny out of 1,000 and brittle out of 10,000, so a
 * displayed 12.95% crit chance is 12% in play.
 */
function computeAverages(stats: Stats): Averages {
  // A ladder like the crit one: super shiny rolls only on a shiny, ultra shiny
  // only on a super shiny, and each adds its bonus on top of the ones below.
  const sc = shinyRollChance(stats.shinyChance);
  const ssc = shinyRollChance(stats.superShinyChance);
  const usc = shinyRollChance(stats.ultraShinyChance);
  const { shinyBonus, superShinyBonus, ultraShinyBonus } = stats;
  const shinyTable: WeightedOutcome[] = [
    { label: 'normal', chance: 1 - sc, value: 0 },
    { label: 'shiny', chance: sc * (1 - ssc), value: shinyBonus },
    {
      label: 'super shiny',
      chance: sc * ssc * (1 - usc),
      value: shinyBonus + superShinyBonus,
    },
    {
      label: 'ultra shiny',
      chance: sc * ssc * usc,
      value: shinyBonus + superShinyBonus + ultraShinyBonus,
    },
  ];

  const critTable = critOutcomes({
    ...critChances(stats),
    critMult: stats.critDamage,
    superMult: stats.superCritDamage,
    ultraMult: stats.ultraCritDamage,
  });

  const brittle = tenThousandthChance(stats.brittleChance);
  const brittleTable: WeightedOutcome[] = [
    { label: 'normal', chance: 1 - brittle, value: 1 },
    { label: 'brittle', chance: brittle, value: BRITTLE_HP_FRACTION },
  ];

  const weighted = (rows: WeightedOutcome[]) =>
    rows.reduce((sum, row) => sum + row.chance * row.value, 0);

  return {
    shinyTable,
    shinyBonus: weighted(shinyTable),
    critTable,
    critMult: weighted(critTable),
    brittleTable,
    brittleChance: brittle,
    brittleMult: weighted(brittleTable),
  };
}

function lootRange(
  type: EssenceType,
  block: BlockDef,
  effects: Effects,
  ext: ExternalBonuses,
  derived: DerivedBonuses,
): { min: number; max: number } {
  const card = cardValue(CARD_SCALES.essenceMaxLoot, ext.cards.essence[type]);
  const min = block.baseMinLoot + effects.allMinLoot;
  const max = block.baseMaxLoot + effects.allMaxLoot + derived.petMaxEssenceLoot + card;

  switch (type) {
    case 'soft':
      return { min, max: max + effects.softMaxLoot };
    case 'dense':
      return { min, max: max + effects.denseMaxLoot };
    case 'jagged':
      return { min: min + effects.jaggedMinLoot, max: max + effects.jaggedMaxLoot };
    case 'necrotic':
      return { min, max };
  }
}

const NOT_REPLAYED: KillAverages = {
  time: NaN,
  timeStdErr: NaN,
  hits: NaN,
  weakenedShare: NaN,
  heals: NaN,
  stunnedTime: NaN,
  dazedTime: NaN,
  unmineable: false,
};

/** A block and the Arcanist facing it, reduced to what the combat replay reads. */
export function combatParams(type: EssenceType, stats: Stats): CombatParams {
  const block = BLOCKS[type];
  // Block chances are whole percents; negates roll out of 10,000.
  const lands = (chance: number, negate: number) =>
    chanceOf(chance * 100, 100) * (1 - tenThousandthChance(Math.min(Math.max(negate, 0), 1)));
  return {
    atk: stats.damage,
    atkSpd: 1 / stats.attackInterval,
    armorLeft: Math.max(block.armor - stats.armorPen, 0),
    ...critChances(stats),
    critMult: stats.critDamage,
    superMult: stats.superCritDamage,
    ultraMult: stats.ultraCritDamage,
    maxHp: block.health,
    regenAmount: Math.max(block.regen - stats.regenReduction, 0),
    regenTime: block.regenInterval,
    stunP: lands(block.stunChance, stats.stunNegate),
    stunDuration: block.stunDuration,
    weakenP: lands(block.weakenChance, stats.weakenNegate),
    weakenEffect: block.weakenMulti,
    weakenDuration: block.weakenDuration,
    dazeP: lands(block.dazeChance, stats.dazeNegate),
    dazeEffect: block.dazeMulti,
    dazeDuration: block.dazeDuration,
  };
}

function computeEssence(
  type: EssenceType,
  stats: Stats,
  averages: Averages,
  effects: Effects,
  ext: ExternalBonuses,
  derived: DerivedBonuses,
  drain: number,
  /** Blocks to replay; 0 skips the replay. */
  samples = COMBAT_SAMPLES,
): EssenceOutcome {
  const replay = samples > 0;
  const block = BLOCKS[type];
  const params = combatParams(type, stats);
  const kill = replay
    ? averageKill(params, averages.brittleChance, averages.critMult, samples)
    : NOT_REPLAYED;
  const { unmineable } = kill;

  const hitDamage = Math.max(params.atk - params.armorLeft, 0);
  // Weaken multiplies damage before armour comes off, and rounds half up.
  const weakenedHitDamage = Math.max(
    roundHalfUp(params.atk * params.weakenEffect) - params.armorLeft,
    0,
  );

  const respawn = Math.max(block.respawn - stats.respawnReduction, 0);
  // Blocks are independent (see combat.ts), so the long-run rate is one hour
  // over the average cycle, and loot per block does not depend on how it died.
  const cycleTime = kill.time + respawn;
  const blocksPerHour = unmineable || !replay ? 0 : 3600 / cycleTime;

  const { min, max } = lootRange(type, block, effects, ext, derived);
  const minLootAvg = min + averages.shinyBonus;
  const maxLootAvg = max + averages.shinyBonus;
  // The best single block, for the range the player sees rather than the mean.
  // A bonus that cannot proc is not part of anyone's range, hence the gates.
  const canRoll = (tier: number) => (averages.shinyTable[tier]?.chance ?? 0) > 0;
  const canUltraShiny = canRoll(3);
  const canSuperShiny = canUltraShiny || canRoll(2);
  const canShiny = canSuperShiny || canRoll(1);
  const luckiestLoot =
    max +
    (canShiny ? stats.shinyBonus : 0) +
    (canSuperShiny ? stats.superShinyBonus : 0) +
    (canUltraShiny ? stats.ultraShinyBonus : 0);
  // `irandom_range(min, max)` is inclusive, so its mean is the midpoint.
  const trueLootAvg = (minLootAvg + maxLootAvg) / 2;
  const essencePerHour = blocksPerHour * trueLootAvg;

  return {
    type,
    armor: params.armorLeft,
    minLoot: min,
    maxLoot: max,
    hitDamage,
    weakenedHitDamage,
    expectedHitDamage: hitDamage * averages.critMult,
    regenAmount: params.regenAmount,
    stunChancePerRoll: params.stunP,
    weakenChancePerRoll: params.weakenP,
    dazeChancePerRoll: params.dazeP,
    hitsToMine: kill.hits,
    timeToMine: kill.time,
    timeToMineStdErr: kill.timeStdErr,
    weakenedShare: kill.weakenedShare,
    healsPerBlock: kill.heals,
    stunnedTime: kill.stunnedTime,
    dazedTime: kill.dazedTime,
    respawn,
    cycleTime,
    blocksPerHour,
    minLootAvg,
    maxLootAvg,
    luckiestLoot,
    trueLootAvg,
    essencePerHour,
    brittleBlocksPerHour: blocksPerHour * averages.brittleChance,
    altarDrain: drain,
    netEssencePerHour: essencePerHour - drain,
    // Overwritten by applySupply, which needs every pool's income at once.
    sustainedNet: essencePerHour - drain,
    unmineable,
  };
}

function computeAltars(
  input: ArcanistInput,
  ext: ExternalBonuses,
  runeCraftMulti: number,
): Record<AltarId, AltarOutcome> {
  const out = {} as Record<AltarId, AltarOutcome>;

  for (const id of ALTAR_IDS) {
    const def = ALTARS[id];
    const raw = input.altars[id];
    const capacity = clampLevel(raw.capacity, 25);
    const travel = clampLevel(raw.travel, 10);
    const craft = clampLevel(raw.craft, 10);

    const tier = ext.cards.rune[id];
    // The Exchange's Rune Polychrome Card Multiplier adds to the Polychrome
    // value only; a card below Polychrome gets nothing from it.
    const cardBonus =
      cardValue(CARD_SCALES.altarCraft, tier) +
      (tier === 'polychrome' ? exchangeEffect(input, 'runePolychromeCard') : 0);

    const cycleTime = def.baseCycle * (1 - travel * ALTAR_TRAVEL_PER_LEVEL) * 2;
    const cyclesPerHour = 3600 / cycleTime;
    const runesPerCycle =
      (1 + capacity) * (1 + craft * ALTAR_CRAFT_PER_LEVEL) * (1 + cardBonus) * runeCraftMulti;

    out[id] = {
      id,
      unlocked: raw.unlocked,
      active: raw.active,
      cycleTime,
      runesPerCycle,
      runesPerHour: cyclesPerHour * runesPerCycle,
      essenceCostPerHour: cyclesPerHour * (1 + capacity),
      // Filled in by applySupply, once essence income is known.
      supplyFactor: 1,
      sustainedRunesPerHour: cyclesPerHour * runesPerCycle,
      consumes: def.consumes,
      rune: def.rune,
    };
  }

  return out;
}

/**
 * Throttle each altar to the essence actually reaching it.
 *
 * An altar stalls on an empty pool, so what it produces over a long run is set
 * by the pool's income, not by its own tuning. Mining is exclusive, so at most
 * one pool has income at a time and the other two support only whatever their
 * altars can draw from a stock that is not being replenished — zero, in the
 * steady state this models.
 *
 * The factor is a ratio rather than a boolean because two altars can share a
 * pool: Ash and Brine both drain Soft, so a pool feeding half their combined
 * demand runs both at half rate rather than one of them fully.
 *
 * Runs after `computeEssence` because it needs income, and income does not
 * depend on drain — only the net does.
 */
function applySupply(
  altars: Record<AltarId, AltarOutcome>,
  essence: Record<EssenceType, EssenceOutcome>,
  drain: Record<EssenceType, number>,
  mining: EssenceType,
): void {
  const factor = {} as Record<EssenceType, number>;
  for (const type of ESSENCE_TYPES) {
    const supply = type === mining ? essence[type].essencePerHour : 0;
    const demand = drain[type];
    factor[type] = demand > 0 ? Math.min(1, supply / demand) : 1;
  }

  for (const id of ALTAR_IDS) {
    const altar = altars[id];
    const share = altar.unlocked && altar.active ? factor[altar.consumes] : 1;
    altar.supplyFactor = share;
    altar.sustainedRunesPerHour = altar.runesPerHour * share;
  }

  for (const type of ESSENCE_TYPES) {
    const outcome = essence[type];
    const supply = type === mining ? outcome.essencePerHour : 0;
    // `supply - demand * factor` algebraically, but that leaves a float residue
    // where it should be a clean zero: below demand, factor is supply/demand
    // and the two terms cancel exactly.
    outcome.sustainedNet = Math.max(0, supply - drain[type]);
  }
}

// ---------------------------------------------------------------------------
// Cost rows
// ---------------------------------------------------------------------------

function costRow(
  id: string,
  label: string,
  level: number,
  max: number,
  cost: (typeof ESSENCE_UPGRADES)[number]['cost'] | undefined,
  effectText: string,
  note?: string,
  blockedBy?: UpgradeCost['blockedBy'],
): UpgradeCost {
  const common = {
    id,
    label,
    level,
    max,
    effectText,
    note,
    available: level < max && !blockedBy,
    ...(blockedBy ? { blockedBy } : {}),
  };
  const maxed = level >= max;

  // No cost data for this row. Distinct from free.
  if (!cost) return { ...common, next: {}, remaining: {}, total: {}, priced: false };

  if (cost.kind === 'tiered') {
    const real = Math.min(max, cost.placeholderFrom ?? max);
    return {
      ...common,
      next: maxed ? {} : tieredCost(cost.tiers, level, level + 1),
      remaining: tieredCost(cost.tiers, level, max),
      total: tieredCost(cost.tiers, 0, max),
      ...(real < max
        ? {
            counted: {
              remaining: tieredCost(cost.tiers, Math.min(level, real), real),
              total: tieredCost(cost.tiers, 0, real),
            },
          }
        : {}),
      priced: true,
    };
  }

  return {
    ...common,
    resource: cost.resource,
    next: maxed ? {} : { [cost.resource]: curveCost(cost.curve, level, level + 1) },
    remaining: { [cost.resource]: curveCost(cost.curve, level, max) },
    total: { [cost.resource]: curveCost(cost.curve, 0, max) },
    priced: true,
  };
}

/**
 * The prerequisite an essence upgrade is still waiting on, or undefined once
 * it is met. Shared with the optimizer, which must not rank a row the game will
 * not sell yet.
 */
export function unmetRequirement(
  input: ArcanistInput,
  def: EssenceUpgradeDef,
): UpgradeCost['blockedBy'] {
  const req = def.requires;
  if (!req) return undefined;
  const parent = ESSENCE_UPGRADES.find((d) => d.id === req.id);
  if (!parent) return undefined;
  if (clampLevel(input.essence[req.id], parent.max) >= req.level) return undefined;
  return { label: displayLabel(parent.label), level: req.level };
}

function buildRows(
  input: ArcanistInput,
  spells: Record<SpellId, SpellOutcome>,
): ArcanistResult['rows'] {
  const essence = ESSENCE_UPGRADES.map((def) => {
    const level = clampLevel(input.essence[def.id], def.max);
    const effectText = def.effects
      .map((e) => `${e.label} ${formatEffect(level * e.perLevel, e.display)}`)
      .join(' · ');
    const blockedBy = unmetRequirement(input, def);
    return costRow(def.id, displayLabel(def.label), level, def.max, def.cost, effectText, def.note, blockedBy);
  });

  const altars = {} as Record<AltarId, UpgradeCost[]>;
  const altarUnlocks: UpgradeCost[] = [];

  for (const id of ALTAR_IDS) {
    const def = ALTARS[id];
    const raw = input.altars[id];

    altars[id] = def.upgrades.map((up) => {
      const level = clampLevel(raw[up.key], up.max);
      const perLevel = up.key === 'travel' ? ALTAR_TRAVEL_PER_LEVEL : ALTAR_CRAFT_PER_LEVEL;
      // Capacity is a count that starts at 1, not a percentage bonus. Travel
      // Time shortens the cycle, so it prints as what it takes off.
      const effectText =
        up.key === 'capacity'
          ? `Holds ${1 + level} essence per cycle`
          : `${up.label} ${formatEffect(level * perLevel, up.key === 'travel' ? 'minusPercent' : 'percent')}`;
      return costRow(
        `${id}.${up.key}`,
        up.label,
        level,
        up.max,
        { kind: 'curve', resource: up.resource, curve: up.curve },
        effectText,
      );
    });

    if (Object.keys(def.unlockCost).length > 0) {
      altarUnlocks.push({
        id: `${id}.unlock`,
        label: `Unlock ${def.label}`,
        level: raw.unlocked ? 1 : 0,
        max: 1,
        next: raw.unlocked ? {} : { ...def.unlockCost },
        remaining: raw.unlocked ? {} : { ...def.unlockCost },
        total: { ...def.unlockCost },
        effectText: raw.unlocked ? 'Unlocked' : 'Locked',
        available: !raw.unlocked,
        priced: true,
      });
    }
  }

  const spellRows = SPELL_IDS.map((id) => {
    const def = SPELLS[id];
    const outcome = spells[id];
    const rank = clampLevel(input.spells[id].rank, def.maxRank);
    return {
      id: `${id}.potency`,
      label: `${def.label} Potency`,
      level: rank,
      max: def.maxRank,
      resource: def.potencyResource,
      next:
        rank >= def.maxRank ? {} : { [def.potencyResource]: outcome.potencyCostNext },
      remaining: { [def.potencyResource]: outcome.potencyCostRemaining },
      total: { [def.potencyResource]: outcome.potencyCostTotal },
      effectText: `${def.primary.label} ${formatEffect(outcome.primary, def.primary.display)} · ${
        def.secondary.label
      } ${formatEffect(outcome.secondary, def.secondary.display)}`,
      available: rank < def.maxRank,
      priced: true,
    } satisfies UpgradeCost;
  });

  const exchange = EXCHANGE_UPGRADES.map((def) => {
    const level = clampLevel(input.exchange[def.id], def.max);
    const effectText =
      def.perLevel === undefined
        ? level >= def.max
          ? 'Purchased'
          : 'Not purchased'
        : `${def.effectLabel ?? def.label} ${formatEffect(level * def.perLevel, def.display ?? 'flat')}`;
    // Exchange upgrades are bought with resources this app does not track.
    return costRow(def.id, def.label, level, def.max, undefined, effectText, def.note);
  });

  return { essence, altars, altarUnlocks, spells: spellRows, exchange };
}

function sumTotals(rows: ArcanistResult['rows']): ArcanistResult['totals'] {
  const remaining = emptyResourceRecord();
  const total = emptyResourceRecord();

  const all: UpgradeCost[] = [
    ...rows.essence,
    ...ALTAR_IDS.flatMap((id) => rows.altars[id]),
    ...rows.altarUnlocks,
    ...rows.spells,
    ...rows.exchange,
  ];

  // Which resources the Arcanist can actually spend. Derived rather than
  // listed, so dropping a cost also drops its resource from the totals panel
  // instead of leaving a row stuck at zero forever.
  const spendable = new Set<Resource>();

  for (const row of all) {
    if (!row.priced) continue;
    const counted = row.counted ?? row;
    addBundle(remaining as ResourceBundle, counted.remaining);
    addBundle(total as ResourceBundle, counted.total);
    for (const resource of Object.keys(counted.total) as Resource[]) {
      if ((counted.total[resource] ?? 0) > 0) spendable.add(resource);
    }
  }

  return { remaining, total, spendable: RESOURCES.filter((r) => spendable.has(r)) };
}

// ---------------------------------------------------------------------------

export interface ComputeOptions {
  /**
   * Replay combat for every essence (the default), or only the one being
   * mined. The optimizer's goals read only the mined essence, and replaying the
   * other three is most of the cost of a recompute. Essences that are skipped
   * report no income, and their combat figures are NaN.
   */
  replay?: 'all' | 'mined';
  /** Blocks replayed per average. Defaults to `COMBAT_SAMPLES`. */
  samples?: number;
}

export function compute(input: ArcanistInput, options: ComputeOptions = {}): ArcanistResult {
  const ext = input.external;
  const derived = deriveBonuses(input);
  const effects = collectEffects(input);
  const spells = computeSpells(input, ext, derived);

  // Resolve the rune craft multiplier before altars (see module comment). Every
  // source is its own multiplier: adding Prismism and the Exchange upgrade
  // together gave 2.28x for a build the game shows at 2.42x, and only the fully
  // multiplied form reaches it.
  const exchangeRuneCraft = exchangeEffect(input, 'runeCraftMulti');
  const runeCraftMulti =
    (1 + spells.prismism.secondary) *
    (1 + exchangeRuneCraft) *
    (1 + derived.contractRuneCraft) *
    (1 + derived.storeRuneCraft);

  const stats = computeStats(effects, spells, input.exchange, ext, derived);
  const averages = computeAverages(stats);
  const altars = computeAltars(input, ext, runeCraftMulti);

  const drain = {} as Record<EssenceType, number>;
  for (const type of ESSENCE_TYPES) drain[type] = 0;
  for (const id of ALTAR_IDS) {
    const altar = altars[id];
    if (altar.active && altar.unlocked) {
      drain[altar.consumes] += altar.essenceCostPerHour;
    }
  }

  const essence = {} as Record<EssenceType, EssenceOutcome>;
  for (const type of ESSENCE_TYPES) {
    const replay = options.replay !== 'mined' || type === input.mining;
    essence[type] = computeEssence(
      type,
      stats,
      averages,
      effects,
      ext,
      derived,
      drain[type],
      replay ? (options.samples ?? COMBAT_SAMPLES) : 0,
    );
  }

  applySupply(altars, essence, drain, input.mining);

  const rows = buildRows(input, spells);

  return {
    stats,
    averages,
    derived,
    runeCraftMulti,
    essence,
    altars,
    spells,
    drain,
    rows,
    totals: sumTotals(rows),
  };
}
