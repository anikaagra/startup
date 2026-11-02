import { LM, type Point } from './repCounter';

export type CheckId = 'lens' | 'distance' | 'side' | 'light' | 'steady';
export type CheckStatus = 'ok' | 'fix' | 'wait';
export type Check = { id: CheckId; label: string; fix: string; status: CheckStatus };

export type FrameInput = {
  sharpness: number; // laplacian variance on a 160x120 frame
  luminance: number; // 0-255
  motion: number; // corner change, 0-255
  landmarks: Point[] | null;
};

export const THRESHOLDS = {
  minSharpness: 25,
  minLuminance: 45,
  maxLuminance: 225,
  maxMotion: 10,
  minBodySpan: 0.45, // nose-to-ankle height as share of frame height
  edge: 0.03,
  minVisibility: 0.5,
  maxShoulderRatio: 0.45, // shoulder width / torso length; above this the patient is facing the phone
};

const LABELS: Record<CheckId, string> = {
  lens: 'Lens is clean',
  distance: 'Whole body in view',
  side: 'Side view',
  light: 'Good light',
  steady: 'Phone is steady',
};

const visible = (p: Point | undefined, t = THRESHOLDS) =>
  !!p && (p.visibility ?? 1) >= t.minVisibility && p.x > t.edge && p.x < 1 - t.edge && p.y > t.edge && p.y < 1 - t.edge;

export function distanceFix(lm: Point[] | null, t = THRESHOLDS): string | null {
  if (!lm || !lm.length) return 'Step into view so the camera can see your whole body.';
  const ankle = [lm[LM.lAnkle], lm[LM.rAnkle]].find((p) => visible(p, t));
  const head = visible(lm[LM.nose], t) ? lm[LM.nose] : undefined;
  if (!ankle || !head) return 'Move the phone back one step.';
  if (Math.abs(ankle.y - head.y) < t.minBodySpan) return 'Move the phone one step closer.';
  return null;
}

export function sideFix(lm: Point[] | null, t = THRESHOLDS): string | null {
  if (!lm) return null;
  const ls = lm[LM.lShoulder], rs = lm[LM.rShoulder], lh = lm[LM.lHip], rh = lm[LM.rHip];
  if (!ls || !rs || !lh || !rh) return null;
  const torso = Math.hypot((ls.x + rs.x) / 2 - (lh.x + rh.x) / 2, (ls.y + rs.y) / 2 - (lh.y + rh.y) / 2);
  if (torso === 0) return null;
  return Math.abs(ls.x - rs.x) / torso > t.maxShoulderRatio ? 'Turn your chair so your side faces the phone.' : null;
}

/** Runs the pre-recording checks in order and marks only the first failing one as the fix to show. */
export function evaluateFrame(f: FrameInput, t = THRESHOLDS): { checks: Check[]; ready: boolean; current: Check | null } {
  const fixes: Record<CheckId, string | null> = {
    lens: f.sharpness < t.minSharpness ? 'Wipe your camera lens with a soft cloth.' : null,
    distance: distanceFix(f.landmarks, t),
    side: null,
    light: f.luminance < t.minLuminance ? 'Turn on a light so the camera can see you.'
      : f.luminance > t.maxLuminance ? 'Move away from bright windows behind you.' : null,
    steady: f.motion > t.maxMotion ? 'Prop your phone against something steady.' : null,
  };
  fixes.side = fixes.distance ? 'Turn your chair so your side faces the phone.' : sideFix(f.landmarks, t);
  let shown = false;
  const checks: Check[] = (Object.keys(LABELS) as CheckId[]).map((id) => {
    const fix = fixes[id];
    let status: CheckStatus = 'ok';
    if (fix) { status = shown ? 'wait' : 'fix'; shown = true; }
    return { id, label: LABELS[id], fix: fix ?? '', status };
  });
  const current = checks.find((c) => c.status === 'fix') ?? null;
  return { checks, ready: !current, current };
}
