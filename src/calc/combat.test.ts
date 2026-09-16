/**
 * The combat replay against docs/essence_block_combat.html.
 *
 * Most cases here are rigged to be deterministic (no crits, 0% or 100%
 * debuffs), so the kill time can be worked out by hand from the doc's step
 * order and pinned exactly. Randomness is checked separately against an exact
 * expectation computed in the test.
 */

import { describe, expect, it } from 'vitest';

import {
  BRITTLE_HP_FRACTION,
  averageKill,
  chanceOf,
  critRollChance,
  mineBlock,
  roundHalfUp,
  shinyRollChance,
  tenThousandthChance,
  type BlockDraws,
  type CombatParams,
} from './combat';
import { BLOCKS, ESSENCE_UPGRADES } from './constants';
import { combatParams } from './engine';
import { ESSENCE_TYPES } from './types';

/** A plain block and a plain Arcanist: 100 per hit, every 2 s, no crits or debuffs. */
const base: CombatParams = {
  atk: 103,
  atkSpd: 0.5,
  armorLeft: 3,
  critP: 0,
  superP: 0,
  ultraP: 0,
  critMult: 2,
  superMult: 2,
  ultraMult: 2,
  maxHp: 1000,
  regenAmount: 5,
  regenTime: 10,
  stunP: 0,
  stunDuration: 4,
  weakenP: 0,
  weakenEffect: 0.5,
  weakenDuration: 8,
  dazeP: 0,
  dazeEffect: 0.5,
  dazeDuration: 5,
};

/** Draws that never roll a crit and never round a fraction up. */
const never = (): BlockDraws => ({
  hit: () => 0.999999,
  stun: () => 0.5,
  weaken: () => 0.5,
  daze: () => 0.5,
});

const kill = (p: Partial<CombatParams>, brittle = false, draws = never()) =>
  mineBlock({ ...base, ...p }, brittle, draws);

describe('rounding and rolls', () => {
  it('rounds half up, as non_bankers_rounding does', () => {
    expect(roundHalfUp(92.4)).toBe(92);
    expect(roundHalfUp(37.5)).toBe(38);
    expect(roundHalfUp(230.75)).toBe(231);
  });

  it('keeps only the whole part of a chance, within the float tolerance', () => {
    expect(critRollChance(0.0025)).toBe(0); // 0.25% can never crit
    expect(critRollChance(0.2825)).toBe(0.28);
    expect(critRollChance(0.0035 * 20 + 0.04 * 2 + 0.0025 * 25 + 0.0035 * 20)).toBe(0.28);
    expect(tenThousandthChance(0.4775)).toBe(0.4775);
    expect(shinyRollChance(0.0047)).toBe(0.004);
    expect(chanceOf(0, 100)).toBe(0);
    expect(chanceOf(150, 100)).toBe(1);
  });
});

