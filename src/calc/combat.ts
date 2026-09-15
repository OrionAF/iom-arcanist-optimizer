/**
 * Essence block combat, replayed exactly as the game runs it.
 *
 * Source: docs/essence_block_combat.html, decompiled from the game's
 * `tickArcanistTime` and `attackEssence`. The game advances time from event to
 * event, not in ticks, and so does this. `killBlock` is that step loop, cut
 * down to the parts that decide when a block dies: your attack bar, the
 * block's regen and debuff clocks, and your Stun, Weaken and Daze timers.
 *
 * Averages come from replaying many blocks, not from a closed form. There is
 * no exact closed form: debuffs shift when swings land, swing timing decides
 * how many regen bursts a block gets, and crits make the hit count random.
 * Replaying them is the only way to count all three together. Three things keep
 * this usable inside the optimizer:
 *
 *   - Common random numbers. Sample `i` always draws from the same seeded
 *     streams, every hit takes a fixed number of draws, and each debuff has a
 *     stream of its own. The same build always gives the same answer, and two
 *     nearby builds face the same luck, so their difference is the build, not
 *     the noise.
 *   - Rolls that land nothing are skipped. Each second's roll is an independent
 *     coin flip, so the wait until a debuff next lands is geometric and can be
 *     drawn directly. The odds are identical to flipping every second, with
 *     far fewer steps against high-HP blocks.
 *   - A cache keyed on the combat inputs. Most upgrades (loot, shiny, altars,
 *     spells) change none of them, so they cost nothing to score.
 *
 * Blocks are independent, which is what lets one block's replay stand for an
 * hour of mining. That relies on two facts about the game data, both pinned in
 * `combat.test.ts`: every debuff runs out before the shortest possible
 * respawn, so nothing carries over, and the attack bar always refills during
 * respawn, so every block opens with a hit at the moment it spawns.
 */

import type { WeightedOutcome } from './types';

/** GameMaker's comparison tolerance, `g_GMLMathEpsilon`. */
export const GML_EPSILON = 0.00001;

/** The block rolls for debuffs this often (`debuff_proc_delay`). */
export const DEBUFF_ROLL_INTERVAL = 1;

/** A brittle block spawns at this share of its max HP. */
export const BRITTLE_HP_FRACTION = 1 / 5;

/**
 * Blocks replayed per average for the figures on screen. Fixed, so the same
 * build always agrees with itself. The optimizer uses fewer; see
 * `OPTIMIZER_SAMPLES`.
 */
export const COMBAT_SAMPLES = 10000;

/**
 * Longest single block the replay will follow, in seconds. A block that takes
 * longer is one your damage barely outpaces its regen on. It is reported as
 * unmineable rather than as a rate nobody would mine at.
 */
export const KILL_TIME_CAP = 6 * 3600;

const gt0 = (x: number) => x > GML_EPSILON;

/** `non_bankers_rounding`: .5 rounds up. */
export const roundHalfUp = (x: number) => Math.floor(x + 0.5);

/**
 * The game's `chance(a, b)` as a probability: an integer roll 1..b succeeds
 * when it is at most `a`, so only the whole part of `a` counts.
 */
export const chanceOf = (a: number, b: number) =>
  a <= 0 ? 0 : Math.min(Math.floor(a + GML_EPSILON), b) / b;

/** Chance a crit, super crit or ultra crit rolls, from a stat stored as a fraction. */
export const critRollChance = (fraction: number) => chanceOf(fraction * 100, 100);
/** Chance a debuff negate, or brittle, rolls: out of 10,000. */
export const tenThousandthChance = (fraction: number) => chanceOf(fraction * 10000, 10000);
/** Chance a shiny, super shiny or ultra shiny rolls: out of 1,000. */
export const shinyRollChance = (fraction: number) => chanceOf(fraction * 1000, 1000);

