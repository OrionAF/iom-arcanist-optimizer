/**
 * Serialization for saved builds.
 *
 * Two representations, one source of truth:
 *  - JSON  (export/import, localStorage) — keyed and readable, and migrated
 *    forward when the shape changes so a saved build survives an upgrade.
 *  - packed array (share URLs) — a fixed-order list of numbers, which is what
 *    makes a link short enough to paste. FIELD_ORDER is append-only within a
 *    version: never reorder or remove an entry, or existing links decode to
 *    nonsense. When the order must change, bump PACK_FORMAT so old tokens are
 *    rejected loudly instead.
 */

import {
  ALTAR_IDS,
  CONTRACT_RUNE_CRAFT,
  ESSENCE_UPGRADES,
  EXCHANGE_UPGRADES,
  PET,
  SPELL_IDS,
  UNLOCKS,
  WIZARD,
} from '../calc/constants';
import {
  CARD_TIERS,
  CURRENCY_CATEGORIES,
  ESSENCE_TYPES,
  ORB_CARD_IDS,
  RHINO_CARD_TIERS,
} from '../calc/types';
import type {
  AltarId,
  ArcanistInput,
  CardTier,
  CurrencyCategory,
  EssenceType,
  EssenceUpgradeDef,
  EssenceUpgradeId,
  ExchangeUpgradeDef,
  ExchangeUpgradeId,
  ExternalBonuses,
  OrbCardId,
  RhinoCardTier,
  SpellId,
  OfferCategory,
  WizardInput,
  WizardOffer,
} from '../calc/types';
import { FRESH_INPUT, FRESH_WIZARD } from '../presets/fresh';

/**
 * 1 — original flat ExternalBonuses (raw numbers like `petBrittle: 0.05`).
 * 2 — cards / pets / unlocks groups, with levels and unlocks as the input.
 * 3 — Exchange trimmed to the two upgrades the Arcanist reads.
 * 4 — `mining`: which essence the Arcanist is currently mining.
 * 5 — Arcanist batch 2: nineteen essence upgrades, two Exchange upgrades,
 *     Necrotic as a fourth `mining` value, the Spellslinger Bundle, and the
 *     Infernal Rhino card with its typed-in ultra shiny chance.
 * 6 — the Drift and Echo altars with their rune cards, seven batch 2 spells,
 *     and cards for Necrotic Essence and the batch 2 spells.
 * 7 — Black Hole Level 30, the Hydra Star and Divine Challenge 24, all
 *     Arcanist Spell Power.
 * 8 — the Wizard Exchange: wizard stats and levels, comfort hours, PP per 100
 *     Large Resource Packs, the Currency Preference order, Orbs Traded per
 *     colour, and the two Currency Preference bars.
 *
 * JSON needs no migration for any of these: parsing walks the definitions it
 * knows and defaults anything absent, so an older export loads with `mining`
 * at its fresh value and any dropped Exchange levels quietly discarded. The
 * packed share format is positional; v3 and v4 had to move PACK_FORMAT, but v5
 * and v6 only append fields, so v4 links still decode.
 */
export const SCHEMA_VERSION = 8;

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

const rhinoTier = (value: unknown, fallback: RhinoCardTier): RhinoCardTier =>
  typeof value === 'string' && (RHINO_CARD_TIERS as readonly string[]).includes(value)
    ? (value as RhinoCardTier)
    : fallback;

/**
 * The most an Infernal Rhino card's ultra shiny chance is accepted as, in
 * percent. Not a game figure — the real range is unknown — only a guard
 * against a typo or a hand-edited link producing a chance above certainty.
 */
export const MAX_RHINO_ULTRA_SHINY_PERCENT = 100;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * Bring a v1 ExternalBonuses forward.
 *
 * v1 stored the derived numbers; v2 stores what the player owns. Every
 * conversion here is exact — v1's values were themselves computed from these
 * inputs by fixed formulas, so dividing back out recovers the original.
 */