describe('one block, deterministic', () => {
  it('swings at spawn and heals before a hit landing on the same instant', () => {
    // Hits at 0, 2, … 18 take 1000; the burst at 10 s put 5 back, so the hit at
    // 18 s leaves 5 HP. At 20 s the second burst lands first (5 → 10), then the
    // 11th hit breaks it.
    const r = kill({});
    expect(r.hits).toBe(11);
    expect(r.time).toBeCloseTo(20, 9);
    expect(r.heals).toBe(2);
  });

  it('never heals above max HP', () => {
    // 1 damage per hit against a 5-HP burst: HP stays pinned at max, so the
    // replay runs to its cap and reports the block as unmineable.
    const r = kill({ atk: 4, maxHp: 50 });
    expect(r.time).toBe(Infinity);
  });

  it('starts a brittle block at a fifth of its HP', () => {
    const r = kill({}, true);
    expect(base.maxHp * BRITTLE_HP_FRACTION).toBe(200);
    expect(r.hits).toBe(2);
    expect(r.time).toBeCloseTo(2, 9);
  });

  it('applies weaken before armour, rounding half up', () => {
    // The doc's example: 248 damage, weaken ×0.4, 15 armour minus 9 pen.
    // round(99.2) − 6 = 93 per weakened hit. Weaken lands on the 1 s roll and
    // is refreshed every second after, so every hit from 2 s on is weakened.
    const p = { atk: 248, armorLeft: 6, atkSpd: 0.5, weakenP: 1, weakenEffect: 0.4, maxHp: 242 + 93 * 2, regenAmount: 0 };
    const r = kill(p);
    // 242 at 0 s, then 93 at 2 s and 93 at 4 s.
    expect(r.hits).toBe(3);
    expect(r.weakenedHits).toBe(2);
    expect(r.time).toBeCloseTo(4, 9);
  });

  it('keeps bar progress under daze and fills it at half speed', () => {
    // The player's video: bar half full at the 1 s daze, the rest at 0.25/s
    // fills at 3 s, then 4 s per swing while daze keeps refreshing.
    const r = kill({ dazeP: 1, maxHp: 400, regenAmount: 0 });
    expect(r.hits).toBe(4); // at 0, 3, 7, 11
    expect(r.time).toBeCloseTo(11, 9);
  });

  it('lands the hit before a stun rolled on the same instant, then freezes the bar', () => {
    // 1 hit/s: hits at 0 and 1 s land; the 1 s roll stuns, and refreshes every
    // second, so a third hit never comes.
    expect(kill({ atkSpd: 1, stunP: 1, maxHp: 200, regenAmount: 0 }).time).toBeCloseTo(1, 9);
    expect(kill({ atkSpd: 1, stunP: 1, maxHp: 300, regenAmount: 0 }).time).toBe(Infinity);
  });

  it('delays a swing by exactly the stun when one stun lands', () => {
    // Stun lands on the 1 s roll only (the stream says "land", then a long gap).
    let calls = 0;
    const draws: BlockDraws = {
      ...never(),
      stun: () => (calls++ === 0 ? 0 : 0.999999),
    };
    const r = kill({ stunP: 0.5, stunDuration: 4, maxHp: 300, regenAmount: 0 }, false, draws);
    // Hit at 0; at 1 s the bar is half full and freezes until 5 s; it fills at
    // 6 s instead of 2 s, then 8 s — every later swing exactly 4 s late.
    expect(r.hits).toBe(3);
    expect(r.time).toBeCloseTo(8, 9);
    expect(r.stunnedTime).toBeCloseTo(4, 9);
  });

  it('does not roll on the instant the block breaks', () => {
    // A block broken by the 1 s hit never rolls, so a certain stun changes nothing.
    const r = kill({ atkSpd: 1, stunP: 1, weakenP: 1, maxHp: 200, regenAmount: 0 });
    expect(r.weakenedHits).toBe(0);
    expect(r.stunnedTime).toBe(0);
  });
});

describe('averages', () => {
  /**
   * Exact expected hits for a crit-only fight with no regen, by dynamic
   * programming over remaining HP. Hits are 100 or, on a 30% crit, ×2.5 = 250.
   */
  function exactHits(maxHp: number): number {
    const f = new Float64Array(maxHp + 1);
    for (let h = 1; h <= maxHp; h++) {
      f[h] = 1 + 0.7 * f[Math.max(h - 100, 0)]! + 0.3 * f[Math.max(h - 250, 0)]!;
    }
    return f[maxHp]!;
  }

  it('matches an exact expectation within its own error bar', () => {
    const p = { ...base, critP: 0.3, critMult: 2.5, regenAmount: 0, maxHp: 5000 };
    const avg = averageKill(p, 0, 1.45);
    const hits = exactHits(5000);
    // Time is (hits − 1) swings at 2 s each.
    expect(Math.abs(avg.time - (hits - 1) * 2)).toBeLessThan(4 * avg.timeStdErr);
    expect(avg.timeStdErr).toBeGreaterThan(0);
  });

  it('gives the same answer for the same build every time', () => {
    const p = { ...base, critP: 0.2, stunP: 0.05, weakenP: 0.02, maxHp: 5000 };
    expect(averageKill(p, 0.1, 1.2, 200)).toEqual(averageKill({ ...p }, 0.1, 1.2, 200));
  });

  it('mixes brittle and full spawns by the brittle chance', () => {
    const full = averageKill(base, 0, 1).time;
    const mixed = averageKill(base, 0.25, 1).time;
    expect(mixed).toBeCloseTo(0.75 * full + 0.25 * 2, 9);
  });

  it('reports a block armour fully blocks as unmineable', () => {
    expect(averageKill({ ...base, atk: 3 }, 0, 1).unmineable).toBe(true);
  });
});

