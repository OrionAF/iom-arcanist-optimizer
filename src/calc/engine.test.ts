/**
 * The calculator's formulas, checked against the example build.
 *
 * Expected values are worked out here from the example's levels and the
 * figures in constants.ts, so each assertion states the formula it pins rather
 * than a number nobody can check.
 */

import { describe, expect, it } from 'vitest';

import { critRollChance, tenThousandthChance } from './combat';
import { compute } from './engine';
import { ALTAR_IDS, CARD_SCALES, EXCHANGE_UPGRADES, cardValue } from './constants';
import { curveCost } from './costs';
import { displayLabel, formatCompact, formatShortScale } from './format';
import { EXAMPLE_INPUT } from '../presets/example';
import { FRESH_EXTERNAL, FRESH_INPUT } from '../presets/fresh';
import { CARD_TIERS, ESSENCE_TYPES } from './types';
import type { ArcanistInput, Resource } from './types';

const result = compute(EXAMPLE_INPUT);
const { stats, averages } = result;

describe('stats', () => {
  it('adds flat damage and card tiers, then scales by Flat Damage %', () => {
    // Flat Damage +1 ×17, +1 ×12, +1 ×4; 20 card tiers owned; +2% ×10.
    expect(result.derived.arcaneCardCount).toBe(20);
    // 63 × 1.2 = 75.6, rounded half up to a whole number as the game does.
    expect(stats.damage).toBe(76);
  });

  it('reads Attack Speed from Essence Armor Pen +1, Attack Speed +1%', () => {
    expect(stats.armorPen).toBe(5);
    expect(stats.attackSpeed).toBeCloseTo(0.05, 10);
    expect(stats.attackInterval).toBeCloseTo(2 / 1.05, 10);
  });

  it('sums the crit ladders', () => {
    expect(stats.critChance).toBeCloseTo(9 * 0.0025 + 7 * 0.0035, 10);
    expect(stats.critDamage).toBeCloseTo(2 * (1 + 9 * 0.01), 10);
    expect(stats.superCritChance).toBeCloseTo(2 * 0.005 + 7 * 0.0025, 10);
    expect(stats.superCritDamage).toBeCloseTo(2 * (1 + 2 * 0.01), 10);
    expect(stats.ultraCritChance).toBe(0);
    expect(stats.ultraCritDamage).toBe(2);
    expect(stats.stunNegate).toBeCloseTo(4 * 0.02, 10);
  });

  it('adds shiny chance from upgrades and Runic Surge', () => {
    // Runic Surge: 1% passive × Gilded card × level 13 × potency 10.
    const runicSurge = 0.01 * 1.2 * (1 + 13 * 0.05) * (1 + 10 * 0.05);
    expect(result.spells.runicSurge.secondary).toBeCloseTo(runicSurge, 10);
    expect(stats.shinyChance).toBeCloseTo(7 * 0.003 + 0.01 + runicSurge, 10);
    expect(stats.shinyBonus).toBe(3 + 1);
    expect(stats.superShinyChance).toBe(0);
    expect(stats.superShinyBonus).toBe(5);
  });

  it('adds brittle chance from upgrades and the Rhino', () => {
    expect(stats.brittleChance).toBeCloseTo(12 * 0.0015 + 0.01 + 5 * 0.01, 10);
  });
});

