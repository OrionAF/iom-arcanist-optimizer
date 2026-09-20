import { Children, useState, type ReactNode } from 'react';

import {
  ALTARS,
  ALTAR_IDS,
  ESSENCE_LABELS,
  ESSENCE_UPGRADES,
  RESOURCE_LABELS,
  SPELLS,
  SPELL_IDS,
} from '../../calc/constants';
import { formatDuration, formatNumber, formatPercent } from '../../calc/format';
import type { AltarId, ArcanistInput, ArcanistResult, UpgradeCost } from '../../calc/types';
import { loadViewFlags, saveViewFlag } from '../../state/storage';
import {
  BundleAmount,
  CostPair,
  Help,
  Icon,
  LevelInput,
  Section,
  Stat,
  Switch,
  TabBody,
} from '../components';
import {
  ALTAR_ICONS,
  ESSENCE_UPGRADE_ICONS,
  MISC_ICONS,
  SPELL_ACTIVE_ICONS,
  SPELL_ICONS,
} from '../icons';

interface Props {
  input: ArcanistInput;
  result: ArcanistResult;
  update: (mutate: (draft: ArcanistInput) => void) => void;
}

/*
 * Every `.rows` table carries explicit ARIA roles.
 *
 * Below 720px these tables stop being tables: each row becomes a small grid, so
 * the actionable cost sits beside the name instead of off the right edge behind
 * a sideways scroll. Changing `display` away from `table` also drops the roles
 * the browser was inferring from the tags, so they are spelled out here to put
 * them back. On a wide screen they are exactly what the tags already meant.
 */
function RowsHead() {
  return (
    <thead role="rowgroup">
      <tr role="row">
        <th role="columnheader" scope="col">
          Upgrade
        </th>
        <th role="columnheader" scope="col">
          Level
        </th>
        {/* Classed so that hiding the effect column on a narrow screen hides the
            header with it — otherwise every following header shifts one column
            left and the last one runs off the edge. */}
        <th role="columnheader" scope="col" className="effect">
          Effect
        </th>
        <th role="columnheader" scope="col" style={{ textAlign: 'right' }}>
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
  group,
  onChange,
}: {
  row: UpgradeCost;
  max: number;
  icon?: string;
  /** Names the row's owner to a screen reader where the label alone repeats, as on every altar. */
  group?: string;
  onChange: (next: number) => void;
}) {
  const blocked = row.blockedBy && row.level === 0;
  return (
    <tr
      role="row"
      className={row.level >= max ? 'maxed' : blocked ? 'locked' : undefined}
    >
      <td role="cell" className="name" title={row.note}>
        <span className="named">
          {icon ? <Icon src={icon} size={20} dim={row.level >= max || blocked} /> : null}
          <span>
            {row.label}
            {row.note ? <span style={{ color: 'var(--text-faint)' }}> ⁎</span> : null}
            {row.blockedBy ? (
              // Every prerequisite is the row directly above, so the long
              // label rides in the tooltip rather than doubling the row.
              <span className="requires" title={`Needs level ${row.blockedBy.level} of ${row.blockedBy.label}`}>
                Needs level {row.blockedBy.level} of the upgrade above
              </span>
            ) : null}
          </span>
        </span>
      </td>
      {/* `data-label` is what the narrow layout prints in front of the stepper,
          standing in for the column header it no longer sits under. */}
      <td role="cell" className="ctl" data-label="Level">
        <LevelInput
          value={row.level}
          max={max}
          onChange={onChange}
          label={group ? `${group} ${row.label}` : row.label}
        />
      </td>
      <td role="cell" className="effect">
        {row.effectText}
      </td>
      {/* Cost to max is not shown per row: it never changes as you play, and
          the Total Resources panel already sums it. Next and remaining are the
          two numbers that move. */}
      {row.priced ? (
        <td role="cell" className="cost">
          <CostPair next={row.next} remaining={row.remaining} />
        </td>
      ) : (
        // Unknown, not free: a blank here would read as costing nothing.
        <td role="cell" className="cost" title={row.note}>
          <span className="submeta">cost unknown</span>
        </td>
      )}
    </tr>
  );
}

