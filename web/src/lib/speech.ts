let last = '';
let lastAt = 0;
/** Speaks an instruction aloud. Repeats of the same line are held back for a few seconds. */
export function say(text: string, { force = false, repeatAfterMs = 6000 } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const now = Date.now();
  if (!force && text === last && now - lastAt < repeatAfterMs) return;
  last = text; lastAt = now;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
export const stopSpeaking = () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
