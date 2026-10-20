export function money(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `R${(v / 1e9).toFixed(2)}bn`;
  if (a >= 1e6) return `R${(v / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `R${Math.round(v / 1e3)}k`;
  return `R${Math.round(v)}`;
}

export const moneyFull = (v: number) => `R ${Math.round(v).toLocaleString('en-ZA')}`.replace(/ /g, ' ');

export function pct(v: number | null | undefined, digits = 0): string {
  return v == null ? '–' : `${(v * 100).toFixed(digits)}%`;
}

export function date(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
