/**
 * The spell potency path: what the remaining ranks cost, in runes and in the
 * essence behind them.
 *
 * The Optimizer next door answers "what is the best thing to buy right now" by
 * scoring one level of everything. That question does not work for potencies.
 * A potency curve multiplies by 1.25 a rank, so rank 10 alone costs more than
 * ranks 1-8 together, and four of the six spells move nothing this calculator
 * models — their effects land on drones, portals, stars and veins elsewhere in
 * the game. Ranked by marginal value they would all read zero, forever, which
 * is true and useless.
 *
 * The question worth answering instead is what the whole run costs. Ranks are
 * priced in runes; runes come from altars; altars eat essence; and essence is
 * mined one type at a time. So the real currency of this plan is mining hours,
 * and that is what it reports.
 *
 * Three properties make a simulation necessary rather than a division:
 *
 *   - Altars stall on an empty pool, so rune output is capped by what you mine
 *     rather than by how well the altar is tuned. An altar that outpaces your
 *     pickaxe converts at the pool's rate, not its own.
 *   - Prismism's potency raises the Rune Craft multiplier, which raises every
 *     altar's conversion ratio, which makes every later rank cheaper in
 *     essence. Buying it early is worth more than buying it late, and by how
 *     much depends on the build.
 *   - Mining is exclusive, so the pools are worked in sequence and the order
 *     interacts with that feedback.
 *
 * All three are found by recomputing, not by reading a flag: the plan asks the
 * engine what a rank is worth and believes the answer, so a balance change in
 * `constants.ts` moves the plan without touching this file.
 *
 * ## What this deliberately does not claim
 *
 * Essence is also the exchange sink that buys orbs, so this plan has no
 * exclusive claim on your mining time, and the split between the two is not
 * something the app can know. The output is therefore a *budget* — what the
 * remaining ranks cost in essence, and the mining hours that implies — rather
 * than a timetable. The internal ordering exists to get those numbers right,
 * not to be followed step by step.
 *
 * The one exception is `AltarSchedule`. When an altar has produced every rune
 * the plan needs, running it longer burns essence for nothing, and that is true
 * whenever you reach it — no assumption about your mining habits required.
 */

import { ALTARS, ALTAR_IDS, SPELLS, SPELL_IDS } from './constants';
import { curveCost } from './costs';
import { compute } from './engine';
import type {
  AltarId,
  ArcanistInput,
  ArcanistResult,
  EssenceType,
  Resource,
  SpellId,
} from './types';
import { ESSENCE_TYPES } from './types';

export interface PotencyStep {
  spell: SpellId;
  label: string;
  /** Rank before and after this purchase. */
  from: number;
  to: number;
  resource: Resource;
  cost: number;
  /** The essence pool whose mining paid for this rank. */
  pool: EssenceType;
  /** Runes per hour of `resource` while this rank was being saved for. */
  rate: number;
  /** Hours of mining spent waiting for this rank alone. */
  wait: number;
  /** Cumulative mining hours when this rank is bought. */
  at: number;
  /** Change in total sustained runes per hour this rank causes. */
  runeGain: number;
  /** Change in banked essence per hour this rank causes. */
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
  /** Cumulative mining hours when this spell's last rank lands. */
  finishAt: number;
}

/** What the plan costs from one essence pool. */
export interface EssenceBudget {
  essence: EssenceType;
  /** Essence the altars consume to make the runes this plan needs. */
  required: number;
  /** Hours of mining that implies, at this essence's current rate. */
  hours: number;
}

/**
 * What to do with an altar over the course of the plan.
 *
 *   run   — needed; keep it going until `stopAt`, after which it is only waste
 *   start — needed, but nothing is feeding it, so the plan cannot use its runes
 *   idle  — no remaining rank is priced in its rune; running it buys nothing
 */
export type AltarAdvice = 'run' | 'start' | 'idle';

export interface AltarSchedule {
  altar: AltarId;
  rune: Resource;
  advice: AltarAdvice;
  /** Cumulative mining hours after which this altar is only burning essence. */
  stopAt: number;
}

