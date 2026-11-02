import { describe, it, expect } from 'vitest';
import { navyBodyFat, ellipseCircumference, runWidth, measureScan, type Mask, type Landmark } from '../bodyScan/geometry';
import { parseBodyCompExport, parseCsv } from '../bodyScan/importParser';

describe('navyBodyFat', () => {
  it('matches the published men\'s equation', () => {
    // 86.010*log10(36-15) - 70.041*log10(70) + 36.76 = 21.25
    expect(navyBodyFat('male', 70, 15, 36, 0)).toBeCloseTo(21.25, 1);
  });
  it('matches the published women\'s equation', () => {
    // 163.205*log10(32+40-13) - 97.684*log10(64) - 78.387 = 34.0
    expect(navyBodyFat('female', 64, 13, 32, 40)).toBeCloseTo(34.0, 0);
  });
});

describe('ellipseCircumference', () => {
  it('is 2πr for a circle', () => expect(ellipseCircumference(5, 5)).toBeCloseTo(2 * Math.PI * 5, 6));
});

// A synthetic person: a 200-row-tall body in a 300x260 image, with known widths per band.
function person(widths: { neck: number; waist: number; hip: number; other: number }, armGap = true): { mask: Mask; landmarks: Landmark[] } {
  const W = 300, H = 260, top = 20, bottom = 220, cx = 150;
  const data = new Float32Array(W * H);
  const torsoTop = 80, hipY = 160; // shoulders at 80, hips at 160
  for (let y = top; y <= bottom; y++) {
    let w = widths.other;
    if (y >= 66 && y <= 74) w = widths.neck; // neck band just above shoulders
    else if (y >= 114 && y <= 150) w = widths.waist;
    else if (y >= 152 && y <= 175) w = widths.hip;
    for (let x = Math.round(cx - w / 2); x < Math.round(cx + w / 2); x++) data[y * W + x] = 1;
  }
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  lm[0] = { x: cx / W, y: 40 / H, visibility: 0.9 };
  lm[11] = { x: (cx - 20) / W, y: torsoTop / H, visibility: 0.9 }; lm[12] = { x: (cx + 20) / W, y: torsoTop / H, visibility: 0.9 };
  lm[23] = { x: (cx - 10) / W, y: hipY / H, visibility: 0.9 }; lm[24] = { x: (cx + 10) / W, y: hipY / H, visibility: 0.9 };
  const gap = armGap ? 30 : 2;
  lm[15] = { x: (cx - 10 - gap) / W, y: hipY / H }; lm[16] = { x: (cx + 10 + gap) / W, y: hipY / H };
  return { mask: { data, width: W, height: H }, landmarks: lm };
}

describe('measureScan', () => {
  it('measures widths from the mask', () => {
    const p = person({ neck: 20, waist: 50, hip: 60, other: 40 });
    expect(runWidth(p.mask, 120, 150)).toBe(50);
    expect(runWidth(p.mask, 10, 150)).toBe(0);
  });
  it('turns front and side views into circumferences and body fat', () => {
    // Body is 200 px tall for a 64 in person: 3.125 px per inch.
    const front = person({ neck: 15, waist: 40, hip: 50, other: 36 });
    const side = person({ neck: 15, waist: 28, hip: 34, other: 26 });
    const { result, issue } = measureScan(front, side, 64, 'female');
    expect(issue).toBeNull();
    const ppi = 200 / 64;
    expect(result!.waistIn).toBeCloseTo(ellipseCircumference(40 / ppi / 2, 28 / ppi / 2), 0);
    expect(result!.hipIn).toBeCloseTo(ellipseCircumference(50 / ppi / 2, 34 / ppi / 2), 0);
    expect(result!.bodyFatPct).toBeGreaterThan(10);
    expect(result!.bodyFatPct).toBeLessThan(60);
  });
  it('asks to move arms away from the body', () => {
    const r = measureScan(person({ neck: 15, waist: 40, hip: 50, other: 36 }, false), person({ neck: 15, waist: 28, hip: 34, other: 26 }), 64, 'female');
    expect(r.issue).toMatch(/arms/);
  });
  it('asks to step back when feet are cut off', () => {
    const p = person({ neck: 15, waist: 40, hip: 50, other: 36 });
    const d = p.mask.data as Float32Array;
    for (let x = 140; x < 160; x++) d[259 * 300 + x] = 1;
    expect(measureScan(p, p, 64, 'female').issue).toMatch(/cut off/);
  });
});

describe('parseBodyCompExport', () => {
  it('reads an InBody-style CSV in kg and picks the newest row', () => {
    const csv = 'Date,Weight(kg),Body Fat Mass(kg),SMM(kg),PBF(%),Fat Free Mass(kg)\n2026-09-01,90,38,28,42.2,52\n2026-10-01,86,35.5,27.5,41.3,50.5\n';
    const r = parseBodyCompExport(csv);
    expect(r.sourceName).toBe('InBody');
    expect(r.sourceGuess).toBe('clinic-bia');
    expect(r.weightLb).toBeCloseTo(189.6, 1);
    expect(r.leanMassLb).toBeCloseTo(111.3, 1);
    expect(r.bodyFatPct).toBe(41.3);
    expect(r.date).toBe('2026-10-01');
  });
  it('derives lean mass from weight and fat % when lean is missing', () => {
    const r = parseBodyCompExport('Date;Weight (lb);Body Fat (%)\n2026-10-01;200;40\n');
    expect(r.leanMassLb).toBe(120);
  });
  it('reads JSON and a fraction body fat', () => {
    const r = parseBodyCompExport(JSON.stringify({ data: [{ date: '2026-10-02', weight_kg: 80, body_fat_percentage: 0.3 }] }));
    expect(r.weightLb).toBeCloseTo(176.4, 1);
    expect(r.bodyFatPct).toBe(30);
    expect(r.leanMassLb).toBeCloseTo(123.5, 1);
  });
  it('warns when weight is missing', () => {
    expect(parseBodyCompExport('Date,Notes\n2026-10-01,hello\n').warnings.join(' ')).toMatch(/couldn't find weight/);
  });
  it('handles quoted CSV fields', () => {
    expect(parseCsv('a,b\n"1,5",2')[1]).toEqual(['1,5', '2']);
  });
});
