/**
 * Goal-seek: how long a pile of essence or runes takes to gather.
 *
 * The rest of the app answers "what is my rate"; this answers "when do I have
 * what I came for", which is the question a player actually schedules an
 * evening around. It is a reading of an already-computed `ArcanistResult`
 * rather than a second model, so it can never disagree with the ledger.
 *
 * Runes are the interesting half. An altar and a mine run at their own
 * independent rates, so one of them finishes first, and which one it is changes
 * the advice completely:
 *
 * - The altar is slower. Then the essence is all in hand before the altar has
 *   spent it, and a stock builds up behind it. Nobody has to stand and watch it
 *   drain: once that stock covers what the altar still owes, the mine is free
 *   to move to another essence. `surplus` is the moment that becomes true.
 * - The mine is slower. Then the altar stalls waiting on essence and runs at a
 *   fraction of its rate. Nothing can be walked away from, and the plan takes
 *   as long as the mining does.
 *
 * What is already in the satchel is subtracted before any of that, and it is
 * subtracted in two different places for a rune goal: runes already held come
 * off the order, and essence already in the pool comes off the mining. Essence
 * in hand is the more interesting of the two, because it can carry the altar
 * through a shortfall the mining alone could not — enough of it turns a plan
 * the mine was holding back into one the altar sets the pace for.
 */

import { ALTAR_IDS } from './constants';
import type { AltarId, ArcanistResult, EssenceType, Resource } from './types';

/** What is being saved up for. */
export type PlanTarget =
  | { kind: 'essence'; essence: EssenceType }
  | { kind: 'rune'; altar: AltarId };

export interface PlanRequest {
  target: PlanTarget;
  /** How many of it are wanted, all in. */
  quantity: number;
  /** How many are already held, in the goal's own unit. */
  owned: number;
  /** For a rune goal only: essence already sitting in the pool it draws from. */
  essenceOwned: number;
  /**
   * Count what the altars take out of the pool being mined.
   *
   * For an essence goal that is every altar on it. For a rune goal it is every
   * altar *except* the one being planned for, whose share is modelled in full
   * rather than merely subtracted.
   */
  includeDrain: boolean;
}

/** Why there is no plan to give. The wording lives in the UI. */
export type Blocker =
  | { why: 'unmineable'; essence: EssenceType }
  | { why: 'locked'; altar: AltarId }
  /** The counted altars take at least as much as the mine brings in. */
  | { why: 'drained'; essence: EssenceType; income: number; drain: number }
  | { why: 'silent'; altar: AltarId };

export interface EssencePlan {
  kind: 'essence';
  essence: EssenceType;
  quantity: number;
  owned: number;
  /** Still to mine, once what is held comes off. */
  needed: number;
  /** Mined per hour, before any altar spends it. */
  income: number;
  /** What every altar on this pool takes per hour, counted or not. */
  drain: number;
  /** Income, minus the drain where it is being counted. */
  rate: number;
  hours: number;
}

export interface RunePlan {
  kind: 'rune';
  altar: AltarId;
  rune: Resource;
  /** The essence this altar eats. */
  essence: EssenceType;
  quantity: number;
  runesOwned: number;
  essenceOwned: number;
  /** Runes the altar still has to craft. */
  runesNeeded: number;
  /** Runes per hour with the pool kept full. */
  runesPerHour: number;
  /** Essence one rune costs. */
  essencePerRune: number;
  /** Essence those remaining runes cost, all in. */
  essenceNeeded: number;
  /** That bill, minus what is already in the pool. */
  essenceToMine: number;
  /** What this altar alone takes per hour, at full rate. */
  altarDrain: number;
  /** What the other altars on the same pool take per hour. */
  otherDrain: number;
  income: number;
  /** Essence per hour reaching this altar, once `includeDrain` is applied. */
  miningRate: number;
  /** Hours the altar needs with the pool kept full. */
  craftHours: number;
  /** Hours of mining the essence still to be mined takes. */
  gatherHours: number;
  /** The longer of the two. */
  hours: number;
  /** Which of the two sets the pace. */
  limit: 'altar' | 'mining';
  /** Share of its full rate the altar holds once the pool is dry, 0..1. */
  supply: number;
  /**
   * Hours the stock in the pool keeps the altar at full rate before it runs
   * dry. Infinite where the mining alone already covers the altar, so it never
   * does — only worth reading where the mining sets the pace.
   */
  fullRateHours: number;
  /** Where the mine outruns the altar: the point it can be walked away from. */
  surplus?: {
    /** Hours of mining before then. Zero where the essence is already in hand. */
    hours: number;
    /** Essence in the pool at that moment — the number to watch for. */
    essence: number;
    /** Runes held by then, the ones already owned included. */
    runes: number;
    /** Runes the altar still owes. */
    runesLeft: number;
    /** Hours it takes to finish them, unattended. */
    hoursLeft: number;
  };
  /** Unlocked but switched off, so the plan assumes it gets turned on. */
  idle: boolean;
}

export type Plan =
  /** Nothing asked for yet. */
  | { kind: 'idle' }
  /** Already held, so there is nothing to plan. */
  | { kind: 'done'; have: number; want: number }
  | { kind: 'blocked'; blocker: Blocker }
  | EssencePlan
  | RunePlan;

