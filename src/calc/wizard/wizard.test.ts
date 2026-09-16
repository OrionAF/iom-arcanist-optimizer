import { describe, expect, it } from 'vitest';

import { EXAMPLE_INPUT } from '../../presets/example';
import { FRESH_WIZARD } from '../../presets/fresh';
import { compute } from '../engine';
import { formatCompact, parseAmount } from '../format';
import type { ArcanistInput, OrbCardId, WizardOffer } from '../types';
import { ORB_CARD_IDS } from '../types';
import { refreshSeconds, wizardOutlook } from './need';
import {
  extraRange,
  orbCardMulti,
  sampleInputsFor,
  sampleOffers,
  slot1Range,
  unusualCosts,
  type SampleInputs,
} from './offers';
import {
  NEGLIGIBLE_STEP,
  SIGNIFICANT_STEP,
  offerPain,
  painContext,
  preferencePains,
  scoreOffer,
} from './score';

const sampleInputs = (input: ArcanistInput, patch: Partial<SampleInputs> = {}): SampleInputs => ({
  ...sampleInputsFor(input),
  ...patch,
});

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

describe('parseAmount', () => {
  it('reads game-style suffixes in any case', () => {
    expect(parseAmount('82.717Sp')).toBeCloseTo(82.717e24, -18);
    expect(parseAmount('82.717sp')).toBeCloseTo(82.717e24, -18);
    expect(parseAmount('1.5k')).toBe(1500);
    expect(parseAmount('71K')).toBe(71000);
  });

  it('reads every magnitude the game names, up to nvdc', () => {
    const units: Record<string, number> = {
      k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15, qi: 1e18, sx: 1e21, sp: 1e24, oc: 1e27, no: 1e30,
      dc: 1e33, udc: 1e36, ddc: 1e39, tdc: 1e42, qadc: 1e45, qidc: 1e48, sxdc: 1e51, spdc: 1e54,
      ocdc: 1e57, nvdc: 1e60,
    };
    for (const [unit, scale] of Object.entries(units)) {
      expect(parseAmount(`2${unit}`) / (2 * scale)).toBeCloseTo(1, 10);
    }
  });

  it('reads scientific, grouped and plain numbers', () => {
    expect(parseAmount('8.2717e25')).toBe(8.2717e25);
    expect(parseAmount('37,500')).toBe(37500);
    expect(parseAmount('  212 ')).toBe(212);
  });

  it('rejects what it cannot read instead of calling it zero', () => {
    expect(parseAmount('')).toBeNaN();
    expect(parseAmount('12zz')).toBeNaN();
    expect(parseAmount('abc')).toBeNaN();
  });

  it('reads back what formatCompact writes', () => {
    for (const value of [1500, 2.5e9, 3.64e44, 82.72e24]) {
      const text = formatCompact(value);
      expect(parseAmount(text) / value).toBeCloseTo(1, 2);
    }
  });
});

