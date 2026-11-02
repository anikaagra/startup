export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', opts);
export const today = () => new Date().toISOString().slice(0, 10);
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
export const sexLabel = (s: string) => (s === 'female' ? 'F' : s === 'male' ? 'M' : 'X');
export function monthsSince(iso: string | null) {
  if (!iso) return null;
  const m = Math.round((Date.now() - new Date(iso).getTime()) / (30.44 * 864e5));
  return Math.max(0, m);
}
