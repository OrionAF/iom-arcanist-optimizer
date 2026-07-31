import { useEffect, useRef, useState, type ReactNode } from 'react';

import { RESOURCE_LABELS } from '../calc/constants';
import { formatCompact } from '../calc/format';
import type { Resource, ResourceBundle } from '../calc/types';

// ------------------------------------------------------------------ shell --

export function Section({
  title,
  eyebrow,
  flush,
  children,
}: {
  title: string;
  eyebrow?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <header>
        <h2>{title}</h2>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      </header>
      <div className={flush ? 'body flush' : 'body'}>{children}</div>
    </section>
  );
}

export function Collapsible({
  title,
  eyebrow,
  defaultOpen = false,
  flush,
  children,
}: {
  title: string;
  eyebrow?: ReactNode;
  defaultOpen?: boolean;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="section" open={defaultOpen}>
      <summary>
        <h2>{title}</h2>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      </summary>
      <div className={flush ? 'body flush' : 'body'}>{children}</div>
    </details>
  );
}

export function Subhead({ children }: { children: ReactNode }) {
  return (
    <div className="subhead">
      <span>{children}</span>
      <span className="rule" />
    </div>
  );
}

// ----------------------------------------------------------------- inputs --

/**
 * Shows zero as a placeholder rather than a literal "0", so a field at its
 * default can be typed into without clearing it first.
 *
 * Needs a local draft: with a plain controlled input, typing "0" would set the
 * value to 0, re-render as empty, and the character the user just typed would
 * vanish. The draft holds exactly what was typed until focus leaves, then the
 * canonical value takes over again. Stepper buttons drop the draft so they
 * never show a stale string.
 */
function useNumericDraft(value: number, onChange: (next: number) => void, parse: (raw: string) => number) {
  const [draft, setDraft] = useState<string | null>(null);

  return {
    display: draft ?? (value === 0 ? '' : String(value)),
    onInput: (raw: string) => {
      setDraft(raw);
      onChange(parse(raw));
    },
    onBlur: () => setDraft(null),
    reset: () => setDraft(null),
  };
}

export function LevelInput({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const clamp = (n: number) => Math.min(Math.max(Math.trunc(n) || 0, 0), max);
  const field = useNumericDraft(value, onChange, (raw) => clamp(Number(raw)));

  const step = (next: number) => {
    field.reset();
    onChange(clamp(next));
  };

  return (
    <span className="level">
      <button
        type="button"
        onClick={() => step(value - 1)}
        disabled={value <= 0}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <input
        type="number"
        value={field.display}
        placeholder="0"
        min={0}
        max={max}
        aria-label={`${label} level`}
        onChange={(e) => field.onInput(e.target.value)}
        onBlur={field.onBlur}
      />
      <button
        type="button"
        onClick={() => step(value + 1)}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
      <span className="of">/{max}</span>
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {hint ? <span className="hint">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  step = 0.01,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  label: string;
}) {
  const field = useNumericDraft(value, onChange, (raw) => {
    const next = Number(raw);
    return Number.isFinite(next) ? next : 0;
  });

  return (
    <input
      className="plain"
      type="number"
      step={step}
      value={field.display}
      placeholder="0"
      aria-label={label}
      onChange={(e) => field.onInput(e.target.value)}
      onBlur={field.onBlur}
    />
  );
}

// -------------------------------------------------------------- resources --

export function ResourceAmount({ resource, amount }: { resource: Resource; amount: number }) {
  return (
    <span className="res" style={{ ['--dot' as string]: `var(--res-${resource})` }}>
      <span className="num">{formatCompact(amount)}</span>
    </span>
  );
}

/** A cost that may span several resources (the tiered rune unlocks). */
export function BundleAmount({ bundle }: { bundle: ResourceBundle }) {
  const entries = Object.entries(bundle).filter(([, amount]) => (amount ?? 0) > 0) as [
    Resource,
    number,
  ][];

  if (entries.length === 0) return <span className="num">0</span>;

  if (entries.length === 1) {
    const [resource, amount] = entries[0]!;
    return <ResourceAmount resource={resource} amount={amount} />;
  }

  return (
    <span className="res multi">
      {entries.map(([resource, amount]) => (
        <ResourceAmount key={resource} resource={resource} amount={amount} />
      ))}
    </span>
  );
}

export function ResourceName({ resource }: { resource: Resource }) {
  return (
    <span className="res" style={{ ['--dot' as string]: `var(--res-${resource})` }}>
      {RESOURCE_LABELS[resource]}
    </span>
  );
}

// ------------------------------------------------------------------ misc ---

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function Meter({
  label,
  current,
  max,
  grand,
}: {
  label: string;
  current: number;
  max: number;
  grand?: boolean;
}) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  return (
    <div className={grand ? 'meter grand' : 'meter'}>
      <div className="row">
        <span>{label}</span>
        <span className="num">
          {current} / {max}
        </span>
      </div>
      <div
        className="track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Briefly highlights its content whenever `value` changes. */
export function useFlashOnChange(value: number): boolean {
  const [flash, setFlash] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 60);
    return () => window.clearTimeout(timer);
  }, [value]);

  return flash;
}
