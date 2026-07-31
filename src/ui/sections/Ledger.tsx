import { ESSENCE_LABELS } from '../../calc/constants';
import { formatNumber } from '../../calc/format';
import type { ArcanistResult, EssenceType } from '../../calc/types';
import { ESSENCE_TYPES } from '../../calc/types';
import { Help, Icon, useFlashOnChange } from '../components';
import { ESSENCE_ICONS } from '../icons';

/**
 * Net essence per hour for all three tiers, pinned above the inputs.
 *
 * The spreadsheet showed one tier at a time behind a dropdown because it ran
 * out of room; all three are computed either way, so all three are shown.
 */
function LedgerCell({ type, result }: { type: EssenceType; result: ArcanistResult }) {
  const outcome = result.essence[type];
  const flash = useFlashOnChange(outcome.netEssencePerHour);

  const keptPct =
    outcome.essencePerHour > 0
      ? Math.max(0, Math.min(1, outcome.netEssencePerHour / outcome.essencePerHour)) * 100
      : 0;

  return (
    <div className="ledger-cell" data-type={type}>
      <div className="ledger-head">
        <Icon src={ESSENCE_ICONS[type]} size={18} />
        {ESSENCE_LABELS[type]}
      </div>

      {outcome.unkillable ? (
        <div className="ledger-blocked">
          <strong>No kill</strong>
          {outcome.armor >= result.stats.damage
            ? `Armour ${formatNumber(outcome.armor)} meets or beats your ${formatNumber(
                result.stats.damage,
              )} damage.`
            : `Healing ${formatNumber(outcome.avgHeal)}/hit outpaces your damage after armour.`}
        </div>
      ) : (
        <>
          <div className="ledger-net">
            <span
              className={`num value${flash ? ' flash' : ''}${
                outcome.netEssencePerHour < 0 ? ' negative' : ''
              }`}
            >
              {formatNumber(outcome.netEssencePerHour, 2)}
            </span>
            <span className="unit">net / hr</span>
            <Help id="ledgerNet" />
          </div>

          <div className="drainbar" aria-hidden="true">
            <span className="kept" style={{ width: `${keptPct}%` }} />
            <span className="drained" style={{ width: `${100 - keptPct}%` }} />
          </div>

          <div className="ledger-lines">
            <div>
              <span>
                Income <Help id="ledgerIncome" />
              </span>
              <span className="num">{formatNumber(outcome.essencePerHour, 2)}</span>
            </div>
            <div className="drain">
              <span>
                Altar drain <Help id="ledgerDrain" />
              </span>
              <span className="num">
                {outcome.altarDrain > 0 ? `−${formatNumber(outcome.altarDrain, 2)}` : '0'}
              </span>
            </div>
            <div>
              <span>
                Kills / hr <Help id="ledgerKills" />
              </span>
              <span className="num">{formatNumber(outcome.killsPerHour, 2)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Ledger({ result }: { result: ArcanistResult }) {
  return (
    <div className="ledger">
      {ESSENCE_TYPES.map((type) => (
        <LedgerCell key={type} type={type} result={result} />
      ))}
    </div>
  );
}
