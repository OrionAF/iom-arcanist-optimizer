/**
 * The glossary behind every "?" in the UI.
 *
 * Data, not prose in components: an explanation lives next to the other
 * explanations so the whole vocabulary can be read and kept consistent in one
 * place, and a label that gains a "?" only needs an entry added here.
 *
 * `formula` is optional and only present where the shape of the calculation is
 * the answer. It is written the way the engine computes it, so it stays
 * checkable against `engine.ts`.
 */

export interface HelpEntry {
  /** Heading of the popover. Usually the label it sits beside. */
  title: string;
  /** Paragraphs, split on blank lines when rendered. */
  body: string;
  /** How it is worked out, when that is the useful part. */
  formula?: string;
  /** Other entries this one leans on, offered as links inside the popover. */
  see?: readonly string[];
}

export const HELP = {
  // ------------------------------------------------------------- cost columns

  nextRemaining: {
    title: 'Next / Remaining',
    body: 'The left number is the cost of exactly one more level — the decision in front of you right now. The right number is the cost to max it out.',
  },
  potencyCost: {
    title: 'Potency next / remaining',
    body: 'Runes to raise this spell\'s potency by one rank, then runes to carry it to rank 10. Each spell requires one rune type only, and the cost is multiplied by 1.25 every rank.\n\nEach potency rank adds 5% to the spell\'s effect, its duration and the chance that casting it levels it up. Cast cost does not change.',
  },

  // ------------------------------------------------------------------ ledger

  ledgerNet: {
    title: 'Net / hr',
    body: 'What actually lands in your satchel: everything you mine of this essence, minus everything the altars on it burn.\n\nYou can only mine one essence at a time, so this is a live figure for the one you are mining and a "what if" for the others — click an essence to switch. An essence you are not mining banks nothing, whatever its income says.\n\nFor the essence you are mining it cannot go below zero. If the altars want more than you can mine they stall rather than overdraw the pool: you bank nothing and they run at a reduced rate. For the others it can go negative: that is how much faster the altars would drain than you would mine if you switched.',
    formula: 'net = income − altar drain (never below 0 while mining)',
  },
  ledgerIncome: {
    title: 'Income',
    body: 'Essence per hour from mining this essence, before any altar spends it: blocks mined per hour multiplied by the average loot per block, including the bonus loot from shiny procs.',
    formula: 'income = blocks mined/hr × average loot per essence block',
  },
  ledgerDrain: {
    title: 'Altar drain',
    body: 'Essence per hour consumed by every altar that is unlocked and running on this essence. Ash and Brine altars both draw on Soft essence, Chasm and Drift draw on Dense, Echo draws on Jagged, and nothing draws on Necrotic.\n\nAn altar that is unlocked but not running drains nothing and produces nothing.',
  },
  ledgerLootRange: {
    title: 'Loot / block',
    body: 'What one block pays. The low end is a minimum roll with no shiny; the high end is a maximum roll that also procs ultra shiny, because shiny loot is added on top of the roll rather than being part of it.\n\nThe average beside it is what the hourly figures are built from. It sits wherever the odds put it, not in the middle of the range, because shiny procs are rare and pull the top of the range far above the average.',
    formula: 'income/hr = blocks mined/hr × average loot',
  },
  ledgerBlocks: {
    title: 'Blocks / hr',
    body: 'How many blocks of this essence you mine in an hour. Each block takes as long as it takes you to mine through its health, plus its respawn delay, so past a certain point extra damage stops helping much — respawn becomes the floor.',
    formula: 'mined blocks/hr = 3600 ÷ (time to mine + respawn)',
  },

  // ------------------------------------------------------------------ altars

  altarCycle: {
    title: 'Cycle',
    body: 'How long one trip of the altar takes. Travel Time shortens it by 5% of the base per level. Shorter cycles mean more runes per hour and more essence used per hour, in the same proportion.',
    formula: 'cycle = base × (1 − 0.05 × travel) × 2',
  },
  altarRunesPerCycle: {
    title: 'Runes / cycle',
    body: 'Runes produced by one trip. Capacity sets how much essence the altar carries per trip, and Rune Craft plus the global Rune Craft Multi set how many runes each unit of essence becomes.',
  },
  altarRunesPerHour: {
    title: 'Runes / hr',
    body: 'Runes this altar crafts per hour while it runs, whichever essence you are mining. An altar that is not running crafts nothing.\n\nAn altar stalls when its essence runs out. If every running altar on this essence together drains more per hour than that essence\'s income, a warning appears beneath: the altars will empty the bank and then run only part of the time.',
    formula: 'runes / hr = 3600 ÷ cycle × runes per cycle',
  },
  altarEssencePerHour: {
    title: 'Essence / hr',
    body: 'What this altar costs you per hour while it runs, taken out of the essence it draws on. This is the drain side of the Net figure at the top of the page.\n\nCapacity and cycle time appear in both this number and the rune output and cancel out, so tuning one altar does not change its exchange rate — it only changes how fast it trades.',
  },
  runeCraftMulti: {
    title: 'Rune craft multiplier',
    body: 'A single multiplier applied to every altar\'s rune output, gathered from outside the altar itself: the Arcanist Bundle, the Rune Craft contract, the Exchange upgrade, and Prismism\'s potency. Each source multiplies the others rather than adding to them.\n\nBecause it multiplies every altar at once, it is usually the highest-leverage thing on the page for runes.',
    formula: 'multi = (1 + Prismism) × (1 + Exchange) × (1 + contract) × (1 + bundle)',
  },

  // --------------------------------------------------------------- stats box

  statDamage: {
    title: 'Damage',
    body: 'Your hit before essence block armour: flat damage times the damage percentage, rounded to a whole number (.5 rounds up). Armour comes off it, then crits multiply what is left.',
    formula: 'damage = round((10 + flat) × (1 + damage %))',
  },
  statAttackInterval: {
    title: 'Attack Speed',
    body: 'Seconds between swings, after Attack Speed; the figure beside it is your total Attack Speed bonus. Your swing timer is a bar that fills at 0.5 × (1 + attack speed) per second and swings when full.\n\nDaze halves how fast the bar fills without resetting it, and a stun freezes it until the stun ends.',
    formula: 'interval = 1 ÷ (0.5 × (1 + attack speed))',
  },
  statCritChance: {
    title: 'Crit Chance',
    body: 'Chance for a hit to crit. The game rolls a whole number out of 100, so only the whole percent counts: a 4.7% chance crits 4% of the time, and a 0.25% chance never crits. The Crit tier table under Show the Math uses the chance that actually rolls.',
  },
  statCritDamage: {
    title: 'Crit Damage',
    body: 'Multiplier applied when a hit crits. A crit that also super crits multiplies again, which is why the expected multiplier is worth more than this number alone suggests.\n\nThe figure beside it is what a crit lands for: your nominal Damage times this multiplier, before essence block armour comes off.',
  },
  statSuperCrit: {
    title: 'Super Crit Chance',
    body: 'Chance for a hit that has already crit to crit a second time. It is conditional, not independent: a hit that never crit cannot super crit. Like crit chance, only the whole percent counts.',
  },
  statSuperCritDamage: {
    title: 'Super Crit Damage',
    body: 'Multiplier stacked on top of the crit multiplier when a hit super crits.\n\nThe figure beside it carries both multipliers, because a hit only reaches super crit by having crit first. It is what that hit lands for before essence block armour comes off.',
  },
  statUltraCrit: {
    title: 'Ultra Crit Chance',
    body: 'Chance for a hit that has already super crit to crit a third time, multiplying again. Like super crit, it is conditional, and only the whole percent counts.',
  },
  statArmorPen: {
    title: 'Armor Pen',
    body: 'Flat armour ignored on every hit. What is left of the block\'s armour comes off your damage before crits multiply it, so against a heavily armoured essence a point of penetration can be worth far more than a point of damage. It also softens weaken, which cuts your damage before armour comes off.',
  },
  statStunNegate: {
    title: 'Stun Negate',
    body: 'Every second, the block rolls to stun you; when it succeeds, this is your chance to block the stun outright. The figure includes All Debuff Negate Chance. A stun freezes your swing timer for its full duration, and a new stun resets that duration rather than adding to it.',
  },
  statWeakenNegate: {
    title: 'Weaken Negate',
    body: 'Chance to block a weaken the block has just rolled on you. The figure includes All Debuff Negate Chance. A weakened hit multiplies your damage before armour comes off, so it can cost far more than its multiplier suggests. Only Jagged and Necrotic weaken.',
  },
  statDazeNegate: {
    title: 'Daze Negate',
    body: 'Chance to block a daze the block has just rolled on you. The figure includes All Debuff Negate Chance. Daze halves how fast your swing timer fills for its duration. Only Necrotic dazes.',
  },
  statUltraCritDamage: {
    title: 'Ultra Crit Damage',
    body: 'Multiplier stacked on top of the crit and super crit multipliers when a hit ultra crits.\n\nThe figure beside it carries all three multipliers, because a hit only reaches ultra crit through the other two. It is what that hit lands for before essence block armour comes off.',
  },
  statShinyChance: {
    title: 'Shiny Chance',
    body: 'Chance for an essence block to spawn shiny and drop bonus loot. The game rolls out of 1,000, so only the first decimal of the percent counts. Super shiny is rolled on top of it, so the expected bonus per block comes from the Shiny proc table under Show the Math.',
  },
  statShinyBonus: {
    title: 'Shiny Loot Buff',
    body: 'Extra essence a shiny essence block drops, on top of its normal roll. All Shiny Essence Loot adds to this and to the super and ultra shiny buffs alike.',
  },
  statSuperShinyBonus: {
    title: 'Super Shiny Loot Buff',
    body: 'Extra essence a super shiny essence block drops on top of the shiny buff. A super shiny block pays both.',
  },
  statUltraShinyBonus: {
    title: 'Ultra Shiny Loot Buff',
    body: 'Extra essence an ultra shiny essence block drops on top of the shiny and super shiny buffs. An ultra shiny block pays all three.',
  },
  statSuperShiny: {
    title: 'Super Shiny Chance',
    body: 'Chance for a mined essence block that has already gone shiny to go shiny again, dropping the bonus a second time. It comes from upgrades, World Quest 29, gilded statues and the Rhino card.',
  },
  statUltraShiny: {
    title: 'Ultra Shiny Chance',
    body: 'Chance for a mined essence block that has already gone super shiny to go ultra shiny, dropping the ultra shiny buff on top of the other two. It comes from upgrades and the Infernal Rhino card.',
  },
  statBrittleChance: {
    title: 'Brittle Chance',
    body: 'Chance for an essence block to spawn brittle, starting at 20% of its health. Its max health is unchanged, so regen can still heal it back up. It shows up in the Brittle table under Show the Math and as brittle essence blocks per hour.',
  },

  // -------------------------------------------------------- show the math --

  mathShinyTable: {
    title: 'Shiny proc table',
    body: 'Every way one block\'s loot roll can turn out, with the chance of each and the bonus loot it adds. The rows are exclusive and their chances sum to one.\n\nThe last line is the average across all of them — that is the number the income calculation actually uses, not the headline shiny chance.',
  },
  mathCritTable: {
    title: 'Crit tier table',
    body: 'The crit ladder resolved into exclusive outcomes: no crit, crit, crit and super crit, and so on, each with its damage multiplier. Chances are the ones the game can actually roll, whole percents only.\n\nThe average at the bottom is your expected damage multiplier. A multiplied hit that lands on a fraction rounds up with probability equal to the fraction, so on average nothing is lost to rounding.',
  },
  mathBrittleTable: {
    title: 'Brittle table',
    body: 'How often an essence block spawns brittle, and the share of its health it starts with. A brittle block starts at 20% health, but regen can still heal it toward its full max.',
  },
  mathHealth: {
    title: 'Health',
    body: 'The essence block\'s health. A game constant — no upgrade on this page changes it.',
  },
  mathArmor: {
    title: 'Armour (after pen)',
    body: 'What is left of the block\'s armour once your penetration is subtracted, shown against the full value. It comes off every hit before crits multiply it. There is no minimum hit, so if armour is at least as high as your damage, every hit does nothing.',
  },
  mathStun: {
    title: 'Stun lands / roll',
    body: 'While the block stands, it rolls for a stun every second, and this is the chance that one of those rolls lands after your stun negate. A landed stun freezes your swing timer for its full duration; a stun that lands during another resets the duration instead of stacking.',
  },
  mathWeaken: {
    title: 'Weaken lands / roll',
    body: 'The chance each 1-second roll weakens you, after your weaken negate. While weakened, every hit multiplies your damage by the weaken effect before armour comes off. A new weaken resets the duration rather than stacking.',
  },
  mathDaze: {
    title: 'Daze lands / roll',
    body: 'The chance each 1-second roll dazes you, after your daze negate. While dazed, your swing timer fills at half speed; progress already made is kept. A new daze resets the duration rather than stacking.',
  },
  mathRegen: {
    title: 'Regen every 10s',
    body: 'The block heals this much in one burst every 10 seconds, counted from when it spawns, never above its max health. A burst that lands at the same instant as your final hit comes first, so the block can survive that hit.',
  },
  mathDamagePerHit: {
    title: 'Hit (after armour)',
    body: 'What a normal hit takes off a block before crits: your damage minus the armour left after penetration, never below zero.',
    formula: 'hit = max(damage − armour, 0)',
  },
  mathWeakenedHit: {
    title: 'Weakened hit',
    body: 'A hit while weakened. Weaken multiplies your damage first, rounding .5 up, and only then does armour come off, so against armour a weakened hit can be a much smaller share of a normal one than the weaken multiplier suggests.',
    formula: 'weakened = max(round(damage × weaken) − armour, 0)',
  },
  mathExpectedHit: {
    title: 'Avg hit (with crits)',
    body: 'A normal hit after armour times your expected crit multiplier from the Crit tier table. A rough guide only: the time to mine comes from the replay, which also counts weaken, stuns, daze and regen.',
    formula: 'avg hit = hit × crit multi',
  },
  mathHitsToMine: {
    title: 'Hits to mine',
    body: 'Average swings needed to break one block, counting the swing that lands the instant it spawns. It is an average over replayed blocks, which is why it is not a whole number: crits, brittle spawns and regen make every block different.',
  },
  mathStunnedTime: {
    title: 'Time stunned / block',
    body: 'Average seconds per block you spend stunned, with your swing timer frozen. Stuns carry on through the respawn wait, but none lasts long enough to reach the next block.',
  },
  mathWeakenedShare: {
    title: 'Weakened hits',
    body: 'Share of your hits on a block that land while you are weakened. Each of those deals the weakened hit instead of the normal one.',
  },
  mathDazedTime: {
    title: 'Time dazed / block',
    body: 'Average seconds per block you spend dazed, with your swing timer filling at half speed.',
  },
  mathHeals: {
    title: 'Heals / block',
    body: 'Average regen bursts a block gets before it breaks. A block broken within 10 seconds of spawning never heals.',
  },
  mathTimeToMine: {
    title: 'Time to mine',
    body: 'Average time from a block spawning to its final hit. It is found by replaying 10,000 blocks exactly as the game runs them, with swings, per-second debuff rolls, regen bursts, crits and brittle spawns, then averaging. The ± figure is roughly how far that average could be from the true one, because the replay is finite.',
  },
  mathRespawn: {
    title: 'Respawn',
    body: 'Idle time between one block breaking and the next appearing, after the Essence Respawn Time and Respawn Time upgrades. It sets the hard ceiling on blocks per hour: once time to mine is small next to respawn, more damage buys you almost nothing.',
  },
  mathLootRange: {
    title: 'Loot range',
    body: 'The minimum and maximum essence a single ordinary block can drop, after the Min Loot and Max Loot upgrades, cards and pet skin have been applied.',
  },
  mathLuckiestLoot: {
    title: 'Loot range (with shiny)',
    body: 'The same range with a shiny proc on top of it. Shiny is added to the roll rather than being part of it, so the luckiest possible block — a maximum roll that also procs ultra shiny — pays above the top of the ordinary range.\n\nBonuses you have no chance of rolling are left out, so with no super or ultra shiny source the top of this range stops at the highest tier you can roll.',
    formula: 'luckiest = max roll + shiny bonus + super shiny bonus + ultra shiny bonus',
  },
  mathAvgLoot: {
    title: 'Avg loot (with shiny)',
    body: 'The mean of the loot range plus the expected shiny bonus from the table above. This is the per-block figure income is built from.',
  },
  mathBlocksPerHour: {
    title: 'Blocks / hr',
    body: 'One hour divided by a full mining cycle: the average time to break a block plus the respawn wait before the next one appears.',
    formula: 'blocks/hr = 3600 ÷ (time to mine + respawn)',
  },
  mathBrittleBlocks: {
    title: 'Brittle blocks / hr',
    body: 'How many of those blocks spawn brittle. Shown separately because it is the part of your mining rate that brittle chance is buying.',
  },
  mathEssencePerHour: {
    title: 'Essence / hr',
    body: 'Gross essence income for this essence, before any altar spends it.',
    formula: 'essence/hr = blocks/hr × average loot',
  },
  mathAltarDrain: {
    title: 'Altar drain / hr',
    body: 'Essence per hour taken out of this essence by running altars. Ash and Brine draw on Soft, Chasm and Drift on Dense, Echo on Jagged; Necrotic is never drained.',
  },
  mathNet: {
    title: 'Net / hr',
    body: 'Income minus drain, shown here at the end of the derivation that produced it. It can go negative. The headline at the top of the page shows the same figure, except for the essence you are mining, where it never goes below zero: altars stall on an empty pool rather than overdraw it.',
  },

  // --------------------------------------------------------------- panels --

  optimizer: {
    title: 'Optimizer',
    body: 'What each upgrade is worth, measured by buying it, recomputing the whole model, and diffing the result. Nothing here is guessed: every figure comes from re-running the full model.\n\nThe arrow shows the levels the recommendation covers, from your current level to the one it buys, and the price is for exactly that. For a rune cost, the time after the price is how long your altars take to earn it from none, at their current sustained rate. It is usually one level, but not always: the game rolls crit chance in whole percents and rounds damage to a whole number, so a single level can buy nothing at all until it completes the next step. Where that happens the row is priced at the smallest buy that does something, and compared against the alternatives on that footing.\n\nThere are two lists because there are two goals and they do not always agree — altar throughput buys runes with essence, so an upgrade can be near the top of one list and negative on the other. Within a list, upgrades are grouped by the resource they cost, since a pile of white orbs cannot buy a rune upgrade.\n\nBoth goals count only what you can sustain. Essence counts the essence you are mining, not all three at once; runes count only what your altars can actually be supplied with. An upgrade that raises an altar past what the pool supports shows no gain, because it would give you none.',
  },
  exchange: {
    title: 'Exchange',
    body: 'Only the Exchange upgrades that change an Arcanist number are listed: Essence Damage +1 Per Arcanist Card Tier Owned; Rune Craft Multi, which lifts every altar\'s output; Arcanist Spell Power, which strengthens every spell; and Poly Rune Multi, which adds to Polychrome Rune cards only.\n\nThe Exchange sells many more. They are real upgrades, but none of them affect anything on this page, so listing them would only imply that they did.\n\nNo costs are shown: Exchange upgrades are bought with resources from elsewhere in the game that this planner does not track.',
  },
  wizardScore: {
    title: 'Offer score',
    body: 'How worthwhile this offer is, from 0 to 100. 50 is break-even: above it, take the offer; below it, better offers of the same orb will come along often enough that you can wait.\n\nIt weighs two things. Cheaper offers: of the orbs of this colour that wizards will offer, the percentage that take less effort per orb than this one. Offers you need: how many offers of this orb colour you actually need to take.\n\nA blind wizard is free. An orb with nothing left to buy scores 0. The "i" beside a score shows how that offer got it.',
    formula: 'score = 100 × offers you need ÷ (offers you need + cheaper offers)',
    see: ['effort', 'offersYouNeed'],
  },
  effort: {
    title: 'Effort',
    body: 'How hard a wizard\'s costs are for you to pay, as one number, so essence, runes and other currencies can be added up. 0 is free. 1 is as hard as your comfort hours of essence or runes, or a currency at the bottom of Currency Preference.\n\nEach cost adds its own effort. Essence and runes: hours of your production ÷ comfort hours. Other currencies: their row in Currency Preference, from 0 at the top to 1 at the bottom. Gems and PP: the Gems row, scaled by how the amount compares with what wizards offering that orb typically ask for.\n\nAn offer\'s effort is divided by the orbs it gives, so offers of different sizes compare fairly.',
    formula: 'effort per orb = total effort ÷ orbs rewarded',
    see: ['comfortHours', 'currencyPreference'],
  },
  offersYouNeed: {
    title: 'Offers you need',
    body: 'The percentage of an orb\'s offers you need to take. You keep refreshing until your slowest orb, the bottleneck, has every orb its upgrades need. A faster orb gets there sooner, so you only need to take some of its offers along the way. The bottleneck needs all of them: 100%.\n\nOrbs needed are what every unbought upgrade still costs in that orb, minus the orbs already in your satchel. The satchel is worked out for you: your Orbs Traded minus what the upgrades you have already bought cost, so buying an upgrade takes its orbs out of the satchel. If an orb is still locked, the orb before it needs at least enough trades to unlock it.',
    formula: 'offers you need = refreshes to finish this orb ÷ refreshes to finish the bottleneck',
  },
  currencyPreference: {
    title: 'Currency Preference',
    body: 'Drag the currencies a wizard can ask for in the order you would rather pay them: the easiest to come by at the top, the hardest at the bottom. An offer asking for something near the bottom scores lower.\n\nRows are evenly spaced unless you move the bars. Everything above the green bar counts as almost equally easy: those rows still keep their order, but sit a hundredth of the usual distance apart. The red bar marks a big jump: the row above it and the row below it sit five times the usual distance apart. Put both between your easy and hard currencies when only one or two are really hard to come by.\n\nPP is bought with gems, so a PP cost is scored as the gems it takes to buy — set PP per 100 Large Resource Packs below. Essence and runes are not on the list: they are judged in hours of your own production instead.',
    see: ['effort'],
  },
  comfortHours: {
    title: 'Comfort hours',
    body: 'How many hours of essence or rune production you are happy to spend on one trade. An offer asking exactly this much is effort 1, as hard as a currency at the bottom of Currency Preference; twice as much is effort 2.\n\nHours are measured against how much of that essence you would make per hour if you mined it, or how much of that rune its altar would craft per hour, regardless of what you are actually mining or running.',
    see: ['effort'],
  },
  ppPacks: {
    title: 'PP per 100 Large Resource Packs',
    body: 'The PP you receive from buying 100 Large Resource Packs, which always cost 37,500 gems. It turns a wizard\'s PP cost into the gems it really takes, so a PP offer is scored as a gem offer of that size.\n\nType it as the game shows it, such as 82.717Sp. Leave it at 0 and PP costs count as a typical gem cost.',
  },
  totalsPanel: {
    title: 'Total Resources',
    body: 'Everything still owed to max every priced upgrade on the page, and what those upgrades cost end to end.\n\nOnly resources something on the page actually costs appear, so nothing sits at a misleading zero.',
  },
} as const satisfies Record<string, HelpEntry>;

export type HelpId = keyof typeof HELP;
