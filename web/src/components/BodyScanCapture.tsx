import { useEffect, useRef, useState } from 'react';
import { measureScan, type ScanMeasurements, type Sex, type View } from '../lib/bodyScan/geometry';
import { analyzePhoto, fileToCanvas } from '../lib/bodyScan/segment';
import { say, stopSpeaking } from '../lib/speech';
import { IS_DEMO } from '../lib/api';
import { navyBodyFat } from '../lib/bodyScan/geometry';

export type PhoneScan = ScanMeasurements & { weightLb: number; leanMassLb: number };
type Phase = 'intro' | 'camera' | 'upload' | 'working' | 'result';
type Shot = 'front' | 'side';

const TIMER_S = 10;

/** Two photos (front, side) → neck, waist and hip estimates → estimated body fat and lean mass. */
export function BodyScanCapture({ sex, heightIn, weightLb, onWeight, onDone, onCancel }: {
  sex: Sex; heightIn: number | null; weightLb: string; onWeight: (v: string) => void; onDone: (s: PhoneScan) => void; onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [shot, setShot] = useState<Shot>('front');
  const [count, setCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<PhoneScan | null>(null);
  const [height, setHeight] = useState(heightIn ? String(heightIn) : '');
  const photos = useRef<Partial<Record<Shot, HTMLCanvasElement>>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timers = useRef<number[]>([]);

  const stopCamera = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  useEffect(() => () => { stopCamera(); timers.current.forEach(clearTimeout); stopSpeaking(); }, []);

  const ready = () => {
    const w = Number(weightLb), h = Number(height);
    if (!(w >= 60 && w <= 800)) return "Enter today's weight from your scale first. The scan needs it to work out lean mass.";
    if (!(h >= 48 && h <= 90)) return 'Enter your height in inches (for example, 5 ft 4 in is 64).';
    return null;
  };

  async function process() {
    setPhase('working'); setErr(null);
    try {
      const [front, side] = await Promise.all([analyzePhoto(photos.current.front!), analyzePhoto(photos.current.side!)]) as [View | null, View | null];
      if (!front || !side) throw new Error(`We couldn't find you in the ${!front ? 'front' : 'side'} photo. Stand 6 to 8 feet from the phone with your whole body in view.`);
      const { result: m, issue } = measureScan(front, side, Number(height), sex);
      if (!m) throw new Error(issue ?? 'Try the photos again.');
      const w = Number(weightLb);
      setResult({ ...m, weightLb: w, leanMassLb: Math.round(w * (1 - m.bodyFatPct / 100) * 10) / 10 });
      setPhase('result');
      say('Your scan is done.', { force: true });
    } catch (e) {
      const msg = (e as Error).message;
      setErr(/fetch|network|wasm|model|Failed/i.test(msg) ? "We couldn't start the scanner. Check your internet connection and try again." : msg);
      photos.current = {};
      setShot('front');
      setPhase('intro');
    }
  }

  // The shareable demo can't open a camera or load the model, so it shows example measurements instead.
  function demoScan() {
    const h = Number(height), w = Number(weightLb);
    const neckIn = sex === 'male' ? 16 : 13.5, waistIn = Math.round(h * (w > 200 ? 0.62 : 0.54) * 10) / 10, hipIn = Math.round(h * 0.66 * 10) / 10;
    const bodyFatPct = Math.round((navyBodyFat(sex, h, neckIn, waistIn, hipIn) ?? 35) * 10) / 10;
    setPhase('working');
    setTimeout(() => { setResult({ neckIn, waistIn, hipIn, bodyFatPct, weightLb: w, leanMassLb: Math.round(w * (1 - bodyFatPct / 100) * 10) / 10 }); setPhase('result'); }, 1200);
  }

  async function startCamera() {
    const e = ready(); if (e) return setErr(e);
    if (IS_DEMO) return demoScan();
    setErr(null); setShot('front'); photos.current = {}; setPhase('camera');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => undefined); }
      say('Prop your phone at waist height and step back until your whole body is in view. Face the phone with your arms a little away from your sides.', { force: true });
    } catch {
      setErr('Rise needs your camera for the scan. Allow camera access, or upload two photos instead.');
      setPhase('intro');
    }
  }

  function takeTimed(which: Shot) {
    say(which === 'front' ? 'Face the phone, arms slightly out. Taking the photo in 10 seconds.' : 'Turn so your side faces the phone. Arms relaxed. Taking the photo in 10 seconds.', { force: true });
    for (let i = TIMER_S; i >= 1; i--) timers.current.push(window.setTimeout(() => { setCount(i); if (i <= 3) say(String(i), { force: true }); }, (TIMER_S - i) * 1000));
    timers.current.push(window.setTimeout(() => {
      setCount(null);
      const v = videoRef.current!;
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d')!.drawImage(v, 0, 0);
      photos.current[which] = c;
      if (which === 'front') { setShot('side'); say('Got it. Now turn to your side.', { force: true }); }
      else { stopCamera(); process(); }
    }, TIMER_S * 1000));
  }

  async function onFiles(which: Shot, files: FileList | null) {
    if (!files?.[0]) return;
    photos.current[which] = await fileToCanvas(files[0]);
    setErr(null);
    if (photos.current.front && photos.current.side) { const e = ready(); if (e) return setErr(e); process(); }
    else setShot(which === 'front' ? 'side' : 'front');
  }

  if (phase === 'result' && result) return (
    <div className="stack" style={{ gap: 16 }}>
      <h2 className="rise-title">Your scan results</h2>
      <div className="mini-stats">
        <div><span className="rise-caption">Body fat (estimate)</span><b>{result.bodyFatPct}%</b></div>
        <div><span className="rise-caption">Lean mass (estimate)</span><b>{result.leanMassLb} lb</b></div>
      </div>
      <dl className="kv">
        <dt>Neck</dt><dd className="rise-num">{result.neckIn} in</dd>
        <dt>Waist</dt><dd className="rise-num">{result.waistIn} in</dd>
        <dt>Hips</dt><dd className="rise-num">{result.hipIn} in</dd>
        <dt>Weight</dt><dd className="rise-num">{result.weightLb} lb</dd>
      </dl>
      {IS_DEMO && <p className="note">Demo: these are example measurements. In the app they come from your two photos.</p>}
      <p className="rise-caption" style={{ margin: 0 }}>Estimated from your body's outline in two photos. It can be a few percent off from a DEXA scan, so we compare it only with your own past Rise scans. Your photos stayed on this phone and have been deleted.</p>
      <button className="rise-btn rise-btn--primary rise-btn--block" onClick={() => onDone(result)}>Use these numbers</button>
      <button className="rise-btn rise-btn--quiet" onClick={() => { setResult(null); setPhase('intro'); }}>Scan again</button>
    </div>
  );

  if (phase === 'working') return <p className="rise-body-lg" aria-live="polite">Measuring your scan… This takes a few seconds.</p>;

  if (phase === 'camera') return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="cam">
        <video ref={videoRef} playsInline muted autoPlay aria-label="Camera preview" />
        <svg className="overlay" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true" style={{ transform: 'none' }}>
          <rect x="70" y="20" width="160" height="360" rx="20" fill="none" stroke="var(--on-brand)" strokeWidth="3" strokeDasharray="10 8" opacity=".8" />
        </svg>
        <span className="cam__badge">{shot === 'front' ? 'Photo 1 of 2: front' : 'Photo 2 of 2: side'}</span>
        {count != null && <div className="cam__count" aria-live="assertive">{count}</div>}
      </div>
      <p className="rise-body-lg">{shot === 'front' ? 'Face the phone with your arms a little away from your sides. Fit your whole body inside the dashed outline.' : 'Turn so your side faces the phone, arms relaxed at your sides.'}</p>
      <button className="rise-btn rise-btn--primary rise-btn--block" disabled={count != null} onClick={() => takeTimed(shot)}>{count != null ? 'Get in position…' : `Take ${shot} photo in ${TIMER_S} seconds`}</button>
      <button className="rise-btn rise-btn--quiet" onClick={() => { stopCamera(); timers.current.forEach(clearTimeout); setCount(null); setPhase('intro'); }}>Cancel</button>
    </div>
  );

  if (phase === 'upload') return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="rise-body-lg">Choose two full-body photos: one facing the camera with arms slightly out, and one from the side.</p>
      <div className="field"><label className="rise-label" htmlFor="up-front">Front photo{photos.current.front ? ' ✓' : ''}</label><input id="up-front" type="file" accept="image/*" onChange={(e) => onFiles('front', e.target.files)} /></div>
      <div className="field"><label className="rise-label" htmlFor="up-side">Side photo{photos.current.side ? ' ✓' : ''}</label><input id="up-side" type="file" accept="image/*" onChange={(e) => onFiles('side', e.target.files)} /></div>
      {err && <p role="alert" className="error-note">{err}</p>}
      <button className="rise-btn rise-btn--quiet" onClick={() => setPhase('intro')}>Back</button>
    </div>
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="rise-body-lg">You'll take two photos, front and side. Rise measures your neck, waist and hips from your outline and estimates your body fat and lean mass.</p>
      <ul className="stack" style={{ margin: 0, paddingLeft: 24 }}>
        <li>Wear fitted clothes, like leggings and a fitted top.</li>
        <li>Stand 6 to 8 feet away, against a plain wall, in good light.</li>
        <li>Prop the phone at waist height. A timer gives you 10 seconds.</li>
      </ul>
      <div className="two-col">
        <div className="field"><label className="rise-label" htmlFor="scan-weight">Today's weight (lb)</label><input id="scan-weight" className="rise-num" inputMode="decimal" value={weightLb} onChange={(e) => { setErr(null); onWeight(e.target.value); }} /></div>
        <div className="field"><label className="rise-label" htmlFor="scan-height">Height (in)</label><input id="scan-height" className="rise-num" inputMode="numeric" value={height} onChange={(e) => { setErr(null); setHeight(e.target.value.replace(/\D/g, '')); }} /></div>
      </div>
      {err && <p role="alert" className="error-note">{err}</p>}
      <button className="rise-btn rise-btn--primary rise-btn--block" onClick={startCamera}>Start the scan</button>
      <button className="rise-btn rise-btn--secondary rise-btn--block" onClick={() => { const e = ready(); if (e) return setErr(e); setErr(null); photos.current = {}; setPhase('upload'); }}>Upload two photos instead</button>
      <button className="rise-btn rise-btn--quiet" onClick={onCancel}>Choose another way</button>
      <p className="rise-caption" style={{ margin: 0 }}>Photos are measured on this phone and never uploaded.</p>
    </div>
  );
}
