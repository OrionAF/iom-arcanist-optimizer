/**
 * Golden test: computing from the workbook's own input values must reproduce
 * the workbook's own cached results.
 *
 * This is what makes a ~120-quantity hand transcription trustworthy. Each
 * assertion names the Arcanist cell it mirrors, so a failure points straight at
 * the source. Comparison is relative (1e-9) because the engine uses closed-form
 * geometric sums where the sheet uses a running SUMPRODUCT.
 */

import { describe, expect, it } from 'vitest';

import { compute } from './engine';
import { curveCost } from './costs';
import { formatCompact, formatShortScale } from './format';
import { EXAMPLE_INPUT } from '../presets/example';
import { FRESH_INPUT } from '../presets/fresh';
import fixture from './__fixtures__/arcanist-sheet.json';

const cells = fixture.cells as Record<string, { v: number | string | boolean | null; f?: string }>;

/** The cached value of an Arcanist cell, as a number. */
function sheet(ref: string): number {
  const cell = cells[ref];
  if (!cell) throw new Error(`Fixture has no cell ${ref}`);
  const value = typeof cell.v === 'string' ? Number(cell.v) : cell.v;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Cell ${ref} is not numeric: ${JSON.stringify(cell.v)}`);
  }
  return value;
}

function expectMatchesSheet(actual: number, ref: string, label: string): void {
  const expected = sheet(ref);
  const tolerance = Math.max(Math.abs(expected) * 1e-9, 1e-9);
  expect(actual, `${label} (${ref})`).toBeCloseTo(expected, -Math.log10(tolerance));
}

const result = compute(EXAMPLE_INPUT);

describe('stats panel (M2:N17)', () => {
  const cases = [
    { label: 'Damage', ref: 'N3', actual: result.stats.damage },
    { label: 'Attack Speed', ref: 'N4', actual: result.stats.attackInterval },
    { label: 'Crit Chance', ref: 'N5', actual: result.stats.critChance },
    { label: 'Crit Damage', ref: 'N6', actual: result.stats.critDamage },
    { label: 'Super Crit Chance', ref: 'N7', actual: result.stats.superCritChance },
    { label: 'Super Crit Damage', ref: 'N8', actual: result.stats.superCritDamage },
    { label: 'Ultra Crit Chance', ref: 'N9', actual: result.stats.ultraCritChance },
    { label: 'Ultra Crit Damage', ref: 'N10', actual: result.stats.ultraCritDamage },
    { label: 'Armor Pen', ref: 'N11', actual: result.stats.armorPen },
    { label: 'Stun Negate Chance', ref: 'N12', actual: result.stats.stunNegate },
    { label: 'Essence Shiny Chance', ref: 'N13', actual: result.stats.shinyChance },
    { label: 'Essence Shiny Bonus', ref: 'N14', actual: result.stats.shinyBonus },
    { label: 'Super Shiny Chance', ref: 'N15', actual: result.stats.superShinyChance },
    { label: 'Super Shiny Bonus', ref: 'N16', actual: result.stats.superShinyBonus },
    { label: 'Brittle Chance', ref: 'N17', actual: result.stats.brittleChance },
  ];

  it.each(cases)('$label matches $ref', ({ actual, ref, label }) => {
    expectMatchesSheet(actual, ref, label);
  });
});

describe('probability tables (Y3:AA33)', () => {
  it('shiny weights match Z4:Z6 / AA4:AA6', () => {
    const [normal, shiny, superShiny] = result.averages.shinyTable;
    expectMatchesSheet(normal!.chance, 'Z4', 'normal chance');
    expectMatchesSheet(shiny!.chance, 'Z5', 'shiny chance');
    expectMatchesSheet(shiny!.value, 'AA5', 'shiny bonus');
    expectMatchesSheet(superShiny!.chance, 'Z6', 'super shiny chance');
    expectMatchesSheet(superShiny!.value, 'AA6', 'super shiny bonus');
  });

  it('crit weights match Z16:Z19 / AA16:AA19', () => {
    const [noCrit, crit, superCrit, ultraCrit] = result.averages.critTable;
    expectMatchesSheet(noCrit!.chance, 'Z16', 'no crit chance');
    expectMatchesSheet(crit!.chance, 'Z17', 'crit chance');
    expectMatchesSheet(crit!.value, 'AA17', 'crit multi');
    expectMatchesSheet(superCrit!.chance, 'Z18', 'super crit chance');
    expectMatchesSheet(superCrit!.value, 'AA18', 'super crit multi');
    expectMatchesSheet(ultraCrit!.chance, 'Z19', 'ultra crit chance');
    expectMatchesSheet(ultraCrit!.value, 'AA19', 'ultra crit multi');
  });

  it('weighted averages match Z10, Z23, Z33', () => {
    expectMatchesSheet(result.averages.shinyBonus, 'Z10', 'avg shiny bonus');
    expectMatchesSheet(result.averages.critMult, 'Z23', 'avg crit multi');
    expectMatchesSheet(result.averages.brittleMult, 'Z33', 'avg brittle multi');
  });
});

describe('per-essence combat (AB3:AJ22, V9:X13)', () => {
  const columns = {
    soft: { armor: 'AC11', min: 'AC4', max: 'AC5', stun: 'AC15', weaken: 'AC22', heal: 'AC18' },
    dense: { armor: 'AF11', min: 'AF4', max: 'AF5', stun: 'AF15', weaken: 'AF22', heal: 'AF18' },
    jagged: { armor: 'AI11', min: 'AI4', max: 'AI5', stun: 'AI15', weaken: 'AI22', heal: 'AI18' },
  } as const;

  for (const [type, refs] of Object.entries(columns) as [
    keyof typeof columns,
    (typeof columns)[keyof typeof columns],
  ][]) {
    it(`${type}: enemy stats after mitigation`, () => {
      const outcome = result.essence[type];
      expectMatchesSheet(outcome.armor, refs.armor, `${type} armor`);
      expectMatchesSheet(outcome.minLoot, refs.min, `${type} min loot`);
      expectMatchesSheet(outcome.maxLoot, refs.max, `${type} max loot`);
      expectMatchesSheet(outcome.avgStun, refs.stun, `${type} avg stun`);
      expectMatchesSheet(outcome.avgWeaken, refs.weaken, `${type} avg weaken`);
      expectMatchesSheet(outcome.avgHeal, refs.heal, `${type} avg heal`);
    });
  }

  it('soft: kill cycle and yield (AD3:AD5, W11, X11, Y11)', () => {
    const soft = result.essence.soft;
    expectMatchesSheet(soft.hitsToKill, 'AD3', 'soft hits to kill');
    expectMatchesSheet(soft.timeToKill, 'AD4', 'soft time to kill');
    expectMatchesSheet(soft.cycleTime, 'AD5', 'soft cycle time');
    expectMatchesSheet(soft.killsPerHour, 'W11', 'soft kills/hr');
    expectMatchesSheet(soft.trueLootAvg, 'AC9', 'soft true loot avg');
    expectMatchesSheet(soft.essencePerHour, 'X11', 'soft essence/hr');
    expectMatchesSheet(soft.brittleKillsPerHour, 'Y11', 'soft brittle kills/hr');
  });

  it('dense: kill cycle and yield (AG3:AG5, W12, X12, Y12)', () => {
    const dense = result.essence.dense;
    expectMatchesSheet(dense.hitsToKill, 'AG3', 'dense hits to kill');
    expectMatchesSheet(dense.timeToKill, 'AG4', 'dense time to kill');
    expectMatchesSheet(dense.cycleTime, 'AG5', 'dense cycle time');
    expectMatchesSheet(dense.killsPerHour, 'W12', 'dense kills/hr');
    expectMatchesSheet(dense.trueLootAvg, 'AF9', 'dense true loot avg');
    expectMatchesSheet(dense.essencePerHour, 'X12', 'dense essence/hr');
    expectMatchesSheet(dense.brittleKillsPerHour, 'Y12', 'dense brittle kills/hr');
  });

  it('net essence per hour (P16 for Soft, X28/X29)', () => {
    expectMatchesSheet(result.drain.soft, 'X28', 'soft altar drain');
    expectMatchesSheet(result.drain.dense, 'X29', 'dense altar drain');
    expect(result.drain.jagged, 'no altar consumes Jagged').toBe(0);
    expectMatchesSheet(result.essence.soft.netEssencePerHour, 'P16', 'net soft essence/hr');
  });

  /**
   * The sheet's AJ3 subtracts the empty cell AI1 instead of AI18 (Jagged avg
   * heal), so Jagged reads 82 hits where the corrected math gives 84. Assert the
   * corrected value AND that it really does differ from the sheet, so this stays
   * an intentional deviation rather than a silent transcription slip.
   */
  it('jagged: corrected for the AJ3 heal-reference bug', () => {
    const jagged = result.essence.jagged;
    expect(jagged.hitsToKill).toBe(84);
    expect(sheet('AJ3'), 'sheet still has the buggy value').toBe(82);
    expectMatchesSheet(jagged.armor, 'AI11', 'jagged armor');
    expectMatchesSheet(jagged.avgStun, 'AI15', 'jagged avg stun');
    expectMatchesSheet(jagged.avgWeaken, 'AI22', 'jagged avg weaken');
    // Downstream values inherit the correction.
    expect(jagged.timeToKill).toBe(168);
    expect(jagged.cycleTime).toBe(183);
  });
});

describe('altars (I29:L41, U27:X30)', () => {
  it('rune craft multiplier matches Statmath!C372', () => {
    expect(result.runeCraftMulti).toBeCloseTo(1.28412, 9);
  });

  const cases = [
    { id: 'ash', cycle: 'I29', perCycle: 'J29', perHour: 'K29', cost: 'L29' },
    { id: 'brine', cycle: 'I34', perCycle: 'J34', perHour: 'K34', cost: 'L34' },
    { id: 'chasm', cycle: 'I39', perCycle: 'J39', perHour: 'K39', cost: 'L39' },
  ] as const;

  it.each(cases)('$id altar output', ({ id, cycle, perCycle, perHour, cost }) => {
    const altar = result.altars[id];
    expectMatchesSheet(altar.cycleTime, cycle, `${id} cycle time`);
    expectMatchesSheet(altar.runesPerCycle, perCycle, `${id} runes/cycle`);
    expectMatchesSheet(altar.runesPerHour, perHour, `${id} runes/hr`);
    expectMatchesSheet(altar.essenceCostPerHour, cost, `${id} essence cost/hr`);
  });
});

describe('spells (E45:L66)', () => {
  const cases = [
    { id: 'runicSurge', secondary: 'E46', duration: 'L45', potency: 'G45' },
    { id: 'rainbowRift', primary: 'E49', secondary: 'E50', duration: 'L49', potency: 'G49' },
    { id: 'manaflow', primary: 'E53', secondary: 'E54', duration: 'L53', potency: 'G53' },
    { id: 'radiancy', primary: 'E57', secondary: 'E58', duration: 'L57', potency: 'G57' },
    { id: 'prismism', primary: 'E61', secondary: 'E62', duration: 'L61', potency: 'G61' },
  ] as const;

  it.each(cases)('$id effects, duration and potency cost', (spell) => {
    const outcome = result.spells[spell.id];
    if ('primary' in spell) {
      expectMatchesSheet(outcome.primary, spell.primary, `${spell.id} primary`);
    }
    expectMatchesSheet(outcome.secondary, spell.secondary, `${spell.id} secondary`);
    expectMatchesSheet(outcome.duration, spell.duration, `${spell.id} duration`);
    expectMatchesSheet(outcome.potencyCostRemaining, spell.potency, `${spell.id} potency cost`);
  });

  /**
   * Runic Surge's primary (E45) nests the pet bonus inside the rank term, unlike
   * the other five spells. Normalised to the majority form, so it differs.
   */
  it('runicSurge primary is normalised away from the E45 nesting', () => {
    expect(result.spells.runicSurge.primary).toBeCloseTo(0.4455, 9);
    expect(sheet('E45')).toBeCloseTo(0.4455, 9);
    // With no pet potency bonus the two forms coincide; prove they diverge when it is non-zero.
    const withPet = compute({
      ...EXAMPLE_INPUT,
      external: { ...EXAMPLE_INPUT.external, petSpellPotency: 0.1 },
    });
    const sheetForm = 0.15 * 1.2 * (1 + 13 * 0.05) * (1 + 10 * 0.05 * 1.1);
    expect(withPet.spells.runicSurge.primary).not.toBeCloseTo(sheetForm, 6);
  });

  /**
   * Veinboyant is locked (A64 = 0) yet the sheet's E66 still grants 0.15 Rune
   * Craft Multi because the secondary effects lack an unlock guard.
   */
  it('locked spells grant nothing, unlike the sheet', () => {
    expect(result.spells.veinboyant.unlocked).toBe(false);
    expect(result.spells.veinboyant.primary).toBe(0);
    expect(result.spells.veinboyant.secondary).toBe(0);
    expect(sheet('E66'), 'sheet leaks the locked effect').toBeCloseTo(0.15, 9);
  });
});

describe('total resource costs (A87:C110)', () => {
  const cases = [
    ['whiteOrb', 'C89'],
    ['greenOrb', 'C90'],
    ['purpleOrb', 'C91'],
    ['orangeOrb', 'C92'],
    ['redOrb', 'C93'],
    ['ashRune', 'C95'],
    ['brineRune', 'C96'],
    ['chasmRune', 'C97'],
    ['softEssence', 'C99'],
    ['denseEssence', 'C100'],
    ['stoneVein', 'C102'],
    ['scorpioStar', 'C104'],
    ['lynxStar', 'C105'],
    ['aquariusStar', 'C106'],
    ['superstars', 'C107'],
    ['prestigePoints', 'C109'],
    ['blueCow', 'C110'],
  ] as const;

  it.each(cases)('%s remaining matches %s', (resource, ref) => {
    expectMatchesSheet(result.totals.remaining[resource], ref, `${resource} remaining`);
  });
});

describe('completion (K87:L99)', () => {
  const cases = [
    { label: 'essence upgrades', ref: 'K89', actual: result.completion.rows[0]!.current },
    { label: 'essence upgrades max', ref: 'L89', actual: result.completion.rows[0]!.max },
    { label: 'altar upgrades', ref: 'K91', actual: result.completion.rows[1]!.current },
    { label: 'altar upgrades max', ref: 'L91', actual: result.completion.rows[1]!.max },
    { label: 'spell levels', ref: 'K93', actual: result.completion.rows[2]!.current },
    { label: 'spell levels max', ref: 'L93', actual: result.completion.rows[2]!.max },
    { label: 'potency ranks', ref: 'K95', actual: result.completion.rows[3]!.current },
    { label: 'potency ranks max', ref: 'L95', actual: result.completion.rows[3]!.max },
    { label: 'exchange upgrades', ref: 'K97', actual: result.completion.rows[4]!.current },
    { label: 'exchange upgrades max', ref: 'L97', actual: result.completion.rows[4]!.max },
    { label: 'total', ref: 'K99', actual: result.completion.current },
    { label: 'total max', ref: 'L99', actual: result.completion.max },
  ];

  it.each(cases)('$label matches $ref', ({ actual, ref, label }) => {
    expectMatchesSheet(actual, ref, label);
  });
});

describe('per-row costs match the sheet cell for cell', () => {
  /** Cost Remaining cells (column G) for every row with a curve-based cost. */
  const essenceRows: [string, string][] = [
    ['flatDamage1', 'G5'],
    ['softMaxLoot', 'G6'],
    ['shinyChance1', 'G7'],
    ['critChance1', 'G8'],
    ['flatDamage2', 'G10'],
    ['denseMaxLoot', 'G12'],
    ['armorPen', 'G13'],
    ['superCrit1', 'G14'],
    ['flatDamage3', 'G16'],
    ['damagePct', 'G18'],
    ['shinyLoot', 'G19'],
    ['shinyChance2', 'G20'],
    ['critChance2', 'G22'],
    ['jaggedLoot', 'G24'],
  ];

  it.each(essenceRows)('essence %s matches %s', (id, ref) => {
    const row = result.rows.essence.find((r) => r.id === id);
    const amount = Object.values(row!.remaining)[0] ?? 0;
    expectMatchesSheet(amount, ref, `${id} cost remaining`);
  });

  const exchangeRows: [string, string][] = [
    ['exchangeTimer', 'G70'],
    ['arcaneCardDamage', 'G71'],
    ['rainbowFloorMulti', 'G72'],
    ['lootbugBankedCap', 'G73'],
    ['goldenPortalChance', 'G74'],
    ['starSupergiantMulti', 'G75'],
    ['wizardLootMulti', 'G76'],
    ['geminiStarCap', 'G77'],
    ['unlockVeinboyant', 'G78'],
    ['prismaticFloorChance', 'G79'],
    ['shinyFishMulti', 'G80'],
    ['runeCraftMulti', 'G81'],
  ];

  it.each(exchangeRows)('exchange %s matches %s', (id, ref) => {
    const row = result.rows.exchange.find((r) => r.id === id);
    const amount = Object.values(row!.remaining)[0] ?? 0;
    expectMatchesSheet(amount, ref, `${id} cost remaining`);
  });

  const altarRows: [string, string, string][] = [
    ['ash', 'capacity', 'G29'],
    ['ash', 'travel', 'G30'],
    ['ash', 'craft', 'G31'],
    ['brine', 'capacity', 'G34'],
    ['brine', 'travel', 'G35'],
    ['brine', 'craft', 'G36'],
    ['chasm', 'capacity', 'G39'],
    ['chasm', 'travel', 'G40'],
  ];

  it.each(altarRows)('altar %s %s matches %s', (altar, key, ref) => {
    const row = result.rows.altars[altar as 'ash'].find((r) => r.id === `${altar}.${key}`);
    const amount = Object.values(row!.remaining)[0] ?? 0;
    expectMatchesSheet(amount, ref, `${altar} ${key} cost remaining`);
  });

  it('total costs (column H) match where the sheet stores them', () => {
    const flatDamage1 = result.rows.essence.find((r) => r.id === 'flatDamage1');
    expect(flatDamage1!.total.whiteOrb).toBeCloseTo(471.98108322034466, 6);
    const armorPen = result.rows.essence.find((r) => r.id === 'armorPen');
    expect(armorPen!.total.purpleOrb).toBe(75);
    const timer = result.rows.exchange.find((r) => r.id === 'exchangeTimer');
    expect(timer!.total.blueCow).toBe(232500);
  });
});

describe('cost curves', () => {
  it('closed form matches a running sum', () => {
    const runningGeometric = (base: number, ratio: number, from: number, to: number) => {
      let sum = 0;
      for (let i = from + 1; i <= to; i += 1) sum += base * ratio ** (i - 1);
      return sum;
    };
    expect(curveCost({ kind: 'geometric', base: 1, ratio: 1.2 }, 17, 25)).toBeCloseTo(
      runningGeometric(1, 1.2, 17, 25),
      9,
    );
    expect(curveCost({ kind: 'arithmetic', first: 500, step: 500 }, 15, 30)).toBe(172500);
    expect(curveCost({ kind: 'arithmetic', first: 3, step: 0 }, 8, 25)).toBe(51);
  });

  it('is zero at or past max', () => {
    expect(curveCost({ kind: 'geometric', base: 5, ratio: 1.3 }, 10, 10)).toBe(0);
    expect(curveCost({ kind: 'geometric', base: 5, ratio: 1.3 }, 12, 10)).toBe(0);
  });
});

describe('formatting', () => {
  it('matches the sheet short-scale style', () => {
    expect(formatShortScale(1726.8254497711916)).toBe('1.73 Thousand');
    expect(formatShortScale(276451.64011217502)).toBe('276.45 Thousand');
    expect(formatShortScale(3.8629497283000019e26)).toBe('386.29 Septillion');
    expect(formatShortScale(521.31628686712111)).toBe('521.32');
    expect(formatShortScale(0)).toBe('0');
  });

  it('produces compact suffixes', () => {
    expect(formatCompact(1726.82)).toBe('1.73K');
    expect(formatCompact(232500)).toBe('232.5K');
  });
});

describe('fresh preset', () => {
  const fresh = compute(FRESH_INPUT);

  it('is a coherent starting state', () => {
    expect(fresh.stats.damage).toBe(10);
    expect(fresh.completion.current).toBe(0);
    expect(fresh.completion.max).toBe(1048);
    expect(fresh.drain.soft).toBe(0);
  });

  it('still kills soft essence with base damage', () => {
    expect(fresh.essence.soft.unkillable).toBe(false);
    expect(fresh.essence.soft.killsPerHour).toBeGreaterThan(0);
  });

  it('reports jagged as unkillable when damage cannot beat armour and healing', () => {
    // Base damage 10, jagged armour 10 -> zero effective damage.
    expect(fresh.essence.jagged.unkillable).toBe(true);
    expect(fresh.essence.jagged.killsPerHour).toBe(0);
    expect(fresh.essence.jagged.essencePerHour).toBe(0);
  });

  it('charges the full cost of everything', () => {
    expect(fresh.totals.remaining.whiteOrb).toBeCloseTo(
      compute(FRESH_INPUT).totals.total.whiteOrb,
      6,
    );
  });
});
