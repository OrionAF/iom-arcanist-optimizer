/**
 * Bonuses the Arcanist receives from the rest of the account: the Rhino pet,
 * and unlocks — one-off toggles and levelled ones like the Hydra Star, the
 * Rune Craft Multi contract and the Exchange upgrades.
 *
 * Each control is the thing the player owns — a pet level, an unlock, a card
 * tier — rather than a derived number, so this can be filled in by looking at
 * the game.
 */

import { CONTRACT_RUNE_CRAFT, EXCHANGE_UPGRADES, PET, UNLOCKS } from '../../calc/constants';
import { formatNumber, formatPercent } from '../../calc/format';
import type { ArcanistInput, ArcanistResult } from '../../calc/types';
import { RHINO_CARD_TIERS } from '../../calc/types';
import { MAX_RHINO_ULTRA_SHINY_PERCENT } from '../../state/schema';
import { Field, Help, Icon, LevelInput, NumberField, Subhead, Switch, TabBody } from '../components';
import { EXCHANGE_UPGRADE_ICONS, MISC_ICONS, PET_ICONS, UNLOCK_ICONS } from '../icons';
import { CardTile } from './Cards';

interface Props {
  input: ArcanistInput;
  result: ArcanistResult;
  update: (mutate: (draft: ArcanistInput) => void) => void;
}

/** An unlock toggle with its icon and the effects it grants. */
function UnlockRow({
  icon,
  label,
  effects,
  checked,
  onChange,
  children,
}: {
  icon: string;
  label: string;
  effects: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={checked ? 'unlock on' : 'unlock'}>
      <Icon src={icon} size={28} dim={!checked} />
      <div className="unlock-body">
        <Switch checked={checked} onChange={onChange}>
          {label}
        </Switch>
        <div className="unlock-effects">{effects}</div>
        {children}
      </div>
    </div>
  );
}

/**
 * A levelled unlock: the same card as a toggle, with a stepper where the
 * checkbox would be. Highlighted once it has any levels.
 */
