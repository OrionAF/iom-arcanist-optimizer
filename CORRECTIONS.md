# Differences from the spreadsheet

This app is a port of the **Arcanist** sheet from the community workbook
*Obelisk Total Resources Calculator v7.1.1*. It is a faithful port with four
deliberate exceptions, listed here so a number that disagrees with the workbook
is explainable rather than mysterious.

The golden test (`src/calc/engine.test.ts`) asserts the app against the
workbook's own cached values for every other computed cell, and asserts these
four *do* differ — so a correction can never be confused with a transcription
slip.

## Corrected

### 1. Jagged hits-to-mine ignored the block's regeneration (`AJ3`)

The Soft and Dense columns subtract their avg-regen cell (`AC18`, `AF18`). The
Jagged column subtracts `AI1` — an empty cell — instead of `AI18`.

With the workbook's own inputs this reads **82** hits where the correct figure
is **84**, and the error cascades into Jagged blocks/hr, essence/hr and net
essence/hr. The app reports Jagged income of 73.63/hr against the sheet's 75.27.

### 2. Runic Surge nested its pet bonus differently from every other spell (`E45`)

Five spells compute `… * (1 + rank * 0.05) * (1 + petPotency)`. Runic Surge's
primary effect computes `… * (1 + rank * 0.05 * (1 + petPotency))`, folding the
pet bonus into the rank term.

The two forms coincide when the pet bonus is zero, which it is in the source
workbook — so the sheet's displayed value is unaffected, but any player with
that pet bonus would get the wrong number. Normalised to the majority form.

### 3. Locked spells still granted their second effect (`E46`, `E50`, `E54`, `E58`, `E62`, `E66`)

Each spell's *primary* effect is wrapped in `IF(unlocked, …)`. The *secondary*
effects are not.

Most visibly: Veinboyant is locked in the source workbook (`A64 = 0`), yet
`E66` still grants 0.15 Rune Craft Multi, which flows through `Statmath!C372`
into every altar's rune output. All spell effects are now gated on the unlock
flag.

### 4. The "Super Crit Damage" upgrade did nothing (`E15`, `N8`)

`E15` computes `level * 0.01`, but the Super Crit Damage stat (`N8`) is
hardcoded to `2` and never reads it — unlike Crit Damage, where `N6` reads
`E9`. Confirmed in game as a bug; the stat is now `2 * (1 + E15)`, mirroring
`N6`.

This also moves the super crit and ultra crit rows of the damage table
(`AA18`, `AA19`, both derived from `N8`) and therefore the weighted average
damage multiplier `Z23`. The shift is small — the super crit branch carries
about 0.13% of the weight — so with the workbook's inputs it does not move any
hits-to-mine figure, which is rounded up to a whole hit.

## Not changed — needs in-game confirmation

These look odd but changing them would be a guess, not a fix. They are
implemented exactly as the sheet has them.

### Ultra crit is inert

`N9` (Ultra Crit Chance) is hardcoded `0` and no upgrade feeds it, so the ultra
crit branch of the damage table never contributes. Modelled as a constant.

## Added — modelled here, absent from the sheet

### Exclusive mining and altar stalling

The workbook computes all three essences' net-per-hour side by side, as though
you earned them simultaneously, and lets an altar drive a pool negative.

Neither matches the game. The Arcanist mines one essence at a time, and an altar
stalls on an empty pool rather than overdrawing it. Both are modelled here:

- `ArcanistInput.mining` says which essence you are on. The other two still
  report their income — that is what makes them answerable as "if you switched"
  — but they bank nothing.
- Each altar carries `supplyFactor` (`min(1, pool income ÷ pool drain)`) and
  `sustainedRunesPerHour` beside its nominal rate. Both the optimizer and the
  potency path read the sustained one.
- `sustainedNet` is income less what the altars can actually take, floored at
  zero.

`netEssencePerHour` is **unchanged** and still asserted against `P16`/`X28`/`X29`,
so the golden test stays a transcription check. It can read negative where the
game cannot; `sustainedNet` is the user-facing figure.

