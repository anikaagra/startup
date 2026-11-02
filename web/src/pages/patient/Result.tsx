import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Screen, ErrorNote } from '../../components/Screen';
import { StatusSignal } from '../../components/StatusSignal';
import { RiseTrace } from '../../components/RiseTrace';
import { NextStepCard } from '../../components/NextStepCard';
import { api } from '../../lib/api';
import { session } from '../../lib/session';
import { fmtDate, signed } from '../../lib/format';
import type { Patient } from '../../lib/types';

export function Result() {
  const { checkId } = useParams();
  const [p, setP] = useState<Patient | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const id = session.get();
    if (!id) { setErr('Please set up Rise on this phone first.'); return; }
    api.getPatient(id).then(setP).catch((e: Error) => setErr(e.message));
  }, []);
  if (err) return <Screen back={{ to: '/', label: 'Home' }}><ErrorNote message={err} /></Screen>;
  if (!p) return <Screen><p className="muted">Loading your result…</p></Screen>;

  const idx = p.checks.findIndex((c) => String(c.id) === checkId);
  const c = p.checks[idx];
  if (!c) return <Screen back={{ to: '/', label: 'Home' }}><ErrorNote message="We couldn't find that check." /></Screen>;
  const prev = idx > 0 ? p.checks[idx - 1] : null;
  const upTo = p.checks.slice(0, idx + 1);
  const change = prev ? c.stands - prev.stands : null;

  return (
    <Screen back={{ to: '/', label: 'Home' }} footer={<Link to="/" className="rise-btn rise-btn--primary rise-btn--block">Done</Link>}>
      <div className="stack">
        <StatusSignal state={c.state} />
        <h1 className="display-xl">{c.verdict}</h1>
      </div>
      <div className="meter">
        <div><div className="rise-label">Stands in 30 seconds</div><div className="data-xl">{c.stands}</div></div>
        <div className="rise-caption" style={{ textAlign: 'right' }}>
          {change == null ? 'Your starting point' : change === 0 ? 'Same as last check' : `${signed(change)} since ${fmtDate(prev!.createdAt)}`}
          <br />{fmtDate(c.createdAt, { month: 'long', day: 'numeric' })}
        </div>
      </div>
      {upTo.length > 1 && (
        <div className="rise-card">
          <RiseTrace points={upTo.map((x) => ({ date: x.createdAt, stands: x.stands }))} cutoff={c.normCutoff} bandLabel="Shaded area: typical for your age and sex" />
          <p className="rise-caption" style={{ margin: '8px 0 0' }}>Shaded area: typical for your age and sex.</p>
        </div>
      )}
      <NextStepCard state={c.state} action={c.action} reason={c.reason} retestDate={c.retestDate} />
      {c.flagged && <p className="note">You told us you slept badly or felt unwell today, so we won't change your plan on this check alone.</p>}
      {(c.leanMassLb != null || c.bodyFatPct != null) && (
        <details className="rise-card">
          <summary className="rise-title" style={{ cursor: 'pointer' }}>Body scan</summary>
          <dl className="kv" style={{ marginTop: 12 }}>
            {c.leanMassLb != null && <><dt>Lean mass</dt><dd className="rise-num">{c.leanMassLb} lb</dd></>}
            {c.bodyFatPct != null && <><dt>Body fat</dt><dd className="rise-num">{c.bodyFatPct}%</dd></>}
          </dl>
        </details>
      )}
      <p className="rise-caption" style={{ margin: 0 }}>Rise tracks changes in strength. It doesn't diagnose. Talk to your care team about any concerns.</p>
    </Screen>
  );
}