function migrateExternalV1(raw: Record<string, unknown>): unknown {
  const spellCards = asRecord(raw.cardSpell);

  // Quest shiny = (questLevel * step) + step, so level 0 already grants one step.
  const questShiny = num(raw.petShiny, 0);
  const questSteps = questShiny > 0 ? Math.round(questShiny / PET.questShinyPerStep) : 0;

  const statueSuperShiny = num(raw.constructSuperShiny, 0);

  return {
    cards: {
      essence: {
        soft: raw.cardSoftMaxLoot,
        dense: raw.cardDenseMaxLoot,
        jagged: raw.cardJaggedMaxLoot,
      },
      rune: {
        ash: raw.cardAshCraft,
        brine: raw.cardBrineCraft,
        chasm: raw.cardChasmCraft,
      },
      spell: spellCards,
      // v1 had no orb cards; they were folded into the manual arcaneCardCount.
      orb: {},
    },
    pets: {
      rhinoLevel: Math.round(num(raw.petBrittle, 0) / PET.brittlePerLevel),
      rhinoSkin: bool(raw.petMaxEssence, false),
      rhinoQuestSkin: questSteps > 0,
      rhinoQuestLevel: Math.max(questSteps - 1, 0),
      rhinoCard: raw.cardSuperShiny,
    },
    unlocks: {
      worldQuest25: bool(raw.obeliskShiny, false),
      worldQuest29: bool(raw.obeliskSuperShiny, false),
      // v1 tracked the two halves of this unlock separately.
      straightOuttaYanille: bool(raw.skillShiny, false) || bool(raw.skillBrittle, false),
      arcanistBundle: bool(raw.storeShiny, false),
      statueOfNatureGilded: statueSuperShiny > 0,
      w4GildedStatues: Math.round(statueSuperShiny / UNLOCKS.statueSuperShinyPerStatue),
    },
    contractRuneCraftLevel: Math.round(
      num(raw.contractRuneCraft, 0) / CONTRACT_RUNE_CRAFT.perLevel,
    ),
  };
}

// ---------------------------------------------------------------------------
// Coercion into the current shape
// ---------------------------------------------------------------------------

function coerceExternal(raw: unknown): ExternalBonuses {
  let data = asRecord(raw);
  // A v1 payload has no `cards` group but does have the old flat card fields.
  if (!('cards' in data) && 'cardSoftMaxLoot' in data) {
    data = asRecord(migrateExternalV1(data));
  }

  const cards = asRecord(data.cards);
  const essenceCards = asRecord(cards.essence);
  const runeCards = asRecord(cards.rune);
  const spellCards = asRecord(cards.spell);
  const orbCards = asRecord(cards.orb);
  const pets = asRecord(data.pets);
  const unlocks = asRecord(data.unlocks);

  const essence = {} as Record<EssenceType, CardTier>;
  for (const type of ESSENCE_TYPES) essence[type] = tier(essenceCards[type], 'none');

  const rune = {} as Record<AltarId, CardTier>;
  for (const id of ALTAR_IDS) rune[id] = tier(runeCards[id], 'none');

  const spell = {} as Record<SpellId, CardTier>;
  for (const id of SPELL_IDS) spell[id] = tier(spellCards[id], 'none');

  const orb = {} as Record<OrbCardId, CardTier>;
  for (const id of ORB_CARD_IDS) orb[id] = tier(orbCards[id], 'none');

  return {
    cards: { essence, rune, spell, orb },
    pets: {
      rhinoLevel: clamp(int(pets.rhinoLevel, 0), PET.maxLevel),
      rhinoSkin: bool(pets.rhinoSkin, false),
      rhinoQuestSkin: bool(pets.rhinoQuestSkin, false),
      rhinoQuestLevel: clamp(int(pets.rhinoQuestLevel, 0), PET.maxQuestLevel),
      rhinoCard: rhinoTier(pets.rhinoCard, 'none'),
      rhinoInfernalUltraShiny: clamp(
        num(pets.rhinoInfernalUltraShiny, 0),
        MAX_RHINO_ULTRA_SHINY_PERCENT,
      ),
    },
    unlocks: {
      worldQuest25: bool(unlocks.worldQuest25, false),
      worldQuest29: bool(unlocks.worldQuest29, false),
      straightOuttaYanille: bool(unlocks.straightOuttaYanille, false),
      arcanistBundle: bool(unlocks.arcanistBundle, false),
      spellslingerBundle: bool(unlocks.spellslingerBundle, false),
      statueOfNatureGilded: bool(unlocks.statueOfNatureGilded, false),
      w4GildedStatues: clamp(int(unlocks.w4GildedStatues, 0), UNLOCKS.maxW4GildedStatues),
      blackHole30: bool(unlocks.blackHole30, false),
      divineChallenge24: bool(unlocks.divineChallenge24, false),
      hydraStarLevel: clamp(int(unlocks.hydraStarLevel, 0), UNLOCKS.maxHydraStarLevel),
    },
    contractRuneCraftLevel: clamp(
      int(data.contractRuneCraftLevel, 0),
      CONTRACT_RUNE_CRAFT.maxLevel,
    ),
  };
}

