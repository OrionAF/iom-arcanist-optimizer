# IOM Arcanist Optimizer

A planner for the **Arcanist** (Ob70) content in *Idle Obelisk Miner*: essence
upgrades, the five rune altars, thirteen spells, exchange upgrades, and the mining
math that turns all of it into essence per hour.

**→ https://OrionAF.github.io/iom-arcanist-optimizer/**

It shows Soft, Dense, Jagged and Necrotic essence side by side — income, altar
drain and net per hour — and recalculates as you change any level. You mine one
essence at a time, so click the one you are on: the others keep reporting what they
*would* pay, and the altars they feed report what they can actually sustain.

## Credit

Based on the **Arcanist** sheet from
[Obelisk Total Resources Calculator](https://docs.google.com/spreadsheets/d/1hj4YvYYNlAmXD9LHZNsDQS2n1pFI8H34_1-RS_RlU-E/edit?usp=sharing)
by **Stonestriker**, heavily modified. All credit for the original calculator
belongs there; this project turns it into a shareable web page and extends it.

Icons are game assets from the [wiki](https://shminer.wiki.gg/), vendored into
`public/icons/` — see [ICON-CREDITS.md](ICON-CREDITS.md).

## Using it

Everything you can change lives in the left column, in two tabbed panels; the
right column is read-only output.

- **Essence Upgrades, Altars, Spells** — every row takes your current level, and
  prices it two ways: what the next level costs, and what the rest of the row
  costs to max. Every price comes from the game's own data.
- **Cards, Other Unlocks, Pets** — what the rest of your account contributes.
  Defaults are all zero, so fill these in or the numbers read low. Cards are
  picked by tier; the tier total drives Essence Damage +1 Per Arcanist Card Tier
  Owned. Other Unlocks also holds the Exchange upgrades that change an Arcanist
  number, with no cost: they are bought with resources from elsewhere in the
  game that this planner does not track.
- **Wizard Exchange** — enter the wizards on screen and each offer gets a score
  from 0 to 100; 50 is break-even. It weighs how many orbs of that colour your
  remaining upgrades still need against how often cheaper offers of the colour
  come along, judging essence and runes in hours of your own production and
  every other currency by your Currency Preference order. Accept adds the orbs
  to Orbs Traded; your satchel is Orbs Traded minus what your bought upgrades
  cost. Offers stay in this browser; your settings,
  tallies and preference travel with the build.
- **?** — every derived number has one. It explains what the figure is and, where
  the shape of the calculation is the answer, how it is worked out.
- **Show the math** — the full derivation: crit/shiny/brittle probability
  tables, per-block stats, hits to mine, and where the essence goes.
- **Panels fold.** Which ones you leave closed, and which tab each shows, is
  remembered locally, and is not part of the build a share link carries.
- Builds autosave locally. **Export** writes a JSON file; **Share link** puts
  the whole build in the URL.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # formula and game-data tests
npm run build    # production build
```

## Design notes

### Game data

`arcanist_costs.md` is an extract of the game's own code (Idle Obelisk Miner
2.2.20) and is the only source of truth for upgrade names, maxima, effects,
prerequisites, prices, unlock costs, altars and spells. It and the extractor
that turns it into `src/calc/__fixtures__/game-costs.json` are kept locally
rather than in the repo; the committed fixture is what
`src/calc/gamedata.test.ts` holds `src/calc/constants.ts` to.

Game data lives in `src/calc/constants.ts`. A balance patch should be fixable by
editing that one file.

### How it fits together

The calculator is a pure function — `compute(input)` in `src/calc/engine.ts` —
with no DOM or React anywhere near it. It returns every intermediate value, not
just the headline numbers, which is what lets the "show the math" panel, the
tests and the optimizer all read from one source.

Costs (`src/calc/costs.ts`) round each level's price to a whole unit before
summing, as the game does. No row has more than 30 levels, so the engine stays
cheap enough to call in a search loop.

Each spell potency rank adds 5% to the spell's effect, its duration and its
level-up chance. Cast cost does not change.

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

You mine one essence at a time, and an altar stalls on an empty pool rather than
going negative. Ash and Brine drain Soft, Chasm and Drift drain Dense, Echo
drains Jagged, and nothing drains Necrotic.

So every altar carries two rates. `runesPerHour` is the nominal one — what it
would produce if fed. `sustainedRunesPerHour` multiplies that by
`min(1, pool income ÷ pool drain)`, which is 1 whenever your pickaxe outpaces
the altars and collapses toward zero when it does not. The optimizer reads the
sustained figure, because the nominal one describes an altar nobody can feed.

`netEssencePerHour` is plain income less drain and can go negative;
`sustainedNet` is what the UI shows, and it never is.

One consequence worth knowing: on a starved pool, capacity buys nothing. An
altar converts at `(1 + craft × 0.2) × (1 + card) × runeCraftMulti`, which has
no capacity term, so a starved altar's output is set by what you mine.

### Horizons

Every number in this app answers a question about the *next* purchase, not about
a finished build. A panel that projected spell potencies out to rank 10 was
built and deleted: it produced a three-week schedule that no purchase survived,
restated what the optimizer already said in one line, and spent most of its
length on ranks worth exactly zero.

Rune costs carry a time-to-afford at the current sustained rate. One purchase is
as far as that stays true, because buying anything moves the rates.