Consequence worth stating plainly: potency-path times are substantially longer
than they were before this, because the old figures assumed essence was free and
infinite.

## Removed

### Exchange upgrade costs

The workbook priced all thirteen Exchange upgrades — geometric curves in stars,
runes, essence, prestige points and Blue Cow. Those figures were invented, not
observed: they are not documented anywhere in game and are not close.

The app shows no cost for these rows at all. A blank says "unknown"; a wrong
number gets planned around, which is worse than nothing in a planning tool.

Consequences:

- The Exchange table has no cost column.
- Resources that **only** Exchange consumed no longer appear in Total Resources:
  Blue Cow, Scorpio / Lynx / Aquarius Star, Superstars, Prestige Points, Stone
  Vein, and Soft / Dense Essence. Red Orb drops out too — nothing costs it.
- The Ash, Brine and Chasm Rune totals are lower than the sheet's `C95`/`C96`/
  `C97`, which included Exchange costs. Orb totals still match the sheet exactly.

Costs are still shown for Essence Upgrades, Altar upgrades and unlocks, and
Spell Potency ranks, all of which come from real in-game figures.

### Eleven of the thirteen Exchange upgrades

Only two Exchange upgrades change anything the Arcanist computes:

- **Essence Damage Per Arcane Card** (`A71`) — flat damage equal to the Arcane
  card count.
- **Rune Craft Multiplier** (`A81`) — +1% per level into `Statmath!C372`.

The other eleven buy portal chances, wizard loot, star caps, lootbug capacity
and a spell unlock the Spells section already tracks with its own toggle. Not
one of them appears in any Arcanist formula. Carried here they were a section a
player could tune all evening without a single number moving, which is worse
than not offering them: it implies they matter to this page. They are tracked in
the game, not here. The five unreleased placeholder rows (`A82:A86`) go with
them.

Share links from before the change no longer decode. The packed format is
positional, so its marker moved from `q` to `r` and old tokens are rejected
loudly rather than silently reinterpreted. JSON exports still load — parsing
walks the known upgrades and drops the rest.

### The completion tracker

The workbook's `K87:L99` block counts levels owned against levels available,
per section and overall, up to a grand total of 1048 (`L99`, which includes a
flat 180 reserved for unreleased content).

That is a completionist's scoreboard, and this is a planner. Nothing else on the
page reads it, no decision turns on it, and it counts levels rather than value —
a three-level row weighs the same as a twenty-five-level one. It belonged to the
sheet and does not belong here. Removed along with `COMPLETION_RESERVED`, so no
part of the app now depends on the reserved-levels fudge.

Everything the tracker summarised is still visible where it is actionable: each
row shows its own level against its maximum, and Total Resources shows what is
left to buy.

## Renamed

### The two obelisk shiny unlocks

The workbook labels `Obelisks!H28` as **Obelisk 26**, requirement *"Reach Rhino
Pet Level 3"*, and `H32` as **Obelisk 30**, requirement *"Reach Rhino Pet Level
10"*.

The app calls them **World Quest 25 completed** and **World Quest 29
completed**, on the authority of a player. The effects are identical either way
(+1% Essence Shiny Chance and +2% Essence Super Shiny Chance), so only the
source name differs — the workbook appears to have attributed them to the wrong
system.

## Confirmed correct — do not "fix"

### Altar essence routing

The Ash and Brine altars both drain **Soft** essence; the Chasm altar drains
**Dense** (`X28 = V28 + V29`, `X29 = V30`). Nothing drains Jagged, which is why
`X30` is empty. This is asymmetric and looks like an oversight, but it matches
the game — confirmed 2026-07-31. `src/calc/constants.ts` encodes it as each
altar's `consumes` field.

## Cosmetic

The sheet's number formatter leaves a trailing `.` when its `"0.##"` branch
rounds to a whole number (`50. Sextillion`). The app drops it. This affects
display only.
