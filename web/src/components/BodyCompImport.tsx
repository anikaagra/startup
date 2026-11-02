import { useState } from 'react';
import { parseBodyCompExport, type ImportedScan } from '../lib/bodyScan/importParser';

/** Import an export file (CSV or JSON) from a scale, clinic analyzer or DEXA service. */
export function BodyCompImport({ onDone, onCancel }: { onDone: (s: ImportedScan) => void; onCancel: () => void }) {
  const [unit, setUnit] = useState<'kg' | 'lb'>('lb');
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [name, setName] = useState<string>('');

  function read(t: string, u = unit) {
    try {
      const r = parseBodyCompExport(t, u);
      if (r.weightLb == null && r.leanMassLb == null && r.bodyFatPct == null) { setErr("We couldn't find body composition numbers in that file. Try a CSV export, or type the numbers in."); return; }
      onDone(r);
    } catch { setErr("We couldn't read that file. Export it as CSV or JSON and try again."); }
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="rise-body-lg">Import the export file from your scale app, InBody, or DEXA service. We'll pull out your latest weight, lean mass and body fat, and you can check them before saving.</p>
      <div className="field">
        <label className="rise-label" htmlFor="import-file">CSV or JSON file</label>
        <input id="import-file" type="file" accept=".csv,.json,.txt,text/csv,application/json" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          setErr(null); setName(f.name);
          const t = await f.text(); setText(t);
        }} />
      </div>
      <div className="field">
        <label className="rise-label" htmlFor="import-unit">If a column doesn't say, numbers are in</label>
        <select id="import-unit" value={unit} onChange={(e) => setUnit(e.target.value as 'kg' | 'lb')}><option value="lb">pounds (lb)</option><option value="kg">kilograms (kg)</option></select>
      </div>
      <p className="rise-caption" style={{ margin: 0 }}>Works with exports from most smart scales (Withings, Renpho, Eufy and others), InBody, and DEXA services. Most apps have an "Export data" option in settings.</p>
      {err && <p role="alert" className="error-note">{err}</p>}
      <button className="rise-btn rise-btn--primary rise-btn--block" disabled={!text} onClick={() => text && read(text)}>{name ? `Read ${name}` : 'Choose a file first'}</button>
      <button className="rise-btn rise-btn--quiet" onClick={onCancel}>Choose another way</button>
    </div>
  );
}
