import { ENEMIES, ESSENCE_LABELS } from '../../calc/constants';
import { formatDuration, formatNumber, formatPercent } from '../../calc/format';
import type { ArcanistResult, WeightedOutcome } from '../../calc/types';
import { ESSENCE_TYPES } from '../../calc/types';
import { Collapsible } from '../components';

/**
 * The workbook's off-screen scratch columns (U3:AJ33), made visible.
 *
 * This is where a calculator earns trust: every headline number can be traced
 * back to the weights and enemy stats that produced it.
 */
function WeightTable({
  caption,
  rows,
  average,
  averageLabel,
  valueLabel,
  /** Shiny outcomes add flat loot; crit and brittle outcomes scale damage. */
  valueKind,
}: {
  caption: string;
  rows: WeightedOutcome[];
  average: number;
  averageLabel: string;
  valueLabel: string;
  valueKind: 'flat' | 'multiplier';
}) {
  return (
    <table className="matrix" style={{ marginBottom: 18 }}>
      <thead>
        <tr>
          <th>{caption}</th>
          <th>Chance</th>
          <th>{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td>{formatPercent(row.chance, 3)}</td>
            <td>
              {valueKind === 'flat'
                ? `+${formatNumber(row.value, 2)}`
                : `×${formatNumber(row.value, 3)}`}
            </td>
          </tr>
        ))}
        <tr className="total">
          <td>{averageLabel}</td>
          <td />
          <td>{formatNumber(average, 5)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function Breakdown({ result }: { result: ArcanistResult }) {
  const { averages } = result;

  return (
    <Collapsible title="Show the math" eyebrow="derivation">
      <WeightTable
        caption="Shiny proc"
        rows={averages.shinyTable}
        average={averages.shinyBonus}
        averageLabel="Expected bonus loot"
        valueLabel="Bonus loot"
        valueKind="flat"
      />

      <WeightTable
        caption="Crit tier"
        rows={averages.critTable}
        average={averages.critMult}
        averageLabel="Expected damage multi"
        valueLabel="Damage"
        valueKind="multiplier"
      />

      <WeightTable
        caption="Brittle"
        rows={averages.brittleTable}
        average={averages.brittleMult}
        averageLabel="Expected health fraction"
        valueLabel="Health needed"
        valueKind="multiplier"
      />

      <div className="scroll-x">
        <table className="matrix">
          <thead>
            <tr>
              <th>Per essence</th>
              {ESSENCE_TYPES.map((type) => (
                <th key={type}>{ESSENCE_LABELS[type].replace(' Essence', '')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Health" render={(t) => formatNumber(ENEMIES[t].health)} />
            <Row
              label="Armour (after pen)"
              render={(t) => `${formatNumber(result.essence[t].armor)} of ${ENEMIES[t].armor}`}
            />
            <Row label="Avg stun factor" render={(t) => formatNumber(result.essence[t].avgStun, 4)} />
            <Row
              label="Avg weaken factor"
              render={(t) => formatNumber(result.essence[t].avgWeaken, 4)}
            />
            <Row label="Heal per hit" render={(t) => formatNumber(result.essence[t].avgHeal, 2)} />
            <Row
              label="Damage per hit"
              render={(t) => formatNumber(result.essence[t].effectiveDamagePerHit, 3)}
            />
            <Row
              label="Hits to kill"
              render={(t) =>
                result.essence[t].unkillable ? '—' : formatNumber(result.essence[t].hitsToKill)
              }
            />
            <Row
              label="Time to kill"
              render={(t) =>
                result.essence[t].unkillable ? '—' : formatDuration(result.essence[t].timeToKill)
              }
            />
            <Row
              label="Respawn"
              render={(t) => formatDuration(ENEMIES[t].respawn)}
            />
            <Row
              label="Loot range"
              render={(t) => `${result.essence[t].minLoot}–${result.essence[t].maxLoot}`}
            />
            <Row
              label="Avg loot (with shiny)"
              render={(t) => formatNumber(result.essence[t].trueLootAvg, 4)}
            />
            <Row
              label="Kills / hr"
              render={(t) => formatNumber(result.essence[t].killsPerHour, 3)}
            />
            <Row
              label="Brittle kills / hr"
              render={(t) => formatNumber(result.essence[t].brittleKillsPerHour, 3)}
            />
            <Row
              label="Essence / hr"
              render={(t) => formatNumber(result.essence[t].essencePerHour, 2)}
            />
            <Row
              label="Altar drain / hr"
              render={(t) => formatNumber(result.essence[t].altarDrain, 2)}
            />
            <tr className="total">
              <td>Net / hr</td>
              {ESSENCE_TYPES.map((type) => (
                <td key={type}>{formatNumber(result.essence[type].netEssencePerHour, 2)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="note" style={{ marginTop: 12 }}>
        Enemy stats are game constants, not inputs. Ash and Brine altars draw from Soft essence;
        the Chasm altar draws from Dense. Nothing draws from Jagged.
      </p>
    </Collapsible>
  );
}

function Row({
  label,
  render,
}: {
  label: string;
  render: (type: (typeof ESSENCE_TYPES)[number]) => string;
}) {
  return (
    <tr>
      <td>{label}</td>
      {ESSENCE_TYPES.map((type) => (
        <td key={type}>{render(type)}</td>
      ))}
    </tr>
  );
}
