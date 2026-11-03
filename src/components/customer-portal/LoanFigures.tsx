import React from 'react';
import { CollectionAccount } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import type { TermProgress } from '../../../shared/finance';
import { loanFigures } from '../../utils/loanFigures';
import { useLanguage } from '../../context/LanguageContext';

/** "45 / 100 | 0 / 33": pending/total, then missed (red) / advance (green). */
export const TermsValue: React.FC<{ terms: TermProgress }> = ({ terms }) => (
  <span className="font-mono">
    <strong className="text-white">{terms.pending}</strong>
    <span className="text-slate-400"> / {terms.total}</span>
    <span className="text-slate-600"> | </span>
    <strong className="text-rose-400">{terms.missed}</strong>
    <span className="text-slate-400"> / </span>
    <strong className="text-emerald-400">{terms.advance}</strong>
  </span>
);

const money = (total: number, pending?: number) => (
  <>
    {pending !== undefined && <strong className="text-gold-300">{formatCurrency(pending)} / </strong>}
    {formatCurrency(total)}
  </>
);

/**
 * `list`: the main screen (total loan on top, then Repayment rows).
 * `grid`: the passbook header (four tiles, two per row on phones).
 */
export const LoanFiguresView: React.FC<{ loan: CollectionAccount; layout: 'list' | 'grid' }> = ({ loan, layout }) => {
  const { t } = useLanguage();
  const f = loanFigures(loan);
  const legend = <span className="block text-[11px] text-slate-500">{t('termsLegend', 'pending/total | missed/advance')}</span>;

  if (layout === 'grid') {
    // On phones: Total, then Principal + Interest side by side, then Terms (its value needs the width).
    const tile = (label: string, value: React.ReactNode, extra?: React.ReactNode, wide = false) => (
      <div className={`p-3 rounded-xl bg-navy-950/80 border border-slate-800 text-center ${wide ? 'col-span-2 sm:col-span-1' : ''}`}>
        <div className="text-xs text-slate-400 font-semibold">{label}</div>
        <div className="text-base sm:text-lg font-black text-white font-mono">{value}</div>
        {extra}
      </div>
    );
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tile(t('totalLoanLabel', 'Total loan'), <span className="text-gold-300">{formatCurrency(f.total)}</span>, undefined, true)}
        {tile(t('principal', 'Principal'), money(f.principal, f.pending?.principal))}
        {tile(t('interest', 'Interest'), money(f.interest, f.pending?.interest))}
        {tile(t('terms', 'Terms'), <TermsValue terms={f.terms} />, legend, true)}
      </div>
    );
  }

  const row = (label: string, value: React.ReactNode, extra?: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 py-2 pl-3">
      <span className="text-base text-slate-300">{label}</span>
      <span className="text-right font-mono text-base text-white">
        {value}
        {extra}
      </span>
    </div>
  );
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-slate-800">
        <span className="text-lg font-bold text-slate-200">{t('totalLoanLabel', 'Total loan')}</span>
        <span className="text-3xl font-black font-mono text-gold-300">{formatCurrency(f.total)}</span>
      </div>
      <div className="pt-3">
        <div className="text-sm font-bold text-gold-400">{t('repayment', 'Repayment')}</div>
        {row(t('principal', 'Principal'), money(f.principal, f.pending?.principal))}
        {row(t('interest', 'Interest'), money(f.interest, f.pending?.interest))}
        {row(t('terms', 'Terms'), <TermsValue terms={f.terms} />, legend)}
      </div>
    </div>
  );
};
