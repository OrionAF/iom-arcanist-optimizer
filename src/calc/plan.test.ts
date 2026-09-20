/**
 * Gathering plan tests.
 *
 * The engine's own rates are covered by engine.test.ts. What matters here is
 * the arithmetic the plan adds on top: that the two readings of a rune order
 * agree with each other, that the walk-away point is a real moment rather than
 * a plausible-looking number, and that every refusal is a refusal for a reason
 * the caller can act on.
 */

import { describe, expect, it } from 'vitest';

import { compute } from './engine';
import { planFor, type EssencePlan, type Plan, type RunePlan } from './plan';
import { EXAMPLE_INPUT } from '../presets/example';
import { FRESH_INPUT } from '../presets/fresh';
import type { ArcanistResult } from './types';

const essenceOf = (plan: Plan): EssencePlan => {
  if (plan.kind !== 'essence') throw new Error(`expected an essence plan, got ${plan.kind}`);
  return plan;
};

const runeOf = (plan: Plan): RunePlan => {
  if (plan.kind !== 'rune') throw new Error(`expected a rune plan, got ${plan.kind}`);
  return plan;
};

/**
 * A build with known, round rates, so the worked example in the module header
 * can be checked as arithmetic rather than against whatever the engine happens
 * to produce today.
 */
function stubbed(income: number, runesPerHour: number, essenceCostPerHour: number): ArcanistResult {
  const result = compute(EXAMPLE_INPUT);
  const draft = structuredClone(result) as ArcanistResult;

  draft.essence.soft.unmineable = false;
  draft.essence.soft.essencePerHour = income;

  for (const id of ['ash', 'brine', 'chasm', 'drift', 'echo'] as const) {
    draft.altars[id].unlocked = false;
    draft.altars[id].active = false;
  }
  draft.altars.ash.unlocked = true;
  draft.altars.ash.active = true;
  draft.altars.ash.runesPerHour = runesPerHour;
  draft.altars.ash.essenceCostPerHour = essenceCostPerHour;

  for (const type of ['soft', 'dense', 'jagged', 'necrotic'] as const) draft.drain[type] = 0;
  draft.drain.soft = essenceCostPerHour;

  return draft;
}

const example = compute(EXAMPLE_INPUT);

describe('an essence goal', () => {
  it('divides the goal by the rate', () => {
    const plan = essenceOf(
      planFor(example, {
        target: { kind: 'essence', essence: 'soft' },
        quantity: 10_000,
        owned: 0,
        essenceOwned: 0,
        includeDrain: false,
      }),
    );
    expect(plan.rate).toBe(example.essence.soft.essencePerHour);
    expect(plan.hours).toBeCloseTo(10_000 / plan.rate, 10);
  });

  it('takes longer once the altars on the pool are counted', () => {
    const ask = { quantity: 10_000, owned: 0, essenceOwned: 0 } as const;
    const gross = essenceOf(
      planFor(example, { target: { kind: 'essence', essence: 'soft' }, ...ask, includeDrain: false }),
    );
    const net = essenceOf(
      planFor(example, { target: { kind: 'essence', essence: 'soft' }, ...ask, includeDrain: true }),
    );

    expect(gross.drain).toBeGreaterThan(0);
    expect(net.rate).toBeCloseTo(gross.income - gross.drain, 10);
    expect(net.hours).toBeGreaterThan(gross.hours);
  });

  it('refuses a pool the altars empty faster than it fills', () => {
    const result = stubbed(60, 60, 120);
    result.drain.soft = 120;
    const plan = planFor(result, {
      target: { kind: 'essence', essence: 'soft' },
      quantity: 500,
      owned: 0,
      essenceOwned: 0,
      includeDrain: true,
    });
    expect(plan).toEqual({
      kind: 'blocked',
      blocker: { why: 'drained', essence: 'soft', income: 60, drain: 120 },
    });
  });

  it('refuses an essence that cannot be mined at all', () => {
    // A fresh account cannot scratch Necrotic blocks.
    const result = compute(FRESH_INPUT);
    expect(result.essence.necrotic.unmineable).toBe(true);
    expect(
      planFor(result, {
        target: { kind: 'essence', essence: 'necrotic' },
        quantity: 100,
        owned: 0,
        essenceOwned: 0,
        includeDrain: false,
      }),
    ).toEqual({ kind: 'blocked', blocker: { why: 'unmineable', essence: 'necrotic' } });
  });

  it('asks for nothing when no quantity has been typed', () => {
    expect(
      planFor(example, {
        target: { kind: 'essence', essence: 'soft' },
        quantity: 0,
        owned: 0,
        essenceOwned: 0,
        includeDrain: false,
      }),
    ).toEqual({ kind: 'idle' });
  });
});

