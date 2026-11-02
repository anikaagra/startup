import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { View } from './geometry';

const LOCAL_MODEL = '/models/pose_landmarker_lite.task';
const REMOTE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
let loading: Promise<PoseLandmarker> | null = null;

/** Pose model in still-image mode with a person segmentation mask. Runs on the device; photos are never uploaded. */
function loadImagePose(): Promise<PoseLandmarker> {
  if (!loading) {
    loading = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      let lastErr: unknown;
      for (const [modelAssetPath, delegate] of [[LOCAL_MODEL, 'GPU'], [REMOTE_MODEL, 'GPU'], [REMOTE_MODEL, 'CPU']] as const) {
        try {
          return await PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath, delegate }, runningMode: 'IMAGE', numPoses: 1, outputSegmentationMasks: true });
        } catch (e) { lastErr = e; }
      }
      loading = null;
      throw lastErr;
    })();
  }
  return loading;
}

/** Landmarks and a person mask for one photo. */
export async function analyzePhoto(img: HTMLCanvasElement | HTMLImageElement | ImageBitmap): Promise<View | null> {
  const pose = await loadImagePose();
  const res = pose.detect(img);
  const lm = res.landmarks[0];
  const m = res.segmentationMasks?.[0];
  if (!lm || !m) { res.segmentationMasks?.forEach((x) => x.close()); return null; }
  const view: View = { landmarks: lm.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility })), mask: { data: m.getAsFloat32Array().slice(), width: m.width, height: m.height } };
  res.segmentationMasks?.forEach((x) => x.close());
  return view;
}

/** Load a chosen photo file into a canvas, scaled down so analysis stays fast. */
export async function fileToCanvas(file: File, maxSide = 960): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}
