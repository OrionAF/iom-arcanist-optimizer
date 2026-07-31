import { RESOURCE_GROUPS, RESOURCE_LABELS } from '../../calc/constants';
import { formatShortScale } from '../../calc/format';
import type { ArcanistResult } from '../../calc/types';
import { Section } from '../components';

/** Everything still owed to finish every upgrade, grouped as the sheet groups it. */
export function Totals({ result }: { result: ArcanistResult }) {
  const { remaining, total } = result.totals;

  return (
    <Section title="Total Resources" eyebrow="to max everything" flush>
      <div className="scroll-x">
        <table className="matrix">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Remaining</th>
              <th>Full cost</th>
            </tr>
          </thead>
          {RESOURCE_GROUPS.map((group) => (
            <tbody key={group.label}>
              <tr>
                <td
                  colSpan={3}
                  style={{
                    color: 'var(--text-faint)',
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    paddingTop: 10,
                  }}
                >
                  {group.label}
                </td>
              </tr>
              {group.resources.map((resource) => (
                <tr key={resource}>
                  <td>
                    <span
                      className="res"
                      style={{ ['--dot' as string]: `var(--res-${resource})` }}
                    >
                      {RESOURCE_LABELS[resource]}
                    </span>
                  </td>
                  <td style={{ color: remaining[resource] > 0 ? 'var(--text)' : 'var(--text-faint)' }}>
                    {formatShortScale(remaining[resource])}
                  </td>
                  <td style={{ color: 'var(--text-faint)' }}>{formatShortScale(total[resource])}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Section>
  );
}
