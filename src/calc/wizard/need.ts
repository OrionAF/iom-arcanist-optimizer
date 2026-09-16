/**
 * How many orbs each colour still needs, and how long the Exchange takes to
 * supply them.
 *
 * The horizon is set by the slowest colour: you keep refreshing until it is
 * done, so a faster colour only needs the share of its offers that finishes it
 * by then. That share is what makes an offer worth taking or skipping.
 */

import { WIZARD } from '../constants';
import type { ArcanistInput, ArcanistResult, OrbCardId, Resource } from '../types';
import { ORB_CARD_IDS } from '../types';
import { colourOdds, type SampledOffer } from './offers';

export type ColourStatus = 'done' | 'needed' | 'bottleneck';

export interface ColourOutlook {
  colour: OrbCardId;
  /** Orbs every unbought upgrade of this colour still costs. */
  remaining: number;
  /** Orbs already spent on the upgrades bought so far. */
  spent: number;
  /** Orbs traded and not yet spent: traded minus spent, never below 0. */
  satchel: number;
  /** Orbs spent beyond what was traded, which means Orbs Traded is behind. 0 normally. */
  overspent: number;
  /** Orbs still to get: remaining minus the satchel, raised to cover the next colour's unlock. */
  needed: number;
  /** Whether wizards of this colour are still gated behind the previous colour. */
  locked: boolean;
  /** The previous colour's trades still missing for this colour's unlock. */
  unlockShortfall: number;
  offersPerRefresh: number;
  orbsPerOffer: number;
  orbsPerRefresh: number;
  /** Refreshes to finish at the rate every offer of this colour is taken. */
  refreshes: number;
  /** Share of this colour's offers needed to finish by the bottleneck. 0 when done, 1 at most. */
  share: number;
  status: ColourStatus;
}

export interface WizardOutlook {
  colours: Record<OrbCardId, ColourOutlook>;
  bottleneck: OrbCardId | null;
  refreshSeconds: number;
}

/** Seconds to bank one refresh. */
export function refreshSeconds(level: number): number {
  const clamped = Math.min(Math.max(Math.floor(level), 0), WIZARD.maxTimerLevel);
  return WIZARD.refreshBaseSeconds - WIZARD.refreshSecondsPerLevel * clamped;
}

const orbResource = (id: OrbCardId) => `${id}Orb` as Resource;

export function wizardOutlook(
  input: ArcanistInput,
  result: ArcanistResult,
  samples: Record<OrbCardId, SampledOffer[]>,
): WizardOutlook {
  const { wizard } = input;
  const odds = colourOdds();

  // The satchel is not typed in: every orb traded is either still held or has
  // gone into an upgrade, so what is held follows from Orbs Traded and the
  // levels already bought.
  const remaining = ORB_CARD_IDS.map((id) => result.totals.remaining[orbResource(id)] ?? 0);
  const spent = ORB_CARD_IDS.map((id, k) => (result.totals.total[orbResource(id)] ?? 0) - remaining[k]!);
  const satchel = ORB_CARD_IDS.map((id, k) => Math.max(wizard.traded[id] - spent[k]!, 0));
  const needed = ORB_CARD_IDS.map((_, k) => Math.max(remaining[k]! - satchel[k]!, 0));

  // A locked colour cannot be supplied until the colour before it has traded
  // enough, so that colour needs at least the shortfall — however many of its
  // own upgrades are left. Walked from the top so a chain of locks carries down.
  const shortfall = ORB_CARD_IDS.map(() => 0);
  const locked = ORB_CARD_IDS.map(() => false);
  for (let k = ORB_CARD_IDS.length - 1; k >= 1; k -= 1) {
    const previous = ORB_CARD_IDS[k - 1]!;
    const gap = WIZARD.unlockGates[k]! - wizard.traded[previous];
    if (gap <= 0) continue;
    locked[k] = true;
    shortfall[k] = gap;
    if (needed[k]! > 0) needed[k - 1] = Math.max(needed[k - 1]!, gap);
  }

  const colours = {} as Record<OrbCardId, ColourOutlook>;
  ORB_CARD_IDS.forEach((id, k) => {
    const list = samples[id];
    const orbsPerOffer = list.length > 0 ? list.reduce((sum, s) => sum + s.orbs, 0) / list.length : 0;
    const offersPerRefresh = wizard.wizardCount * odds[id];
    const orbsPerRefresh = offersPerRefresh * orbsPerOffer;
    const need = needed[k]!;
    colours[id] = {
      colour: id,
      remaining: remaining[k]!,
      spent: spent[k]!,
      satchel: satchel[k]!,
      overspent: Math.max(spent[k]! - wizard.traded[id], 0),
      needed: need,
      locked: locked[k]!,
      unlockShortfall: shortfall[k]!,
      offersPerRefresh,
      orbsPerOffer,
      orbsPerRefresh,
      refreshes: need > 0 ? (orbsPerRefresh > 0 ? need / orbsPerRefresh : Infinity) : 0,
      share: 0,
      status: need > 0 ? 'needed' : 'done',
    };
  });

  let bottleneck: OrbCardId | null = null;
  for (const id of ORB_CARD_IDS) {
    const outlook = colours[id];
    if (outlook.needed <= 0) continue;
    if (bottleneck === null || outlook.refreshes > colours[bottleneck].refreshes) bottleneck = id;
  }

  if (bottleneck !== null) {
    const horizon = colours[bottleneck].refreshes;
    for (const id of ORB_CARD_IDS) {
      const outlook = colours[id];
      if (outlook.needed <= 0) continue;
      outlook.share = Number.isFinite(horizon) ? Math.min(outlook.refreshes / horizon, 1) : 1;
    }
    colours[bottleneck].status = 'bottleneck';
  }

  return { colours, bottleneck, refreshSeconds: refreshSeconds(wizard.exchangeTimerLevel) };
}