export interface PotencyPlan {
  steps: PotencyStep[];
  bySpell: PotencySpellPlan[];
  /** Per-pool essence cost and mining hours. Pools with no cost are omitted. */
  budget: EssenceBudget[];
  altars: AltarSchedule[];
  /** Total mining hours. Zero when nothing is left to buy. */
  totalHours: number;
  /** Runes spent over the whole plan, by rune type. */
  cost: Partial<Record<Resource, number>>;
  /** Rune types some pending rank needs that cannot be produced at all. */
  blocked: Resource[];
  /** Ranks left unplanned because their rune cannot be produced. */
  unreachable: number;
}

/** Which pool an altar drains, and which rune it makes. */
const RUNE_POOL = new Map<Resource, EssenceType>(
  ALTAR_IDS.map((id) => [ALTARS[id].rune, ALTARS[id].consumes]),
);

/**
 * Rune and essence rates while mining one pool, with only the altars the plan
 * still needs left running.
 *
 * Asks the engine rather than reimplementing the supply maths: `compute` with
 * `mining` set to the pool gives sustained rates that already account for
 * altars starving, sharing a pool, and the current rune craft multiplier.
 *
 * `needed` is what makes the budget a budget rather than a record of waste. An
 * altar whose rune the plan is finished with keeps converting essence into
 * runes nobody wants, and on a shared pool it takes that essence from the altar
 * still working. Switching it off is both what a player should do and what
 * makes the essence figure mean "what this plan costs" instead of "what your
 * current setup happens to burn".
 */
function ratesWhileMining(input: ArcanistInput, pool: EssenceType, needed: Set<Resource>) {
  const probe = structuredClone(input);
  probe.mining = pool;
  for (const id of ALTAR_IDS) {
    if (!needed.has(ALTARS[id].rune)) probe.altars[id].active = false;
  }
  const result = compute(probe);

  const runes: Partial<Record<Resource, number>> = {};
  for (const id of ALTAR_IDS) {
    const altar = result.altars[id];
    const rate = altar.unlocked && altar.active ? altar.sustainedRunesPerHour : 0;
    runes[altar.rune] = (runes[altar.rune] ?? 0) + rate;
  }

  const outcome = result.essence[pool];
  return {
    result,
    runes,
    /** Essence per hour the still-wanted altars on this pool consume. */
    essenceDrain: Math.min(outcome.essencePerHour, outcome.altarDrain),
    mineable: outcome.essencePerHour > 0,
  };
}

function totalSustainedRunes(runes: Partial<Record<Resource, number>>): number {
  let sum = 0;
  for (const rate of Object.values(runes)) sum += rate ?? 0;
  return sum;
}

function bankedEssence(result: ArcanistResult): number {
  let sum = 0;
  for (const type of ESSENCE_TYPES) sum += result.essence[type].sustainedNet;
  return sum;
}

/** A spell whose next rank is on the table, priced and scored. */
interface Candidate {
  spell: SpellId;
  rank: number;
  resource: Resource;
  pool: EssenceType;
  cost: number;
  runeGain: number;
  essenceGain: number;
}

/**
 * Which of two candidates on the same rune should be bought first.
 *
 * Gain per rune spent, the same yardstick the Optimizer uses, so a rank that
 * raises rune output outranks one that does not even when it costs more — over
 * a run this long, compounding wins. Ties, which is every pair of ranks that
 * changes nothing, fall to the cheaper one: buying cheap ranks early cannot
 * delay anything and finishes more of the list sooner.
 */
function better(a: Candidate, b: Candidate): boolean {
  const ea = a.cost > 0 ? a.runeGain / a.cost : 0;
  const eb = b.cost > 0 ? b.runeGain / b.cost : 0;
  if (ea !== eb) return ea > eb;
  return a.cost < b.cost;
}

/**
 * Plan the whole run to rank 10 on every spell.
 *
 * Starts from an empty bank: the model cannot know what you have stockpiled, so
 * assuming zero is the only honest floor.
 */
