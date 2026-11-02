import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, ErrorNote } from '../../components/Screen';
import { CameraStage, type Capture } from '../../components/CameraStage';
import { api, IS_DEMO } from '../../lib/api';
import { DemoCamera } from '../../components/DemoCamera';
import { session } from '../../lib/session';
import { say } from '../../lib/speech';

type Step = 'readiness' | 'scan' | 'setup' | 'camera' | 'manual' | 'saving';

function YesNo({ id, label, value, onChange }: { id: string; label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="rise-title" style={{ marginBottom: 12 }}>{label}</legend>
      <div className="rise-choices" role="radiogroup">
        <label className="rise-choice"><input type="radio" name={id} id={`${id}-no`} checked={value === false} onChange={() => onChange(false)} /> No</label>
        <label className="rise-choice"><input type="radio" name={id} id={`${id}-yes`} checked={value === true} onChange={() => onChange(true)} /> Yes</label>
      </div>
    </fieldset>
  );
}

export function CheckFlow() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('readiness');
  const [sleptPoorly, setSlept] = useState<boolean | null>(null);
  const [painOrIll, setPain] = useState<boolean | null>(null);
  const [lean, setLean] = useState('');
  const [fat, setFat] = useState('');
  const [manual, setManual] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const save = useCallback(async (c: Capture, method: 'phone-video' | 'demo') => {
    setStep('saving');
    try {
      const r = await api.submitCheck(session.get()!, {
        ...c, method, sleptPoorly, painOrIll,
        leanMassLb: lean ? Number(lean) : null, bodyFatPct: fat ? Number(fat) : null,
      });
      const last = r.patient.checks[r.patient.checks.length - 1];
      nav(`/result/${last.id}`, { replace: true });
    } catch (e) { setErr((e as Error).message); setStep(method === 'demo' ? 'manual' : 'camera'); }
  }, [sleptPoorly, painOrIll, lean, fat, nav]);

  const onCapture = useCallback((c: Capture) => save(c, 'phone-video'), [save]);

  if (step === 'readiness') return (
    <Screen back={{ to: '/', label: 'Cancel' }} footer={<button className="rise-btn rise-btn--primary rise-btn--block"
      onClick={() => (sleptPoorly == null || painOrIll == null ? setErr('Please answer both questions.') : (setErr(null), setStep('scan')))}>Next</button>}>
      <div className="stack"><div className="rise-label">Before you start</div><h1 className="display">How are you today?</h1></div>
      <YesNo id="slept" label="Did you sleep badly last night?" value={sleptPoorly} onChange={setSlept} />
      <YesNo id="pain" label="Are you in pain or feeling sick today?" value={painOrIll} onChange={setPain} />
      <p className="rise-caption" style={{ margin: 0 }}>A rough day can lower your count. We take that into account.</p>
      <ErrorNote message={err} />
    </Screen>
  );

  if (step === 'scan') return (
    <Screen back={{ to: '/', label: 'Cancel' }} footer={<>
      <button className="rise-btn rise-btn--primary rise-btn--block" onClick={() => setStep('setup')}>{lean || fat ? 'Next' : 'Skip for now'}</button></>}>
      <div className="stack"><div className="rise-label">Step 1 of 2 · Body scan</div><h1 className="display">Add your body scan</h1></div>
      <p className="rise-body-lg">If you use a body scan app or smart scale, enter today's numbers. Phone body scanning is coming to Rise soon.</p>
      <div className="two-col">
        <div className="field"><label className="rise-label" htmlFor="lean">Lean mass (lb)</label><input id="lean" className="rise-num" inputMode="decimal" value={lean} onChange={(e) => setLean(e.target.value)} /></div>
        <div className="field"><label className="rise-label" htmlFor="fat">Body fat (%)</label><input id="fat" className="rise-num" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} /></div>
      </div>
    </Screen>
  );

  if (step === 'setup') return (
    <Screen back={{ to: '/', label: 'Cancel' }} footer={<button className="rise-btn rise-btn--primary rise-btn--block"
      onClick={() => { say('Getting your camera ready.', { force: true }); setStep('camera'); }}>Open the camera</button>}>
      <div className="stack"><div className="rise-label">Step 2 of 2 · Strength</div><h1 className="display">Set up your chair and phone</h1></div>
      <ol className="stack" style={{ margin: 0, paddingLeft: 24 }}>
        <li>Use a firm chair without arms, about knee height, against a wall.</li>
        <li>Prop your phone at hip height, 2 to 3 steps away.</li>
        <li>Turn the chair so your side faces the phone.</li>
        <li>Turn your volume up. We'll talk you through it.</li>
      </ol>
      <p className="note">Your video stays on this phone. Only your count is saved.</p>
    </Screen>
  );

  if (step === 'camera') return (
    <Screen back={{ to: '/', label: 'Cancel' }}>
      <ErrorNote message={err} />
      {IS_DEMO ? <DemoCamera onDone={(c) => save(c, 'demo')} /> : <CameraStage onDone={onCapture} onManual={() => setStep('manual')} />}
    </Screen>
  );

  if (step === 'manual') return (
    <Screen back={{ to: '/', label: 'Cancel' }} footer={<button className="rise-btn rise-btn--primary rise-btn--block" onClick={() => {
      const n = Number(manual);
      if (!Number.isInteger(n) || n < 0 || n > 40) return setErr('Enter a whole number from 0 to 40.');
      setErr(null); save({ stands: n, confidence: 1, durationSec: 30 }, 'demo');
    }}>Save my count</button>}>
      <div className="stack"><div className="rise-label">Count it yourself</div><h1 className="display">How many times did you stand up?</h1></div>
      <p className="rise-body-lg">Ask someone to time 30 seconds while you stand up and sit down as many times as you can, arms crossed. Count each full stand.</p>
      <div className="field"><label className="rise-label" htmlFor="manual">Stands in 30 seconds</label><input id="manual" className="rise-num" inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} /></div>
      <p className="rise-caption" style={{ margin: 0 }}>Counts you enter are marked as self-reported for your care team.</p>
      <ErrorNote message={err} />
    </Screen>
  );

  return <Screen><p className="rise-body-lg" aria-live="polite">Saving your check…</p></Screen>;
}