/**
 * The Currency Preference order, repaired. Anything that is not a full
 * permutation — a duplicate, an unknown name, a category missing — falls back
 * to the default order rather than guessing which entry was meant.
 */
function coercePreference(raw: unknown): CurrencyCategory[] {
  if (!Array.isArray(raw) || raw.length !== CURRENCY_CATEGORIES.length) {
    return [...FRESH_WIZARD.preference];
  }
  const seen = new Set(raw);
  const valid =
    seen.size === CURRENCY_CATEGORIES.length &&
    CURRENCY_CATEGORIES.every((category) => seen.has(category));
  return valid ? (raw as CurrencyCategory[]) : [...FRESH_WIZARD.preference];
}

/** No typed stat is meaningful past this; a guard against typos, not a game figure. */
const MAX_WIZARD_MULTI = 1e6;

function coerceWizard(raw: unknown): WizardInput {
  const data = asRecord(raw);
  const traded = asRecord(data.traded);
  const fresh = FRESH_WIZARD;
  const percent = (value: unknown, fallback: number) => clamp(num(value, fallback), 100);
  const multi = (value: unknown, fallback: number) => clamp(num(value, fallback), MAX_WIZARD_MULTI);

  const perColour = (src: Record<string, unknown>) => {
    const out = {} as Record<OrbCardId, number>;
    for (const id of ORB_CARD_IDS) out[id] = Math.max(num(src[id], 0), 0);
    return out;
  };

  return {
    lootMulti: multi(data.lootMulti, fresh.lootMulti),
    partyChance: percent(data.partyChance, fresh.partyChance),
    partyMulti: multi(data.partyMulti, fresh.partyMulti),
    blindChance: percent(data.blindChance, fresh.blindChance),
    discoChance: percent(data.discoChance, fresh.discoChance),
    flashbangChance: percent(data.flashbangChance, fresh.flashbangChance),
    wizardCount: Math.min(
      Math.max(int(data.wizardCount, fresh.wizardCount), WIZARD.minWizards),
      WIZARD.maxWizards,
    ),
    exchangeTimerLevel: clamp(int(data.exchangeTimerLevel, 0), WIZARD.maxTimerLevel),
    polyOrbLevel: clamp(int(data.polyOrbLevel, 0), WIZARD.maxPolyOrbLevel),
    comfortHours: Math.max(num(data.comfortHours, fresh.comfortHours), 0),
    ppPer100Packs: Math.max(num(data.ppPer100Packs, 0), 0),
    preference: coercePreference(data.preference),
    negligibleBar: clamp(int(data.negligibleBar, fresh.negligibleBar), CURRENCY_CATEGORIES.length),
    gapBar: clamp(int(data.gapBar, fresh.gapBar), CURRENCY_CATEGORIES.length),
    traded: perColour(traded),
  };
}

const OFFER_CATEGORIES: readonly OfferCategory[] = [...CURRENCY_CATEGORIES, 'pp'];

