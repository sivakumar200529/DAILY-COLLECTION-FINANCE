import React from 'react';
import { CollectorReport } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { collectionDaySummary, dayPaymentSplit } from '../../../shared/collectorDay';
import { useLanguage } from '../../context/LanguageContext';
import type { DailyCollectionRecord } from '../../types';

export interface Figure {
  label: string;
  value: React.ReactNode;
  tone?: string;
  /** Tapping anywhere on the figure opens its section. */
  onClick?: () => void;
}

/** One line of figures, side by side (two per row on a phone when there are four). */
export const FigureLine: React.FC<{ figures: Figure[]; large?: boolean }> = ({ figures, large }) => (
  <div className={`grid gap-y-3 ${figures.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
    {figures.map(f => {
      const content = (
        <>
          <span className="block text-xs text-slate-400 font-semibold">{f.label}</span>
          <span className={`block font-mono font-black ${f.tone ?? 'text-white'} ${large ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'}`}>{f.value}</span>
        </>
      );
      const cell = 'block w-full min-w-0 px-2 sm:px-3 py-1 text-left';
      return (
        <div key={f.label} className="border-l border-slate-700 first:border-l-0 min-w-0">
          {f.onClick ? (
            <button type="button" onClick={f.onClick} className={`${cell} rounded-xl hover:bg-slate-800/70 cursor-pointer`}>{content}</button>
          ) : (
            <div className={cell}>{content}</div>
          )}
        </div>
      );
    })}
  </div>
);

export const FigureCard: React.FC<{ title: string; prominent?: boolean; highlighted?: boolean; children: React.ReactNode }> = ({ title, prominent, highlighted, children }) => (
  <section className={`glass-card rounded-2xl p-4 sm:p-5 border space-y-3 ${
    highlighted ? 'border-2 border-gold-400 bg-gold-500/10' : prominent ? 'border-gold-500/50' : 'border-slate-800'
  }`}>
    <h2 className={`font-bold ${prominent || highlighted ? 'text-lg text-gold-300' : 'text-sm text-gold-400'}`}>{title}</h2>
    {children}
  </section>
);

/**
 * A day's work in two lines: Expected | Total | Balance | Collectors, then Payments | Cash | UPI |
 * Collectors' reports received. Used by Home and Daily Collection, so both always agree.
 */
export const TodayFigureLines: React.FC<{
  records: DailyCollectionRecord[];
  reports: CollectorReport[];
  /** Home: where each figure leads. */
  links?: { collection: () => void; collectors: () => void; receipts: () => void; reports: () => void };
}> = ({ records, reports, links }) => {
  const { t } = useLanguage();
  const summary = collectionDaySummary(records);
  const split = dayPaymentSplit(records);
  const collectorIds = new Set(records.map(r => r.collector_id));
  const reported = new Set(reports.filter(r => r.status !== 'REJECTED' && collectorIds.has(r.collector_id)).map(r => r.collector_id));

  return (
    <div className="space-y-4">
      <FigureLine
        large
        figures={[
          { label: t('expectedCollection', 'Expected Collection'), value: formatCurrency(summary.expected), onClick: links?.collection },
          { label: t('totalCollection', 'Total Collection'), value: formatCurrency(summary.collected), tone: 'text-emerald-400', onClick: links?.collection },
          { label: t('balance', 'Balance'), value: formatCurrency(summary.pendingAmount), tone: 'text-gold-300', onClick: links?.collection },
          { label: t('collectors', 'Collectors'), value: collectorIds.size, onClick: links?.collectors },
        ]}
      />
      <div className="border-t border-slate-800 pt-4">
        <FigureLine
          figures={[
            { label: t('totalPayments', 'Total Payments'), value: split.payments, onClick: links?.receipts },
            { label: t('totalCashReceived', 'Total Cash received'), value: formatCurrency(split.cash), onClick: links?.receipts },
            { label: t('totalUpiPayments', 'Total UPI payments'), value: formatCurrency(split.upi), onClick: links?.receipts },
            { label: t('collectorsReport', 'Collectors Report'), value: `${reported.size} / ${collectorIds.size}`, onClick: links?.reports },
          ]}
        />
      </div>
    </div>
  );
};
