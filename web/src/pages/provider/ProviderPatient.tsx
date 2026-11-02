import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Screen, ErrorNote } from '../../components/Screen';
import { StatusSignal } from '../../components/StatusSignal';
import { RiseTrace } from '../../components/RiseTrace';
import { DomainSummary } from '../../components/DomainSummary';
import { api, toExport } from '../../lib/api';
import { fmtDate, sexLabel, signed } from '../../lib/format';
import type { Patient } from '../../lib/types';

const ACT: Record<string, string> = { rarely: 'Rarely exercises', some: 'Light activity', regular: 'Exercises 2–3×/week', very: 'Strength trains most weeks' };
const FALLS: Record<string, string> = { none: 'None', once: 'One', more: 'More than one', skip: 'Not answered' };

export function ProviderPatient() {
  const { code = '', id = '' } = useParams();
  const [p, setP] = useState<Patient | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  useEffect(() => { api.providerPatient(code, id).then(setP).catch((e: Error) => setErr(e.message)); }, [code, id]);
  if (err) return <Screen wide back={{ to: `/provider/${code}`, label: 'All check-ins' }}><ErrorNote message={err} /></Screen>;
  if (!p) return <Screen wide><p className="muted">Loading patient…</p></Screen>;

  const last = p.checks[p.checks.length - 1];
  const base = p.checks[0];
  const json = JSON.stringify(toExport(p), null, 2);
  async function copyExport() {
    try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setShowJson(true); }
  }

  return (
    <Screen wide back={{ to: `/provider/${code}`, label: 'All check-ins' }}>
      <div className="prov-head">
        <div className="stack">
          <div className="row"><h1 className="display">{p.firstName}</h1>{last && <StatusSignal state={last.state} />}{p.tier === 'higher' && <span className="rise-tag">Higher risk</span>}</div>
          <div className="muted">{sexLabel(p.sex)}, {p.age} · {p.medication ?? 'GLP-1'}{p.dose ? ` ${p.dose}` : ''}{p.startDate ? ` since ${fmtDate(p.startDate, { month: 'short', year: 'numeric' })}` : ''}</div>
        </div>
        <div className="row">
          <button className="rise-btn rise-btn--secondary" onClick={copyExport}>{copied ? 'Copied' : 'Copy record data'}</button>
          <button className="rise-btn rise-btn--quiet" onClick={() => setShowJson((v) => !v)}>{showJson ? 'Hide record data' : 'View record data'}</button>
        </div>
      </div>

      {showJson && <pre className="rise-card tbl-wrap" style={{ margin: 0, fontSize: 13, lineHeight: '20px', maxHeight: 360, overflow: 'auto', fontFamily: 'var(--font-mono)' }}>{json}</pre>}
      <div className="detail-grid">
        <div className="stack" style={{ gap: 24 }}>
          {last && (
            <section className="rise-card stack" aria-labelledby="why">
              <div className="rise-step__head"><h2 className="rise-title" id="why">Why this result</h2><StatusSignal state={last.state} /></div>
              {last.reasons.length ? <ul className="reasons">{last.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                : <p className="rise-caption" style={{ margin: 0 }}>Every measure is within range for this patient.</p>}
              {last.flagged && <p className="note">Readiness flag: the patient reported {[last.sleptPoorly && 'poor sleep', last.painOrIll && 'pain or illness'].filter(Boolean).join(' and ')}. Not escalated; retest in 7 days.</p>}
              <p className="rise-caption" style={{ margin: 0 }}><b>Patient was told:</b> {last.action}</p>
            </section>
          )}
          {last ? (
            <section className="rise-card stack">
              <div className="rise-label">Leg strength · 30-second chair stand</div>
              <div className="meter">
                <span className="data-xl">{last.stands}<span className="rise-caption"> reps</span></span>
                <span className="rise-caption" style={{ textAlign: 'right' }}>
                  {base && base !== last ? `${signed(last.stands - base.stands)} since baseline (${base.stands})` : 'Baseline'}<br />
                  {last.belowNorm ? `Below average for ${p.sex === 'male' ? 'men' : 'women'} ${last.normBand} (under ${last.normCutoff})` : `At or above STEADI norm (${last.normCutoff}+)`}
                </span>
              </div>
              {p.checks.length > 1 && <RiseTrace points={p.checks.map((c) => ({ date: c.createdAt, stands: c.stands }))} cutoff={last.normCutoff} bandLabel={`Shaded: at or above the STEADI norm for age ${last.normBand}`} wide />}
              <p className="rise-caption" style={{ margin: 0 }}>Shaded: at or above CDC STEADI norm for {p.sex === 'male' ? 'men' : 'women'} {last.normBand}{p.age < 60 ? ' (extrapolated; STEADI norms start at 60)' : ''}. Phone video is a pilot measure pending validation against in-person testing.</p>
            </section>
          ) : <p className="note">No checks yet.</p>}

          {last?.domains?.mass.measured && (() => {
            const m = last.domains!.mass;
            const scans = p.checks.filter((c) => c.leanMassLb != null && c.bodyCompMethod === m.method);
            const first = scans[0];
            return (
              <section className="rise-card stack">
                <div className="rise-step__head"><div className="rise-label">Muscle mass · {m.methodLabel}</div>{m.state && <StatusSignal state={m.state} />}</div>
                <div className="mini-stats">
                  <div><span className="rise-caption">Weight</span><b>{first && first !== scans[scans.length - 1] ? `${first.weightLb} → ${last.weightLb}` : last.weightLb} lb</b></div>
                  <div><span className="rise-caption">Lean mass</span><b>{first && first !== scans[scans.length - 1] ? `${first.leanMassLb} → ${last.leanMassLb}` : last.leanMassLb} lb</b></div>
                  <div><span className="rise-caption">Lean share of loss</span><b>{m.leanShare != null ? `${Math.round(m.leanShare * 100)}%` : '—'}</b></div>
                  {last.bodyFatPct != null && <div><span className="rise-caption">Body fat</span><b>{last.bodyFatPct}%</b></div>}
                </div>
                <p className="rise-caption" style={{ margin: 0 }}>
                  {m.leanShare != null ? `${m.leanLost} lb lean of ${m.weightLost} lb lost since ${fmtDate(m.baselineDate!)}. ` : 'Not enough weight change since the first scan on this device to judge yet (needs 4 lb and 2%). '}
                  GLP-1 trials report lean mass at about 20–40% of weight lost (Dubin et al., 2024); Watch at 40%, Check in at 60% (draft). Only scans from the same device are compared. Lean mass includes water and organs, not just muscle.
                  {m.lowMuscle ? ' Appendicular muscle index is below the EWGSOP2 cut-off.' : ''}
                </p>
              </section>
            );
          })()}

          {last?.domains?.grip.measured && (() => {
            const g = last.domains!.grip;
            return (
              <section className="rise-card stack">
                <div className="rise-step__head"><div className="rise-label">Grip strength</div>{g.state && <StatusSignal state={g.state} />}</div>
                <div className="mini-stats">
                  <div><span className="rise-caption">Latest</span><b>{g.value} kg</b></div>
                  <div><span className="rise-caption">First</span><b>{g.baseline} kg</b></div>
                  <div><span className="rise-caption">EWGSOP2 cut-off</span><b>{g.cutoff} kg</b></div>
                </div>
                <p className="rise-caption" style={{ margin: 0 }}>Patient-reported from a home dynamometer, best of 3. Watch below the cut-off or after a 10% drop; Check in after a 20% drop (draft).</p>
              </section>
            );
          })()}

          <section className="rise-card">
            <h2 className="rise-title" style={{ marginBottom: 8 }}>Checks</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Date</th><th>State</th><th>Reps</th><th>Weight</th><th>Lean</th><th>Grip</th><th>Capture</th><th>Readiness</th></tr></thead>
                <tbody>
                  {[...p.checks].reverse().map((c) => (
                    <tr key={c.id}>
                      <td className="rise-num">{fmtDate(c.createdAt)}</td>
                      <td><StatusSignal state={c.state} /></td>
                      <td className="rise-num">{c.stands}</td>
                      <td className="rise-num">{c.weightLb ?? '—'}</td>
                      <td className="rise-num">{c.leanMassLb ?? '—'}{c.domains?.mass.leanShare != null ? ` (${Math.round(c.domains.mass.leanShare * 100)}%)` : ''}</td>
                      <td className="rise-num">{c.gripKg != null ? `${c.gripKg} kg` : '—'}</td>
                      <td>{c.method === 'demo' ? 'Self-reported' : `Video${c.confidence != null ? ` · ${Math.round(c.confidence * 100)}%` : ''}`}</td>
                      <td>{c.sleptPoorly || c.painOrIll ? [c.sleptPoorly && 'Slept badly', c.painOrIll && 'Pain or ill'].filter(Boolean).join(', ') : 'OK'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="stack" style={{ gap: 24 }}>
          {last?.domains && <DomainSummary domains={last.domains} title="What the patient sees" />}
          <section className="rise-card stack">
            <h2 className="rise-title">Risk tier: {p.tier === 'higher' ? 'Higher' : 'Standard'}</h2>
            {p.tierReasons.length ? <ul style={{ margin: 0, paddingLeft: 20, fontSize: 16, lineHeight: '24px' }}>{p.tierReasons.map((r) => <li key={r}>{r}</li>)}</ul>
              : <p className="rise-caption" style={{ margin: 0 }}>No risk factors from setup.</p>}
            <p className="rise-caption" style={{ margin: 0 }}>Checks every {p.checkEveryDays} days. Next due {fmtDate(p.nextDue)}.</p>
          </section>
          <section className="rise-card stack">
            <h2 className="rise-title">Setup answers</h2>
            <dl className="kv">
              <dt>Goal</dt><dd>{p.goal ?? '—'}</dd>
              <dt>Activity</dt><dd>{p.activity ? ACT[p.activity] : '—'}</dd>
              <dt>Falls (1 yr)</dt><dd>{p.falls ? FALLS[p.falls] : '—'}</dd>
              <dt>Joint pain</dt><dd>{p.jointPain === 'yes' ? 'Yes, standing is hard' : p.jointPain === 'no' ? 'No' : '—'}</dd>
              {p.sex === 'female' && <><dt>Menopause</dt><dd>{({ yes: 'Yes', no: 'No', unsure: 'Not sure', skip: 'Not answered' } as Record<string, string>)[p.menopause ?? ''] ?? '—'}</dd></>}
              <dt>Weight</dt><dd className="rise-num">{p.startWeightLb && p.currentWeightLb ? `${p.startWeightLb} → ${p.currentWeightLb} lb` : '—'}</dd>
            </dl>
          </section>
        </aside>
      </div>
    </Screen>
  );
}