describe('offer sampling', () => {
  it('is deterministic for the same inputs', () => {
    const a = sampleOffers(sampleInputs(EXAMPLE_INPUT), 500);
    const b = sampleOffers(sampleInputs(EXAMPLE_INPUT, { lootMulti: 1.2 }), 500);
    const c = sampleOffers(sampleInputs(EXAMPLE_INPUT), 500);
    expect(c).toEqual(a);
    expect(b.white[0]!.orbs).not.toBe(a.white[0]!.orbs);
  });

  it('asks runes about 30% of the time', () => {
    const offers = sampleOffers(sampleInputs(EXAMPLE_INPUT), 4000).white;
    const runes = offers.filter((o) => o.slot1Kind === 'rune').length / offers.length;
    expect(runes).toBeGreaterThan(0.27);
    expect(runes).toBeLessThan(0.33);
  });

  it('never asks Purple and up for Soft Essence or Ash Runes once any tier is open', () => {
    const traded = { white: 900, green: 900, purple: 900, orange: 900, red: 900, yellow: 900 };
    const samples = sampleOffers(sampleInputs(EXAMPLE_INPUT, { traded }), 1000);
    expect(samples.purple.every((o) => o.slot1Tier >= 1)).toBe(true);
    expect(samples.white.some((o) => o.slot1Tier === 0)).toBe(true);
  });

  it('asks two or three costs with no category twice, tier 3 items rarely', () => {
    const offers = sampleOffers(sampleInputs(EXAMPLE_INPUT), 4000).green;
    for (const offer of offers) {
      const categories = offer.extras.map((e) => e.category);
      expect(new Set(categories).size).toBe(categories.length);
      expect(categories.length).toBeLessThanOrEqual(2);
    }
    const rare = offers.filter((o) => o.extras.some((e) => e.category === 'rareItems')).length;
    expect(rare / offers.length).toBeLessThan(0.04);
  });

  it('pays the party multiplier on party wizards', () => {
    const plain = sampleOffers(sampleInputs(EXAMPLE_INPUT, { partyChance: 0, discoChance: 0, lootMulti: 1 }), 4000);
    const party = sampleOffers(sampleInputs(EXAMPLE_INPUT, { partyChance: 50, discoChance: 0, lootMulti: 1 }), 4000);
    // White has a Gilded card (×1.3); half the offers triple.
    expect(mean(party.white.map((o) => o.orbs)) / mean(plain.white.map((o) => o.orbs))).toBeCloseTo(2, 1);
  });

  it('makes blind wizards free', () => {
    const offers = sampleOffers(sampleInputs(EXAMPLE_INPUT, { blindChance: 100 }), 200).red;
    expect(offers.every((o) => o.blind && o.slot1Amount === 0 && o.extras.every((e) => e.amount === 0))).toBe(true);
  });

  it('lifts only a Polychrome orb card with Poly Orb Card Multi', () => {
    expect(orbCardMulti('polychrome', 10)).toBeCloseTo(1.75);
    expect(orbCardMulti('gilded', 10)).toBeCloseTo(1.3);
    expect(orbCardMulti('none', 10)).toBe(1);
  });
});

describe('colour outlook', () => {
  const result = compute(EXAMPLE_INPUT);
  const samples = sampleOffers(sampleInputs(EXAMPLE_INPUT), 1000);

  it('banks a refresh every 2 hours, 2 minutes faster per timer level', () => {
    expect(refreshSeconds(0)).toBe(7200);
    expect(refreshSeconds(30)).toBe(3600);
    expect(refreshSeconds(99)).toBe(3600);
  });

  it('works the satchel out as traded minus what bought upgrades cost', () => {
    const input = structuredClone(EXAMPLE_INPUT);
    const white = () => wizardOutlook(input, result, samples).colours.white;
    const spent = result.totals.total.whiteOrb - result.totals.remaining.whiteOrb;
    expect(white().remaining).toBe(result.totals.remaining.whiteOrb);
    expect(white().spent).toBe(spent);

    input.wizard.traded.white = spent + 500;
    expect(white().satchel).toBe(500);
    expect(white().overspent).toBe(0);
    expect(white().needed).toBe(Math.max(white().remaining - 500, 0));

    // Traded behind the levels already bought: an empty satchel, not a negative one.
    input.wizard.traded.white = Math.max(spent - 40, 0);
    expect(white().satchel).toBe(0);
    expect(white().overspent).toBe(spent - input.wizard.traded.white);
    expect(white().needed).toBe(white().remaining);
  });

  it('makes the colour before a locked one cover its unlock', () => {
    // The example has traded 120 Purple; Orange unlocks at 150.
    const outlook = wizardOutlook(EXAMPLE_INPUT, result, samples);
    const purple = outlook.colours.purple;
    expect(outlook.colours.orange.locked).toBe(true);
    expect(outlook.colours.orange.unlockShortfall).toBe(30);
    expect(purple.needed).toBe(Math.max(purple.remaining - purple.satchel, 30));
  });

  it('gives the bottleneck a share of 1 and everything else less', () => {
    const outlook = wizardOutlook(EXAMPLE_INPUT, result, samples);
    expect(outlook.bottleneck).not.toBeNull();
    expect(outlook.colours[outlook.bottleneck!].share).toBe(1);
    for (const id of ORB_CARD_IDS) {
      expect(outlook.colours[id].share).toBeGreaterThanOrEqual(0);
      expect(outlook.colours[id].share).toBeLessThanOrEqual(1);
    }
  });
});

