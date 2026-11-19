// Pieces both notebook sheets use: the new card sheet and the running-loans grid.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** An amount as typed: '' is nothing, otherwise a number of rupees (NaN when it is not one). */
export function parseAmount(text: string): number {
  const clean = text.replace(/[,₹\s]/g, '');
  if (clean === '') return 0;
  return /^\d+(\.\d{1,2})?$/.test(clean) ? Number(clean) : NaN;
}

export const inputClass =
  'px-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-gold-500 disabled:opacity-50';

/** A date as on the paper card: 2-11-2026. */
export function cardDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}-${Number(m)}-${y}`;
}
