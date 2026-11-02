// In-browser stand-in for the Rise API, used by the shareable demo build (VITE_DEMO=1).
// It runs the same rules engine as the server and keeps data in this browser only.
// @ts-expect-error plain JS module shared with the server
import { computeTier, evaluateCheck, STATE_RANK, TIERS } from '../../../server/src/rules.js';
import type { Check, CheckResult, Patient, ProviderList } from './types';

type Store = { providers: Record<string, string>; patients: Omit<Patient, 'checks' | 'nextDue' | 'checkEveryDays'>[]; checks: (Check & { patientId: string })[]; nextId: number };
const KEY = 'rise.demo.v1';

function seed(): Store {
  const s: Store = { providers: { DEMO42: 'Bay Area Weight Care (demo)' }, patients: [], checks: [], nextId: 1 };
  const people: [string, number, Patient['sex'], string | null, string, string, string, number, number, string, string, string, string, number[]][] = [
    ['Linda', 67, 'female', 'yes', 'semaglutide', '1.7 mg', '2026-05-20', 228, 196, 'some', 'once', 'yes', 'garden again without help', [13, 11, 9]],
    ['Maria', 62, 'female', 'yes', 'semaglutide', '1 mg', '2026-06-02', 205, 182, 'some', 'none', 'yes', 'keep up with my grandkids', [14, 14, 12]],
    ['Dennis', 71, 'male', null, 'tirzepatide', '10 mg', '2026-04-11', 251, 219, 'regular', 'none', 'no', 'keep golfing', [13, 13, 12]],
    ['Priya', 54, 'female', 'no', 'semaglutide', '2.4 mg', '2026-07-01', 190, 176, 'regular', 'none', 'no', 'hike Mission Peak', [16, 17, 17]],
    ['James', 48, 'male', null, 'tirzepatide', '7.5 mg', '2026-06-15', 262, 238, 'very', 'none', 'no', 'play basketball with my son', [18, 19, 19]],
    ['Rosa', 59, 'female', 'yes', 'semaglutide', '1.7 mg', '2026-05-05', 214, 190, 'some', 'none', 'no', 'travel to see my sister', [15, 16, 15]],
  ];
  const dates = ['2026-08-03T17:00:00.000Z', '2026-09-01T17:00:00.000Z', '2026-10-01T17:00:00.000Z'];
  for (const [firstName, age, sex, menopause, medication, dose, startDate, sw, cw, activity, falls, jointPain, goal, stands] of people) {
    const base = { firstName, age, sex, menopause, medication, dose, startDate, startWeightLb: sw, currentWeightLb: cw, activity, falls, jointPain, goal };
    const { tier, reasons } = computeTier(base);
    const id = `demo-${firstName.toLowerCase()}`;
    s.patients.push({ ...base, id, providerCode: 'DEMO42', tier, tierReasons: reasons, createdAt: dates[0] });
    const hist: Check[] = [];
    stands.forEach((n, i) => {
      const r = evaluateCheck({ ...base, tier }, hist, { stands: n, createdAt: dates[i] });
      const c = { id: s.nextId++, patientId: id, createdAt: dates[i], stands: n, durationSec: 30, confidence: 0.92, sleptPoorly: false, painOrIll: false,
        leanMassLb: null, bodyFatPct: null, method: 'phone-video', state: r.state, flagged: r.flagged, providerFlag: r.providerFlag, verdict: r.verdict,
        action: r.action, reason: r.reason, retestDate: r.retestDate, belowNorm: r.belowNorm, normCutoff: r.normCutoff, normBand: r.normBand };
      s.checks.push(c); hist.push(c);
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
      startWeightLb: Number(b.startWeightLb) || null, currentWeightLb: Number(b.currentWeightLb) || null,
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
    const stands = Number(b.stands);
    if (!Number.isInteger(stands) || stands < 0 || stands > 40) return fail('Stands must be a whole number from 0 to 40.');
    const r = evaluateCheck(p, p.checks, { stands, sleptPoorly: !!b.sleptPoorly, painOrIll: !!b.painOrIll });
    s.checks.push({ id: s.nextId++, patientId: id, createdAt: r.createdAt, stands, durationSec: 30, confidence: (b.confidence as number) ?? null,
      sleptPoorly: !!b.sleptPoorly, painOrIll: !!b.painOrIll, leanMassLb: (b.leanMassLb as number) ?? null, bodyFatPct: (b.bodyFatPct as number) ?? null,
      method: b.method === 'demo' ? 'demo' : 'phone-video', state: r.state, flagged: r.flagged, providerFlag: r.providerFlag, verdict: r.verdict,
      action: r.action, reason: r.reason, retestDate: r.retestDate, belowNorm: r.belowNorm, normCutoff: r.normCutoff, normBand: r.normBand });
    save();
    return delay({ ...r, patient: full(id)! });
  },
  provider(code: string): Promise<ProviderList> {
    const s = load();
    const c = code.toUpperCase();
    if (!s.providers[c]) return fail('Provider code not found');
    const today = new Date().toISOString().slice(0, 10);
    const patients = s.patients.filter((p) => p.providerCode === c).map((x) => full(x.id)!).map((p) => {
      const last = p.checks[p.checks.length - 1];
      return { id: p.id, firstName: p.firstName, age: p.age, sex: p.sex, medication: p.medication, startDate: p.startDate, tier: p.tier,
        state: last?.state ?? null, flagged: last?.flagged ?? false, lastCheck: last?.createdAt ?? null, recent: p.checks.slice(-3).map((k) => k.stands),
        latest: last?.stands ?? null, belowNorm: last?.belowNorm ?? false, normCutoff: last?.normCutoff ?? null, normBand: last?.normBand ?? null,
        overdue: last ? last.retestDate < today : true };
    });
    patients.sort((a, b) => ((STATE_RANK as Record<string, number>)[a.state ?? ''] ?? 3) - ((STATE_RANK as Record<string, number>)[b.state ?? ''] ?? 3)
      || (a.tier === 'higher' ? 0 : 1) - (b.tier === 'higher' ? 0 : 1) || String(b.lastCheck).localeCompare(String(a.lastCheck)));
    return delay({ code: c, name: s.providers[c], patients });
  },
  providerPatient(code: string, id: string) {
    const p = full(id);
    return p && p.providerCode === code.toUpperCase() ? delay(p) : fail('Patient not found');
  },
};

export function demoReset() { mem = seed(); save(); }