describe('probability tables', () => {
  const weighted = (rows: { chance: number; value: number }[]) =>
    rows.reduce((n, row) => n + row.chance * row.value, 0);
  const total = (rows: { chance: number }[]) => rows.reduce((n, row) => n + row.chance, 0);

  it('each table is exclusive and sums to one', () => {
    expect(total(averages.shinyTable)).toBeCloseTo(1, 12);
    expect(total(averages.critTable)).toBeCloseTo(1, 12);
    expect(total(averages.brittleTable)).toBeCloseTo(1, 12);
  });

  it('averages are the weighted sums of their tables', () => {
    expect(averages.shinyBonus).toBeCloseTo(weighted(averages.shinyTable), 12);
    expect(averages.critMult).toBeCloseTo(weighted(averages.critTable), 12);
    expect(averages.brittleMult).toBeCloseTo(weighted(averages.brittleTable), 12);
  });

  it('compounds the crit multipliers down the ladder', () => {
    const [noCrit, crit, superCrit, ultraCrit] = averages.critTable;
    expect(noCrit!.value).toBe(1);
    expect(crit!.value).toBeCloseTo(stats.critDamage, 12);
    expect(superCrit!.value).toBeCloseTo(stats.critDamage * stats.superCritDamage, 12);
    expect(ultraCrit!.value).toBeCloseTo(
      stats.critDamage * stats.superCritDamage * stats.ultraCritDamage,
      12,
    );
  });

  it('brittle blocks spawn with a fifth of their health', () => {
    expect(averages.brittleChance).toBe(tenThousandthChance(stats.brittleChance));
    expect(averages.brittleMult).toBeCloseTo(1 - averages.brittleChance * 0.8, 12);
  });

  it('rolls crits in whole percents only', () => {
    // 4.7% crit chance crits 4% of the time; 2.75% super crit, 2%.
    const [noCrit, crit, superCrit] = averages.critTable;
    expect(critRollChance(stats.critChance)).toBe(0.04);
    expect(noCrit!.chance).toBeCloseTo(0.96, 12);
    expect(crit!.chance + superCrit!.chance).toBeCloseTo(0.04, 12);
    expect(superCrit!.chance).toBeCloseTo(0.04 * 0.02, 12);
  });
});

describe('mining', () => {
  it('soft: loot range from upgrades and the Essence card', () => {
    const soft = result.essence.soft;
    expect(soft.armor).toBe(0);
    expect(soft.minLoot).toBe(1);
    // Base 3, Soft Essence Max Loot +1 ×2, Polychrome card +4.
    expect(soft.maxLoot).toBe(3 + 2 + 4);
  });

  it.each([...ESSENCE_TYPES])('%s: hits, time and income follow from the block', (type) => {
    const outcome = result.essence[type];
    expect(outcome.hitDamage).toBe(Math.max(stats.damage - outcome.armor, 0));
    expect(outcome.expectedHitDamage).toBeCloseTo(outcome.hitDamage * averages.critMult, 10);
    if (outcome.unmineable) return;
    // The replay's average block. No debuff makes a block faster, so it can
    // never beat the undebuffed swing schedule: (hits − 1) intervals.
    expect(outcome.hitsToMine).toBeGreaterThanOrEqual(1);
    expect(outcome.timeToMine).toBeGreaterThanOrEqual(
      (outcome.hitsToMine - 1) * stats.attackInterval - 1e-9,
    );
    expect(outcome.timeToMineStdErr).toBeLessThan(outcome.timeToMine * 0.01);
    expect(outcome.cycleTime).toBeCloseTo(outcome.timeToMine + outcome.respawn, 10);
    expect(outcome.blocksPerHour).toBeCloseTo(3600 / outcome.cycleTime, 10);
    expect(outcome.trueLootAvg).toBeCloseTo(
      (outcome.minLoot + outcome.maxLoot) / 2 + averages.shinyBonus,
      10,
    );
    expect(outcome.essencePerHour).toBeCloseTo(outcome.blocksPerHour * outcome.trueLootAvg, 10);
    expect(outcome.brittleBlocksPerHour).toBeCloseTo(
      outcome.blocksPerHour * averages.brittleChance,
      10,
    );
  });

  it('gives every block its own regeneration burst', () => {
    expect(result.essence.soft.regenAmount).toBe(5);
    expect(result.essence.dense.regenAmount).toBe(7);
    expect(result.essence.jagged.regenAmount).toBe(10);
    expect(result.essence.necrotic.regenAmount).toBe(20);
  });

  it('net essence is income minus altar drain', () => {
    // Brine is the only running altar, on Soft.
    expect(result.drain.soft).toBeCloseTo(result.altars.brine.essenceCostPerHour, 10);
    expect(result.drain.dense).toBe(0);
    expect(result.drain.jagged).toBe(0);
    expect(result.essence.soft.netEssencePerHour).toBeCloseTo(
      result.essence.soft.essencePerHour - result.drain.soft,
      10,
    );
  });
});

