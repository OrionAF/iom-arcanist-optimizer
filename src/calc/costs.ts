import type { CostCurve, ResourceBundle, Resource } from './types';

/**
 * The price of buying level `level` (1-based), as the game charges it.
 *
 * The game's `upg_add` rounds every level's price half up to a whole unit, and
 * buying several levels sums those rounded prices. Every price here is
 * positive, so `Math.round` is exactly round-half-up.
 */
export function levelPrice(curve: CostCurve, level: number): number {
  const raw =
    curve.kind === 'geometric'
      ? curve.base * curve.ratio ** (level - 1)
      : curve.first + (level - 1) * curve.step;
  return Math.round(raw);
}

/**
 * Cost of buying levels `from+1 .. to`.
 *
 * A running sum rather than closed form, because each term is rounded before
 * it is added. No row has more than 30 levels, so this stays cheap enough for
 * the optimizer's recompute loop.
 */
export function curveCost(curve: CostCurve, from: number, to: number): number {
  let sum = 0;
  for (let level = from + 1; level <= to; level += 1) sum += levelPrice(curve, level);
  return sum;
}

/** Sum the tier bundles for levels `from+1 .. to`. */
export function tieredCost(
  tiers: readonly ResourceBundle[],
  from: number,
  to: number,
): ResourceBundle {
  const out: ResourceBundle = {};
  for (let i = from; i < to && i < tiers.length; i += 1) {
    const tier = tiers[i];
    if (!tier) continue;
    for (const [resource, amount] of Object.entries(tier) as [Resource, number][]) {
      out[resource] = (out[resource] ?? 0) + amount;
    }
  }
  return out;
}

/** Add `src` into `dst` in place. */
export function addBundle(dst: Partial<Record<Resource, number>>, src: ResourceBundle): void {
  for (const [resource, amount] of Object.entries(src) as [Resource, number][]) {
    dst[resource] = (dst[resource] ?? 0) + amount;
  }
}
