/**
 * The Wizard Exchange tab: enter the wizards on screen and see which offers
 * are worth taking.
 *
 * Settings and Orbs Traded belong to the build; the satchel is worked out from
 * Orbs Traded and the upgrades already bought. The offers
 * themselves live only in this browser — they are replaced every refresh.
 */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import { WIZARD, WIZARD_ITEMS, type WizardItemTier } from '../../calc/constants';
import { formatCompact, formatHours, formatShortScale, parseAmount } from '../../calc/format';
import { wizardOutlook, type ColourOutlook } from '../../calc/wizard/need';
import { sampleInputsFor, sampleOffers, unusualCosts } from '../../calc/wizard/offers';
import {
  COLOUR_LABELS,
  NEGLIGIBLE_STEP,
  SIGNIFICANT_STEP,
  painContext,
  scoreOffer,
  slot1Label,
  type OfferScore,
} from '../../calc/wizard/score';
import type {
  ArcanistInput,
  ArcanistResult,
  CurrencyCategory,
  OfferCategory,
  WizardInput,
  WizardOffer,
} from '../../calc/types';
import { ORB_CARD_IDS } from '../../calc/types';
import { coerceOffers } from '../../state/schema';
import { loadOffers, loadPanels, saveOffers, savePanel } from '../../state/storage';
import { Fold, Help, Icon, LevelInput, NumberField, Popover, Subhead, Switch, TabBody } from '../components';
import type { HelpId } from '../help';
import { CATEGORY_ICONS, ESSENCE_ICONS, ITEM_ICONS, ORB_CARD_ICONS, RESOURCE_ICONS, WIZARD_ICONS } from '../icons';

interface Props {
  input: ArcanistInput;
  result: ArcanistResult;
  update: (mutate: (draft: ArcanistInput) => void) => void;
}

export const CATEGORY_LABELS: Record<OfferCategory, string> = {
  stars: 'Stars',
  bars: 'Bars',
  veins: 'Veins',
  fragments: 'Fragments',
  fish: 'Fish',
  gems: 'Gems',
  commonItems: 'T1 Items',
  food: 'T2 Items',
  rareItems: 'T3 Items',
  pp: 'PP',
};

const EXTRA_CHOICES: readonly OfferCategory[] = [
  'stars',
  'bars',
  'veins',
  'fragments',
  'fish',
  'gems',
  'pp',
  'commonItems',
  'food',
  'rareItems',
];

const SLOT1_CHOICES: readonly { kind: 'essence' | 'rune'; tier: 0 | 1 | 2; icon: string }[] = [
  { kind: 'essence', tier: 0, icon: ESSENCE_ICONS.soft },
  { kind: 'essence', tier: 1, icon: ESSENCE_ICONS.dense },
  { kind: 'essence', tier: 2, icon: ESSENCE_ICONS.jagged },
  { kind: 'rune', tier: 0, icon: RESOURCE_ICONS.ashRune! },
  { kind: 'rune', tier: 1, icon: RESOURCE_ICONS.brineRune! },
  { kind: 'rune', tier: 2, icon: RESOURCE_ICONS.chasmRune! },
];

const slot1Icon = (kind: 'essence' | 'rune', tier: 0 | 1 | 2) =>
  SLOT1_CHOICES.find((c) => c.kind === kind && c.tier === tier)!.icon;

const amountCounts = (category: OfferCategory) => category === 'gems' || category === 'pp';

const scoreBand = (score: number) => (score >= 50 ? 'good' : score >= 30 ? 'fair' : 'poor');