/**
 * The observable spread behind the average. The hourly figures are built from
 * `trueLootAvg`, which is not a number any single block pays; these are the
 * bounds a player actually sees.
 */
describe('loot range', () => {
  it('tops out at a max roll that also procs super shiny', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.external.pets.rhinoCard = 'polychrome'; // a super shiny source
    const out = compute(input);

    expect(out.stats.shinyChance).toBeGreaterThan(0);
    expect(out.stats.superShinyChance).toBeGreaterThan(0);
    expect(out.essence.soft.luckiestLoot).toBeCloseTo(
      out.essence.soft.maxLoot + out.stats.shinyBonus + out.stats.superShinyBonus,
      9,
    );
  });

  it('leaves out a bonus the build cannot roll', () => {
    const soft = result.essence.soft;
    expect(stats.superShinyChance).toBe(0);
    expect(soft.luckiestLoot).toBeCloseTo(soft.maxLoot + stats.shinyBonus, 9);

    const dull = compute(FRESH_INPUT);
    expect(dull.stats.shinyChance).toBe(0);
    expect(dull.essence.soft.luckiestLoot).toBe(dull.essence.soft.maxLoot);
  });

  it('brackets the average it is shown beside', () => {
    for (const type of ESSENCE_TYPES) {
      const outcome = result.essence[type];
      expect(outcome.trueLootAvg, type).toBeGreaterThanOrEqual(outcome.minLoot);
      expect(outcome.trueLootAvg, type).toBeLessThanOrEqual(outcome.luckiestLoot);
    }
  });
});

describe('altars', () => {
  it('rune craft multiplier combines Prismism, the Exchange, contracts and the bundle', () => {
    // Prismism level 1, potency 4, no card; contract level 16; no bundle, no Exchange level.
    const prismism = 0.15 * (1 + 1 * 0.05) * (1 + 4 * 0.05);
    expect(result.spells.prismism.secondary).toBeCloseTo(prismism, 12);
    expect(result.runeCraftMulti).toBeCloseTo((1 + prismism) * (1 + 16 * 0.005), 12);
  });

  it('multiplies every rune craft source separately, Exchange included', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.exchange.runeCraftMulti = 15;
    input.external.contractRuneCraftLevel = 19;
    input.external.unlocks.arcanistBundle = true;
    const r = compute(input);
    expect(r.runeCraftMulti).toBeCloseTo(
      (1 + r.spells.prismism.secondary) * (1 + 0.15) * (1 + 19 * 0.005) * (1 + 0.1),
      12,
    );
  });

  it('brine: cycle, output and drain', () => {
    const brine = result.altars.brine;
    // 90s base, travel 10 halves it, there and back.
    expect(brine.cycleTime).toBeCloseTo(90 * 0.5 * 2, 12);
    // Capacity 5, craft 3, Gilded Rune card.
    const perCycle = (1 + 5) * (1 + 3 * 0.2) * (1 + 0.3) * result.runeCraftMulti;
    expect(brine.runesPerCycle).toBeCloseTo(perCycle, 10);
    expect(brine.runesPerHour).toBeCloseTo((3600 / 90) * perCycle, 10);
    expect(brine.essenceCostPerHour).toBeCloseTo((3600 / 90) * 6, 10);
  });

  it('a Polychrome Rune card takes Poly Rune Multi on top', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.exchange.runePolychromeCard = 20;
    const out = compute(input);
    // Ash is Polychrome (+50% becomes +90%); Brine is Gilded and unchanged.
    expect(out.altars.ash.runesPerCycle / result.altars.ash.runesPerCycle).toBeCloseTo(1.9 / 1.5, 10);
    expect(out.altars.brine.runesPerCycle).toBeCloseTo(result.altars.brine.runesPerCycle, 10);
  });
});

