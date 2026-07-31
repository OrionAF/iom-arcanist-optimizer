/**
 * The spell potency path: what order to raise potencies in, and when each rank
 * actually lands.
 *
 * The Optimizer next door answers "what is the best thing to buy right now" by
 * scoring one level of everything. That question does not work for potencies.
 * A potency curve multiplies by 1.25 a rank, so rank 10 alone costs more than
 * ranks 1-8 together, and four of the six spells move nothing this calculator
 * models — their effects land on drones, portals, stars and veins elsewhere in
 * the game. Ranked by marginal value they would all read zero, forever, which
 * is true and useless.
 *
 * The question worth answering instead is a scheduling one: given what your
 * altars produce, when can you afford each rank, and in what order should you
 * buy them so the whole set finishes soonest. That is what this simulates.
 *
 * Three properties make the simulation rather than a sorted list necessary:
 *
 *   - The three rune types bank in parallel. A rank waiting on brine does not
 *     hold up one waiting on ash, so a single ordered list would overstate the
 *     total by summing waits that overlap.
 *   - Prismism's potency raises the Rune Craft multiplier, which raises every
 *     altar's output, which shortens every wait after it. Buying it early is
 *     worth more than buying it late, and by how much depends on the build.
 *   - Runic Surge's potency raises Essence Shiny Chance, which raises essence
 *     income and so, indirectly, nothing about rune supply — but it is picked
 *     up for free by measuring rather than assuming.
 *
 * Both feedback effects are found by recomputing, not by reading a flag: the
 * plan asks the engine what a rank is worth and believes the answer, so a
 * balance change in `constants.ts` reorders the path without touching this file.
 */

import { ALTARS, ALTAR_IDS, SPELLS, SPELL_IDS } from './constants';
import { curveCost } from './costs';
import { compute } from './engine';
import type { ArcanistInput, ArcanistResult, Resource, SpellId } from './types';

export interface PotencyStep {
  spell: SpellId;
  label: string;
  /** Rank before and after this purchase. */
  from: number;
  to: number;
  resource: Resource;
  cost: number;
  /** Runes per hour of `resource` during the wait for this rank. */
  rate: number;
  /** Hours waited for this rank alone. */
  wait: number;
  /** Hours from now when this rank is bought. */
  at: number;
  /** Change in total runes per hour this rank causes. Zero for most ranks. */
  runeGain: number;
  /** Change in total net essence per hour this rank causes. */
  essenceGain: number;
}

/** One spell's whole run to max rank, folded out of the step list. */
export interface PotencySpellPlan {
  spell: SpellId;
  label: string;
  resource: Resource;
  from: number;
  to: number;
  ranks: number;
  cost: number;
  /** Hours until this spell's last rank is bought. Infinity when unreachable. */
  finishAt: number;
}

export interface PotencyPlan {
  steps: PotencyStep[];
  bySpell: PotencySpellPlan[];
  /** Hours until the last reachable rank is bought. Zero when nothing is left. */
  totalHours: number;
  /** Runes spent over the whole plan, by rune type. */
  cost: Partial<Record<Resource, number>>;
  /** Rune types some pending rank needs that no running altar produces. */
  blocked: Resource[];
  /** Ranks left unplanned because their rune type has no income. */
  unreachable: number;
}

/** Runes per hour by type, counting only altars that are unlocked and running. */
function runeRates(result: ArcanistResult): Partial<Record<Resource, number>> {
  const rates: Partial<Record<Resource, number>> = {};
  for (const id of ALTAR_IDS) {
    const altar = result.altars[id];
    const rune = ALTARS[id].rune;
    rates[rune] = (rates[rune] ?? 0) + (altar.unlocked && altar.active ? altar.runesPerHour : 0);
  }
  return rates;
}

function totalRunesPerHour(rates: Partial<Record<Resource, number>>): number {
  let sum = 0;
  for (const rate of Object.values(rates)) sum += rate ?? 0;
  return sum;
}

function netEssencePerHour(result: ArcanistResult): number {
  return (
    result.essence.soft.netEssencePerHour +
    result.essence.dense.netEssencePerHour +
    result.essence.jagged.netEssencePerHour
  );
}

/** A spell whose next rank is on the table, priced and scored. */
interface Candidate {
  spell: SpellId;
  rank: number;
  resource: Resource;
  cost: number;
  runeGain: number;
  essenceGain: number;
  /** The recomputed model with this rank bought — reused when it is chosen. */
  after: ArcanistResult;
}

/**
 * Plan the whole run to rank 10 on every spell.
 *
 * Starts from an empty bank: the model has no idea what you have stockpiled, so
 * assuming zero is the only honest floor. Every figure it produces is therefore
 * a longest-case estimate for the runes, and a shortest-case one for the clock,
 * since casting spells and buying altar upgrades spend from the same pile.
 */