const newId = () => `offer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ------------------------------------------------------------------ inputs --

/**
 * A number typed the way the game prints it. Keeps what was typed while it is
 * being edited and commits only a value it can read, flagging the rest.
 */
function AmountInput({
  value,
  onChange,
  label,
  placeholder = '0',
  className = 'wx-amount',
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === 0 ? '' : formatCompact(value));
  const invalid = draft !== null && draft.trim() !== '' && Number.isNaN(parseAmount(draft));

  return (
    <input
      className={invalid ? `${className} invalid` : className}
      type="text"
      inputMode="decimal"
      value={shown}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        setDraft(e.target.value);
        const next = e.target.value.trim() === '' ? 0 : parseAmount(e.target.value);
        if (!Number.isNaN(next)) onChange(Math.max(next, 0));
      }}
      onBlur={() => {
        if (!invalid) setDraft(null);
      }}
    />
  );
}

// ---------------------------------------------------------------- colours --

function ColourBox({
  outlook,
  traded,
  onTraded,
}: {
  outlook: ColourOutlook;
  traded: number;
  onTraded: (next: number) => void;
}) {
  const id = outlook.colour;
  const name = COLOUR_LABELS[id];
  const previous = ORB_CARD_IDS[ORB_CARD_IDS.indexOf(id) - 1];

  return (
    <div className={`wx-colour ${outlook.status}`} data-colour={id} role="group" aria-label={`${name} Orbs`}>
      <div className="wx-colour-head">
        <Icon src={ORB_CARD_ICONS[id]} size={20} alt={`${name} Orbs`} />
      </div>
      <label className="wx-colour-field">
        <span>Traded</span>
        <NumberField value={traded} step={1} label={`${name} Orbs traded`} onChange={onTraded} />
      </label>
      {/* Worked out, not typed: traded minus what the bought upgrades cost. */}
      <div className="wx-colour-field">
        <span>Satchel</span>
        <output className="wx-satchel" aria-label={`${name} Orbs in satchel`}>
          {formatCompact(outlook.satchel)}
        </output>
      </div>
      {outlook.overspent > 0 ? (
        <div className="wx-colour-locked">
          your upgrades cost {formatCompact(Math.ceil(outlook.overspent))} more than traded
        </div>
      ) : null}
      <div className="wx-colour-needed">
        <strong>{formatCompact(Math.ceil(outlook.needed))}</strong> needed
      </div>
      {outlook.locked && previous ? (
        <div className="wx-colour-locked">
          locked · trade {formatCompact(outlook.unlockShortfall)} more {COLOUR_LABELS[previous]} Orbs
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------- offers --

function blankOffer(): WizardOffer {
  return {
    id: newId(),
    colour: 'white',
    orbs: 0,
    party: false,
    blind: false,
    slot1: { kind: 'essence', tier: 0, amount: 0 },
    extras: [{ category: 'stars', amount: 0 }],
    traded: false,
  };
}

function OfferEditor({
  initial,
  slot,
  onSave,
  onCancel,
}: {
  initial: WizardOffer;
  slot: number;
  onSave: (offer: WizardOffer) => void;
  onCancel: () => void;
}) {
  // An offer saved before the first cost became mandatory may have none; give it one to fill in.
  const [draft, setDraft] = useState(() =>
    initial.extras.length > 0 ? initial : { ...initial, extras: [{ category: 'stars' as OfferCategory, amount: 0 }] },
  );
  const set = (patch: Partial<WizardOffer>) => setDraft((d) => ({ ...d, ...patch }));
  const setExtra = (index: number, patch: Partial<WizardOffer['extras'][number]>) =>
    setDraft((d) => ({
      ...d,
      extras: d.extras.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));

  return (
    <form
      className="wx-card editing"
      role="dialog"
      aria-label={`Wizard ${slot}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <div className="wx-edit-label">Reward</div>
      <div className="wx-choices" role="group" aria-label="Orb colour">
        {ORB_CARD_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="wx-choice"
            aria-pressed={draft.colour === id}
            aria-label={`${COLOUR_LABELS[id]} Orb`}
            title={`${COLOUR_LABELS[id]} Orb`}
            onClick={() => set({ colour: id })}
          >
            <Icon src={ORB_CARD_ICONS[id]} size={20} />
          </button>
        ))}
      </div>
      <div className="wx-edit-row">
        <label className="wx-inline">
          <span>Orbs</span>
          <NumberField value={draft.orbs} step={1} label="Orbs rewarded" onChange={(orbs) => set({ orbs })} />
        </label>
        <Switch checked={draft.party} onChange={(party) => set({ party })}>
          Party
        </Switch>
        <Switch checked={draft.blind} onChange={(blind) => set({ blind })}>
          Blind
        </Switch>
      </div>

      {/* A blind wizard is free. The costs stay in the draft, so unticking Blind brings them back. */}
      {draft.blind ? null : (
        <>
          <div className="wx-edit-label">Essence or runes</div>
          <div className="wx-choices" role="group" aria-label="Essence or rune asked">
            {SLOT1_CHOICES.map((choice) => {
              const label = slot1Label(choice.kind, choice.tier);
              return (
                <button
                  key={label}
                  type="button"
                  className="wx-choice"
                  aria-pressed={draft.slot1.kind === choice.kind && draft.slot1.tier === choice.tier}
                  aria-label={label}
                  title={label}
                  onClick={() => set({ slot1: { ...draft.slot1, kind: choice.kind, tier: choice.tier } })}
                >
                  <Icon src={choice.icon} size={20} />
                </button>
              );
            })}
          </div>
          <AmountInput
            value={draft.slot1.amount}
            label={`${slot1Label(draft.slot1.kind, draft.slot1.tier)} amount`}
            onChange={(amount) => set({ slot1: { ...draft.slot1, amount } })}
          />

          <div className="wx-edit-label">Other costs</div>
          {draft.extras.map((extra, index) => (
            <div className="wx-edit-row" key={index}>
              <select
                className="wx-select"
                aria-label={`Other cost ${index + 1}`}
                value={extra.category}
                onChange={(e) => setExtra(index, { category: e.target.value as OfferCategory })}
              >
                {EXTRA_CHOICES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              {amountCounts(extra.category) ? (
                <AmountInput
                  value={extra.amount}
                  label={`${CATEGORY_LABELS[extra.category]} amount`}
                  onChange={(amount) => setExtra(index, { amount })}
                />
              ) : null}
              {/* Every wizard asks at least one other cost, so only the optional second can go. */}
              {index > 0 ? (
                <button
                  type="button"
                  className="wx-link"
                  onClick={() => setDraft((d) => ({ ...d, extras: d.extras.filter((_, i) => i !== index) }))}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          {draft.extras.length < 2 ? (
            <button
              type="button"
              className="wx-link"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  extras: [
                    ...d.extras,
                    { category: EXTRA_CHOICES.find((c) => !d.extras.some((e) => e.category === c))!, amount: 0 },
                  ],
                }))
              }
            >
              + Add a cost
            </button>
          ) : null}
        </>
      )}

      <div className="wx-card-actions">
        <button type="submit" className="action primary">
          Save
        </button>
        <button type="button" className="action" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Effort with two significant figures below 1, so a small cost reads 0.0016
 * rather than rounding away to 0.00. Only a true zero shows as 0.
 */
const painText = (x: number) =>
  !Number.isFinite(x) ? '∞' : x === 0 ? '0' : x >= 1 ? x.toFixed(2) : x.toFixed(Math.min(1 - Math.floor(Math.log10(x)), 12));
/** Steps down Currency Preference: sums of 0.01, 1 and 5, so two decimals are exact. */
const stepText = (x: number) => String(Math.round(x * 100) / 100);
const percentText = (x: number) => `${Math.round(x * 100)}%`;

const ITEM_TIER_INTRO: Record<WizardItemTier, string> = {
  commonItems:
    'A wizard asking for T1 Items wants one of these. The amount grows with your Orbs Traded until it reaches the item\'s cap, give or take 5%.',
  food: 'A wizard asking for T2 Items wants one of these. The amount grows with your Orbs Traded until it reaches the item\'s cap, give or take 5%.',
  rareItems: 'A wizard asking for T3 Items wants exactly one of these, however many orbs you have traded.',
};

const isItemTier = (category: CurrencyCategory): category is WizardItemTier => category in WIZARD_ITEMS;

/** The "i" on an item tier's row: which items it covers, and the most each can ask. */
function ItemTierInfo({ tier }: { tier: WizardItemTier }) {
  const label = CATEGORY_LABELS[tier];
  return (
    <Popover label={`Which items are ${label}?`} title={label} glyph="i">
      <p>{ITEM_TIER_INTRO[tier]}</p>
      <ul className="wx-items">
        {/* WIZARD_ITEMS keeps the game's subtype order; players look items up by name. */}
        {[...WIZARD_ITEMS[tier]].sort((a, b) => a.name.localeCompare(b.name)).map((item) => (
          <li key={item.id}>
            <span className="named tight">
              <Icon src={ITEM_ICONS[item.id]!} size={18} />
              {item.name}
            </span>
            <span>{item.cap === null ? 'always 1' : `up to ${formatCompact(item.cap)}`}</span>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

/** The "i" beside a score: every cost's share of the effort, and how effort became the score. */
function ScoreBreakdown({ offer, scored }: { offer: WizardOffer; scored: OfferScore }) {
  const name = COLOUR_LABELS[offer.colour];
  const score = Math.round(scored.score);

  const rows = scored.parts.map((part, i) => {
    if (part.kind === 'time') {
      const asked = slot1Label(offer.slot1.kind, offer.slot1.tier);
      const detail =
        part.hours === 0
          ? 'nothing asked'
          : !Number.isFinite(part.hours)
            ? 'you produce none of it'
            : `${formatHours(part.hours)} of your production (${formatCompact(offer.slot1.amount)} ÷ ${formatCompact(offer.slot1.amount / part.hours)} per hour) ÷ ${formatHours(part.comfortHours)} comfort hours`;
      return { label: `${asked} ${formatCompact(offer.slot1.amount)}`, detail, pain: part.pain };
    }
    const extra = offer.extras[i - 1]!;
    const steps = `${stepText(part.steps)} ÷ ${stepText(part.totalSteps)} steps`;
    if (part.kind === 'row') {
      return {
        label: CATEGORY_LABELS[part.category],
        detail: `row ${part.rank} of ${part.rows} in Currency Preference: ${steps}`,
        pain: part.pain,
      };
    }
    const gemsRow = `the Gems row's ${painText(part.rowPain)} (row ${part.rank} of ${part.rows}: ${steps})`;
    const asGems =
      part.category === 'pp' && part.asGems !== null
        ? `${formatCompact(extra.amount)} PP costs ${formatCompact(part.asGems)} gems; `
        : '';
    const detail = part.noPpRate
      ? `counted as ${gemsRow}: set PP per 100 Large Resource Packs to weigh the amount`
      : part.ratio === null || part.asGems === null
        ? `counted as ${gemsRow}`
        : `${asGems}${formatCompact(part.asGems)} ÷ ${formatCompact(part.typicalGems)} gems wizards offering ${name} Orbs typically ask for = ${part.ratio.toFixed(2)}× ${gemsRow}`;
    return { label: `${CATEGORY_LABELS[part.category]} ${formatCompact(extra.amount)}`, detail, pain: part.pain };
  });
  const usesPreference = scored.parts.some((part) => part.kind !== 'time');

  const biggest = rows.reduce<(typeof rows)[number] | null>((top, row) => (!top || row.pain > top.pain ? row : top), null);
  const drivenBy =
    biggest && rows.length > 1 && scored.pain > 0
      ? Number.isFinite(scored.pain)
        ? `Most of the effort is ${biggest.label}: ${percentText(biggest.pain / scored.pain)} of it.`
        : `${biggest.label} alone makes this offer unpayable.`
      : null;

  return (
    <Popover label={`Why wizard scored ${score}`} title={`Why ${score}`} glyph="i">
      {scored.s <= 0 ? (
        <p>You need no more {name} Orbs, so every {name} Orb offer scores 0 whatever it costs.</p>
      ) : null}
      {offer.blind ? (
        <p>A blind wizard costs nothing, so it takes no effort and almost no {name} Orbs come cheaper.</p>
      ) : (
        <>
          <p>
            <strong>Effort</strong> is how hard each cost is for you. 1.00 is as hard as your comfort hours of
            essence or runes, or your bottom currency. <Help id="effort" />
          </p>
          <table className="wx-why">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    <strong>{row.label}</strong>
                    <span>{row.detail}</span>
                  </td>
                  <td>+{painText(row.pain)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>
                  <strong>Total effort</strong>
                  <span>
                    {painText(scored.pain)} for {formatCompact(offer.orbs)} orbs
                  </span>
                </td>
                <td>{painText(scored.painPerOrb)}/orb</td>
              </tr>
            </tbody>
          </table>
          {usesPreference ? (
            <p>
              A currency's effort is how far down Currency Preference it sits: its steps from the top ÷ all the
              steps. A step is the gap between neighbouring rows: {NEGLIGIBLE_STEP} above the green bar,{' '}
              {SIGNIFICANT_STEP} across the red bar, 1 anywhere else. <Help id="currencyPreference" />
            </p>
          ) : null}
          {drivenBy ? <p>{drivenBy}</p> : null}
        </>
      )}
      <p>
        <strong>Cheaper offers:</strong> {percentText(scored.p)} of the {name} Orbs wizards offer take less effort
        per orb than this one.
      </p>
      <p>
        <strong>Offers you need:</strong>{' '}
        {scored.s <= 0
          ? '0%.'
          : scored.s >= 1
          ? `100%. ${name} Orbs are your bottleneck, so you need every ${name} Orb offer.`
          : `${percentText(scored.s)}. Taking that many of the ${name} Orb offers gets you every ${name} Orb you need by the time your bottleneck orb colour is done.`}{' '}
        <Help id="offersYouNeed" />
      </p>
      <code className="help-formula">
        score = 100 × offers you need ÷ (offers you need + cheaper offers) = 100 × {scored.s.toFixed(2)} ÷ (
        {scored.s.toFixed(2)} + {scored.p.toFixed(2)}) = {score}
      </code>
    </Popover>
  );
}

function OfferCard({
  offer,
  slot,
  scored,
  traded,
  onAccept,
  onUndo,
  onEdit,
  onRemove,
  cellRef,
  origin,
  inert,
}: {
  offer: WizardOffer;
  slot: number;
  scored: OfferScore;
  traded: WizardInput['traded'];
  onAccept: () => void;
  onUndo: () => void;
  onEdit: () => void;
  onRemove: () => void;
  cellRef: (el: HTMLElement | null) => void;
  /** Whether the floating editor grew out of this card. */
  origin: boolean;
  /** Set while the editor is open: the cards behind it are out of reach. */
  inert?: boolean;
}) {
  const name = COLOUR_LABELS[offer.colour];
  const band = scoreBand(scored.score);
  const hours = Number.isFinite(scored.hours) ? formatHours(scored.hours) : 'no income';

  return (
    <article
      ref={cellRef}
      className={['wx-card', offer.traded ? 'traded' : '', origin ? 'origin' : ''].filter(Boolean).join(' ')}
      aria-label={`Wizard ${slot}: ${name} Orbs`}
      // Not a tab stop; somewhere for focus to land when the editor it opened
      // closes again.
      tabIndex={-1}
      inert={inert}
    >
      <div className="wx-card-top">
        <span className="named">
          <Icon src={ORB_CARD_ICONS[offer.colour]} size={20} />
          <strong>×{formatCompact(offer.orbs)}</strong>
          {offer.party ? <span className="wx-tag">party</span> : null}
          {offer.blind ? <span className="wx-tag">blind</span> : null}
        </span>
        <span className="named tight">
          <span className={`wx-score ${band}`} aria-label={`Score ${Math.round(scored.score)} of 100`}>
            {Math.round(scored.score)}
          </span>
          <ScoreBreakdown offer={offer} scored={scored} />
        </span>
      </div>
      <div className="wx-chips">
        {offer.blind ? (
          <span className="wx-chip">free</span>
        ) : (
          <span className="wx-chip">
            <Icon src={slot1Icon(offer.slot1.kind, offer.slot1.tier)} size={14} />
            {formatCompact(offer.slot1.amount)} · {hours}
          </span>
        )}
        {offer.extras.map((extra, i) => (
          <span className="wx-chip" key={i}>
            <Icon src={CATEGORY_ICONS[extra.category]} size={14} />
            {CATEGORY_LABELS[extra.category]}
            {amountCounts(extra.category) && extra.amount > 0 && !offer.blind
              ? ` ${formatCompact(extra.amount)}`
              : ''}
          </span>
        ))}
      </div>
      <p className="wx-reason">{scored.reason}</p>
      {offer.traded
        ? null
        : unusualCosts(offer, traded).map(({ slot, amount, range }) => {
            const what = slot === 'slot1' ? slot1Label(offer.slot1.kind, offer.slot1.tier) : CATEGORY_LABELS[offer.extras[slot]!.category];
            return (
              <p className="wx-warning" key={String(slot)}>
                ⚠ {formatCompact(amount)} {what} is unusual: wizards offering {name} Orbs at your Orbs Traded ask{' '}
                {formatCompact(range.min)}–{formatCompact(range.max)}. A typo?
              </p>
            );
          })}
      <div className="wx-card-actions">
        {offer.traded ? (
          <>
            <span className="wx-traded">✓ Traded</span>
            <button type="button" className="action" onClick={onUndo}>
              Undo
            </button>
          </>
        ) : (
          <>
            <button type="button" className="action primary" onClick={onAccept}>
              Accept
            </button>
            <button type="button" className="action" onClick={onEdit}>
              Edit
            </button>
            <RemoveButton onRemove={onRemove} />
          </>
        )}
      </div>
    </article>
  );
}

/** Lucide's `trash-2` (ISC licence), inlined rather than pulling in the package for one glyph. */
function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

/**
 * Remove, asked twice. The first click arms it: the icon grows leftward into
 * "Click again to confirm", drawn over the row so nothing around it moves. It
 * disarms on its own after a few seconds or when focus leaves, so a stray
 * click never lingers as a trap.
 */
function RemoveButton({ onRemove }: { onRemove: () => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <span className="wx-trash-slot">
      <button
        type="button"
        className={armed ? 'wx-trash armed' : 'wx-trash'}
        aria-label={armed ? 'Click again to confirm removing this wizard' : 'Remove wizard'}
        title={armed ? undefined : 'Remove'}
        onClick={() => (armed ? onRemove() : setArmed(true))}
        onBlur={() => setArmed(false)}
      >
        <span className="wx-trash-text" aria-hidden="true">
          Click again to confirm
        </span>
        <TrashIcon />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------- editor --

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The offer editor, floated over the card grid instead of taking a place in it.
 *
 * Growing a card in place reflowed every card after it. Here the grid never
 * moves: the editor grows out of the cell that was clicked to the middle of
 * the grid, and shrinks back into that cell before the change lands. A FLIP
 * transform, so only the finished size is ever laid out.
 */
function FloatingEditor({
  grid,
  origin,
  children,
}: {
  grid: HTMLElement;
  origin: () => HTMLElement | undefined;
  /** `close(then)` plays the shrink and calls `then` once the editor is back in its cell. */
  children: (close: (then: () => void) => void) => ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  // The transform that makes the panel sit exactly over the origin cell.
  const cellTransform = () => {
    const p = panel.current?.getBoundingClientRect();
    const o = origin()?.getBoundingClientRect();
    if (!p || !o || p.width === 0 || p.height === 0) return null;
    return `translate(${o.left - p.left}px, ${o.top - p.top}px) scale(${o.width / p.width}, ${o.height / p.height})`;
  };

  useLayoutEffect(() => {
    const el = panel.current!;
    // Room for the editor when the grid is shorter than it.
    const fit = () => {
      grid.style.minHeight = `${el.offsetHeight}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);

    const from = cellTransform();
    if (from && !prefersReducedMotion()) {
      el.animate([{ transform: from }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
      el.firstElementChild?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: 280 });
      scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    }
    el.querySelector<HTMLElement>('button, input, select')?.focus({ preventScroll: true });
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    return () => {
      observer.disconnect();
      grid.style.minHeight = '';
    };
    // Once, on open: the origin and grid are fixed for the editor's lifetime.
  }, []);

  const close = (then: () => void) => {
    if (closing.current) return;
    closing.current = true;
    // Back to the card the editor grew out of. Without this the focused element
    // is unmounted mid-animation and focus falls to the body, which puts a
    // keyboard reader back at the top of the page.
    const origin_ = origin();
    const restoreFocus = () => origin_?.focus?.({ preventScroll: true });
    const el = panel.current;
    const to = cellTransform();
    if (!el || !to || prefersReducedMotion()) {
      then();
      restoreFocus();
      return;
    }
    el.firstElementChild?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
    scrim.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
    el.animate([{ transform: 'none' }, { transform: to }], {
      duration: 240,
      easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
      fill: 'forwards',
    }).onfinish = () => {
      then();
      restoreFocus();
    };
  };

  return (
    <div className="wx-float">
      <div ref={scrim} className="wx-float-scrim" />
      <div ref={panel} className="wx-float-panel">
        {children(close)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- preference --

type PreferenceBar = 'negligible' | 'gap';
type PreferenceItem = CurrencyCategory | PreferenceBar;

interface PreferenceLayout {
  preference: CurrencyCategory[];
  negligibleBar: number;
  gapBar: number;
}

const BAR_LABELS: Record<PreferenceBar, { name: string; text: string }> = {
  negligible: {
    name: 'green bar',
    text: 'Negligible difference above: these score nearly alike, still in order',
  },
  gap: {
    name: 'red bar',
    text: 'Significant gap: the rows above and below score far apart',
  },
};

const isBar = (item: PreferenceItem): item is PreferenceBar => item === 'negligible' || item === 'gap';

/** Categories and bars as one list. Two bars in the same gap always show green first. */
function preferenceItems({ preference, negligibleBar, gapBar }: PreferenceLayout): PreferenceItem[] {
  const items: PreferenceItem[] = [];
  for (let slot = 0; slot <= preference.length; slot++) {
    if (slot === negligibleBar) items.push('negligible');
    if (slot === gapBar) items.push('gap');
    if (slot < preference.length) items.push(preference[slot]!);
  }
  return items;
}

function preferenceLayout(items: readonly PreferenceItem[]): PreferenceLayout {
  const above = (bar: PreferenceBar) => items.slice(0, items.indexOf(bar)).filter((item) => !isBar(item)).length;
  return {
    preference: items.filter((item): item is CurrencyCategory => !isBar(item)),
    negligibleBar: above('negligible'),
    gapBar: above('gap'),
  };
}

/**
 * Where a move button sends an item, or null past the end. A bar steps over
 * the other bar, since swapping two bars in one gap would change nothing.
 */
function stepTarget(items: readonly PreferenceItem[], index: number, direction: -1 | 1): number | null {
  let to = index + direction;
  if (isBar(items[index]!) && items[to] !== undefined && isBar(items[to]!)) to += direction;
  return to >= 0 && to < items.length ? to : null;
}

/**
 * Currency Preference. Dragged with pointer events rather than native
 * drag-and-drop, which does nothing on a touch screen; every row also has
 * move buttons, since dragging alone is out of reach of a keyboard.
 *
 * The green and red bars move among the categories like rows of their own.
 */
function PreferenceList({
  layout,
  onChange,
  onCollapse,
}: {
  layout: PreferenceLayout;
  onChange: (next: PreferenceLayout) => void;
  onCollapse: () => void;
}) {
  const [dragging, setDragging] = useState<{ item: PreferenceItem; order: PreferenceItem[] } | null>(null);
  const rows = useRef(new Map<PreferenceItem, HTMLLIElement>());
  const items = preferenceItems(layout);
  const shown = dragging?.order ?? items;

  const move = (from: number, to: number | null) => {
    if (to === null) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(preferenceLayout(next));
  };

  const onPointerDown = (item: PreferenceItem) => (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    setDragging({ item, order: [...items] });
  };

  /*
   * Followed on the window, not with pointer capture on the grip: reordering
   * moves the row, and moving a captured element in the DOM releases the
   * capture — the drop then never arrives and the new order is never saved.
   */
  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const current = dragging.order;
      const target = current.findIndex((item) => {
        const rect = rows.current.get(item)?.getBoundingClientRect();
        return rect !== undefined && e.clientY < rect.top + rect.height / 2;
      });
      const to = target === -1 ? current.length : target;
      const from = current.indexOf(dragging.item);
      const adjusted = to > from ? to - 1 : to;
      if (adjusted === from) return;
      const next = [...current];
      next.splice(from, 1);
      next.splice(adjusted, 0, dragging.item);
      setDragging({ ...dragging, order: next });
    };
    const onUp = () => {
      onChange(preferenceLayout(dragging.order));
      setDragging(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, onChange]);

  return (
    <div className="wx-pref">
      <div className="wx-pref-head">
        <Subhead>
          Currency Preference <Help id="currencyPreference" />
        </Subhead>
        <button type="button" className="wx-pref-toggle" aria-label="Hide Currency Preference" onClick={onCollapse}>
          Hide <span aria-hidden="true">⟩</span>
        </button>
      </div>
      <div className="wx-pref-end easy">▲ Very easy to obtain</div>
      <ol className="wx-pref-list">
        {shown.map((item, index) => {
          const name = isBar(item) ? BAR_LABELS[item].name : CATEGORY_LABELS[item];
          const up = stepTarget(shown, index, -1);
          const down = stepTarget(shown, index, 1);
          return (
            <li
              key={item}
              ref={(el) => {
                if (el) rows.current.set(item, el);
                else rows.current.delete(item);
              }}
              className={[isBar(item) ? `wx-bar ${item}` : '', dragging?.item === item ? 'dragging' : '']
                .filter(Boolean)
                .join(' ') || undefined}
            >
              <span className="wx-grip" aria-hidden="true" onPointerDown={onPointerDown(item)}>
                ⠿
              </span>
              {isBar(item) ? (
                <span className="wx-pref-name">{BAR_LABELS[item].text}</span>
              ) : (
                <span className="wx-pref-name named tight">
                  <Icon src={CATEGORY_ICONS[item]} size={16} />
                  {name}
                  {isItemTier(item) ? <ItemTierInfo tier={item} /> : null}
                </span>
              )}
              <button
                type="button"
                className="wx-move"
                aria-label={`Move ${name} up`}
                disabled={up === null}
                onClick={() => move(index, up)}
              >
                ↑
              </button>
              <button
                type="button"
                className="wx-move"
                aria-label={`Move ${name} down`}
                disabled={down === null}
                onClick={() => move(index, down)}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
      <div className="wx-pref-end hard">▼ Very difficult to obtain</div>
    </div>
  );
}

// -------------------------------------------------------------------- tab --

export function WizardExchange({ input, result, update }: Props) {
  const { wizard } = input;
  const [offers, setOffers] = useState<WizardOffer[]>(() => coerceOffers(loadOffers()));
  /** What "Clear offers" threw away, until something is entered in their place. */
  const [cleared, setCleared] = useState<WizardOffer[]>([]);
  /** The slot the floating editor grew out of, and whether it adds a wizard or edits one. */
  const [editing, setEditing] = useState<{ index: number; offer: WizardOffer; isNew: boolean } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const cells = useRef(new Map<number, HTMLElement>());
  const cellRef = (index: number) => (el: HTMLElement | null) => {
    if (el) cells.current.set(index, el);
    else cells.current.delete(index);
  };

  useEffect(() => {
    saveOffers(offers);
  }, [offers]);

  const samples = useMemo(() => sampleOffers(sampleInputsFor(input)), [input]);
  const outlook = useMemo(() => wizardOutlook(input, result, samples), [input, result, samples]);
  const ctx = useMemo(() => painContext(input, result, samples), [input, result, samples]);
  const scores = useMemo(
    () => new Map(offers.map((offer) => [offer.id, scoreOffer(offer, outlook, ctx, samples)])),
    [offers, outlook, ctx, samples],
  );

  const setWizard = <K extends keyof typeof wizard>(key: K, value: (typeof wizard)[K]) =>
    update((draft) => {
      draft.wizard[key] = value;
    });

  const credit = (offer: WizardOffer, sign: 1 | -1) =>
    update((draft) => {
      const c = offer.colour;
      draft.wizard.traded[c] = Math.max(draft.wizard.traded[c] + sign * offer.orbs, 0);
    });

  const patchOffer = (id: string, patch: Partial<WizardOffer>) =>
    setOffers((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const slots = Math.max(wizard.wizardCount, offers.length);

  // Folded to a rail beside the offers, so the cards can take its width.
  const [prefOpen, setPrefOpen] = useState(() => loadPanels()[PREF_PANEL] ?? true);
  const foldPreference = (open: boolean) => {
    setPrefOpen(open);
    savePanel(PREF_PANEL, open);
  };

  const bottleneck = outlook.bottleneck ? outlook.colours[outlook.bottleneck] : null;
  const lead = bottleneck ? (
    <span className="wx-bottleneck">
      {COLOUR_LABELS[bottleneck.colour]} Orb is the bottleneck
      {Number.isFinite(bottleneck.refreshes)
        ? ` · ${formatHours((bottleneck.refreshes * outlook.refreshSeconds) / 3600)} to finish`
        : ''}
    </span>
  ) : null;

  return (
    <TabBody eyebrow="orb trades" help="wizardScore" flush>
      <WizardSettings wizard={wizard} setWizard={setWizard} />
      {lead ? <p className="wx-lead">{lead}</p> : null}

      <div className="wx-colours">
        {ORB_CARD_IDS.map((id) => (
          <ColourBox
            key={id}
            outlook={outlook.colours[id]}
            traded={wizard.traded[id]}
            onTraded={(next) =>
              update((draft) => {
                draft.wizard.traded[id] = Math.max(next, 0);
              })
            }
          />
        ))}
      </div>
      <p className="note wx-share-note">
        Satchel: orbs traded minus what your bought upgrades cost. Needed: the orbs every unbought upgrade still
        costs, minus the satchel. <Help id="offersYouNeed" />
      </p>

      <div className={prefOpen ? 'wx-main' : 'wx-main pref-folded'}>
        <section className="wx-offers" aria-label="This refresh">
          <div className="wx-offers-head">
            <Subhead>This refresh · {wizard.wizardCount} wizards</Subhead>
            <button
              type="button"
              className="action"
              disabled={offers.length === 0}
              onClick={() => {
                // Typing seven wizards back in because of one stray click is a
                // punishment out of all proportion to the mistake.
                setCleared(offers);
                setOffers([]);
                setEditing(null);
              }}
            >
              Clear offers
            </button>
            {cleared.length > 0 && offers.length === 0 ? (
              <button
                type="button"
                className="wx-link"
                onClick={() => {
                  setOffers(cleared);
                  setCleared([]);
                }}
              >
                Undo
              </button>
            ) : null}
          </div>
          <div className="wx-cards" ref={grid}>
            {Array.from({ length: slots }, (_, i) => {
              const offer = offers[i];
              const slot = i + 1;
              const isOrigin = editing?.index === i;
              if (!offer) {
                // Only the next free slot takes a new wizard, so cards stay in the game's order.
                const next = i === offers.length;
                return (
                  <button
                    key={`empty-${i}`}
                    ref={cellRef(i)}
                    type="button"
                    className={isOrigin ? 'wx-card empty origin' : 'wx-card empty'}
                    disabled={!next || editing !== null}
                    onClick={() => setEditing({ index: i, offer: blankOffer(), isNew: true })}
                  >
                    + Wizard {slot}
                  </button>
                );
              }
              return (
                <OfferCard
                  key={offer.id}
                  cellRef={cellRef(i)}
                  origin={isOrigin}
                  inert={editing !== null}
                  offer={offer}
                  slot={slot}
                  scored={scores.get(offer.id)!}
                  traded={wizard.traded}
                  onAccept={() => {
                    credit(offer, 1);
                    patchOffer(offer.id, { traded: true });
                  }}
                  onUndo={() => {
                    credit(offer, -1);
                    patchOffer(offer.id, { traded: false });
                  }}
                  onEdit={() => setEditing({ index: i, offer, isNew: false })}
                  onRemove={() => setOffers((list) => list.filter((o) => o.id !== offer.id))}
                />
              );
            })}

            {editing && grid.current ? (
              <FloatingEditor
                key={`${editing.index}:${editing.offer.id}`}
                grid={grid.current}
                origin={() => cells.current.get(editing.index)}
              >
                {(close) => (
                  <OfferEditor
                    initial={editing.offer}
                    slot={editing.index + 1}
                    onSave={(saved) =>
                      close(() => {
                        if (editing.isNew) setOffers((list) => [...list, saved]);
                        else patchOffer(saved.id, saved);
                        setEditing(null);
                      })
                    }
                    onCancel={() => close(() => setEditing(null))}
                  />
                )}
              </FloatingEditor>
            ) : null}
          </div>
        </section>

        <aside className="wx-pref-slot" aria-label="Currency Preference">
          {/* Both stay mounted so the swap can cross-fade while the column resizes. */}
          <div className="wx-pref-full">
            <PreferenceList
              layout={wizard}
              onChange={(next) =>
                update((draft) => {
                  Object.assign(draft.wizard, next);
                })
              }
              onCollapse={() => foldPreference(false)}
            />
          </div>
          <button
            type="button"
            className="wx-pref-rail"
            aria-label="Expand Currency Preference"
            aria-expanded={prefOpen}
            inert={prefOpen}
            onClick={() => foldPreference(true)}
          >
            <span aria-hidden="true">⟨</span>
            <span className="wx-pref-rail-text">Currency Preference</span>
          </button>
        </aside>
      </div>
    </TabBody>
  );
}

const PREF_PANEL = 'wx:preference';

type SetWizard = <K extends keyof WizardInput>(key: K, value: WizardInput[K]) => void;

/** One setting: its name on the left, never wrapping; the input and its unit on the right. */
function Setting({ label, icon, help, children }: { label: string; icon?: string; help?: HelpId; children: ReactNode }) {
  return (
    <div className="wx-setting">
      <span className="wx-setting-name named tight">
        {icon ? <Icon src={icon} size={18} /> : null}
        <span>{label}</span>
        {help ? <Help id={help} /> : null}
      </span>
      {children}
    </div>
  );
}

/** An amount box with its unit inside the same frame, so the two read as one value. */
function UnitAmount({
  value,
  unit,
  label,
  placeholder,
  wide,
  onChange,
}: {
  value: number;
  unit?: string;
  label: string;
  placeholder?: string;
  wide?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <span className={wide ? 'wx-unit wide' : 'wx-unit'}>
      <AmountInput value={value} label={label} placeholder={placeholder} className="wx-unit-input" onChange={onChange} />
      {unit ? <span className="wx-unit-suffix">{unit}</span> : null}
    </span>
  );
}

/**
 * Wizard Settings: the Arcanist stats the scores are built from. Folded by
 * default, since they are entered once and then rarely touched.
 */
function WizardSettings({ wizard, setWizard }: { wizard: WizardInput; setWizard: SetWizard }) {
  return (
    <Fold
      id="wx:settings"
      className="wx-settings"
      defaultOpen={false}
      summary={(open) => (
        <span className="wx-settings-title">
          Wizard Settings
          {open ? <span className="wx-settings-where"> · Found under &lsquo;Arcanist&rsquo; in the Stats menu.</span> : null}
        </span>
      )}
    >
      <div className="wx-settings-grid">
        <Setting label="Wizard Loot Multi" icon={WIZARD_ICONS.lootMulti}>
          <UnitAmount value={wizard.lootMulti} unit="×" label="Wizard Loot Multi" onChange={(v) => setWizard('lootMulti', v)} />
        </Setting>
        <Setting label="Party Wizard Chance" icon={WIZARD_ICONS.partyChance}>
          <UnitAmount value={wizard.partyChance} unit="%" label="Party Wizard Chance" onChange={(v) => setWizard('partyChance', v)} />
        </Setting>
        <Setting label="Party Wizard Multi" icon={WIZARD_ICONS.partyMulti}>
          <UnitAmount value={wizard.partyMulti} unit="×" label="Party Wizard Multi" onChange={(v) => setWizard('partyMulti', v)} />
        </Setting>
        <Setting label="Blind Wizard Chance" icon={WIZARD_ICONS.blindChance}>
          <UnitAmount value={wizard.blindChance} unit="%" label="Blind Wizard Chance" onChange={(v) => setWizard('blindChance', v)} />
        </Setting>
        <Setting label="Disco Wizard Chance" icon={WIZARD_ICONS.discoChance}>
          <UnitAmount value={wizard.discoChance} unit="%" label="Disco Wizard Chance" onChange={(v) => setWizard('discoChance', v)} />
        </Setting>
        <Setting label="Flashbang Wizard Chance" icon={WIZARD_ICONS.flashbangChance}>
          <UnitAmount
            value={wizard.flashbangChance}
            unit="%"
            label="Flashbang Wizard Chance"
            onChange={(v) => setWizard('flashbangChance', v)}
          />
        </Setting>
        <Setting label="Number of Wizards" icon={WIZARD_ICONS.wizardCount}>
          <span className="wx-unit">
            <select
              className="wx-unit-input"
              aria-label="Number of Wizards"
              value={wizard.wizardCount}
              onChange={(e) => setWizard('wizardCount', Number(e.target.value))}
            >
              {Array.from({ length: WIZARD.maxWizards - WIZARD.minWizards + 1 }, (_, i) => WIZARD.minWizards + i).map(
                (n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ),
              )}
            </select>
          </span>
        </Setting>
        <Setting label="Exchange Timer −2 Minutes" icon={WIZARD_ICONS.exchangeTimer}>
          <LevelInput
            value={wizard.exchangeTimerLevel}
            max={WIZARD.maxTimerLevel}
            label="Exchange Timer −2 Minutes"
            onChange={(v) => setWizard('exchangeTimerLevel', v)}
          />
        </Setting>
        <Setting label="Poly Orb Card Multi +2.5%" icon={WIZARD_ICONS.polyOrb}>
          <LevelInput
            value={wizard.polyOrbLevel}
            max={WIZARD.maxPolyOrbLevel}
            label="Poly Orb Card Multi +2.5%"
            onChange={(v) => setWizard('polyOrbLevel', v)}
          />
        </Setting>
        <Setting label="Comfort hours" help="comfortHours">
          <UnitAmount value={wizard.comfortHours} unit="h" label="Comfort hours" onChange={(v) => setWizard('comfortHours', v)} />
        </Setting>
        <div className="wx-setting-span">
          <Setting label="Prestige Points per 100 Large Resource Packs" icon={CATEGORY_ICONS.pp} help="ppPacks">
            <UnitAmount
              value={wizard.ppPer100Packs}
              unit="PP"
              wide
              label="Prestige Points per 100 Large Resource Packs"
              placeholder="e.g. 82.717Sp"
              onChange={(v) => setWizard('ppPer100Packs', v)}
            />
          </Setting>
          {wizard.ppPer100Packs > 0 ? (
            <span className="wx-setting-read">= {formatShortScale(wizard.ppPer100Packs)} Prestige Points</span>
          ) : null}
        </div>
      </div>
    </Fold>
  );
}
