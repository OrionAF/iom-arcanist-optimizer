/**
 * How far down the page the pinned chrome reaches.
 *
 * The ledger owns the measurement — it is the thing being measured — and
 * everything that pins itself underneath reads the answer: the tab strips, and
 * the read-only column on a wide screen.
 *
 * It travels as a CSS variable because that is where the layout needs it, and
 * as an event as well because the one thing JavaScript does with it (fading a
 * tab strip out as its panel runs out) has to be recomputed when it moves.
 */

export const PIN_EVENT = 'arcanist:pin';

export type PinVar = '--ledger-h' | '--rail-h';

/**
 * Publish one of the measurements. Silent when nothing changed, so a
 * ResizeObserver firing on every scroll-driven reflow costs nothing.
 */
export function setPinHeight(name: PinVar, px: number): void {
  const root = document.documentElement;
  const next = `${Math.round(px)}px`;
  if (root.style.getPropertyValue(name) === next) return;
  root.style.setProperty(name, next);
  window.dispatchEvent(new Event(PIN_EVENT));
}

/**
 * Keep `name` in step with an element's height for as long as it is mounted.
 * Returns the teardown, so it can be handed straight back from an effect.
 */
export function trackPinHeight(element: HTMLElement, name: PinVar): () => void {
  const publish = () => setPinHeight(name, element.offsetHeight);
  publish();
  const observer = new ResizeObserver(publish);
  observer.observe(element);
  return () => observer.disconnect();
}
