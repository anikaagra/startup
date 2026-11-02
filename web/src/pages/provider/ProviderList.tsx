import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Screen, ErrorNote } from '../../components/Screen';
import { StatusSignal } from '../../components/StatusSignal';
import { Sparkline } from '../../components/Sparkline';
import { api } from '../../lib/api';
import { fmtDate, monthsSince, sexLabel } from '../../lib/format';
import type { ProviderList as PL, ProviderPatient } from '../../lib/types';

function Row({ code, p }: { code: string; p: ProviderPatient }) {
  const m = monthsSince(p.startDate);
  return (
    <Link className="rise-row" to={`/provider/${code}/patients/${p.id}`}>
      <div>
        <div className="rise-row__name">{p.firstName}</div>
        <div className="rise-row__meta">{sexLabel(p.sex)}, {p.age}{p.medication ? ` · ${p.medication}${m != null ? ` ${m} mo` : ''}` : ''} {p.tier === 'higher' && <span className="rise-tag">Higher risk</span>}</div>
      </div>
      {p.state ? <StatusSignal state={p.state} /> : <span className="rise-row__meta">No checks</span>}
      <Sparkline values={p.recent} cutoff={p.normCutoff} />
      <span className="rise-num" style={{ fontSize: 15 }}>
        {p.latest != null ? `${p.latest} reps` : '—'}{p.belowNorm ? ' (low)' : ''}
        {p.leanShare != null && <><br />lean {Math.round(p.leanShare * 100)}% of loss</>}
        {p.gripKg != null && <><br />grip {p.gripKg} kg</>}
      </span>
      <span className="rise-row__meta">{p.lastCheck ? fmtDate(p.lastCheck) : '—'}{p.overdue ? ' · overdue' : ''}</span>
      {p.reasons.length > 0 && p.state !== 'steady' && <span className="rise-row__meta" style={{ gridColumn: '1 / -1' }}>Why: {p.reasons.join('; ')}.</span>}
    </Link>
  );
}

export function ProviderList() {
  const { code = '' } = useParams();
  const [d, setD] = useState<PL | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showSteady, setShowSteady] = useState(false);
  useEffect(() => { api.provider(code).then(setD).catch((e: Error) => setErr(e.message)); }, [code]);
  if (err) return <Screen wide back={{ to: '/provider', label: 'Change clinic' }}><ErrorNote message={err} /></Screen>;
  if (!d) return <Screen wide><p className="muted">Loading check-ins…</p></Screen>;

  const needs = d.patients.filter((p) => p.state === 'checkin' || p.state === 'watch');
  const steady = d.patients.filter((p) => p.state === 'steady');
  const none = d.patients.filter((p) => !p.state);
  const nCheck = needs.filter((p) => p.state === 'checkin').length;

  return (
    <Screen wide back={{ to: '/provider', label: 'Change clinic' }}>
      <div className="prov-head">
        <div className="stack"><div className="rise-label">{d.name}</div><h1 className="display">Check-ins</h1></div>
        <div className="summary-chips">
          <div className="chip-stat"><span className="rise-label">Check in</span><b>{nCheck}</b></div>
          <div className="chip-stat"><span className="rise-label">Watch</span><b>{needs.length - nCheck}</b></div>
          <div className="chip-stat"><span className="rise-label">Steady</span><b>{steady.length}</b></div>
        </div>
      </div>
      <section className="rise-card prov-list" aria-label="Patients who need attention">
        {needs.length ? needs.map((p) => <Row key={p.id} code={d.code} p={p} />) : <div className="rise-row" style={{ gridTemplateColumns: '1fr' }}>No one needs a check-in right now.</div>}
        <div className="rise-row" style={{ gridTemplateColumns: '1fr auto', color: 'var(--ink-muted)' }}>
          <span>{steady.length} patients steady{none.length ? ` · ${none.length} with no checks yet` : ''}</span>
          <button className="rise-btn rise-btn--quiet" onClick={() => setShowSteady((s) => !s)}>{showSteady ? 'Hide' : 'Show all'}</button>
        </div>
        {showSteady && [...steady, ...none].map((p) => <Row key={p.id} code={d.code} p={p} />)}
      </section>
      <p className="rise-caption" style={{ margin: 0 }}>Sorted by urgency, then risk tier. Each result combines the 30-second chair stand (vs. CDC STEADI norms), lean share of weight lost (vs. the 20–40% seen in GLP-1 trials) and optional grip (vs. EWGSOP2 cut-offs). "Low" means below the STEADI norm for age and sex.</p>
    </Screen>
  );
}