describe('spells', () => {
  it('scale by card, level, potency and spell power', () => {
    // Runic Surge: Gilded, level 13, potency 10.
    expect(result.spells.runicSurge.primary).toBeCloseTo(
      0.15 * 1.2 * (1 + 13 * 0.05) * (1 + 10 * 0.05),
      12,
    );
    // Manaflow: Normal, level 1, potency 0; active 25%, passive 15%.
    expect(result.spells.manaflow.primary).toBeCloseTo(0.25 * 1.1 * 1.05, 12);
    expect(result.spells.manaflow.secondary).toBeCloseTo(0.15 * 1.1 * 1.05, 12);

    const powered = structuredClone(EXAMPLE_INPUT);
    powered.exchange.spellPower = 15;
    expect(compute(powered).spells.manaflow.primary).toBeCloseTo(0.25 * 1.1 * 1.05 * 1.075, 12);
  });

  it('last their base duration, scaled by potency and spell duration bonuses', () => {
    // Runic Surge: 300s at potency 10.
    expect(result.spells.runicSurge.duration).toBeCloseTo(300 * 1.5, 10);
    const slung = structuredClone(EXAMPLE_INPUT);
    slung.external.unlocks.spellslingerBundle = true;
    expect(compute(slung).spells.runicSurge.duration).toBeCloseTo(300 * 1.5 * 1.1, 10);
  });

  it('take level-up chance from potency and the Spellslinger Bundle', () => {
    expect(result.spells.runicSurge.levelUpChanceMulti).toBeCloseTo(1.5, 12);
    expect(result.spells.prismism.levelUpChanceMulti).toBeCloseTo(1.2, 12);
    const slung = structuredClone(EXAMPLE_INPUT);
    slung.external.unlocks.spellslingerBundle = true;
    expect(compute(slung).spells.runicSurge.levelUpChanceMulti).toBeCloseTo(1.5 * 1.1, 12);
  });

  it('grant nothing while locked', () => {
    expect(result.spells.veinboyant.unlocked).toBe(false);
    expect(result.spells.veinboyant.primary).toBe(0);
    expect(result.spells.veinboyant.secondary).toBe(0);
  });
});

describe('total resource costs', () => {
  it('sums exactly the priced rows, for every resource', () => {
    const rows = [
      ...result.rows.essence,
      ...ALTAR_IDS.flatMap((id) => result.rows.altars[id]),
      ...result.rows.altarUnlocks,
      ...result.rows.spells,
      ...result.rows.exchange,
    ].filter((row) => row.priced);

    for (const resource of Object.keys(result.totals.remaining) as Resource[]) {
      const sum = (key: 'remaining' | 'total') =>
        rows.reduce((n, row) => n + ((row.counted ?? row)[key][resource] ?? 0), 0);
      expect(result.totals.remaining[resource], `${resource} remaining`).toBe(sum('remaining'));
      expect(result.totals.total[resource], `${resource} total`).toBe(sum('total'));
    }
  });

  it("leaves out Essence Mine 4's placeholder price", () => {
    const mine = result.rows.essence.find((row) => row.id === 'essenceMine')!;
    expect(mine.total.driftRune).toBe(999999999);
    expect(mine.counted?.total.driftRune).toBeUndefined();
    expect(result.totals.total.driftRune).toBeLessThan(999999999);
    expect(result.totals.remaining.driftRune).toBeLessThan(999999999);
  });

  it('charges whole units only, as the game does', () => {
    for (const [resource, amount] of Object.entries(result.totals.total)) {
      expect(Number.isInteger(amount), resource).toBe(true);
    }
  });

  it('prices every row the Arcanist pays for', () => {
    const rows = [
      ...result.rows.essence,
      ...ALTAR_IDS.flatMap((id) => result.rows.altars[id]),
      ...result.rows.altarUnlocks,
      ...result.rows.spells,
    ];
    for (const row of rows) expect(row.priced, row.id).toBe(true);
  });

  it('lists the resources the page spends, in canonical order', () => {
    expect(result.totals.spendable).toEqual([
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
    ]);
  });
});