export function potencyPlan(input: ArcanistInput, baseline?: ArcanistResult): PotencyPlan {
  const draft = structuredClone(input);
  let current = baseline?.rows ? baseline : compute(draft);

  const bank: Partial<Record<Resource, number>> = {};
  const cost: Partial<Record<Resource, number>> = {};
  const blocked = new Set<Resource>();
  const steps: PotencyStep[] = [];

  const budget = new Map<EssenceType, { required: number; hours: number }>();
  const stopAt = new Map<Resource, number>();
  let now = 0;

  /** Ranks still to buy whose rune has not been written off. */
  const pending = () =>
    SPELL_IDS.filter(
      (id) => draft.spells[id].rank < SPELLS[id].maxRank && !blocked.has(SPELLS[id].potencyResource),
    );

  /** The runes any remaining rank is still priced in. */
  const stillNeeded = () => new Set(pending().map((id) => SPELLS[id].potencyResource));

  /** Score the next rank of every pending spell against the current build. */
  const candidates = (): Candidate[] => {
    const needed = stillNeeded();
    const baseRunes = totalSustainedRunes(ratesWhileMining(draft, draft.mining, needed).runes);
    const baseEssence = bankedEssence(current);

    return pending().map((id) => {
      const def = SPELLS[id];
      const rank = draft.spells[id].rank;

      const probe = structuredClone(draft);
      probe.spells[id].rank = rank + 1;
      const after = compute(probe);

      return {
        spell: id,
        rank,
        resource: def.potencyResource,
        pool: RUNE_POOL.get(def.potencyResource) ?? 'soft',
        cost: curveCost(def.potencyCurve, rank, rank + 1),
        runeGain:
          totalSustainedRunes(ratesWhileMining(probe, probe.mining, needed).runes) - baseRunes,
        essenceGain: bankedEssence(after) - baseEssence,
      };
    });
  };

  // Every rank on every spell; the loop always either buys one or writes off a
  // rune type, so this bound is only reached by a bug.
  const maxIterations = SPELL_IDS.reduce((sum, id) => sum + SPELLS[id].maxRank, 0) + 1;

  for (let guard = 0; guard < maxIterations; guard += 1) {
    const available = candidates();
    if (available.length === 0) break;

    // Mine the pool serving the best rank on the table. Prismism reaches the
    // front on its own here — it raises rune output, so it wins on gain per
    // rune, and it is priced in brine, which is a Soft-fed altar.
    let lead = available[0]!;
    for (const candidate of available) if (better(candidate, lead)) lead = candidate;

    const pool = lead.pool;
    const rates = ratesWhileMining(draft, pool, stillNeeded());

    // Nothing this pool serves can ever be paid for: no income, or no altar
    // running on it. Write those runes off and let the loop finish the rest.
    const servedRunes = available.filter((c) => c.pool === pool).map((c) => c.resource);
    if (!rates.mineable || servedRunes.every((rune) => (rates.runes[rune] ?? 0) <= 0)) {
      for (const rune of servedRunes) if ((rates.runes[rune] ?? 0) <= 0) blocked.add(rune);
      if (!rates.mineable) for (const rune of servedRunes) blocked.add(rune);
      continue;
    }

    // Work this pool until nothing pending needs what it makes.
    for (let inner = 0; inner < maxIterations; inner += 1) {
      const needed = stillNeeded();
      const here = candidates().filter(
        (c) => c.pool === pool && (ratesWhileMining(draft, pool, needed).runes[c.resource] ?? 0) > 0,
      );
      if (here.length === 0) break;

      // One candidate per rune — spells sharing a rune compete, spells on
      // different runes do not.
      const best = new Map<Resource, Candidate>();
      for (const candidate of here) {
        const held = best.get(candidate.resource);
        if (!held || better(candidate, held)) best.set(candidate.resource, candidate);
      }

      const live = ratesWhileMining(draft, pool, needed);

      // The rank that lands soonest. Runes bank in parallel while this pool is
      // worked, so a rank waiting on ash does not queue behind one on brine.
      let chosen: Candidate | undefined;
      let wait = Infinity;
      for (const candidate of best.values()) {
        const owed = candidate.cost - (bank[candidate.resource] ?? 0);
        const rate = live.runes[candidate.resource] ?? 0;
        const t = owed <= 0 ? 0 : rate > 0 ? owed / rate : Infinity;
        if (t < wait) {
          wait = t;
          chosen = candidate;
        }
      }
      if (!chosen || !Number.isFinite(wait)) break;

      // Advance the clock, and with it every rune this pool feeds.
      now += wait;
      for (const rune of Object.keys(live.runes) as Resource[]) {
        bank[rune] = (bank[rune] ?? 0) + (live.runes[rune] ?? 0) * wait;
      }
      bank[chosen.resource] = (bank[chosen.resource] ?? 0) - chosen.cost;
      cost[chosen.resource] = (cost[chosen.resource] ?? 0) + chosen.cost;

      const tally = budget.get(pool) ?? { required: 0, hours: 0 };
      tally.hours += wait;
      tally.required += live.essenceDrain * wait;
      budget.set(pool, tally);

      steps.push({
        spell: chosen.spell,
        label: `${SPELLS[chosen.spell].label} Potency`,
        from: chosen.rank,
        to: chosen.rank + 1,
        resource: chosen.resource,
        cost: chosen.cost,
        pool,
        rate: live.runes[chosen.resource] ?? 0,
        wait,
        at: now,
        runeGain: chosen.runeGain,
        essenceGain: chosen.essenceGain,
      });

      draft.spells[chosen.spell].rank = chosen.rank + 1;
      current = compute(draft);
      // The last rank on this rune so far; overwritten if another follows.
      stopAt.set(chosen.resource, now);
    }
  }

  const unreachable = SPELL_IDS.reduce(
    (sum, id) => sum + (SPELLS[id].maxRank - draft.spells[id].rank),
    0,
  );

  return {
    steps,
    bySpell: foldBySpell(input, draft, steps),
    budget: ESSENCE_TYPES.map((essence) => ({
      essence,
      required: budget.get(essence)?.required ?? 0,
      hours: budget.get(essence)?.hours ?? 0,
    })).filter((row) => row.required > 0 || row.hours > 0),
    altars: foldAltars(input, draft, stopAt),
    totalHours: steps.length > 0 ? steps[steps.length - 1]!.at : 0,
    cost,
    blocked: [...blocked],
    unreachable,
  };
}

