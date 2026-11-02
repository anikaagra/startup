const KEY = 'rise.patientId';
export const session = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (id: string) => { try { localStorage.setItem(KEY, id); } catch { /* private mode: session only */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};
