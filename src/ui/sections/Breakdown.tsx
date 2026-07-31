import { ENEMIES, ESSENCE_LABELS } from '../../calc/constants';
import { formatDuration, formatNumber, formatPercent } from '../../calc/format';
import type { ArcanistResult, WeightedOutcome } from '../../calc/types';
import { ESSENCE_TYPES } from '../../calc/types';
import { Help, Section } from '../components';
import type { HelpId } from '../help';

/**
 * The workbook's off-screen scratch columns (U3:AJ33), made visible.
 *
 * This is where a calculator earns trust: every headline number can be traced
 * back to the weights and enemy stats that produced it. Every row carries a "?"
 * for the same reason — a derivation nobody can read is not a derivation.
 */
function WeightTable({
  caption,
  help,
  rows,
  average,
  averageLabel,
  valueLabel,
  /** Shiny outcomes add flat loot; crit and brittle outcomes scale damage. */
  valueKind,
}: {
  caption: string;
  help: HelpId;
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
          <th>
            {caption} <Help id={help} />
          </th>
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
    <Section title="Show the math" eyebrow="derivation" defaultOpen={false}>
      <WeightTable
        caption="Shiny proc"
        help="mathShinyTable"
        rows={averages.shinyTable}
        average={averages.shinyBonus}
        averageLabel="Expected bonus loot"
        valueLabel="Bonus loot"
        valueKind="flat"
      />

      <WeightTable
        caption="Crit tier"
        help="mathCritTable"
        rows={averages.critTable}
        average={averages.critMult}
        averageLabel="Expected damage multi"
        valueLabel="Damage"
        valueKind="multiplier"
      />

      <WeightTable
        caption="Brittle"
        help="mathBrittleTable"
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
            <Row
              label="Health"
              help="mathHealth"
              render={(t) => formatNumber(ENEMIES[t].health)}
            />
            <Row
              label="Armour (after pen)"
              help="mathArmor"
              render={(t) => `${formatNumber(result.essence[t].armor)} of ${ENEMIES[t].armor}`}
            />
            <Row
              label="Avg stun factor"
              help="mathStun"
              render={(t) => formatNumber(result.essence[t].avgStun, 4)}
            />
            <Row
              label="Avg weaken factor"
              help="mathWeaken"
              render={(t) => formatNumber(result.essence[t].avgWeaken, 4)}
            />
            <Row
              label="Heal per hit"
              help="mathHeal"
              render={(t) => formatNumber(result.essence[t].avgHeal, 2)}
            />
            <Row
              label="Damage per hit"
              help="mathDamagePerHit"
              render={(t) => formatNumber(result.essence[t].effectiveDamagePerHit, 3)}
            />
            <Row
              label="Hits to kill"
              help="mathHitsToKill"
              render={(t) =>
                result.essence[t].unkillable ? '—' : formatNumber(result.essence[t].hitsToKill)
              }
            />
            <Row
              label="Time to kill"
              help="mathTimeToKill"
              render={(t) =>
                result.essence[t].unkillable ? '—' : formatDuration(result.essence[t].timeToKill)
              }
            />
            <Row
              label="Respawn"
              help="mathRespawn"
              render={(t) => formatDuration(ENEMIES[t].respawn)}
            />
            <Row
              label="Loot range"
              help="mathLootRange"
              render={(t) => `${result.essence[t].minLoot}–${result.essence[t].maxLoot}`}
            />
            <Row
              label="Avg loot (with shiny)"
              help="mathAvgLoot"
              render={(t) => formatNumber(result.essence[t].trueLootAvg, 4)}
            />
            <Row
              label="Kills / hr"
              help="mathKillsPerHour"
              render={(t) => formatNumber(result.essence[t].killsPerHour, 3)}
            />
            <Row
              label="Brittle kills / hr"
              help="mathBrittleKills"
              render={(t) => formatNumber(result.essence[t].brittleKillsPerHour, 3)}
            />
            <Row
              label="Essence / hr"
              help="mathEssencePerHour"
              render={(t) => formatNumber(result.essence[t].essencePerHour, 2)}
            />
            <Row
              label="Altar drain / hr"
              help="mathAltarDrain"
              render={(t) => formatNumber(result.essence[t].altarDrain, 2)}
            />
            <tr className="total">
              <td>
                Net / hr <Help id="mathNet" />
              </td>
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
    </Section>
  );
}

function Row({
  label,
  help,
  render,
}: {
  label: string;
  help: HelpId;
  render: (type: (typeof ESSENCE_TYPES)[number]) => string;
}) {
  return (
    <tr>
      <td>
        {label} <Help id={help} />
      </td>
      {ESSENCE_TYPES.map((type) => (
        <td key={type}>{render(type)}</td>
      ))}
    </tr>
  );
}
