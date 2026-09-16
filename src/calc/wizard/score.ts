/**
 * Scoring an entered Wizard Exchange offer.
 *
 * Every offer gets a pain: the essence or runes it asks, in hours of your own
 * production against your comfort hours, plus each extra currency by where you
 * ranked it in Currency Preference. Pain per orb places the offer among the
 * offers of its colour you will see (p), and the colour's share needed (s)
 * says how picky you can afford to be. Score = 100 · s / (s + p): 50 is
 * break-even, above it the offer is worth taking.
 */

import { ESSENCE_LABELS, RESOURCE_LABELS, WIZARD } from '../constants';
import type {
  AltarId,
  ArcanistInput,
  ArcanistResult,
  CurrencyCategory,
  EssenceType,
  OfferCategory,
  OrbCardId,
  WizardOffer,
} from '../types';
import { ORB_CARD_IDS } from '../types';
import type { ColourOutlook, WizardOutlook } from './need';
import type { SampledOffer } from './offers';

const TIER_ESSENCE: readonly EssenceType[] = ['soft', 'dense', 'jagged'];
const TIER_ALTAR: readonly AltarId[] = ['ash', 'brine', 'chasm'];

export const COLOUR_LABELS: Record<OrbCardId, string> = {
  white: 'White',
  green: 'Green',
  purple: 'Purple',
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
};

/** What a slot-1 ask is called: "Jagged Essence", "Chasm Rune". */
export function slot1Label(kind: 'essence' | 'rune', tier: 0 | 1 | 2): string {
  return kind === 'essence'
    ? ESSENCE_LABELS[TIER_ESSENCE[tier]!]
    : RESOURCE_LABELS[`${TIER_ALTAR[tier]!}Rune`];
}

