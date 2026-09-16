/**
 * What Wizard Exchange offers look like at the player's state.
 *
 * A model of how the Exchange builds an offer
 * (docs/wizard_predict/wizard_exchange_spec.md §4), used as a distribution:
 * it samples offers of each colour so an entered offer can be placed among
 * the ones the player will see. It is not the game's RNG and predicts nothing.
 *
 * Sampling uses a fixed seed, so the same inputs always give the same scores,
 * and draws a fixed count per colour rather than per refresh. Scoring needs
 * each colour's own distribution; how often each colour appears is worked out
 * separately from its weight, in need.ts.
 */

import type { ArcanistInput, CardTier, OfferCategory, OrbCardId, WizardInput, WizardOffer } from '../types';
import { ORB_CARD_IDS } from '../types';
import { CARD_SCALES, WIZARD, cardValue } from '../constants';

/** The game's twelve cost categories, mapped to what the scorer reads. Essence and runes are slot 1 only. */
const GAME_CATEGORIES: readonly (OfferCategory | null)[] = [
  'stars',
  'bars',
  'veins',
  'fragments',
  'fish',
  'gems',
  'pp',
  null,
  null,
  'commonItems',
  'food',
  'rareItems',
];

/** One sampled offer, trimmed to what scoring reads. */
export interface SampledOffer {
  orbs: number;
  blind: boolean;
  slot1Kind: 'essence' | 'rune';
  slot1Tier: 0 | 1 | 2;
  slot1Amount: number;
  extras: { category: OfferCategory; amount: number }[];
}

/** Mulberry32: small, fast, and deterministic across runtimes. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The game's "non-bankers" rounding: half up. */
const roundHalfUp = (x: number) => Math.floor(x + 0.5);

/** `chance(num, 1000)`: an integer roll of 1..1000 at or under `num`. */
const permille = (percent: number) => Math.min(Math.max(Math.floor(percent * 10), 0), 1000) / 1000;

/** Weighted pick: r in 0..total inclusive, first index whose running sum reaches it. */
function weightedPick(weights: readonly number[], random: () => number): number {
  let total = 0;
  for (const w of weights) if (w > 0) total += w;
  const r = Math.floor(random() * (total + 1));
  let acc = 0;
  for (let i = 0; i < weights.length; i += 1) {
    const w = weights[i]!;
    if (w <= 0) continue;
    acc += w;
    if (acc >= r) return i;
  }
  return weights.length - 1;
}

/**
 * The orb card's multiplier for one colour: 1 plus the tier bonus, plus Poly
 * Orb Card Multi on a Polychrome card only.
 */
export function orbCardMulti(tier: CardTier, polyOrbLevel: number): number {
  const poly = tier === 'polychrome' ? polyOrbLevel * WIZARD.polyOrbPerLevel : 0;
  return 1 + cardValue(CARD_SCALES.orbTrade, tier) + poly;
}

/** Everything sampling reads. A change to anything else leaves the samples valid. */
export interface SampleInputs {
  traded: WizardInput['traded'];
  lootMulti: number;
  partyChance: number;
  partyMulti: number;
  blindChance: number;
  discoChance: number;
  flashbangChance: number;
  polyOrbLevel: number;
  orbCards: Record<OrbCardId, CardTier>;
}

/** The sampling inputs a build carries. */
export function sampleInputsFor(input: ArcanistInput): SampleInputs {
  const { wizard } = input;
  return {
    traded: wizard.traded,
    lootMulti: wizard.lootMulti,
    partyChance: wizard.partyChance,
    partyMulti: wizard.partyMulti,
    blindChance: wizard.blindChance,
    discoChance: wizard.discoChance,
    flashbangChance: wizard.flashbangChance,
    polyOrbLevel: wizard.polyOrbLevel,
    orbCards: input.external.cards.orb,
  };
}

