import { useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { loadPose } from '../lib/pose';
import { evaluateFrame, type Check } from '../lib/cameraChecks';
import { toGray, laplacianVariance, meanLuminance, cornerMotion } from '../lib/frameStats';
import { RepCounter, kneeAngle, type Point } from '../lib/repCounter';
import { say, stopSpeaking } from '../lib/speech';

export type Capture = { stands: number; confidence: number; durationSec: number };
type Phase = 'starting' | 'error' | 'checking' | 'countdown' | 'recording' | 'rejected';

const DURATION_MS = 30_000;
const READY_HOLD_MS = 1500;
const SW = 160, SH = 120;

function Mark({ status }: { status: Check['status'] }) {
  return (
    <svg className="rise-check__mark" viewBox="0 0 24 24" aria-hidden="true">
      {status === 'ok' ? <circle cx="12" cy="12" r="10" /> : status === 'fix' ? <path d="M12 2 L23 21 L1 21 Z" /> : <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

export function CameraStage({ onDone, onManual }: { onDone: (c: Capture) => void; onManual: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('starting');
  const [phase, setPhaseState] = useState<Phase>('starting');
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [reps, setReps] = useState(0);
  const [left, setLeft] = useState(30);
  const [trail, setTrail] = useState<string>('');
  const [hip, setHip] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState({ w: 300, h: 400 });
  const [attempt, setAttempt] = useState(0);
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const timers: number[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = SW; canvas.height = SH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    let landmarker: PoseLandmarker | null = null;
    let prevGray: Float32Array | null = null;
    let lm: Point[] | null = null;
    let lastPose = 0, lastStats = 0, readySince = 0, endAt = 0, lastFix = '';
    const counter = new RepCounter();
    const pts: { x: number; y: number }[] = [];

    const toBox = (p: Point) => {
      const v = videoRef.current!, el = boxRef.current!;
      const cw = el.clientWidth, ch = el.clientHeight, vw = v.videoWidth || 640, vh = v.videoHeight || 480;
      const s = Math.max(cw / vw, ch / vh);
      return { x: p.x * vw * s + (cw - vw * s) / 2, y: p.y * vh * s + (ch - vh * s) / 2 };
    };

    const startCountdown = () => {
      setPhase('countdown');
      say('Good. Sit in the chair with your arms crossed. Stand all the way up and sit back down, as many times as you can, for 30 seconds.', { force: true });
      [3, 2, 1].forEach((n, i) => timers.push(window.setTimeout(() => { setCount(n); say(String(n), { force: true }); }, 7000 + i * 1000)));
      timers.push(window.setTimeout(() => {
        setCount(null); say('Go.', { force: true });
        endAt = performance.now() + DURATION_MS;
        setPhase('recording');
      }, 10000));
    };

    const finish = () => {
      setPhase('rejected'); // placeholder until decided below
      const confidence = Number(counter.confidence.toFixed(2));
      if (confidence < 0.6) {
        setError("We couldn't see your legs clearly for most of the check. Move the phone back one step, turn on a light, and try again.");
        say("We couldn't see your legs clearly. Let's try again.", { force: true });
        return;
      }
      say(`Done. ${counter.reps} stands.`, { force: true });
      onDone({ stands: counter.reps, confidence, durationSec: 30 });
    };

    const tick = () => {
      if (cancelled) return;
      const v = videoRef.current;
      const now = performance.now();
      if (v && landmarker && v.readyState >= 2) {
        if (now - lastPose >= 66) {
          lastPose = now;
          try { lm = (landmarker.detectForVideo(v, now).landmarks[0] as Point[] | undefined) ?? null; } catch { lm = null; }
        }
        if (phaseRef.current === 'checking' && now - lastStats >= 300) {
          lastStats = now;
          ctx.drawImage(v, 0, 0, SW, SH);
          const gray = toGray(ctx.getImageData(0, 0, SW, SH).data, SW, SH);
          const r = evaluateFrame({ sharpness: laplacianVariance(gray, SW, SH), luminance: meanLuminance(gray), motion: cornerMotion(prevGray, gray, SW, SH), landmarks: lm });
          prevGray = gray;
          setChecks(r.checks);
          if (r.current && r.current.fix !== lastFix) { lastFix = r.current.fix; say(r.current.fix); }
          if (r.ready) { lastFix = ''; if (!readySince) readySince = now; if (now - readySince >= READY_HOLD_MS) startCountdown(); }
          else readySince = 0;
        }
        if (phaseRef.current === 'recording') {
          const k = lm ? kneeAngle(lm) : null;
          if (counter.update(k?.angle ?? null, now)) { setReps(counter.reps); say(String(counter.reps), { force: true }); }
          if (k && boxRef.current) {
            const b = toBox(k.hip);
            pts.push(b); if (pts.length > 240) pts.shift();
            setHip(b);
            if (pts.length % 3 === 0) setTrail(pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
          }
          setLeft(Math.max(0, Math.ceil((endAt - now) / 1000)));
          if (now >= endAt) { finish(); return; }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('insecure'), { name: 'Insecure' });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (cancelled) return;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play().catch(() => undefined);
        landmarker = await loadPose();
        if (cancelled) return;
        if (boxRef.current) setBox({ w: boxRef.current.clientWidth, h: boxRef.current.clientHeight });
        setPhase('checking');
        say('Prop your phone at hip height, two or three steps away, with your side facing it.', { force: true });
        raf = requestAnimationFrame(tick);
      } catch (e) {
        const name = (e as Error).name;
        setError(name === 'NotAllowedError' ? 'Rise needs your camera to count your stands. Allow camera access for this site in your browser settings, then try again.'
          : name === 'Insecure' ? 'Your browser blocked the camera because this page is not on a secure link. Open Rise from its https link.'
          : name === 'NotFoundError' ? "We couldn't find a camera on this device."
          : "We couldn't start the movement tracker. Check your internet connection and try again.");
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      stream?.getTracks().forEach((t) => t.stop());
      stopSpeaking();
    };
  }, [attempt, onDone]);

  const current = checks.find((c) => c.status === 'fix');
  const retry = () => { setError(null); setReps(0); setLeft(30); setTrail(''); setHip(null); setChecks([]); setPhase('starting'); setAttempt((a) => a + 1); };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="cam" ref={boxRef}>
        <video ref={videoRef} playsInline muted autoPlay aria-label="Camera preview" />
        <svg className="overlay" viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
          {trail && <polyline className="path" points={trail} />}
          {hip && <circle className="hip" cx={hip.x} cy={hip.y} r="9" />}
        </svg>
        {phase === 'recording' && <span className="cam__badge">Recording</span>}
        {count != null && <div className="cam__count" aria-live="assertive">{count}</div>}
      </div>

      {phase === 'starting' && <p className="rise-body-lg" aria-live="polite">Starting your camera…</p>}

      {phase === 'checking' && (
        <>
          <h2 className="rise-title">Getting your camera ready</h2>
          <ul className="rise-checks" aria-live="polite">
            {checks.map((c) => (
              <li key={c.id} className={`rise-check rise-check--${c.status}`}>
                <Mark status={c.status} />{c.status === 'fix' ? c.fix : c.label}
                <span className="rise-check__state" style={{ color: c.status === 'ok' ? 'var(--steady)' : c.status === 'fix' ? 'var(--watch)' : undefined }}>{c.status === 'ok' ? 'Done' : c.status === 'fix' ? 'Fix' : 'Next'}</span>
              </li>
            ))}
          </ul>
          <p className="rise-caption" style={{ margin: 0 }}>{current ? 'Recording starts by itself when every check is done.' : 'All set. Get ready…'}</p>
        </>
      )}

      {phase === 'countdown' && <p className="rise-body-lg" aria-live="polite">Sit with your arms crossed. Stand all the way up and sit back down, as many times as you can.</p>}

      {phase === 'recording' && (
        <div className="meter" aria-live="polite">
          <div><div className="rise-label">Stands</div><div className="data-xl">{reps}</div></div>
          <div style={{ textAlign: 'right' }}><div className="rise-label">Time left</div><div className="rise-num" style={{ fontSize: 28, lineHeight: '32px' }}>0:{String(left).padStart(2, '0')}</div></div>
        </div>
      )}

      {(phase === 'error' || phase === 'rejected') && error && (
        <div className="stack">
          <p role="alert" className="error-note">{error}</p>
          <button className="rise-btn rise-btn--primary rise-btn--block" onClick={retry}>Try again</button>
        </div>
      )}
      <button className="rise-btn rise-btn--quiet" onClick={onManual}>Can't use the camera? Enter your count</button>
    </div>
  );
}
