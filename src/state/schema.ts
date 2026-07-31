/**
 * Serialization for saved builds.
 *
 * Two representations, one source of truth:
 *  - JSON  (export/import, localStorage) — keyed and readable, tolerant of
 *    missing fields so older saves keep working as the schema grows.
 *  - packed array (share URLs) — a fixed-order list of numbers, which is what
 *    makes a link short enough to paste. FIELD_ORDER is append-only: never
 *    reorder or remove an entry, or existing links will decode to nonsense.
 */

import { ALTAR_IDS, ESSENCE_UPGRADES, EXCHANGE_UPGRADES, SPELL_IDS } from '../calc/constants';
import { CARD_TIERS } from '../calc/types';
import type {
  AltarId,
  ArcanistInput,
  CardTier,
  EssenceUpgradeId,
  ExchangeUpgradeId,
  ExternalBonuses,
  SpellId,
} from '../calc/types';
import { FRESH_INPUT } from '../presets/fresh';

export const SCHEMA_VERSION = 1;

export interface SavedBuild {
  version: number;
  input: ArcanistInput;
}

// ---------------------------------------------------------------------------
// Coercion — anything coming from disk, a URL or another user is untrusted.
// ---------------------------------------------------------------------------

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const int = (value: unknown, fallback: number): number => Math.trunc(num(value, fallback));

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : value === 1 ? true : value === 0 ? false : fallback;

const tier = (value: unknown, fallback: CardTier): CardTier =>
  typeof value === 'string' && (CARD_TIERS as readonly string[]).includes(value)
    ? (value as CardTier)
    : fallback;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

/** Rebuild a complete, in-range ArcanistInput from arbitrary input. */
export function coerceInput(raw: unknown): ArcanistInput {
  const data = asRecord(raw);
  const essenceRaw = asRecord(data.essence);
  const altarsRaw = asRecord(data.altars);
  const spellsRaw = asRecord(data.spells);
  const exchangeRaw = asRecord(data.exchange);
  const externalRaw = asRecord(data.external);
  const cardSpellRaw = asRecord(externalRaw.cardSpell);

  const essence = {} as Record<EssenceUpgradeId, number>;
  for (const def of ESSENCE_UPGRADES) {
    essence[def.id] = Math.min(Math.max(int(essenceRaw[def.id], 0), 0), def.max);
  }

  const altars = {} as Record<AltarId, ArcanistInput['altars'][AltarId]>;
  for (const id of ALTAR_IDS) {
    const src = asRecord(altarsRaw[id]);
    const fallback = FRESH_INPUT.altars[id];
    altars[id] = {
      unlocked: bool(src.unlocked, fallback.unlocked),
      active: bool(src.active, fallback.active),
      capacity: Math.min(Math.max(int(src.capacity, 0), 0), 25),
      travel: Math.min(Math.max(int(src.travel, 0), 0), 10),
      craft: Math.min(Math.max(int(src.craft, 0), 0), 10),
    };
  }

  const spells = {} as Record<SpellId, ArcanistInput['spells'][SpellId]>;
  for (const id of SPELL_IDS) {
    const src = asRecord(spellsRaw[id]);
    spells[id] = {
      unlocked: bool(src.unlocked, false),
      level: Math.min(Math.max(int(src.level, 0), 0), 50),
      rank: Math.min(Math.max(int(src.rank, 0), 0), 10),
    };
  }

  const exchange = {} as Record<ExchangeUpgradeId, number>;
  for (const def of EXCHANGE_UPGRADES) {
    exchange[def.id] = Math.min(Math.max(int(exchangeRaw[def.id], 0), 0), def.max);
  }

  const base = FRESH_INPUT.external;
  const cardSpell = {} as Record<SpellId, CardTier>;
  for (const id of SPELL_IDS) cardSpell[id] = tier(cardSpellRaw[id], 'none');

  const external: ExternalBonuses = {
    cardSoftMaxLoot: tier(externalRaw.cardSoftMaxLoot, base.cardSoftMaxLoot),
    cardDenseMaxLoot: tier(externalRaw.cardDenseMaxLoot, base.cardDenseMaxLoot),
    cardJaggedMaxLoot: tier(externalRaw.cardJaggedMaxLoot, base.cardJaggedMaxLoot),
    cardAshCraft: tier(externalRaw.cardAshCraft, base.cardAshCraft),
    cardBrineCraft: tier(externalRaw.cardBrineCraft, base.cardBrineCraft),
    cardChasmCraft: tier(externalRaw.cardChasmCraft, base.cardChasmCraft),
    cardSpell,
    cardSuperShiny: tier(externalRaw.cardSuperShiny, base.cardSuperShiny),
    arcaneCardCount: Math.max(int(externalRaw.arcaneCardCount, base.arcaneCardCount), 0),
    petMaxEssence: bool(externalRaw.petMaxEssence, base.petMaxEssence),
    petBrittle: num(externalRaw.petBrittle, base.petBrittle),
    petShiny: num(externalRaw.petShiny, base.petShiny),
    petSpellPotency: num(externalRaw.petSpellPotency, base.petSpellPotency),
    obeliskShiny: bool(externalRaw.obeliskShiny, base.obeliskShiny),
    obeliskSuperShiny: bool(externalRaw.obeliskSuperShiny, base.obeliskSuperShiny),
    skillShiny: bool(externalRaw.skillShiny, base.skillShiny),
    skillBrittle: bool(externalRaw.skillBrittle, base.skillBrittle),
    storeShiny: bool(externalRaw.storeShiny, base.storeShiny),
    constructSuperShiny: num(externalRaw.constructSuperShiny, base.constructSuperShiny),
    contractRuneCraft: num(externalRaw.contractRuneCraft, base.contractRuneCraft),
    storeRuneCraft: num(externalRaw.storeRuneCraft, base.storeRuneCraft),
    spellDurationMulti: num(externalRaw.spellDurationMulti, base.spellDurationMulti),
  };

  return { essence, altars, spells, exchange, external };
}

