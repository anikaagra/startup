import type { CheckResult, Patient, ProviderList } from './types';
import { demoApi } from './demoApi';

export const IS_DEMO = import.meta.env.VITE_DEMO === '1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  } catch {
    throw new Error("We couldn't reach Rise. Check your internet connection and try again.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
  return body as T;
}

/** Record-ready export: one observation per check (mirrors the server's /export route). */
export function toExport(p: Patient) {
  return {
    patient: { id: p.id, firstName: p.firstName, age: p.age, sex: p.sex, tier: p.tier, tierReasons: p.tierReasons },
    observations: p.checks.map((c) => ({
      date: c.createdAt.slice(0, 10), measure: '30-second chair stand', value: c.stands, unit: 'repetitions', method: c.method,
      captureConfidence: c.confidence, state: c.state, readinessFlag: c.flagged, belowAgeSexNorm: c.belowNorm, normCutoff: c.normCutoff,
      normReference: `CDC STEADI ${c.normBand}`, leanMassLb: c.leanMassLb, bodyFatPct: c.bodyFatPct, actionGiven: c.action,
    })),
  };
}

const serverApi = {
  createPatient: (data: Record<string, unknown>) => req<Patient>('/api/patients', { method: 'POST', body: JSON.stringify(data) }),
  getPatient: (id: string) => req<Patient>(`/api/patients/${id}`),
  submitCheck: (id: string, data: Record<string, unknown>) => req<CheckResult>(`/api/patients/${id}/checks`, { method: 'POST', body: JSON.stringify(data) }),
  provider: (code: string) => req<ProviderList>(`/api/providers/${encodeURIComponent(code)}`),
  providerPatient: (code: string, id: string) => req<Patient>(`/api/providers/${encodeURIComponent(code)}/patients/${id}`),
};

export const api = IS_DEMO ? demoApi : serverApi;