/**
 * The step list, per spell.
 *
 * A spell only carries a finish time if the plan actually reached its last
 * rank. Anything short of that is a spell whose runes ran out, and reporting
 * the time of the last rank it did manage would read as though it were done.
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

/**
 * What to do with each altar over the course of the plan.
 *
 * Each rune type comes from exactly one altar, and the conversion ratio —
 * `(1 + craft × 0.2) × (1 + card) × runeCraftMulti` — has no capacity or travel
 * term in it. So turning an altar off cannot make another altar's runes
 * cheaper, and there is nothing to search: the only question is when an altar
 * stops being useful, which is when the last rank priced in its rune is bought.
 *
 * Past that point it converts essence into runes the plan has no use for, and
 * on a shared pool that is essence the other altar could have had.
 *
 * "Not needed" and "cannot be fed" have to stay distinct. An altar the plan
 * still wants but which is switched off would otherwise be reported as surplus,
 * which is the exact opposite of the truth.
 */
function foldAltars(
  input: ArcanistInput,
  final: ArcanistInput,
  stopAt: Map<Resource, number>,
): AltarSchedule[] {
  // Runes some rank is still priced in, whether or not the plan could buy it.
  const wanted = new Set(
    SPELL_IDS.filter((id) => final.spells[id].rank < SPELLS[id].maxRank).map(
      (id) => SPELLS[id].potencyResource,
    ),
  );

  return ALTAR_IDS.filter((id) => input.altars[id].unlocked).map((id) => {
    const rune = ALTARS[id].rune;
    const stop = stopAt.get(rune);

    const advice: AltarAdvice =
      stop !== undefined ? 'run' : wanted.has(rune) ? 'start' : 'idle';

    return { altar: id, rune, advice, stopAt: stop ?? 0 };
  });
}