/** Everything about one block and the Arcanist facing it that decides how long it lives. */
export interface CombatParams {
  /** Your damage, a whole number. */
  atk: number;
  /** Hits per second while not dazed: `0.5 × (1 + attack speed)`. */
  atkSpd: number;
  /** Block armour left after your pen, never below 0. */
  armorLeft: number;
  /** Roll chances, already reduced to what the game's integer rolls can hit. */
  critP: number;
  superP: number;
  ultraP: number;
  critMult: number;
  superMult: number;
  ultraMult: number;
  maxHp: number;
  regenAmount: number;
  regenTime: number;
  /** Chance per roll that each debuff lands, negate included. */
  stunP: number;
  stunDuration: number;
  weakenP: number;
  weakenEffect: number;
  weakenDuration: number;
  dazeP: number;
  dazeEffect: number;
  dazeDuration: number;
}

/** What one replayed block went through. */
export interface KillRecord {
  /** Seconds from spawn to the killing hit, or Infinity past the cap. */
  time: number;
  hits: number;
  weakenedHits: number;
  heals: number;
  stunnedTime: number;
  dazedTime: number;
}

// ---------------------------------------------------------------------------
// Random streams
// ---------------------------------------------------------------------------

/** mulberry32: small, fast, and good enough for dice. */
function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedFor = (sample: number, purpose: number) =>
  Math.imul(sample + 1, 0x9e3779b1) ^ Math.imul(purpose + 1, 0x85ebca77);

// ---------------------------------------------------------------------------
// One block
// ---------------------------------------------------------------------------

/** `calc_partial_multiplier`: a fraction rounds up with probability equal to itself. */
function partial(x: number, u: number): number {
  const whole = Math.floor(x);
  const up = chanceOf((x - whole) * 10000, 10000);
  return u < up ? whole + 1 : whole;
}

/** Whole seconds until a 1-second roll with chance `p` next succeeds. */
function rollsUntilLanding(p: number, u: number): number {
  if (p <= 0) return Infinity;
  if (p >= 1) return 1;
  return Math.max(1, Math.ceil(Math.log(1 - u) / Math.log(1 - p)));
}

/** Random draws for one block: one stream for hits, one per debuff. */
export interface BlockDraws {
  /** Four per hit: crit, super crit, ultra crit, fraction. */
  hit: () => number;
  stun: () => number;
  weaken: () => number;
  daze: () => number;
}

/**
 * Replay one block from spawn to its killing hit.
 *
 * Follows the pass order of `tickArcanistTime` (doc section 03): charge the
 * bar unless stunned, regen, attack, then roll debuffs if the block survived,
 * then tick your debuff timers down and refresh attack speed if one changed.
 * Rolls happen at 1 s, 2 s, 3 s… after spawn; only the ones that land are
 * visited, in the game's order (weaken, daze, stun).
 *
 * One liberty, which changes no outcome: while stunned the game still offers
 * "time until the bar fills" as a step length, though the bar cannot move. It
 * would take the same total time in many small steps; this takes one.
 */
