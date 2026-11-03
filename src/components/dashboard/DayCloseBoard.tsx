import React, { useState } from 'react';
import { CheckCircle2, Lock, LockOpen, ShieldCheck, XCircle } from 'lucide-react';
import { CollectorReport, DailyCollectionRecord, DayClosing } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { CloseState, closingTotals, dayCloseChecks, DayClosingTotals, longPendingCounts } from '../../../shared/collectorDay';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { BigButton, ConfirmSheet } from '../common/ui';
import { FigureLine } from './DayFigures';

type Pending = { kind: 'verify'; report: CollectorReport } | { kind: 'close' } | { kind: 'reopen'; closing: DayClosing };

/** Home shows the board (instead of today's figures) once every collector has reported, and after closing. */
export function closeBoardShown(records: DailyCollectionRecord[], reports: CollectorReport[], closing: DayClosing | undefined): boolean {
  if (closing) return true;
  const checks = dayCloseChecks(todayIso(), records, reports);
  return checks.length > 0 && checks.every(c => c.state !== 'not-sent');
}

/** One collector's line on the board: the tally, then cash and UPI with the cash check. */
interface Line {
  id: string;
  name: string;
  tally: DayClosingTotals;
  status: React.ReactNode;
}

/**
 * Home's board for closing today's business, shown first once every collector with work today has
 * sent the report. It tallies expected, received, balance and long-standing loans, in total and for
 * each collector, with each collector's cash and UPI verified here one by one; then the day is closed,
 * which locks its collections and records the closing in Reports. A closed day can be reopened.
 */