// ---------------------------------------------------------------- essence --

const HIDE_MAXED_ESSENCE = 'essence.hideMaxed';

export function EssenceUpgrades({ result, update }: Props) {
  const [hideMaxed, setHideMaxed] = useState(() => loadViewFlags()[HIDE_MAXED_ESSENCE] ?? false);

  // Paired with their definitions before filtering, since rows and
  // definitions are matched by position.
  const rows = result.rows.essence.map((row, i) => ({ row, def: ESSENCE_UPGRADES[i]! }));
  const maxed = rows.filter(({ row, def }) => row.level >= def.max).length;
  const shown = hideMaxed ? rows.filter(({ row, def }) => row.level < def.max) : rows;

  return (
    <TabBody
      eyebrow="orbs · runes"
      actions={
        <Switch
          checked={hideMaxed}
          onChange={(next) => {
            setHideMaxed(next);
            saveViewFlag(HIDE_MAXED_ESSENCE, next);
          }}
        >
          Hide maxed{maxed > 0 ? ` (${maxed})` : ''}
        </Switch>
      }
      flush
    >
      {shown.length === 0 ? (
        <p className="note" style={{ padding: '10px 16px 14px' }}>
          All essence upgrades are maxed.
        </p>
      ) : (
        <div className="scroll-x">
          <table className="rows" role="table">
            <RowsHead />
            <tbody role="rowgroup">
              {shown.map(({ row, def }) => {
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
      )}
    </TabBody>
  );
}

// ----------------------------------------------------------------- altars --

function Altar({
  id,
  input,
  result,
  update,
  hideMaxed,
}: Props & { id: AltarId; hideMaxed: boolean }) {
  const def = ALTARS[id];
  const state = input.altars[id];
  const outcome = result.altars[id];
  // Paired with their definitions before filtering, since rows and definitions
  // are matched by position.
  const rows = result.rows.altars[id].map((row, i) => ({ row, up: def.upgrades[i]! }));
  const shown = hideMaxed ? rows.filter(({ row, up }) => row.level < up.max) : rows;
  const unlockRow = result.rows.altarUnlocks.find((r) => r.id === `${id}.unlock`);
  const needsUnlock = Object.keys(def.unlockCost).length > 0;
  const running = state.active && state.unlocked;
  const pool = result.essence[def.consumes];
  const overdrawn = running && pool.altarDrain > pool.essencePerHour;

  return (
    /*
     * One card per altar, tinted with the rune it crafts.
     *
     * Flat on the panel, five altars ran together: the stats under one altar
     * sat against the subhead of the next with nothing but a hairline between
     * them, and which figures belonged to which altar was a matter of counting
     * down from the last name you read. Boxed, the name band, the upgrades and
     * the four figures are visibly one object, and the rune colour on the edge
     * and the name repeats the colour the runes-per-hour figure already used.
     */
    <section
      className="altar-card"
      aria-label={def.label}
      style={{ ['--altar' as string]: `var(--res-${def.rune})` }}
    >
      <header className="altar-head">
        <h3 className="altar-name">
          <Icon src={ALTAR_ICONS[id]} size={20} />
          {def.label}
        </h3>
        <div className="altar-switches">
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
        </div>
      </header>

      {needsUnlock && !state.unlocked && unlockRow ? (
        // Its own line rather than a third item beside the switches: the bundle
        // runs to several resources and wrapping it into the header pushed the
        // switches around as the cost changed.
        <p className="note altar-line">
          Unlock costs <BundleAmount bundle={unlockRow.remaining} />
        </p>
      ) : null}

      {shown.length === 0 ? (
        // The altar itself stays: its switches and stats are still worth
        // reading once every upgrade on it is bought.
        <p className="note altar-line">All {def.label} upgrades are maxed.</p>
      ) : (
        <div className="scroll-x">
          <table className="rows" role="table" aria-label={`${def.label} upgrades`}>
            {/* The altar grids repeat the same four columns as the essence table
                directly above them, so drawing the header three more times is
                noise — but without one the columns are unlabelled to anyone who
                cannot see that. Present for screen readers only. */}
            <thead className="sr-only" role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">
                  Upgrade
                </th>
                <th role="columnheader" scope="col">
                  Level
                </th>
                {/* Classed like the visible headers so the narrow-screen rule drops
                    it too — otherwise the header count stops matching the body and
                    a screen reader announces each cost cell as "Effect". */}
                <th role="columnheader" scope="col" className="effect">
                  Effect
                </th>
                <th role="columnheader" scope="col">
                  Next / Remaining
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" className={state.unlocked ? undefined : 'locked'}>
              {shown.map(({ row, up }) => (
                <CostRow
                  key={row.id}
                  row={row}
                  max={up.max}
                  group={def.label}
                  onChange={(next) =>
                    update((draft) => {
                      draft.altars[id][up.key] = next;
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dl className="stats">
        <Stat label="Cycle" help="altarCycle" value={formatDuration(outcome.cycleTime)} />
        <Stat
          label="Runes / cycle"
          help="altarRunesPerCycle"
          value={formatNumber(outcome.runesPerCycle, 2)}
        />
        {/* What the altar crafts while it runs, whatever is being mined; an
            altar that is not running crafts nothing. When every altar on this
            essence together wants more than the essence earns, say so here
            rather than quietly shrinking the number. */}
        <Stat
          label={`${RESOURCE_LABELS[def.rune]}s / hr`}
          help="altarRunesPerHour"
          value={
            <>
              <span style={{ color: running ? `var(--res-${def.rune})` : undefined }}>
                {formatNumber(running ? outcome.runesPerHour : 0, 2)}
              </span>
              {overdrawn ? (
                <span className="stat-note">
                  ⚠ Altar drain {formatNumber(pool.altarDrain, 2)}/hr is more than{' '}
                  {ESSENCE_LABELS[def.consumes]} income {formatNumber(pool.essencePerHour, 2)}/hr
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
    </section>
  );
}

const HIDE_MAXED_ALTARS = 'altars.hideMaxed';

export function Altars(props: Props) {
  const [hideMaxed, setHideMaxed] = useState(() => loadViewFlags()[HIDE_MAXED_ALTARS] ?? false);

  // Counted across every altar, since the switch covers the whole tab.
  const maxed = ALTAR_IDS.reduce(
    (total, id) =>
      total +
      props.result.rows.altars[id].filter((row, i) => row.level >= ALTARS[id].upgrades[i]!.max)
        .length,
    0,
  );

  return (
    <TabBody
      help="runeCraftMulti"
      eyebrow={`rune craft ×${formatNumber(props.result.runeCraftMulti, 4)}`}
      actions={
        <Switch
          checked={hideMaxed}
          onChange={(next) => {
            setHideMaxed(next);
            saveViewFlag(HIDE_MAXED_ALTARS, next);
          }}
        >
          Hide maxed{maxed > 0 ? ` (${maxed})` : ''}
        </Switch>
      }
      flush
    >
      <div className="altar-list">
        {ALTAR_IDS.map((id) => (
          <Altar key={id} id={id} hideMaxed={hideMaxed} {...props} />
        ))}
      </div>
    </TabBody>
  );
}

// ----------------------------------------------------------------- spells --

export function Spells({ input, result, update }: Props) {
  return (
    <TabBody
      eyebrow={
        result.derived.spellPower > 0
          ? `runes · spell power +${formatPercent(result.derived.spellPower)}`
          : 'runes'
      }
      flush
    >
      <div className="scroll-x">
        <table className="rows spells" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col">
                Spell
              </th>
              <th role="columnheader" scope="col">
                Level
              </th>
              <th role="columnheader" scope="col">
                Potency
              </th>
              <th role="columnheader" scope="col" className="effect">
                Effects
              </th>
              {/* "Potency" is dropped from the header and left to the help
                  popover, which is titled with it. Spelled out, this header was
                  the widest cell in the table — wider than any cost under it —
                  and on its own worth about 70px of sideways scroll. */}
              <th role="columnheader" scope="col" style={{ textAlign: 'right' }}>
                Next / Remaining <Help id="potencyCost" />
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {SPELL_IDS.map((id) => {
              const def = SPELLS[id];
              const state = input.spells[id];
              const outcome = result.spells[id];
              const row = result.rows.spells.find((r) => r.id === `${id}.potency`)!;

              return (
                <tr role="row" key={id} className={state.unlocked ? undefined : 'locked'}>
                  {/* Name above, toggle and icon below it. Inline, the three of
                      them made this the widest column in the table; stacked, it
                      is only as wide as the name, and the room that frees goes
                      to the effects beside it. */}
                  <td role="cell" className="name">
                    <div className="spell-id">
                      <span className="spell-label">{def.label}</span>
                      <span className="named">
                        <Switch
                          checked={state.unlocked}
                          label={`${def.label} unlocked`}
                          onChange={(next) =>
                            update((draft) => {
                              draft.spells[id].unlocked = next;
                            })
                          }
                        />
                        {/* The spell item once you own it, the buff icon until then. */}
                        <Icon
                          src={state.unlocked ? SPELL_ICONS[id] : SPELL_ACTIVE_ICONS[id]}
                          size={30}
                          dim={!state.unlocked}
                        />
                      </span>
                    </div>
                  </td>
                  <td role="cell" className="ctl" data-label="Level">
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
                  <td role="cell" className="ctl" data-label="Potency">
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
                  <td role="cell" className="effect">
                    {def.primary.label} {formatPercent(outcome.primary)}
                    <br />
                    {def.secondary.label} {formatPercent(outcome.secondary)}
                    {def.secondary.feedsBack ? (
                      <span style={{ color: 'var(--brine)' }}> ↩</span>
                    ) : null}
                    {outcome.levelUpChanceMulti > 1 ? (
                      <span className="submeta" style={{ display: 'block' }}>
                        Level-up chance ×{formatNumber(outcome.levelUpChanceMulti, 3)}
                      </span>
                    ) : null}
                  </td>
                  <td role="cell" className="cost">
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
    </TabBody>
  );
}

// -------------------------------------------------------------- read-outs --

export function Stats({ result }: { result: ArcanistResult }) {
  const s = result.stats;

  /*
   * The crit figures are built from what is printed, not from the engine's full
   * precision.
   *
   * Damage prints whole and the multipliers print to two places, so a reader
   * checking the tiles against each other has only those digits to work with.
   * Off the unrounded stats the answer was a point or two away from that
   * arithmetic — accurate, and reading as a typo. The engine keeps its
   * precision; only this readout rounds first, as the damage tile already did.
   */
  const damage = Math.round(s.damage);
  const critDamage = Number(s.critDamage.toFixed(2));
  const superCritDamage = Number(s.superCritDamage.toFixed(2));
  const ultraCritDamage = Number(s.ultraCritDamage.toFixed(2));

  /*
   * Seven rows of three, grouped the way the game groups them: offence, crit
   * chances, crit multipliers, negates, shiny chances, shiny loot buffs, and
   * brittle on its own. `stats three` fixes the grid at three columns so a row
   * never reflows into the next group.
   */
  return (
    <Section title="Arcanist Stats" eyebrow="derived" flush>
      <StatGrid>
        <Stat label="Damage" help="statDamage" value={formatNumber(damage)} />
        <Stat
          label="Attack Speed"
          help="statAttackInterval"
          value={
            <>
              {/* Two places, as the game prints it: 1.86s, not 1.9s. */}
              {formatNumber(s.attackInterval, 2)}s
              {s.attackSpeed > 0 ? (
                <span className="stat-aside">+{formatPercent(s.attackSpeed)}</span>
              ) : null}
            </>
          }
        />
        <Stat label="Armor Pen" help="statArmorPen" value={formatNumber(s.armorPen)} />

        <Stat label="Crit Chance" help="statCritChance" value={formatPercent(s.critChance)} />
        <Stat label="Super Crit Chance" help="statSuperCrit" value={formatPercent(s.superCritChance)} />
        <Stat label="Ultra Crit Chance" help="statUltraCrit" value={formatPercent(s.ultraCritChance)} />

        {/* The multiplier stays the headline; the hit it produces rides beside
            it, so the Damage stat above has something to be read against. Both
            are pre-armour, as that one is. Each tier compounds the ones below
            it, because a hit only reaches it by passing through them. */}
        <Stat
          label="Crit Damage"
          help="statCritDamage"
          value={
            <>
              ×{formatNumber(critDamage, 2)}
              <span className="stat-aside">{formatNumber(Math.round(damage * critDamage))}</span>
            </>
          }
        />
        <Stat
          label="Super Crit Damage"
          help="statSuperCritDamage"
          value={
            <>
              ×{formatNumber(superCritDamage, 2)}
              <span className="stat-aside">
                {formatNumber(Math.round(damage * critDamage * superCritDamage))}
              </span>
            </>
          }
        />
        <Stat
          label="Ultra Crit Damage"
          help="statUltraCritDamage"
          value={
            <>
              ×{formatNumber(ultraCritDamage, 2)}
              <span className="stat-aside">
                {formatNumber(Math.round(damage * critDamage * superCritDamage * ultraCritDamage))}
              </span>
            </>
          }
        />

        <Stat label="Stun Negate" help="statStunNegate" value={formatPercent(s.stunNegate)} />
        <Stat label="Weaken Negate" help="statWeakenNegate" value={formatPercent(s.weakenNegate)} />
        <Stat label="Daze Negate" help="statDazeNegate" value={formatPercent(s.dazeNegate)} />

        <Stat label="Shiny Chance" help="statShinyChance" value={formatPercent(s.shinyChance)} />
        <Stat
          label="Super Shiny Chance"
          help="statSuperShiny"
          value={formatPercent(s.superShinyChance)}
        />
        <Stat
          label="Ultra Shiny Chance"
          help="statUltraShiny"
          value={formatPercent(s.ultraShinyChance)}
        />

        <Stat label="Shiny Loot Buff" help="statShinyBonus" value={`+${formatNumber(s.shinyBonus)}`} />
        <Stat
          label="Super Shiny Loot Buff"
          help="statSuperShinyBonus"
          value={`+${formatNumber(s.superShinyBonus)}`}
        />
        <Stat
          label="Ultra Shiny Loot Buff"
          help="statUltraShinyBonus"
          value={`+${formatNumber(s.ultraShinyBonus)}`}
        />

        <Stat
          label="Brittle Chance"
          help="statBrittleChance"
          value={formatPercent(s.brittleChance)}
        />
      </StatGrid>
    </Section>
  );
}

/**
 * The stats grid, with its last row filled out.
 *
 * The 1px gaps are the panel's own background showing through, so a row that
 * ends early left a lighter grey block where the missing tiles would be. The
 * fillers are counted rather than written out, so adding a stat cannot leave
 * the block behind again.
 */
function StatGrid({ children }: { children: ReactNode }) {
  const shown = Children.count(children);
  const missing = (3 - (shown % 3)) % 3;

  return (
    <dl className="stats three">
      {children}
      {Array.from({ length: missing }, (_, i) => (
        <div key={i} className="stat" aria-hidden="true" />
      ))}
    </dl>
  );
}

