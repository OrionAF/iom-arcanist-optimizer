/**
 * Upgrade ranking.
 *
 * The optimiser answers "what should I buy next", which is a different question
 * from "what is the best build". The best build is trivially every upgrade at
 * max — every lever here is monotone-positive and eventually affordable — so
 * searching the configuration space is pointless. What is not trivial is the
 * *order*, and that is what this module scores.
 *
 * Scoring is empirical rather than analytical: clone the input, add one level,
 * run `compute` again, diff the outcome. Nothing here duplicates a formula from
 * the engine, so a balance patch to `constants.ts` moves the rankings without
 * touching this file. `compute` is pure and its costs are closed form, which is
 * what makes ~50 recomputes per keystroke affordable.
 *
 * Two objectives are tracked, because the player has two:
 *
 *   essence/hr — sum of net essence across the three tiers
 *   runes/hr   — sum across altars that are actually unlocked and running
 *
 * They compete less than they appear to. In `computeAltars`, capacity and
 * cycle time appear in both `runesPerHour` and `essenceCostPerHour` and cancel,
 * so a single altar converts essence to runes at exactly
 * `(1 + 0.2*craft)(1 + card) * runeCraftMulti` no matter how it is tuned.
 * Only the altar throughput dials trade one objective against the other;
 * everything else either raises both or is neutral.
 *
 * That cancellation is per altar, not across the set: raising capacity on one
 * altar moves drain toward it, so a portfolio of altars with unequal craft
 * levels does shift its blended rate. Both facts are pinned in the tests.
 */

import { curveCost, tieredCost } from './costs';
import {
  ALTARS,
  ALTAR_IDS,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  SPELLS,
  SPELL_IDS,
} from './constants';
import { compute } from './engine';
import type {
  AltarId,
  ArcanistInput,
  ArcanistResult,
  EssenceType,
  Resource,
  ResourceBundle,
} from './types';
import { ESSENCE_TYPES } from './types';

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export type CandidateSection =
  | 'essence'
  | 'altar'
  | 'altarUnlock'
  | 'altarToggle'
  | 'spell'
  | 'exchange';

/**
 * One lever the player can pull, with the cost of pulling it exactly once.
 *
 * `id` matches the corresponding `UpgradeCost.id` from the engine's `rows`, so
 * a ranking entry can be traced back to the row the UI already renders.
 */
export interface Candidate {
  id: string;
  label: string;
  section: CandidateSection;
  level: number;
  max: number;
  /** Cost of going from `level` to `level + 1`. Empty when unpriced. */
  stepCost: ResourceBundle;
  /** False for rows with no cost data at all (Exchange), distinct from free. */
  priced: boolean;
  /** The single resource this step costs, when it is exactly one. */
  resource?: Resource;
  /** Mutates a draft input to buy one more level. */
  apply: (draft: ArcanistInput) => void;
}

const clamp = (level: number, max: number) =>
  Number.isFinite(level) ? Math.max(0, Math.min(max, Math.floor(level))) : 0;

/** The single resource in a bundle, or undefined when it spans several. */
function soleResource(bundle: ResourceBundle): Resource | undefined {
  const keys = Object.keys(bundle) as Resource[];
  return keys.length === 1 ? keys[0] : undefined;
}

/**
 * Every lever that is not already maxed, in the order the UI lists them.
 *
 * Maxed rows are dropped rather than scored zero: a ranking is a list of things
 * you can do, and "buy another level of a maxed upgrade" is not one of them.
 */