describe('offer scores', () => {
  const result = compute(EXAMPLE_INPUT);
  const samples = sampleOffers(sampleInputs(EXAMPLE_INPUT), 2000);
  const outlook = wizardOutlook(EXAMPLE_INPUT, result, samples);
  const ctx = painContext(EXAMPLE_INPUT, result, samples);

  const offer = (colour: OrbCardId, patch: Partial<WizardOffer> = {}): WizardOffer => ({
    id: 'x',
    colour,
    orbs: 2,
    party: false,
    blind: false,
    slot1: { kind: 'essence', tier: 0, amount: 150 },
    extras: [{ category: 'fish', amount: 0 }],
    traded: false,
    ...patch,
  });

  const needy = ORB_CARD_IDS.find((id) => outlook.colours[id].needed > 0)!;

  it('scores a blind wizard as free', () => {
    const scored = scoreOffer(offer(needy, { blind: true }), outlook, ctx, samples);
    expect(scored.pain).toBe(0);
    expect(scored.score).toBeGreaterThan(50);
  });

  it('scores a bottleneck offer at 50 or more', () => {
    const scored = scoreOffer(offer(outlook.bottleneck!), outlook, ctx, samples);
    expect(scored.score).toBeGreaterThanOrEqual(50);
  });

  it('scores a cheaper offer higher than a dearer one of the same colour', () => {
    const cheap = scoreOffer(offer(needy, { extras: [{ category: 'stars', amount: 0 }] }), outlook, ctx, samples);
    const dear = scoreOffer(
      offer(needy, {
        slot1: { kind: 'essence', tier: 0, amount: 5000 },
        extras: [{ category: 'rareItems', amount: 0 }, { category: 'fragments', amount: 0 }],
      }),
      outlook,
      ctx,
      samples,
    );
    expect(cheap.score).toBeGreaterThan(dear.score);
  });

  it('scores 0 for a colour with nothing left to buy', () => {
    const done = structuredClone(outlook);
    done.colours.white = { ...done.colours.white, needed: 0, share: 0, status: 'done' };
    expect(scoreOffer(offer('white'), done, ctx, samples).score).toBe(0);
  });

  it('scales essence pain by comfort hours', () => {
    const shape = { blind: false, kind: 'essence' as const, tier: 0 as const, amount: 300, extras: [] };
    const one = offerPain(shape, 'white', { ...ctx, comfortHours: 1 });
    const two = offerPain(shape, 'white', { ...ctx, comfortHours: 2 });
    expect(two.pain).toBeCloseTo(one.pain / 2);
    expect(one.hours).toBeCloseTo(300 / result.essence.soft.essencePerHour);
  });

  it('prices PP as the gems it takes to buy', () => {
    const noSlot1 = { blind: false, kind: 'essence' as const, tier: 0 as const, amount: 0 };
    const withRate = { ...ctx, ppPer100Packs: 82.717e24 };
    const gems = withRate.medianGem.white;
    const ppForTypicalGems = (gems * withRate.ppPer100Packs) / 37500;
    const asPp = offerPain({ ...noSlot1, extras: [{ category: 'pp', amount: ppForTypicalGems }] }, 'white', withRate);
    const asGems = offerPain({ ...noSlot1, extras: [{ category: 'gems', amount: gems }] }, 'white', withRate);
    expect(asPp.pain).toBeCloseTo(asGems.pain);
    // Without a PP rate, PP is simply the Gems row.
    const unset = offerPain({ ...noSlot1, extras: [{ category: 'pp', amount: 1 }] }, 'white', { ...ctx, ppPer100Packs: 0 });
    const gemsRow = FRESH_WIZARD.preference.indexOf('gems') / (FRESH_WIZARD.preference.length - 1);
    expect(unset.pain).toBeCloseTo(gemsRow);
  });
});

