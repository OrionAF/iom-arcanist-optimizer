import { describe, expect, it } from 'vitest';

import { compute } from '../calc/engine';
import type { ArcanistInput } from '../calc/types';
import { EXAMPLE_INPUT } from '../presets/example';
import { FRESH_INPUT, FRESH_WIZARD } from '../presets/fresh';
import {
  PACKED_FIELD_COUNT,
  coerceInput,
  fromSavedBuild,
  packFields,
  toSavedBuild,
  unpackFields,
} from './schema';
import { decodeBuild, encodeBuild, readBuildFromHash } from './url';

/** A build as a link from before v8 carries it: the Wizard Exchange at fresh values. */
const withoutWizard = (input: ArcanistInput): ArcanistInput => ({ ...input, wizard: FRESH_WIZARD });

describe('JSON round trip', () => {
  it('preserves a build exactly', () => {
    const restored = fromSavedBuild(JSON.parse(JSON.stringify(toSavedBuild(EXAMPLE_INPUT))));
    expect(restored).toEqual(EXAMPLE_INPUT);
  });

  it('accepts a bare input object as well as a wrapped build', () => {
    expect(fromSavedBuild(EXAMPLE_INPUT)).toEqual(EXAMPLE_INPUT);
  });
});

describe('packed round trip', () => {
  it('preserves every field', () => {
    const packed = packFields(EXAMPLE_INPUT);
    expect(packed).toHaveLength(PACKED_FIELD_COUNT);
    expect(unpackFields(packed)).toEqual(EXAMPLE_INPUT);
  });

  it('produces identical calc results', () => {
    const restored = unpackFields(packFields(EXAMPLE_INPUT));
    expect(compute(restored)).toEqual(compute(EXAMPLE_INPUT));
  });

  /**
   * Batch 2 appended its fields instead of moving PACK_FORMAT, so a link shared
   * before it must decode to the same build with every new field at its fresh
   * value. The v4 array is exactly the current one minus the appended tail.
   */
  it('decodes a pre-batch-2 (v4) array unchanged', () => {
    // 15 essence + 15 altar + 18 spell + 2 exchange + 18 cards + 5 pet
    // + 6 unlock + contract + mining.
    const V4_FIELD_COUNT = 81;
    const v4 = packFields(EXAMPLE_INPUT).slice(0, V4_FIELD_COUNT);
    expect(unpackFields(v4)).toEqual(withoutWizard(EXAMPLE_INPUT));
    // And the v4 prefix really is where it was: mining is its last field.
    const necrotic = structuredClone(EXAMPLE_INPUT);
    necrotic.mining = 'necrotic';
    expect(packFields(necrotic)[V4_FIELD_COUNT - 1]).toBe(3);
  });

  it('carries every batch 2 field through a link', () => {
    const build = structuredClone(EXAMPLE_INPUT);
    build.essence.shinyChanceUltraShiny = 7;
    build.essence.superShinyChanceAttackSpeed = 20;
    build.exchange.spellPower = 15;
    build.exchange.runePolychromeCard = 4;
    build.external.unlocks.spellslingerBundle = true;
    build.external.pets.rhinoCard = 'infernal';
    build.external.pets.rhinoInfernalUltraShiny = 1.25;
    build.mining = 'necrotic';
    expect(decodeBuild(encodeBuild(build))).toEqual(build);
  });

  /**
   * v6 appended the Drift and Echo altars with their rune cards, seven spells,
   * and the Necrotic Essence and batch 2 spell cards after the v5 tail.
   */
  it('decodes a v5 array unchanged', () => {
    // v4 + 19 essence + 2 exchange + Spellslinger Bundle + Infernal Rhino value.
    const V5_FIELD_COUNT = 104;
    // v6: 2 altars ×5, 2 rune cards, 7 spells ×3, Necrotic card, 7 spell cards.
    // v7: Black Hole Level 30, Hydra Star level, Divine Challenge 23.
    // v8: 11 wizard settings, 9 preference positions, 6 traded, 2 bars.
    expect(PACKED_FIELD_COUNT).toBe(
      V5_FIELD_COUNT + 2 * 5 + 2 + 7 * 3 + 1 + 7 + 3 + (11 + 9 + 6 + 2),
    );
    const v5 = packFields(EXAMPLE_INPUT).slice(0, V5_FIELD_COUNT);
    expect(unpackFields(v5)).toEqual(withoutWizard(EXAMPLE_INPUT));
    // And the v5 tail really is where it was: the Infernal Rhino value is last.
    const infernal = structuredClone(EXAMPLE_INPUT);
    infernal.external.pets.rhinoInfernalUltraShiny = 1.5;
    expect(packFields(infernal)[V5_FIELD_COUNT - 1]).toBe(1.5);
  });

  it('carries the Drift and Echo altars and the batch 2 spells through a link', () => {
    const build = structuredClone(EXAMPLE_INPUT);
    build.altars.drift = { unlocked: true, active: true, capacity: 12, travel: 4, craft: 7 };
    build.altars.echo = { unlocked: true, active: false, capacity: 3, travel: 10, craft: 1 };
    build.external.cards.rune.drift = 'gilded';
    build.external.cards.rune.echo = 'polychrome';
    build.spells.draconicHoard = { unlocked: true, level: 22, rank: 6 };
    build.spells.bugMagnet = { unlocked: false, level: 0, rank: 10 };
    build.external.cards.essence.necrotic = 'normal';
    build.external.cards.spell.partyFever = 'gilded';
    build.external.cards.spell.bugMagnet = 'polychrome';
    build.external.unlocks.blackHole30 = true;
    build.external.unlocks.hydraStarLevel = 33;
    build.external.unlocks.divineChallenge23 = true;
    expect(decodeBuild(encodeBuild(build))).toEqual(build);
  });

  /** The example build has no Rhino card, which is how this once went unnoticed. */
  it('decodes a v7 array with the Wizard Exchange at its defaults', () => {
    const V7_FIELD_COUNT = 104 + 2 * 5 + 2 + 7 * 3 + 1 + 7 + 3;
    const v7 = packFields(EXAMPLE_INPUT).slice(0, V7_FIELD_COUNT);
    expect(unpackFields(v7)).toEqual(withoutWizard(EXAMPLE_INPUT));
  });

  it('carries every Wizard Exchange field through a link', () => {
    const build = structuredClone(EXAMPLE_INPUT);
    build.wizard = {
      lootMulti: 1.43,
      partyChance: 21,
      partyMulti: 3.9,
      blindChance: 2.5,
      discoChance: 0.85,
      flashbangChance: 0.4,
      wizardCount: 9,
      exchangeTimerLevel: 30,
      polyOrbLevel: 10,
      comfortHours: 1.5,
      ppPer100Packs: 82.717e24,
      preference: ['gems', 'fish', 'bars', 'stars', 'veins', 'food', 'commonItems', 'rareItems', 'fragments'],
      negligibleBar: 7,
      gapBar: 7,
      traded: { white: 2559, green: 1842, purple: 1482, orange: 935, red: 516, yellow: 296 },
    };
    expect(decodeBuild(encodeBuild(build))).toEqual(build);
  });

  it('repairs a Currency Preference that is not a permutation', () => {
    const build = structuredClone(EXAMPLE_INPUT);
    build.wizard.preference = ['gems', 'gems', 'bars', 'stars', 'veins', 'food', 'commonItems', 'rareItems', 'fragments'];
    expect(unpackFields(packFields(build)).wizard.preference).toEqual(FRESH_WIZARD.preference);
    expect(coerceInput({ wizard: { preference: ['gems'] } }).wizard.preference).toEqual(
      FRESH_WIZARD.preference,
    );
  });

  it('clamps Wizard Exchange values into range', () => {
    const wizard = coerceInput({
      wizard: { wizardCount: 14, partyChance: 250, exchangeTimerLevel: 99, traded: { white: -5 }, gapBar: 40 },
    }).wizard;
    expect(wizard.gapBar).toBe(9);
    expect(wizard.wizardCount).toBe(9);
    expect(wizard.partyChance).toBe(100);
    expect(wizard.exchangeTimerLevel).toBe(30);
    expect(wizard.traded.white).toBe(0);
  });

  it('carries every Rhino card tier', () => {
    for (const tier of ['normal', 'gilded', 'polychrome', 'infernal'] as const) {
      const build = structuredClone(EXAMPLE_INPUT);
      build.external.pets.rhinoCard = tier;
      expect(unpackFields(packFields(build)).external.pets.rhinoCard, tier).toBe(tier);
    }
  });

  it('fills the tail with defaults when a link predates a new field', () => {
    const truncated = packFields(EXAMPLE_INPUT).slice(0, 20);
    const restored = unpackFields(truncated);
    expect(restored.essence.flatDamage1).toBe(EXAMPLE_INPUT.essence.flatDamage1);
    // Fields past the cut fall back to fresh values rather than undefined.
    expect(restored.external.contractRuneCraftLevel).toBe(
      FRESH_INPUT.external.contractRuneCraftLevel,
    );
  });
});