export function killBlock(
  p: CombatParams,
  brittle: boolean,
  draws: BlockDraws,
): KillRecord {
  let hp = brittle ? p.maxHp * BRITTLE_HP_FRACTION : p.maxHp;
  let progress = 1; // Full at spawn: see the module header.
  let stun = 0;
  let weaken = 0;
  let daze = 0;
  let tillRegen = p.regenTime;
  // The roll second (1, 2, 3…) on which each debuff next lands.
  let nextWeaken = rollsUntilLanding(p.weakenP, draws.weaken()) * DEBUFF_ROLL_INTERVAL;
  let nextDaze = rollsUntilLanding(p.dazeP, draws.daze()) * DEBUFF_ROLL_INTERVAL;
  let nextStun = rollsUntilLanding(p.stunP, draws.stun()) * DEBUFF_ROLL_INTERVAL;
  let tillRoll = Math.min(nextWeaken, nextDaze, nextStun);
  let atkSpd = p.atkSpd;
  let time = 0;

  const record: KillRecord = {
    time: 0,
    hits: 0,
    weakenedHits: 0,
    heals: 0,
    stunnedTime: 0,
    dazedTime: 0,
  };

  while (time <= KILL_TIME_CAP) {
    let step = Infinity;
    if (gt0(stun)) step = Math.min(step, stun);
    if (gt0(weaken)) step = Math.min(step, weaken);
    if (gt0(daze)) step = Math.min(step, daze);
    step = Math.min(step, tillRoll, tillRegen);
    const stunned = gt0(stun);
    if (!stunned) step = Math.max(0, Math.min(step, (1 - progress) / atkSpd));

    if (stunned) record.stunnedTime += step;
    if (gt0(daze)) record.dazedTime += step;

    if (!stunned) progress += step * atkSpd;

    tillRegen -= step;
    if (!gt0(tillRegen)) {
      hp = Math.min(p.maxHp, hp + p.regenAmount);
      tillRegen += p.regenTime;
      record.heals++;
    }

    let needStats = false;

    if (progress >= 1 - GML_EPSILON) {
      const weakened = gt0(weaken);
      const u1 = draws.hit();
      const u2 = draws.hit();
      const u3 = draws.hit();
      const u4 = draws.hit();
      const base = weakened ? roundHalfUp(p.atk * p.weakenEffect) : p.atk;
      let dmg = Math.max(base - p.armorLeft, 0);
      if (u1 < p.critP) {
        dmg *= p.critMult;
        if (u2 < p.superP) {
          dmg *= p.superMult;
          if (u3 < p.ultraP) dmg *= p.ultraMult;
        }
      }
      hp = Math.max(hp - partial(dmg, u4), 0);
      progress -= 1;
      record.hits++;
      if (weakened) record.weakenedHits++;
    }

    if (hp > 0) {
      tillRoll -= step;
      if (!gt0(tillRoll)) {
        const second = Math.min(nextWeaken, nextDaze, nextStun);
        // Written as duration + step: the tick-down below takes the step back.
        if (nextWeaken === second) {
          weaken = p.weakenDuration + step;
          needStats = true;
          nextWeaken += rollsUntilLanding(p.weakenP, draws.weaken()) * DEBUFF_ROLL_INTERVAL;
        }
        if (nextDaze === second) {
          daze = p.dazeDuration + step;
          needStats = true;
          nextDaze += rollsUntilLanding(p.dazeP, draws.daze()) * DEBUFF_ROLL_INTERVAL;
        }
        if (nextStun === second) {
          stun = p.stunDuration + step;
          nextStun += rollsUntilLanding(p.stunP, draws.stun()) * DEBUFF_ROLL_INTERVAL;
        }
        tillRoll += Math.min(nextWeaken, nextDaze, nextStun) - second;
      }
    }

    if (gt0(stun)) {
      stun -= step;
      if (!gt0(stun)) needStats = true;
    }
    if (gt0(weaken)) {
      weaken -= step;
      if (!gt0(weaken)) needStats = true;
    }
    if (gt0(daze)) {
      daze -= step;
      if (!gt0(daze)) needStats = true;
    }
    if (needStats) atkSpd = p.atkSpd * (gt0(daze) ? p.dazeEffect : 1);

    time += step;

    if (hp <= 0) {
      record.time = time;
      return record;
    }
  }

  record.time = Infinity;
  return record;
}

// ---------------------------------------------------------------------------
// Averages
// ---------------------------------------------------------------------------

/** The average block, over the replayed samples. */
export interface KillAverages {
  /** Seconds from spawn to kill. Infinity when unmineable. */
  time: number;
  /** Standard error of `time`, from the spread of the replays. */
  timeStdErr: number;
  hits: number;
  /** Share of hits that landed weakened. */
  weakenedShare: number;
  heals: number;
  stunnedTime: number;
  dazedTime: number;
  unmineable: boolean;
}

interface Tally {
  time: number;
  timeSq: number;
  hits: number;
  weakenedHits: number;
  heals: number;
  stunnedTime: number;
  dazedTime: number;
  capped: boolean;
}

