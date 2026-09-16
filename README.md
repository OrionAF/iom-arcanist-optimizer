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

This is an unofficial fan tool with no affiliation to the game's creators.

## Using it

Everything you can change lives in the left column, in two tabbed panels; the
right column is read-only output.

- **Essence Upgrades, Altars, Spells** — every row takes your current level, and
  prices it two ways: what the next level costs, and what the rest of the row
  costs to max. Prices match what the game charges.
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
  cost. Offers stay in this browser; your settings, tallies and preference
  travel with the build.
- **?** — every derived number has one. It explains what the figure is and, where
  the shape of the calculation is the answer, how it is worked out.
- **Show the math** — the full derivation: crit/shiny/brittle probability
  tables, per-block stats, hits to mine, and where the essence goes.
- **Panels fold.** Which ones you leave closed, and which tab each shows, is
  remembered locally, and is not part of the build a share link carries.
- Builds autosave locally. **Export** writes a JSON file; **Share link** puts
  the whole build in the URL. A link you open is offered, never saved over your
  own build until you keep it.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # the test suite
npm run build    # production build
```

The calculator itself is a pure function — `compute(input)` in
`src/calc/engine.ts` — with no DOM or React anywhere near it. It returns every
intermediate value, which is what lets the "show the math" panel, the tests and
the optimizer all read from one source. Every figure it uses lives in
`src/calc/constants.ts`, so a balance patch should be a single-file edit.
