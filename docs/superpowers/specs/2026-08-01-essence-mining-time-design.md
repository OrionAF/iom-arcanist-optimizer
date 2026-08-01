# Essence mining time in the Spell Potency Path

**Date:** 2026-08-01
**Status:** approved, not yet implemented

## The problem

The Spell Potency Path prices ranks in runes and divides by rune income. Rune
income comes from altars. Altars consume essence. The path never asks where that
essence comes from, so it assumes essence is free and infinite.

It is neither. Two facts break the assumption:

1. **Mining is exclusive.** The Arcanist mines one essence at a time. The engine
   models all three as earning at once, so the ledger shows three concurrent net
   figures that are really three alternatives.
2. **Altars stall on an empty pool.** They produce nothing and consume nothing
   until essence exists. Rune output is therefore capped by essence supply, not
   by altar throughput.

Together these mean the path reports times that no player can achieve.

## The two regimes

For an essence pool, let `supply` be the income while mining it and `demand` be
the total drain of running altars on it.

- **Altar-limited** (`supply >= demand`): stock grows without bound, altars never
  stall, and the current model is already correct.
- **Essence-limited** (`supply < demand`): altars stall. Total runes obtainable
  is capped by essence mined multiplied by the conversion rate, and altar
  throughput stops mattering.

The current path is right in the first regime and wrong in the second. Everything
below is about making the second regime correct without disturbing the first.

A useful consequence: because mining is exclusive, total mining time is
`Σ (essence needed ÷ income while mining that essence)`. Switching *frequency*
does not change that sum — it only changes whether altars sit idle.

## Jagged feeds nothing

Ash and Brine altars drain Soft; Chasm drains Dense. Nothing drains Jagged. Time
spent mining Jagged therefore yields zero runes. This is a real conclusion of the
model, not an oversight, and the UI should not hide it.

## Scope boundary: the orb economy

Essence is also the exchange sink that buys orbs, which is how essence upgrades
get paid for. The potency plan has no exclusive claim on mining time, and the
split between the two is unpredictable — it depends on exchange behaviour and
other systems this app does not model.

**Therefore the feature reports a budget, not a timetable.** "This plan needs
about 190K Soft and 75K Dense" is true whatever order you mine in and whatever
else you are mining for. "Mine Soft for three days, then switch" would be
claiming knowledge the model does not have.

Inventing a diversion factor was considered and rejected for the same reason the
Exchange costs were dropped: a wrong number gets planned around.

## Stage 1 — exclusive mining in the engine

Shipped on its own. Leaves the app correct even if stage 2 is later reworked.

### Input

```ts
export interface ArcanistInput {
  // …
  /** Which essence the Arcanist is currently mining. */
  mining: EssenceType;
}
```

Appended to the end of `FIELD_ORDER`, encoded as an index into `ESSENCE_TYPES`
— the same convention `cardField` uses for tiers, with an out-of-range value
coercing to `soft` rather than throwing.

