# IOM Arcanist Optimizer

A planner for the **Arcanist** (Ob70) content in *Idle Obelisk Miner*: essence
upgrades, the three rune altars, six spells, exchange upgrades, and the mining
math that turns all of it into essence per hour.

**→ https://OrionAF.github.io/iom-arcanist-optimizer/**

It shows Soft, Dense and Jagged essence side by side — income, altar drain and
net per hour — and recalculates as you change any level. You mine one essence at
a time, so click the one you are on: the other two keep reporting what they
*would* pay, and the altars they feed report what they can actually sustain.

## Credit

The math is a port of the **Arcanist** sheet from the community workbook
*Obelisk Total Resources Calculator v7.1.1*. All credit for working out these
formulas belongs to the workbook's authors and the Idle Obelisk Miner
community. This project only moves that work to a shareable web page.

The workbook itself is not committed here — it is a community binary and not
ours to redistribute. What is committed is the derived fixture in
`src/calc/__fixtures__/`, which the test suite checks the port against.

Four formula errors in the source sheet are fixed here. They are documented in
[CORRECTIONS.md](CORRECTIONS.md) along with a few oddities left alone pending
in-game confirmation.

Icons are game assets from the [wiki](https://shminer.wiki.gg/), vendored into
`public/icons/` — see [ICON-CREDITS.md](ICON-CREDITS.md).

## Using it

- **Levels** — every row takes your current level, and prices it two ways: what
  the next level costs, and what the rest of the row costs to max. Exchange
  shows no cost, and only lists the two upgrades the Arcanist actually reads —
  see [CORRECTIONS.md](CORRECTIONS.md).
- **?** — every derived number has one. It explains what the figure is and, where
  the shape of the calculation is the answer, how it is worked out.
- **Sections fold.** Which ones you leave closed is remembered locally, and is
  not part of the build a share link carries.
- **Cards, Pets, Unlocks, Contracts** — what the rest of your account
  contributes. Defaults are all zero, so fill these in or the numbers read low.
  Cards are picked by tier; the tier total drives Essence Damage Per Arcane Card.
- **Show the math** — the full derivation: crit/shiny/brittle probability
  tables, per-block stats, hits to mine, and where the essence goes.
- Builds autosave locally. **Export** writes a JSON file; **Share link** puts
  the whole build in the URL.

Everything you can change lives in the left column; the right column is
read-only output.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # golden test against the workbook's cached values
npm run build    # production build
```

### Regenerating the fixture

If you have the source workbook, put it in the project root and run:

```sh
npm run fixture
```

`tools/extract_arcanist.py` reads the `.xlsx` with the Python standard library
(no openpyxl) and writes every Arcanist cell's cached value to
`src/calc/__fixtures__/arcanist-sheet.json`.

### How it fits together

The calculator is a pure function — `compute(input)` in `src/calc/engine.ts` —
with no DOM or React anywhere near it. It returns every intermediate value, not
just the headline numbers, which is what lets the "show the math" panel, the
golden test and the planned optimizer features all read from one source.

Costs are closed-form (`src/calc/costs.ts`) rather than the sheet's
`SUMPRODUCT` loops, so the engine stays cheap enough to call in a search loop.

Game data lives in `src/calc/constants.ts`. A balance patch should be fixable
by editing that one file.

### Taking screenshots

`node tools/shoot.mjs <url> <out.png> [waitMs] [width] [height]` drives headless
Edge over the DevTools Protocol with a real wait, which `--screenshot
--virtual-time-budget` cannot do.

### The optimizer

`src/calc/optimize.ts` answers "what should I buy next". It scores an upgrade by
buying one level of it and running `compute` again — no formula is duplicated
from the engine, so a balance patch moves the rankings on its own. A full
ranking of every available upgrade is one `compute` per candidate and runs in a
few milliseconds, which is what lets it refresh on every keystroke.

It does not search for a best *build*: every upgrade is monotone-positive and
eventually affordable, so the best build is trivially "max everything". The
order is the real question.

Two rankings are shown, because there are two goals — essence per hour and runes
per hour — and altar throughput trades one for the other. Within each, upgrades
are grouped by the resource they cost, since a white-orb price and a rune price
cannot be compared without an exchange rate nobody has.

The altars are the only place the two goals genuinely conflict. Capacity and
travel speed scale rune output and essence drain by the same factor and cancel,
so a single altar converts essence to runes at exactly its craft multiplier no
matter how it is tuned. That cancellation is per altar, not across a set — the
tests pin both halves of it.

### Essence supply

The workbook models all three essences as earning at once and lets an altar
drain a pool past empty. Neither is true: you mine one essence at a time, and an
altar stalls on an empty pool rather than going negative.

So every altar carries two rates. `runesPerHour` is the nominal one — what it
would produce if fed. `sustainedRunesPerHour` multiplies that by
`min(1, pool income ÷ pool drain)`, which is 1 whenever your pickaxe outpaces
the altars and collapses toward zero when it does not. Both the optimizer and
the potency path read the sustained figure, because the nominal one describes an
altar nobody can actually feed.

`netEssencePerHour` keeps the workbook's formula and stays asserted against the
sheet, so the golden test remains a transcription check. `sustainedNet` is what
the UI shows; it is never negative.

One consequence worth knowing: on a starved pool, capacity buys nothing. An
altar converts at `(1 + craft × 0.2) × (1 + card) × runeCraftMulti`, which has
no capacity term, so a starved altar's output is set by what you mine.

### The potency path

`src/calc/potency.ts` answers a different question, because the optimizer's does
not work for spell potencies: four of the six spells affect drones, portals,
stars and veins rather than anything on this page, so ranked by marginal value
they read zero forever — true, and useless.

Ranks are priced in runes, runes come from altars, altars eat essence, and
essence is mined one type at a time. So the real cost of the plan is mining
hours, and that is what it reports: an essence budget per pool, plus the hours
that implies at your current rates.

It simulates rather than divides, because the pieces feed back. Prismism's
potency raises the Rune Craft multiplier, which makes every later rank cheaper
in essence, so it front-loads itself — found by measuring, not by a rule.

**It is a budget, not a timetable.** Essence also buys orbs at the exchange, so
the plan has no exclusive claim on your mining time and the split is not
something the app can know. The internal ordering exists to get the numbers
right, not to be followed.

The one exception is the altar advice. Each rune comes from exactly one altar
and the conversion ratio is capacity-independent, so there is nothing to search:
an altar is worth running until the last rank priced in its rune is bought, and
after that it only burns essence — on the Soft pool, essence the other altar
could have used. That holds however you split your time, so it is stated as
advice rather than as a schedule.

## Not built yet

Goal-seek (cheapest path to a target), time-to-afford for the main optimizer,
and importing the game's `EXPORTSTATS` JSON. Time-to-afford outside the potency
path needs orb income rates, which the Arcanist sheet does not model; supplying
them would also let the per-resource queues merge into one ranked list.

Altar *upgrades* are not recommended for supply efficiency either: craft level
and the altar card both raise the conversion ratio, so they reduce the essence a
plan needs. That is a real trade against their orb cost, but it belongs to the
main optimizer.
