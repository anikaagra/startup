import type { State } from '../lib/types';

const META: Record<State, { word: string; cls: string; mark: JSX.Element }> = {
  steady: { word: 'Steady', cls: 'rise-signal--steady', mark: <circle cx="7" cy="7" r="6" /> },
  watch: { word: 'Watch', cls: 'rise-signal--watch', mark: <path d="M7 1 L13 13 L1 13 Z" /> },
  checkin: { word: 'Check in', cls: 'rise-signal--act', mark: <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" /> },
};

export function StatusSignal({ state }: { state: State }) {
  const m = META[state];
  return (
    <span className={`rise-signal ${m.cls}`}>
      <svg viewBox="0 0 14 14" aria-hidden="true">{m.mark}</svg>
      {m.word}
    </span>
  );
}