function replay(p: CombatParams, brittle: boolean, samples: number): Tally {
  const t: Tally = {
    time: 0,
    timeSq: 0,
    hits: 0,
    weakenedHits: 0,
    heals: 0,
    stunnedTime: 0,
    dazedTime: 0,
    capped: false,
  };
  for (let i = 0; i < samples; i++) {
    const r = killBlock(p, brittle, {
      hit: stream(seedFor(i, 1)),
      stun: stream(seedFor(i, 2)),
      weaken: stream(seedFor(i, 3)),
      daze: stream(seedFor(i, 4)),
    });
    if (!Number.isFinite(r.time)) {
      t.capped = true;
      return t;
    }
    t.time += r.time / samples;
    t.timeSq += (r.time * r.time) / samples;
    t.hits += r.hits / samples;
    t.weakenedHits += r.weakenedHits / samples;
    t.heals += r.heals / samples;
    t.stunnedTime += r.stunnedTime / samples;
    t.dazedTime += r.dazedTime / samples;
  }
  return t;
}

/**
 * Can this build ever outpace the block? False when your unweakened hit does
 * nothing after armour, or when your average damage per regen interval, before
 * any debuff slows it further, cannot beat one regen burst.
 */
export function canOutpaceRegen(p: CombatParams, expectedCrit: number): boolean {
  const hit = Math.max(p.atk - p.armorLeft, 0);
  if (hit <= 0) return false;
  return hit * expectedCrit * p.atkSpd * p.regenTime > p.regenAmount;
}

const cache = new Map<string, KillAverages>();
const CACHE_LIMIT = 512;

/**
 * The average block for these combat inputs, mixing full and brittle spawns by
 * `brittleP`. Brittle is resolved exactly rather than sampled: each kind of
 * spawn is replayed on its own and weighted by its chance.
 */
export function averageKill(
  p: CombatParams,
  brittleP: number,
  expectedCrit: number,
  samples = COMBAT_SAMPLES,
): KillAverages {
  const key = `${samples}|${brittleP}|${Object.values(p).join('|')}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let out: KillAverages;
  const unmineable: KillAverages = {
    time: Infinity,
    timeStdErr: 0,
    hits: Infinity,
    weakenedShare: 0,
    heals: 0,
    stunnedTime: 0,
    dazedTime: 0,
    unmineable: true,
  };

  if (!canOutpaceRegen(p, expectedCrit)) {
    out = unmineable;
  } else {
    const full = replay(p, false, samples);
    const brittle = brittleP > 0 ? replay(p, true, samples) : undefined;
    if (full.capped || brittle?.capped) {
      out = unmineable;
    } else {
      const b = brittle ? brittleP : 0;
      const mix = (f: number, g: number | undefined) => (1 - b) * f + b * (g ?? 0);
      const time = mix(full.time, brittle?.time);
      // Variance of a mixture of two independent sample means.
      const varFull = Math.max(full.timeSq - full.time ** 2, 0) / samples;
      const varBrittle = brittle ? Math.max(brittle.timeSq - brittle.time ** 2, 0) / samples : 0;
      const hits = mix(full.hits, brittle?.hits);
      out = {
        time,
        timeStdErr: Math.sqrt((1 - b) ** 2 * varFull + b ** 2 * varBrittle),
        hits,
        weakenedShare: hits > 0 ? mix(full.weakenedHits, brittle?.weakenedHits) / hits : 0,
        heals: mix(full.heals, brittle?.heals),
        stunnedTime: mix(full.stunnedTime, brittle?.stunnedTime),
        dazedTime: mix(full.dazedTime, brittle?.dazedTime),
        unmineable: false,
      };
    }
  }

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, out);
  return out;
}

/** The nested crit ladder as exclusive outcomes, with the chances the game can actually roll. */
export function critOutcomes(
  p: Pick<CombatParams, 'critP' | 'superP' | 'ultraP' | 'critMult' | 'superMult' | 'ultraMult'>,
): WeightedOutcome[] {
  const { critP: c, superP: s, ultraP: u, critMult: cm, superMult: sm, ultraMult: um } = p;
  return [
    { label: 'no crit', chance: 1 - c, value: 1 },
    { label: 'crit', chance: c * (1 - s), value: cm },
    { label: 'super crit', chance: c * s * (1 - u), value: cm * sm },
    { label: 'ultra crit', chance: c * s * u, value: cm * sm * um },
  ];
}
