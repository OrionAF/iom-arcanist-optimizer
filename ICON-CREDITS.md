# Icon credits

The icons in `public/icons/` are game assets from the
[Idle Obelisk Miner wiki](https://shminer.wiki.gg/), served from this repo
rather than hotlinked so the app does not depend on a third-party host staying
up or permitting hotlinks.

All artwork belongs to the game's creators. This is an unofficial fan tool with
no affiliation to them; if a rights holder wants the icons removed, open an
issue and they will be.

Files keep their original wiki names, so any icon can be traced back to
`https://static.wikitide.net/shminerwiki/<hash>/<Name>.png`.

## Mapping

`src/ui/icons.ts` maps these files to what they label in the UI. Several icons
are reused by the game across skills, so a few Arcanist upgrades legitimately
show art named for another system:

| UI element | File |
|---|---|
| Flat Damage | `Pickaxe_Damage.png` |
| Crit Chance / Crit Damage | `Pickaxe_Crit_Chance.png` |
| Super Crit Chance / Damage | `Archaeology_Super_Crit_Chance.png` |
| Damage % | `Archaeology_Damage_Mult.png` |
| Crit Chance / Super Crit Chance | `Archaeology_Crit_Chance.png` |
| Essence Damage Per Arcane Card | `Archaeology_Flat_Damage.png` |
| Essence Armor Pen | `Obelisk_Armor_Reduction.png` |

Spells have two icons each: the spell art (`*_Spell.png`) and the buff icon shown
while the spell is running (`*.png`). Both are used: the spell art marks a
spell you have unlocked, and the buff icon marks one you haven't.

## Cards

A card is drawn as its tier's frame with the card's own art layered inside:

| Card block | Frame | Inset art |
|---|---|---|
| Essence | `Card_Backing_*.png` | `Soft_/Dense_/Jagged_Essence_Multi.png` |
| Runes | `Card_Backing_*.png` | `Ash_/Brine_/Chasm_Rune.png` |
| Spells | `Card_Backing_*.png` | `*.png` (the buff icon) |
| Orbs | `Card_Backing_*.png` | `White_/Green_/…_Orb.png` |
| Rhino Pet | `Card_Backing_*.png` | `Rhino_Default.png` |

There is no frame for an unowned card, so those slots read "Not owned" rather than
showing a frameless icon.

## Wizard Exchange

The Wizard settings use the art listed under "Exchange Wizard scoring system" in
`Icon-ref-links.txt`: `Exchange_Wizard_Loot_Multi.png` (also Poly Orb Card Multi),
`Party_Wizard_Chance.png`, `Party_Wizard_Multi.png`, `Blind_Wizard_Chance.png`,
`Disco_Wizard_Chance.png`, `Flashbang_Wizard_Chance.png`, `Exchange.png` (Number of
Wizards) and `Hourglass.png` (Exchange Timer). `Prestige_Point.png` is the wiki's
16px thumbnail and marks PP costs.

Cost categories: `Telescope.png` (Stars), `Tin_Bar.png` (Bars), `Stone_Vein.png`
(Veins), `Archaeology_Fragment_Gain.png` (Archaeology Fragments), `Bass.png` (Fish),
`Gem.png` (Gems), and one item standing for each item tier: `Apple.png` (Tier 1),
`Rainbow_Lollipop.png` (Tier 2), `Cosmic_Candy.png` (Tier 3). Every item a wizard
can ask has its own icon under its wiki name, listed in the item tier popovers.

## Unused

Arcanist batch 2 art, downloaded for content that isn't modelled yet (see
BATCH2-PENDING.md): the six new spells (`Diggy_Diggy_Hole`, `Blue_Giant`,
`Rainbow_Road`, `Party_Fever`, `Bombs_Blessing`, `Bug_Magnet`, each as `*.png`
and `*_Spell.png`) and `Drift_Rune.png` / `Echo_Rune.png`.

`Bombs_Blessing*.png` drop the apostrophe from the wiki's `Bomb's_Blessing*.png`,
which is awkward in a URL. That is the only renamed file.

## Batch 2 art

The batch 2 essence upgrades, Exchange upgrades, Draconic Hoard
(`Draconic_Hoard*.png`), Black Hole Level 30 (`BlackHole.png`), Divine Challenge 24
(`Divine_Challenge_Coin.png`, the wiki's 16px thumbnail), the Hydra Star
(`Hydra_Full.png`) and the Spellslinger Bundle (`Spellslinger_VP.png`) use the art
listed in `Icon-ref-links.txt`. Every batch 2 essence upgrade now has its own art:
`Essence_Regeneration_Reduction.png`, `Super_Shiny_Essence_Chance.png` (two rows),
`Weaken_Negate_Chance.png`, `All_Essence_Max_Loot.png`, `Super_Shiny_Essence_Multi.png`,
`All_Essence_Min_Loot.png`, `All_Debuff_Negate_Chance.png`, `Dazed_Negate_Chance.png`,
`Ultra_Shiny_Essence_Chance.png`, `All_Shiny_Essence_Loot.png` and
`Stun_Negate_Chance.png`. `Necrotic_Essence.png` and `Card_Backing_Infernal.png`
(the Rhino card's Infernal frame) are the real thing.

`src/ui/icons.test.ts` checks every path the catalog exports against a real file
in `public/icons/`, gathering the paths from the module rather than a list, so a
new catalog cannot be silently left out of the check.

## Interface icons

The trash-can button on a wizard card is `trash-2` from [Lucide](https://lucide.dev/) (ISC licence), inlined as SVG.
