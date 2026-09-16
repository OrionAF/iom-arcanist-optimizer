import { BLOCKS, ESSENCE_LABELS } from '../../calc/constants';
import { formatDuration, formatNumber, formatPercent } from '../../calc/format';
import type { ArcanistResult, WeightedOutcome } from '../../calc/types';
import { ESSENCE_TYPES } from '../../calc/types';
import { Help, Section } from '../components';
import type { HelpId } from '../help';

/**
 * The full derivation behind the headline numbers, made visible.
 *
 * This is where a calculator earns trust: every headline number can be traced
 * back to the weights and block stats that produced it. Every row carries a "?"
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
    <Section title="Show the Math" eyebrow="derivation" defaultOpen={false}>
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
              render={(t) => formatNumber(BLOCKS[t].health)}
            />
            <Row
              label="Armour (after pen)"
              help="mathArmor"
              render={(t) => `${formatNumber(result.essence[t].armor)} of ${BLOCKS[t].armor}`}
            />
            <Row
              label="Regen every 10s"
              help="mathRegen"
              render={(t) => formatNumber(result.essence[t].regenAmount)}
            />
            <Row
              label="Hit (after armour)"
              help="mathDamagePerHit"
              render={(t) => formatNumber(result.essence[t].hitDamage)}
            />
            <Row
              label="Weakened hit"
              help="mathWeakenedHit"
              render={(t) =>
                BLOCKS[t].weakenChance > 0 ? formatNumber(result.essence[t].weakenedHitDamage) : '—'
              }
            />
            <Row
              label="Avg hit (with crits)"
              help="mathExpectedHit"
              render={(t) => formatNumber(result.essence[t].expectedHitDamage, 2)}
            />
            <Row
              label="Stun lands / roll"
              help="mathStun"
              render={(t) => formatPercent(result.essence[t].stunChancePerRoll, 2)}
            />
            <Row
              label="Weaken lands / roll"
              help="mathWeaken"
              render={(t) => formatPercent(result.essence[t].weakenChancePerRoll, 2)}
            />
            <Row
              label="Daze lands / roll"
              help="mathDaze"
              render={(t) => formatPercent(result.essence[t].dazeChancePerRoll, 2)}
            />
            <Row
              label="Hits to mine"
              help="mathHitsToMine"
              render={(t) =>
                result.essence[t].unmineable ? '—' : formatNumber(result.essence[t].hitsToMine, 2)
              }
            />
            <Row
              label="Time stunned / block"
              help="mathStunnedTime"
              render={(t) =>
                result.essence[t].unmineable ? '—' : formatDuration(result.essence[t].stunnedTime)
              }
            />
            <Row
              label="Weakened hits"
              help="mathWeakenedShare"
              render={(t) =>
                result.essence[t].unmineable ? '—' : formatPercent(result.essence[t].weakenedShare, 2)
              }
            />
            <Row
              label="Time dazed / block"
              help="mathDazedTime"
              render={(t) =>
                result.essence[t].unmineable ? '—' : formatDuration(result.essence[t].dazedTime)
              }
            />
            <Row
              label="Heals / block"
              help="mathHeals"
              render={(t) =>
                result.essence[t].unmineable ? '—' : formatNumber(result.essence[t].healsPerBlock, 2)
              }
            />
            <Row
              label="Time to mine"
              help="mathTimeToMine"
              render={(t) =>
                result.essence[t].unmineable
                  ? '—'
                  : `${formatDuration(result.essence[t].timeToMine)} ±${formatNumber(
                      result.essence[t].timeToMineStdErr,
                      2,
                    )}s`
              }
            />
            <Row
              label="Respawn"
              help="mathRespawn"
              render={(t) => formatDuration(result.essence[t].respawn)}
            />
            <Row
              label="Loot range"
              help="mathLootRange"
              render={(t) => `${result.essence[t].minLoot}–${result.essence[t].maxLoot}`}
            />
            <Row
              label="Loot range (with shiny)"
              help="mathLuckiestLoot"
              render={(t) => `${result.essence[t].minLoot}–${result.essence[t].luckiestLoot}`}
            />
            <Row
              label="Avg loot (with shiny)"
              help="mathAvgLoot"
              render={(t) => formatNumber(result.essence[t].trueLootAvg, 4)}
            />
            <Row
              label="Blocks / hr"
              help="mathBlocksPerHour"
              render={(t) => formatNumber(result.essence[t].blocksPerHour, 3)}
            />
            <Row
              label="Brittle blocks / hr"
              help="mathBrittleBlocks"
              render={(t) => formatNumber(result.essence[t].brittleBlocksPerHour, 3)}
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
        Essence block stats are game constants, not inputs. Ash and Brine altars draw from Soft
        essence; Chasm and Drift draw from Dense; Echo draws from Jagged. Nothing draws from
        Necrotic.
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
