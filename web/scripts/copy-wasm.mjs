// Copies MediaPipe's WebAssembly files into public/ so pose tracking loads from our own origin.
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('public/mediapipe', { recursive: true });
cpSync('node_modules/@mediapipe/tasks-vision/wasm', 'public/mediapipe/wasm', { recursive: true });
console.log('Copied MediaPipe wasm to public/mediapipe/wasm');
