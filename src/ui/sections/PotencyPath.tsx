import { useMemo, useState } from 'react';

import { ALTARS, ESSENCE_LABELS, RESOURCE_LABELS } from '../../calc/constants';
import { formatCompact, formatHours } from '../../calc/format';
import { potencyPlan } from '../../calc/potency';
import type { ArcanistInput, ArcanistResult } from '../../calc/types';
import { Help, Icon, ResourceAmount, Section, Subhead } from '../components';
import { ESSENCE_ICONS, RESOURCE_ICONS, SPELL_ACTIVE_ICONS } from '../icons';

/**
 * What the remaining potency ranks cost, in runes and in the mining behind them.
 *
 * Three readings, in the order the questions get asked. The essence budget is
 * the headline, because mining hours are what the plan actually costs. The
 * per-spell table answers "how much of that is this spell". The buy order is
 * last: it is the least trustworthy as instructions — real play interleaves
 * mining for the orb exchange — and exists mainly to show the reasoning.
 *
 * The altar shutdown list is the only outright advice here, and it is the one
 * line that holds regardless of how the player splits their time.
 */

/** Steps shown before the buy order is folded. */
const PREVIEW = 12;

export function PotencyPath({ input, result }: { input: ArcanistInput; result: ArcanistResult }) {
  const plan = useMemo(() => potencyPlan(input, result), [input, result]);
  const [showAll, setShowAll] = useState(false);

  const shown = showAll ? plan.steps : plan.steps.slice(0, PREVIEW);
  const done = plan.steps.length === 0 && plan.unreachable === 0;
  // Only worth a block when at least one altar should be doing something other
  // than what it is doing now.
  const worthSaying = plan.altars.some(
    (a) => a.advice !== 'run' || a.stopAt < plan.totalHours - 1e-9,
  );

  return (
    <Section
      title="Spell Potency Path"
      help="potencyPath"
      eyebrow={done ? 'all at rank 10' : `${formatHours(plan.totalHours)} of mining`}
      flush
    >
      {done ? (
        <p className="note" style={{ padding: '12px 16px 16px' }}>
          Every spell potency is already at rank 10.
        </p>
      ) : (
        <>
          {plan.blocked.length > 0 ? (
            <p className="opt-blocked">
              {plan.unreachable} rank{plan.unreachable === 1 ? '' : 's'} cannot be planned:{' '}
              {plan.blocked.map((rune) => RESOURCE_LABELS[rune]).join(' and ')} have no altar
              running on an essence you can mine.
            </p>
          ) : null}

          {plan.budget.length > 0 ? (
            <div className="budget">
              {plan.budget.map((row) => (
                <div className="budget-row" key={row.essence}>
                  <span className="named">
                    <Icon src={ESSENCE_ICONS[row.essence]} size={18} />
                    {ESSENCE_LABELS[row.essence]}
                  </span>
                  <span className="num budget-amount">{formatCompact(row.required)}</span>
                  <span className="num budget-hours">{formatHours(row.hours)}</span>
                </div>
              ))}
              <p className="budget-note">
                Essence these ranks consume, and the mining that implies at your current rates{' '}
                <Help id="potencyBudget" />
              </p>
            </div>
          ) : null}

          {worthSaying ? (
            <div className="altar-stops">
              <div className="altar-stops-head">
                Altars <Help id="potencyAltarStop" />
              </div>
              {plan.altars.map((schedule) => (
                <div className="altar-stop" key={schedule.altar}>
                  <span className="named">
                    {RESOURCE_ICONS[schedule.rune] ? (
                      <Icon src={RESOURCE_ICONS[schedule.rune]!} size={15} />
                    ) : null}
                    {ALTARS[schedule.altar].label}
                  </span>
                  {schedule.advice === 'run' ? (
                    <span className="num">run {formatHours(schedule.stopAt)}, then stop</span>
                  ) : schedule.advice === 'start' ? (
                    <span className="altar-stop-start">
                      needed — run it on {ESSENCE_LABELS[ALTARS[schedule.altar].consumes]}
                    </span>
                  ) : (
                    <span className="altar-stop-off">nothing left needs it — turn it off</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div className="scroll-x">
            <table className="matrix potency-summary">
              <thead>
                <tr>
                  <th>Spell</th>
                  <th>Ranks</th>
                  <th>Runes</th>
                  <th>
                    Mined by <Help id="potencyTotal" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.bySpell.map((spell) => (
                  <tr key={spell.spell}>
                    <td>
                      <span className="named">
                        <Icon src={SPELL_ACTIVE_ICONS[spell.spell]} size={18} />
                        {spell.label}
                      </span>
                    </td>
                    <td>
                      {spell.from} → {spell.to}
                      {spell.to < spell.from + spell.ranks ? (
                        <span className="opt-tradeoff"> of {spell.from + spell.ranks}</span>
                      ) : null}
                    </td>
                    <td>
                      <ResourceAmount resource={spell.resource} amount={spell.cost} />
                    </td>
                    <td
                      style={{
                        color: Number.isFinite(spell.finishAt) ? undefined : 'var(--ember)',
                      }}
                    >
                      {formatHours(spell.finishAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Subhead>
            Buy order <Help id="potencyEta" />
          </Subhead>

          <ol className="opt-list potency-steps">
            {shown.map((step, i) => {
              const runeIcon = RESOURCE_ICONS[step.resource];
              return (
                <li className="opt-entry" key={`${step.spell}.${step.from}`}>
                  <span className="opt-rank num">{i + 1}</span>
                  <span className="opt-body">
                    <span className="opt-name">
                      {step.label}
                      <span className="opt-level num">
                        {step.from}→{step.to}
                      </span>
                    </span>
                    {step.runeGain > 0 ? (
                      <span className="opt-feedback num">
                        +{formatCompact(step.runeGain)} runes/hr from here on
                      </span>
                    ) : null}
                  </span>
                  <span className="opt-gain">
                    <span className="num potency-at">{formatHours(step.at)}</span>
                    <span className="opt-cost num named tight">
                      {formatCompact(step.cost)}
                      {runeIcon ? (
                        <Icon src={runeIcon} size={14} alt={RESOURCE_LABELS[step.resource]} />
                      ) : null}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          {plan.steps.length > PREVIEW ? (
            <div className="potency-more">
              <button className="action" type="button" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show first 12' : `Show all ${plan.steps.length}`}
              </button>
            </div>
          ) : null}

          <p className="note" style={{ padding: '10px 16px 14px' }}>
            Mining hours assume every essence you mine goes to this plan. Essence also buys orbs at
            the exchange, so treat these as a floor and the order as reasoning rather than
            instructions.
          </p>
        </>
      )}
    </Section>
  );
}
