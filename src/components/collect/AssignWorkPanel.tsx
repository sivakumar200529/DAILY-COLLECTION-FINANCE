import React, { useState } from 'react';
import { Check, ChevronRight, Edit3 } from 'lucide-react';
import { Collector, CollectorReport, DailyCollectionRecord } from '../../types';
import { api, DayAssignmentStatus } from '../../services/api';
import { formatCurrency, formatTime } from '../../utils/formatters';
import { collectionDaySummary } from '../../../shared/collectorDay';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton } from '../common/ui';
import { withMissedAmount } from './collectHelpers';

/**
 * Assigning today's work: every customer starts with their usual collector and can be moved for today
 * only; a moved customer shows at once under the new collector. Collectors wait until this is done.
 * Once assigned it shows how each collector is doing.
 */
export const AssignWorkPanel: React.FC<{
  officeName: string;
  /** All of today's customers, whatever the screen's filters are. */
  records: DailyCollectionRecord[];
  collectors: Collector[];
  reports: CollectorReport[];
  assignment: DayAssignmentStatus;
  onChanged: () => Promise<void>;
  onOpenReports: () => void;
}> = ({ officeName, records, collectors, reports, assignment, onChanged, onOpenReports }) => {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collectorOf = (r: DailyCollectionRecord) => moves[r.collection_account_id] ?? r.collector_id;
  const working = collectors.filter(c => c.status === 'ACTIVE');
  const groupIds = [...new Set([...working.map(c => c.id), ...records.map(r => r.collector_id)])];
  const nameOf = (id: string) => collectors.find(c => c.id === id)?.name ?? records.find(r => r.collector_id === id)?.collector_name ?? id;
  const isStopped = (id: string) => !working.some(c => c.id === id);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const changes = records
        .filter(r => collectorOf(r) !== r.collector_id)
        .map(r => ({ collection_account_id: r.collection_account_id, collector_id: collectorOf(r) }));
      await api.assignDayWork({ changes, assigned_by: officeName });
      setMoves({});
      setEditing(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (assignment.assigned && !editing) {
    return (
      <section className="glass-card rounded-2xl border border-slate-800 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800">
          <span className="text-sm text-emerald-300 font-semibold">
            {t('workAssigned', 'Work assigned')}{assignment.assigned_at ? ` • ${formatTime(assignment.assigned_at)}` : ''}{assignment.assigned_by ? ` • ${assignment.assigned_by}` : ''}
          </span>
          <BigButton small icon={Edit3} label={t('changeAssignment', 'Change assignment')} onClick={() => setEditing(true)} />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
              <th className="py-2.5 pl-3 pr-1 font-semibold">{t('collector', 'Collector')}</th>
              <th className="py-2.5 px-1 font-semibold text-right">{t('customersPendingShort', 'Customers pending')}</th>
              <th className="py-2.5 px-1 font-semibold text-right">{t('amountPendingShort', 'Amount pending')}</th>
              <th className="py-2.5 pl-1 pr-3 font-semibold text-center">{t('report', 'Report')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {groupIds.filter(id => records.some(r => r.collector_id === id)).map(id => {
              const summary = collectionDaySummary(records.filter(r => r.collector_id === id));
              const sent = reports.some(r => r.collector_id === id && r.status !== 'REJECTED');
              return (
                <tr key={id}>
                  <td className="py-2.5 pl-3 pr-1 font-bold text-white">{t(nameOf(id), nameOf(id))}</td>
                  <td className="py-2.5 px-1 text-right font-mono whitespace-nowrap">
                    <strong className="text-gold-300">{summary.customersPending}</strong> / {summary.customersAssigned}
                  </td>
                  <td className="py-2.5 px-1 text-right font-mono whitespace-nowrap">
                    <strong className="text-gold-300">{formatCurrency(summary.pendingAmount)}</strong> / {formatCurrency(summary.expected)}
                  </td>
                  <td className="py-2 pl-1 pr-3 text-center">
                    {sent ? (
                      <button type="button" onClick={onOpenReports} aria-label={t('report', 'Report')} className="p-1 text-emerald-400">
                        <Check className="w-5 h-5" />
                      </button>
                    ) : (
                      <span className="text-slate-500">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    );
  }

  const selectClass = 'w-full px-2 py-2 bg-navy-950 border border-slate-700 rounded-xl text-sm text-white disabled:opacity-50';

  return (
    <section className="glass-card rounded-2xl p-4 border border-gold-500/40 space-y-3">
      <div>
        <h2 className="text-lg font-black text-gold-300">{t('assignTodaysWork', "Assign today's work")}</h2>
        <p className="text-sm text-slate-400">
          {t('assignWorkHelp', 'Each customer is with their usual collector. Change a collector here for today only. Collectors can start after you assign.')}
        </p>
      </div>

      <div className="space-y-2">
        {groupIds.map(id => {
          const rows = records.filter(r => collectorOf(r) === id);
          const after = collectionDaySummary(rows);
          if (rows.length === 0 && isStopped(id)) return null;
          return (
            <details key={id} className="group rounded-2xl bg-navy-950 border border-slate-800">
              <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none">
                <ChevronRight className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" />
                <span className="flex-1 min-w-0 font-bold text-white">
                  {t(nameOf(id), nameOf(id))}
                  {isStopped(id) && <span className="ml-2 text-xs text-rose-300">{t('stopped', 'Stopped')}</span>}
                </span>
                <span className="text-sm text-slate-300 font-mono whitespace-nowrap">
                  {after.customersAssigned} • {formatCurrency(after.expected)}
                </span>
              </summary>
              {rows.length > 0 && (
                <div className="divide-y divide-slate-800 border-t border-slate-800">
                  {rows.map(r => {
                    const paid = r.paid_amount > 0;
                    const moved = collectorOf(r) !== r.collector_id;
                    return (
                      <div key={r.id} className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2 px-4 py-2.5">
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{t(r.customer_name, r.customer_name)}</div>
                          <div className="text-xs text-slate-400 truncate">
                            {r.shop_name} • {paid ? `${t('paidToday', 'Paid')} ${formatCurrency(r.paid_amount)}` : formatCurrency(withMissedAmount(r))}
                          </div>
                          {moved && (
                            <div className="text-xs font-semibold text-gold-300">{t('movedFrom', 'Moved from')} {t(nameOf(r.collector_id), nameOf(r.collector_id))}</div>
                          )}
                        </div>
                        <select
                          className={selectClass}
                          value={collectorOf(r)}
                          disabled={paid}
                          aria-label={`${t('collector', 'Collector')}: ${r.customer_name}`}
                          onChange={e => setMoves(prev => ({ ...prev, [r.collection_account_id]: e.target.value }))}
                        >
                          {isStopped(r.collector_id) && <option value={r.collector_id}>{nameOf(r.collector_id)}</option>}
                          {working.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </details>
          );
        })}
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className={`grid gap-3 ${assignment.assigned ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {assignment.assigned && <BigButton label={t('cancel', 'Cancel')} onClick={() => { setMoves({}); setEditing(false); }} />}
        <BigButton
          tone="gold"
          icon={Check}
          label={assignment.assigned ? t('save', 'Save') : t('assignWork', 'Assign work')}
          onClick={save}
          disabled={busy || records.length === 0}
        />
      </div>
    </section>
  );
};