export const DayCloseBoard: React.FC<{
  officeName: string;
  records: DailyCollectionRecord[];
  reports: CollectorReport[];
  closing: DayClosing | undefined;
  onChanged: () => void;
  onOpenReports: () => void;
  onOpenClosings: () => void;
}> = ({ officeName, records, reports, closing, onChanged, onOpenReports, onOpenClosings }) => {
  const { t } = useLanguage();
  const longAfter = useConfig().config.masters.long_pending_after_terms;
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!closeBoardShown(records, reports, closing)) return null;
  const checks = dayCloseChecks(todayIso(), records, reports);
  // Yesterday's closing stays on Home until 6 am; only today's can be reopened (and closed again).
  const pastDay = !!closing && closing.date !== todayIso();

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'verify') await api.verifyCollectorReport(pending.report.id, officeName);
      else if (pending.kind === 'close') await api.closeDay({ by: officeName });
      else await api.reopenDay(pending.closing.id, officeName);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const stateLabel: Record<Exclude<CloseState, 'not-sent' | 'to-verify' | 'ready'>, string> = {
    'correction-waiting': t('correctionWaiting', 'Correction waiting'),
    changed: t('changedAfterReport', 'Changed after report'),
  };
  const verifiedMark = (
    <span className="text-xs font-bold inline-flex items-center gap-1 text-emerald-300">
      <ShieldCheck className="w-4 h-4" aria-label={t('verified', 'Verified')} />
      <span className="hidden sm:inline">{t('verified', 'Verified')}</span>
    </span>
  );

  // Before closing the lines come from the reports (as verified); after closing, from the closing record.
  const lines: Line[] = closing
    ? closing.collectors.map(l => ({ id: l.collector_id, name: l.collector_name, tally: l, status: verifiedMark }))
    : checks.map(c => {
        const r = c.report!;
        const longPending = longPendingCounts(records.filter(x => x.collector_id === c.collector_id), longAfter);
        return {
          id: c.collector_id,
          name: c.collector_name,
          tally: {
            customers_assigned: r.summary.customersAssigned,
            customers_paid: r.summary.customersPaid,
            expected: r.summary.expected,
            collected: r.summary.collected,
            balance: r.summary.pendingAmount,
            long_pending: longPending.total,
            long_pending_unpaid: longPending.pending,
            cash_in_app: r.cash_in_app,
            upi_in_app: r.upi_in_app,
            cash_counted: r.cash_counted,
          },
          status:
            c.state === 'to-verify' ? (
              <button
                type="button"
                onClick={() => setPending({ kind: 'verify', report: r })}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
              >
                <ShieldCheck className="w-4 h-4" />
                {t('verify', 'Verify')}
              </button>
            ) : c.state === 'ready' ? (
              verifiedMark
            ) : (
              <button type="button" onClick={onOpenReports} className="text-xs font-bold underline underline-offset-4 text-amber-300">
                {stateLabel[c.state as keyof typeof stateLabel]}
              </button>
            ),
        };
      });
  const total = closing ? { ...closingTotals([]), ...closing.totals } : closingTotals(lines.map(l => ({ ...l.tally, collector_id: l.id, collector_name: l.name, report_id: '' })));
  const allReady = !closing && checks.every(c => c.state === 'ready');

  const longCell = (tally: DayClosingTotals) => (
    <>
      <strong className={tally.long_pending_unpaid > 0 ? 'text-rose-300' : 'text-white'}>{tally.long_pending_unpaid}</strong>
      <span className="text-slate-400"> / {tally.long_pending}</span>
    </>
  );
  const cashCell = (tally: DayClosingTotals) => (
    <>
      <span className="inline-flex items-center gap-1 text-white">
        {formatCurrency(tally.cash_in_app)}
        {tally.cash_counted === tally.cash_in_app ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
      </span>
      {tally.cash_counted !== tally.cash_in_app && (
        <span className="block text-xs text-rose-300">{t('notesCounted', 'Notes counted')} {formatCurrency(tally.cash_counted)}</span>
      )}
    </>
  );

  const th = 'py-2.5 px-2 font-semibold text-right whitespace-nowrap';
  const td = 'py-2.5 px-2 text-right font-mono whitespace-nowrap';

  const confirmSheet = pending && (
    <ConfirmSheet
      title={
        pending.kind === 'verify'
          ? t('verifyAndApproveQuestion', 'Approve this report?')
          : pending.kind === 'close'
            ? t('closeDayQuestion', "Close today's business?")
            : t('reopenDayQuestion', 'Reopen today?')
      }
      message={
        pending.kind === 'verify'
          ? `${pending.report.collector_name} · ${t('amountInCash', 'Amount in cash')} ${formatCurrency(pending.report.cash_in_app)} · ${t('notesCounted', 'Notes counted')} ${formatCurrency(pending.report.cash_counted)}`
          : pending.kind === 'close'
            ? t('closeDayHint', "Today's collections are locked after this. You can reopen the day if something has to change.")
            : t('reopenDayHint', 'Collections for today can change again. Close the day again afterwards.')
      }
      yesLabel={pending.kind === 'verify' ? t('approve', 'Approve') : pending.kind === 'close' ? t('closeDay', 'Close the day') : t('reopenDay', 'Reopen the day')}
      noLabel={t('no', 'No')}
      busy={busy}
      onYes={run}
      onNo={() => setPending(null)}
    />
  );

  return (
    <section className={`glass-card rounded-2xl p-4 sm:p-5 border-2 space-y-4 ${closing ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-gold-400 bg-gold-500/5'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={`text-xl font-black flex items-center gap-2 ${closing ? 'text-emerald-300' : 'text-gold-300'}`}>
            {closing && <Lock className="w-5 h-5" />}
            {pastDay
              ? `${t('businessClosedOn', 'Business closed')} · ${formatDate(closing.date)}`
              : closing
                ? t('dayClosed', "Today's business is closed")
                : t('closeTodaysBusiness', "Close today's business")}
          </h2>
          <p className="text-sm text-slate-400">
            {closing
              ? `${formatDateTime(closing.closed_at)} · ${closing.closed_by}`
              : t('closeBoardHint', "All reports are in. Check each collector's cash, verify, then close the day.")}
          </p>
        </div>
      </div>

      <FigureLine
        large
        figures={[
          { label: t('expectedCollection', 'Expected Collection'), value: formatCurrency(total.expected) },
          { label: t('received', 'Received'), value: formatCurrency(total.collected), tone: 'text-emerald-400' },
          { label: t('balance', 'Balance'), value: formatCurrency(total.balance), tone: 'text-gold-300' },
          {
            label: t('longStandingLoans', 'Long standing loans'),
            value: (
              <>
                <span className="text-rose-300">{total.long_pending_unpaid}</span>
                <span className="text-slate-400 text-base"> / {total.long_pending}</span>
              </>
            ),
          },
        ]}
      />

      <div className="rounded-2xl border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-800">
              <th className="py-2.5 pl-3 pr-2 font-semibold text-left">{t('collector', 'Collector')}</th>
              <th className={th}>{t('expected', 'Expected')}</th>
              <th className={th}>{t('received', 'Received')}</th>
              <th className={th}>{t('balance', 'Balance')}</th>
              <th className={th}>{t('longStandingShort', 'Long standing')}</th>
              <th className={th}>{t('amountInCash', 'Amount in cash')}</th>
              <th className={th}>UPI</th>
              <th className="py-2.5 pl-2 pr-3 font-semibold text-center">{t('status', 'Status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {lines.map(l => (
              <tr key={l.id}>
                <td className="py-2.5 pl-3 pr-2 font-bold text-white">
                  {t(l.name, l.name)}
                  <span className="block text-xs font-normal text-slate-400">{l.tally.customers_paid}/{l.tally.customers_assigned} {t('paidShort', 'paid')}</span>
                </td>
                <td className={`${td} text-slate-200`}>{formatCurrency(l.tally.expected)}</td>
                <td className={`${td} text-emerald-400 font-bold`}>{formatCurrency(l.tally.collected)}</td>
                <td className={`${td} text-gold-300`}>{formatCurrency(l.tally.balance)}</td>
                <td className={td}>{longCell(l.tally)}</td>
                <td className={td}>{cashCell(l.tally)}</td>
                <td className={`${td} text-white`}>{formatCurrency(l.tally.upi_in_app)}</td>
                <td className="py-2 pl-2 pr-3 text-center">{l.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gold-500/40 font-bold">
              <td className="py-2.5 pl-3 pr-2 text-gold-300">
                {t('total', 'Total')}
                <span className="block text-xs font-normal text-slate-400">{total.customers_paid}/{total.customers_assigned} {t('paidShort', 'paid')}</span>
              </td>
              <td className={`${td} text-white`}>{formatCurrency(total.expected)}</td>
              <td className={`${td} text-emerald-400`}>{formatCurrency(total.collected)}</td>
              <td className={`${td} text-gold-300`}>{formatCurrency(total.balance)}</td>
              <td className={td}>{longCell(total)}</td>
              <td className={td}>{cashCell(total)}</td>
              <td className={`${td} text-white`}>{formatCurrency(total.upi_in_app)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {closing ? (
        <div className={`grid gap-2 ${pastDay ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {!pastDay && <BigButton small icon={LockOpen} label={t('reopenDay', 'Reopen the day')} onClick={() => setPending({ kind: 'reopen', closing })} />}
          <BigButton small label={t('dayClosings', 'Day closings')} onClick={onOpenClosings} />
        </div>
      ) : (
        <>
          <BigButton
            tone="gold"
            icon={Lock}
            label={t('closeTodaysBusiness', "Close today's business")}
            onClick={() => setPending({ kind: 'close' })}
            disabled={!allReady || busy}
            className="w-full py-4 text-base"
          />
          {!allReady && <p className="text-xs text-slate-400 text-center">{t('verifyAllFirst', 'Verify every report to close the day.')}</p>}
        </>
      )}
      {confirmSheet}
    </section>
  );
};