describe('a rune goal', () => {
  it('prices the essence from what the altar spends per rune', () => {
    const plan = runeOf(
      planFor(example, {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 1000,
        owned: 0,
        essenceOwned: 0,
        includeDrain: false,
      }),
    );
    const altar = example.altars.ash;
    expect(plan.essencePerRune).toBeCloseTo(altar.essenceCostPerHour / altar.runesPerHour, 10);
    expect(plan.essenceNeeded).toBeCloseTo(1000 * plan.essencePerRune, 10);
    expect(plan.essenceToMine).toBeCloseTo(plan.essenceNeeded, 10);
  });

  it('takes the longer of the two rates', () => {
    const plan = runeOf(
      planFor(example, {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 1000,
        owned: 0,
        essenceOwned: 0,
        includeDrain: false,
      }),
    );
    expect(plan.hours).toBeCloseTo(Math.max(plan.craftHours, plan.gatherHours), 10);
    expect(plan.limit).toBe(plan.craftHours >= plan.gatherHours ? 'altar' : 'mining');
  });

  /* The worked example from the module header, as arithmetic. */
  describe('when the mine outruns the altar', () => {
    // 60 runes an hour at 1 essence each, mined at 90 an hour.
    const plan = runeOf(
      planFor(stubbed(90, 60, 60), {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 0,
        essenceOwned: 0,
        includeDrain: false,
      }),
    );

    it('is paced by the altar', () => {
      expect(plan.essencePerRune).toBe(1);
      expect(plan.essenceNeeded).toBe(60);
      expect(plan.craftHours).toBe(1);
      expect(plan.gatherHours).toBeCloseTo(2 / 3, 10);
      expect(plan.limit).toBe('altar');
      expect(plan.hours).toBe(1);
      expect(plan.supply).toBe(1);
    });

    it('names the moment the mining can stop', () => {
      const surplus = plan.surplus!;
      expect(surplus.hours).toBeCloseTo(2 / 3, 10);
      expect(surplus.essence).toBeCloseTo(20, 10);
      expect(surplus.runes).toBeCloseTo(40, 10);
      expect(surplus.runesLeft).toBeCloseTo(20, 10);
      expect(surplus.hoursLeft).toBeCloseTo(1 / 3, 10);
    });

    it('leaves the altar exactly enough to finish alone', () => {
      const surplus = plan.surplus!;
      // What is banked covers what is still owed, to the unit.
      expect(surplus.essence).toBeCloseTo(surplus.runesLeft * plan.essencePerRune, 10);
      // And walking away at that point still finishes when standing over it would.
      expect(surplus.hours + surplus.hoursLeft).toBeCloseTo(plan.craftHours, 10);
    });
  });

  describe('when the altar outruns the mine', () => {
    // 60 runes an hour at 1 essence each, mined at only 30 an hour.
    const plan = runeOf(
      planFor(stubbed(30, 60, 60), {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 0,
        essenceOwned: 0,
        includeDrain: false,
      }),
    );

    it('is paced by the mining, with nothing to walk away from', () => {
      expect(plan.limit).toBe('mining');
      expect(plan.craftHours).toBe(1);
      expect(plan.gatherHours).toBe(2);
      expect(plan.hours).toBe(2);
      expect(plan.surplus).toBeUndefined();
    });

    it('reports the share of its rate the altar can hold', () => {
      expect(plan.supply).toBeCloseTo(0.5, 10);
      // Which is the same thing the plan's own duration says.
      expect(plan.quantity / (plan.runesPerHour * plan.supply)).toBeCloseTo(plan.hours, 10);
    });
  });

  it('counts the other altars on the pool only when asked', () => {
    // Brine shares Soft with Ash and takes a third of what the mine brings in.
    const result = stubbed(90, 60, 60);
    result.altars.brine.unlocked = true;
    result.altars.brine.active = true;
    result.altars.brine.essenceCostPerHour = 30;
    result.altars.brine.runesPerHour = 30;

    const ask = { target: { kind: 'rune', altar: 'ash' }, quantity: 60, owned: 0, essenceOwned: 0 } as const;
    const alone = runeOf(planFor(result, { ...ask, includeDrain: false }));
    const shared = runeOf(planFor(result, { ...ask, includeDrain: true }));

    expect(alone.otherDrain).toBe(30);
    expect(alone.miningRate).toBe(90);
    expect(shared.miningRate).toBe(60);
    // At 60 in and 60 out the altar is exactly fed, so nothing accumulates and
    // there is no walking away from it.
    expect(shared.limit).toBe('altar');
    expect(shared.surplus).toBeUndefined();
    expect(shared.hours).toBe(alone.hours);
  });

  it('ignores an altar on another pool', () => {
    const result = stubbed(90, 60, 60);
    result.altars.chasm.unlocked = true;
    result.altars.chasm.active = true;
    result.altars.chasm.essenceCostPerHour = 500;

    const plan = runeOf(
      planFor(result, {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 0,
        essenceOwned: 0,
        includeDrain: true,
      }),
    );
    expect(plan.otherDrain).toBe(0);
    expect(plan.miningRate).toBe(90);
  });

  it('refuses an altar that is not unlocked', () => {
    const result = stubbed(90, 60, 60);
    result.altars.ash.unlocked = false;
    expect(
      planFor(result, {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 0,
        essenceOwned: 0,
        includeDrain: false,
      }),
    ).toEqual({ kind: 'blocked', blocker: { why: 'locked', altar: 'ash' } });
  });

  it('plans for an unlocked altar that is switched off, and says so', () => {
    const result = stubbed(90, 60, 60);
    result.altars.ash.active = false;
    result.drain.soft = 0;
    const plan = runeOf(
      planFor(result, {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 0,
        essenceOwned: 0,
        includeDrain: true,
      }),
    );
    expect(plan.idle).toBe(true);
    expect(plan.hours).toBe(1);
  });
});