function LevelRow({
  icon,
  label,
  effects,
  value,
  max,
  onChange,
}: {
  icon: string;
  label: string;
  effects: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className={value > 0 ? 'unlock on' : 'unlock'}>
      <Icon src={icon} size={28} dim={value === 0} />
      <div className="unlock-body">
        <span className="unlock-title">{label}</span>
        <div className="unlock-effects">{effects}</div>
        <div className="unlock-sub">
          <span>Level</span>
          <LevelInput value={value} max={max} label={label} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

export function Pets({ input, result, update }: Props) {
  const { pets } = input.external;
  const { derived } = result;

  return (
    <TabBody eyebrow="rhino" flush>
      <div className="pet-grid">
        <div className="pet-main">
          <Field
            label="Rhino Pet Level"
            hint={`+1% Essence Brittle Chance per level · now ${formatPercent(derived.petBrittle)}`}
          >
            <LevelInput
              value={pets.rhinoLevel}
              max={PET.maxLevel}
              label="Rhino Pet Level"
              onChange={(next) =>
                update((draft) => {
                  draft.external.pets.rhinoLevel = next;
                })
              }
            />
          </Field>

          <div className="unlock-list">
            <UnlockRow
              icon={PET_ICONS.rhinoSkin}
              label="Rhino Pet Skin"
              effects={`+${PET.skinMaxLoot} Essence Max Loot`}
              checked={pets.rhinoSkin}
              onChange={(next) =>
                update((draft) => {
                  draft.external.pets.rhinoSkin = next;
                })
              }
            />

            <UnlockRow
              icon={PET_ICONS.rhinoQuest}
              label="Rhino Quest Skin"
              effects={
                pets.rhinoQuestSkin
                  ? `Essence Shiny Chance ${formatPercent(
                      derived.petQuestShiny,
                    )} · Arcanist Spell Power ${formatPercent(derived.petSpellPower)}`
                  : 'Grants Essence Shiny Chance and Arcanist Spell Power once unlocked'
              }
              checked={pets.rhinoQuestSkin}
              onChange={(next) =>
                update((draft) => {
                  draft.external.pets.rhinoQuestSkin = next;
                })
              }
            >
              {pets.rhinoQuestSkin ? (
                <div className="unlock-sub">
                  <span>Level</span>
                  <LevelInput
                    value={pets.rhinoQuestLevel}
                    max={PET.maxQuestLevel}
                    label="Rhino Quest Skin level"
                    onChange={(next) =>
                      update((draft) => {
                        draft.external.pets.rhinoQuestLevel = next;
                      })
                    }
                  />
                </div>
              ) : null}
            </UnlockRow>
          </div>

          {/* Here rather than under the card: the card column is too narrow for
              a labelled input, and this is where the other Rhino values live. */}
          {pets.rhinoCard === 'infernal' ? (
            <Field
              label="Infernal Rhino card · Ultra Shiny %"
              hint="type the Essence Ultra Shiny Chance printed on the card"
            >
              <NumberField
                value={pets.rhinoInfernalUltraShiny}
                step={0.01}
                label="Infernal Rhino card Essence Ultra Shiny Chance, percent"
                onChange={(next) =>
                  update((draft) => {
                    draft.external.pets.rhinoInfernalUltraShiny = Math.min(
                      Math.max(next, 0),
                      MAX_RHINO_ULTRA_SHINY_PERCENT,
                    );
                  })
                }
              />
            </Field>
          ) : null}
        </div>

        <div className="pet-card">
          <CardTile
            name="Rhino Pet"
            art={PET_ICONS.rhino}
            tier={pets.rhinoCard}
            tiers={RHINO_CARD_TIERS}
            onChange={(next) =>
              update((draft) => {
                draft.external.pets.rhinoCard = next;
              })
            }
          />
          <p className="note">
            Essence Super Shiny Chance; Infernal keeps that and adds Essence Ultra Shiny Chance.
            Not one of the Arcanist card blocks, so it does not count toward Essence Damage +1 Per Arcanist Card Tier Owned.
          </p>
        </div>
      </div>
    </TabBody>
  );
}

export function OtherUnlocks({ input, result, update }: Props) {
  const { unlocks } = input.external;
  const set = <K extends keyof typeof unlocks>(key: K, value: (typeof unlocks)[K]) =>
    update((draft) => {
      draft.external.unlocks[key] = value;
    });

  const pct = (n: number) => formatPercent(n);

  return (
    <TabBody eyebrow="account-wide">
      <div className="unlock-list">
        <Subhead>World Quests</Subhead>
        <UnlockRow
          icon={UNLOCK_ICONS.worldQuest25}
          label="World Quest 25 completed"
          effects={`+${pct(UNLOCKS.worldQuest25Shiny)} Essence Shiny Chance`}
          checked={unlocks.worldQuest25}
          onChange={(v) => set('worldQuest25', v)}
        />
        <UnlockRow
          icon={UNLOCK_ICONS.worldQuest29}
          label="World Quest 29 completed"
          effects={`+${pct(UNLOCKS.worldQuest29SuperShiny)} Essence Super Shiny Chance`}
          checked={unlocks.worldQuest29}
          onChange={(v) => set('worldQuest29', v)}
        />

        <Subhead>Skill-tree</Subhead>
        <UnlockRow
          icon={UNLOCK_ICONS.straightOuttaYanille}
          label="Straight Outta Yanille"
          effects={`+10% Arcanist Mana Regen · +${pct(
            UNLOCKS.yanilleShiny,
          )} Essence Shiny Chance · +${pct(UNLOCKS.yanilleBrittle)} Essence Brittle Chance`}
          checked={unlocks.straightOuttaYanille}
          onChange={(v) => set('straightOuttaYanille', v)}
        />

        <Subhead>Value Packs</Subhead>
        <UnlockRow
          icon={UNLOCK_ICONS.arcanistBundle}
          label="Arcanist Bundle"
          effects={`+${pct(UNLOCKS.bundleShiny)} Essence Shiny Chance · +${pct(
            UNLOCKS.bundleBrittle,
          )} Essence Brittle Chance · +${pct(
            UNLOCKS.bundleRuneCraft,
          )} Rune Craft Multi · +10% Wizard Loot Multi`}
          checked={unlocks.arcanistBundle}
          onChange={(v) => set('arcanistBundle', v)}
        />
        <UnlockRow
          icon={UNLOCK_ICONS.spellslingerBundle}
          label="Spellslinger Bundle"
          effects={`+${pct(UNLOCKS.spellslingerSpellDuration)} Spell Duration · +${pct(
            UNLOCKS.spellslingerSpellPower,
          )} Spell Power · +10% Spell Level Up Chance`}
          checked={unlocks.spellslingerBundle}
          onChange={(v) => set('spellslingerBundle', v)}
        />

        <Subhead>Construction</Subhead>
        <UnlockRow
          icon={UNLOCK_ICONS.statueOfNature}
          label="Statue of Nature gilded"
          effects={`+${pct(
            UNLOCKS.statueSuperShinyPerStatue,
          )} Essence Super Shiny Chance per W4 gilded statue`}
          checked={unlocks.statueOfNatureGilded}
          onChange={(v) =>
            update((draft) => {
              draft.external.unlocks.statueOfNatureGilded = v;
              // Gilding the Statue of Nature is itself one of the nine.
              if (v) draft.external.unlocks.w4GildedStatues = Math.max(unlocks.w4GildedStatues, 1);
            })
          }
        >
          {unlocks.statueOfNatureGilded ? (
            <div className="unlock-sub">
              <span>W4 gilded statues owned</span>
              <LevelInput
                value={unlocks.w4GildedStatues}
                max={UNLOCKS.maxW4GildedStatues}
                label="W4 gilded statues owned"
                onChange={(v) => set('w4GildedStatues', v)}
              />
            </div>
          ) : null}
        </UnlockRow>

        <Subhead>Stargazing</Subhead>
        <UnlockRow
          icon={UNLOCK_ICONS.blackHole30}
          label="Black Hole Level 30"
          effects={`+${pct(UNLOCKS.blackHole30SpellPower)} Arcanist Spell Power`}
          checked={unlocks.blackHole30}
          onChange={(v) => set('blackHole30', v)}
        />
        <LevelRow
          icon={UNLOCK_ICONS.hydraStar}
          label="Hydra Star"
          effects={`+${pct(UNLOCKS.hydraStarSpellPowerPerLevel)} Arcanist Spell Power per level · now +${pct(
            unlocks.hydraStarLevel * UNLOCKS.hydraStarSpellPowerPerLevel,
          )}`}
          value={unlocks.hydraStarLevel}
          max={UNLOCKS.maxHydraStarLevel}
          onChange={(v) => set('hydraStarLevel', v)}
        />

        <Subhead>Challenges</Subhead>
        <UnlockRow
          icon={UNLOCK_ICONS.divineChallenge23}
          label="Divine Challenge 23"
          effects={`+${pct(UNLOCKS.divineChallenge23SpellPower)} Arcanist Spell Power`}
          checked={unlocks.divineChallenge23}
          onChange={(v) => set('divineChallenge23', v)}
        />

        <Subhead>Contracts</Subhead>
        <LevelRow
          icon={MISC_ICONS.runeCraft}
          label="Rune Craft Multi"
          effects={`+${pct(CONTRACT_RUNE_CRAFT.perLevel)} Rune Craft Multi per level · now +${pct(
            result.derived.contractRuneCraft,
          )}`}
          value={input.external.contractRuneCraftLevel}
          max={CONTRACT_RUNE_CRAFT.maxLevel}
          onChange={(next) =>
            update((draft) => {
              draft.external.contractRuneCraftLevel = next;
            })
          }
        />

        <Subhead>
          Exchange <Help id="exchange" />
        </Subhead>
        {EXCHANGE_UPGRADES.map((def) => {
          const level = Math.min(input.exchange[def.id], def.max);
          const setLevel = (next: number) =>
            update((draft) => {
              draft.exchange[def.id] = next;
            });

          // A single-level upgrade is owned or not, so it reads as a toggle.
          if (def.perLevel === undefined) {
            return (
              <UnlockRow
                key={def.id}
                icon={EXCHANGE_UPGRADE_ICONS[def.id]}
                label={def.label}
                effects={def.note ?? ''}
                checked={level >= def.max}
                onChange={(v) => setLevel(v ? def.max : 0)}
              />
            );
          }

          const perLevel = def.perLevel;
          const format = (n: number) =>
            def.display === 'percent' ? `+${pct(n)}` : `+${formatNumber(n)}`;
          return (
            <LevelRow
              key={def.id}
              icon={EXCHANGE_UPGRADE_ICONS[def.id]}
              label={def.label}
              effects={`${format(perLevel)} ${def.effectLabel ?? def.label} per level · now ${format(
                level * perLevel,
              )}${def.note ? ` · ${def.note}` : ''}`}
              value={input.exchange[def.id]}
              max={def.max}
              onChange={setLevel}
            />
          );
        })}
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        Mana regen and Wizard Loot Multi are listed for completeness; neither feeds any number the
        Arcanist calculator produces.
      </p>
    </TabBody>
  );
}