describe('row text', () => {
  /** Travel Time takes time off the cycle, so a "+" would read as a slower altar. */
  it('prints Travel Time as a reduction', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.altars.ash.travel = 4;
    const row = compute(input).rows.altars.ash.find((r) => r.id === 'ash.travel')!;
    expect(row.effectText).toBe('Travel Time −20%');
  });

  /** The data keeps the game's hyphen; the screen shows a true minus, as the effects do. */
  it('shows a true minus sign in upgrade names', () => {
    const row = result.rows.essence.find((r) => r.id === 'regenRespawn')!;
    expect(row.label).toBe('Regeneration −1, Essence Respawn Time −1s');
    expect(displayLabel('Crit Chance +4%, Respawn Time -1s')).toBe('Crit Chance +4%, Respawn Time −1s');
    expect(displayLabel('Tier-2 Items')).toBe('Tier-2 Items');
  });
});

describe('exchange upgrades', () => {
  /** Exchange upgrades are bought with resources from elsewhere in the game, which are not tracked. */
  it('carries no cost on any exchange row', () => {
    for (const row of result.rows.exchange) {
      expect(row.priced, `${row.id} priced`).toBe(false);
      expect(row.next, `${row.id} next`).toEqual({});
      expect(row.remaining, `${row.id} remaining`).toEqual({});
      expect(row.total, `${row.id} total`).toEqual({});
    }
  });

  it('shows the effect under the stat it names', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.exchange.runeCraftMulti = 5;
    const row = compute(input).rows.exchange.find((r) => r.id === 'runeCraftMulti')!;
    expect(row.label).toBe('Rune Craft Multi +1%');
    expect(row.effectText).toBe('Rune Craft Multi +5%');
  });

  /**
   * Only the Exchange upgrades that change an Arcanist number are modelled.
   * Pinned because a row quietly reappearing here would be a row a player
   * could tune with nothing to show for it.
   */
  it('models only the Exchange upgrades that change something', () => {
    expect(EXCHANGE_UPGRADES.map((def) => def.id)).toEqual([
      'arcaneCardDamage',
      'runeCraftMulti',
      'spellPower',
      'runePolychromeCard',
    ]);
    expect(result.rows.exchange).toHaveLength(4);
  });
});

/**
 * Exclusive mining and altar stalling. Every one of these must reduce to plain
 * income-minus-drain whenever the pool being mined outpaces the altars drawing
 * on it.
 */