/** What every cost of colour index `c` is built from, at the player's tallies. */
function costState(c: number, traded: WizardInput['traded']) {
  const tally = ORB_CARD_IDS.map((id) => traded[id]);
  const total = tally.reduce((sum, n) => sum + n, 0);
  const over = total >= WIZARD.scalingThreshold;
  const T = over ? WIZARD.orbCountMaxed[c]! : tally[c]!;
  return {
    tally,
    over,
    q: Math.max(Math.floor(T / 15), 1),
    flat: Math.min(total, WIZARD.scalingThreshold) / 30,
    base: WIZARD.costBase[c]! * Math.pow(WIZARD.costAmp[c]!, T),
    slot1Scale: Math.max(1, 0.0009 * (total - WIZARD.scalingThreshold) + 1),
    extraScale: Math.max(1, WIZARD.costScale[c]! * (tally[c]! - WIZARD.orbCountMaxed[c]!) * (over ? 1 : 0) + 1),
  };
}

/** Sample one offer of colour index `c`, in the game's order of decisions. */
function sampleOffer(c: number, inputs: SampleInputs, random: () => number): SampledOffer {
  const { tally, over, q, flat, base, slot1Scale, extraScale } = costState(c, inputs.traded);
  const flag = c >= 2 ? 1 : 0;

  // Refresh-wide rolls, taken per offer: each offer's marginal odds are the same.
  const flashbang = random() < permille(inputs.flashbangChance);
  const disco = random() < permille(inputs.discoChance);

  // Slot 1 tier: Purple and up never ask Soft or Ash.
  let essSum = 0;
  for (let k = 0; k < 6; k += 1) {
    essSum += Math.min(over ? WIZARD.orbCountMaxed[k]! : tally[k]!, WIZARD.tradesPerEssenceTier);
  }
  const count = Math.min(4, Math.floor(essSum / WIZARD.tradesPerEssenceTier)) - flag + 1;
  let sumW = 0;
  for (let m = 0; m < count; m += 1) sumW += WIZARD.essenceTierWeights[m] ?? 0;
  const r = random() * sumW;
  let pick = count - 1;
  let acc = 0;
  for (let m = 0; m < count; m += 1) {
    acc += WIZARD.essenceTierWeights[m] ?? 0;
    if (r < acc) {
      pick = m;
      break;
    }
  }
  const tier = Math.max(0, Math.min(2, flag + pick)) as 0 | 1 | 2;
  const isRune = random() < WIZARD.runeChance;

  // Slot 1 amount range.
  const multi = isRune
    ? WIZARD.runeMulti
    : 1 /
      (WIZARD.essenceDivisorMin + random() * (WIZARD.essenceDivisorMax - WIZARD.essenceDivisorMin));
  const lo = ((1.1 * q + flat) / (tier + 1)) * multi;
  const hi = ((1.3 * q + flat) / (tier + 1)) * multi;

  // Bonus state.
  const party = random() < permille(inputs.partyChance) || disco;
  const blind = random() < permille(inputs.blindChance) || flashbang;

  // Reward, at its expected value: the game rolls the fraction as a chance of one more.
  let orbs = orbCardMulti(inputs.orbCards[ORB_CARD_IDS[c]!], inputs.polyOrbLevel);
  if (party) orbs *= inputs.partyMulti;
  orbs *= inputs.lootMulti;
  if (tier === 2) orbs *= WIZARD.tier2RewardMulti;

  const loInt = Math.trunc(Math.min(lo, hi));
  const span = Math.trunc(Math.max(lo, hi)) - loInt + 1;
  const ev = loInt + Math.floor(random() * span);
  const slot1Amount = roundHalfUp(base * slot1Scale * ev);

  // Extra slots: two or three costs in total, no category twice.
  const n = random() < 0.5 ? 2 : 3;
  const weights = [...WIZARD.categoryWeights];
  const extras: SampledOffer['extras'] = [];
  for (let j = 1; j < n; j += 1) {
    const cat = weightedPick(weights, random);
    weights[cat] = 0;
    const category = GAME_CATEGORIES[cat];
    const rr = 0.95 + random() * 0.1;
    const amount = roundHalfUp(base * extraScale * rr * WIZARD.categoryResourceMulti[cat]!);
    if (category) extras.push({ category, amount });
  }

  return {
    orbs,
    blind,
    slot1Kind: isRune ? 'rune' : 'essence',
    slot1Tier: tier,
    slot1Amount: blind ? 0 : slot1Amount,
    extras: blind ? extras.map((e) => ({ ...e, amount: 0 })) : extras,
  };
}

const SEED = 74;

let cached: { key: string; samples: Record<OrbCardId, SampledOffer[]> } | null = null;

