import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import { RESOURCE_LABELS } from '../../calc/constants';
import { formatCost, formatHours, formatNumber } from '../../calc/format';
import { groupRankings, rankAll, type Goal, type Marginal } from '../../calc/optimize';
import type { ArcanistInput } from '../../calc/types';
import { Fold, Icon, Section } from '../components';
import { RESOURCE_ICONS } from '../icons';

/**
 * What to buy next.
 *
 * Two lists rather than one, stacked and each folding away, because the player has two goals and they do not
 * always agree: altar throughput buys runes with essence, so an upgrade can
 * climb one list while falling down the other. Collapsing them into a single
 * score would need a weighting nobody can supply honestly.
 *
 * Within a list, entries are grouped by the resource they cost. Resources are
 * not interchangeable, so a merged list would rank a white-orb price against a
 * rune price as though one could be swapped for the other. Grouped, each queue
 * answers the question the player actually arrives with: I have a pile of this,
 * what should it buy?
 */

/** Rows shown per resource before the queue is truncated. */
const PER_RESOURCE = 3;

function gainOf(entry: Marginal, goal: Goal): number {
  return goal === 'essence' ? entry.delta.essencePerHour : entry.delta.runesPerHour;
}

/**
 * One recommendation.
 *
 * The cost is the price of the step being ranked, not the row's cost to max.
 * That step is usually one level but not always: the game only rolls whole
 * percents of crit chance, so the cheapest crit buy that does anything can be
 * several levels, and the `3→7` on the row is the purchase the gain and the
 * price both refer to.
 *
 * The side-effect line appears only when the other objective moves the wrong
 * way — that is the tradeoff the two lists exist to expose, and it is worth
 * spelling out where it happens.
 */
function Entry({ entry, goal, rank }: { entry: Marginal; goal: Goal; rank: number }) {
  const gain = gainOf(entry, goal);
  const other = goal === 'essence' ? entry.delta.runesPerHour : entry.delta.essencePerHour;
  const otherUnit = goal === 'essence' ? 'runes/hr' : 'essence/hr';
  const amount = entry.candidate.resource
    ? entry.candidate.stepCost[entry.candidate.resource]
    : undefined;

  // Two rows: the name owns the first, the numbers share the second.
  return (
    <li className="opt-entry">
      <span className="opt-name">
        <span className="opt-rank num">{rank}</span>
        {/* The column is narrow enough to cut a long name; the title is how the
            rest of it can still be read. */}
        <span className="opt-label" title={entry.candidate.label}>
          {entry.candidate.label}
        </span>
      </span>
      <span className="opt-figures num">
        <span className="opt-level">
          {entry.candidate.level}→{entry.candidate.to}
        </span>
        <span className={`opt-gain${gain > 0 ? ' up' : gain < 0 ? ' down' : ''}`}>
          {gain > 0 ? '+' : ''}
          {formatNumber(gain, 1)}
        </span>
        {other < 0 ? (
          <span className="opt-tradeoff">
            costs {formatNumber(Math.abs(other), 1)} {otherUnit}
          </span>
        ) : null}
        {amount !== undefined && entry.candidate.resource ? (
          <span className="opt-cost">
            {formatCost(entry.candidate.resource, amount)}
            {/* Only rune costs carry a time: orb income is not modelled. */}
            {entry.hoursToAfford !== undefined ? (
              <span className="opt-eta"> · {formatHours(entry.hoursToAfford)}</span>
            ) : null}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function GoalList({
  scored,
  goal,
  title,
}: {
  scored: Marginal[];
  goal: Goal;
  title: string;
}) {
  const ranked = useMemo(() => groupRankings(scored, goal), [scored, goal]);

  // An upgrade that moves this goal not at all is not a recommendation for it.
  const queues = ranked.byResource
    .map((queue) => ({
      ...queue,
      entries: queue.entries.filter((e) => gainOf(e, goal) > 0).slice(0, PER_RESOURCE),
    }))
    .filter((queue) => queue.entries.length > 0);

  // Rows with no price still belong in the goal they serve — running an idle
  // altar is usually the top move for runes — but they cannot be ranked against
  // priced rows, so they sit in their own group under the queues.
  const unpriced = ranked.unpriced.filter((e) => gainOf(e, goal) > 0).slice(0, PER_RESOURCE);

  return (
    <Fold id={`opt:${goal}`} className="opt-goal" summary={<h3>{title}</h3>}>
      <div className="opt-goal-body">
        {queues.length === 0 && unpriced.length === 0 ? (
          <p className="opt-empty">Nothing available improves this goal right now.</p>
        ) : (
          queues.map((queue) => {
            const icon = RESOURCE_ICONS[queue.resource];
            return (
              <Fold
                key={queue.resource}
                id={`opt:${goal}:${queue.resource}`}
                className="opt-queue"
                summary={
                  <>
                    {icon ? (
                      <Icon src={icon} size={15} />
                    ) : (
                      <span className="dot" style={{ ['--dot' as string]: `var(--res-${queue.resource})` }} />
                    )}
                    {RESOURCE_LABELS[queue.resource]}
                  </>
                }
              >
                <ol className="opt-list">
                  {queue.entries.map((entry, i) => (
                    <Entry key={entry.candidate.key} entry={entry} goal={goal} rank={i + 1} />
                  ))}
                </ol>
              </Fold>
            );
          })
        )}

        {unpriced.length > 0 ? (
          <Fold id={`opt:${goal}:unpriced`} className="opt-queue" summary="No price">
            <ol className="opt-list">
              {unpriced.map((entry, i) => (
                <Entry key={entry.candidate.key} entry={entry} goal={goal} rank={i + 1} />
              ))}
            </ol>
          </Fold>
        ) : null}
      </div>
    </Fold>
  );
}

/**
 * The input once it has stopped changing.
 *
 * `useDeferredValue` lets the ledger paint first, but it cannot make a 31ms
 * scoring pass interruptible — once it starts it holds the main thread, and a
 * run of taps on a level stepper pays that toll on every one of them, which on
 * a phone is several times worse. Waiting for a pause instead means a burst of
 * taps scores once, at the end, where the answer is the one being asked for.
 */
function useSettled<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

export function Optimizer({ input }: { input: ArcanistInput }) {
  // Scored once for both lists: the recomputes are the expensive part and they
  // do not depend on the goal — only the ordering does.
  const settled = useSettled(input);
  const deferredInput = useDeferredValue(settled);
  const scored = useMemo(() => rankAll(deferredInput), [deferredInput]);

  return (
    <Section title="Optimizer" help="optimizer" eyebrow="best next buys · per hour gained">
      <GoalList scored={scored} goal="essence" title="For essence / hr" />
      <GoalList scored={scored} goal="runes" title="For runes / hr" />
    </Section>
  );
}
