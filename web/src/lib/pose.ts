import type { PoseLandmarker } from '@mediapipe/tasks-vision';

const LOCAL_MODEL = '/models/pose_landmarker_lite.task';
const REMOTE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
let loading: Promise<PoseLandmarker> | null = null;

/** Loads the on-device pose model once. Video never leaves the phone. */
export function loadPose(): Promise<PoseLandmarker> {
  if (!loading) {
    loading = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      const attempts: [string, 'GPU' | 'CPU'][] = [[LOCAL_MODEL, 'GPU'], [REMOTE_MODEL, 'GPU'], [REMOTE_MODEL, 'CPU']];
      let lastErr: unknown;
      for (const [modelAssetPath, delegate] of attempts) {
        try {
          return await PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath, delegate }, runningMode: 'VIDEO', numPoses: 1 });
        } catch (e) { lastErr = e; }
      }
      loading = null;
      throw lastErr;
    })();
  }
  return loading;
}
