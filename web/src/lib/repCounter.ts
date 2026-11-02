export type Point = { x: number; y: number; visibility?: number };
export type Phase = 'unknown' | 'seated' | 'standing';

/** Angle at b (degrees) formed by a-b-c. */
export function angleAt(a: Point, b: Point, c: Point): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (m === 0) return NaN;
  return (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI;
}

// MediaPipe pose landmark indexes.
export const LM = { nose: 0, lShoulder: 11, rShoulder: 12, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28 } as const;

/** Knee angle from whichever leg the camera sees best, or null if neither is visible. */
export function kneeAngle(lm: Point[], minVis = 0.5): { angle: number; hip: Point } | null {
  const sides = [
    [LM.lHip, LM.lKnee, LM.lAnkle],
    [LM.rHip, LM.rKnee, LM.rAnkle],
  ].map(([h, k, a]) => ({ h: lm[h], k: lm[k], a: lm[a] }))
    .filter((s) => s.h && s.k && s.a)
    .map((s) => ({ ...s, vis: Math.min(s.h.visibility ?? 1, s.k.visibility ?? 1, s.a.visibility ?? 1) }))
    .filter((s) => s.vis >= minVis)
    .sort((x, y) => y.vis - x.vis);
  if (!sides.length) return null;
  const s = sides[0];
  const angle = angleAt(s.h, s.k, s.a);
  return Number.isFinite(angle) ? { angle, hip: s.h } : null;
}

/**
 * Counts full sit-to-stand repetitions from knee angles, with hysteresis so jitter
 * near a threshold can't double count. A rep is counted on reaching full standing
 * after having been seated.
 */
export class RepCounter {
  reps = 0;
  phase: Phase = 'unknown';
  private lastRepAt = -Infinity;
  private seen = 0;
  private tracked = 0;

  constructor(private opts = { standAngle: 155, sitAngle: 115, minRepMs: 600 }) {}

  update(angle: number | null, tMs: number): boolean {
    this.seen++;
    if (angle == null || !Number.isFinite(angle)) return false;
    this.tracked++;
    if (angle <= this.opts.sitAngle) {
      this.phase = 'seated';
      return false;
    }
    if (angle >= this.opts.standAngle) {
      const wasSeated = this.phase === 'seated';
      this.phase = 'standing';
      if (wasSeated && tMs - this.lastRepAt >= this.opts.minRepMs) {
        this.reps++;
        this.lastRepAt = tMs;
        return true;
      }
    }
    return false;
  }

  /** Share of frames where the leg was tracked: the capture's confidence. */
  get confidence(): number {
    return this.seen ? this.tracked / this.seen : 0;
  }
}
