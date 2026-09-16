import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { compute } from './calc/engine';
import type { ArcanistInput } from './calc/types';
import { EXAMPLE_INPUT } from './presets/example';
import { FRESH_INPUT } from './presets/fresh';
import { arrivalOf, type LinkState } from './state/link';
import {
  backupBuild,
  exportToFile,
  importFromFile,
  loadBackup,
  loadBuild,
  saveBuild,
  untradeOffers,
} from './state/storage';
import { buildShareUrl, dropToken, readBuildFromHash, type HashRead } from './state/url';
import { TabbedPanel } from './ui/components';
import { SECTION_ICONS } from './ui/icons';
import { OtherUnlocks, Pets } from './ui/sections/Account';
import { Breakdown } from './ui/sections/Breakdown';
import { Cards } from './ui/sections/Cards';
import { Ledger } from './ui/sections/Ledger';
import { Optimizer } from './ui/sections/Optimizer';
import { Totals } from './ui/sections/Totals';
import { Altars, EssenceUpgrades, Spells, Stats } from './ui/sections/Upgrades';
import { WizardExchange } from './ui/sections/WizardExchange';

export default function App() {
  // The local build is read once, here, and then held. Everything a link does
  // happens in front of it rather than on top of it.
  const [mine] = useState(() => loadBuild());
  const [opening] = useState(() => arrivalOf(readBuildFromHash(window.location.hash), mine));

  const [input, setInput] = useState<ArcanistInput>(() => opening.input ?? mine ?? FRESH_INPUT);
  const [link, setLink] = useState<LinkState>(opening.link);
  const [toast, setToast] = useState<string | null>(opening.toast);
  /** The share link, when the clipboard refused it and it has to be copied by hand. */
  const [copyLink, setCopyLink] = useState<string | null>(null);
  /**
   * Bumped whenever the build is replaced wholesale, to remount the panels that
   * hold browser-only state of their own — the Wizard Exchange offers, which
   * are read out of storage once when it mounts.
   */
  const [epoch, setEpoch] = useState(0);

  const fileInput = useRef<HTMLInputElement>(null);

  // The token has done its job the moment it is read.
  useEffect(() => {
    dropToken();
  }, []);

  useEffect(() => {
    // Someone else's build is on screen and has not been accepted: storage is
    // not ours to write. Every other state autosaves as before.
    if (link.kind === 'viewing') return;
    saveBuild(input);
  }, [input, link.kind]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /** A link that lands in a tab which already has the app open. */
  const arrive = useCallback((read: HashRead) => {
    const current = loadBuild();
    const next = arrivalOf(read, current);
    if (next.input) setInput(next.input);
    setLink(next.link);
    setToast(next.toast);
    if (next.link.kind === 'kept') {
      backupBuild(current);
      untradeOffers();
      setEpoch((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    const onHash = () => {
      const read = readBuildFromHash(window.location.hash);
      // Our own dropToken, or an anchor that is nothing to do with us.
      if (read.status === 'none') return;
      dropToken();
      arrive(read);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [arrive]);

  /**
   * Accept the build that arrived from a link.
   *
   * Editing it counts as accepting it: the alternative is discarding the edit
   * the moment it is made, which is worse than the bug this replaced.
   */
  const keep = useCallback(() => {
    if (link.kind !== 'viewing') return;
    backupBuild(link.mine);
    untradeOffers();
    setEpoch((n) => n + 1);
    setLink({ kind: 'kept', previous: link.mine });
  }, [link]);

  const update = useCallback(
    (mutate: (draft: ArcanistInput) => void) => {
      keep();
      setInput((current) => {
        const draft = structuredClone(current);
        mutate(draft);
        return draft;
      });
    },
    [keep],
  );

  const result = useMemo(() => compute(input), [input]);

  const share = async () => {
    const url = buildShareUrl(input);
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link copied to clipboard');
    } catch {
      // The old fallback put the link in the address bar, where it outlived the
      // copy and overwrote later edits on the next reload. A field to copy from
      // costs one more click and leaves the address bar alone.
      setCopyLink(url);
    }
  };

  /** Reset, Load example and Import: a wholesale replacement, with a way back. */
  const load = (next: ArcanistInput, message: string) => {
    const previous = loadBuild();
    backupBuild(previous);
    untradeOffers();
    setEpoch((n) => n + 1);
    setInput(next);
    setLink({ kind: 'kept', previous });
    dropToken();
    setToast(message);
  };

  const restore = () => {
    const previous =
      (link.kind === 'kept' ? link.previous : link.kind === 'viewing' ? link.mine : null) ??
      loadBackup();
    if (!previous) return;
    setInput(previous);
    setLink({ kind: 'none' });
    untradeOffers();
    setEpoch((n) => n + 1);
    setToast('Your own build is back');
  };

  const sectionProps = { input, result, update };

  return (
    <div className="app">
      <header className="masthead">
        <h1>Arcanist</h1>
        <span className="sub">Idle Obelisk Miner · Ob70 planner</span>
        <div className="actions">
          <button className="action" type="button" onClick={() => load(FRESH_INPUT, 'Reset to a fresh account')}>
            Reset
          </button>
          <button
            className="action"
            type="button"
            onClick={() => load(EXAMPLE_INPUT, 'Loaded the example build')}
          >
            Load example
          </button>
          <button className="action" type="button" onClick={() => exportToFile(input)}>
            Export
          </button>
          <button className="action" type="button" onClick={() => fileInput.current?.click()}>
            Import
          </button>
          <button className="action primary" type="button" onClick={share}>
            Share link
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                load(await importFromFile(file), `Imported ${file.name}`);
              } catch {
                setToast('That file is not a build export');
              }
            }}
          />
        </div>
      </header>

      <LinkBar link={link} onKeep={keep} onRestore={restore} onDismiss={() => setLink({ kind: 'none' })} />

      <Ledger input={input} result={result} update={update} />

      {/* Left column takes every input; the right is read-only output only. */}
      <div className="columns">
        <div className="stack">
          <TabbedPanel
            id="upgrades"
            label="Upgrades"
            tabs={[
              {
                id: 'essence',
                title: 'Essence Upgrades',
                icon: SECTION_ICONS.essence,
                content: <EssenceUpgrades {...sectionProps} />,
              },
              {
                id: 'altars',
                title: 'Altars',
                icon: SECTION_ICONS.altars,
                content: <Altars {...sectionProps} />,
              },
              {
                id: 'spells',
                title: 'Spells',
                icon: SECTION_ICONS.spells,
                content: <Spells {...sectionProps} />,
              },
              {
                id: 'cards',
                title: 'Cards',
                icon: SECTION_ICONS.cards,
                content: <Cards {...sectionProps} />,
              },
            ]}
          />
          <TabbedPanel
            id="account"
            label="Account"
            tabs={[
              {
                id: 'unlocks',
                title: 'Other Unlocks',
                icon: SECTION_ICONS.unlocks,
                content: <OtherUnlocks {...sectionProps} />,
              },
              {
                id: 'pets',
                title: 'Pets',
                icon: SECTION_ICONS.pets,
                content: <Pets {...sectionProps} />,
              },
              {
                id: 'wizard',
                title: 'Wizard Exchange',
                icon: SECTION_ICONS.exchange,
                // Keyed on the epoch so a replaced build takes the offers panel
                // with it, rather than leaving offers credited to a tally that
                // no longer exists.
                content: <WizardExchange key={epoch} {...sectionProps} />,
              },
            ]}
          />
        </div>

        <div className="stack">
          <Optimizer input={input} />
          <Stats result={result} />
          <Breakdown result={result} />
          <Totals result={result} />
        </div>
      </div>

      <footer className="colophon">
        <p>
          Originally built on the Arcanist sheet from{' '}
          <a
            href="https://docs.google.com/spreadsheets/d/1hj4YvYYNlAmXD9LHZNsDQS2n1pFI8H34_1-RS_RlU-E/edit?usp=sharing"
            target="_blank"
            rel="noreferrer noopener"
          >
            Obelisk Total Resources Calculator
          </a>{' '}
          by <strong>Stonestriker</strong>. It has since been rebuilt against the
          game&rsquo;s own data.
        </p>
        <p>
          <a
            href="https://github.com/OrionAF/iom-arcanist-optimizer"
            target="_blank"
            rel="noreferrer noopener"
          >
            Source on GitHub
          </a>
        </p>
      </footer>

      {copyLink ? <CopyLink url={copyLink} onClose={() => setCopyLink(null)} /> : null}

      {/* The live region is always mounted and only its contents change. Creating
          a role="status" element at the same moment it gains text is a race some
          screen readers lose, and the announcement is dropped. */}
      <div role="status" aria-live="polite">
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </div>
  );
}

/**
 * What a link did, and how to undo it.
 *
 * In the page's flow rather than floating: it reports something that has just
 * happened to the build, so it belongs above the numbers it happened to, and a
 * floating bar would sit over the sticky ledger.
 */
function LinkBar({
  link,
  onKeep,
  onRestore,
  onDismiss,
}: {
  link: LinkState;
  onKeep: () => void;
  onRestore: () => void;
  onDismiss: () => void;
}) {
  if (link.kind === 'viewing') {
    return (
      <div className="linkbar" role="status">
        <span>
          You&rsquo;re looking at a build someone shared. Nothing has been saved over your own.
        </span>
        <span className="linkbar-actions">
          <button className="action primary" type="button" onClick={onKeep}>
            Keep This Build
          </button>
          <button className="action" type="button" onClick={onRestore}>
            Back to Mine
          </button>
        </span>
      </div>
    );
  }

  if (link.kind === 'kept' && link.previous) {
    return (
      <div className="linkbar" role="status">
        <span>Your own build was saved before this one replaced it.</span>
        <span className="linkbar-actions">
          <button className="action" type="button" onClick={onRestore}>
            Put Mine Back
          </button>
          <button
            className="linkbar-close"
            type="button"
            aria-label="Dismiss this message"
            onClick={onDismiss}
          >
            ×
          </button>
        </span>
      </div>
    );
  }

  return null;
}

/** The share link, for when the clipboard would not take it. */
function CopyLink({ url, onClose }: { url: string; onClose: () => void }) {
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.select();
  }, []);

  return (
    <div className="copylink" role="dialog" aria-label="Copy the share link">
      <p>Your browser would not take the link. Copy it from here:</p>
      <div className="copylink-row">
        <input
          ref={field}
          type="text"
          readOnly
          value={url}
          aria-label="Share link"
          onFocus={(e) => e.target.select()}
        />
        <button className="action" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
