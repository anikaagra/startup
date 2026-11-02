// Body measurements from a front photo and a side photo.
//
// Method (all published and open): a person segmentation mask and pose landmarks from MediaPipe give the body's
// outline. Known height sets the scale. Width (front) and depth (side) at the neck, waist and hips are treated as
// the two axes of an ellipse to estimate each circumference (Ramanujan's approximation). Body fat is then
// estimated with the U.S. Navy circumference equations (Hodgdon & Beckett, 1984). This is an estimate: expect
// a few percentage points of error against DEXA, so Rise only compares a patient's scans with their own earlier
// scans from the same method.

export type Mask = { data: ArrayLike<number>; width: number; height: number };
export type Landmark = { x: number; y: number; visibility?: number };
export type View = { mask: Mask; landmarks: Landmark[] };
export type Sex = 'female' | 'male' | 'other';

const THRESH = 0.5;
const LM = { nose: 0, lShoulder: 11, rShoulder: 12, lWrist: 15, rWrist: 16, lHip: 23, rHip: 24, lAnkle: 27, rAnkle: 28 };
const at = (m: Mask, x: number, y: number) => m.data[y * m.width + x] >= THRESH;

/** Width in pixels of the solid run of body pixels on row y that contains x0 (so separated arms are excluded). */
export function runWidth(m: Mask, y: number, x0: number): number {
  const row = Math.round(y), cx = Math.round(x0);
  if (row < 0 || row >= m.height || cx < 0 || cx >= m.width || !at(m, cx, row)) return 0;
  let l = cx, r = cx;
  while (l > 0 && at(m, l - 1, row)) l--;
  while (r < m.width - 1 && at(m, r + 1, row)) r++;
  return r - l + 1;
}

/** First and last rows that contain body pixels. */
export function verticalExtent(m: Mask): { top: number; bottom: number } | null {
  let top = -1, bottom = -1;
  for (let y = 0; y < m.height; y++) {
    let any = false;
    for (let x = 0; x < m.width; x++) if (at(m, x, y)) { any = true; break; }
    if (any) { if (top < 0) top = y; bottom = y; }
  }
  return top < 0 ? null : { top, bottom };
}