export function planFor(result: ArcanistResult, request: PlanRequest): Plan {
  return request.target.kind === 'essence'
    ? essencePlan(result, request.target.essence, request)
    : runePlan(result, request.target.altar, request);
}

function essencePlan(
  result: ArcanistResult,
  essence: EssenceType,
  { quantity, owned, includeDrain }: PlanRequest,
): Plan {
  if (quantity <= 0) return { kind: 'idle' };

  const needed = quantity - owned;
  if (needed <= 0) return { kind: 'done', have: owned, want: quantity };

  const outcome = result.essence[essence];
  if (outcome.unmineable) return { kind: 'blocked', blocker: { why: 'unmineable', essence } };

  const income = outcome.essencePerHour;
  const drain = result.drain[essence];
  const rate = includeDrain ? income - drain : income;
  if (rate <= 0) return { kind: 'blocked', blocker: { why: 'drained', essence, income, drain } };

  return {
    kind: 'essence',
    essence,
    quantity,
    owned,
    needed,
    income,
    drain,
    rate,
    hours: needed / rate,
  };
}

function runePlan(
  result: ArcanistResult,
  id: AltarId,
  { quantity, owned, essenceOwned, includeDrain }: PlanRequest,
): Plan {
  const altar = result.altars[id];
  if (!altar.unlocked) return { kind: 'blocked', blocker: { why: 'locked', altar: id } };

  // Nominal, not sustained: the sustained figure already has a supply limit
  // baked into it, and that limit is exactly what this module works out itself.
  const runesPerHour = altar.runesPerHour;
  if (runesPerHour <= 0) return { kind: 'blocked', blocker: { why: 'silent', altar: id } };

  if (quantity <= 0) return { kind: 'idle' };

  const runesNeeded = quantity - owned;
  if (runesNeeded <= 0) return { kind: 'done', have: owned, want: quantity };

  const essence = altar.consumes;
  const altarDrain = altar.essenceCostPerHour;
  const essencePerRune = altarDrain / runesPerHour;
  const essenceNeeded = runesNeeded * essencePerRune;
  const essenceToMine = Math.max(0, essenceNeeded - essenceOwned);

  const outcome = result.essence[essence];
  const otherDrain = ALTAR_IDS.reduce((sum, other) => {
    if (other === id) return sum;
    const each = result.altars[other];
    const shares = each.unlocked && each.active && each.consumes === essence;
    return shares ? sum + each.essenceCostPerHour : sum;
  }, 0);
  const income = outcome.essencePerHour;
  const miningRate = includeDrain ? income - otherDrain : income;

  /*
   * The mining only has to be possible where the plan actually calls for some.
   * A pool already holding everything the order needs is a plan the altar runs
   * on its own, and refusing it because the blocks are out of reach today would
   * be answering a question nobody asked.
   */
  if (essenceToMine > 0) {
    if (outcome.unmineable) return { kind: 'blocked', blocker: { why: 'unmineable', essence } };
    if (miningRate <= 0) {
      return { kind: 'blocked', blocker: { why: 'drained', essence, income, drain: otherDrain } };
    }
  }

  /*
   * The altar crafts `min(full rate, whatever essence has reached it)`, and
   * both of those are straight lines in time — so each gives a finish time and
   * the real one is the later of the two. A stock in the pool shifts the mining
   * line up rather than changing its slope, which is why enough of it can hand
   * the pacing back to the altar even where the mining alone falls short.
   */
  const craftHours = runesNeeded / runesPerHour;
  const gatherHours = essenceToMine > 0 ? essenceToMine / miningRate : 0;

  /*
   * The walk-away point.
   *
   * At `gatherHours` the last of the essence has been mined, and the altar has
   * been eating the whole time — so what is left in the pool is exactly what
   * the altar still needs. The two readings agree: mining for `gatherHours` and
   * then leaving finishes the order at `craftHours`, the same moment standing
   * over it would.
   */
  const surplus =
    gatherHours < craftHours
      ? {
          hours: gatherHours,
          essence: essenceOwned + (miningRate - altarDrain) * gatherHours,
          runes: owned + runesPerHour * gatherHours,
          runesLeft: runesNeeded - runesPerHour * gatherHours,
          hoursLeft: craftHours - gatherHours,
        }
      : undefined;

  return {
    kind: 'rune',
    altar: id,
    rune: altar.rune,
    essence,
    quantity,
    runesOwned: owned,
    essenceOwned,
    runesNeeded,
    runesPerHour,
    essencePerRune,
    essenceNeeded,
    essenceToMine,
    altarDrain,
    otherDrain,
    income,
    miningRate,
    craftHours,
    gatherHours,
    hours: Math.max(craftHours, gatherHours),
    limit: craftHours >= gatherHours ? 'altar' : 'mining',
    supply: altarDrain > 0 ? Math.min(1, Math.max(0, miningRate / altarDrain)) : 1,
    fullRateHours:
      altarDrain > miningRate ? essenceOwned / (altarDrain - miningRate) : Number.POSITIVE_INFINITY,
    surplus,
    idle: !altar.active,
  };
}