describe('blocks are independent', () => {
  // The replay starts every block fresh. That is only exact if nothing from one
  // block reaches the next, which these facts about the numbers guarantee.
  const maxRespawnCut = ESSENCE_UPGRADES.flatMap((d) =>
    d.effects.filter((e) => e.key === 'respawnReduction').map((e) => e.perLevel * d.max),
  ).reduce((a, b) => a + b, 0);

  it('lets every debuff run out during the shortest possible respawn', () => {
    expect(maxRespawnCut).toBe(5);
    for (const type of ESSENCE_TYPES) {
      const b = BLOCKS[type];
      const shortest = b.respawn - maxRespawnCut;
      for (const [chance, duration] of [
        [b.stunChance, b.stunDuration],
        [b.weakenChance, b.weakenDuration],
        [b.dazeChance, b.dazeDuration],
      ] as const) {
        if (chance > 0) expect(duration, type).toBeLessThanOrEqual(shortest);
      }
    }
  });

  it('refills the attack bar during the shortest respawn, even dazed', () => {
    for (const type of ESSENCE_TYPES) {
      const b = BLOCKS[type];
      expect((b.respawn - maxRespawnCut) * 0.5 * b.dazeMulti, type).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('block stats from the game', () => {
  it('matches the block constructors', () => {
    expect(BLOCKS.soft).toMatchObject({ health: 1000, armor: 3, regen: 5, respawn: 10, stunChance: 0 });
    expect(BLOCKS.dense).toMatchObject({ health: 2000, armor: 5, regen: 7, respawn: 12, stunChance: 0.05, stunDuration: 2 });
    expect(BLOCKS.jagged).toMatchObject({
      health: 5000, armor: 10, regen: 10, respawn: 15,
      stunChance: 0.06, stunDuration: 3,
      weakenChance: 0.02, weakenMulti: 0.5, weakenDuration: 8,
    });
    expect(BLOCKS.necrotic).toMatchObject({
      health: 7500, armor: 15, regen: 20, respawn: 20,
      stunChance: 0.08, stunDuration: 4,
      weakenChance: 0.04, weakenMulti: 0.4, weakenDuration: 10,
      dazeChance: 0.02, dazeMulti: 0.5, dazeDuration: 5,
      baseMinLoot: 1, baseMaxLoot: 3,
    });
    for (const type of ESSENCE_TYPES) expect(BLOCKS[type].regenInterval).toBe(10);
  });

  it('lands the doc\'s maxed-negate debuff chances', () => {
    const stats = { stunNegate: 0.4775, weakenNegate: 0.2525, dazeNegate: 0.2525 } as const;
    const p = combatParams('necrotic', {
      damage: 231, attackInterval: 1 / 0.57, critChance: 0, superCritChance: 0, ultraCritChance: 0,
      critDamage: 2, superCritDamage: 2, ultraCritDamage: 2, armorPen: 15, regenReduction: 3,
      ...stats,
    } as Parameters<typeof combatParams>[1]);
    expect(p.stunP).toBeCloseTo(0.0418, 4);
    expect(p.weakenP).toBeCloseTo(0.0299, 4);
    expect(p.dazeP).toBeCloseTo(0.015, 4);
    expect(p.armorLeft).toBe(0);
    expect(p.regenAmount).toBe(17);
  });
});