/** Perimeter of an ellipse with semi-axes a and b (Ramanujan). */
export function ellipseCircumference(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/** U.S. Navy body fat equations (inches). Women use the hip; "other" uses the women's equation. */
export function navyBodyFat(sex: Sex, heightIn: number, neckIn: number, waistIn: number, hipIn: number): number | null {
  const v = sex === 'male'
    ? 86.010 * Math.log10(waistIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76
    : 163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;
  return Number.isFinite(v) ? Math.max(3, Math.min(70, v)) : null;
}

type Levels = { neck: number; waist: number; hip: number; cx: number; pxPerIn: number };

function levels(v: View, heightIn: number, sex: Sex): { lv: Levels | null; issue: string | null } {
  const { mask: m, landmarks: lm } = v;
  const need = [LM.nose, LM.lShoulder, LM.rShoulder, LM.lHip, LM.rHip];
  if (!lm || need.some((i) => !lm[i] || (lm[i].visibility ?? 1) < 0.4)) return { lv: null, issue: "We couldn't find your head, shoulders and hips. Stand so your whole body is in the photo." };
  const ext = verticalExtent(m);
  if (!ext) return { lv: null, issue: "We couldn't find you in the photo. Try a plain background and brighter light." };
  if (ext.top <= 1 || ext.bottom >= m.height - 2) return { lv: null, issue: 'Your head or feet are cut off. Move the phone back a step.' };
  const px = (p: Landmark) => ({ x: p.x * m.width, y: p.y * m.height });
  const nose = px(lm[LM.nose]);
  const sh = { x: (px(lm[LM.lShoulder]).x + px(lm[LM.rShoulder]).x) / 2, y: (px(lm[LM.lShoulder]).y + px(lm[LM.rShoulder]).y) / 2 };
  const hp = { x: (px(lm[LM.lHip]).x + px(lm[LM.rHip]).x) / 2, y: (px(lm[LM.lHip]).y + px(lm[LM.rHip]).y) / 2 };
  const torso = hp.y - sh.y;
  if (torso <= 0) return { lv: null, issue: 'Stand up straight facing the camera.' };
  const bodyPx = ext.bottom - ext.top;
  if (bodyPx < m.height * 0.5) return { lv: null, issue: 'You look small in the photo. Move the phone a step closer.' };
  const cx = hp.x;
  // Waist: women at the narrowest point between hips and ribs; men at about navel height.
  let waist = hp.y - 0.3 * torso;
  if (sex !== 'male') {
    let best = Infinity;
    for (let y = hp.y - 0.5 * torso; y <= hp.y - 0.15 * torso; y++) { const w = runWidth(m, y, cx); if (w > 0 && w < best) { best = w; waist = y; } }
  }
  let hip = hp.y, widest = 0;
  for (let y = hp.y - 0.05 * torso; y <= hp.y + 0.25 * torso; y++) { const w = runWidth(m, y, cx); if (w > widest) { widest = w; hip = y; } }
  return { lv: { neck: sh.y - 0.3 * (sh.y - nose.y), waist, hip, cx, pxPerIn: bodyPx / heightIn }, issue: null };
}

export type ScanMeasurements = { neckIn: number; waistIn: number; hipIn: number; bodyFatPct: number };

/**
 * Turn a front and a side view into neck, waist and hip circumferences and an estimated body fat %.
 * Side-view levels are matched by their position relative to that photo's own shoulders and hips.
 */
export function measureScan(front: View, side: View, heightIn: number, sex: Sex): { result: ScanMeasurements | null; issue: string | null } {
  const f = levels(front, heightIn, sex);
  if (!f.lv) return { result: null, issue: `Front photo: ${f.issue}` };
  const s = levels(side, heightIn, sex);
  if (!s.lv) return { result: null, issue: `Side photo: ${s.issue}` };
  // Arms must be away from the body in the front photo, or they are counted as waist.
  const lm = front.landmarks;
  const wristGap = Math.min(Math.abs(lm[LM.lWrist]?.x - lm[LM.lHip]?.x), Math.abs(lm[LM.rWrist]?.x - lm[LM.rHip]?.x));
  if (Number.isFinite(wristGap) && wristGap * front.mask.width < 0.04 * front.mask.height) {
    return { result: null, issue: 'Front photo: hold your arms a little away from your sides, like an upside-down V.' };
  }
  const circ = (wf: number, ds: number) => ellipseCircumference(wf / 2, ds / 2);
  const inches = (key: 'neck' | 'waist' | 'hip') => {
    const w = runWidth(front.mask, f.lv![key], f.lv!.cx) / f.lv!.pxPerIn;
    const d = runWidth(side.mask, s.lv![key], s.lv!.cx) / s.lv!.pxPerIn;
    return w > 0 && d > 0 ? circ(w, d) : 0;
  };
  const neckIn = inches('neck'), waistIn = inches('waist'), hipIn = inches('hip');
  if (neckIn < 9 || neckIn > 26) return { result: null, issue: 'We couldn\'t measure your neck. Pull your hair back and keep your chin level.' };
  if (waistIn < 18 || waistIn > 80 || hipIn < 24 || hipIn > 85) return { result: null, issue: 'Some measurements look off. Wear fitted clothing and stand against a plain background.' };
  const bodyFatPct = navyBodyFat(sex, heightIn, neckIn, waistIn, hipIn);
  if (bodyFatPct == null) return { result: null, issue: 'Some measurements look off. Try the photos again.' };
  const r = (n: number) => Math.round(n * 10) / 10;
  return { result: { neckIn: r(neckIn), waistIn: r(waistIn), hipIn: r(hipIn), bodyFatPct: r(bodyFatPct) }, issue: null };
}