// ---------------------------------------------------------------------------
// JSON (export / import / localStorage)
// ---------------------------------------------------------------------------

export function toSavedBuild(input: ArcanistInput): SavedBuild {
  return { version: SCHEMA_VERSION, input };
}

/** Accepts a SavedBuild, a bare ArcanistInput, or junk. Never throws. */
export function fromSavedBuild(raw: unknown): ArcanistInput {
  const data = asRecord(raw);
  return coerceInput('input' in data ? data.input : data);
}

// ---------------------------------------------------------------------------
// Packed array (share URLs)
// ---------------------------------------------------------------------------

interface Field {
  get: (input: ArcanistInput) => number;
  set: (input: ArcanistInput, value: number) => void;
}

const tierIndex = (t: CardTier) => Math.max(CARD_TIERS.indexOf(t), 0);
const tierAt = (i: number): CardTier => CARD_TIERS[i] ?? 'none';

function externalField<K extends keyof ExternalBonuses>(
  key: K,
  encode: (value: ExternalBonuses[K]) => number,
  decode: (value: number) => ExternalBonuses[K],
): Field {
  return {
    get: (input) => encode(input.external[key]),
    set: (input, value) => {
      input.external[key] = decode(value);
    },
  };
}

const numberField = (key: keyof ExternalBonuses): Field => ({
  get: (input) => input.external[key] as number,
  set: (input, value) => {
    (input.external[key] as number) = value;
  },
});

const boolField = (key: keyof ExternalBonuses): Field => ({
  get: (input) => (input.external[key] ? 1 : 0),
  set: (input, value) => {
    (input.external[key] as boolean) = value === 1;
  },
});

const cardField = (key: keyof ExternalBonuses): Field =>
  externalField(key, (v) => tierIndex(v as CardTier), (v) => tierAt(v) as never);

