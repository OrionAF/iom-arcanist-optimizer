/**
 * What happens when a build arrives from a link.
 *
 * The rule the whole file exists to enforce: **a link is an invitation, not the
 * address of your build.** It is read once, then taken out of the address bar,
 * and what it carries goes on screen without being written over the build you
 * already had. Everything else here follows from that.
 *
 * Kept apart from App so the rules can be tested without a DOM: deciding what
 * a link means is the part that used to be wrong, and it is pure.
 */

import type { ArcanistInput } from '../calc/types';
import { packFields } from './schema';
import type { HashRead } from './url';

export type LinkState =
  /** No link is in play; the build on screen is your own. */
  | { kind: 'none' }
  /**
   * A build from a link is on screen and nothing has been written to storage.
   * `mine` is the build it is standing in front of, kept so it can come back.
   */
  | { kind: 'viewing'; mine: ArcanistInput | null }
  /** The build on screen replaced `previous`, which is backed up and restorable. */
  | { kind: 'kept'; previous: ArcanistInput | null };

export interface Arrival {
  /** The build to show, or null to keep showing what is already there. */
  input: ArcanistInput | null;
  link: LinkState;
  toast: string | null;
}

/**
 * Two builds are the same build when they pack to the same numbers — the packed
 * array is the canonical form, so this ignores key order and any field that
 * never travels in a link.
 */
export function sameBuild(a: ArcanistInput, b: ArcanistInput): boolean {
  const left = packFields(a);
  const right = packFields(b);
  return left.length === right.length && left.every((value, i) => value === right[i]);
}

/**
 * What to do with a link, given the build already on file.
 *
 * A first-time visitor has nothing to lose, so their link is simply applied;
 * anyone else is asked, because silently replacing a build someone has spent an
 * evening filling in is the one thing this must never do.
 */
export function arrivalOf(read: HashRead, mine: ArcanistInput | null): Arrival {
  if (read.status === 'none') {
    return { input: null, link: { kind: 'none' }, toast: null };
  }

  if (read.status === 'invalid') {
    // Said plainly rather than swallowed: a reader who is shown their own build
    // instead of the sender's, with no word of it, studies the wrong numbers.
    return {
      input: null,
      link: { kind: 'none' },
      toast: "That link couldn't be read — showing your own build",
    };
  }

  if (mine === null) {
    return {
      input: read.input,
      link: { kind: 'kept', previous: null },
      toast: 'Loaded build from link',
    };
  }

  if (sameBuild(read.input, mine)) {
    // The sender's build and yours are the same build. Nothing to decide.
    return { input: read.input, link: { kind: 'none' }, toast: null };
  }

  return { input: read.input, link: { kind: 'viewing', mine }, toast: null };
}