export function enumerateCandidates(input: ArcanistInput): Candidate[] {
  const out: Candidate[] = [];

  for (const def of ESSENCE_UPGRADES) {
    const level = clamp(input.essence[def.id], def.max);
    if (level >= def.max) continue;

    const stepCost: ResourceBundle =
      def.cost.kind === 'tiered'
        ? tieredCost(def.cost.tiers, level, level + 1)
        : { [def.cost.resource]: curveCost(def.cost.curve, level, level + 1) };

    out.push({
      id: def.id,
      label: def.label,
      section: 'essence',
      level,
      max: def.max,
      stepCost,
      priced: true,
      resource: soleResource(stepCost),
      apply: (draft) => {
        draft.essence[def.id] = level + 1;
      },
    });
  }

  for (const id of ALTAR_IDS) {
    const def = ALTARS[id];
    const raw = input.altars[id];

    // The unlock gates everything else on the altar, so it is a candidate in
    // its own right — and the only altar row whose cost spans resources.
    if (!raw.unlocked && Object.keys(def.unlockCost).length > 0) {
      const stepCost = { ...def.unlockCost };
      out.push({
        id: `${id}.unlock`,
        label: `Unlock ${def.label}`,
        section: 'altarUnlock',
        level: 0,
        max: 1,
        stepCost,
        priced: true,
        resource: soleResource(stepCost),
        apply: (draft) => {
          draft.altars[id].unlocked = true;
        },
      });
    }

    // Running an idle altar costs nothing and is usually the single largest
    // move available for runes, so it has to be rankable — it is the throughput
    // dial that trades essence for runes, which is the whole reason two lists
    // exist. Unpriced because it has no price, not because it is free of cost:
    // the essence it burns shows up in the essence delta.
    if (raw.unlocked && !raw.active) {
      out.push({
        id: `${id}.active`,
        label: `Run ${def.label}`,
        section: 'altarToggle',
        level: 0,
        max: 1,
        stepCost: {},
        priced: false,
        apply: (draft) => {
          draft.altars[id].active = true;
        },
      });
    }

    for (const up of def.upgrades) {
      const level = clamp(raw[up.key], up.max);
      if (level >= up.max) continue;
      const stepCost: ResourceBundle = { [up.resource]: curveCost(up.curve, level, level + 1) };
      out.push({
        id: `${id}.${up.key}`,
        label: `${def.label} · ${up.label}`,
        section: 'altar',
        level,
        max: up.max,
        stepCost,
        priced: true,
        resource: up.resource,
        apply: (draft) => {
          draft.altars[id][up.key] = level + 1;
        },
      });
    }
  }

  for (const id of SPELL_IDS) {
    const def = SPELLS[id];
    const rank = clamp(input.spells[id].rank, def.maxRank);
    if (rank >= def.maxRank) continue;
    const stepCost: ResourceBundle = {
      [def.potencyResource]: curveCost(def.potencyCurve, rank, rank + 1),
    };
    out.push({
      id: `${id}.potency`,
      label: `${def.label} Potency`,
      section: 'spell',
      level: rank,
      max: def.maxRank,
      stepCost,
      priced: true,
      resource: def.potencyResource,
      apply: (draft) => {
        draft.spells[id].rank = rank + 1;
      },
    });
  }

  // Exchange upgrades are deliberately unpriced (see ExchangeUpgradeDef). They
  // can still be ranked by effect, just never by efficiency.
  for (const def of EXCHANGE_UPGRADES) {
    const level = clamp(input.exchange[def.id], def.max);
    if (level >= def.max) continue;
    out.push({
      id: def.id,
      label: def.label,
      section: 'exchange',
      level,
      max: def.max,
      stepCost: {},
      priced: false,
      apply: (draft) => {
        draft.exchange[def.id] = level + 1;
      },
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

export interface Objectives {
  /** Sum of net essence per hour across the three tiers. */
  essencePerHour: number;
  /** Sum of runes per hour across altars that are unlocked and running. */
  runesPerHour: number;
  perEssence: Record<EssenceType, number>;
  perAltar: Record<AltarId, number>;
}

/**
 * Collapse a result into the two numbers being optimised.
 *
 * Both objectives are the *sustained* figures, not the nominal ones. Mining is
 * exclusive and altars stall on an empty pool, so an upgrade that raises an
 * altar's throughput past what the pool can feed changes nothing a player would
 * ever see — and ranking it as an improvement would send them to buy it.
 *
 * Rune output is gated on `unlocked && active` to match how `compute` gates the
 * matching essence drain — an idle altar costs nothing and produces nothing, and
 * counting its notional output would make unlocking look free.
 */
export function objectives(result: ArcanistResult): Objectives {
  const perEssence = {} as Record<EssenceType, number>;
  let essencePerHour = 0;
  for (const type of ESSENCE_TYPES) {
    const net = result.essence[type].sustainedNet;
    perEssence[type] = net;
    essencePerHour += net;
  }

  const perAltar = {} as Record<AltarId, number>;
  let runesPerHour = 0;
  for (const id of ALTAR_IDS) {
    const altar = result.altars[id];
    const rate = altar.unlocked && altar.active ? altar.sustainedRunesPerHour : 0;
    perAltar[id] = rate;
    runesPerHour += rate;
  }

  return { essencePerHour, runesPerHour, perEssence, perAltar };
}

// ---------------------------------------------------------------------------
// Marginal value
// ---------------------------------------------------------------------------

export interface Marginal {
  candidate: Candidate;
  /** Objective change from buying exactly one level. */
  delta: Objectives;
  /** Objective gain per unit of the step's cost. Zero when unpriced. */
  perCostEssence: number;
  perCostRunes: number;
  /**
   * Hours to afford this step from nothing, at the current sustained rate.
   *
   * Only defined for rune costs. Orb income is not modelled anywhere in this
   * app — the Arcanist sheet has no notion of it — and an invented figure would
   * be worse than a blank, so orb-priced rows simply carry no time.
   *
   * A one-purchase horizon on purpose. Rates move every time you buy something,
   * so this stays true for exactly as long as the decision it informs.
   */
  hoursToAfford?: number;
}

/**
 * Sustained runes per hour, by rune type.
 *
 * Sustained rather than nominal, so a starved altar reports what it can really
 * deliver: saving for a rune the altars cannot feed does not go faster because
 * the altar is well tuned.
 */
export function runeIncome(result: ArcanistResult): Partial<Record<Resource, number>> {
  const rates: Partial<Record<Resource, number>> = {};
  for (const id of ALTAR_IDS) {
    const altar = result.altars[id];
    const rate = altar.unlocked && altar.active ? altar.sustainedRunesPerHour : 0;
    rates[altar.rune] = (rates[altar.rune] ?? 0) + rate;
  }
  return rates;
}

const zeroObjectives = (): Objectives => ({
  essencePerHour: 0,
  runesPerHour: 0,
  perEssence: { soft: 0, dense: 0, jagged: 0 },
  perAltar: { ash: 0, brine: 0, chasm: 0 },
});

function subtract(after: Objectives, before: Objectives): Objectives {
  const delta = zeroObjectives();
  delta.essencePerHour = after.essencePerHour - before.essencePerHour;
  delta.runesPerHour = after.runesPerHour - before.runesPerHour;
  for (const type of ESSENCE_TYPES) {
    delta.perEssence[type] = after.perEssence[type] - before.perEssence[type];
  }
  for (const id of ALTAR_IDS) {
    delta.perAltar[id] = after.perAltar[id] - before.perAltar[id];
  }
  return delta;
}

/** Total magnitude of a cost bundle, for the per-cost ratio. */
function bundleSize(bundle: ResourceBundle): number {
  let sum = 0;
  for (const amount of Object.values(bundle)) sum += amount ?? 0;
  return sum;
}

/**
 * What one more level of `candidate` is worth, by recomputing with it bought.
 *
 * `baseline` is passed in rather than recomputed so a full ranking pays for the
 * unmodified result once instead of once per candidate.
 */
export function marginalValue(
  input: ArcanistInput,
  candidate: Candidate,
  baseline: Objectives,
  income?: Partial<Record<Resource, number>>,
): Marginal {
  const draft = structuredClone(input);
  candidate.apply(draft);
  const delta = subtract(objectives(compute(draft)), baseline);

  const size = bundleSize(candidate.stepCost);
  const priced = candidate.priced && size > 0;

  // Only where the whole cost is one resource we earn: a multi-resource price
  // would need the slowest of several waits, and orbs have no rate at all.
  const resource = candidate.resource;
  const rate = resource !== undefined ? (income?.[resource] ?? 0) : 0;
  const owed = resource !== undefined ? (candidate.stepCost[resource] ?? 0) : 0;

  // Unpriced rows get a literal zero rather than a scaled delta: multiplying a
  // negative delta by a zero ratio yields -0, which renders as "-0.0".
  return {
    candidate,
    delta,
    perCostEssence: priced ? delta.essencePerHour / size : 0,
    perCostRunes: priced ? delta.runesPerHour / size : 0,
    hoursToAfford: priced && rate > 0 ? owed / rate : undefined,
  };
}

/** Score every available candidate against the current build. */
export function rankAll(input: ArcanistInput, result?: ArcanistResult): Marginal[] {
  const base = result ?? compute(input);
  const baseline = objectives(base);
  const income = runeIncome(base);
  return enumerateCandidates(input).map((c) => marginalValue(input, c, baseline, income));
}

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

export type Goal = 'essence' | 'runes';

export interface ResourceQueue {
  resource: Resource;
  entries: Marginal[];
}

export interface Rankings {
  /** Every scored candidate, unsorted, for callers that want their own view. */
  all: Marginal[];
  /** Priced candidates grouped by the resource they cost, best first. */
  byResource: ResourceQueue[];
  /**
   * Unpriced levers (Exchange rows, and any multi-resource cost) ranked by raw
   * effect. They carry no efficiency number because they have no known price.
   */
  unpriced: Marginal[];
}

const gain = (m: Marginal, goal: Goal) =>
  goal === 'essence' ? m.delta.essencePerHour : m.delta.runesPerHour;

const efficiency = (m: Marginal, goal: Goal) =>
  goal === 'essence' ? m.perCostEssence : m.perCostRunes;

/**
 * Rank upgrades for one goal, split into a queue per resource.
 *
 * Resources are not interchangeable — white orbs cannot buy an altar craft
 * level — so a single merged list would be comparing prices in different
 * currencies. One queue per resource is the question the player actually has:
 * "I have a pile of this, what does it buy me".
 *
 * Multi-resource costs (the altar unlocks) cannot join a single-resource queue
 * without inventing an exchange rate, so they rank by raw gain alongside the
 * unpriced rows.
 */
export function rankings(input: ArcanistInput, goal: Goal, result?: ArcanistResult): Rankings {
  const all = rankAll(input, result);

  const queues = new Map<Resource, Marginal[]>();
  const unpriced: Marginal[] = [];

  for (const m of all) {
    const resource = m.candidate.resource;
    if (!m.candidate.priced || resource === undefined) {
      unpriced.push(m);
      continue;
    }
    const list = queues.get(resource);
    if (list) list.push(m);
    else queues.set(resource, [m]);
  }

  const byResource: ResourceQueue[] = [];
  for (const [resource, entries] of queues) {
    entries.sort((a, b) => efficiency(b, goal) - efficiency(a, goal) || gain(b, goal) - gain(a, goal));
    byResource.push({ resource, entries });
  }

  // Order the queues themselves by their best entry, so the resource worth
  // spending first is the one at the top of the panel. Queues are only created
  // with a first entry, so the fallback is unreachable.
  const best = (queue: ResourceQueue) => {
    const top = queue.entries[0];
    return top ? efficiency(top, goal) : 0;
  };
  byResource.sort((a, b) => best(b) - best(a));

  unpriced.sort((a, b) => gain(b, goal) - gain(a, goal));

  return { all, byResource, unpriced };
}
