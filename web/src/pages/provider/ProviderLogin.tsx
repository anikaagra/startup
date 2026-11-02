import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, ErrorNote } from '../../components/Screen';
import { api } from '../../lib/api';

export function ProviderLogin() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    try { await api.provider(code.trim()); nav(`/provider/${code.trim().toUpperCase()}`); }
    catch { setErr("That code wasn't found. Check your clinic code and try again."); }
  }
  return (
    <Screen back={{ to: '/', label: 'Patient app' }}>
      <div className="stack"><div className="rise-label">For care teams</div><h1 className="display">Open your check-in list</h1></div>
      <form className="stack" onSubmit={go}>
        <div className="field"><label className="rise-label" htmlFor="clinic">Clinic code</label>
          <input id="clinic" className="rise-num" autoCapitalize="characters" value={code} onChange={(e) => { setErr(null); setCode(e.target.value.toUpperCase()); }} /></div>
        <button className="rise-btn rise-btn--primary rise-btn--block" type="submit">Open check-in list</button>
      </form>
      <p className="note">Demo clinic code: <b className="rise-num">DEMO42</b>. It includes six example patients.</p>
      <p className="rise-caption" style={{ margin: 0 }}>This MVP uses a clinic code only. Add real sign-in before using it with patient data.</p>
      <ErrorNote message={err} />
    </Screen>
  );
}