Decoding already fills a short tail from `FRESH_INPUT` (pinned by "fills the
tail with defaults when a link predates a new field"), so **existing share links
keep working and `PACK_FORMAT` does not move.** An old link decodes with
`mining: 'soft'`.

`SCHEMA_VERSION` moves to 4 for the JSON side, where a missing key coerces the
same way. JSON needs no migration: parsing reads known keys and defaults the
rest.

### Altar output

`AltarOutcome` gains two fields; `runesPerHour` keeps its current meaning as the
nominal rate, so nothing that reads it today changes behaviour.

```ts
supplyFactor: number;           // demand > 0 ? min(1, supply / demand) : 1
sustainedRunesPerHour: number;  // runesPerHour * supplyFactor
```

`supply` is the mined essence's income — zero for the two essences not being
mined. `demand` is the summed drain of running altars on that pool.

`supplyFactor` is 1 in the altar-limited regime, which is what makes this a
strict generalisation rather than a rewrite.

### Essence outcome

`netEssencePerHour` **keeps its current formula and stays asserted against the
sheet** (`P16`, `X28/X29`), so the golden test remains a transcription check. A
new field carries the truth the UI shows:

```ts
sustainedNet: number;  // supply − demand * supplyFactor
```

This is the steady-state net. It is 0 when essence-limited (altars stall rather
than driving the pool negative) and equals the old net when altar-limited.

The steady state deliberately ignores stock draw-down; the transient is stage 2's
job. Documented so the two are not confused.

### Optimizer

`objectives()` reads `sustainedRunesPerHour` rather than `runesPerHour`, and the
essence objective follows the mined essence. Both fall out of the engine change.

### UI

The ledger becomes the mining selector: its three cells are already the three
essences. The mined one shows live income; the other two dim to "if you
switched", which is what those numbers have always meant. No new chrome.

Altar stat blocks show the sustained rate when it differs from nominal.

## Stage 2 — essence budget in the potency path

### Simulation

Event-driven, not time-stepped. Within a phase each pool has at most one
breakpoint: it drains at `income − demand` until empty, then throttles to
`supplyFactor`. The next event is the minimum over pool-empty times and
rune-target-reached times, each solved in closed form. Exact, with no granularity
to tune.

State: essence bank per type, rune bank per type, ranks, current mining target,
clock.

### Switch rule

Mine a pool until its bank covers every remaining purchase that depends on it,
then move to the next pool with unmet need. Pool order reuses the existing
`better()` comparator, so Prismism's rune-craft feedback floats to the front on
its own and Soft-first falls out — Prismism is priced in brine, which comes from
a Soft-fed altar.

This is a *model* assumption, not advice. Real play returns to each essence
repeatedly for the orb exchange; per the scope boundary above, the ordering
exists to get the number right, not to be followed.

### Output

```ts
export interface EssenceBudget {
  essence: EssenceType;
  /** Total essence the remaining plan consumes from this pool. */
  required: number;
  /** Hours of mining that implies at the current rate for this essence. */
  hours: number;
}
```

`PotencyPlan` gains `budget: EssenceBudget[]`. Per-rank ETAs stay, labelled
explicitly as a floor that assumes all mining serves this plan.

No phase headers in the buy order. The ordering is why the numbers are what they
are, not an instruction.

### Blocked cases

Existing: an altar not running means its runes never arrive. New: an essence with
no income (unmineable) starves its pool, so the ranks priced in its runes are
unreachable for the same reason and report the same way.

## Testing

**Engine**

- `supplyFactor` at all three regimes: altar-limited, essence-limited, exactly
  balanced.
- `sustainedRunesPerHour === runesPerHour` whenever altar-limited — pins the
  strict-generalisation claim.
- `sustainedNet === netEssencePerHour` when altar-limited; `0` when the pool is
  starved and unmined.
- Golden test unchanged, since `netEssencePerHour` is untouched.

**Scheduler**

- Total time is never below the essence-limited floor `Σ (required ÷ income)`.
- Jagged is never mined and never appears in the budget.
- Budget totals reconcile with the rune totals through the conversion rate.
- An altar-limited build reproduces today's numbers exactly — the regression that
  proves nothing was broken for players already in that regime.

**UI**

- Selecting a mining essence changes the ledger's live cell and the potency
  budget.
- Share links from before the change still decode, with `mining` defaulting to
  Soft.

## Out of scope, recorded

- **Recommending altars be turned off.** If you need brine but not ash, both
  drain Soft, so a running Ash altar steals essence from the runes you want.
  Real, and it turns scheduling into a small search. Follow-up.
- **Modelling the orb exchange sink.** Would need exchange rates the app has
  deliberately never claimed to know.

## Expected consequence

Times will get substantially longer for essence-limited builds. That is the bug
being fixed, but it will look alarming next to today's figures, and the release
note should say so plainly.
