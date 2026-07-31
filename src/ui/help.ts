/**
 * The glossary behind every "?" in the UI.
 *
 * Data, not prose in components: an explanation lives next to the other
 * explanations so the whole vocabulary can be read and kept consistent in one
 * place, and a label that gains a "?" only needs an entry added here.
 *
 * `formula` is optional and only present where the shape of the calculation is
 * the answer. It is written the way the engine computes it, not the way the
 * source workbook spelled it, so it stays checkable against `engine.ts`.
 */

export interface HelpEntry {
  /** Heading of the popover. Usually the label it sits beside. */
  title: string;
  /** Paragraphs, split on blank lines when rendered. */
  body: string;
  /** How it is worked out, when that is the useful part. */
  formula?: string;
}

export const HELP = {
  // ------------------------------------------------------------- cost columns

  nextRemaining: {
    title: 'Next / Remaining',
    body: 'The left number buys exactly one more level — the decision in front of you right now. The right number is what\'s left to max it.',
  },
  potencyCost: {
    title: 'Potency next / remaining',
    body: 'Runes to raise this spell\'s potency by one rank, then runes to carry it to rank 10. Each spell requires one rune type only, and the cost multiplies by 1.25 every rank.\n\nSpell level and potency are priced separately; only potency is priced here.',
  },

  // ------------------------------------------------------------------ ledger

  ledgerNet: {
    title: 'Net essence / hour',
    body: 'What actually lands in your satchel for this essence: everything you mine, minus everything the altars burn. This is the number the whole page exists to move.\n\nA negative net means the altars drawing on this essence consume faster than you can mine it, and the pool drains. That can still be the right call if the runes are worth more to you than the essence, but it is not sustainable indefinitely.',
    formula: 'net = income − altar drain',
  },
  ledgerIncome: {
    title: 'Income',
    body: 'Essence per hour from mining this essence block, before any altar spends it. It is the mined block rate multiplied by the average loot an essence block drops, including the bonus loot that shiny procs add.',
    formula: 'income = blocks mined/hr × average loot per essence block',
  },
  ledgerDrain: {
    title: 'Altar drain',
    body: 'Essence per hour consumed by every altar that is unlocked and running on this essence. Ash and Brine altars both draw on Soft essence, Chasm draws on Dense, and nothing draws on Jagged.\n\nAn altar that is unlocked but not running drains nothing and produces nothing.',
  },
  ledgerBlocks: {
    title: 'Essence blocks / hour',
    body: 'How many of this essence block you mine in an hour. One mined block takes the time it takes for you to mine through the block\'s health plus its respawn delay, so past a certain point extra damage stops helping much — respawn becomes the floor.',
    formula: 'mined blocks/hr = 3600 ÷ (time to mine + respawn)',
  },

  // ------------------------------------------------------------------ altars

  altarCycle: {
    title: 'Cycle',
    body: 'How long one trip of the altar takes. Travel Speed shortens it by 5% of the base per level. Shorter cycles mean more runes per hour and more essence used per hour, in the same proportion.',
    formula: 'cycle = base × (1 − 0.05 × travel) × 2',
  },
  altarRunesPerCycle: {
    title: 'Runes per cycle',
    body: 'Runes produced by one trip. Capacity sets how much essence the altar carries per trip, and Rune Craft plus the global Rune Craft Multi set how many runes each unit of essence becomes.',
  },
  altarRunesPerHour: {
    title: 'Runes per hour',
    body: 'Runes per cycle spread over an hour of cycles. Only counted while the altar is both unlocked and running.',
    formula: 'runes/hr = runes per cycle × 3600 ÷ cycle',
  },
  altarEssencePerHour: {
    title: 'Essence per hour (altar)',
    body: 'What this altar costs you per hour while it runs, taken out of the essence it draws on. This is the drain side of the Net figure at the top of the page.\n\nCapacity and cycle time appear in both this number and the rune output and cancel out, so tuning one altar does not change its exchange rate — it only changes how fast it trades.',
  },
  runeCraftMulti: {
    title: 'Rune craft multiplier',
    body: 'A single multiplier applied to every altar\'s rune output, gathered from outside the altar itself: the Arcanist store bundle, the Rune Craft contract, the Exchange upgrade, and Prismism\'s potency.\n\nBecause it multiplies all three altars at once, it is usually the highest-leverage thing on the page for runes.',
  },

  // --------------------------------------------------------------- stats box

  statDamage: {
    title: 'Damage',
    body: 'Your nominal hit before essence block armour. Essence block armour is subtracted from it and crits multiply it, so what actually lands is the Damage per hit figure under Show the math.',
  },
  statAttackInterval: {
    title: 'Attack every',
    body: 'Seconds between your attacks. Combined with damage per hit, this sets how fast you mine an essence block.',
  },
  statCritChance: {
    title: 'Crit chance',
    body: 'Chance for a hit to crit. Crits, super crits and ultra crits are checked in sequence, and the expected damage multiplier that falls out of that ladder is the Crit tier table under Show the math.',
  },
  statCritDamage: {
    title: 'Crit damage',
    body: 'Multiplier applied when a hit crits. A crit that also super crits multiplies again, which is why the expected multiplier is worth more than this number alone suggests.',
  },
  statSuperCrit: {
    title: 'Super crit',
    body: 'Chance for a hit that already crit to crit a second time. It is conditional, not independent — a hit that never crit cannot super crit.',
  },
  statSuperCritDamage: {
    title: 'Super crit damage',
    body: 'Multiplier stacked on top of the crit multiplier when a hit super crits.',
  },
  statArmorPen: {
    title: 'Armour penetration',
    body: 'Flat armour ignored on every hit. Essence block armour is subtracted from your damage before anything else, so against a heavily armoured essence a point of penetration can be worth far more than a point of damage.',
  },
  statStunNegate: {
    title: 'Stun negate',
    body: 'Chance to shrug off the essence block\'s stun. A stun costs you attack time, so negating it raises your effective mine rate without touching damage at all.',
  },
  statShinyChance: {
    title: 'Shiny chance',
    body: 'Chance for a mined essence block to drop bonus loot. Super shiny is rolled on top of it, so the expected bonus per mined essence block is the Shiny proc table under Show the math rather than this number times the bonus.',
  },
  statShinyBonus: {
    title: 'Shiny bonus',
    body: 'Extra essence a shiny essence block drops, on top of its normal roll.',
  },
  statSuperShiny: {
    title: 'Super shiny',
    body: 'Chance for a mined essence block that already went shiny to go shiny again, dropping the bonus a second time. Fed mostly by world quests, gilded statues and the Rhino card.',
  },
  statBrittleChance: {
    title: 'Brittle chance',
    body: 'Chance for a mined essence block to leave the next essence block brittle, so it needs less than its nominal health. It shows up as the expected health fraction under Show the math and as brittle essence blocks per hour.',
  },

  // -------------------------------------------------------- show the math --

  mathShinyTable: {
    title: 'Shiny proc table',
    body: 'Every way one block\'s loot roll can turn out, with the chance of each and the bonus loot it adds. The rows are exclusive and their chances sum to one.\n\nThe last line is the average across all of them — that is the number the income calculation actually uses, not the headline shiny chance.',
  },
  mathCritTable: {
    title: 'Crit tier table',
    body: 'The crit ladder resolved into exclusive outcomes: no crit, crit, crit and super crit, and so on, each with its damage multiplier.\n\nThe average at the bottom is your real expected damage multiplier, which is what damage per hit is built on.',
  },
  mathBrittleTable: {
    title: 'Brittle table',
    body: 'How much of a block\'s nominal health you actually have to work through, weighted by how often it is brittle. A value below 1 means the average block breaks to less damage than its health bar claims.',
  },
  mathHealth: {
    title: 'Health',
    body: 'The essence block\'s health. A game constant — no upgrade on this page changes it.',
  },
  mathArmor: {
    title: 'Armour (after pen)',
    body: 'What is left of the block\'s armour once your penetration is subtracted, shown against the full value. Armour comes off every hit before crits are applied, so if it meets or beats your damage you cannot mine this essence at all, no matter how fast you attack.',
  },
  mathStun: {
    title: 'Average stun factor',
    body: 'The share of your attack time that survives the block\'s stuns, after your stun negation. 1 means you are never stunned; lower means some of your attacks never happen.',
  },
  mathWeaken: {
    title: 'Average weaken factor',
    body: 'The average multiplier the block\'s weaken debuff applies to your damage, weighted by how often it lands and how long it lasts. Below 1 means you are weakened some of the time.',
  },
  mathRegen: {
    title: 'Regen per hit',
    body: 'Health the block regenerates, expressed per attack of yours so it can be set directly against your damage. If it matches your damage after armour, the block repairs itself as fast as you break it and never yields.',
  },
  mathDamagePerHit: {
    title: 'Damage per hit',
    body: 'What one hit really takes off a block: your damage less its armour, scaled by the expected crit multiplier and the weaken factor, less the health it regenerates back.',
    formula: 'per hit = (damage − armour) × crit multi × weaken − regen',
  },
  mathHitsToMine: {
    title: 'Hits to mine',
    body: 'Attacks needed to break one block, using the brittle-adjusted health rather than the nominal figure. A dash means the block regenerates faster than you break it and the count is infinite.',
    formula: 'hits = health × brittle multi ÷ damage per hit',
  },
  mathTimeToMine: {
    title: 'Time to mine',
    body: 'Hits to mine spread over your attack interval, stretched by the time stuns take away from you.',
    formula: 'time = hits × attack interval ÷ stun factor',
  },
  mathRespawn: {
    title: 'Respawn',
    body: 'Idle time between one block breaking and the next appearing. A game constant, and the hard ceiling on blocks per hour — once time to mine is small next to respawn, more damage buys you almost nothing.',
  },
  mathLootRange: {
    title: 'Loot range',
    body: 'The minimum and maximum essence a single ordinary block can drop, after the Max Loot upgrades, cards and pet skin have been applied.',
  },
  mathAvgLoot: {
    title: 'Average loot (with shiny)',
    body: 'The mean of the loot range plus the expected shiny bonus from the table above. This is the per-block figure income is built from.',
  },
  mathBlocksPerHour: {
    title: 'Blocks / hour',
    body: 'One hour divided by a full mining cycle — the time to break a block plus the time to wait for the next one to appear.',
    formula: 'blocks/hr = 3600 ÷ (time to mine + respawn)',
  },
  mathBrittleBlocks: {
    title: 'Brittle blocks / hour',
    body: 'How many of those blocks were left brittle by the one before. Shown separately because it is the part of your mining rate that brittle chance is buying.',
  },
  mathEssencePerHour: {
    title: 'Essence / hour',
    body: 'Gross essence income for this essence, before any altar spends it.',
    formula: 'essence/hr = blocks/hr × average loot',
  },
  mathAltarDrain: {
    title: 'Altar drain / hour',
    body: 'Essence per hour taken out of this essence by running altars. Ash and Brine draw on Soft, Chasm draws on Dense, Jagged is never drained.',
  },
  mathNet: {
    title: 'Net / hour',
    body: 'Income less drain — the same figure as the headline at the top of the page, shown here at the end of the derivation that produced it.',
  },

  // --------------------------------------------------------------- panels --

  optimizer: {
    title: 'Optimizer',
    body: 'What one more level of each upgrade is worth, measured by buying it, recomputing the whole model, and diffing the result. Nothing here is estimated.\n\nThere are two lists because there are two goals and they do not always agree — altar throughput buys runes with essence, so an upgrade can be near the top of one list and negative on the other. Within a list, upgrades are grouped by the resource they cost, since a pile of white orbs cannot buy a rune upgrade.',
  },
  potencyPath: {
    title: 'Spell potency path',
    body: 'The order to raise spell potencies in, and when you will be able to afford each one at your current rune income.\n\nIt is a simulation, not a sorted list: it starts from your build with nothing banked, waits until the next rank is affordable, buys it, then recomputes. Because Prismism\'s potency raises the Rune Craft multiplier, buying it early speeds up everything after it — so it moves to the front on its own rather than by a rule.\n\nThe three rune types bank in parallel, so a step waiting on brine runes does not hold up one waiting on ash.',
  },
  potencyEta: {
    title: 'Time to afford',
    body: 'Hours from now until you can pay for this rank, assuming you bank every rune your altars produce and spend them only on this plan.\n\nIt is a floor, not a forecast. Casting spells, altar upgrades and rune unlocks all compete for the same runes, and the model does not know about the ones you have already stockpiled.',
  },
  potencyTotal: {
    title: 'Time to finish',
    body: 'When the last rank in the plan is bought — the length of the whole path, not the sum of its steps, because the three rune types accumulate at the same time.',
  },
  exchange: {
    title: 'Exchange',
    body: 'Only the two Exchange upgrades that change an Arcanist number are listed: Essence Damage Per Arcane Card, which grants flat damage equal to your Arcane card count, and the Rune Craft Multiplier, which lifts every altar\'s output.\n\nThe Exchange sells eleven more. They are real upgrades, but none of them touch anything on this page, so listing them would only suggest they did.',
  },
  totalsPanel: {
    title: 'Total resources',
    body: 'Everything still owed to max every priced upgrade on the page, and what those upgrades cost end to end.\n\nOnly resources something can actually cost appear. Exchange upgrades carry no prices — the workbook\'s figures for them were invented rather than observed — so the resources only they consumed are absent instead of sitting at a misleading zero.',
  },
} as const satisfies Record<string, HelpEntry>;

export type HelpId = keyof typeof HELP;
