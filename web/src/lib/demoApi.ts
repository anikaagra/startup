// In-browser stand-in for the Rise API, used by the shareable demo build (VITE_DEMO=1).
// It runs the same rules engine and example data as the server and keeps data in this browser only.
// @ts-expect-error plain JS module shared with the server
import { computeTier, evaluateCheck, STATE_RANK, TIERS, METHOD_LABEL } from '../../../server/src/rules.js';
// @ts-expect-error plain JS module shared with the server
import { DEMO_PEOPLE, DEMO_DATES } from '../../../server/src/demoData.js';
import type { Check, CheckResult, Patient, ProviderList } from './types';

type Row = Check & { patientId: string };
type Store = { providers: Record<string, string>; patients: Omit<Patient, 'checks' | 'nextDue' | 'checkEveryDays'>[]; checks: Row[]; nextId: number };
const KEY = 'rise.demo.v2';

function toRow(id: number, patientId: string, c: Record<string, unknown>, r: CheckResult): Row {
  return {
    id, patientId, createdAt: r.createdAt, stands: c.stands as number, durationSec: 30, confidence: (c.confidence as number) ?? null,
    sleptPoorly: !!c.sleptPoorly, painOrIll: !!c.painOrIll, leanMassLb: (c.leanMassLb as number) ?? null, bodyFatPct: (c.bodyFatPct as number) ?? null,
    method: (c.method as string) ?? 'phone-video', state: r.state, flagged: r.flagged, providerFlag: r.providerFlag, verdict: r.verdict,
    action: r.action, reason: r.reason, retestDate: r.retestDate, belowNorm: r.belowNorm, normCutoff: r.normCutoff, normBand: r.normBand,
    weightLb: (c.weightLb as number) ?? null, bodyCompMethod: (c.bodyCompMethod as Check['bodyCompMethod']) ?? null, asmKg: (c.asmKg as number) ?? null,
    gripKg: (c.gripKg as number) ?? null, domains: r.domains, reasons: r.reasons,
  };
}

function seed(): Store {
  const s: Store = { providers: { DEMO42: 'Bay Area Weight Care (demo)' }, patients: [], checks: [], nextId: 1 };
  for (const [firstName, age, sex, menopause, medication, dose, startDate, sw, cw, activity, falls, jointPain, goal, heightIn, checks] of DEMO_PEOPLE) {
    const base = { firstName, age, sex, menopause, medication, dose, startDate, startWeightLb: sw, currentWeightLb: cw, activity, falls, jointPain, goal, heightIn };
    const { tier, reasons } = computeTier(base);
    const id = `demo-${String(firstName).toLowerCase()}`;
    s.patients.push({ ...base, id, providerCode: 'DEMO42', tier, tierReasons: reasons, createdAt: DEMO_DATES[0] });
    const hist: Row[] = [];
    (checks as [number, number, number, number | null][]).forEach(([stands, weightLb, leanMassLb, gripKg], i) => {
      const c = { stands, weightLb, leanMassLb, gripKg, bodyCompMethod: 'smart-scale', confidence: 0.92, createdAt: DEMO_DATES[i], method: 'phone-video' };
      const row = toRow(s.nextId++, id, c, evaluateCheck({ ...base, tier }, hist, c));
      s.checks.push(row); hist.push(row);
    });
  }
  return s;
}

let mem: Store | null = null;
function load(): Store {
  if (mem) return mem;
  try { const raw = localStorage.getItem(KEY); if (raw) return (mem = JSON.parse(raw)); } catch { /* storage unavailable */ }
  return (mem = seed());
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* keep in memory only */ } }
const fail = (m: string) => Promise.reject(new Error(m));
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));
const num = (v: unknown) => (v === '' || v == null ? null : Number(v));

