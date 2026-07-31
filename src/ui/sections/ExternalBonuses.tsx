import { SPELLS, SPELL_IDS } from '../../calc/constants';
import type { ArcanistInput, CardTier, SpellId } from '../../calc/types';
import { CARD_TIERS } from '../../calc/types';
import { Collapsible, Field, NumberField, Subhead, Switch } from '../components';

/**
 * The 20 values Arcanist reads from other sheets in the workbook.
 *
 * Typed to match their sources: card slots are tier pickers, unlocks are
 * checkboxes, everything else is a number — so you can fill this in by looking
 * at the game rather than by looking up cell references.
 */
interface Props {
  input: ArcanistInput;
  update: (mutate: (draft: ArcanistInput) => void) => void;
}

const TIER_LABELS: Record<CardTier, string> = {
  none: 'None',
  normal: 'Normal',
  gilded: 'Gilded',
  polychrome: 'Polychrome',
};

function TierSelect({
  value,
  onChange,
  label,
}: {
  value: CardTier;
  onChange: (next: CardTier) => void;
  label: string;
}) {
  return (
    <select value={value} aria-label={label} onChange={(e) => onChange(e.target.value as CardTier)}>
      {CARD_TIERS.map((tier) => (
        <option key={tier} value={tier}>
          {TIER_LABELS[tier]}
        </option>
      ))}
    </select>
  );
}

export function ExternalBonuses({ input, update }: Props) {
  const ext = input.external;
  const set = <K extends keyof ArcanistInput['external']>(
    key: K,
    value: ArcanistInput['external'][K],
  ) =>
    update((draft) => {
      draft.external[key] = value;
    });

  const setSpellCard = (id: SpellId, tier: CardTier) =>
    update((draft) => {
      draft.external.cardSpell[id] = tier;
    });

  return (
    <Collapsible title="External Bonuses" eyebrow="cards · pets · unlocks">
      <p className="note" style={{ marginBottom: 12 }}>
        Bonuses the Arcanist receives from elsewhere in the game. Defaults are zero; set them to
        match your account or the numbers above will be low.
      </p>

      <Subhead>Cards</Subhead>
      <p className="note" style={{ marginBottom: 6 }}>
        Pick the highest tier you own. Arcanist cards stop at Polychrome — they cannot be
        transformed to Infernal.
      </p>
      <Field label="Soft Essence max loot">
        <TierSelect
          value={ext.cardSoftMaxLoot}
          label="Soft Essence max loot card"
          onChange={(t) => set('cardSoftMaxLoot', t)}
        />
      </Field>
      <Field label="Dense Essence max loot">
        <TierSelect
          value={ext.cardDenseMaxLoot}
          label="Dense Essence max loot card"
          onChange={(t) => set('cardDenseMaxLoot', t)}
        />
      </Field>
      <Field label="Jagged Essence max loot">
        <TierSelect
          value={ext.cardJaggedMaxLoot}
          label="Jagged Essence max loot card"
          onChange={(t) => set('cardJaggedMaxLoot', t)}
        />
      </Field>
      <Field label="Ash Altar craft">
        <TierSelect
          value={ext.cardAshCraft}
          label="Ash Altar craft card"
          onChange={(t) => set('cardAshCraft', t)}
        />
      </Field>
      <Field label="Brine Altar craft">
        <TierSelect
          value={ext.cardBrineCraft}
          label="Brine Altar craft card"
          onChange={(t) => set('cardBrineCraft', t)}
        />
      </Field>
      <Field label="Chasm Altar craft">
        <TierSelect
          value={ext.cardChasmCraft}
          label="Chasm Altar craft card"
          onChange={(t) => set('cardChasmCraft', t)}
        />
      </Field>
      {SPELL_IDS.map((id) => (
        <Field key={id} label={`${SPELLS[id].label} potency`}>
          <TierSelect
            value={ext.cardSpell[id]}
            label={`${SPELLS[id].label} potency card`}
            onChange={(t) => setSpellCard(id, t)}
          />
        </Field>
      ))}
      <Field label="Essence super shiny">
        <TierSelect
          value={ext.cardSuperShiny}
          label="Essence super shiny card"
          onChange={(t) => set('cardSuperShiny', t)}
        />
      </Field>
      <Field
        label="Arcane card tiers owned"
        hint="Every tier of every Arcanist card, including Orb Trade cards"
      >
        <NumberField
          value={ext.arcaneCardCount}
          step={1}
          label="Arcane card tiers owned"
          onChange={(v) => set('arcaneCardCount', Math.max(0, Math.round(v)))}
        />
      </Field>
      <p className="note" style={{ marginTop: 6 }}>
        Orb Trade cards have no other effect here — the Arcanist does not use orb trade rates — but
        they do count toward the total above, which drives Essence Damage Per Arcane Card.
      </p>

      <Subhead>Pets</Subhead>
      <div style={{ padding: '4px 0 8px' }}>
        <Switch checked={ext.petMaxEssence} onChange={(v) => set('petMaxEssence', v)}>
          +1 max essence loot on every type
        </Switch>
      </div>
      <Field label="Brittle chance">
        <NumberField
          value={ext.petBrittle}
          label="Pet brittle chance"
          onChange={(v) => set('petBrittle', v)}
        />
      </Field>
      <Field label="Essence shiny chance">
        <NumberField
          value={ext.petShiny}
          label="Pet shiny chance"
          onChange={(v) => set('petShiny', v)}
        />
      </Field>
      <Field label="Spell potency">
        <NumberField
          value={ext.petSpellPotency}
          label="Pet spell potency"
          onChange={(v) => set('petSpellPotency', v)}
        />
      </Field>

      <Subhead>Unlocks</Subhead>
      <div style={{ display: 'grid', gap: 7, padding: '4px 0 8px' }}>
        <Switch checked={ext.obeliskShiny} onChange={(v) => set('obeliskShiny', v)}>
          Obelisk: essence shiny chance +1%
        </Switch>
        <Switch checked={ext.obeliskSuperShiny} onChange={(v) => set('obeliskSuperShiny', v)}>
          Obelisk: super shiny chance +2%
        </Switch>
        <Switch checked={ext.skillShiny} onChange={(v) => set('skillShiny', v)}>
          Skill: essence shiny chance +1%
        </Switch>
        <Switch checked={ext.skillBrittle} onChange={(v) => set('skillBrittle', v)}>
          Skill: brittle chance +1%
        </Switch>
        <Switch checked={ext.storeShiny} onChange={(v) => set('storeShiny', v)}>
          Store: essence shiny chance +1%
        </Switch>
      </div>
      <Field label="Construct super shiny">
        <NumberField
          value={ext.constructSuperShiny}
          label="Construct super shiny chance"
          onChange={(v) => set('constructSuperShiny', v)}
        />
      </Field>

      <Subhead>Multipliers</Subhead>
      <Field label="Contract rune craft" hint="Added as (1 + value)">
        <NumberField
          value={ext.contractRuneCraft}
          label="Contract rune craft bonus"
          onChange={(v) => set('contractRuneCraft', v)}
        />
      </Field>
      <Field label="Store rune craft" hint="Added as (1 + value)">
        <NumberField
          value={ext.storeRuneCraft}
          label="Store rune craft bonus"
          onChange={(v) => set('storeRuneCraft', v)}
        />
      </Field>
      <Field label="Spell duration multiplier">
        <NumberField
          value={ext.spellDurationMulti}
          label="Spell duration multiplier"
          onChange={(v) => set('spellDurationMulti', v)}
        />
      </Field>
    </Collapsible>
  );
}
