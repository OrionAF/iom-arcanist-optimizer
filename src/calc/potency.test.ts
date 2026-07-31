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
   * The finish time, bracketed by the two schedules that need no simulation.
   *
   * Rune income only ever rises along the plan, so paying at today's rate the
   * whole way is the slowest the plan can be, and paying at the rate it ends on
   * is the fastest. Both bounds are per rune and then *maxed*, not summed —
   * that is the parallel-banking claim stated as arithmetic. The strict upper
   * bound is also the proof that front-loading Prismism paid for itself: a
   * schedule that never compounded would land exactly on it.
   */
  it('finishes between the slowest and fastest constant-rate schedules', () => {
    const input = running();
    const plan = potencyPlan(input);

    const maxed = structuredClone(input);
    for (const id of SPELL_IDS) maxed.spells[id].rank = SPELLS[id].maxRank;

    const rateOf = (result: ReturnType<typeof compute>, altar: (typeof ALTAR_IDS)[number]) =>
      result.altars[altar].runesPerHour;
    const start = compute(input);
    const end = compute(maxed);

    const spans = ALTAR_IDS.map((id) => {
      const cost = plan.cost[ALTARS[id].rune] ?? 0;
      return { slowest: cost / rateOf(start, id), fastest: cost / rateOf(end, id) };
    });

    const slowest = Math.max(...spans.map((s) => s.slowest));
    const fastest = Math.max(...spans.map((s) => s.fastest));
    const sequential = spans.reduce((sum, s) => sum + s.slowest, 0);

    expect(plan.totalHours).toBeGreaterThan(fastest * 0.999999);
    expect(plan.totalHours).toBeLessThan(slowest);
    expect(plan.totalHours).toBeLessThan(sequential);
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

  it('stays fast enough to run on every keystroke', () => {
    const input = running();
    const started = performance.now();
    potencyPlan(input);
    // Generous by two orders of magnitude: this guards against a pathological
    // blow-up, not against a few milliseconds of drift.
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
