import {
  ALTARS,
  ALTAR_IDS,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  RESOURCE_LABELS,
  SPELLS,
  SPELL_IDS,
} from '../../calc/constants';
import { formatDuration, formatNumber, formatPercent } from '../../calc/format';
import type { AltarId, ArcanistInput, ArcanistResult, UpgradeCost } from '../../calc/types';
import {
  BundleAmount,
  CostPair,
  Help,
  Icon,
  LevelInput,
  Section,
  Stat,
  Subhead,
  Switch,
} from '../components';
import {
  ALTAR_ICONS,
  ESSENCE_UPGRADE_ICONS,
  EXCHANGE_UPGRADE_ICONS,
  MISC_ICONS,
  SECTION_ICONS,
  SPELL_ACTIVE_ICONS,
  SPELL_ICONS,
} from '../icons';

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
        <th style={{ textAlign: 'right' }}>
          Next / Remaining <Help id="nextRemaining" />
        </th>
      </tr>
    </thead>
  );
}

function CostRow({
  row,
  max,
  icon,
  onChange,
}: {
  row: UpgradeCost;
  max: number;
  icon?: string;
  onChange: (next: number) => void;
}) {
  return (
    <tr className={row.level >= max ? 'maxed' : undefined}>
      <td className="name" title={row.note}>
        <span className="named">
          {icon ? <Icon src={icon} size={20} dim={row.level >= max} /> : null}
          <span>
            {row.label}
            {row.note ? <span style={{ color: 'var(--text-faint)' }}> ⁎</span> : null}
          </span>
        </span>
      </td>
      <td>
        <LevelInput value={row.level} max={max} onChange={onChange} label={row.label} />
      </td>
      <td className="effect">{row.effectText}</td>
      {/* Cost to max is not shown per row: it never changes as you play, and
          the Total Resources panel already sums it. Next and remaining are the
          two numbers that move. */}
      {row.priced ? (
        <td className="cost">
          <CostPair next={row.next} remaining={row.remaining} />
        </td>
      ) : null}
    </tr>
  );
}

// ---------------------------------------------------------------- essence --

export function EssenceUpgrades({ result, update }: Props) {
  return (
    <Section title="Essence Upgrades" icon={SECTION_ICONS.essence} eyebrow="orbs · runes" flush>
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
                  icon={ESSENCE_UPGRADE_ICONS[def.id]}
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
      <Subhead>
        <Icon src={ALTAR_ICONS[id]} size={18} />
        {def.label}
      </Subhead>

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
        <Stat label="Cycle" help="altarCycle" value={formatDuration(outcome.cycleTime)} />
        <Stat
          label="Runes / cycle"
          help="altarRunesPerCycle"
          value={formatNumber(outcome.runesPerCycle, 2)}
        />
        {/* The sustained rate is the one to plan on, so it takes the headline
            and the nominal rate drops to a footnote — but only when they
            differ, which is only when the pool cannot keep this altar fed. */}
        <Stat
          label={`${RESOURCE_LABELS[def.rune]}s / hr`}
          help="altarRunesPerHour"
          value={
            <>
              <span style={{ color: `var(--res-${def.rune})` }}>
                {formatNumber(outcome.sustainedRunesPerHour, 2)}
              </span>
              {outcome.supplyFactor < 1 ? (
                <span className="stat-note">
                  starved · {formatNumber(outcome.supplyFactor * 100, 0)}% of{' '}
                  {formatNumber(outcome.runesPerHour, 2)}
                </span>
              ) : null}
            </>
          }
        />
        <Stat
          label="Essence / hr"
          help="altarEssencePerHour"
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
      icon={SECTION_ICONS.altars}
      help="runeCraftMulti"
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
    <Section title="Spells" icon={SECTION_ICONS.spells} eyebrow="runes" flush>
      <div className="scroll-x">
        <table className="rows">
          <thead>
            <tr>
              <th>Spell</th>
              <th>Level</th>
              <th>Potency</th>
              <th>Effects</th>
              <th style={{ textAlign: 'right' }}>
                Potency next / remaining <Help id="potencyCost" />
              </th>
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
                    <span className="named">
                      {/* The buff icon once you own it, the card art until then. */}
                      <Icon
                        src={state.unlocked ? SPELL_ACTIVE_ICONS[id] : SPELL_ICONS[id]}
                        size={22}
                        dim={!state.unlocked}
                      />
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
                    </span>
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
                    <CostPair next={row.next} remaining={row.remaining} />
                    <div className="submeta">
                      {formatDuration(outcome.duration)} ·{' '}
                      <span className="named tight">
                        {def.manaCost}
                        <Icon src={MISC_ICONS.mana} size={14} alt="mana" />
                      </span>
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
    <Section
      title="Exchange"
      icon={SECTION_ICONS.exchange}
      eyebrow="costs unknown"
      help="exchange"
      flush
    >
      <div className="scroll-x">
        <table className="rows">
          <thead>
            <tr>
              <th>Upgrade</th>
              <th>Level</th>
              <th>Effect</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.exchange.map((row, i) => {
              const def = EXCHANGE_UPGRADES[i]!;
              return (
                <CostRow
                  key={row.id}
                  row={row}
                  max={def.max}
                  icon={EXCHANGE_UPGRADE_ICONS[def.id]}
                  onChange={(next) =>
                    update((draft) => {
                      draft.exchange[def.id] = next;
                    })
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ padding: '10px 16px 14px' }}>
        Only the two Exchange upgrades the Arcanist actually reads are listed. Their costs are not
        shown — they are not documented in game, and the figures the spreadsheet carried were
        guesses rather than observations.
      </p>
    </Section>
  );
}

// -------------------------------------------------------------- read-outs --

export function Stats({ result }: { result: ArcanistResult }) {
  const s = result.stats;
  return (
    <Section title="Arcanist Stats" eyebrow="derived" flush>
      <dl className="stats">
        <Stat label="Damage" help="statDamage" value={formatNumber(Math.round(s.damage))} />
        <Stat
          label="Attack every"
          help="statAttackInterval"
          value={formatDuration(s.attackInterval)}
        />
        <Stat label="Crit chance" help="statCritChance" value={formatPercent(s.critChance)} />
        <Stat
          label="Crit damage"
          help="statCritDamage"
          value={`×${formatNumber(s.critDamage, 2)}`}
        />
        <Stat label="Super crit" help="statSuperCrit" value={formatPercent(s.superCritChance)} />
        <Stat
          label="Super crit dmg"
          help="statSuperCritDamage"
          value={`×${formatNumber(s.superCritDamage, 2)}`}
        />
        <Stat label="Armour pen" help="statArmorPen" value={formatNumber(s.armorPen)} />
        <Stat label="Stun negate" help="statStunNegate" value={formatPercent(s.stunNegate)} />
        <Stat label="Shiny chance" help="statShinyChance" value={formatPercent(s.shinyChance)} />
        <Stat label="Shiny bonus" help="statShinyBonus" value={`+${formatNumber(s.shinyBonus)}`} />
        <Stat
          label="Super shiny"
          help="statSuperShiny"
          value={formatPercent(s.superShinyChance)}
        />
        <Stat
          label="Brittle chance"
          help="statBrittleChance"
          value={formatPercent(s.brittleChance)}
        />
      </dl>
    </Section>
  );
}

