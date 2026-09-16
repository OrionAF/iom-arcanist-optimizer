import { describe, expect, it } from 'vitest';

import { EXAMPLE_INPUT } from '../presets/example';
import { FRESH_INPUT } from '../presets/fresh';
import { arrivalOf, sameBuild } from './link';
import { encodeBuild, readBuildFromHash } from './url';

const linkTo = (input: typeof FRESH_INPUT) => readBuildFromHash(`#b=${encodeBuild(input)}`);

describe('sameBuild', () => {
  it('sees a build as itself, and through a link', () => {
    expect(sameBuild(EXAMPLE_INPUT, structuredClone(EXAMPLE_INPUT))).toBe(true);
    const roundTripped = linkTo(EXAMPLE_INPUT);
    expect(roundTripped.status).toBe('ok');
    if (roundTripped.status === 'ok') expect(sameBuild(roundTripped.input, EXAMPLE_INPUT)).toBe(true);
  });

  it('tells two builds apart by any packed field', () => {
    const moved = structuredClone(EXAMPLE_INPUT);
    moved.mining = moved.mining === 'soft' ? 'dense' : 'soft';
    expect(sameBuild(moved, EXAMPLE_INPUT)).toBe(false);
    expect(sameBuild(FRESH_INPUT, EXAMPLE_INPUT)).toBe(false);
  });
});

describe('a link arriving', () => {
  it('does nothing when there is no link', () => {
    expect(arrivalOf(readBuildFromHash(''), EXAMPLE_INPUT)).toEqual({
      input: null,
      link: { kind: 'none' },
      toast: null,
    });
  });

  it('says so when a link cannot be read, and leaves the build alone', () => {
    const arrival = arrivalOf(readBuildFromHash('#b=garbage'), EXAMPLE_INPUT);
    expect(arrival.input).toBeNull();
    expect(arrival.link).toEqual({ kind: 'none' });
    expect(arrival.toast).toMatch(/couldn't be read/);
  });

  it('applies the link at once when there is no build to lose', () => {
    const arrival = arrivalOf(linkTo(EXAMPLE_INPUT), null);
    expect(arrival.input).toEqual(EXAMPLE_INPUT);
    expect(arrival.link).toEqual({ kind: 'kept', previous: null });
    expect(arrival.toast).toBe('Loaded build from link');
  });

  it('asks first when a link would replace a build that is already saved', () => {
    const arrival = arrivalOf(linkTo(EXAMPLE_INPUT), FRESH_INPUT);
    expect(arrival.input).toEqual(EXAMPLE_INPUT);
    // The point of the whole exercise: the local build is carried, not overwritten.
    expect(arrival.link).toEqual({ kind: 'viewing', mine: FRESH_INPUT });
    expect(arrival.toast).toBeNull();
  });

  it('asks nothing when the link carries the build you already have', () => {
    const arrival = arrivalOf(linkTo(EXAMPLE_INPUT), EXAMPLE_INPUT);
    expect(arrival.link).toEqual({ kind: 'none' });
    expect(arrival.toast).toBeNull();
  });
});