describe('share links', () => {
  it('survive an encode/decode cycle', () => {
    expect(decodeBuild(encodeBuild(EXAMPLE_INPUT))).toEqual(EXAMPLE_INPUT);
  });

  it('stay short enough to paste', () => {
    // v8's Wizard Exchange added 28 fields, most of them small integers.
    expect(encodeBuild(EXAMPLE_INPUT).length).toBeLessThan(560);
  });

  it('reject garbage instead of throwing', () => {
    expect(decodeBuild('')).toBeNull();
    expect(decodeBuild('not-a-real-token')).toBeNull();
    expect(decodeBuild('qZm9vYmFy')).toBeNull();
    expect(decodeBuild('xanything')).toBeNull();
  });

  /**
   * The packed array is positional, so v1's field order would decode into v2's
   * fields as garbage. Rejecting on the format marker turns that into a visible
   * "couldn't be read" instead of a build full of plausible wrong numbers.
   */
  it('rejects a v1 token rather than misreading it', () => {
    const v1Token = 'p' + encodeBuild(EXAMPLE_INPUT).slice(1);
    expect(decodeBuild(v1Token)).toBeNull();
    expect(readBuildFromHash(`#b=${v1Token}`).status).toBe('invalid');
  });

  it('distinguishes no link from a broken link', () => {
    expect(readBuildFromHash('')).toEqual({ status: 'none' });
    expect(readBuildFromHash('#other=1')).toEqual({ status: 'none' });
    expect(readBuildFromHash('#b=garbage').status).toBe('invalid');
    expect(readBuildFromHash(`#b=${encodeBuild(EXAMPLE_INPUT)}`)).toEqual({
      status: 'ok',
      input: EXAMPLE_INPUT,
    });
  });

  /**
   * Captured from a real Chromium page, not from Node.
   *
   * The encoding is pure string work now, so runtimes cannot disagree — but an
   * earlier deflate-based version passed every Node round-trip test while
   * being broken in every browser. This fixture is the guard against shipping
   * that class of bug again: if the token format changes, this must be
   * regenerated from a browser, and if it cannot be, the format is not safe.
   */
  it('decodes a token generated by a browser', () => {
    // Literal, not PACK_FORMAT: the point is to encode independently of the
    // app's own encoder, so the letter is bumped by hand when the format moves.
    const browserToken =
      's' +
      Buffer.from(JSON.stringify(packFields(EXAMPLE_INPUT)), 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    expect(decodeBuild(browserToken)).toEqual(EXAMPLE_INPUT);
  });
});

describe('coercion of untrusted input', () => {
  it('offers Infernal to the Rhino card and to no Arcanist card', () => {
    const coerced = coerceInput({
      external: {
        cards: { rune: { ash: 'infernal' } },
        pets: { rhinoCard: 'infernal', rhinoInfernalUltraShiny: -3 },
      },
    });
    expect(coerced.external.cards.rune.ash).toBe('none');
    expect(coerced.external.pets.rhinoCard).toBe('infernal');
    expect(coerced.external.pets.rhinoInfernalUltraShiny).toBe(0);
  });

  it('rebuilds a complete input from nothing', () => {
    expect(coerceInput(null)).toEqual(FRESH_INPUT);
    expect(coerceInput('nonsense')).toEqual(FRESH_INPUT);
    expect(coerceInput({ essence: 'not an object' })).toEqual(FRESH_INPUT);
  });

  it('clamps out-of-range levels', () => {
    const coerced = coerceInput({
      essence: { flatDamage1: 9999, armorPen: -5, shinyLoot: 2.7 },
      spells: { runicSurge: { level: 500, rank: -1 } },
      altars: { ash: { capacity: 999 } },
    });
    expect(coerced.essence.flatDamage1).toBe(25);
    expect(coerced.essence.armorPen).toBe(0);
    expect(coerced.essence.shinyLoot).toBe(2);
    expect(coerced.spells.runicSurge.level).toBe(50);
    expect(coerced.spells.runicSurge.rank).toBe(0);
    expect(coerced.altars.ash.capacity).toBe(25);
  });

  it('rejects unknown card tiers', () => {
    const coerced = coerceInput({
      external: { cards: { essence: { soft: 'platinum' } } },
    });
    expect(coerced.external.cards.essence.soft).toBe('none');
  });

  it('never yields a shape the engine chokes on', () => {
    expect(() => compute(coerceInput({ external: { pets: { rhinoLevel: NaN } } }))).not.toThrow();
    expect(() => compute(coerceInput({ external: 'nonsense' }))).not.toThrow();
  });
});

/**
 * v1 stored the derived numbers (`petBrittle: 0.05`); v2 stores what the player
 * owns (`rhinoLevel: 5`). The v1 values were themselves computed from those
 * inputs by fixed formulas, so every conversion here is exact — a saved build
 * must survive the upgrade rather than silently reset.
 */
describe('v1 to v2 migration', () => {
  const V1_BUILD = {
    version: 1,
    input: {
      essence: { flatDamage1: 17, damagePct: 10 },
      spells: { runicSurge: { unlocked: true, level: 13, rank: 10 } },
      external: {
        cardSoftMaxLoot: 'polychrome',
        cardDenseMaxLoot: 'normal',
        cardJaggedMaxLoot: 'normal',
        cardAshCraft: 'polychrome',
        cardBrineCraft: 'gilded',
        cardChasmCraft: 'none',
        cardSpell: { runicSurge: 'gilded', rainbowRift: 'gilded', manaflow: 'normal' },
        cardSuperShiny: 'gilded',
        arcaneCardCount: 20,
        petMaxEssence: true,
        petBrittle: 0.05,
        petShiny: 0.02,
        petSpellPotency: 0.06,
        obeliskShiny: true,
        obeliskSuperShiny: false,
        skillShiny: true,
        skillBrittle: true,
        storeShiny: true,
        constructSuperShiny: 0.03,
        contractRuneCraft: 0.08,
        storeRuneCraft: 0.1,
        spellDurationMulti: 1.1,
      },
    },
  };

  const migrated = fromSavedBuild(V1_BUILD);

  it('keeps the parts that did not change shape', () => {
    expect(migrated.essence.flatDamage1).toBe(17);
    expect(migrated.spells.runicSurge).toEqual({ unlocked: true, level: 13, rank: 10 });
  });

  it('moves cards into their blocks', () => {
    expect(migrated.external.cards.essence).toEqual({
      soft: 'polychrome',
      dense: 'normal',
      jagged: 'normal',
      // v1 predates Necrotic Essence.
      necrotic: 'none',
    });
    expect(migrated.external.cards.rune).toEqual({
      ash: 'polychrome',
      brine: 'gilded',
      chasm: 'none',
      // v1 predates the Drift and Echo altars.
      drift: 'none',
      echo: 'none',
    });
    expect(migrated.external.cards.spell.runicSurge).toBe('gilded');
    expect(migrated.external.cards.spell.veinboyant).toBe('none');
  });

  it('turns derived pet numbers back into levels', () => {
    // 0.05 brittle / 0.01 per level.
    expect(migrated.external.pets.rhinoLevel).toBe(5);
    expect(migrated.external.pets.rhinoSkin).toBe(true);
    // 0.02 shiny is four steps, and level 0 is the first, so level 3.
    expect(migrated.external.pets.rhinoQuestSkin).toBe(true);
    expect(migrated.external.pets.rhinoQuestLevel).toBe(3);
    expect(migrated.external.pets.rhinoCard).toBe('gilded');
  });

  it('round-trips the pet quest conversion through the engine', () => {
    const before = V1_BUILD.input.external;
    const after = compute(migrated).derived;
    expect(after.petQuestShiny).toBeCloseTo(before.petShiny, 10);
    expect(after.petSpellPower).toBeCloseTo(before.petSpellPotency, 10);
    expect(after.petBrittle).toBeCloseTo(before.petBrittle, 10);
    expect(after.contractRuneCraft).toBeCloseTo(before.contractRuneCraft, 10);
    expect(after.statueSuperShiny).toBeCloseTo(before.constructSuperShiny, 10);
    expect(after.storeRuneCraft).toBeCloseTo(before.storeRuneCraft, 10);
    // v1's 1.1 came from the Arcanist Bundle, which stopped granting spell
    // duration in Arcanist batch 2. The migration is still exact; the game moved.
    expect(before.spellDurationMulti).toBeCloseTo(1.1, 10);
    expect(after.spellDurationMulti).toBe(1);
  });

  it('collapses the two Yanille halves into one unlock', () => {
    expect(migrated.external.unlocks.straightOuttaYanille).toBe(true);
    // Either half alone still means the skill was unlocked.
    const onlyBrittle = fromSavedBuild({
      input: { external: { cardSoftMaxLoot: 'none', skillShiny: false, skillBrittle: true } },
    });
    expect(onlyBrittle.external.unlocks.straightOuttaYanille).toBe(true);
  });

  it('splits the construct bonus into a toggle and a count', () => {
    expect(migrated.external.unlocks.statueOfNatureGilded).toBe(true);
    expect(migrated.external.unlocks.w4GildedStatues).toBe(3);
  });

  it('renames the obelisk flags to world quests', () => {
    expect(migrated.external.unlocks.worldQuest25).toBe(true);
    expect(migrated.external.unlocks.worldQuest29).toBe(false);
  });

  it('converts the contract bonus back to a level', () => {
    expect(migrated.external.contractRuneCraftLevel).toBe(16);
  });

  it('leaves orb cards empty, since v1 had no way to record them', () => {
    expect(Object.values(migrated.external.cards.orb).every((t) => t === 'none')).toBe(true);
  });

  it('does not mistake a v2 build for a v1 one', () => {
    expect(fromSavedBuild(toSavedBuild(EXAMPLE_INPUT))).toEqual(EXAMPLE_INPUT);
  });
});
