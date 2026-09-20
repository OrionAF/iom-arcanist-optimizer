import { useMemo, useState, type ReactNode } from 'react';

import { ALTARS, ALTAR_IDS, ESSENCE_LABELS, RESOURCE_LABELS } from '../../calc/constants';
import { formatCompact, formatHours, formatNumber, formatPercent } from '../../calc/format';
import { planFor, type Blocker, type EssencePlan, type PlanTarget, type RunePlan } from '../../calc/plan';
import type { AltarId, ArcanistInput, ArcanistResult, EssenceType } from '../../calc/types';
import { ESSENCE_TYPES } from '../../calc/types';
import { AmountInput, Help, Icon, Section, Switch } from '../components';
import { ESSENCE_ICONS, RESOURCE_ICONS } from '../icons';

/**
 * How long a goal takes, and what it costs to get there.
 *
 * Every other panel reports a rate. This one turns a rate into a time, which is
 * the form the question is actually asked in: not "what is my Ash Rune output"
 * but "I need forty thousand of them, am I doing that tonight or this week".
 *
 * A rune goal answers twice over, because two things have to happen and they
 * happen at different speeds — the altar crafts and the mine feeds it. Which of
 * the two finishes first decides whether the player has to sit there for the
 * whole run, and where they do not, the panel names the moment they can leave:
 * a pile of essence and a pile of runes, rather than a stopwatch reading, since
 * that is what is actually on screen in the game.
 *
 * What is already held is typed in rather than read off the build, because the
 * app models upgrades and not a satchel. A rune goal asks for it in two parts —
 * the runes, and the essence waiting in the pool — because the two come off
 * different halves of the sum.
 *
 * The goal is not part of the build, so it is not saved and a share link does
 * not carry it. It is a question being asked, not a thing being planned.
 */

/**
 * Runes are counted, so they pluralise; essence is a mass noun and does not.
 * The game's own labels are singular, and they are right to be in a cost
 * column, so the "s" is added at the point of use rather than in the labels.
 */
const runesNamed = (label: string, count: number) => (count === 1 ? label : `${label}s`);

/** What the one picker puts in its option values, and reading it back. */
type Choice = `e:${EssenceType}` | `r:${AltarId}`;

/** A goal's icon, as a `url()` for the option to draw it with. */
function art(choice: Choice): string {
  const target = targetOf(choice);
  const src =
    target.kind === 'rune'
      ? RESOURCE_ICONS[ALTARS[target.altar].rune]
      : ESSENCE_ICONS[target.essence];
  return src ? `url("${src}")` : 'none';
}

function targetOf(choice: Choice): PlanTarget {
  const [kind, id] = choice.split(':') as [string, string];
  return kind === 'r'
    ? { kind: 'rune', altar: id as AltarId }
    : { kind: 'essence', essence: id as EssenceType };
}