describe('essence supply', () => {
  /** Every altar running, which the example's mining rate cannot feed. */
  const starvedInput = (() => {
    const input = structuredClone(EXAMPLE_INPUT);
    for (const id of ALTAR_IDS) {
      input.altars[id].unlocked = true;
      input.altars[id].active = true;
    }
    return input;
  })();

  it('leaves a fed pool completely untouched', () => {
    expect(result.essence.soft.essencePerHour).toBeGreaterThan(result.essence.soft.altarDrain);
    expect(result.altars.brine.supplyFactor).toBe(1);
    expect(result.altars.brine.sustainedRunesPerHour).toBe(result.altars.brine.runesPerHour);
    expect(result.essence.soft.sustainedNet).toBeCloseTo(result.essence.soft.netEssencePerHour, 9);
  });

  it('throttles altars to the share of demand the pool can meet', () => {
    const starved = compute(starvedInput);
    const soft = starved.essence.soft;

    expect(soft.essencePerHour).toBeLessThan(soft.altarDrain);
    const expected = soft.essencePerHour / soft.altarDrain;

    // Ash and Brine share the Soft pool, so they throttle by the same factor.
    for (const id of ['ash', 'brine'] as const) {
      expect(starved.altars[id].supplyFactor).toBeCloseTo(expected, 9);
      expect(starved.altars[id].sustainedRunesPerHour).toBeCloseTo(
        starved.altars[id].runesPerHour * expected,
        9,
      );
    }
  });

  it('starves an altar whose pool is not being mined at all', () => {
    // Chasm drains Dense; the example mines Soft, so Dense has no income.
    const starved = compute(starvedInput);
    expect(starvedInput.mining).not.toBe('dense');
    expect(starved.altars.chasm.supplyFactor).toBe(0);
    expect(starved.altars.chasm.sustainedRunesPerHour).toBe(0);
    // The nominal rate is untouched — it is what the altar *would* do if fed.
    expect(starved.altars.chasm.runesPerHour).toBeGreaterThan(0);
  });

  it('banks nothing from an essence it is not mining', () => {
    for (const type of ESSENCE_TYPES) {
      if (type === EXAMPLE_INPUT.mining) continue;
      expect(result.essence[type].sustainedNet, type).toBe(0);
    }
  });

  it('reports a starved pool as banking exactly zero, not a negative', () => {
    const starved = compute(starvedInput);
    expect(starved.essence.soft.netEssencePerHour).toBeLessThan(0);
    expect(starved.essence.soft.sustainedNet).toBe(0);
  });

  it('leaves an altar on a pool nothing drains at full rate', () => {
    const idle = structuredClone(EXAMPLE_INPUT);
    for (const id of ALTAR_IDS) idle.altars[id].active = false;
    const out = compute(idle);
    for (const id of ALTAR_IDS) expect(out.altars[id].supplyFactor).toBe(1);
  });

  /**
   * The claim the altar-shutdown advice rests on: an altar converts essence to
   * runes at a rate set by craft, its card and the global multiplier — and
   * *not* by capacity or travel speed.
   */
  it('converts at a ratio independent of capacity and travel', () => {
    const ratio = (input: ArcanistInput, id: (typeof ALTAR_IDS)[number]) => {
      const altar = compute(input).altars[id];
      return altar.runesPerHour / altar.essenceCostPerHour;
    };

    for (const id of ALTAR_IDS) {
      const base = ratio(EXAMPLE_INPUT, id);

      const tuned = structuredClone(EXAMPLE_INPUT);
      tuned.altars[id].capacity = 25;
      tuned.altars[id].travel = 10;
      expect(ratio(tuned, id), id).toBeCloseTo(base, 9);

      const crafted = structuredClone(EXAMPLE_INPUT);
      crafted.altars[id].craft = 10;
      expect(ratio(crafted, id), id).toBeGreaterThan(base);
    }
  });
});

describe('card tiers', () => {
  it.each([
    { scale: 'essenceMaxLoot', normal: 1, gilded: 2, polychrome: 4 },
    { scale: 'altarCraft', normal: 0.15, gilded: 0.3, polychrome: 0.5 },
    { scale: 'spell', normal: 0.1, gilded: 0.2, polychrome: 0.35 },
    { scale: 'superShiny', normal: 0.01, gilded: 0.02, polychrome: 0.04 },
  ] as const)('$scale tiers', ({ scale, normal, gilded, polychrome }) => {
    const table = CARD_SCALES[scale];
    expect(cardValue(table, 'none')).toBe(0);
    expect(cardValue(table, 'normal')).toBeCloseTo(normal, 10);
    expect(cardValue(table, 'gilded')).toBeCloseTo(gilded, 10);
    expect(cardValue(table, 'polychrome')).toBeCloseTo(polychrome, 10);
  });

  it('offers exactly the four states an Arcanist card can be in', () => {
    expect(CARD_TIERS).toEqual(['none', 'normal', 'gilded', 'polychrome']);
  });

  it('gives Necrotic Essence a max loot card like its siblings', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.external.cards.essence.necrotic = 'gilded';
    const out = compute(input);
    expect(out.essence.necrotic.maxLoot).toBe(result.essence.necrotic.maxLoot + 2);
    expect(out.derived.arcaneCardCount).toBe(result.derived.arcaneCardCount + 2);
  });

  it('gives every spell a card like its siblings', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.spells.blueGiant = { unlocked: true, level: 0, rank: 0 };
    input.external.cards.spell.blueGiant = 'polychrome';
    const out = compute(input);
    expect(out.spells.blueGiant.primary).toBeCloseTo(0.03 * 1.35, 12);
    expect(out.derived.arcaneCardCount).toBe(result.derived.arcaneCardCount + 3);
  });
});

