import { useMemo, useState } from 'react';

import { RESOURCE_LABELS } from '../../calc/constants';
import { formatCompact, formatHours } from '../../calc/format';
import { potencyPlan } from '../../calc/potency';
import type { ArcanistInput, ArcanistResult } from '../../calc/types';
import { Help, Icon, ResourceAmount, Section, Subhead } from '../components';
import { RESOURCE_ICONS, SPELL_ACTIVE_ICONS } from '../icons';

/**
 * The order to raise spell potencies in, and when each rank lands.
 *
 * Two readings of the same plan. The summary answers "how long until this spell
 * is done", which is the question someone arrives with; the buy order answers
 * "what do I spend the runes in my pocket on next", which is the one they can
 * act on this evening. Neither is derivable from the other at a glance, and the
 * summary is short enough that showing both costs nothing.
 *
 * The step list is truncated by default because it is sixty rows long on a
 * fresh build, and the tail of it is a year out — precise, and not yet useful.
 */

/** Steps shown before the list is folded. */
const PREVIEW = 12;

export function PotencyPath({ input, result }: { input: ArcanistInput; result: ArcanistResult }) {
  const plan = useMemo(() => potencyPlan(input, result), [input, result]);
  const [showAll, setShowAll] = useState(false);

  const shown = showAll ? plan.steps : plan.steps.slice(0, PREVIEW);
  const done = plan.steps.length === 0 && plan.unreachable === 0;

  return (
    <Section
      title="Spell Potency Path"
      help="potencyPath"
      eyebrow={done ? 'all at rank 10' : `${formatHours(plan.totalHours)} to finish`}
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
              running behind them. Unlock and run the altar and they rejoin the plan.
            </p>
          ) : null}

          <div className="scroll-x">
            <table className="matrix potency-summary">
              <thead>
                <tr>
                  <th>Spell</th>
                  <th>Ranks</th>
                  <th>Runes</th>
                  <th>
                    Done in <Help id="potencyTotal" />
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
            Assumes an empty bank and every rune your altars make going into this plan. Casting
            spells and buying altar upgrades spend the same runes, so treat these as floors.
          </p>
        </>
      )}
    </Section>
  );
}