export function Plan({ input, result }: { input: ArcanistInput; result: ArcanistResult }) {
  // The essence being mined is the goal a player is most often pricing.
  const [choice, setChoice] = useState<Choice>(() => `e:${input.mining}`);
  const [quantity, setQuantity] = useState(0);
  const [owned, setOwned] = useState(0);
  const [essenceOwned, setEssenceOwned] = useState(0);
  const [includeDrain, setIncludeDrain] = useState(true);

  const unlocked = ALTAR_IDS.filter((id) => result.altars[id].unlocked);
  const target = targetOf(choice);
  const plan = useMemo(
    () => planFor(result, { target, quantity, owned, essenceOwned, includeDrain }),
    // `target` is rebuilt every render from `choice`, which is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, choice, quantity, owned, essenceOwned, includeDrain],
  );

  /*
   * Changing the goal clears what is held, but keeps the amount.
   *
   * The owned figures are readings off a screen that belongs to one goal only —
   * carrying "30,000" from Ash Runes across to Soft Essence would be a claim
   * the player never made, and a wrong one. The amount is merely a guess at
   * what they want next, so it costs nothing to leave it where it is.
   */
  const pick = (next: Choice) => {
    setChoice(next);
    setOwned(0);
    setEssenceOwned(0);
  };

  const pool = target.kind === 'rune' ? ALTARS[target.altar].consumes : target.essence;
  const runeIcon = target.kind === 'rune' ? RESOURCE_ICONS[ALTARS[target.altar].rune] : undefined;

  return (
    <Section title="Gathering Plan" help="gatheringPlan" eyebrow="how long a pile takes">
      <div className="plan-ask">
        <label className="plan-field wide">
          <span>Goal</span>
          {/*
            A real `<select>`, with the game's own art in front of every name.

            The art is a background on each option rather than an `<img>` inside
            it, which is what makes this cost nothing. An option's content model
            is text, so a nested image is invalid HTML that React objects to and
            most browsers drop on the floor — whereas a `::before` is simply not
            drawn by a browser that has not handed the list over to CSS, and the
            option still reads as its label. Only `appearance: base-select`
            draws them, and the native control is kept either way, phone picker
            and all.
          */}
          <select
            className="plan-select"
            style={{ ['--art' as string]: art(choice) }}
            value={choice}
            onChange={(e) => pick(e.target.value as Choice)}
          >
            <optgroup label="Essence">
              {ESSENCE_TYPES.map((type) => (
                <option
                  key={type}
                  value={`e:${type}`}
                  style={{ ['--art' as string]: art(`e:${type}`) }}
                >
                  {ESSENCE_LABELS[type]}
                </option>
              ))}
            </optgroup>
            {unlocked.length > 0 ? (
              <optgroup label="Runes">
                {unlocked.map((id) => (
                  <option
                    key={id}
                    value={`r:${id}`}
                    style={{ ['--art' as string]: art(`r:${id}`) }}
                  >
                    {RESOURCE_LABELS[ALTARS[id].rune]}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>

        <label className="plan-field">
          <span>Amount</span>
          <AmountInput value={quantity} onChange={setQuantity} label="How many you want" />
        </label>

        <label className="plan-field">
          <span>
            {target.kind === 'rune' && runeIcon ? <Icon src={runeIcon} size={15} /> : null}
            {target.kind === 'rune' ? 'Runes owned' : 'Essence owned'}
          </span>
          {/* Keyed on the goal: resetting the value is not enough on its own,
              since the field keeps whatever was typed until it loses focus, and
              a stale draft would outlive the reading it was a reading of. */}
          <AmountInput
            key={choice}
            value={owned}
            onChange={setOwned}
            label={target.kind === 'rune' ? 'Runes you already have' : 'Essence you already have'}
          />
        </label>

        {/* A rune goal has a second pile to count: the essence sitting in the
            pool, which the altar spends before any of it has to be mined. */}
        {target.kind === 'rune' ? (
          <label className="plan-field">
            <span>
              <Icon src={ESSENCE_ICONS[pool]} size={15} />
              Essence owned
            </span>
            <AmountInput
              key={choice}
              value={essenceOwned}
              onChange={setEssenceOwned}
              label={`${ESSENCE_LABELS[pool]} you already have`}
            />
          </label>
        ) : null}
      </div>

      <div className="plan-options">
        <Switch checked={includeDrain} onChange={setIncludeDrain}>
          Include altar drain
        </Switch>
        <Help id="planDrain" />
      </div>

      {plan.kind === 'idle' ? (
        <p className="plan-empty">Type an amount and this will say how long it takes.</p>
      ) : plan.kind === 'done' ? (
        <p className="plan-done">
          You already have {formatCompact(plan.have)} of the {formatCompact(plan.want)} you asked
          for. Nothing left to gather.
        </p>
      ) : plan.kind === 'blocked' ? (
        <p className="plan-blocked">{blockedText(plan.blocker, target.kind)}</p>
      ) : plan.kind === 'essence' ? (
        <EssenceReadout plan={plan} mining={input.mining} counted={includeDrain} />
      ) : (
        <RuneReadout plan={plan} mining={input.mining} counted={includeDrain} />
      )}
    </Section>
  );
}

/** Why there is no plan, in words, which differ by what was asked for. */
function blockedText(blocker: Blocker, kind: PlanTarget['kind']): string {
  switch (blocker.why) {
    case 'unmineable':
      return `You can't mine ${ESSENCE_LABELS[blocker.essence]} yet, and this needs more of it than you already have. The ledger at the top of the page says what is stopping you.`;
    case 'locked':
      return `The ${ALTARS[blocker.altar].label} is not unlocked yet.`;
    case 'silent':
      return `The ${ALTARS[blocker.altar].label} crafts nothing at its current levels.`;
    case 'drained': {
      const pool = ESSENCE_LABELS[blocker.essence];
      const who =
        kind === 'rune' ? `Your other altars on ${pool} take` : `The altars on ${pool} take`;
      return `${who} ${formatNumber(blocker.drain, 2)} an hour between them and you mine ${formatNumber(blocker.income, 2)} an hour, so the pile never grows. Switch an altar off, or clear "Include altar drain".`;
    }
  }
}

/** The headline figure: one big number and what it is an answer to. */
function Headline({ hours, of }: { hours: number; of: string }) {
  return (
    <div className="plan-headline">
      <span className="num value">{formatHours(hours)}</span>
      <span className="unit">{of}</span>
    </div>
  );
}

/** What is already in hand, where that is what shortened the run. */
function InHand({ owned, want, unit }: { owned: number; want: number; unit: string }) {
  if (owned <= 0) return null;
  return (
    <p className="plan-inhand">
      {formatCompact(owned)} of the {formatCompact(want)} {unit} already in hand.
    </p>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: 'drain' }) {
  return (
    <div className={tone ? `plan-line ${tone}` : 'plan-line'}>
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

/** "Switching to it first" and the like: what the plan quietly assumes. */
function Assumes({ children }: { children: ReactNode }) {
  return <p className="plan-assumes">{children}</p>;
}

function EssenceReadout({
  plan,
  mining,
  counted,
}: {
  plan: EssencePlan;
  mining: ArcanistInput['mining'];
  counted: boolean;
}) {
  const label = ESSENCE_LABELS[plan.essence];

  return (
    <>
      <Headline
        hours={plan.hours}
        of={`to mine ${formatCompact(plan.needed)}${plan.owned > 0 ? ' more' : ''} ${label}`}
      />
      <InHand owned={plan.owned} want={plan.quantity} unit={label} />

      <div className="plan-lines">
        <Line label="Mining" value={`${formatNumber(plan.income, 2)} / hr`} />
        {counted && plan.drain > 0 ? (
          <Line label="Altar drain" value={`−${formatNumber(plan.drain, 2)} / hr`} tone="drain" />
        ) : null}
        <Line label="Banking" value={`${formatNumber(plan.rate, 2)} / hr`} />
      </div>

      {!counted && plan.drain > 0 ? (
        <Assumes>
          Your altars on {label} take {formatNumber(plan.drain, 2)} an hour, which this is not
          counting — switch them off, or tick <strong>Include altar drain</strong>.
        </Assumes>
      ) : null}

      {mining !== plan.essence ? (
        <Assumes>
          You are mining {ESSENCE_LABELS[mining]} right now, so this is the plan for switching to{' '}
          {label} and staying on it.
        </Assumes>
      ) : null}
    </>
  );
}

function RuneReadout({
  plan,
  mining,
  counted,
}: {
  plan: RunePlan;
  mining: ArcanistInput['mining'];
  counted: boolean;
}) {
  const rune = RESOURCE_LABELS[plan.rune];
  const essence = ESSENCE_LABELS[plan.essence];
  const left = Math.ceil(plan.surplus?.runesLeft ?? 0);

  return (
    <>
      <Headline
        hours={plan.hours}
        of={`to craft ${formatCompact(plan.runesNeeded)}${
          plan.runesOwned > 0 ? ' more' : ''
        } ${runesNamed(rune, plan.runesNeeded)}`}
      />
      <InHand owned={plan.runesOwned} want={plan.quantity} unit={runesNamed(rune, plan.quantity)} />

      {/* The second answer, and the one that decides whether the plan is even
          worth starting: the essence bill for what is left to craft. */}
      <div className="plan-bill">
        <Icon src={ESSENCE_ICONS[plan.essence]} size={20} />
        <span className="num">{formatCompact(plan.essenceNeeded)}</span>
        <span className="unit">
          {essence} needed · {formatNumber(plan.essencePerRune, 2)} per rune
        </span>
        {plan.essenceOwned > 0 ? (
          <span className="plan-bill-net">
            {plan.essenceToMine > 0 ? (
              <>
                {formatCompact(plan.essenceToMine)} still to mine, once the{' '}
                {formatCompact(plan.essenceOwned)} in your pool comes off.
              </>
            ) : (
              <>What is in your pool covers all of it.</>
            )}
          </span>
        ) : null}
      </div>

      <div className="plan-lines">
        <Line label="Altar crafts" value={`${formatNumber(plan.runesPerHour, 2)} / hr`} />
        <Line label="Altar takes" value={`−${formatNumber(plan.altarDrain, 2)} / hr`} tone="drain" />
        <Line label="You mine" value={`${formatNumber(plan.miningRate, 2)} / hr`} />
      </div>

      {plan.limit === 'mining' ? (
        <p className="plan-pace">
          Your mining sets the pace.{' '}
          {Number.isFinite(plan.fullRateHours) && plan.fullRateHours > 0 ? (
            <>
              What is in your pool holds the {ALTARS[plan.altar].label} at full rate for the first{' '}
              {formatHours(plan.fullRateHours)}; after that it runs at{' '}
              {formatPercent(plan.supply, 0)} and stalls the rest of the time.
            </>
          ) : (
            <>
              The {ALTARS[plan.altar].label} can only hold {formatPercent(plan.supply, 0)} of its
              rate on this much essence, and stalls the rest of the time.
            </>
          )}{' '}
          Either way, there is nothing to walk away from here.
        </p>
      ) : plan.surplus && plan.surplus.hours <= 0 ? (
        <div className="plan-surplus">
          <p className="plan-surplus-lead">
            Your pool already holds every bit of essence this needs, so you are free to go and
            gather another essence right now.
            <Help id="planSurplus" />
          </p>
          <p className="plan-surplus-why">
            The {ALTARS[plan.altar].label} finishes the {formatCompact(left)}{' '}
            {runesNamed(rune, left)} on its own, {formatHours(plan.surplus.hoursLeft)} from now.
          </p>
        </div>
      ) : plan.surplus ? (
        <div className="plan-surplus">
          <p className="plan-surplus-lead">
            When you have{' '}
            <strong>
              {formatCompact(Math.ceil(plan.surplus.essence))} {essence}
            </strong>{' '}
            banked and{' '}
            <strong>
              {formatCompact(Math.floor(plan.surplus.runes))}{' '}
              {runesNamed(rune, Math.floor(plan.surplus.runes))}
            </strong>
            , you are free to go and gather another essence.
            <Help id="planSurplus" />
          </p>
          <p className="plan-surplus-why">
            That is about {formatHours(plan.surplus.hours)} of mining. What is banked by then is
            exactly what the altar still needs, so it finishes the last {formatCompact(left)}{' '}
            {runesNamed(rune, left)} on its own, {formatHours(plan.surplus.hoursLeft)} later.
          </p>
        </div>
      ) : (
        <p className="plan-pace">
          The {ALTARS[plan.altar].label} sets the pace, and your mining keeps it fed with nothing to
          spare — so you are mining the whole {formatHours(plan.hours)}.
        </p>
      )}

      {plan.idle ? (
        <Assumes>
          The {ALTARS[plan.altar].label} is switched off in your build. This plan assumes you turn it
          on.
        </Assumes>
      ) : null}

      {counted && plan.otherDrain > 0 ? (
        <Assumes>
          Your other altars on {essence} take {formatNumber(plan.otherDrain, 2)} an hour, which is
          already out of the figure above.
        </Assumes>
      ) : null}

      {!counted && plan.otherDrain > 0 ? (
        <Assumes>
          Your other altars on {essence} take {formatNumber(plan.otherDrain, 2)} an hour, which this
          is not counting — switch them off, or tick <strong>Include altar drain</strong>.
        </Assumes>
      ) : null}

      {plan.essenceToMine > 0 && mining !== plan.essence ? (
        <Assumes>
          You are mining {ESSENCE_LABELS[mining]} right now, so this is the plan for switching to{' '}
          {essence} and feeding the altar from it.
        </Assumes>
      ) : null}
    </>
  );
}