describe('derived external bonuses', () => {
  it('counts cumulative tiers, since owning Polychrome means owning all three', () => {
    const oneOfEach = compute({
      ...EXAMPLE_INPUT,
      external: {
        ...EXAMPLE_INPUT.external,
        cards: {
          ...FRESH_EXTERNAL.cards,
          essence: { soft: 'normal', dense: 'gilded', jagged: 'polychrome', necrotic: 'none' },
        },
      },
    });
    expect(oneOfEach.derived.arcaneCardCount).toBe(1 + 2 + 3);
  });

  it('converts pet levels and unlocks into bonuses', () => {
    expect(result.derived.petBrittle).toBeCloseTo(5 * 0.01, 10);
    expect(result.derived.contractRuneCraft).toBeCloseTo(16 * 0.005, 10);
    expect(result.derived.petQuestShiny).toBe(0);
    expect(result.derived.petSpellPower).toBe(0);
    expect(result.derived.statueSuperShiny).toBe(0);
    expect(result.derived.spellDurationMulti).toBe(1);
    expect(result.derived.storeRuneCraft).toBe(0);
  });

  it('grants the first quest-skin step at level 0', () => {
    const at = (level: number) => {
      const input = structuredClone(EXAMPLE_INPUT);
      input.external.pets.rhinoQuestSkin = true;
      input.external.pets.rhinoQuestLevel = level;
      return compute(input).derived;
    };
    expect(at(0).petQuestShiny).toBeCloseTo(0.005, 10);
    expect(at(0).petSpellPower).toBeCloseTo(0.015, 10);
    expect(at(11).petQuestShiny).toBeCloseTo(0.06, 10);
    expect(at(11).petSpellPower).toBeCloseTo(0.18, 10);
  });

  it('grants nothing from the quest skin until it is unlocked', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.external.pets.rhinoQuestLevel = 11;
    const locked = compute(input);
    expect(locked.derived.petQuestShiny).toBe(0);
    expect(locked.derived.petSpellPower).toBe(0);
  });

  it('drives the Arcanist Bundle effects from one unlock', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.external.unlocks.arcanistBundle = true;
    const bundled = compute(input);
    expect(bundled.derived.storeRuneCraft).toBeCloseTo(0.1, 10);
    expect(bundled.stats.shinyChance - stats.shinyChance).toBeCloseTo(0.02, 10);
    expect(bundled.stats.brittleChance - stats.brittleChance).toBeCloseTo(0.02, 10);
    expect(bundled.runeCraftMulti).toBeGreaterThan(result.runeCraftMulti);
    expect(bundled.derived.spellDurationMulti).toBe(1);
  });

  it('drives the Spellslinger Bundle effects from one unlock', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.external.unlocks.spellslingerBundle = true;
    const slung = compute(input);
    expect(slung.derived.spellDurationMulti).toBeCloseTo(1.1, 10);
    expect(slung.derived.spellPower).toBeCloseTo(0.05, 10);
    expect(slung.spells.prismism.secondary).toBeCloseTo(result.spells.prismism.secondary * 1.05, 10);
  });

  it('multiplies the Arcanist Spell Power sources together', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.external.unlocks.blackHole30 = true;
    expect(compute(input).derived.spellPower).toBeCloseTo(0.1, 12);

    input.external.unlocks.divineChallenge23 = true;
    expect(compute(input).derived.spellPower).toBeCloseTo(1.1 * 1.04 - 1, 12);

    // Hydra Star levels add among themselves: level 33 is one +8.25% factor.
    input.external.unlocks.hydraStarLevel = 33;
    expect(compute(input).derived.spellPower).toBeCloseTo(1.1 * 1.04 * 1.0825 - 1, 12);

    // Max level 50.
    input.external.unlocks.hydraStarLevel = 80;
    expect(compute(input).derived.spellPower).toBeCloseTo(1.1 * 1.04 * 1.125 - 1, 12);

    // And the spells feel the product.
    const prismism = compute(input).spells.prismism.secondary;
    expect(prismism / result.spells.prismism.secondary).toBeCloseTo(1.1 * 1.04 * 1.125, 12);
  });

  it('scales the statue bonus by the number of W4 gilded statues', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.external.unlocks.statueOfNatureGilded = true;
    input.external.unlocks.w4GildedStatues = 7;
    const statues = compute(input);
    expect(statues.derived.statueSuperShiny).toBeCloseTo(0.07, 10);
    expect(statues.stats.superShinyChance).toBeCloseTo(0.07, 10);
  });

  it('ignores the statue count while the statue is not gilded', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.external.unlocks.w4GildedStatues = 7;
    expect(compute(input).derived.statueSuperShiny).toBe(0);
  });
});

