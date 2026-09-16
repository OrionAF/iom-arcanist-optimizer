import { describe, expect, it } from 'vitest';

import { formatCompact, parseAmount } from './format';

describe('reading an amount a player typed', () => {
  it('reads what the game and the app print', () => {
    expect(parseAmount('37500')).toBe(37500);
    expect(parseAmount('1.2k')).toBe(1200);
    expect(parseAmount('1.73K')).toBe(1730);
    // Relative, not absolute: at 1e25 the last bits of a double are worth
    // billions, so an absolute tolerance would be testing the hardware.
    expect(parseAmount('82.717Sp') / 8.2717e25).toBeCloseTo(1, 12);
    expect(parseAmount('8.27e25') / 8.27e25).toBeCloseTo(1, 12);
    expect(parseAmount(' 450 ')).toBe(450);
  });

  it('reads a comma that groups digits', () => {
    expect(parseAmount('37,500')).toBe(37500);
    expect(parseAmount('1,000,000')).toBe(1_000_000);
    expect(parseAmount('1,234.5')).toBe(1234.5);
    expect(parseAmount('12,500K')).toBe(12_500_000);
  });

  /*
   * The bug this file was written for: a decimal comma is what most of Europe
   * types, and stripping it turned a Wizard Loot Multi of 1,1 into 11.
   */
  it('reads a comma that is a decimal point', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('1,1')).toBeCloseTo(1.1, 10);
    expect(parseAmount('12,75')).toBe(12.75);
    expect(parseAmount('1,5K')).toBe(1500);
  });

  it('shows which reading it took as soon as the field is left', () => {
    // Both are visible on blur, so a wrong guess can be seen and corrected.
    expect(formatCompact(parseAmount('1,5'))).toBe('1.5');
    expect(formatCompact(parseAmount('1,500'))).toBe('1.5K');
  });

  it('still refuses what is not a number', () => {
    expect(parseAmount('')).toBeNaN();
    expect(parseAmount('   ')).toBeNaN();
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmount('12x')).toBeNaN();
    expect(parseAmount('1.2.3')).toBeNaN();
  });
});
