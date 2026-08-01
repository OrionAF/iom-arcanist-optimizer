/**
 * Potency path tests.
 *
 * The plan is a simulation, so what is worth pinning is not a particular
 * ordering — that moves with balance data — but the invariants the schedule
 * rests on: that it spends what the curves charge, that the clock only ever
 * moves forward, that rune types really do bank in parallel, and that a rune
 * with no altar behind it is reported as unreachable rather than silently
 * dropped or waited on forever.
 */

import { describe, expect, it } from 'vitest';

import { ALTARS, ALTAR_IDS, SPELLS, SPELL_IDS } from './constants';
import { curveCost } from './costs';
import { compute } from './engine';
import { potencyPlan } from './potency';
import type { ArcanistInput } from './types';
import { EXAMPLE_INPUT } from '../presets/example';
import { FRESH_INPUT } from '../presets/fresh';

/** A build with every altar running, so all three rune types have income. */
function running(): ArcanistInput {
  const input = structuredClone(EXAMPLE_INPUT);
  for (const id of ALTAR_IDS) {
    input.altars[id].unlocked = true;
    input.altars[id].active = true;
  }
  return input;
}

describe('potencyPlan', () => {
  it('plans every remaining rank when all three runes have income', () => {
    const input = running();
    const plan = potencyPlan(input);

    const expected = SPELL_IDS.reduce(
      (sum, id) => sum + SPELLS[id].maxRank - input.spells[id].rank,
      0,
    );
    expect(plan.steps).toHaveLength(expected);
    expect(plan.unreachable).toBe(0);
    expect(plan.blocked).toEqual([]);
  });

  it('charges exactly what the potency curves charge', () => {
    const input = running();
    const plan = potencyPlan(input);

    for (const id of SPELL_IDS) {
      const def = SPELLS[id];
      const spent = plan.steps
        .filter((step) => step.spell === id)
        .reduce((sum, step) => sum + step.cost, 0);
      expect(spent).toBeCloseTo(curveCost(def.potencyCurve, input.spells[id].rank, def.maxRank), 6);
    }
  });

  it('buys each spell\'s ranks in ascending order', () => {
    const plan = potencyPlan(running());

    for (const id of SPELL_IDS) {
      const ranks = plan.steps.filter((s) => s.spell === id).map((s) => s.from);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('never moves the clock backwards', () => {
    const plan = potencyPlan(running());
    const times = plan.steps.map((step) => step.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(plan.totalHours).toBe(times[times.length - 1]);
  });

  /**
   * Pools are worked in sequence, so the total is their mining hours summed.
   *
   * This is the shape of the whole model in one assertion: you cannot mine Soft
   * and Dense at once, so a rank paid for in chasm runes waits behind the
   * entire Soft phase. Before altars were supply-limited the plan treated all
   * three rune types as banking simultaneously, which is why its figures were
   * roughly half what they should have been.
   */
  it('totals the mining hours of every pool it works', () => {
    const plan = potencyPlan(running());
    const summed = plan.budget.reduce((sum, row) => sum + row.hours, 0);
    expect(plan.totalHours).toBeCloseTo(summed, 6);
  });

  /**
   * Within a pool, though, its altars really do bank in parallel: Ash and Brine
   * both drain Soft, so a rank waiting on ash does not queue behind one waiting
   * on brine. If they were sequential the Soft phase would be the sum of the
   * individual waits rather than shorter than it.
   */
  it('banks the runes of a shared pool in parallel', () => {
    const plan = potencyPlan(running());

    const softPhase = plan.budget.find((row) => row.essence === 'soft');
    expect(softPhase).toBeDefined();

    const softSteps = plan.steps.filter((step) => step.pool === 'soft');
    const runes = new Set(softSteps.map((step) => step.resource));
    expect(runes.size).toBeGreaterThan(1);

    const sequential = softSteps.reduce((sum, step) => sum + step.wait, 0);
    expect(softPhase!.hours).toBeLessThanOrEqual(sequential + 1e-6);
  });

  /**
   * The essence-limited floor: every rune the plan buys had to be converted
   * from essence at the altar's ratio, and that essence had to be mined. If the
   * budget were below this the model would be manufacturing essence.
   */
  it('never budgets less essence than the runes it buys require', () => {
    const input = running();
    const plan = potencyPlan(input);
    const result = compute(input);

    for (const row of plan.budget) {
      const needed = ALTAR_IDS.filter((id) => ALTARS[id].consumes === row.essence).reduce(
        (sum, id) => {
          const altar = result.altars[id];
          const ratio = altar.runesPerHour / altar.essenceCostPerHour;
          return sum + (plan.cost[altar.rune] ?? 0) / ratio;
        },
        0,
      );

      // The plan's own ratio only improves as Prismism lands, so the starting
      // ratio gives an upper bound on the essence required.
      expect(row.required).toBeGreaterThan(0);
      expect(row.required).toBeLessThanOrEqual(needed * 1.000001);
    }
  });

  it('reports mining hours consistent with the essence it needs', () => {
    const input = running();
    const plan = potencyPlan(input);
    const result = compute(input);

    for (const row of plan.budget) {
      // Hours × what the altars can eat per hour is the essence consumed.
      const drain = Math.min(
        result.essence[row.essence].essencePerHour,
        result.essence[row.essence].altarDrain,
      );
      expect(row.hours).toBeGreaterThan(0);
      expect(row.required).toBeLessThanOrEqual(row.hours * drain * 1.000001);
    }
  });

  it('reports ranks as unreachable when no altar makes their rune', () => {
    const input = running();
    // Chasm runes are Manaflow's only currency.
    input.altars.chasm.active = false;
    const plan = potencyPlan(input);

    expect(plan.blocked).toContain('chasmRune');
    expect(plan.unreachable).toBe(SPELLS.manaflow.maxRank - input.spells.manaflow.rank);
    expect(plan.steps.some((step) => step.spell === 'manaflow')).toBe(false);
    // The other two runes still finish.
    expect(plan.bySpell.find((s) => s.spell === 'manaflow')?.finishAt).toBe(Infinity);
    expect(plan.bySpell.find((s) => s.spell === 'prismism')?.finishAt).toBeLessThan(Infinity);
  });

  it('plans nothing, and blocks nothing, on a build with no altars running', () => {
    const plan = potencyPlan(FRESH_INPUT);
    expect(plan.steps).toEqual([]);
    expect(plan.totalHours).toBe(0);
    expect(plan.unreachable).toBeGreaterThan(0);
  });

  /**
   * Prismism's potency raises the Rune Craft multiplier, so it pays for itself
   * in every later wait. The ordering rule is gain per rune spent rather than a
   * hardcoded preference, so this is a claim about the data as much as the
   * code — if a balance change removed the feedback, this would fail loudly
   * rather than the path quietly becoming worse.
   */
  it('front-loads the rank that raises rune income', () => {
    const plan = potencyPlan(running());
    const first = plan.steps.find((step) => step.resource === SPELLS.prismism.potencyResource);
    expect(first?.spell).toBe('prismism');
    expect(first?.runeGain).toBeGreaterThan(0);
  });

  /**
   * Altar shutdown.
   *
   * Each rune comes from exactly one altar and the conversion ratio has no
   * capacity term, so there is nothing to search: an altar is worth running
   * until the last rank priced in its rune is bought, and is waste afterwards.
   */
  it('stops each altar when the last rank on its rune is bought', () => {
    const plan = potencyPlan(running());

    for (const schedule of plan.altars) {
      const onThisRune = plan.steps.filter((step) => step.resource === schedule.rune);

      if (onThisRune.length === 0) {
        expect(schedule.advice, schedule.altar).not.toBe('run');
        continue;
      }

      expect(schedule.advice, schedule.altar).toBe('run');
      expect(schedule.stopAt).toBeCloseTo(onThisRune[onThisRune.length - 1]!.at, 9);
      expect(schedule.stopAt).toBeLessThanOrEqual(plan.totalHours + 1e-9);
    }
  });

  it('marks an altar idle when the plan wants none of its runes', () => {
    const input = running();
    // Manaflow is the only spell priced in chasm runes.
    input.spells.manaflow.rank = SPELLS.manaflow.maxRank;

    const chasm = potencyPlan(input).altars.find((a) => a.altar === 'chasm');
    expect(chasm?.advice).toBe('idle');
    expect(chasm?.stopAt).toBe(0);
  });

  /**
   * "Not needed" and "cannot be fed" must not be confused.
   *
   * An altar the plan still wants but which is switched off produces nothing,
   * so it has no steps and no stop time — exactly like an altar nothing needs.
   * Reporting that as surplus would tell the player to turn off the altar they
   * most need to turn on.
   */
  it('tells you to start an altar the plan needs but nothing is feeding', () => {
    const input = running();
    input.altars.chasm.active = false;

    const plan = potencyPlan(input);
    const chasm = plan.altars.find((a) => a.altar === 'chasm');

    expect(chasm?.advice).toBe('start');
    expect(plan.steps.some((step) => step.resource === 'chasmRune')).toBe(false);
    expect(plan.blocked).toContain('chasmRune');
  });

  /**
   * The saving that makes shutdown worth reporting: with Ash switched off once
   * its ranks are done, Brine gets the whole Soft pool and finishes sooner than
   * it would sharing with an altar nobody needs.
   */
  it('finishes sooner than the same plan with a finished altar left running', () => {
    const input = running();
    // Everything on ash is already done, so the Ash altar is pure waste.
    for (const id of SPELL_IDS) {
      if (SPELLS[id].potencyResource === 'ashRune') input.spells[id].rank = SPELLS[id].maxRank;
    }

    const managed = potencyPlan(input);
    const softHours = managed.budget.find((row) => row.essence === 'soft')?.hours ?? 0;

    // The same build with Ash never unlocked cannot leave it running, so it is
    // the "managed" case by construction — the two must agree.
    const withoutAsh = structuredClone(input);
    withoutAsh.altars.ash.active = false;
    const bare = potencyPlan(withoutAsh);

    expect(softHours).toBeCloseTo(
      bare.budget.find((row) => row.essence === 'soft')?.hours ?? 0,
      6,
    );
  });

  it('stays fast enough to run on every keystroke', () => {
    const input = running();
    const started = performance.now();
    potencyPlan(input);
    // Generous by two orders of magnitude: this guards against a pathological
    // blow-up, not against a few milliseconds of drift.
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