describe('cost curves', () => {
  it('sums each level rounded to a whole unit, as the game charges', () => {
    // 1, 1.2, 1.44, 1.728, 2.0736 round to 1, 1, 1, 2, 2.
    expect(curveCost({ kind: 'geometric', base: 1, ratio: 1.2 }, 0, 5)).toBe(7);
    expect(curveCost({ kind: 'arithmetic', first: 500, step: 500 }, 15, 30)).toBe(172500);
    expect(curveCost({ kind: 'arithmetic', first: 3, step: 0 }, 8, 25)).toBe(51);
  });

  it('rounds a half up', () => {
    // 250 × 1.3² = 422.5; the game charges 423.
    expect(curveCost({ kind: 'geometric', base: 250, ratio: 1.3 }, 2, 3)).toBe(423);
  });

  it('is zero at or past max', () => {
    expect(curveCost({ kind: 'geometric', base: 5, ratio: 1.3 }, 10, 10)).toBe(0);
    expect(curveCost({ kind: 'geometric', base: 5, ratio: 1.3 }, 12, 10)).toBe(0);
  });
});

describe('formatting', () => {
  it('names the short scale', () => {
    expect(formatShortScale(1726.8254497711916)).toBe('1.73 Thousand');
    expect(formatShortScale(276451.64011217502)).toBe('276.45 Thousand');
    expect(formatShortScale(3.8629497283000019e26)).toBe('386.29 Septillion');
    expect(formatShortScale(521.31628686712111)).toBe('521.32');
    expect(formatShortScale(0)).toBe('0');
  });

  it('produces compact suffixes', () => {
    expect(formatCompact(1726.82)).toBe('1.73K');
    expect(formatCompact(232500)).toBe('232.5K');
  });
});

describe('fresh preset', () => {
  const fresh = compute(FRESH_INPUT);

  it('is a coherent starting state', () => {
    expect(fresh.stats.damage).toBe(10);
    expect(fresh.drain.soft).toBe(0);
  });

  it('still mines soft essence with base damage', () => {
    expect(fresh.essence.soft.unmineable).toBe(false);
    expect(fresh.essence.soft.blocksPerHour).toBeGreaterThan(0);
  });

  it('reports jagged as unmineable when damage cannot beat armour and regen', () => {
    // Base damage 10, jagged armour 10 -> zero effective damage.
    expect(fresh.essence.jagged.unmineable).toBe(true);
    expect(fresh.essence.jagged.blocksPerHour).toBe(0);
    expect(fresh.essence.jagged.essencePerHour).toBe(0);
  });

  it('charges the full cost of everything', () => {
    for (const [resource, amount] of Object.entries(fresh.totals.remaining)) {
      expect(amount, resource).toBe(fresh.totals.total[resource as Resource]);
    }
  });
});
