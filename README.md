# IOM Arcanist Optimizer

A planner for the **Arcanist** (Ob70) content in *Idle Obelisk Miner*: essence
upgrades, the three rune altars, six spells, exchange upgrades, and the combat
math that turns all of it into essence per hour.

**→ https://OrionAF.github.io/iom-arcanist-optimizer/**

It shows Soft, Dense and Jagged essence side by side — income, altar drain and
net per hour — and recalculates as you change any level.

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

- **Levels** — every row takes your current level; costs update as remaining vs.
  full cost to max. Exchange upgrades show no cost, because the real prices are
  not documented in game — see [CORRECTIONS.md](CORRECTIONS.md).
- **External Bonuses** — the Arcanist reads ~20 values from cards, pets,
  obelisks, skills, the store, constructs and contracts. Defaults are zero, so
  fill these in or the numbers will read low.
- **Show the math** — the full derivation: crit/shiny/brittle probability
  tables, per-enemy stats, hits to kill, and where the essence goes.
- Builds autosave locally. **Export** writes a JSON file; **Share link** puts
  the whole build in the URL.

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

## Not built yet

Upgrade efficiency ranking, goal-seek (cheapest path to a target), time-to-afford
projections, and importing the game's `EXPORTSTATS` JSON. The engine and the save
schema are shaped to take them without restructuring.
