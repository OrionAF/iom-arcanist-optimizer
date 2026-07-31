import {
  ALTARS,
  ALTAR_IDS,
  ESSENCE_UPGRADES,
  EXCHANGE_PLACEHOLDERS,
  EXCHANGE_UPGRADES,
  RESOURCE_LABELS,
  SPELLS,
  SPELL_IDS,
} from '../../calc/constants';
import { formatDuration, formatNumber, formatPercent } from '../../calc/format';
import type { AltarId, ArcanistInput, ArcanistResult, UpgradeCost } from '../../calc/types';
import { BundleAmount, LevelInput, Meter, Section, Stat, Subhead, Switch } from '../components';

interface Props {
  input: ArcanistInput;
  result: ArcanistResult;
  update: (mutate: (draft: ArcanistInput) => void) => void;
}

function RowsHead() {
  return (
    <thead>
      <tr>
        <th>Upgrade</th>
        <th>Level</th>
        <th>Effect</th>
        <th style={{ textAlign: 'right' }}>Remaining</th>
        <th style={{ textAlign: 'right' }}>Total</th>
      </tr>
    </thead>
  );
}

function CostRow({
  row,
  max,
  onChange,
}: {
  row: UpgradeCost;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <tr className={row.level >= max ? 'maxed' : undefined}>
      <td className="name" title={row.note}>
        {row.label}
        {row.note ? <span style={{ color: 'var(--text-faint)' }}> ⁎</span> : null}
      </td>
      <td>
        <LevelInput value={row.level} max={max} onChange={onChange} label={row.label} />
      </td>
      <td className="effect">{row.effectText}</td>
      <td className="cost">
        <BundleAmount bundle={row.remaining} />
      </td>
      <td className="cost">
        <BundleAmount bundle={row.total} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------- essence --

export function EssenceUpgrades({ result, update }: Props) {
  return (
    <Section title="Essence Upgrades" eyebrow="orbs · runes" flush>
      <div className="scroll-x">
        <table className="rows">
          <RowsHead />
          <tbody>
            {result.rows.essence.map((row, i) => {
              const def = ESSENCE_UPGRADES[i]!;
              return (
                <CostRow
                  key={row.id}
                  row={row}
                  max={def.max}
                  onChange={(next) =>
                    update((draft) => {
                      draft.essence[def.id] = next;
                    })
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ----------------------------------------------------------------- altars --

function Altar({ id, input, result, update }: Props & { id: AltarId }) {
  const def = ALTARS[id];
  const state = input.altars[id];
  const outcome = result.altars[id];
  const rows = result.rows.altars[id];
  const unlockRow = result.rows.altarUnlocks.find((r) => r.id === `${id}.unlock`);
  const needsUnlock = Object.keys(def.unlockCost).length > 0;

  return (
    <>
      <Subhead>{def.label}</Subhead>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '0 16px 8px' }}>
        {needsUnlock ? (
          <Switch
            checked={state.unlocked}
            onChange={(next) =>
              update((draft) => {
                draft.altars[id].unlocked = next;
                if (!next) draft.altars[id].active = false;
              })
            }
          >
            Unlocked
          </Switch>
        ) : null}
        <Switch
          checked={state.active}
          onChange={(next) =>
            update((draft) => {
              draft.altars[id].active = next;
            })
          }
        >
          Running
        </Switch>
        {needsUnlock && !state.unlocked && unlockRow ? (
          <span className="note">
            Unlock costs <BundleAmount bundle={unlockRow.remaining} />
          </span>
        ) : null}
      </div>

      <div className="scroll-x">
        <table className="rows">
          <tbody className={state.unlocked ? undefined : 'locked'}>
            {rows.map((row, i) => {
              const up = def.upgrades[i]!;
              return (
                <CostRow
                  key={row.id}
                  row={row}
                  max={up.max}
                  onChange={(next) =>
                    update((draft) => {
                      draft.altars[id][up.key] = next;
                    })
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="stats">
        <Stat label="Cycle" value={formatDuration(outcome.cycleTime)} />
        <Stat label="Runes / cycle" value={formatNumber(outcome.runesPerCycle, 2)} />
        <Stat
          label={`${RESOURCE_LABELS[def.rune]}s / hr`}
          value={
            <span style={{ color: `var(--res-${def.rune})` }}>
              {formatNumber(outcome.runesPerHour, 2)}
            </span>
          }
        />
        <Stat
          label="Essence / hr"
          value={
            <span style={{ color: state.active && state.unlocked ? 'var(--ember)' : undefined }}>
              {state.active && state.unlocked ? '−' : ''}
              {formatNumber(outcome.essenceCostPerHour, 2)}
            </span>
          }
        />
      </dl>
    </>
  );
}

export function Altars(props: Props) {
  return (
    <Section
      title="Altars"
      eyebrow={`rune craft ×${formatNumber(props.result.runeCraftMulti, 4)}`}
      flush
    >
      {ALTAR_IDS.map((id) => (
        <Altar key={id} id={id} {...props} />
      ))}
    </Section>
  );
}

// ----------------------------------------------------------------- spells --

export function Spells({ input, result, update }: Props) {
  return (
    <Section title="Spells" eyebrow="runes" flush>
      <div className="scroll-x">
        <table className="rows">
          <thead>
            <tr>
              <th>Spell</th>
              <th>Level</th>
              <th>Potency</th>
              <th>Effects</th>
              <th style={{ textAlign: 'right' }}>Potency cost</th>
            </tr>
          </thead>
          <tbody>
            {SPELL_IDS.map((id) => {
              const def = SPELLS[id];
              const state = input.spells[id];
              const outcome = result.spells[id];
              const row = result.rows.spells.find((r) => r.id === `${id}.potency`)!;

              return (
                <tr key={id} className={state.unlocked ? undefined : 'locked'}>
                  <td className="name">
                    <Switch
                      checked={state.unlocked}
                      onChange={(next) =>
                        update((draft) => {
                          draft.spells[id].unlocked = next;
                        })
                      }
                    >
                      {def.label}
                    </Switch>
                  </td>
                  <td>
                    <LevelInput
                      value={state.level}
                      max={def.maxLevel}
                      label={`${def.label} spell`}
                      onChange={(next) =>
                        update((draft) => {
                          draft.spells[id].level = next;
                        })
                      }
                    />
                  </td>
                  <td>
                    <LevelInput
                      value={state.rank}
                      max={def.maxRank}
                      label={`${def.label} potency`}
                      onChange={(next) =>
                        update((draft) => {
                          draft.spells[id].rank = next;
                        })
                      }
                    />
                  </td>
                  <td className="effect">
                    {def.primary.label} {formatPercent(outcome.primary)}
                    <br />
                    {def.secondary.label} {formatPercent(outcome.secondary)}
                    {def.secondary.feedsBack ? (
                      <span style={{ color: 'var(--brine)' }}> ↩</span>
                    ) : null}
                  </td>
                  <td className="cost">
                    <BundleAmount bundle={row.remaining} />
                    <div style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                      {formatDuration(outcome.duration)} · {def.manaCost} mana
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ padding: '10px 16px 14px' }}>
        ↩ marks effects that feed back into these numbers. Locked spells grant nothing.
      </p>
    </Section>
  );
}

// --------------------------------------------------------------- exchange --

export function Exchange({ result, update }: Props) {
  return (
    <Section title="Exchange" eyebrow="stars · runes · essence" flush>
      <div className="scroll-x">
        <table className="rows">
          <RowsHead />
          <tbody>
            {result.rows.exchange.map((row, i) => {
              const def = EXCHANGE_UPGRADES[i]!;
              return (
                <CostRow
                  key={row.id}
                  row={row}
                  max={def.max}
                  onChange={(next) =>
                    update((draft) => {
                      draft.exchange[def.id] = next;
                    })
                  }
                />
              );
            })}
            {EXCHANGE_PLACEHOLDERS.map((label) => (
              <tr key={label} className="placeholder">
                <td className="name">{label}</td>
                <td colSpan={4}>Not released</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// -------------------------------------------------------------- read-outs --

export function Stats({ result }: { result: ArcanistResult }) {
  const s = result.stats;
  return (
    <Section title="Arcanist Stats" eyebrow="derived" flush>
      <dl className="stats">
        <Stat label="Damage" value={formatNumber(s.damage, 2)} />
        <Stat label="Attack every" value={formatDuration(s.attackInterval)} />
        <Stat label="Crit chance" value={formatPercent(s.critChance)} />
        <Stat label="Crit damage" value={`×${formatNumber(s.critDamage, 2)}`} />
        <Stat label="Super crit" value={formatPercent(s.superCritChance)} />
        <Stat label="Super crit dmg" value={`×${formatNumber(s.superCritDamage, 2)}`} />
        <Stat label="Armour pen" value={formatNumber(s.armorPen)} />
        <Stat label="Stun negate" value={formatPercent(s.stunNegate)} />
        <Stat label="Shiny chance" value={formatPercent(s.shinyChance)} />
        <Stat label="Shiny bonus" value={`+${formatNumber(s.shinyBonus)}`} />
        <Stat label="Super shiny" value={formatPercent(s.superShinyChance)} />
        <Stat label="Brittle chance" value={formatPercent(s.brittleChance)} />
      </dl>
    </Section>
  );
}

export function Completion({ result }: { result: ArcanistResult }) {
  const { rows, current, max, reserved } = result.completion;
  return (
    <Section title="Completion">
      {rows.map((row) => (
        <Meter key={row.label} {...row} />
      ))}
      <div style={{ height: 8 }} />
      <Meter label="Total" current={current} max={max} grand />
      <p className="note" style={{ marginTop: 10 }}>
        Total includes {reserved} levels the sheet reserves for unreleased content.
      </p>
    </Section>
  );
}
