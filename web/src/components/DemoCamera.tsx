import { useEffect, useState } from 'react';
import type { Check } from '../lib/cameraChecks';
import type { Capture } from './CameraStage';

// Demo build only: plays the camera checks the real app runs on live video, then lets the
// viewer choose a count, since the demo frame can't open a camera.
const SCRIPT: { fixAt: Check['id'] | null; fix: string }[] = [
  { fixAt: 'lens', fix: 'Wipe your camera lens with a soft cloth.' },
  { fixAt: 'distance', fix: 'Move the phone back one step.' },
  { fixAt: 'distance', fix: 'Move the phone one step closer.' },
  { fixAt: 'side', fix: 'Turn your chair so your side faces the phone.' },
  { fixAt: null, fix: '' },
];
const LABELS: [Check['id'], string][] = [['lens', 'Lens is clean'], ['distance', 'Whole body in view'], ['side', 'Side view'], ['light', 'Good light'], ['steady', 'Phone is steady']];

export function DemoCamera({ onDone }: { onDone: (c: Capture) => void }) {
  const [i, setI] = useState(0);
  const [n, setN] = useState('12');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (i < SCRIPT.length - 1) { const t = setTimeout(() => setI(i + 1), 1800); return () => clearTimeout(t); } }, [i]);
  const step = SCRIPT[i];
  const failIdx = step.fixAt ? LABELS.findIndex(([id]) => id === step.fixAt) : LABELS.length;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="cam" style={{ display: 'grid', placeItems: 'center', background: 'var(--tint)' }}>
        <svg viewBox="0 0 240 320" width="70%" aria-hidden="true">
          <rect x="40" y="200" width="70" height="10" rx="3" fill="var(--brand)" /><rect x="44" y="210" width="8" height="70" rx="3" fill="var(--brand)" />
          <rect x="98" y="210" width="8" height="70" rx="3" fill="var(--brand)" /><rect x="40" y="120" width="8" height="90" rx="3" fill="var(--brand)" />
          <rect x="20" y="280" width="200" height="16" rx="6" fill="var(--paper-raised)" />
          <path d="M86 196 C 110 150, 130 130, 150 110" fill="none" stroke="var(--trace)" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 10" />
          <circle cx="86" cy="196" r="6" fill="var(--trace)" /><circle cx="150" cy="110" r="8" fill="var(--trace)" />
        </svg>
        <span className="cam__badge">Demo camera</span>
      </div>
      <h2 className="rise-title">Getting your camera ready</h2>
      <ul className="rise-checks" aria-live="polite">
        {LABELS.map(([id, label], k) => {
          const status = k < failIdx ? 'ok' : k === failIdx ? 'fix' : 'wait';
          return (
            <li key={id} className={`rise-check rise-check--${status}`}>
              <svg className="rise-check__mark" viewBox="0 0 24 24" aria-hidden="true">{status === 'ok' ? <circle cx="12" cy="12" r="10" /> : status === 'fix' ? <path d="M12 2 L23 21 L1 21 Z" /> : <circle cx="12" cy="12" r="9" />}</svg>
              {status === 'fix' ? step.fix : label}
              <span className="rise-check__state" style={{ color: status === 'ok' ? 'var(--steady)' : status === 'fix' ? 'var(--watch)' : undefined }}>{status === 'ok' ? 'Done' : status === 'fix' ? 'Fix' : 'Next'}</span>
            </li>
          );
        })}
      </ul>
      {step.fixAt ? (
        <p className="rise-caption" style={{ margin: 0 }}>In the real app these checks run on your live camera and are read aloud.</p>
      ) : (
        <div className="stack">
          <p className="note">All set. In the real app, recording starts now and Rise counts your stands for 30 seconds. Choose a count to see the result.</p>
          <div className="field"><label className="rise-label" htmlFor="demo-count">Stands to simulate</label>
            <input id="demo-count" className="rise-num" inputMode="numeric" value={n} onChange={(e) => { setErr(null); setN(e.target.value.replace(/\D/g, '')); }} /></div>
          {err && <p role="alert" className="error-note">{err}</p>}
          <button className="rise-btn rise-btn--primary rise-btn--block" onClick={() => {
            const v = Number(n);
            if (!Number.isInteger(v) || v > 40 || n === '') return setErr('Enter a whole number from 0 to 40.');
            onDone({ stands: v, confidence: 0.9, durationSec: 30 });
          }}>See my result</button>
        </div>
      )}
    </div>
  );
}
