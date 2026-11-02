import { fmtDate } from '../lib/format';

type Pt = { date: string; stands: number };

/** The patient's stands over time, with the typical range for their age and sex shaded. */
export function RiseTrace({ points, cutoff, bandLabel, wide = false }: { points: Pt[]; cutoff: number; bandLabel: string; wide?: boolean }) {
  const W = wide ? 760 : 460, H = wide ? 240 : 220, L = 40, R = W - 20, T = 20, B = H - 34;
  const vals = points.map((p) => p.stands);
  const lo = Math.max(0, Math.min(cutoff, ...vals) - 3);
  const hi = Math.max(cutoff + 4, ...vals) + 2;
  const y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T);
  const x = (i: number) => (points.length === 1 ? (L + R) / 2 : L + 40 + (i * (R - L - 80)) / (points.length - 1));
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const last = points[points.length - 1];
  const summary = points.map((p) => `${p.stands} on ${fmtDate(p.date)}`).join(', ');
  return (
    <svg className="rise-trace" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Stands in 30 seconds: ${summary}. ${bandLabel}.`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect className="band" x={L} y={T} width={R - L} height={y(cutoff) - T} />
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={L} y1={y(t)} x2={R} y2={y(t)} />
          <text className="axis" x={L - 8} y={y(t) + 5} textAnchor="end">{t}</text>
        </g>
      ))}
      {points.length > 1 && <polyline className="line" points={points.map((p, i) => `${x(i)},${y(p.stands)}`).join(' ')} />}
      {points.map((p, i) => (
        <g key={p.date + i}>
          <circle className={`pt${i === points.length - 1 ? ' pt--last' : ''}`} cx={x(i)} cy={y(p.stands)} r={i === points.length - 1 ? 7 : 6} />
          <text className="axis" x={x(i)} y={H - 6} textAnchor="middle">{fmtDate(p.date)}</text>
        </g>
      ))}
      {last && <text className="val" x={x(points.length - 1)} y={y(last.stands) - 14} textAnchor="middle">{last.stands}</text>}
    </svg>
  );
}