/**
 * Wizard offers saved in this browser. Unlike a build they are never shared,
 * but storage can still hold anything, so each offer is rebuilt and anything
 * unreadable is dropped.
 */
export function coerceOffers(raw: unknown): WizardOffer[] {
  if (!Array.isArray(raw)) return [];
  const out: WizardOffer[] = [];
  for (const item of raw.slice(0, WIZARD.maxWizards)) {
    const data = asRecord(item);
    const colour = data.colour as OrbCardId;
    if (!ORB_CARD_IDS.includes(colour)) continue;
    const slot1 = asRecord(data.slot1);
    const tierValue = int(slot1.tier, 0);
    const extras = Array.isArray(data.extras) ? data.extras : [];
    out.push({
      id: typeof data.id === 'string' && data.id ? data.id : `offer-${out.length}-${Date.now()}`,
      colour,
      orbs: Math.max(num(data.orbs, 0), 0),
      party: bool(data.party, false),
      blind: bool(data.blind, false),
      slot1: {
        kind: slot1.kind === 'rune' ? 'rune' : 'essence',
        tier: (tierValue === 1 || tierValue === 2 ? tierValue : 0) as 0 | 1 | 2,
        amount: Math.max(num(slot1.amount, 0), 0),
      },
      extras: extras
        .slice(0, 2)
        .map(asRecord)
        .filter((e) => OFFER_CATEGORIES.includes(e.category as OfferCategory))
        .map((e) => ({
          category: e.category as OfferCategory,
          amount: Math.max(num(e.amount, 0), 0),
        })),
      traded: bool(data.traded, false),
    });
  }
  return out;
}

/** Rebuild a complete, in-range ArcanistInput from arbitrary input. */
export function coerceInput(raw: unknown): ArcanistInput {
  const data = asRecord(raw);
  const essenceRaw = asRecord(data.essence);
  const altarsRaw = asRecord(data.altars);
  const spellsRaw = asRecord(data.spells);
  const exchangeRaw = asRecord(data.exchange);

  const essence = {} as Record<EssenceUpgradeId, number>;
  for (const def of ESSENCE_UPGRADES) {
    essence[def.id] = clamp(int(essenceRaw[def.id], 0), def.max);
  }

  const altars = {} as Record<AltarId, ArcanistInput['altars'][AltarId]>;
  for (const id of ALTAR_IDS) {
    const src = asRecord(altarsRaw[id]);
    const fallback = FRESH_INPUT.altars[id];
    altars[id] = {
      unlocked: bool(src.unlocked, fallback.unlocked),
      active: bool(src.active, fallback.active),
      capacity: clamp(int(src.capacity, 0), 25),
      travel: clamp(int(src.travel, 0), 10),
      craft: clamp(int(src.craft, 0), 10),
    };
  }

  const spells = {} as Record<SpellId, ArcanistInput['spells'][SpellId]>;
  for (const id of SPELL_IDS) {
    const src = asRecord(spellsRaw[id]);
    spells[id] = {
      unlocked: bool(src.unlocked, false),
      level: clamp(int(src.level, 0), 50),
      rank: clamp(int(src.rank, 0), 10),
    };
  }

  const exchange = {} as Record<ExchangeUpgradeId, number>;
  for (const def of EXCHANGE_UPGRADES) {
    exchange[def.id] = clamp(int(exchangeRaw[def.id], 0), def.max);
  }

  return {
    essence,
    altars,
    spells,
    exchange,
    external: coerceExternal(data.external),
    mining: ESSENCE_TYPES.includes(data.mining as EssenceType)
      ? (data.mining as EssenceType)
      : FRESH_INPUT.mining,
    wizard: coerceWizard(data.wizard),
  };
}

// ---------------------------------------------------------------------------
// JSON (export / import / localStorage)
// ---------------------------------------------------------------------------

export function toSavedBuild(input: ArcanistInput): SavedBuild {
  return { version: SCHEMA_VERSION, input };
}

