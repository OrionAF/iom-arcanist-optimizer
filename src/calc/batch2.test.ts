/**
 * Arcanist batch 2: Necrotic Essence, the new stats, the Drift and Echo altars
 * and the new spells, checked against the game's figures.
 */

import { describe, expect, it } from 'vitest';

import { critRollChance, shinyRollChance, tenThousandthChance } from './combat';
import { ESSENCE_UPGRADES } from './constants';
import { compute } from './engine';
import { enumerateCandidates } from './optimize';
import { EXAMPLE_INPUT } from '../presets/example';
import { FRESH_INPUT } from '../presets/fresh';
import { ESSENCE_TYPES } from './types';
import type { ArcanistInput, EssenceUpgradeId } from './types';

const result = compute(EXAMPLE_INPUT);

const withEssence = (levels: Partial<Record<EssenceUpgradeId, number>>) => {
  const input = structuredClone(EXAMPLE_INPUT);
  Object.assign(input.essence, levels);
  return input;
};

describe('prerequisites', () => {
  it('chains every row after Flat Damage +1 to the one before it', () => {
    expect(ESSENCE_UPGRADES[0]!.requires).toBeUndefined();
    expect(ESSENCE_UPGRADES[1]!.requires).toBeUndefined();
    for (let i = 2; i < ESSENCE_UPGRADES.length; i += 1) {
      const def = ESSENCE_UPGRADES[i]!;
      expect(def.requires?.id, def.id).toBe(ESSENCE_UPGRADES[i - 1]!.id);
    }
  });

  it('blocks a row until its prerequisite level is reached', () => {
    const locked = compute(withEssence({ jaggedLoot: 0 }));
    const row = locked.rows.essence.find((r) => r.id === 'regenRespawn')!;
    expect(row.available).toBe(false);
    expect(row.blockedBy?.level).toBe(1);

    const opened = compute(withEssence({ jaggedLoot: 1 })).rows.essence.find(
      (r) => r.id === 'regenRespawn',
    )!;
    expect(opened.available).toBe(true);
    expect(opened.blockedBy).toBeUndefined();
  });

  it('keeps a blocked row out of the optimizer', () => {
    const ids = (input: ArcanistInput) => enumerateCandidates(input).map((c) => c.id);
    expect(ids(withEssence({ jaggedLoot: 0 }))).not.toContain('regenRespawn');
    expect(ids(withEssence({ jaggedLoot: 1 }))).toContain('regenRespawn');
  });

  it('prices a newly opened row for the optimizer', () => {
    const input = withEssence({ flatDamageWeakenNegate: 3 });
    const candidate = enumerateCandidates(input).find((c) => c.id === 'allMaxLoot')!;
    expect(candidate.priced).toBe(true);
    expect(candidate.stepCost).toEqual({ redOrb: 30 });
  });
});

describe('Necrotic Essence', () => {
  const necrotic = result.essence.necrotic;

  it('reads its debuffs as the game lists them', () => {
    // Per 1-second roll: stun 8%, weaken 4%, daze 2%, each minus its negate.
    const lands = (chance: number, negate: number) => chance * (1 - tenThousandthChance(negate));
    expect(necrotic.stunChancePerRoll).toBeCloseTo(lands(0.08, result.stats.stunNegate), 12);
    expect(necrotic.weakenChancePerRoll).toBeCloseTo(lands(0.04, result.stats.weakenNegate), 12);
    expect(necrotic.dazeChancePerRoll).toBeCloseTo(lands(0.02, result.stats.dazeNegate), 12);
    // Weaken ×0.4 before 15 armour minus 5 pen: round(30.4) − 10 = 20.
    expect(necrotic.weakenedHitDamage).toBe(20);
    expect(necrotic.regenAmount).toBe(20);
    expect(necrotic.respawn).toBe(20);
  });

  it('drops 1-3 before any bonus', () => {
    const fresh = compute(FRESH_INPUT).essence.necrotic;
    expect(fresh.minLoot).toBe(1);
    expect(fresh.maxLoot).toBe(3);
  });

  it('spends part of every block stunned, weakened and dazed', () => {
    expect(necrotic.stunnedTime).toBeGreaterThan(0);
    expect(necrotic.dazedTime).toBeGreaterThan(0);
    expect(necrotic.weakenedShare).toBeGreaterThan(0);
  });

  it('leaves the other blocks undazed', () => {
    for (const type of ['soft', 'dense', 'jagged'] as const) {
      expect(result.essence[type].dazedTime, type).toBe(0);
    }
    expect(result.essence.soft.stunnedTime).toBe(0);
    expect(result.essence.dense.weakenedShare).toBe(0);
  });

  it('is unmineable for a fresh Arcanist', () => {
    expect(compute(FRESH_INPUT).essence.necrotic.unmineable).toBe(true);
  });

  it('can be the essence being mined', () => {
    const input = withEssence({ flatDamage1: 25, damagePct: 20 });
    input.mining = 'necrotic';
    const mined = compute(input);
    expect(mined.essence.necrotic.unmineable).toBe(false);
    // Nothing drains Necrotic, so everything mined is banked.
    expect(mined.essence.necrotic.sustainedNet).toBeCloseTo(mined.essence.necrotic.essencePerHour, 9);
    expect(mined.essence.soft.sustainedNet).toBe(0);
  });
});

