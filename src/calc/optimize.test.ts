/**
 * Optimizer tests.
 *
 * The engine's own correctness is covered by the golden test against the
 * workbook. What matters here is that the ranking is a faithful reading of the
 * engine: that every candidate maps to a real input field, that scores come out
 * of an actual recompute, and that the structural claims the module's design
 * rests on still hold if `constants.ts` changes under it.
 */

import { describe, expect, it } from 'vitest';

import { compute } from './engine';
import {
  enumerateCandidates,
  marginalValue,
  objectives,
  rankAll,
  rankings,
} from './optimize';
import { EXAMPLE_INPUT } from '../presets/example';
import { FRESH_INPUT } from '../presets/fresh';
import { ALTAR_IDS } from './constants';

describe('candidates', () => {
  it('covers every unmaxed row the engine prices', () => {
    // The optimizer and the cost table must agree on what exists; a row the UI
    // shows but the optimizer cannot see would be silently unrankable.
    const result = compute(FRESH_INPUT);
    const rowIds = [
      ...result.rows.essence,
      ...ALTAR_IDS.flatMap((id) => result.rows.altars[id]),
      ...result.rows.altarUnlocks,
      ...result.rows.spells,
      ...result.rows.exchange,
    ]
      .filter((row) => row.available)
      .map((row) => row.id);

    const candidateIds = new Set(enumerateCandidates(FRESH_INPUT).map((c) => c.id));
    for (const id of rowIds) expect(candidateIds).toContain(id);
  });

  it('adds the altar run toggle, which is a lever with no cost row', () => {
    // Running an idle altar is the throughput dial between the two goals, so
    // it must be rankable even though nothing in `rows` prices it.
    const idle = structuredClone(FRESH_INPUT);
    idle.altars.ash.unlocked = true;
    idle.altars.ash.active = false;

    const toggle = enumerateCandidates(idle).find((c) => c.id === 'ash.active');
    expect(toggle?.priced).toBe(false);

    // ...and disappears once the altar is already running.
    const running = structuredClone(idle);
    running.altars.ash.active = true;
    expect(enumerateCandidates(running).map((c) => c.id)).not.toContain('ash.active');
  });

  it('ranks running an idle altar as the top rune move', () => {
    const idle = structuredClone(FRESH_INPUT);
    idle.altars.ash.unlocked = true;
    idle.altars.ash.active = false;

    const { unpriced } = rankings(idle, 'runes');
    const toggle = unpriced.find((m) => m.candidate.id === 'ash.active');
    expect(toggle).toBeDefined();
    expect(toggle!.delta.runesPerHour).toBeGreaterThan(0);
    // It buys those runes with essence, which is the tradeoff being surfaced.
    expect(toggle!.delta.essencePerHour).toBeLessThan(0);
    expect(unpriced[0]!.candidate.id).toBe('ash.active');
  });

  it('drops maxed rows', () => {
    const maxed = structuredClone(FRESH_INPUT);
    maxed.essence.essenceMine = 4;
    const ids = enumerateCandidates(maxed).map((c) => c.id);
    expect(ids).not.toContain('essenceMine');
  });

  it('applies exactly one level', () => {
    for (const candidate of enumerateCandidates(FRESH_INPUT)) {
      const draft = structuredClone(FRESH_INPUT);
      candidate.apply(draft);
      const after = enumerateCandidates(draft).find((c) => c.id === candidate.id);
      // Either the level went up by one, or the row is now maxed and gone.
      expect(after?.level ?? candidate.max).toBe(candidate.level + 1);
    }
  });

  it("prices a step as the row's own next level, not its cost to max", () => {
    const result = compute(FRESH_INPUT);
    const row = result.rows.essence.find((r) => r.id === 'flatDamage1');
    const candidate = enumerateCandidates(FRESH_INPUT).find((c) => c.id === 'flatDamage1');
    const step = Object.values(candidate!.stepCost)[0]!;
    const toMax = Object.values(row!.remaining)[0]!;
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(toMax);
  });

  it('marks Exchange rows unpriced rather than free', () => {
    const exchange = enumerateCandidates(FRESH_INPUT).filter((c) => c.section === 'exchange');
    expect(exchange.length).toBeGreaterThan(0);
    for (const c of exchange) {
      expect(c.priced).toBe(false);
      expect(c.stepCost).toEqual({});
    }
  });
});