describe('what is already held', () => {
  it('takes essence owned off an essence goal', () => {
    const base = { target: { kind: 'essence', essence: 'soft' }, essenceOwned: 0, includeDrain: false } as const;
    const whole = essenceOf(planFor(example, { ...base, quantity: 10_000, owned: 0 }));
    const part = essenceOf(planFor(example, { ...base, quantity: 10_000, owned: 4000 }));

    expect(part.needed).toBe(6000);
    expect(part.rate).toBe(whole.rate);
    expect(part.hours).toBeCloseTo(whole.hours * 0.6, 10);
  });

  it('calls an essence goal done once it is covered', () => {
    expect(
      planFor(example, {
        target: { kind: 'essence', essence: 'soft' },
        quantity: 10_000,
        owned: 10_000,
        essenceOwned: 0,
        includeDrain: false,
      }),
    ).toEqual({ kind: 'done', have: 10_000, want: 10_000 });
  });

  it('takes runes owned off the order and the essence bill with them', () => {
    // 60 an hour at 1 essence each, mined at 90: the header's worked example.
    const plan = runeOf(
      planFor(stubbed(90, 60, 60), {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 30,
        essenceOwned: 0,
        includeDrain: false,
      }),
    );
    expect(plan.runesNeeded).toBe(30);
    expect(plan.essenceNeeded).toBe(30);
    expect(plan.essenceToMine).toBe(30);
    expect(plan.craftHours).toBe(0.5);
    expect(plan.hours).toBe(0.5);
    // The walk-away figures are what will be on screen, so the runes already
    // held are part of them.
    expect(plan.surplus!.runes).toBeCloseTo(30 + 60 / 3, 10);
    expect(plan.surplus!.runesLeft).toBeCloseTo(10, 10);
  });

  it('calls a rune goal done once it is covered', () => {
    expect(
      planFor(stubbed(90, 60, 60), {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 75,
        essenceOwned: 0,
        includeDrain: false,
      }),
    ).toEqual({ kind: 'done', have: 75, want: 60 });
  });

  it('spends essence already in the pool before any is mined', () => {
    const plan = runeOf(
      planFor(stubbed(90, 60, 60), {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 0,
        essenceOwned: 20,
        includeDrain: false,
      }),
    );
    expect(plan.essenceNeeded).toBe(60);
    expect(plan.essenceToMine).toBe(40);
    expect(plan.gatherHours).toBeCloseTo(40 / 90, 10);
    expect(plan.hours).toBe(1);
    // Starting 20 up, the pool is 20 up at the walk-away point too.
    expect(plan.surplus!.essence).toBeCloseTo(20 + 30 * (40 / 90), 10);
    expect(plan.surplus!.essence).toBeCloseTo(
      plan.surplus!.runesLeft * plan.essencePerRune,
      10,
    );
  });

  it('hands the pacing back to the altar when the stock covers the shortfall', () => {
    // Mining 30 an hour against an altar that wants 60: short by half.
    const short = { target: { kind: 'rune', altar: 'ash' }, quantity: 60, owned: 0 } as const;
    const bare = runeOf(planFor(stubbed(30, 60, 60), { ...short, essenceOwned: 0, includeDrain: false }));
    const stocked = runeOf(planFor(stubbed(30, 60, 60), { ...short, essenceOwned: 30, includeDrain: false }));

    expect(bare.limit).toBe('mining');
    expect(bare.hours).toBe(2);

    // 30 in the pool covers exactly the 30 the mining will not deliver in time.
    expect(stocked.essenceToMine).toBe(30);
    expect(stocked.gatherHours).toBe(1);
    expect(stocked.limit).toBe('altar');
    expect(stocked.hours).toBe(1);
    expect(stocked.surplus).toBeUndefined();
  });

  it('says how long a stock holds the altar at full rate', () => {
    const plan = runeOf(
      planFor(stubbed(30, 60, 60), {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 600,
        owned: 0,
        essenceOwned: 45,
        includeDrain: false,
      }),
    );
    // Draining 60, fed 30: a 45 stock lasts an hour and a half.
    expect(plan.limit).toBe('mining');
    expect(plan.fullRateHours).toBeCloseTo(1.5, 10);
  });

  it('never runs dry where the mining already covers the altar', () => {
    const plan = runeOf(
      planFor(stubbed(90, 60, 60), {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 0,
        essenceOwned: 0,
        includeDrain: false,
      }),
    );
    expect(plan.fullRateHours).toBe(Number.POSITIVE_INFINITY);
  });

  it('plans an order the pool can already pay for, unmineable essence and all', () => {
    // Nothing to mine, so nothing about the mining can stand in the way.
    const result = stubbed(90, 60, 60);
    result.essence.soft.unmineable = true;
    result.essence.soft.essencePerHour = 0;

    const plan = runeOf(
      planFor(result, {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 0,
        essenceOwned: 60,
        includeDrain: false,
      }),
    );
    expect(plan.essenceToMine).toBe(0);
    expect(plan.gatherHours).toBe(0);
    expect(plan.limit).toBe('altar');
    expect(plan.hours).toBe(1);
    // Walking away is free from the start: the essence is already there.
    expect(plan.surplus!.hours).toBe(0);
    expect(plan.surplus!.essence).toBe(60);
    expect(plan.surplus!.runes).toBe(0);
  });

  it('still refuses an order the pool cannot cover on unmineable essence', () => {
    const result = stubbed(90, 60, 60);
    result.essence.soft.unmineable = true;
    result.essence.soft.essencePerHour = 0;

    expect(
      planFor(result, {
        target: { kind: 'rune', altar: 'ash' },
        quantity: 60,
        owned: 0,
        essenceOwned: 59,
        includeDrain: false,
      }),
    ).toEqual({ kind: 'blocked', blocker: { why: 'unmineable', essence: 'soft' } });
  });
});
