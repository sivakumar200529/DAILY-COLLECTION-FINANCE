import React, { useEffect, useState } from 'react';
import { ChevronDown, Lock, LockOpen } from 'lucide-react';
import { DayClosing } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { EmptyState, Spinner } from '../common/ui';

/**
 * Every day the office closed, newest first, as a list: the date, who closed it, what was received
 * against expected and whether it was reopened. Pressing a day opens its details: expected, received,
 * balance and long-standing loans with each collector's verified cash and UPI.
 */
export const DayClosingsReport: React.FC = () => {
  const { t } = useLanguage();
  const [closings, setClosings] = useState<DayClosing[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    api.getDayClosings().then(setClosings).catch(() => setClosings([]));
  }, []);

  if (!closings) return <Spinner />;
  if (closings.length === 0) return <EmptyState icon={Lock} text={t('noDayClosings', 'No day has been closed yet')} />;

  const details = (c: DayClosing) => (
    <div className="rounded-2xl border border-slate-800 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
            <th className="py-2 pl-3 pr-1 font-semibold">{t('collector', 'Collector')}</th>
            <th className="py-2 px-1 font-semibold text-right">{t('customersPaid', 'Customers paid')}</th>
            <th className="py-2 px-1 font-semibold text-right">{t('expected', 'Expected')}</th>
            <th className="py-2 px-1 font-semibold text-right">{t('received', 'Received')}</th>
            <th className="py-2 px-1 font-semibold text-right">{t('balance', 'Balance')}</th>
            <th className="py-2 px-1 font-semibold text-right">{t('longStandingShort', 'Long standing')}</th>
            <th className="py-2 px-1 font-semibold text-right">{t('amountInCash', 'Amount in cash')}</th>
            <th className="py-2 pl-1 pr-3 font-semibold text-right">UPI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {c.collectors.map(l => (
            <tr key={l.collector_id}>
              <td className="py-2 pl-3 pr-1">
                <span className="block font-bold text-white">{l.collector_name}</span>
                {l.verified_by && <span className="block text-xs text-slate-500">{t('verifiedBy', 'Verified by')} {l.verified_by}</span>}
              </td>
              <td className="py-2 px-1 text-right font-mono">{l.customers_paid}/{l.customers_assigned}</td>
              <td className="py-2 px-1 text-right font-mono">{formatCurrency(l.expected)}</td>
              <td className="py-2 px-1 text-right font-mono text-emerald-400">{formatCurrency(l.collected)}</td>
              <td className="py-2 px-1 text-right font-mono text-gold-300">{formatCurrency(l.balance ?? 0)}</td>
              <td className="py-2 px-1 text-right font-mono">{l.long_pending_unpaid ?? 0} / {l.long_pending ?? 0}</td>
              <td className="py-2 px-1 text-right font-mono text-white">
                {formatCurrency(l.cash_in_app)}
                {l.cash_counted !== l.cash_in_app && (
                  <span className="block text-xs text-rose-300">{t('notesCounted', 'Notes counted')} {formatCurrency(l.cash_counted)}</span>
                )}
              </td>
              <td className="py-2 pl-1 pr-3 text-right font-mono text-white">{formatCurrency(l.upi_in_app)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gold-500/40 font-bold">
            <td className="py-2 pl-3 pr-1 text-gold-300">{t('total', 'Total')}</td>
            <td className="py-2 px-1 text-right font-mono">{c.totals.customers_paid}/{c.totals.customers_assigned}</td>
            <td className="py-2 px-1 text-right font-mono">{formatCurrency(c.totals.expected)}</td>
            <td className="py-2 px-1 text-right font-mono text-emerald-400">{formatCurrency(c.totals.collected)}</td>
            <td className="py-2 px-1 text-right font-mono text-gold-300">{formatCurrency(c.totals.balance ?? 0)}</td>
            <td className="py-2 px-1 text-right font-mono">{c.totals.long_pending_unpaid ?? 0} / {c.totals.long_pending ?? 0}</td>
            <td className="py-2 px-1 text-right font-mono text-white">{formatCurrency(c.totals.cash_in_app)}</td>
            <td className="py-2 pl-1 pr-3 text-right font-mono text-white">{formatCurrency(c.totals.upi_in_app)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="glass-card rounded-2xl border border-slate-800 max-w-3xl divide-y divide-slate-800 overflow-hidden">
      {closings.map(c => {
        const open = openId === c.id;
        return (
          <div key={c.id} className={c.reopened_at ? 'opacity-75' : undefined}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : c.id)}
              aria-expanded={open}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${open ? 'bg-navy-900/80' : 'hover:bg-navy-900/50'}`}
            >
              <div className="min-w-0 flex-1">
                <span className="block text-base font-black text-white">{formatDate(c.date)}</span>
                <span className="block text-xs text-slate-400 truncate">
                  {t('closedBy', 'Closed by')} {c.closed_by} · {formatDateTime(c.closed_at)}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="block font-mono font-bold text-emerald-400">{formatCurrency(c.totals.collected)}</span>
                <span className="block text-xs text-slate-400 font-mono">
                  {t('of', 'of')} {formatCurrency(c.totals.expected)}
                </span>
              </div>
              {c.reopened_at ? (
                <span className="shrink-0 px-2 py-1 rounded-lg border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1">
                  <LockOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('reopened', 'Reopened')}</span>
                </span>
              ) : (
                <span className="shrink-0 px-2 py-1 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('closed', 'Closed')}</span>
                </span>
              )}
              <ChevronDown className={`w-5 h-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div className="px-4 pb-4 pt-1 space-y-3 bg-navy-900/40">
                {c.reopened_at && (
                  <p className="text-xs font-bold text-amber-300">
                    {t('reopened', 'Reopened')} · {c.reopened_by} · {formatDateTime(c.reopened_at)}
                  </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  {[
                    { label: t('expectedCollection', 'Expected Collection'), value: formatCurrency(c.totals.expected), tone: 'text-white' },
                    { label: t('received', 'Received'), value: formatCurrency(c.totals.collected), tone: 'text-emerald-400' },
                    { label: t('balance', 'Balance'), value: formatCurrency(c.totals.balance ?? 0), tone: 'text-gold-300' },
                    {
                      label: t('longStandingLoans', 'Long standing loans'),
                      value: `${c.totals.long_pending_unpaid ?? 0} / ${c.totals.long_pending ?? 0}`,
                      tone: 'text-rose-300',
                    },
                  ].map(f => (
                    <div key={f.label} className="rounded-xl border border-slate-800 px-3 py-2">
                      <span className="block text-xs text-slate-400">{f.label}</span>
                      <span className={`block font-mono font-black text-lg ${f.tone}`}>{f.value}</span>
                    </div>
                  ))}
                </div>
                {details(c)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
