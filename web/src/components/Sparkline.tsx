export function Sparkline({ values, cutoff }: { values: number[]; cutoff: number | null }) {
  if (!values.length) return <span className="rise-row__meta">No checks yet</span>;
  const W = 120, H = 32;
  const lo = Math.min(...values, cutoff ?? Infinity) - 2, hi = Math.max(...values, (cutoff ?? 0) + 3) + 2;
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo)) * (H - 8);
  const x = (i: number) => (values.length === 1 ? W / 2 : 6 + (i * (W - 12)) / (values.length - 1));
  return (
    <svg className="rise-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Stands ${values.join(', ')}`}>
      {cutoff != null && <rect className="band" x="0" y="0" width={W} height={Math.max(0, y(cutoff))} />}
      {values.length > 1 && <polyline className="line" points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />}
      <circle className="dot" cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" />
    </svg>
  );
}