describe('score breakdown', () => {
  it('explains every point of pain', () => {
    const result = compute(EXAMPLE_INPUT);
    const samples = sampleOffers(sampleInputsFor(EXAMPLE_INPUT), 500);
    const ctx = painContext({ ...EXAMPLE_INPUT, wizard: { ...EXAMPLE_INPUT.wizard, ppPer100Packs: 8e25 } }, result, samples);
    const outlook = wizardOutlook(EXAMPLE_INPUT, result, samples);
    const offer: WizardOffer = {
      id: 'x',
      colour: 'green',
      orbs: 4,
      party: false,
      blind: false,
      slot1: { kind: 'essence', tier: 0, amount: 300 },
      extras: [
        { category: 'pp', amount: 5e22 },
        { category: 'fish', amount: 0 },
      ],
      traded: false,
    };
    const scored = scoreOffer(offer, outlook, ctx, samples);
    expect(scored.parts.map((p) => p.kind)).toEqual(['time', 'gems', 'row']);
    expect(scored.parts.reduce((sum, p) => sum + p.pain, 0)).toBeCloseTo(scored.pain);
    // Every currency's effort is its steps from the top ÷ all the steps, as the breakdown says.
    for (const part of scored.parts) {
      if (part.kind === 'row') expect(part.pain).toBeCloseTo(part.steps / part.totalSteps);
      if (part.kind === 'gems') expect(part.rowPain).toBeCloseTo(part.steps / part.totalSteps);
    }
  });
});

describe('unusual costs', () => {
  const tallies: Record<string, SampleInputs['traded']> = {
    early: EXAMPLE_INPUT.wizard.traded,
    'past 3,000': { white: 3463, green: 1842, purple: 1482, orange: 935, red: 516, yellow: 296 },
  };

  for (const [label, traded] of Object.entries(tallies)) {
    it(`never flags an offer the game could roll (${label})`, () => {
      const samples = sampleOffers(sampleInputs(EXAMPLE_INPUT, { traded, blindChance: 0, flashbangChance: 0 }), 2000);
      for (const colour of ORB_CARD_IDS) {
        for (const s of samples[colour]) {
          const offer: WizardOffer = {
            id: 'x',
            colour,
            orbs: s.orbs,
            party: false,
            blind: false,
            slot1: { kind: s.slot1Kind, tier: s.slot1Tier, amount: s.slot1Amount },
            extras: s.extras,
            traded: false,
          };
          expect(unusualCosts(offer, traded)).toEqual([]);
        }
      }
    });
  }

  it('flags a digit too few or too many', () => {
    const traded = tallies['past 3,000']!;
    const range = slot1Range('white', 'rune', 0, traded);
    const typical = Math.round((range.min + range.max) / 2);
    const offer = (amount: number, gems: number): WizardOffer => ({
      id: 'x',
      colour: 'white',
      orbs: 1,
      party: false,
      blind: false,
      slot1: { kind: 'rune', tier: 0, amount },
      extras: [{ category: 'gems', amount: gems }],
      traded: false,
    });
    const gems = extraRange('white', 'gems', traded);
    const typicalGems = (gems.min + gems.max) / 2;

    expect(unusualCosts(offer(typical, typicalGems), traded)).toEqual([]);
    expect(unusualCosts(offer(typical / 10, typicalGems), traded).map((u) => u.slot)).toEqual(['slot1']);
    expect(unusualCosts(offer(typical, typicalGems * 10), traded).map((u) => u.slot)).toEqual([0]);
    // Blind wizards and costs not yet typed in are never flagged.
    expect(unusualCosts({ ...offer(1, 1), blind: true }, traded)).toEqual([]);
    expect(unusualCosts(offer(0, 0), traded)).toEqual([]);
  });
});

describe('Currency Preference bars', () => {
  const preference = FRESH_WIZARD.preference;

  it('space the rows evenly when both are out of the way', () => {
    const pains = preferencePains({ preference, negligibleBar: 0, gapBar: preference.length });
    expect(pains).toEqual(preference.map((_, i) => i / (preference.length - 1)));
  });

  it('squeeze the easy rows together and open a gap before the hard ones', () => {
    // Seven easy rows, then both bars, then the two hard ones.
    const pains = preferencePains({ preference, negligibleBar: 7, gapBar: 7 });
    const total = 6 * NEGLIGIBLE_STEP + SIGNIFICANT_STEP + 1;
    expect(pains[6]).toBeCloseTo((6 * NEGLIGIBLE_STEP) / total);
    expect(pains[7]).toBeCloseTo((6 * NEGLIGIBLE_STEP + SIGNIFICANT_STEP) / total);
    expect(pains[8]).toBe(1);
    // Still in order.
    for (let i = 1; i < pains.length; i++) expect(pains[i]!).toBeGreaterThan(pains[i - 1]!);
  });
});
