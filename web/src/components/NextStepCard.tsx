import type { State } from '../lib/types';
import { StatusSignal } from './StatusSignal';
import { fmtDate } from '../lib/format';

export function NextStepCard({ state, action, reason, retestDate, children }: { state: State; action: string; reason: string; retestDate: string; children?: React.ReactNode }) {
  return (
    <article className="rise-card rise-step" aria-labelledby="next-step-title">
      <div className="rise-step__head">
        <h2 className="rise-title" id="next-step-title">Your next step</h2>
        <StatusSignal state={state} />
      </div>
      <p className="rise-body-lg">{action}</p>
      <p className="rise-caption" style={{ margin: 0 }}>{reason}</p>
      <div className="rise-step__date">
        <span className="rise-label">Check again</span>
        <span className="rise-num" style={{ marginLeft: 'auto' }}>{fmtDate(retestDate, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
      </div>
      {children}
    </article>
  );
}
