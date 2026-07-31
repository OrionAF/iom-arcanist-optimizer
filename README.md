# IOM Arcanist Optimizer

A planner for the **Arcanist** (Ob70) content in *Idle Obelisk Miner*: essence
upgrades, the three rune altars, six spells, exchange upgrades, and the mining
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

### The potency path

`src/calc/potency.ts` answers a different question, because the optimizer's
does not work for spell potencies: four of the six spells affect drones, portals,
stars and veins rather than anything on this page, so ranked by marginal value
they read zero forever — true, and useless.

What matters for potencies is scheduling. The path simulates the run to rank 10:
it starts with an empty bank, waits until the next rank is affordable, buys it,
and recomputes. The three rune types bank in parallel, so waits overlap and the
total is the longest queue rather than the sum of them. Prismism's potency
raises the Rune Craft multiplier and so shortens every wait after it, which is
why it lands at the front — found by measuring rather than by a rule.

Times assume nothing banked and every rune going into the plan, so they are
floors: casting spells and buying altar upgrades spend from the same pile.

## Not built yet

Goal-seek (cheapest path to a target), time-to-afford for the main optimizer,
and importing the game's `EXPORTSTATS` JSON. Time-to-afford outside the potency
path needs orb income rates, which the Arcanist sheet does not model; supplying
them would also let the per-resource queues merge into one ranked list.
