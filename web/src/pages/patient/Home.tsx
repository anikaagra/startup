import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen, ErrorNote } from '../../components/Screen';
import { StatusSignal } from '../../components/StatusSignal';
import { RiseTrace } from '../../components/RiseTrace';
import { api } from '../../lib/api';
import { session } from '../../lib/session';
import { fmtDate, today } from '../../lib/format';
import type { Patient } from '../../lib/types';

export function Home() {
  const [p, setP] = useState<Patient | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const id = session.get();
    if (!id) return;
    api.getPatient(id).then(setP).catch((e: Error) => {
      if (/not found/i.test(e.message)) { session.clear(); window.location.assign('/'); }
      else setErr(e.message);
    });
  }, []);

  if (err) return <Screen><ErrorNote message={err} /></Screen>;
  if (!p) return <Screen><p className="muted">Loading your checks…</p></Screen>;

  const last = p.checks[p.checks.length - 1];
  const due = !last || p.nextDue <= today();
  return (
    <Screen footer={<Link to="/check" className={`rise-btn rise-btn--block ${due ? 'rise-btn--primary' : 'rise-btn--secondary'}`}>{due ? 'Start my check' : 'Check early'}</Link>}>
      <div className="stack">
        <h1 className="display">Hi, {p.firstName}.</h1>
        <p className="rise-body-lg">
          {last ? (due ? 'Your muscle check is due. It takes about 3 minutes.' : `Your next check is ${fmtDate(p.nextDue, { weekday: 'long', month: 'long', day: 'numeric' })}.`)
            : "Let's do your first check. It sets your starting point."}
        </p>
        <p className="rise-caption" style={{ margin: 0 }}>We'll check in every {p.checkEveryDays === 14 ? '2 weeks' : '4 weeks'}{p.tier === 'higher' ? ', a little more often because of your answers at setup' : ''}.</p>
      </div>

      {last && (
        <section className="rise-card stack" aria-labelledby="latest">
          <div className="rise-step__head"><h2 className="rise-title" id="latest">Latest check</h2><StatusSignal state={last.state} /></div>
          <div className="meter"><span className="data-xl">{last.stands}</span><span className="rise-caption">stands in 30 s · {fmtDate(last.createdAt)}</span></div>
          {p.checks.length > 1 && <RiseTrace points={p.checks.map((c) => ({ date: c.createdAt, stands: c.stands }))} cutoff={last.normCutoff} bandLabel="Shaded area: typical for your age and sex" />}
          <p className="rise-body-lg">{last.action}</p>
        </section>
      )}

      {p.checks.length > 0 && (
        <section className="rise-card" aria-labelledby="history">
          <h2 className="rise-title" id="history" style={{ marginBottom: 8 }}>Your checks</h2>
          <ul className="history">
            {[...p.checks].reverse().map((c) => (
              <li key={c.id}><Link to={`/result/${c.id}`}>
                <span style={{ minWidth: 72 }}>{fmtDate(c.createdAt)}</span>
                <span className="rise-num">{c.stands} stands</span>
                <span style={{ marginLeft: 'auto' }}><StatusSignal state={c.state} /></span>
              </Link></li>
            ))}
          </ul>
        </section>
      )}
      <button className="rise-btn rise-btn--quiet" onClick={() => { session.clear(); window.location.assign('/'); }}>Sign out of this phone</button>
    </Screen>
  );
}
