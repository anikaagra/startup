import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, ErrorNote } from '../../components/Screen';
import { CameraStage, type Capture } from '../../components/CameraStage';
import { api, IS_DEMO } from '../../lib/api';
import { DemoCamera } from '../../components/DemoCamera';
import { BodyScanCapture, type PhoneScan } from '../../components/BodyScanCapture';
import { BodyCompImport } from '../../components/BodyCompImport';
import type { ImportedScan } from '../../lib/bodyScan/importParser';
import { session } from '../../lib/session';
import { say } from '../../lib/speech';

type Step = 'readiness' | 'scan' | 'grip' | 'setup' | 'camera' | 'manual' | 'saving';
import type { BodyCompMethod, Patient } from '../../lib/types';

const METHODS: [BodyCompMethod, string][] = [
  ['rise-scan', 'Rise phone scan'], ['scan-app', 'Another body scan app'], ['smart-scale', 'Smart scale at home'], ['dexa', 'DEXA scan'], ['clinic-bia', "My clinic's body composition scale"], ['other', 'Something else'],
];
const LB_PER_KG = 2.20462;

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
  const [weight, setWeight] = useState('');
  const [asm, setAsm] = useState('');
  const [method, setMethod] = useState<BodyCompMethod | ''>('');
  const [hasGrip, setHasGrip] = useState<boolean | null>(null);
  const [grip, setGrip] = useState('');
  const [gripUnit, setGripUnit] = useState<'kg' | 'lb'>('kg');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [scanMode, setScanMode] = useState<'choose' | 'phone' | 'import' | 'review'>('choose');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const fromPhone = (r: PhoneScan) => {
    setWeight(String(r.weightLb)); setLean(String(r.leanMassLb)); setFat(String(r.bodyFatPct)); setAsm(''); setMethod('rise-scan');
    setDetail({ source: 'rise-scan', neckIn: r.neckIn, waistIn: r.waistIn, hipIn: r.hipIn, equation: 'US Navy (Hodgdon & Beckett 1984)' });
    setImportNotes(['From your Rise scan. Check the numbers, then continue.']); setScanMode('review');
  };
  const fromImport = (r: ImportedScan) => {
    if (r.weightLb != null) setWeight(String(r.weightLb));
    if (r.leanMassLb != null) setLean(String(r.leanMassLb));
    if (r.bodyFatPct != null) setFat(String(r.bodyFatPct));
    if (r.asmKg != null) setAsm(String(r.asmKg));
    setMethod(r.sourceGuess === 'other' ? '' : r.sourceGuess);
    setDetail({ source: 'import', from: r.sourceName, measuredOn: r.date, rowsInFile: r.rows });
    setImportNotes([`Imported${r.sourceName ? ` from ${r.sourceName}` : ''}${r.date ? `, measured ${r.date}` : ''}. Check the numbers and the device, then continue.`, ...r.warnings]);
    setScanMode('review');
  };
  useEffect(() => {
    api.getPatient(session.get()!).then((p) => {
      setPatient(p);
      const lastScan = [...p.checks].reverse().find((c) => c.bodyCompMethod);
      if (lastScan?.bodyCompMethod) setMethod(lastScan.bodyCompMethod);
      if (p.checks.some((c) => c.gripKg != null)) setHasGrip(true);
    }).catch(() => undefined);
  }, []);
  const lastScan = patient ? [...patient.checks].reverse().find((c) => c.bodyCompMethod) : undefined;
  const gripKg = grip ? Math.round((gripUnit === 'kg' ? Number(grip) : Number(grip) / LB_PER_KG) * 10) / 10 : null;
  const [manual, setManual] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const save = useCallback(async (c: Capture, captureMethod: 'phone-video' | 'demo') => {
    setStep('saving');
    try {
      const r = await api.submitCheck(session.get()!, {
        ...c, method: captureMethod, sleptPoorly, painOrIll,
        weightLb: weight ? Number(weight) : null, leanMassLb: lean ? Number(lean) : null, bodyFatPct: fat ? Number(fat) : null,
        asmKg: asm ? Number(asm) : null, bodyCompMethod: lean || fat || asm ? method || null : null, gripKg: hasGrip ? gripKg : null,
        bodyCompDetail: lean || fat ? detail : null,
      });
      const last = r.patient.checks[r.patient.checks.length - 1];
      nav(`/result/${last.id}`, { replace: true });
    } catch (e) { setErr((e as Error).message); setStep(captureMethod === 'demo' ? 'manual' : 'camera'); }
  }, [sleptPoorly, painOrIll, lean, fat, weight, asm, method, hasGrip, gripKg, detail, nav]);

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

  const checkScan = () => {
    const w = Number(weight), l = Number(lean), f = Number(fat);
    if (!weight && !lean && !fat && !asm) return null;
    if (!weight) return "Please enter today's weight. We need it to tell muscle loss from fat loss.";
    if (w < 60 || w > 800) return 'Please enter a weight between 60 and 800 lb.';
    if ((lean || fat || asm) && !method) return 'Please choose where these numbers came from.';
    if (lean && (l < 30 || l >= w)) return 'Lean mass should be less than your weight. Check the number on your scan.';
    if (fat && (f < 3 || f > 75)) return 'Body fat should be between 3% and 75%.';
    if (lean && fat && Math.abs(l + (w * f) / 100 - w) > w * 0.08) return "Your lean mass and body fat don't add up to your weight. Check both numbers on your scan.";
    return null;
  };

  if (step === 'scan' && scanMode !== 'review') return (
    <Screen back={{ to: '/', label: 'Cancel' }} footer={scanMode === 'choose' ? <button className="rise-btn rise-btn--quiet" onClick={() => { setErr(null); setStep('grip'); }}>Skip body scan this time</button> : undefined}>
      <div className="stack"><div className="rise-label">Step 1 of 3 · Muscle and fat</div><h1 className="display">{scanMode === 'phone' ? 'Scan with your phone' : scanMode === 'import' ? 'Import a body scan' : 'Add your body scan'}</h1></div>
      {scanMode === 'choose' && (
        <>
          <p className="rise-body-lg">We compare how much of the weight you lose is muscle, not just how much you lose. Choose how to add today's numbers.</p>
          <div className="stack">
            <button className="rise-choice" onClick={() => setScanMode('phone')}><b>Scan with this phone</b><span className="rise-caption" style={{ marginLeft: 'auto' }}>2 photos</span></button>
            <button className="rise-choice" onClick={() => setScanMode('import')}><b>Import from a scale, InBody or DEXA</b><span className="rise-caption" style={{ marginLeft: 'auto' }}>CSV file</span></button>
            <button className="rise-choice" onClick={() => { setDetail({ source: 'typed' }); setImportNotes([]); setScanMode('review'); }}><b>Type the numbers in</b></button>
          </div>
          {lastScan?.bodyCompMethod && <p className="rise-caption" style={{ margin: 0 }}>Last time you used: {METHODS.find(([v]) => v === lastScan.bodyCompMethod)?.[1]}. Using the same way each time gives the most reliable comparison.</p>}
        </>
      )}
      {scanMode === 'phone' && <BodyScanCapture sex={patient?.sex ?? 'female'} heightIn={patient?.heightIn ?? null} weightLb={weight} onWeight={setWeight} onDone={fromPhone} onCancel={() => setScanMode('choose')} />}
      {scanMode === 'import' && <BodyCompImport onDone={fromImport} onCancel={() => setScanMode('choose')} />}
    </Screen>
  );

  if (step === 'scan') return (
    <Screen back={{ to: '/', label: 'Cancel' }} footer={<>
      <button className="rise-btn rise-btn--primary rise-btn--block" onClick={() => { const e = checkScan(); if (e) return setErr(e); setErr(null); setStep('grip'); }}>
        {weight || lean ? 'Next' : 'Skip body scan'}</button>
      <button className="rise-btn rise-btn--quiet" onClick={() => { setErr(null); setScanMode('choose'); }}>Choose another way</button></>}>
      <div className="stack"><div className="rise-label">Step 1 of 3 · Muscle and fat</div><h1 className="display">Add today's body scan</h1></div>
      {importNotes.length ? importNotes.map((n) => <p key={n} className="note">{n}</p>)
        : <p className="rise-body-lg">Copy the numbers from your body scan app, smart scale or clinic scan.</p>}
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rise-label" style={{ marginBottom: 8 }}>Where are these numbers from?</legend>
        <div className="rise-choices" role="radiogroup">
          {METHODS.map(([v, label]) => (
            <label className="rise-choice" key={v}><input type="radio" name="method" id={`method-${v}`} checked={method === v} onChange={() => { setErr(null); setMethod(v); }} /> {label}</label>
          ))}
        </div>
      </fieldset>
      {lastScan && method && method !== lastScan.bodyCompMethod && <p className="note">Last time you used a different device. We'll start a new comparison, because different devices give different numbers.</p>}
      <div className="field"><label className="rise-label" htmlFor="weight">Today's weight (lb)</label><input id="weight" className="rise-num" inputMode="decimal" value={weight} onChange={(e) => { setErr(null); setWeight(e.target.value); }} /></div>
      <div className="two-col">
        <div className="field"><label className="rise-label" htmlFor="lean">Lean mass (lb)</label><input id="lean" className="rise-num" inputMode="decimal" value={lean} onChange={(e) => { setErr(null); setLean(e.target.value); }} /></div>
        <div className="field"><label className="rise-label" htmlFor="fat">Body fat (%)</label><input id="fat" className="rise-num" inputMode="decimal" value={fat} onChange={(e) => { setErr(null); setFat(e.target.value); }} /></div>
      </div>
      <details>
        <summary className="rise-label" style={{ cursor: 'pointer' }}>More from your scan (optional)</summary>
        <div className="field" style={{ marginTop: 12 }}><label className="rise-label" htmlFor="asm">Arm and leg lean mass (kg)</label>
          <input id="asm" className="rise-num" inputMode="decimal" value={asm} onChange={(e) => { setErr(null); setAsm(e.target.value); }} />
          <span className="rise-caption">Some scans call this "appendicular lean mass" or "ALM".</span></div>
      </details>
      <p className="rise-caption" style={{ margin: 0 }}>Use the same device each time, at the same time of day, before eating. Lean mass includes muscle and water, so a single reading can move a little.</p>
      <ErrorNote message={err} />
    </Screen>
  );

  if (step === 'grip') return (
    <Screen back={{ to: '/', label: 'Cancel' }} footer={<button className="rise-btn rise-btn--primary rise-btn--block" onClick={() => {
      if (hasGrip) {
        if (gripKg == null || gripKg < 2 || gripKg > 90) return setErr(gripUnit === 'kg' ? 'Enter your best grip between 2 and 90 kg.' : 'Enter your best grip between 5 and 198 lb.');
      }
      setErr(null); setStep('setup');
    }}>{hasGrip && grip ? 'Next' : 'Skip grip test'}</button>}>
      <div className="stack"><div className="rise-label">Step 2 of 3 · Grip (optional)</div><h1 className="display">Do you have a grip strength meter?</h1></div>
      <div className="rise-choices" role="radiogroup">
        <label className="rise-choice"><input type="radio" name="hasGrip" id="hasGrip-yes" checked={hasGrip === true} onChange={() => setHasGrip(true)} /> Yes</label>
        <label className="rise-choice"><input type="radio" name="hasGrip" id="hasGrip-no" checked={hasGrip === false} onChange={() => { setHasGrip(false); setGrip(''); setErr(null); }} /> No, skip this</label>
      </div>
      {hasGrip ? (
        <>
          <ol className="stack" style={{ margin: 0, paddingLeft: 24 }}>
            <li>Sit with your elbow bent at a right angle, close to your side.</li>
            <li>Squeeze as hard as you can for 3 seconds.</li>
            <li>Do 3 tries with your stronger hand, resting a minute between. Enter your best.</li>
          </ol>
          <div className="two-col">
            <div className="field"><label className="rise-label" htmlFor="grip">Best grip</label><input id="grip" className="rise-num" inputMode="decimal" value={grip} onChange={(e) => { setErr(null); setGrip(e.target.value); }} /></div>
            <div className="field"><label className="rise-label" htmlFor="gripUnit">Unit</label>
              <select id="gripUnit" value={gripUnit} onChange={(e) => setGripUnit(e.target.value as 'kg' | 'lb')}><option value="kg">kg</option><option value="lb">lb</option></select></div>
          </div>
        </>
      ) : <p className="rise-caption" style={{ margin: 0 }}>A grip test adds a second strength measure. A basic hand dynamometer costs about $25. Your check works fine without it.</p>}
      <ErrorNote message={err} />
    </Screen>
  );

  if (step === 'setup') return (
    <Screen back={{ to: '/', label: 'Cancel' }} footer={<button className="rise-btn rise-btn--primary rise-btn--block"
      onClick={() => { say('Getting your camera ready.', { force: true }); setStep('camera'); }}>Open the camera</button>}>
      <div className="stack"><div className="rise-label">Step 3 of 3 · Leg strength</div><h1 className="display">Set up your chair and phone</h1></div>
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