/** Accepts a SavedBuild of any version, a bare ArcanistInput, or junk. */
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

const cardField = (
  block: keyof ExternalBonuses['cards'],
  key: string,
): Field => ({
  get: (input) =>
    tierIndex((input.external.cards[block] as Record<string, CardTier>)[key] ?? 'none'),
  set: (input, value) => {
    (input.external.cards[block] as Record<string, CardTier>)[key] = tierAt(value);
  },
});

const petField = (key: keyof ExternalBonuses['pets']): Field => ({
  get: (input) => {
    const value = input.external.pets[key];
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value;
    // The Rhino card. This used to fall through to 0, so every link shipped
    // before batch 2 carried the card as None whatever its tier.
    return Math.max(RHINO_CARD_TIERS.indexOf(value), 0);
  },
  set: (input, value) => {
    const current = input.external.pets[key];
    if (typeof current === 'boolean') (input.external.pets[key] as boolean) = value === 1;
    else if (typeof current === 'number') (input.external.pets[key] as number) = value;
    else (input.external.pets[key] as RhinoCardTier) = RHINO_CARD_TIERS[value] ?? 'none';
  },
});

const essenceField = (def: EssenceUpgradeDef): Field => ({
  get: (input) => input.essence[def.id],
  set: (input, value) => {
    input.essence[def.id] = value;
  },
});

const exchangeField = (def: ExchangeUpgradeDef): Field => ({
  get: (input) => input.exchange[def.id],
  set: (input, value) => {
    input.exchange[def.id] = value;
  },
});

/*
 * What a v4 link carries, listed so the prefix never moves when the game adds
 * rows. Everything else is appended, in the v5 and v6 tails below.
 */
const V4_ESSENCE_UPGRADE_COUNT = 15;
const V4_EXCHANGE_UPGRADE_COUNT = 2;
const V4_ESSENCE_CARDS: readonly EssenceType[] = ['soft', 'dense', 'jagged'];
const V4_ALTAR_IDS: readonly AltarId[] = ['ash', 'brine', 'chasm'];
const V4_SPELL_IDS: readonly SpellId[] = SPELL_IDS.slice(0, 6);

const V4_ESSENCE_UPGRADES = ESSENCE_UPGRADES.slice(0, V4_ESSENCE_UPGRADE_COUNT);
const V4_EXCHANGE_UPGRADES = EXCHANGE_UPGRADES.slice(0, V4_EXCHANGE_UPGRADE_COUNT);
const ESSENCE_CARDS_AFTER_V4 = ESSENCE_TYPES.filter((type) => !V4_ESSENCE_CARDS.includes(type));
const ALTARS_AFTER_V4 = ALTAR_IDS.filter((id) => !V4_ALTAR_IDS.includes(id));
const SPELLS_AFTER_V4 = SPELL_IDS.filter((id) => !V4_SPELL_IDS.includes(id));

const altarFields = (id: AltarId): Field[] => [
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
];

const spellFields = (id: SpellId): Field[] => [
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
];

type WizardNumberKey = {
  [K in keyof WizardInput]: WizardInput[K] extends number ? K : never;
}[keyof WizardInput];

const wizardField = (key: WizardNumberKey): Field => ({
  get: (input) => input.wizard[key],
  set: (input, value) => {
    input.wizard[key] = value;
  },
});

/** One position in the Currency Preference order, as an index into CURRENCY_CATEGORIES. */
const preferenceField = (position: number): Field => ({
  get: (input) => Math.max(CURRENCY_CATEGORIES.indexOf(input.wizard.preference[position]!), 0),
  set: (input, value) => {
    // Written as-is; coerceInput repairs anything that is not a permutation.
    input.wizard.preference[position] = CURRENCY_CATEGORIES[value] ?? ('' as CurrencyCategory);
  },
});

const tradedField = (id: OrbCardId): Field => ({
  get: (input) => input.wizard.traded[id],
  set: (input, value) => {
    input.wizard.traded[id] = value;
  },
});