describe('objectives', () => {
  it('sums net essence across the three tiers', () => {
    const result = compute(EXAMPLE_INPUT);
    const obj = objectives(result);
    expect(obj.essencePerHour).toBeCloseTo(
      result.essence.soft.netEssencePerHour +
        result.essence.dense.netEssencePerHour +
        result.essence.jagged.netEssencePerHour,
      6,
    );
  });

  it('counts runes only from altars that are unlocked and running', () => {
    // An idle altar neither drains essence nor makes runes; crediting its
    // notional output would make the `active` toggle look free.
    const idle = structuredClone(EXAMPLE_INPUT);
    for (const id of ALTAR_IDS) idle.altars[id].active = false;
    expect(objectives(compute(idle)).runesPerHour).toBe(0);

    const running = structuredClone(idle);
    running.altars.ash.unlocked = true;
    running.altars.ash.active = true;
    expect(objectives(compute(running)).runesPerHour).toBeGreaterThan(0);
  });
});

describe('marginal value', () => {
  const baseline = objectives(compute(EXAMPLE_INPUT));

  it('scores a damage upgrade as a gain to essence', () => {
    const candidate = enumerateCandidates(EXAMPLE_INPUT).find((c) => c.id === 'flatDamage1')!;
    const m = marginalValue(EXAMPLE_INPUT, candidate, baseline);
    expect(m.delta.essencePerHour).toBeGreaterThan(0);
  });

  it('leaves the input untouched', () => {
    const before = structuredClone(EXAMPLE_INPUT);
    rankAll(EXAMPLE_INPUT);
    expect(EXAMPLE_INPUT).toEqual(before);
  });

  it('never scores an unpriced row on efficiency', () => {
    for (const m of rankAll(EXAMPLE_INPUT)) {
      if (!m.candidate.priced) {
        expect(m.perCostEssence).toBe(0);
        expect(m.perCostRunes).toBe(0);
      }
    }
  });
});

describe('the essence/rune tradeoff', () => {
  /**
   * The module's design rests on a structural claim about `computeAltars`:
   * capacity and cycle time multiply both rune output and essence drain, so
   * they cancel, leaving craft as the only thing that changes the exchange
   * rate. These tests pin that claim. If a balance patch breaks them, the
   * module's framing needs revisiting — not just its numbers.
   */
  const base = (() => {
    const input = structuredClone(EXAMPLE_INPUT);
    for (const id of ALTAR_IDS) {
      input.altars[id].unlocked = true;
      input.altars[id].active = true;
    }
    return input;
  })();

  /**
   * Runes made per essence burned, for one altar.
   *
   * Per altar this is exactly `(1 + 0.2*craft)(1 + card) * runeCraftMulti`.
   * Summed across altars it is a drain-weighted blend of three such rates, so
   * capacity is only neutral altar by altar — see the aggregate test below.
   */
  const rate = (input: typeof base, id: (typeof ALTAR_IDS)[number]) => {
    const altar = compute(input).altars[id];
    return altar.runesPerHour / altar.essenceCostPerHour;
  };

  it('is unchanged by capacity', () => {
    const more = structuredClone(base);
    for (const id of ALTAR_IDS) more.altars[id].capacity = base.altars[id].capacity + 5;
    for (const id of ALTAR_IDS) expect(rate(more, id)).toBeCloseTo(rate(base, id), 9);
  });

  it('is unchanged by travel speed', () => {
    const more = structuredClone(base);
    for (const id of ALTAR_IDS) more.altars[id].travel = Math.min(10, base.altars[id].travel + 3);
    for (const id of ALTAR_IDS) expect(rate(more, id)).toBeCloseTo(rate(base, id), 9);
  });

  it('is raised by craft', () => {
    const more = structuredClone(base);
    for (const id of ALTAR_IDS) more.altars[id].craft = Math.min(10, base.altars[id].craft + 3);
    for (const id of ALTAR_IDS) expect(rate(more, id)).toBeGreaterThan(rate(base, id));
  });

  it('shifts in aggregate when capacity reweights unequal altars', () => {
    // Capacity is neutral per altar but not across a portfolio: raising it
    // moves drain between altars whose craft levels differ, which moves the
    // blended rate. Worth pinning, because it is the one way a "neutral" dial
    // still changes the essence-to-rune conversion.
    const uneven = structuredClone(base);
    uneven.altars.ash.craft = 0;
    uneven.altars.chasm.craft = 10;

    const blended = (input: typeof base) => {
      const result = compute(input);
      const runes = ALTAR_IDS.reduce((sum, id) => sum + result.altars[id].runesPerHour, 0);
      const drain = ALTAR_IDS.reduce((sum, id) => sum + result.altars[id].essenceCostPerHour, 0);
      return runes / drain;
    };

    const shifted = structuredClone(uneven);
    shifted.altars.chasm.capacity = uneven.altars.chasm.capacity + 10;
    expect(blended(shifted)).toBeGreaterThan(blended(uneven));
  });

  it('makes capacity a pure conversion: more runes, less net essence', () => {
    const more = structuredClone(base);
    for (const id of ALTAR_IDS) more.altars[id].capacity = base.altars[id].capacity + 1;
    const before = objectives(compute(base));
    const after = objectives(compute(more));
    expect(after.runesPerHour).toBeGreaterThan(before.runesPerHour);
    expect(after.essencePerHour).toBeLessThan(before.essencePerHour);
  });
});

