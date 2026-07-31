/**
 * Number formatting, matching the workbook's short-scale display.
 *
 * The sheet implements this as a 40-line INDEX/MATCH/TEXT expression repeated
 * in every D-column cell; this is the same behaviour, minus Excel's artefact of
 * leaving a trailing "." when the "0.##" branch rounds to a whole number.
 */

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
  // Whole numbers print without a decimal part, matching the sheet's "0" branch.
  const text = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return { text, scaled };
}

/** "1.73 Thousand", "386.29 Septillion" — the sheet's D-column style. */
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

export function formatEffect(value: number, display: 'flat' | 'percent'): string {
  if (value === 0) return display === 'percent' ? '+0%' : '+0';
  return display === 'percent' ? `+${formatPercent(value)}` : `+${formatNumber(value)}`;
}

/** Seconds as "1m 24s" for durations and cycle times. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${formatNumber(seconds, 1)}s`;
  const mins = Math.floor(seconds / 60);
  const rest = seconds - mins * 60;
  return rest === 0 ? `${mins}m` : `${mins}m ${formatNumber(rest, 1)}s`;
}