describe('new stats', () => {
  it('negates debuffs, with All Debuff Negate feeding all three', () => {
    const stats = compute(withEssence({ flatDamageDebuffNegate: 10 })).stats;
    expect(stats.stunNegate).toBeCloseTo(result.stats.stunNegate + 0.035, 10);
    expect(stats.weakenNegate).toBeCloseTo(0.035, 10);
    expect(stats.dazeNegate).toBeCloseTo(0.035, 10);

    const weaken = compute(withEssence({ flatDamageWeakenNegate: 10 }));
    expect(weaken.stats.weakenNegate).toBeCloseTo(0.2, 10);
    // Jagged weakens 2% per roll; a 20% negate blocks a fifth of those.
    expect(weaken.essence.jagged.weakenChancePerRoll).toBeCloseTo(0.02 * 0.8, 12);
    expect(weaken.essence.jagged.weakenedShare).toBeLessThan(result.essence.jagged.weakenedShare);
  });

  it('treats Attack Speed as a rate on the interval', () => {
    const stats = compute(withEssence({ critDamageAttackSpeed: 10 })).stats;
    // +5% from this row, +5% from Essence Armor Pen +1, Attack Speed +1% at 5.
    expect(stats.attackSpeed).toBeCloseTo(0.1, 10);
    expect(stats.attackInterval).toBeCloseTo(2 / 1.1, 10);
    expect(stats.critDamage).toBeCloseTo(result.stats.critDamage + 2 * 0.2, 10);
  });

  it('takes regeneration and respawn off every block', () => {
    const out = compute(withEssence({ regenRespawn: 3, critChanceRespawn: 2 }));
    expect(out.essence.soft.regenAmount).toBe(5 - 3);
    expect(out.essence.soft.respawn).toBe(10 - 5);
    expect(out.essence.necrotic.respawn).toBe(20 - 5);
    expect(out.stats.critChance).toBeCloseTo(result.stats.critChance + 0.08, 10);
  });

  it('feeds ultra crit into the crit ladder', () => {
    const out = compute(withEssence({ critChanceUltraCrit: 20 }));
    expect(out.stats.ultraCritChance).toBeCloseTo(0.05, 10);
    const ultra = out.averages.critTable[3]!;
    expect(ultra.chance).toBeCloseTo(
      critRollChance(out.stats.critChance) * critRollChance(out.stats.superCritChance) * 0.05,
      10,
    );
    expect(out.averages.critMult).toBeGreaterThan(result.averages.critMult);
  });

  it('adds all-essence loot to every block', () => {
    const out = compute(withEssence({ allMaxLoot: 2, allMinLoot: 2 }));
    for (const type of ESSENCE_TYPES) {
      expect(out.essence[type].maxLoot, type).toBe(result.essence[type].maxLoot + 2);
      expect(out.essence[type].minLoot, type).toBe(result.essence[type].minLoot + 2);
    }
  });

  it('adds All Shiny Essence Loot to every shiny tier', () => {
    const out = compute(withEssence({ superShinyLoot: 2, allShinyLoot: 3 }));
    expect(out.stats.shinyBonus).toBe(result.stats.shinyBonus + 3);
    expect(out.stats.superShinyBonus).toBe(5 + 4 + 3);
    expect(out.stats.ultraShinyBonus).toBe(7 + 3);
  });

  it('puts ultra shiny on top of super shiny in the loot ladder', () => {
    const input = withEssence({ shinyChanceUltraShiny: 10 });
    input.external.pets.rhinoCard = 'polychrome'; // a super shiny source
    const { stats, averages } = compute(input);
    expect(stats.ultraShinyChance).toBeCloseTo(0.04, 10);

    const [, shiny, superShiny, ultraShiny] = averages.shinyTable;
    const s = shinyRollChance(stats.shinyChance);
    const ss = shinyRollChance(stats.superShinyChance);
    expect(shiny!.chance).toBeCloseTo(s * (1 - ss), 12);
    expect(superShiny!.chance).toBeCloseTo(s * ss * (1 - 0.04), 12);
    expect(ultraShiny!.chance).toBeCloseTo(s * ss * 0.04, 12);
    expect(ultraShiny!.value).toBe(stats.shinyBonus + stats.superShinyBonus + stats.ultraShinyBonus);
  });

  /**
   * A player's build, read against the game: Attack Speed prints 1.86s, and on
   * Dense Essence the shiny buffs read +7, +10 and +8.
   */
  it('matches the in-game readout for a real build', () => {
    const input = structuredClone(FRESH_INPUT);
    Object.assign(input.essence, {
      armorPen: 5,
      shinyLoot: 3,
      superShinyLoot: 2,
      critDamageAttackSpeed: 5,
      allShinyLoot: 1,
      superShinyChanceAttackSpeed: 1,
    });
    const { stats } = compute(input);
    expect(stats.attackSpeed).toBeCloseTo(0.05 + 0.025 + 0.002, 12);
    expect(stats.attackInterval.toFixed(2)).toBe('1.86');
    expect(stats.shinyBonus).toBe(7);
    expect(stats.superShinyBonus).toBe(10);
    expect(stats.ultraShinyBonus).toBe(8);
  });
});

