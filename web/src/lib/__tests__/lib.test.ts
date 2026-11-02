import { describe, it, expect } from 'vitest';
import { RepCounter, angleAt, kneeAngle } from '../repCounter';
import { evaluateFrame } from '../cameraChecks';
import { laplacianVariance, meanLuminance, cornerMotion } from '../frameStats';

const P = (x: number, y: number, visibility = 0.9) => ({ x, y, visibility });

describe('angleAt', () => {
  it('measures a straight leg as 180 and a right angle as 90', () => {
    expect(angleAt(P(0, 0), P(0, 1), P(0, 2))).toBeCloseTo(180);
    expect(angleAt(P(0, 0), P(0, 1), P(1, 1))).toBeCloseTo(90);
  });
});

describe('RepCounter', () => {
  it('counts one rep per full sit-to-stand', () => {
    const c = new RepCounter();
    const seq = [90, 100, 140, 170, 175, 130, 95, 90, 150, 172, 100, 168];
    seq.forEach((a, i) => c.update(a, i * 400));
    expect(c.reps).toBe(3);
  });
  it('does not count a half stand or jitter near the threshold', () => {
    const c = new RepCounter();
    [95, 140, 150, 140, 152, 100].forEach((a, i) => c.update(a, i * 400));
    expect(c.reps).toBe(0);
  });
  it('does not count starting while already standing', () => {
    const c = new RepCounter();
    [175, 170, 176].forEach((a, i) => c.update(a, i * 400));
    expect(c.reps).toBe(0);
  });
  it('reports tracking confidence', () => {
    const c = new RepCounter();
    c.update(90, 0); c.update(null, 100); c.update(170, 900); c.update(null, 1000);
    expect(c.confidence).toBe(0.5);
    expect(c.reps).toBe(1);
  });
  it('picks the more visible leg', () => {
    const lm: { x: number; y: number; visibility: number }[] = Array.from({ length: 33 }, () => P(0.5, 0.5, 0.1));
    lm[23] = P(0.5, 0.4); lm[25] = P(0.5, 0.6); lm[27] = P(0.5, 0.8);
    expect(kneeAngle(lm)?.angle).toBeCloseTo(180);
  });
});

const body = (span = 0.7, shoulderWidth = 0.05) => {
  const lm = Array.from({ length: 33 }, () => P(0.5, 0.5));
  lm[0] = P(0.5, 0.15); lm[11] = P(0.5 - shoulderWidth / 2, 0.25); lm[12] = P(0.5 + shoulderWidth / 2, 0.25);
  lm[23] = P(0.5, 0.5); lm[24] = P(0.5, 0.5); lm[27] = P(0.5, 0.15 + span); lm[28] = P(0.5, 0.15 + span);
  return lm;
};
const good = { sharpness: 120, luminance: 120, motion: 1, landmarks: body() };

describe('evaluateFrame', () => {
  it('is ready when everything passes', () => {
    expect(evaluateFrame(good).ready).toBe(true);
  });
  it('asks to wipe the lens first when the image is blurry', () => {
    const r = evaluateFrame({ ...good, sharpness: 5 });
    expect(r.current?.id).toBe('lens');
    expect(r.current?.fix).toMatch(/Wipe your camera lens/);
  });
  it('asks to move back when the feet are cut off', () => {
    const lm = body(); lm[27] = P(0.5, 0.99); lm[28] = P(0.5, 0.99);
    expect(evaluateFrame({ ...good, landmarks: lm }).current?.fix).toBe('Move the phone back one step.');
  });
  it('asks to move closer when the body is small', () => {
    expect(evaluateFrame({ ...good, landmarks: body(0.3) }).current?.fix).toBe('Move the phone one step closer.');
  });
  it('asks for a side view when facing the camera', () => {
    expect(evaluateFrame({ ...good, landmarks: body(0.7, 0.2) }).current?.id).toBe('side');
  });
  it('shows only one fix at a time', () => {
    const r = evaluateFrame({ sharpness: 5, luminance: 10, motion: 40, landmarks: null });
    expect(r.checks.filter((c) => c.status === 'fix')).toHaveLength(1);
    expect(r.checks.filter((c) => c.status === 'wait').length).toBeGreaterThan(1);
  });
  it('flags dark rooms and a moving phone', () => {
    expect(evaluateFrame({ ...good, luminance: 20 }).current?.id).toBe('light');
    expect(evaluateFrame({ ...good, motion: 30 }).current?.id).toBe('steady');
  });
});

describe('frame stats', () => {
  it('scores a sharp checkerboard far above a flat image', () => {
    const w = 20, h = 20;
    const flat = new Float32Array(w * h).fill(128);
    const checker = Float32Array.from({ length: w * h }, (_, i) => (((i % w) + Math.floor(i / w)) % 2 ? 255 : 0));
    expect(laplacianVariance(checker, w, h)).toBeGreaterThan(1000);
    expect(laplacianVariance(flat, w, h)).toBe(0);
    expect(meanLuminance(flat)).toBe(128);
  });
  it('detects corner motion', () => {
    const w = 20, h = 20;
    const a = new Float32Array(w * h).fill(100);
    const b = new Float32Array(w * h).fill(140);
    expect(cornerMotion(a, b, w, h)).toBe(40);
    expect(cornerMotion(null, b, w, h)).toBe(0);
  });
});
