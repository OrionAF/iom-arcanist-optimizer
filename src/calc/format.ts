/**
 * Number formatting: short-scale names ("1.73 Thousand") for totals, compact
 * suffixes ("1.73K") for dense cells.
 */

import type { EffectDisplay, Resource } from './types';

const SCALE_NAMES = [
  '',
  'Thousand',
  'Million',
  'Billion',
  'Trillion',
  'Quadrillion',
  'Quintillion',
  'Sextillion',
  'Septillion',
  'Octillion',
  'Nonillion',
  'Decillion',
  'Undecillion',
  'Duodecillion',
  'Tredecillion',
  'Quattuordecillion',
  'Quindecillion',
  'Sexdecillion',
  'Septendecillion',
  'Octodecillion',
  'Novemdecillion',
  'Vigintillion',
] as const;

/** Compact suffixes for tight table cells. */
const SHORT_SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'UDc',
  'DDc',
  'TDc',
  'QaDc',
  'QiDc',
  'SxDc',
  'SpDc',
  'ODc',
  'NDc',
  'Vg',
] as const;

function scaleIndex(value: number): number {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs) || abs < 1000) return 0;
  const index = Math.floor(Math.log10(abs) / 3);
  return Math.min(Math.max(index, 0), SCALE_NAMES.length - 1);
}

function scaleAndRound(value: number, index: number): { text: string; scaled: number } {
  const scaled = value / 10 ** (index * 3);
  const rounded = Math.round(scaled * 100) / 100;
  // Whole numbers print without a decimal part.
  const text = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return { text, scaled };
}

/** "1.73 Thousand", "386.29 Septillion". */
export function formatShortScale(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '—';
  if (value === 0) return '0';

  const index = scaleIndex(value);
  const { text } = scaleAndRound(value, index);
  const name = SCALE_NAMES[index] ?? '';
  return name ? `${text} ${name}` : text;
}

/** "1.73K", "386.29Sp" — for dense table cells. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '—';
  if (value === 0) return '0';

  const index = scaleIndex(value);
  const { text } = scaleAndRound(value, index);
  return `${text}${SHORT_SUFFIXES[index] ?? ''}`;
}

/**
 * Suffixes players type that `formatCompact` does not print: the game's own
 * spellings for 1e15, 1e57 and 1e60. Each maps to its power-of-1000 index.
 */
const SUFFIX_ALIASES: Record<string, number> = { q: 5, ocdc: 19, nvdc: 20 };

/**
 * What a comma means, decided rather than assumed.
 *
 * This used to strip every comma as a thousands separator, which is right for
 * "37,500" and silently wrong for "1,5" — a Wizard Loot Multi typed on any
 * keyboard that uses a decimal comma became 11 instead of 1.1, with nothing on
 * screen to show for it.
 *
 * The rules, in order, and each one is a case where the reading is certain:
 * a dot as well means the commas group; digits in clean threes mean grouping;
 * one or two digits after a single comma cannot be grouping, since grouping
 * never leaves fewer than three. What is left — several ungrouped commas, or
 * four or more digits after one — is not a number under either reading, so it
 * keeps the old behaviour and will fail the match below.
 *
 * Whichever way it is read, the field shows the value it settled on as soon as
 * focus leaves, so a wrong guess is visible rather than silent.
 */
function normaliseSeparators(text: string): string {
  const trimmed = text.trim().replace(/[_\s]/g, '');
  if (!trimmed.includes(',')) return trimmed;
  if (trimmed.includes('.')) return trimmed.replace(/,/g, '');
  if (/^[+-]?\d{1,3}(,\d{3})+[a-z]*$/i.test(trimmed)) return trimmed.replace(/,/g, '');
  if (/^[+-]?\d+,\d{1,2}[a-z]*$/i.test(trimmed)) return trimmed.replace(',', '.');
  return trimmed.replace(/,/g, '');
}

/**
 * Read an amount the way the game and `formatCompact` write it: "82.717Sp",
 * "1.2k", "8.27e25", "37,500" or plain digits, and "1,5" the way a decimal
 * comma means it. Suffixes are case-insensitive. Returns NaN for anything
 * else, so a typo is caught rather than read as zero.
 */
export function parseAmount(text: string): number {
  const cleaned = normaliseSeparators(text);
  if (cleaned === '') return NaN;
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z]*)$/i.exec(cleaned);
  if (!match) return NaN;
  const value = Number(match[1]);
  const suffix = match[2]!.toLowerCase();
  if (suffix === '') return value;
  const index = SUFFIX_ALIASES[suffix] ?? SHORT_SUFFIXES.findIndex((s) => s.toLowerCase() === suffix);
  return index > 0 ? value * 10 ** (index * 3) : NaN;
}

/*
 * Prices. The engine already charges whole units, as the game does, so these
 * only pick the style. The resource is kept in the signature so a per-resource
 * rule has somewhere to live.
 */

/** A price, for a dense table cell. */
export function formatCost(_resource: Resource, amount: number): string {
  return formatCompact(amount);
}

/** A price, in the Total Resources panel's long-scale style. */
export function formatCostLong(_resource: Resource, amount: number): string {
  return formatShortScale(amount);
}

/** Plain decimal with a fixed number of significant-ish digits. */
export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '—';
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  const pct = value * 100;
  const text = Number.isInteger(pct) ? pct.toString() : pct.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  return `${text}%`;
}

export function formatEffect(value: number, display: EffectDisplay): string {
  switch (display) {
    case 'percent':
      return value === 0 ? '+0%' : `+${formatPercent(value)}`;
    case 'flat':
      return value === 0 ? '+0' : `+${formatNumber(value)}`;
    // Reductions are stored as positive amounts and printed as what they take off.
    case 'minus':
      return value === 0 ? '−0' : `−${formatNumber(value)}`;
    case 'minusPercent':
      return value === 0 ? '−0%' : `−${formatPercent(value)}`;
    case 'minusSeconds':
      return value === 0 ? '−0s' : `−${formatNumber(value)}s`;
  }
}

/**
 * A game upgrade name as displayed. The data keeps the game's own spelling,
 * hyphens included ("Respawn Time -1s"), so it can be checked against the
 * game; on screen a reduction takes a true minus sign, matching the effects.
 */
export function displayLabel(label: string): string {
  return label.replace(/(^|\s)-(?=\d)/g, '$1−');
}

/**
 * Hours as "42m", "6h 10m", "9d 4h", "3mo 12d", "2y 4mo".
 *
 * Deliberately coarser as the span grows: a plan that runs for two years does
 * not become more useful by being precise to the minute, and the precision
 * would imply a confidence the estimate has not earned.
 */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return 'never';
  if (hours <= 0) return 'now';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;

  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    // Rounding 1.999h up to "1h 60m" is the one case worth catching.
    return m === 60 ? `${h + 1}h` : m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 60) {
    const h = Math.floor(hours - days * 24);
    return h > 0 ? `${days}d ${h}h` : `${days}d`;
  }

  const months = Math.floor(days / 30);
  if (months < 24) {
    const d = days - months * 30;
    return d > 0 ? `${months}mo ${d}d` : `${months}mo`;
  }

  const years = Math.floor(months / 12);
  const mo = months - years * 12;
  return mo > 0 ? `${years}y ${mo}mo` : `${years}y`;
}

/** Seconds as "1m 24s" for durations and cycle times. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${formatNumber(seconds, 1)}s`;
  const mins = Math.floor(seconds / 60);
  const rest = seconds - mins * 60;
  return rest === 0 ? `${mins}m` : `${mins}m ${formatNumber(rest, 1)}s`;
}
