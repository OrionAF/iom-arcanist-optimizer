/**
 * The Arcanist calculator.
 *
 * `compute` is a pure function of its inputs with no allocation-heavy work
 * beyond the result object, so a future goal-seek can call it in a loop.
 *
 * Order matters in one place: Prismism's secondary effect and the Rune Craft
 * Multiplier exchange upgrade both feed `runeCraftMulti`, which feeds altar
 * output. The sheet expresses this as a cross-sheet cycle
 * (Statmath!C372 -> Arcanist!E62); here it is simply resolved first.
 */

import {
  ALTARS,
  ALTAR_CRAFT_PER_LEVEL,
  ALTAR_IDS,
  ALTAR_TRAVEL_PER_LEVEL,
  BASE_STATS,
  CARD_SCALES,
  COMPLETION_RESERVED,
  ENEMIES,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  RESOURCES,
  SPELLS,
  SPELL_IDS,
  SPELL_LEVEL_PER_RANK,
  cardValue,
} from './constants';
import { addBundle, curveCost, tieredCost } from './costs';
import { formatEffect } from './format';
import type {
  AltarId,
  AltarOutcome,
  ArcanistInput,
  ArcanistResult,
  Averages,
  EffectKey,
  EnemyDef,
  EssenceOutcome,
  EssenceType,
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

/**
 * A spell's effect multiplier. The sheet gates only the primary effect on the
 * unlock flag and nests Runic Surge's pet bonus differently from the other
 * five; both are normalised here (see CORRECTIONS.md).
 */
function spellEffect(
  base: number,
  unlocked: boolean,
  level: number,
  rank: number,
  cardBonus: number,
  petPotency: number,
): number {
  if (!unlocked) return 0;
  return (
    base *
    (1 + cardBonus) *
    (1 + level * SPELL_LEVEL_PER_RANK) *
    (1 + rank * SPELL_LEVEL_PER_RANK) *
    (1 + petPotency)
  );
}

function computeSpells(input: ArcanistInput, ext: ExternalBonuses) {
  const outcomes = {} as Record<SpellId, SpellOutcome>;

  for (const id of SPELL_IDS) {
    const def = SPELLS[id];
    const raw = input.spells[id];
    const unlocked = raw.unlocked;
    const level = clampLevel(raw.level, def.maxLevel);
    const rank = clampLevel(raw.rank, def.maxRank);
    const cardBonus = cardValue(CARD_SCALES.spell, ext.cardSpell[id]);

    outcomes[id] = {
      id,
      unlocked,
      primary: spellEffect(def.primary.base, unlocked, level, rank, cardBonus, ext.petSpellPotency),
      secondary: spellEffect(
        def.secondary.base,
        unlocked,
        level,
        rank,
        cardBonus,
        ext.petSpellPotency,
      ),
      duration: def.durationBase * (1 + rank * SPELL_LEVEL_PER_RANK) * ext.spellDurationMulti,
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
): Stats {
  const arcaneCardDamage = exchangeLevels.arcaneCardDamage >= 1 ? ext.arcaneCardCount : 0;

  const flatDamage =
    BASE_STATS.baseDamage +
    effects.flatDamage1 +
    effects.flatDamage2 +
    effects.flatDamage3 +
    arcaneCardDamage;

  return {
    damage: flatDamage * (1 + effects.damagePct),
    attackInterval: BASE_STATS.attackInterval,
    critChance: effects.critChance1 + effects.critChance2,
    critDamage: BASE_STATS.critDamage * (1 + effects.critDamage),
    superCritChance: effects.superCritChance1 + effects.superCritChance2,
    superCritDamage: BASE_STATS.superCritDamage * (1 + effects.superCritDamage),
    ultraCritChance: BASE_STATS.ultraCritChance,
    ultraCritDamage: BASE_STATS.ultraCritDamage,
    armorPen: effects.armorPen,
    stunNegate: effects.stunNegate,
    shinyChance:
      effects.shinyChance1 +
      effects.shinyChance2 +
      spells.runicSurge.secondary +
      (ext.obeliskShiny ? 0.01 : 0) +
      (ext.skillShiny ? 0.01 : 0) +
      ext.petShiny +
      (ext.storeShiny ? 0.01 : 0),
    shinyBonus: BASE_STATS.shinyBonusBase + effects.shinyLoot,
    superShinyChance:
      cardValue(CARD_SCALES.superShiny, ext.cardSuperShiny) +
      ext.constructSuperShiny +
      (ext.obeliskSuperShiny ? 0.02 : 0),
    superShinyBonus: BASE_STATS.superShinyBonus,
    brittleChance:
      effects.brittleChance1 +
      effects.brittleChance2 +
      (ext.skillBrittle ? 0.01 : 0) +
      ext.petBrittle,
  };
}

/** The sheet's Y3:AA33 probability tables, kept as tables so the UI can show them. */
function computeAverages(stats: Stats): Averages {
  const { shinyChance, superShinyChance, shinyBonus, superShinyBonus } = stats;
  const shinyTable: WeightedOutcome[] = [
    { label: 'normal', chance: 1 - shinyChance, value: 0 },
    { label: 'shiny', chance: shinyChance * (1 - superShinyChance), value: shinyBonus },
    {
      label: 'super shiny',
      chance: shinyChance * superShinyChance,
      value: shinyBonus + superShinyBonus,
    },
  ];

  const { critChance: cc, superCritChance: scc, ultraCritChance: ucc } = stats;
  const { critDamage: cd, superCritDamage: scd, ultraCritDamage: ucd } = stats;
  const critTable: WeightedOutcome[] = [
    { label: 'no crit', chance: 1 - cc, value: 1 },
    { label: 'crit', chance: cc * (1 - scc), value: cd },
    { label: 'super crit', chance: cc * scc * (1 - ucc), value: cd * scd },
    { label: 'ultra crit', chance: cc * scc * ucc, value: cd * scd * ucd },
  ];

  const brittleTable: WeightedOutcome[] = [
    { label: 'normal', chance: 1 - stats.brittleChance, value: 1 },
    { label: 'brittle', chance: stats.brittleChance, value: BASE_STATS.brittleMult },
  ];

  const weighted = (rows: WeightedOutcome[]) =>
    rows.reduce((sum, row) => sum + row.chance * row.value, 0);

  return {
    shinyTable,
    shinyBonus: weighted(shinyTable),
    critTable,
    critMult: weighted(critTable),
    brittleTable,
    brittleMult: weighted(brittleTable),
  };
}

function lootRange(
  type: EssenceType,
  enemy: EnemyDef,
  effects: Effects,
  ext: ExternalBonuses,
): { min: number; max: number } {
  const petBonus = ext.petMaxEssence ? 1 : 0;

  switch (type) {
    case 'soft':
      return {
        min: enemy.baseMinLoot,
        max:
          enemy.baseMaxLoot +
          effects.softMaxLoot +
          petBonus +
          cardValue(CARD_SCALES.essenceMaxLoot, ext.cardSoftMaxLoot),
      };
    case 'dense':
      return {
        min: enemy.baseMinLoot,
        max:
          enemy.baseMaxLoot +
          effects.denseMaxLoot +
          petBonus +
          cardValue(CARD_SCALES.essenceMaxLoot, ext.cardDenseMaxLoot),
      };
    case 'jagged':
      return {
        min: enemy.baseMinLoot + effects.jaggedMinLoot,
        max:
          enemy.baseMaxLoot +
          effects.jaggedMaxLoot +
          petBonus +
          cardValue(CARD_SCALES.essenceMaxLoot, ext.cardJaggedMaxLoot),
      };
  }
}

function computeEssence(
  type: EssenceType,
  stats: Stats,
  averages: Averages,
  effects: Effects,
  ext: ExternalBonuses,
  drain: number,
): EssenceOutcome {
  const enemy = ENEMIES[type];

  const armor = Math.max(enemy.armor - stats.armorPen, 0);
  const avgStun = 1 - enemy.stunChance * (1 - stats.stunNegate) * enemy.stunDuration;
  const avgWeaken =
    1 - enemy.weakenChance * enemy.weakenDuration + enemy.weakenChance * enemy.weakenDuration * enemy.weakenMulti;
  const avgHeal = enemy.heal / enemy.healInterval;

  const effectiveDamagePerHit =
    (stats.damage - armor) * averages.critMult * avgStun * avgWeaken - avgHeal;

  const unkillable = effectiveDamagePerHit <= 0;
  const hitsToKill = unkillable
    ? Infinity
    : Math.ceil((enemy.health * averages.brittleMult) / effectiveDamagePerHit);

  const timeToKill = hitsToKill * stats.attackInterval;
  const cycleTime = timeToKill + enemy.respawn;
  const killsPerHour = unkillable ? 0 : 3600 / cycleTime;

  const { min, max } = lootRange(type, enemy, effects, ext);
  const minLootAvg = min + averages.shinyBonus;
  const maxLootAvg = max + averages.shinyBonus;
  const trueLootAvg = (minLootAvg + maxLootAvg) / 2;
  const essencePerHour = killsPerHour * trueLootAvg;

  return {
    type,
    armor,
    minLoot: min,
    maxLoot: max,
    avgStun,
    avgWeaken,
    avgHeal,
    effectiveDamagePerHit,
    hitsToKill,
    timeToKill,
    cycleTime,
    killsPerHour,
    minLootAvg,
    maxLootAvg,
    trueLootAvg,
    essencePerHour,
    brittleKillsPerHour: killsPerHour * stats.brittleChance,
    altarDrain: drain,
    netEssencePerHour: essencePerHour - drain,
    unkillable,
  };
}

function computeAltars(
  input: ArcanistInput,
  ext: ExternalBonuses,
  runeCraftMulti: number,
): Record<AltarId, AltarOutcome> {
  const out = {} as Record<AltarId, AltarOutcome>;
  const cardByAltar: Record<AltarId, keyof ExternalBonuses> = {
    ash: 'cardAshCraft',
    brine: 'cardBrineCraft',
    chasm: 'cardChasmCraft',
  };

  for (const id of ALTAR_IDS) {
    const def = ALTARS[id];
    const raw = input.altars[id];
    const capacity = clampLevel(raw.capacity, 25);
    const travel = clampLevel(raw.travel, 10);
    const craft = clampLevel(raw.craft, 10);

    const cardBonus = cardValue(CARD_SCALES.altarCraft, ext[cardByAltar[id]] as never);

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
      consumes: def.consumes,
      rune: def.rune,
    };
  }

  return out;
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
): UpgradeCost {
  const common = { id, label, level, max, effectText, note, available: level < max };

  // No cost data for this row (every Exchange upgrade). Distinct from free.
  if (!cost) return { ...common, remaining: {}, total: {}, priced: false };

  if (cost.kind === 'tiered') {
    return {
      ...common,
      remaining: tieredCost(cost.tiers, level, max),
      total: tieredCost(cost.tiers, 0, max),
      priced: true,
    };
  }

  return {
    ...common,
    resource: cost.resource,
    remaining: { [cost.resource]: curveCost(cost.curve, level, max) },
    total: { [cost.resource]: curveCost(cost.curve, 0, max) },
    priced: true,
  };
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
    return costRow(def.id, def.label, level, def.max, def.cost, effectText, def.note);
  });

  const altars = {} as Record<AltarId, UpgradeCost[]>;
  const altarUnlocks: UpgradeCost[] = [];

  for (const id of ALTAR_IDS) {
    const def = ALTARS[id];
    const raw = input.altars[id];

    altars[id] = def.upgrades.map((up) => {
      const level = clampLevel(raw[up.key], up.max);
      const perLevel = up.key === 'travel' ? ALTAR_TRAVEL_PER_LEVEL : ALTAR_CRAFT_PER_LEVEL;
      // Capacity is a count that starts at 1, not a percentage bonus.
      const effectText =
        up.key === 'capacity'
          ? `Holds ${1 + level} essence per cycle`
          : `${up.label} ${formatEffect(level * perLevel, 'percent')}`;
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
        : `${def.label} ${formatEffect(level * def.perLevel, def.display ?? 'flat')}`;
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
    addBundle(remaining as ResourceBundle, row.remaining);
    addBundle(total as ResourceBundle, row.total);
    for (const resource of Object.keys(row.total) as Resource[]) {
      if ((row.total[resource] ?? 0) > 0) spendable.add(resource);
    }
  }

  return { remaining, total, spendable: RESOURCES.filter((r) => spendable.has(r)) };
}

function buildCompletion(input: ArcanistInput): ArcanistResult['completion'] {
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

  const essenceCur = sum(
    ESSENCE_UPGRADES.map((d) => clampLevel(input.essence[d.id], d.max)),
  );
  const essenceMax = sum(ESSENCE_UPGRADES.map((d) => d.max));

  const altarCur = sum(
    ALTAR_IDS.flatMap((id) =>
      ALTARS[id].upgrades.map((up) => clampLevel(input.altars[id][up.key], up.max)),
    ),
  );
  const altarMax = sum(ALTAR_IDS.flatMap((id) => ALTARS[id].upgrades.map((up) => up.max)));

  const spellLevelCur = sum(
    SPELL_IDS.map((id) => clampLevel(input.spells[id].level, SPELLS[id].maxLevel)),
  );
  const spellLevelMax = sum(SPELL_IDS.map((id) => SPELLS[id].maxLevel));

  const rankCur = sum(SPELL_IDS.map((id) => clampLevel(input.spells[id].rank, SPELLS[id].maxRank)));
  const rankMax = sum(SPELL_IDS.map((id) => SPELLS[id].maxRank));

  const exchangeCur = sum(EXCHANGE_UPGRADES.map((d) => clampLevel(input.exchange[d.id], d.max)));
  const exchangeMax = sum(EXCHANGE_UPGRADES.map((d) => d.max));

  const rows = [
    { label: 'Essence Upgrades', current: essenceCur, max: essenceMax },
    { label: 'Altar Upgrades', current: altarCur, max: altarMax },
    { label: 'Spell Levels', current: spellLevelCur, max: spellLevelMax },
    { label: 'Spell Potency Ranks', current: rankCur, max: rankMax },
    { label: 'Exchange Upgrades', current: exchangeCur, max: exchangeMax },
  ];

  return {
    rows,
    current: sum(rows.map((r) => r.current)),
    max: sum(rows.map((r) => r.max)) + COMPLETION_RESERVED,
    reserved: COMPLETION_RESERVED,
  };
}

// ---------------------------------------------------------------------------

export function compute(input: ArcanistInput): ArcanistResult {
  const ext = input.external;
  const effects = collectEffects(input);
  const spells = computeSpells(input, ext);

  // Resolve the rune craft multiplier before altars (see module comment).
  const exchangeRuneCraft =
    clampLevel(input.exchange.runeCraftMulti, 15) *
    (EXCHANGE_UPGRADES.find((d) => d.id === 'runeCraftMulti')?.perLevel ?? 0);
  const runeCraftMulti =
    (1 + spells.prismism.secondary + exchangeRuneCraft) *
    (1 + ext.contractRuneCraft) *
    (1 + ext.storeRuneCraft);

  const stats = computeStats(effects, spells, input.exchange, ext);
  const averages = computeAverages(stats);
  const altars = computeAltars(input, ext, runeCraftMulti);

  const drain: Record<EssenceType, number> = { soft: 0, dense: 0, jagged: 0 };
  for (const id of ALTAR_IDS) {
    const altar = altars[id];
    if (altar.active && altar.unlocked) {
      drain[altar.consumes] += altar.essenceCostPerHour;
    }
  }

  const essence = {} as Record<EssenceType, EssenceOutcome>;
  for (const type of ESSENCE_TYPES) {
    essence[type] = computeEssence(type, stats, averages, effects, ext, drain[type]);
  }

  const rows = buildRows(input, spells);

  return {
    stats,
    averages,
    runeCraftMulti,
    essence,
    altars,
    spells,
    drain,
    rows,
    totals: sumTotals(rows),
    completion: buildCompletion(input),
  };
}