describe('rankings', () => {
  it('groups by resource and never mixes currencies in a queue', () => {
    const { byResource } = rankings(EXAMPLE_INPUT, 'runes');
    expect(byResource.length).toBeGreaterThan(0);
    for (const queue of byResource) {
      for (const entry of queue.entries) {
        expect(entry.candidate.resource).toBe(queue.resource);
      }
    }
  });

  it('sorts each queue best-first for the chosen goal', () => {
    for (const goal of ['essence', 'runes'] as const) {
      for (const queue of rankings(EXAMPLE_INPUT, goal).byResource) {
        const scores = queue.entries.map((e) =>
          goal === 'essence' ? e.perCostEssence : e.perCostRunes,
        );
        const sorted = [...scores].sort((a, b) => b - a);
        expect(scores).toEqual(sorted);
      }
    }
  });

  it('ranks the two goals differently', () => {
    // If both goals produced the same order there would be no reason to show
    // two lists. Altar throughput is what separates them.
    const first = (goal: 'essence' | 'runes') =>
      rankings(EXAMPLE_INPUT, goal).all.filter((m) => m.candidate.priced);
    const byEssence = [...first('essence')].sort((a, b) => b.perCostEssence - a.perCostEssence);
    const byRunes = [...first('runes')].sort((a, b) => b.perCostRunes - a.perCostRunes);
    expect(byEssence.map((m) => m.candidate.id)).not.toEqual(byRunes.map((m) => m.candidate.id));
  });

  it('puts multi-resource costs in the unpriced list rather than a queue', () => {
    // Altar unlocks cost several resources at once; queueing them under one
    // would misstate the price.
    const locked = structuredClone(EXAMPLE_INPUT);
    locked.altars.chasm.unlocked = false;
    const { byResource, unpriced } = rankings(locked, 'runes');
    const unlock = unpriced.find((m) => m.candidate.id === 'chasm.unlock');
    const inQueue = byResource.some((q) => q.entries.some((e) => e.candidate.id === 'chasm.unlock'));
    if (unlock) expect(inQueue).toBe(false);
  });

  it('scores a full ranking fast enough to run on every keystroke', () => {
    const started = performance.now();
    rankAll(EXAMPLE_INPUT);
    expect(performance.now() - started).toBeLessThan(250);
  });
});