const unlockField = (key: keyof ExternalBonuses['unlocks']): Field => ({
  get: (input) => {
    const value = input.external.unlocks[key];
    return typeof value === 'boolean' ? (value ? 1 : 0) : value;
  },
  set: (input, value) => {
    const current = input.external.unlocks[key];
    if (typeof current === 'boolean') (input.external.unlocks[key] as boolean) = value === 1;
    else (input.external.unlocks[key] as number) = value;
  },
});

/**
 * APPEND-ONLY within a pack format. Adding a field at the end is safe: short
 * arrays decode with defaults for the missing tail. Reordering or removing
 * requires bumping PACK_FORMAT.
 */
const FIELD_ORDER: Field[] = [
  ...V4_ESSENCE_UPGRADES.map(essenceField),
  ...V4_ALTAR_IDS.flatMap(altarFields),
  ...V4_SPELL_IDS.flatMap(spellFields),
  ...V4_EXCHANGE_UPGRADES.map(exchangeField),
  ...V4_ESSENCE_CARDS.map((type) => cardField('essence', type)),
  ...V4_ALTAR_IDS.map((id) => cardField('rune', id)),
  ...V4_SPELL_IDS.map((id) => cardField('spell', id)),
  ...ORB_CARD_IDS.map((id) => cardField('orb', id)),
  petField('rhinoLevel'),
  petField('rhinoSkin'),
  petField('rhinoQuestSkin'),
  petField('rhinoQuestLevel'),
  petField('rhinoCard'),
  unlockField('worldQuest25'),
  unlockField('worldQuest29'),
  unlockField('straightOuttaYanille'),
  unlockField('arcanistBundle'),
  unlockField('statueOfNatureGilded'),
  unlockField('w4GildedStatues'),
  {
    get: (input) => input.external.contractRuneCraftLevel,
    set: (input, value) => {
      input.external.contractRuneCraftLevel = value;
    },
  },
  // An index into ESSENCE_TYPES, as card tiers encode their tier.
  {
    get: (input) => Math.max(ESSENCE_TYPES.indexOf(input.mining), 0),
    set: (input, value) => {
      input.mining = ESSENCE_TYPES[value] ?? FRESH_INPUT.mining;
    },
  },
  // ---- v5: Arcanist batch 2, appended so v4 links keep decoding. ----
  ...ESSENCE_UPGRADES.slice(V4_ESSENCE_UPGRADE_COUNT).map(essenceField),
  ...EXCHANGE_UPGRADES.slice(V4_EXCHANGE_UPGRADE_COUNT).map(exchangeField),
  unlockField('spellslingerBundle'),
  petField('rhinoInfernalUltraShiny'),
  // ---- v6: altars, spells and cards added since. Appended, as above. ----
  ...ALTARS_AFTER_V4.flatMap(altarFields),
  ...ALTARS_AFTER_V4.map((id) => cardField('rune', id)),
  ...SPELLS_AFTER_V4.flatMap(spellFields),
  ...ESSENCE_CARDS_AFTER_V4.map((type) => cardField('essence', type)),
  ...SPELLS_AFTER_V4.map((id) => cardField('spell', id)),
  // ---- v7: more Arcanist Spell Power sources. Appended, as above. ----
  unlockField('blackHole30'),
  unlockField('hydraStarLevel'),
  unlockField('divineChallenge24'),
  // ---- v8: the Wizard Exchange. Appended, as above. ----
  wizardField('lootMulti'),
  wizardField('partyChance'),
  wizardField('partyMulti'),
  wizardField('blindChance'),
  wizardField('discoChance'),
  wizardField('flashbangChance'),
  wizardField('wizardCount'),
  wizardField('exchangeTimerLevel'),
  wizardField('polyOrbLevel'),
  wizardField('comfortHours'),
  wizardField('ppPer100Packs'),
  ...CURRENCY_CATEGORIES.map((_, position) => preferenceField(position)),
  ...ORB_CARD_IDS.map(tradedField),
  wizardField('negligibleBar'),
  wizardField('gapBar'),
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
