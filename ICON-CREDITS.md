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

Spells have two icons each: the card art (`*_Spell.png`) and the buff icon shown
while the spell is running (`*.png`). Both are used — the buff icon marks a
spell you have unlocked.

## Unused

Downloaded and available, but nothing in the Arcanist model uses them:
`Blind_Wizard_Chance.png`, `Disco_Wizard_Chance.png`,
`Flashbang_Wizard_Chance.png`, `Party_Wizard_Chance.png`,
`Party_Wizard_Multi.png`, `Yellow_Orb.png`.