/** Everything pain depends on besides the offer itself. */
export interface PainContext {
  /** Per hour, by tier: gross essence income, and altar craft rate whether or not it runs. */
  essenceRates: readonly number[];
  runeRates: readonly number[];
  comfortHours: number;
  preference: readonly CurrencyCategory[];
  negligibleBar: number;
  gapBar: number;
  ppPer100Packs: number;
  /** Median gem ask among each colour's sampled offers. */
  medianGem: Record<OrbCardId, number>;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function painContext(
  input: ArcanistInput,
  result: ArcanistResult,
  samples: Record<OrbCardId, SampledOffer[]>,
): PainContext {
  const medianGem = {} as Record<OrbCardId, number>;
  for (const id of ORB_CARD_IDS) {
    medianGem[id] = median(
      samples[id]
        .filter((s) => !s.blind)
        .flatMap((s) => s.extras.filter((e) => e.category === 'gems').map((e) => e.amount)),
    );
  }
  return {
    essenceRates: TIER_ESSENCE.map((type) => result.essence[type].essencePerHour),
    runeRates: TIER_ALTAR.map((id) => result.altars[id].runesPerHour),
    comfortHours: input.wizard.comfortHours,
    preference: input.wizard.preference,
    negligibleBar: input.wizard.negligibleBar,
    gapBar: input.wizard.gapBar,
    ppPer100Packs: input.wizard.ppPer100Packs,
    medianGem,
  };
}

/**
 * How wide a step between neighbouring rows is, against an ordinary step of 1.
 * Not game figures: a judgement of what "negligible" and "significant" mean.
 */
export const NEGLIGIBLE_STEP = 0.01;
export const SIGNIFICANT_STEP = 5;

type PreferenceLayout = Pick<PainContext, 'preference' | 'negligibleBar' | 'gapBar'>;

/**
 * How far down Currency Preference each row sits, in steps: 0 at the top, and
 * each row a step further than the one above it. Steps between rows above the
 * green bar are negligible; the step across the red bar is significant.
 */
export function preferenceSteps({ preference, negligibleBar, gapBar }: PreferenceLayout): {
  fromTop: number[];
  total: number;
} {
  // steps[i] runs from row i to row i + 1, so the bar with i + 1 rows above it crosses it.
  const steps = preference.slice(1).map((_, i) =>
    i + 1 === gapBar ? SIGNIFICANT_STEP : i + 1 < negligibleBar ? NEGLIGIBLE_STEP : 1,
  );
  let running = 0;
  const fromTop = [0, ...steps.map((step) => (running += step))];
  return { fromTop, total: running };
}

/** Every row's pain, top to bottom: its steps from the top ÷ all steps, so 0 at the top and 1 at the bottom. */
export function preferencePains(layout: PreferenceLayout): number[] {
  const { fromTop, total } = preferenceSteps(layout);
  return fromTop.map((at) => (total > 0 ? at / total : 1));
}

/** A category's place in Currency Preference, in steps and as pain: 0 at the top, 1 at the bottom. */
function rowPlace(category: CurrencyCategory, layout: PreferenceLayout): { steps: number; totalSteps: number; pain: number } {
  const { fromTop, total } = preferenceSteps(layout);
  const index = layout.preference.indexOf(category);
  const steps = index < 0 ? total : fromTop[index]!;
  return { steps, totalSteps: total, pain: total > 0 ? steps / total : 1 };
}

/** What an offer's shape needs for pain, shared by entered and sampled offers. */
interface PainShape {
  blind: boolean;
  kind: 'essence' | 'rune';
  tier: 0 | 1 | 2;
  amount: number;
  extras: readonly { category: OfferCategory; amount: number }[];
}

export interface Pain {
  pain: number;
  /** Hours of production slot 1 costs. Infinity when there is none. */
  hours: number;
}

/** One cost's share of an offer's pain, for explaining a score. */
export type PainPart =
  | { kind: 'time'; hours: number; comfortHours: number; pain: number }
  | {
      kind: 'row';
      category: OfferCategory;
      /** 1-based place in Currency Preference, of `rows`. */
      rank: number;
      rows: number;
      /** Steps from the top of Currency Preference, of `totalSteps`. */
      steps: number;
      totalSteps: number;
      pain: number;
    }
  | {
      kind: 'gems';
      category: 'gems' | 'pp';
      rank: number;
      rows: number;
      steps: number;
      totalSteps: number;
      /** The Gems row's own pain. */
      rowPain: number;
      /** The cost in gems: PP converted. Null for PP with no PP rate. */
      asGems: number | null;
      /** The median gem ask among this colour's offers. */
      typicalGems: number;
      /** How many typical gem asks this cost is. Null when there is nothing to compare with. */
      ratio: number | null;
      /** True for a PP cost with no PP per 100 Large Resource Packs set. */
      noPpRate: boolean;
      pain: number;
    };

const rankOf = (category: CurrencyCategory, ctx: PainContext) => {
  const { steps, totalSteps } = rowPlace(category, ctx);
  return { rank: ctx.preference.indexOf(category) + 1, rows: ctx.preference.length, steps, totalSteps };
};

/** Pain of one offer. Pass `parts` to also collect what each cost added. */
export function offerPain(shape: PainShape, colour: OrbCardId, ctx: PainContext, parts?: PainPart[]): Pain {
  if (shape.blind) return { pain: 0, hours: 0 };

  const rate = (shape.kind === 'essence' ? ctx.essenceRates : ctx.runeRates)[shape.tier] ?? 0;
  const hours = shape.amount <= 0 ? 0 : rate > 0 ? shape.amount / rate : Infinity;
  // A comfort of zero hours means any essence at all is unbearable.
  let pain = hours === 0 ? 0 : ctx.comfortHours > 0 ? hours / ctx.comfortHours : Infinity;
  parts?.push({ kind: 'time', hours, comfortHours: ctx.comfortHours, pain });

  const gems = rowPlace('gems', ctx).pain;
  const typicalGems = ctx.medianGem[colour];
  for (const extra of shape.extras) {
    if (extra.category === 'gems' || extra.category === 'pp') {
      const asGems =
        extra.category === 'gems'
          ? extra.amount
          : ctx.ppPer100Packs > 0
            ? (extra.amount * WIZARD.gemsPer100LargePacks) / ctx.ppPer100Packs
            : null;
      // Without a PP rate, or with nothing to compare to, a gem cost is just its row.
      const ratio = asGems !== null && typicalGems > 0 ? asGems / typicalGems : null;
      const added = ratio !== null ? gems * ratio : gems;
      pain += added;
      parts?.push({
        kind: 'gems',
        category: extra.category,
        ...rankOf('gems', ctx),
        rowPain: gems,
        asGems,
        typicalGems,
        ratio,
        noPpRate: extra.category === 'pp' && ctx.ppPer100Packs <= 0,
        pain: added,
      });
    } else {
      const added = rowPlace(extra.category, ctx).pain;
      pain += added;
      parts?.push({ kind: 'row', category: extra.category, ...rankOf(extra.category, ctx), pain: added });
    }
  }
  return { pain, hours };
}

/** A colour's supply of orbs, ordered by pain per orb, for placing an offer in it. */
interface Supply {
  painPerOrb: number[];
  /** Orbs from every sampled offer up to and including this index. */
  cumulative: number[];
  total: number;
}

let supplyCache: { key: string; supply: Record<OrbCardId, Supply> } | null = null;
let supplySamples: Record<OrbCardId, SampledOffer[]> | null = null;

function supplies(samples: Record<OrbCardId, SampledOffer[]>, ctx: PainContext): Record<OrbCardId, Supply> {
  // Samples are cached by identity in offers.ts, so a change to them is a new object.
  const key = JSON.stringify(ctx);
  if (supplyCache?.key === key && supplySamples === samples) return supplyCache.supply;

  const out = {} as Record<OrbCardId, Supply>;
  for (const id of ORB_CARD_IDS) {
    const scored = samples[id]
      .map((s) => {
        const { pain } = offerPain(
          { blind: s.blind, kind: s.slot1Kind, tier: s.slot1Tier, amount: s.slot1Amount, extras: s.extras },
          id,
          ctx,
        );
        return { perOrb: s.orbs > 0 ? pain / s.orbs : Infinity, orbs: s.orbs };
      })
      // Not `a - b`: offers you cannot pay are Infinity, and Infinity − Infinity is NaN.
      .sort((a, b) => (a.perOrb === b.perOrb ? 0 : a.perOrb < b.perOrb ? -1 : 1));
    let running = 0;
    out[id] = {
      painPerOrb: scored.map((s) => s.perOrb),
      cumulative: scored.map((s) => (running += s.orbs)),
      total: running,
    };
  }
  supplyCache = { key, supply: out };
  supplySamples = samples;
  return out;
}

/** Orb-weighted share of a supply cheaper per orb than `x`, counting ties as half. */
function cheaperShare(supply: Supply, x: number): number {
  if (supply.total <= 0) return 0;
  const lower = (strict: boolean) => {
    let lo = 0;
    let hi = supply.painPerOrb.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const v = supply.painPerOrb[mid]!;
      if (strict ? v < x : v <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const below = lower(true);
  const upTo = lower(false);
  const orbsBelow = below > 0 ? supply.cumulative[below - 1]! : 0;
  const orbsUpTo = upTo > 0 ? supply.cumulative[upTo - 1]! : 0;
  return (orbsBelow + (orbsUpTo - orbsBelow) / 2) / supply.total;
}

export interface OfferScore {
  /** 0–100; 50 is break-even. */
  score: number;
  /** Share of this colour's orbs that come cheaper. */
  p: number;
  /** Share of this colour's offers needed. */
  s: number;
  pain: number;
  painPerOrb: number;
  hours: number;
  reason: string;
  /** What each cost added to `pain`. Empty for a blind offer. */
  parts: PainPart[];
}

const percent = (x: number) => `${Math.round(x * 100)}%`;

function reasonFor(
  offer: WizardOffer,
  colour: ColourOutlook,
  outlook: WizardOutlook,
  score: number,
  p: number,
  hours: number,
): string {
  const name = COLOUR_LABELS[offer.colour];
  if (colour.needed <= 0) {
    return colour.remaining > 0
      ? `Your satchel already has every ${name} Orb you need`
      : `No upgrades left to buy with ${name} Orbs`;
  }
  if (!offer.blind && !Number.isFinite(hours)) {
    // Essence is uncountable ("any Jagged Essence"); runes are not ("any Chasm Runes").
    const asked = slot1Label(offer.slot1.kind, offer.slot1.tier);
    return `You don't produce any ${offer.slot1.kind === 'rune' ? `${asked}s` : asked}`;
  }
  if (offer.blind) return 'Free (blind wizard)';
  if (colour.status === 'bottleneck') return `${name} Orbs are your bottleneck: every orb counts`;
  if (score >= 50) {
    return `Only ${percent(p)} of ${name} Orbs on offer are cheaper per orb, and you need ${percent(colour.share)} of ${name} Orb offers`;
  }
  const bottleneck = outlook.bottleneck ? `${COLOUR_LABELS[outlook.bottleneck]} Orbs` : 'your last orb colour';
  return `Cheaper ${name} Orb offers alone will get every ${name} Orb you need before ${bottleneck} are done, so you can skip this one`;
}

export function scoreOffer(
  offer: WizardOffer,
  outlook: WizardOutlook,
  ctx: PainContext,
  samples: Record<OrbCardId, SampledOffer[]>,
): OfferScore {
  const colour = outlook.colours[offer.colour];
  const parts: PainPart[] = [];
  const { pain, hours } = offerPain(
    { blind: offer.blind, kind: offer.slot1.kind, tier: offer.slot1.tier, amount: offer.slot1.amount, extras: offer.extras },
    offer.colour,
    ctx,
    parts,
  );
  const painPerOrb = offer.orbs > 0 ? pain / offer.orbs : Infinity;
  const p = cheaperShare(supplies(samples, ctx)[offer.colour], painPerOrb);
  const s = colour.share;
  const score = s <= 0 ? 0 : (100 * s) / (s + p);
  return {
    score,
    p,
    s,
    pain,
    painPerOrb,
    hours,
    reason: reasonFor(offer, colour, outlook, score, p, hours),
    parts,
  };
}