function full(id: string): Patient | null {
  const s = load();
  const p = s.patients.find((x) => x.id === id);
  if (!p) return null;
  const checks = s.checks.filter((c) => c.patientId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  const last = checks[checks.length - 1];
  return { ...p, checks, nextDue: last ? last.retestDate : new Date().toISOString().slice(0, 10), checkEveryDays: TIERS[p.tier].checkEveryDays };
}

export const demoApi = {
  createPatient(b: Record<string, unknown>): Promise<Patient> {
    const s = load();
    const code = String(b.providerCode ?? '').trim().toUpperCase();
    if (!s.providers[code]) return fail('That provider code was not found. In this demo, use DEMO42.');
    const firstName = String(b.firstName ?? '').trim().slice(0, 40);
    const age = Number(b.age);
    if (!firstName) return fail('Please enter your first name.');
    if (!Number.isInteger(age) || age < 18 || age > 110) return fail('Please enter an age between 18 and 110.');
    const base = {
      firstName, age, sex: b.sex as Patient['sex'], menopause: b.sex === 'female' ? (b.menopause as string) ?? null : null,
      medication: (b.medication as string) || null, dose: (b.dose as string) || null, startDate: (b.startDate as string) || null,
      startWeightLb: num(b.startWeightLb), currentWeightLb: num(b.currentWeightLb), heightIn: num(b.heightIn),
      activity: (b.activity as string) || null, falls: (b.falls as string) || null, jointPain: (b.jointPain as string) || null, goal: String(b.goal ?? '').trim() || null,
    };
    const { tier, reasons } = computeTier(base);
    const id = `p-${Date.now().toString(36)}`;
    s.patients.push({ ...base, id, providerCode: code, tier, tierReasons: reasons, createdAt: new Date().toISOString() });
    save();
    return delay(full(id)!);
  },
  getPatient: (id: string) => { const p = full(id); return p ? delay(p) : fail('Patient not found'); },
  submitCheck(id: string, b: Record<string, unknown>): Promise<CheckResult> {
    const s = load();
    const p = full(id);
    if (!p) return fail('Patient not found');
    const c = { ...b, stands: Number(b.stands), weightLb: num(b.weightLb), leanMassLb: num(b.leanMassLb), bodyFatPct: num(b.bodyFatPct),
      asmKg: num(b.asmKg), gripKg: num(b.gripKg), bodyCompMethod: typeof b.bodyCompMethod === 'string' && b.bodyCompMethod in METHOD_LABEL ? b.bodyCompMethod : null };
    if (!Number.isInteger(c.stands) || c.stands < 0 || c.stands > 40) return fail('Stands must be a whole number from 0 to 40.');
    if (c.leanMassLb != null && c.weightLb != null && c.leanMassLb >= c.weightLb) return fail('Lean mass must be less than your weight. Check the numbers from your scan.');
    if (c.leanMassLb != null && !c.bodyCompMethod) return fail('Please choose where your body composition numbers came from.');
    const r = evaluateCheck(p, p.checks, c) as CheckResult;
    s.checks.push(toRow(s.nextId++, id, c, r));
    save();
    return delay({ ...r, patient: full(id)! });
  },
  provider(code: string): Promise<ProviderList> {
    const s = load();
    const c = code.toUpperCase();
    if (!s.providers[c]) return fail('Provider code not found');
    const today = new Date().toISOString().slice(0, 10);
    const rank = STATE_RANK as Record<string, number>;
    const patients = s.patients.filter((p) => p.providerCode === c).map((x) => full(x.id)!).map((p) => {
      const last = p.checks[p.checks.length - 1];
      return { id: p.id, firstName: p.firstName, age: p.age, sex: p.sex, medication: p.medication, startDate: p.startDate, tier: p.tier,
        state: last?.state ?? null, flagged: last?.flagged ?? false, lastCheck: last?.createdAt ?? null, recent: p.checks.slice(-3).map((k) => k.stands),
        latest: last?.stands ?? null, belowNorm: last?.belowNorm ?? false, normCutoff: last?.normCutoff ?? null, normBand: last?.normBand ?? null,
        overdue: last ? last.retestDate < today : true, massState: last?.domains?.mass?.state ?? null, leanShare: last?.domains?.mass?.leanShare ?? null,
        gripState: last?.domains?.grip?.state ?? null, gripKg: last?.gripKg ?? null, reasons: last?.reasons ?? [] };
    });
    patients.sort((a, b) => (rank[a.state ?? ''] ?? 3) - (rank[b.state ?? ''] ?? 3)
      || (a.tier === 'higher' ? 0 : 1) - (b.tier === 'higher' ? 0 : 1) || String(b.lastCheck).localeCompare(String(a.lastCheck)));
    return delay({ code: c, name: s.providers[c], patients });
  },
  providerPatient(code: string, id: string) {
    const p = full(id);
    return p && p.providerCode === code.toUpperCase() ? delay(p) : fail('Patient not found');
  },
};

export function demoReset() { mem = seed(); save(); }
