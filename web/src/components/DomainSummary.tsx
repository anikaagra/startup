import type { Domains } from '../lib/types';
import { StatusSignal } from './StatusSignal';

const ROWS: [keyof Domains, string, string][] = [
  ['function', 'Leg strength', 'Sit-to-stand'],
  ['mass', 'Muscle', 'Body scan'],
  ['grip', 'Grip', 'Optional'],
];

/** One row per measure: what it shows and how it's doing. Used on the result and provider screens. */
export function DomainSummary({ domains, title = 'Your muscle check' }: { domains: Domains; title?: string }) {
  return (
    <section className="rise-card" aria-labelledby="domains-title">
      <h2 className="rise-title" id="domains-title" style={{ marginBottom: 4 }}>{title}</h2>
      <ul className="domains">
        {ROWS.map(([key, label, sub]) => {
          const d = domains[key];
          return (
            <li key={key} className="domain">
              <div className="domain__head">
                <div><div className="domain__label">{label}</div><div className="rise-caption">{sub}</div></div>
                {d.measured && d.state ? <StatusSignal state={d.state} /> : <span className="rise-caption">Not measured</span>}
              </div>
              {d.measured && <p className="domain__line">{d.patientLine}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
