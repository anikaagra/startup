// Reads body composition exports (CSV or JSON) from scales, clinic analyzers and DEXA services.
// It finds weight, lean (fat-free) mass, body fat % and appendicular lean mass by column name, and uses the most recent row.

export type ImportedScan = {
  date: string | null; weightLb: number | null; leanMassLb: number | null; bodyFatPct: number | null; asmKg: number | null;
  sourceGuess: 'smart-scale' | 'clinic-bia' | 'dexa' | 'scan-app' | 'other'; sourceName: string | null; rows: number; warnings: string[];
};

const KG_TO_LB = 2.20462;

export function parseCsv(text: string): string[][] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : lines[0].includes('\t') ? '\t' : ',';
  return lines.map((line) => {
    const out: string[] = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === delim) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}

type Col = { idx: number; unit: 'kg' | 'lb' | null };
const unitOf = (h: string): 'kg' | 'lb' | null => (/(^|[^a-z])kgs?([^a-z]|$)/i.test(h) ? 'kg' : /(^|[^a-z])lbs?([^a-z]|$)|pound/i.test(h) ? 'lb' : null);

function find(headers: string[], include: RegExp, exclude?: RegExp): Col | null {
  const idx = headers.findIndex((h) => include.test(h) && !(exclude && exclude.test(h)));
  return idx < 0 ? null : { idx, unit: unitOf(headers[idx]) };
}

const toNum = (v: unknown) => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
};

function guessSource(text: string): { guess: ImportedScan['sourceGuess']; name: string | null } {
  if (/inbody|\bpbf\b|\bsmm\b|lookinbody/i.test(text)) return { guess: 'clinic-bia', name: 'InBody' };
  if (/bodyspec|dxa|dexa|lean tissue|hologic|lunar/i.test(text)) return { guess: 'dexa', name: 'DEXA report' };
  if (/withings/i.test(text)) return { guess: 'smart-scale', name: 'Withings' };
  if (/renpho|eufy|fitindex|garmin|fitbit|wyze|arboleaf/i.test(text)) return { guess: 'smart-scale', name: 'Smart scale' };
  if (/prism|spren|bodygram|3dlook/i.test(text)) return { guess: 'scan-app', name: 'Body scan app' };
  return { guess: 'other', name: null };
}

/**
 * @param defaultUnit used when a column doesn't say kg or lb
 */
export function parseBodyCompExport(text: string, defaultUnit: 'kg' | 'lb' = 'lb'): ImportedScan {
  const warnings: string[] = [];
  let headers: string[] = [];
  let rows: unknown[][] = [];
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data: unknown = JSON.parse(trimmed);
    if (!Array.isArray(data)) data = (data as Record<string, unknown>).data ?? (data as Record<string, unknown>).measurements ?? [data];
    const list = data as Record<string, unknown>[];
    headers = Array.from(new Set(list.flatMap((o) => Object.keys(o))));
    rows = list.map((o) => headers.map((h) => o[h]));
  } else {
    const t = parseCsv(text);
    headers = t[0] ?? []; rows = t.slice(1);
  }
  const src = guessSource(`${headers.join(' ')} ${text.slice(0, 2000)}`);
  const empty: ImportedScan = { date: null, weightLb: null, leanMassLb: null, bodyFatPct: null, asmKg: null, sourceGuess: src.guess, sourceName: src.name, rows: rows.length, warnings };
  if (!rows.length) { warnings.push('The file has no measurements.'); return empty; }

  const cDate = find(headers, /date|time|measured/i);
  const cWeight = find(headers, /^\s*(body\s*)?weight|\bweight\b/i, /lean|fat|muscle|bone|water|change/i);
  const cLean = find(headers, /fat[\s_-]*free|lean[\s_-]*(body[\s_-]*)?(mass|tissue)|\blbm\b|\bffm\b/i, /appendicular|arm|leg|trunk|index|%|skeletal/i);
  const cFatPct = find(headers, /(body[\s_-]*)?fat[\s_(-]*(%|percent|percentage|pct|ratio)|\bpbf\b|^\s*fat\s*$|body\s*fat\s*$/i, /mass|free|kg|lb|visceral/i);
  const cFatMass = find(headers, /(body[\s_-]*)?fat[\s_-]*mass/i, /free|%|visceral|index/i);
  const cAlm = find(headers, /appendicular|\balm\b|\basm\b/i, /index|\/|ht/i);
  const cSmm = find(headers, /skeletal[\s_-]*muscle|\bsmm\b/i);

  // Most recent row by date, else the last row.
  let row = rows[rows.length - 1];
  if (cDate) {
    const dated = rows.map((r) => ({ r, t: Date.parse(String(r[cDate.idx] ?? '')) })).filter((x) => Number.isFinite(x.t));
    if (dated.length) row = dated.sort((a, b) => b.t - a.t)[0].r;
  }
  const lb = (c: Col | null) => {
    if (!c) return null;
    const v = toNum(row[c.idx]);
    if (v == null) return null;
    return Math.round(((c.unit ?? defaultUnit) === 'kg' ? v * KG_TO_LB : v) * 10) / 10;
  };
  const weightLb = lb(cWeight);
  let leanMassLb = lb(cLean);
  let bodyFatPct = cFatPct ? toNum(row[cFatPct.idx]) : null;
  if (bodyFatPct != null && bodyFatPct > 0 && bodyFatPct < 1) bodyFatPct = Math.round(bodyFatPct * 1000) / 10; // 0.32 -> 32%
  const fatMassLb = lb(cFatMass);
  if (leanMassLb == null && weightLb != null && fatMassLb != null) leanMassLb = Math.round((weightLb - fatMassLb) * 10) / 10;
  if (leanMassLb == null && weightLb != null && bodyFatPct != null) leanMassLb = Math.round(weightLb * (1 - bodyFatPct / 100) * 10) / 10;
  if (bodyFatPct == null && weightLb && leanMassLb) bodyFatPct = Math.round((1 - leanMassLb / weightLb) * 1000) / 10;
  let asmKg = cAlm ? toNum(row[cAlm.idx]) : null;
  if (asmKg != null && (cAlm!.unit ?? defaultUnit) === 'lb') asmKg = Math.round((asmKg / KG_TO_LB) * 10) / 10;
  if (cSmm && !cLean) warnings.push('This file has skeletal muscle mass, which is not the same as lean mass. We used body fat and weight instead.');
  if (weightLb == null) warnings.push("We couldn't find weight in this file. Please type it in.");
  if (leanMassLb == null) warnings.push("We couldn't find lean mass or body fat in this file. Please type them in.");
  if ([cWeight, cLean, cFatMass].some((c) => c && !c.unit)) warnings.push(`Some columns don't say kg or lb, so we read them as ${defaultUnit}. Check the numbers.`);
  const date = cDate ? String(row[cDate.idx] ?? '') || null : null;
  return { ...empty, date, weightLb, leanMassLb, bodyFatPct, asmKg };
}
