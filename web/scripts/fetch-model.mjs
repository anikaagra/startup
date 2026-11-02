// Optional: download the pose model so the app doesn't fetch it from Google at runtime.
import { mkdirSync, writeFileSync } from 'node:fs';
const url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
mkdirSync('public/models', { recursive: true });
const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
writeFileSync('public/models/pose_landmarker_lite.task', Buffer.from(await res.arrayBuffer()));
console.log('Saved public/models/pose_landmarker_lite.task');
