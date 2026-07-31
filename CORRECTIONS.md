# Differences from the spreadsheet

This app is a port of the **Arcanist** sheet from the community workbook
*Obelisk Total Resources Calculator v7.1.1*. It is a faithful port with three
deliberate exceptions, listed here so a number that disagrees with the workbook
is explainable rather than mysterious.

The golden test (`src/calc/engine.test.ts`) asserts the app against the
workbook's own cached values for every other computed cell, and asserts these
three *do* differ — so a correction can never be confused with a transcription
slip.

## Corrected

### 1. Jagged hits-to-kill ignored the enemy's healing (`AJ3`)

The Soft and Dense columns subtract their avg-heal cell (`AC18`, `AF18`). The
Jagged column subtracts `AI1` — an empty cell — instead of `AI18`.

With the workbook's own inputs this reads **82** hits where the correct figure
is **84**, and the error cascades into Jagged kills/hr, essence/hr and net
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

## Not changed — needs in-game confirmation

These look odd but changing them would be a guess, not a fix. They are
implemented exactly as the sheet has them.

### The "Super Crit Damage" upgrade does nothing (`E15`)

`E15` computes `level * 0.01`, but the Super Crit Damage stat (`N8`) is
hardcoded to `2` and never reads it — unlike Crit Damage, where `N6` reads
`E9`. Either the stat should be `2 * (1 + E15)` or the upgrade row is
mislabelled. The app shows the upgrade with a note and applies no effect.

### Altar essence routing

The sheet drains **Soft** essence for both the Ash and Brine altars, and
**Dense** for the Chasm altar (`X28 = V28 + V29`, `X29 = V30`). A symmetric
ash→soft / brine→dense / chasm→jagged mapping might be expected instead. The
empty `X30` (Jagged drain) is consistent with the sheet's arrangement — nothing
consumes Jagged — so it is not treated as a bug.

### Ultra crit is inert

`N9` (Ultra Crit Chance) is hardcoded `0` and no upgrade feeds it, so the ultra
crit branch of the damage table never contributes. Modelled as a constant.

## Cosmetic

The sheet's number formatter leaves a trailing `.` when its `"0.##"` branch
rounds to a whole number (`50. Sextillion`). The app drops it. This affects
display only.