export function potencyPlan(input: ArcanistInput, baseline?: ArcanistResult): PotencyPlan {
  const draft = structuredClone(input);
  let result = baseline ?? compute(draft);
  let rates = runeRates(result);

  const bank: Partial<Record<Resource, number>> = {};
  const cost: Partial<Record<Resource, number>> = {};
  const blocked = new Set<Resource>();
  const steps: PotencyStep[] = [];
  let now = 0;

  const pending = () =>
    SPELL_IDS.filter(
      (id) =>
        draft.spells[id].rank < SPELLS[id].maxRank &&
        !blocked.has(SPELLS[id].potencyResource),
    );

  // Every rank on every spell; the loop always either buys one or blocks a rune
  // type, so this bound is only ever reached by a bug.
  const maxIterations = SPELL_IDS.reduce((sum, id) => sum + SPELLS[id].maxRank, 0) + 1;

  for (let guard = 0; guard < maxIterations; guard += 1) {
    const available = pending();
    if (available.length === 0) break;

    // One candidate per rune type — the next rank of the spell that rune should
    // buy. Spells sharing a rune compete here; spells on different runes do not.
    const best = new Map<Resource, Candidate>();

    for (const id of available) {
      const def = SPELLS[id];
      const rank = draft.spells[id].rank;
      const stepCost = curveCost(def.potencyCurve, rank, rank + 1);

      const probe = structuredClone(draft);
      probe.spells[id].rank = rank + 1;
      const after = compute(probe);

      const candidate: Candidate = {
        spell: id,
        rank,
        resource: def.potencyResource,
        cost: stepCost,
        runeGain: totalRunesPerHour(runeRates(after)) - totalRunesPerHour(rates),
        essenceGain: netEssencePerHour(after) - netEssencePerHour(result),
        after,
      };

      const held = best.get(candidate.resource);
      if (!held || better(candidate, held)) best.set(candidate.resource, candidate);
    }

    // When can each rune type pay for its candidate? Banks fill in parallel, so
    // the rank that lands next is the one with the shortest wait, not the one
    // that came first in any list.
    let chosen: Candidate | undefined;
    let chosenWait = Infinity;

    for (const candidate of best.values()) {
      const held = bank[candidate.resource] ?? 0;
      const rate = rates[candidate.resource] ?? 0;
      const owed = candidate.cost - held;
      const wait = owed <= 0 ? 0 : rate > 0 ? owed / rate : Infinity;
      if (wait < chosenWait) {
        chosenWait = wait;
        chosen = candidate;
      }
    }

    // Nothing left is payable: every remaining rune type has no running altar
    // behind it. Retire those types and let the loop finish the rest.
    if (!chosen || !Number.isFinite(chosenWait)) {
      for (const candidate of best.values()) blocked.add(candidate.resource);
      continue;
    }

    now += chosenWait;
    for (const rune of Object.keys(rates) as Resource[]) {
      bank[rune] = (bank[rune] ?? 0) + (rates[rune] ?? 0) * chosenWait;
    }
    bank[chosen.resource] = (bank[chosen.resource] ?? 0) - chosen.cost;
    cost[chosen.resource] = (cost[chosen.resource] ?? 0) + chosen.cost;

    steps.push({
      spell: chosen.spell,
      label: `${SPELLS[chosen.spell].label} Potency`,
      from: chosen.rank,
      to: chosen.rank + 1,
      resource: chosen.resource,
      cost: chosen.cost,
      rate: rates[chosen.resource] ?? 0,
      wait: chosenWait,
      at: now,
      runeGain: chosen.runeGain,
      essenceGain: chosen.essenceGain,
    });

    draft.spells[chosen.spell].rank = chosen.rank + 1;
    result = chosen.after;
    rates = runeRates(result);
  }

  const unreachable = SPELL_IDS.reduce(
    (sum, id) => sum + (SPELLS[id].maxRank - draft.spells[id].rank),
    0,
  );

  return {
    steps,
    bySpell: foldBySpell(input, draft, steps),
    totalHours: steps.length > 0 ? steps[steps.length - 1]!.at : 0,
    cost,
    blocked: [...blocked],
    unreachable,
  };
}

/**
 * Which of two candidates a rune type should buy next.
 *
 * Gain per rune spent first, which is the same yardstick the Optimizer uses, so
 * a rank that raises rune output outranks one that does not even when it costs
 * more — over a run this long, compounding wins. Ties, which is every pair of
 * ranks that changes nothing, fall to the cheaper one: buying cheap ranks early
 * cannot delay anything, and finishes more of the list sooner.
 */
function better(a: Candidate, b: Candidate): boolean {
  const ea = a.cost > 0 ? a.runeGain / a.cost : 0;
  const eb = b.cost > 0 ? b.runeGain / b.cost : 0;
  if (ea !== eb) return ea > eb;
  return a.cost < b.cost;
}

/**
 * The step list, per spell.
 *
 * A spell only carries a finish time if the plan actually reached its last
 * rank. Anything short of that is a spell whose rune type ran out of income
 * partway, and reporting the time of the last rank it did manage would read as
 * though the spell were done.
 */
function foldBySpell(
  input: ArcanistInput,
  final: ArcanistInput,
  steps: PotencyStep[],
): PotencySpellPlan[] {
  return SPELL_IDS.map((id) => {
    const def = SPELLS[id];
    const mine = steps.filter((step) => step.spell === id);
    const from = input.spells[id].rank;
    const finished = final.spells[id].rank >= def.maxRank;
    return {
      spell: id,
      label: def.label,
      resource: def.potencyResource,
      from,
      to: final.spells[id].rank,
      ranks: def.maxRank - from,
      cost: mine.reduce((sum, step) => sum + step.cost, 0),
      finishAt: finished ? (mine[mine.length - 1]?.at ?? 0) : Infinity,
    };
  }).filter((plan) => plan.ranks > 0);
}
