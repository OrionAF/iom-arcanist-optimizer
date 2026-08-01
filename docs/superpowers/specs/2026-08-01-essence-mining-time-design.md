# Essence mining time in the Spell Potency Path

**Date:** 2026-08-01
**Status:** stage 1 shipped; stage 2 built, then removed

**Postmortem (2026-08-01).** Stage 1 — exclusive mining and supply-limited altars
— was right and is in. Stage 2 was not, and has been deleted.

The mistake was the horizon, and it predates this document: the potency path
always planned to rank 10, and this spec inherited that framing without either
party questioning it. Three weeks of projection in a game where every purchase
moves the rates. Worse, it re-derived what the Optimizer already said in a
single line — "Prismism Potency 4→5, +4.2 runes/hr, 6.71K brine" — and then
continued into ranks the Optimizer correctly scores at zero, because four of the
six spells affect nothing this app models.

The redeeming detail is that stage 1 made the fix free. Sustained runes are
`ratio × min(supply, demand)`, so on a starved pool ranking by sustained runes
per hour *is* ranking by runes per essence. The efficiency view stage 2 was
groping toward already existed one panel over.

What survived: the engine supply model, and a one-purchase time-to-afford on
Optimizer rows. What went: `potency.ts`, its tests, and its panel.

Kept for the reasoning, not as a plan of record.

**Audience note.** The app has one user, who has said not to design around share
link compatibility. Backwards compatibility is therefore not a constraint here;
failing *loudly* on a stale link still is, since silently decoding to the wrong
build is a correctness bug rather than a compatibility one.

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

One part of the output escapes this caveat. When to switch an altar off does not
depend on how you split your mining time — an altar that has already produced
every rune the plan needs is burning essence for nothing whenever you reach that
point. That is advice the model can give honestly. See *Altar shutdown*.

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

Added to `FIELD_ORDER`, encoded as an index into `ESSENCE_TYPES` — the same
convention `cardField` uses for tiers, with an out-of-range value coercing to
`soft` rather than throwing. Default is `soft`.

`SCHEMA_VERSION` moves to 4 and `PACK_FORMAT` from `r` to `s`.

**Old share links are not preserved.** The app currently has one user, who has
said not to design around link compatibility. The format marker still moves, so
a stale link fails the prefix check and reports "couldn't be read" rather than
silently decoding to the wrong build — that guard costs one character and is
worth keeping whatever the user count.

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

### Altar shutdown

Each rune type comes from exactly one altar, and the conversion ratio is

```
runesPerHour ÷ essenceCostPerHour = (1 + craft × 0.2) × (1 + card) × runeCraftMulti
```

with capacity and cycle time cancelling. Two consequences:

- **There is no substitution and therefore no search.** Ash runes come only from
  the Ash altar at a fixed essence price. Turning an altar off cannot make
  another altar's runes cheaper, so the total Soft the plan needs is fixed at
  `N_ash ÷ ratio_ash + N_brine ÷ ratio_brine`.
- **Running an altar past its requirement is pure waste.** It keeps converting
  Soft into runes the plan does not need, and on a shared pool that is essence
  the other altar could have used.

So the rule is: **run each altar until its rune requirement is met, then stop.**
The simulation already tracks when each rune type is satisfied, so this is a
recorded timestamp rather than new machinery. An altar whose rune type the plan
does not need at all is off from the start, which falls out of the same rule.

Only the Soft pool has two altars competing (Ash and Brine); Chasm is alone on
Dense, so its shutdown time is informational rather than a saving.

The budget assumes this management. Leaving an altar running past its
requirement makes the real Soft consumption higher than the budget states, which
is exactly what the shutdown times are for.

```ts
export interface AltarSchedule {
  altar: AltarId;
  /** Hours from now when this altar has made every rune the plan needs. */
  stopAt: number;
  /** False when the plan needs none of its runes — do not run it at all. */
  neededAtAll: boolean;
}
```

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

`PotencyPlan` gains `budget: EssenceBudget[]` and `altars: AltarSchedule[]`.
Per-rank ETAs stay, labelled explicitly as a floor that assumes all mining serves
this plan.

No phase headers in the buy order. The ordering is why the numbers are what they
are, not an instruction.

The panel therefore shows three things: what the plan costs in essence, how long
that is at your rates, and when each altar can be switched off. The last is the
only part that is genuinely advice, because it does not depend on how you split
your mining time — an altar that has made its runes is waste whenever you get
there.

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
- Budget totals reconcile with the rune totals through the conversion rate —
  `required ≈ Σ (runes needed ÷ ratio)` for the altars on that pool. This is the
  test that would catch the whole feature being subtly wrong.
- An altar-limited build reproduces today's numbers exactly — the regression that
  proves nothing was broken for players already in that regime.

**Altar shutdown**

- `stopAt` is never later than the plan's total, and never earlier than the last
  rank priced in that altar's rune.
- `neededAtAll` is false exactly when no remaining rank uses that rune.
- The conversion ratio is independent of capacity and travel — pinned directly,
  since the no-search argument rests on it. If a balance patch made capacity
  affect the ratio, altar choice would become a real search and this test is
  what would say so.

**UI**

- Selecting a mining essence changes the ledger's live cell and the potency
  budget.
- A build whose plan needs no ash runes shows the Ash altar as "don't run".

## Out of scope, recorded

- **Modelling the orb exchange sink.** Would need exchange rates the app has
  deliberately never claimed to know.
- **Recommending altar *upgrades* for efficiency.** Craft level and the altar
  card both raise the conversion ratio, so they reduce the essence the plan
  needs — a genuine trade against their orb cost, but it belongs to the main
  optimizer rather than here.

## Expected consequence

Times will get substantially longer for essence-limited builds. That is the bug
being fixed, but it will look alarming next to today's figures, and the release
note should say so plainly.
