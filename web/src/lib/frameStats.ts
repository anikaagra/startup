/** Grayscale from RGBA pixels (Rec. 601 luma). */
export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  return g;
}

export function meanLuminance(gray: Float32Array): number {
  let s = 0;
  for (let i = 0; i < gray.length; i++) s += gray[i];
  return gray.length ? s / gray.length : 0;
}

/**
 * Variance of the Laplacian: a standard sharpness score. A smudged or fogged lens
 * spreads light and blurs edges, so the score drops.
 */
export function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += v; sumSq += v * v; n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * Mean absolute change in the two top corners between frames. The patient moves in
 * the middle of the frame; the top corners are background, so change there means the
 * phone itself moved.
 */
export function cornerMotion(prev: Float32Array | null, gray: Float32Array, w: number, h: number): number {
  if (!prev || prev.length !== gray.length) return 0;
  const cw = Math.max(1, Math.floor(w * 0.18)), ch = Math.max(1, Math.floor(h * 0.18));
  let s = 0, n = 0;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      for (const xx of [x, w - 1 - x]) { const i = y * w + xx; s += Math.abs(gray[i] - prev[i]); n++; }
    }
  }
  return n ? s / n : 0;
}