/** A retired slot. Holds its position so older links keep decoding. */
const RESERVED: Field = { get: () => 0, set: () => {} };

/**
 * APPEND-ONLY. Adding a field at the end is safe: short arrays decode with
 * defaults for the missing tail. Reordering breaks every link ever shared.
 */
const FIELD_ORDER: Field[] = [
  ...ESSENCE_UPGRADES.map(
    (def): Field => ({
      get: (input) => input.essence[def.id],
      set: (input, value) => {
        input.essence[def.id] = value;
      },
    }),
  ),
  ...ALTAR_IDS.flatMap((id): Field[] => [
    {
      get: (input) => (input.altars[id].unlocked ? 1 : 0),
      set: (input, value) => {
        input.altars[id].unlocked = value === 1;
      },
    },
    {
      get: (input) => (input.altars[id].active ? 1 : 0),
      set: (input, value) => {
        input.altars[id].active = value === 1;
      },
    },
    {
      get: (input) => input.altars[id].capacity,
      set: (input, value) => {
        input.altars[id].capacity = value;
      },
    },
    {
      get: (input) => input.altars[id].travel,
      set: (input, value) => {
        input.altars[id].travel = value;
      },
    },
    {
      get: (input) => input.altars[id].craft,
      set: (input, value) => {
        input.altars[id].craft = value;
      },
    },
  ]),
  ...SPELL_IDS.flatMap((id): Field[] => [
    {
      get: (input) => (input.spells[id].unlocked ? 1 : 0),
      set: (input, value) => {
        input.spells[id].unlocked = value === 1;
      },
    },
    {
      get: (input) => input.spells[id].level,
      set: (input, value) => {
        input.spells[id].level = value;
      },
    },
    {
      get: (input) => input.spells[id].rank,
      set: (input, value) => {
        input.spells[id].rank = value;
      },
    },
  ]),
  ...EXCHANGE_UPGRADES.map(
    (def): Field => ({
      get: (input) => input.exchange[def.id],
      set: (input, value) => {
        input.exchange[def.id] = value;
      },
    }),
  ),
  // Retired: was the Infernal card multiplier, before it turned out no
  // Arcanist card can be Infernal. The slot stays so links made while it
  // existed still decode; removing it would shift every field after it.
  RESERVED,
  cardField('cardSoftMaxLoot'),
  cardField('cardDenseMaxLoot'),
  cardField('cardJaggedMaxLoot'),
  cardField('cardAshCraft'),
  cardField('cardBrineCraft'),
  cardField('cardChasmCraft'),
  ...SPELL_IDS.map(
    (id): Field => ({
      get: (input) => tierIndex(input.external.cardSpell[id]),
      set: (input, value) => {
        input.external.cardSpell[id] = tierAt(value);
      },
    }),
  ),
  cardField('cardSuperShiny'),
  numberField('arcaneCardCount'),
  boolField('petMaxEssence'),
  numberField('petBrittle'),
  numberField('petShiny'),
  numberField('petSpellPotency'),
  boolField('obeliskShiny'),
  boolField('obeliskSuperShiny'),
  boolField('skillShiny'),
  boolField('skillBrittle'),
  boolField('storeShiny'),
  numberField('constructSuperShiny'),
  numberField('contractRuneCraft'),
  numberField('storeRuneCraft'),
  numberField('spellDurationMulti'),
];

export const PACKED_FIELD_COUNT = FIELD_ORDER.length;

export function packFields(input: ArcanistInput): number[] {
  return FIELD_ORDER.map((field) => field.get(input));
}

export function unpackFields(values: readonly number[]): ArcanistInput {
  const input = structuredClone(FRESH_INPUT);
  FIELD_ORDER.forEach((field, i) => {
    const value = values[i];
    if (typeof value === 'number' && Number.isFinite(value)) field.set(input, value);
  });
  // Run through coercion so out-of-range values in a hand-edited link are clamped.
  return coerceInput(input);
}