/** Sampled offers per colour. Cached on the inputs that affect them. */
export function sampleOffers(
  inputs: SampleInputs,
  perColour: number = WIZARD.samplesPerColour,
): Record<OrbCardId, SampledOffer[]> {
  const key = JSON.stringify([inputs, perColour]);
  if (cached?.key === key) return cached.samples;

  const random = seededRandom(SEED);
  const samples = {} as Record<OrbCardId, SampledOffer[]>;
  ORB_CARD_IDS.forEach((id, c) => {
    const list: SampledOffer[] = [];
    for (let i = 0; i < perColour; i += 1) list.push(sampleOffer(c, inputs, random));
    samples[id] = list;
  });

  cached = { key, samples };
  return samples;
}

// ---------------------------------------------------------- cost checking --

/** The lowest and highest amount the game can roll for one cost. */
export interface CostRange {
  min: number;
  max: number;
}

/**
 * How far outside the rollable range a typed cost may sit before it is flagged.
 * Slack for a stale Orbs Traded count and the game's rounded display, and small
 * enough that a digit too many or too few, ×10, is always caught.
 */
export const COST_SLACK = 1.35;

/** The essence or rune amounts a wizard of this colour can ask. */
export function slot1Range(
  colour: OrbCardId,
  kind: 'essence' | 'rune',
  tier: 0 | 1 | 2,
  traded: WizardInput['traded'],
): CostRange {
  const { q, flat, base, slot1Scale } = costState(ORB_CARD_IDS.indexOf(colour), traded);
  // Essence divides by an unseeded roll of 1.5–2; runes always double.
  const [lowMulti, highMulti] =
    kind === 'rune'
      ? [WIZARD.runeMulti, WIZARD.runeMulti]
      : [1 / WIZARD.essenceDivisorMax, 1 / WIZARD.essenceDivisorMin];
  const lowEv = Math.trunc(((1.1 * q + flat) / (tier + 1)) * lowMulti);
  const highEv = Math.trunc(((1.3 * q + flat) / (tier + 1)) * highMulti);
  return { min: roundHalfUp(base * slot1Scale * lowEv), max: roundHalfUp(base * slot1Scale * highEv) };
}

/** The Gems or PP a wizard of this colour can ask: the cost roll is 0.95–1.05. */
export function extraRange(colour: OrbCardId, category: 'gems' | 'pp', traded: WizardInput['traded']): CostRange {
  const { base, extraScale } = costState(ORB_CARD_IDS.indexOf(colour), traded);
  const amount = base * extraScale * WIZARD.categoryResourceMulti[GAME_CATEGORIES.indexOf(category)]!;
  return { min: amount * 0.95, max: amount * 1.05 };
}

export interface UnusualCost {
  /** Which cost: the offer's slot 1, or an index into its extras. */
  slot: 'slot1' | number;
  amount: number;
  range: CostRange;
}

/**
 * Typed costs no wizard of this colour could ask at these tallies, most likely
 * typos. Blind offers cost nothing, and a cost left at 0 has not been entered.
 */
export function unusualCosts(offer: WizardOffer, traded: WizardInput['traded']): UnusualCost[] {
  if (offer.blind) return [];
  const out: UnusualCost[] = [];
  const check = (slot: UnusualCost['slot'], amount: number, range: CostRange) => {
    if (amount > 0 && (amount < range.min / COST_SLACK || amount > range.max * COST_SLACK)) {
      out.push({ slot, amount, range });
    }
  };
  check('slot1', offer.slot1.amount, slot1Range(offer.colour, offer.slot1.kind, offer.slot1.tier, traded));
  offer.extras.forEach((extra, i) => {
    if (extra.category === 'gems' || extra.category === 'pp') {
      check(i, extra.amount, extraRange(offer.colour, extra.category, traded));
    }
  });
  return out;
}

/** Colour odds per wizard from the colour weights, every colour counted as unlocked. */
export function colourOdds(): Record<OrbCardId, number> {
  const total = WIZARD.colourWeights.reduce((sum, w) => sum + w, 0);
  const odds = {} as Record<OrbCardId, number>;
  ORB_CARD_IDS.forEach((id, c) => {
    odds[id] = WIZARD.colourWeights[c]! / total;
  });
  return odds;
}