describe('Infernal Rhino card', () => {
  const rhino = (tier: ArcanistInput['external']['pets']['rhinoCard'], ultra: number) => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.external.pets.rhinoCard = tier;
    input.external.pets.rhinoInfernalUltraShiny = ultra;
    return compute(input);
  };

  it('keeps the Polychrome super shiny bonus and adds the typed ultra shiny', () => {
    const infernal = rhino('infernal', 1.25);
    expect(infernal.stats.superShinyChance).toBeCloseTo(
      rhino('polychrome', 0).stats.superShinyChance,
      10,
    );
    expect(infernal.derived.rhinoUltraShiny).toBeCloseTo(0.0125, 10);
    expect(infernal.stats.ultraShinyChance).toBeCloseTo(0.0125, 10);
  });

  it('ignores the typed value below Infernal', () => {
    expect(rhino('polychrome', 1.25).stats.ultraShinyChance).toBe(0);
  });
});

describe('Drift and Echo altars', () => {
  const running = (() => {
    const input = structuredClone(EXAMPLE_INPUT);
    for (const id of ['drift', 'echo'] as const) {
      input.altars[id] = { unlocked: true, active: true, capacity: 4, travel: 2, craft: 3 };
    }
    return input;
  })();

  it('drain Dense and Jagged', () => {
    const out = compute(running);
    expect(out.drain.dense).toBeCloseTo(out.altars.drift.essenceCostPerHour, 9);
    expect(out.drain.jagged).toBeCloseTo(out.altars.echo.essenceCostPerHour, 9);
    // The example mines Soft, so both stall.
    expect(out.altars.drift.supplyFactor).toBe(0);
    expect(out.altars.echo.supplyFactor).toBe(0);
  });

  it('craft their own runes over a longer cycle', () => {
    const out = compute(running);
    expect(out.altars.drift.rune).toBe('driftRune');
    expect(out.altars.echo.rune).toBe('echoRune');
    expect(out.altars.drift.cycleTime).toBeCloseTo(150 * 0.9 * 2, 9);
    expect(out.altars.echo.cycleTime).toBeCloseTo(180 * 0.9 * 2, 9);
  });

  it('are unlock rows while locked, priced in three runes', () => {
    const unlocks = result.rows.altarUnlocks;
    expect(unlocks.find((r) => r.id === 'echo.unlock')?.remaining).toEqual({
      brineRune: 100000,
      chasmRune: 75000,
      driftRune: 25000,
    });
    expect(compute(running).rows.altarUnlocks.find((r) => r.id === 'drift.unlock')?.remaining).toEqual({});
  });

  it('take a Rune card like the first three', () => {
    const input = structuredClone(running);
    input.external.cards.rune.echo = 'polychrome';
    const out = compute(input);
    expect(out.altars.echo.runesPerCycle / compute(running).altars.echo.runesPerCycle).toBeCloseTo(1.5, 9);
    expect(out.derived.arcaneCardCount).toBe(result.derived.arcaneCardCount + 3);
  });
});

describe('batch 2 spells', () => {
  it('price potency in their own rune', () => {
    expect(result.spells.rainbowRoad.potencyResource).toBe('echoRune');
    expect(result.spells.rainbowRoad.potencyCostNext).toBe(5500);
    expect(result.spells.bombsBlessing.potencyResource).toBe('driftRune');
    expect(result.spells.bombsBlessing.potencyCostTotal).toBe(
      9500 + 11875 + 14844 + 18555 + 23193 + 28992 + 36240 + 45300 + 56624 + 70781,
    );
  });

  it('take a Spell card like the first six', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.spells.blueGiant = { unlocked: true, level: 0, rank: 0 };
    expect(compute(input).spells.blueGiant.primary).toBeCloseTo(0.03, 10);
    input.external.cards.spell.blueGiant = 'gilded';
    expect(compute(input).spells.blueGiant.primary).toBeCloseTo(0.03 * 1.2, 10);
  });
});

describe('Exchange', () => {
  it('multiplies Arcanist Spell Power with the quest skin share', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.exchange.spellPower = 15;
    input.external.pets.rhinoQuestSkin = true;
    input.external.pets.rhinoQuestLevel = 0;
    const out = compute(input);
    expect(out.derived.petSpellPower).toBeCloseTo(0.015, 10);
    expect(out.derived.spellPower).toBeCloseTo(1.015 * 1.075 - 1, 10);
  });

  it('lifts only a Polychrome Rune card', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    input.exchange.runePolychromeCard = 20;
    const out = compute(input);
    // Ash is Polychrome (+50% becomes +90%); Brine is Gilded and unchanged.
    expect(out.altars.ash.runesPerCycle / result.altars.ash.runesPerCycle).toBeCloseTo(1.9 / 1.5, 10);
    expect(out.altars.brine.runesPerCycle).toBeCloseTo(result.altars.brine.runesPerCycle, 10);
  });
});
