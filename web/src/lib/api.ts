import type { CheckResult, Patient, ProviderList } from './types';

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

export const api = {
  createPatient: (data: Record<string, unknown>) => req<Patient>('/api/patients', { method: 'POST', body: JSON.stringify(data) }),
  getPatient: (id: string) => req<Patient>(`/api/patients/${id}`),
  submitCheck: (id: string, data: Record<string, unknown>) => req<CheckResult>(`/api/patients/${id}/checks`, { method: 'POST', body: JSON.stringify(data) }),
  provider: (code: string) => req<ProviderList>(`/api/providers/${encodeURIComponent(code)}`),
  providerPatient: (code: string, id: string) => req<Patient>(`/api/providers/${encodeURIComponent(code)}/patients/${id}`),
  exportUrl: (code: string, id: string) => `/api/providers/${encodeURIComponent(code)}/patients/${id}/export`,
};
