import { ESSENCE_LABELS } from '../../calc/constants';
import { formatNumber } from '../../calc/format';
import type { ArcanistInput, ArcanistResult, EssenceType } from '../../calc/types';
import { ESSENCE_TYPES } from '../../calc/types';
import { Help, Icon, useFlashOnChange } from '../components';
import { ESSENCE_ICONS } from '../icons';

/**
 * The three essences, and which one you are mining.
 *
 * The spreadsheet showed one at a time behind a dropdown because it ran out of
 * room; all three are computed either way, so all three are shown. What the
 * sheet never modelled is that you can only mine one of them at once — so the
 * other two are showing an income you are not receiving.
 *
 * Rather than add a separate control for that, the cells *are* the control:
 * click one to mine it. The mined cell shows what you are banking; the others
 * dim and label themselves "if you switched", which is what those numbers have
 * always actually meant.
 */
function LedgerCell({
  type,
  result,
  mining,
  onMine,
}: {
  type: EssenceType;
  result: ArcanistResult;
  mining: boolean;
  onMine: () => void;
}) {
  const outcome = result.essence[type];
  // The banked figure while mining this; the hypothetical net otherwise.
  const headline = mining ? outcome.sustainedNet : outcome.netEssencePerHour;
  const flash = useFlashOnChange(headline);

  const keptPct =
    outcome.essencePerHour > 0
      ? Math.max(0, Math.min(1, headline / outcome.essencePerHour)) * 100
      : 0;

  return (
    <div className="ledger-cell" data-type={type} data-mining={mining ? '' : undefined}>
      {/* A full-bleed click target rather than a <button> wrapping the cell:
          the cell contains its own "?" buttons, and a button cannot nest. This
          sits under the content and above the background, so clicking anywhere
          that is not a "?" picks this essence. */}
      <button
        type="button"
        className="ledger-pick"
        aria-pressed={mining}
        aria-label={`Mine ${ESSENCE_LABELS[type]}`}
        onClick={onMine}
      />

      <div className="ledger-head">
        <Icon src={ESSENCE_ICONS[type]} size={18} />
        {ESSENCE_LABELS[type]}
        <span className="ledger-tag">{mining ? 'mining' : 'if you switched'}</span>
      </div>

      {outcome.unmineable ? (
        <div className="ledger-blocked">
          <strong>Can't mine</strong>
          {outcome.armor >= result.stats.damage
            ? `Armour ${formatNumber(outcome.armor)} meets or beats your ${formatNumber(
                result.stats.damage,
              )} damage.`
            : `Regen ${formatNumber(outcome.avgRegen)}/hit outpaces your damage after armour.`}
        </div>
      ) : (
        <>
          <div className="ledger-net">
            <span className={`num value${flash ? ' flash' : ''}${headline < 0 ? ' negative' : ''}`}>
              {formatNumber(headline, 2)}
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
                Blocks / hr <Help id="ledgerBlocks" />
              </span>
              <span className="num">{formatNumber(outcome.blocksPerHour, 2)}</span>
            </div>
            {/* The spread behind the income figure. A single block pays
                anywhere in this range, and the hourly number above is the
                average of a hundred of them — without this, a run of minimum
                rolls reads as the calculator being wrong. */}
            <div>
              <span>
                Loot / block <Help id="ledgerLootRange" />
              </span>
              <span className="num">
                {formatNumber(outcome.minLoot)}–{formatNumber(outcome.luckiestLoot)}
                <span className="avg">avg {formatNumber(outcome.trueLootAvg, 2)}</span>
              </span>
            </div>
          </div>

          {/* Only worth saying where it is a surprise: the altars on this pool
              want more than you can mine, so they are running at part rate. */}
          {mining && outcome.altarDrain > outcome.essencePerHour ? (
            <div className="ledger-starved">
              Altars want {formatNumber(outcome.altarDrain, 0)}/hr — they run at{' '}
              {formatNumber((outcome.essencePerHour / outcome.altarDrain) * 100, 0)}% and you bank
              nothing.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function Ledger({
  input,
  result,
  update,
}: {
  input: ArcanistInput;
  result: ArcanistResult;
  update: (mutate: (draft: ArcanistInput) => void) => void;
}) {
  return (
    <div className="ledger" role="group" aria-label="Essence being mined">
      {ESSENCE_TYPES.map((type) => (
        <LedgerCell
          key={type}
          type={type}
          result={result}
          mining={input.mining === type}
          onMine={() =>
            update((draft) => {
              draft.mining = type;
            })
          }
        />
      ))}
    </div>
  );
}
