import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react';
import { Collector, CollectorReport, DailyCollectionRecord } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { canVerify, collectionDaySummary, latestReport } from '../../../shared/collectorDay';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, ConfirmSheet, Spinner } from '../common/ui';
import { ReportStatusBadge, ReportTally, reportTally } from '../collector/ReportTally';

type Deciding = { report: CollectorReport; decision: 'APPROVED' | 'REJECTED' | 'VERIFIED' };

/**
 * Collectors' end-of-day reports: corrections waiting for approval (any day) first, then each
 * collector's report for the chosen day line by line, as the collector sees it, with Verify and
 * approve. Earlier reports of the day fold away below.
 */
export const CollectorReportsReport: React.FC<{ officeName: string }> = ({ officeName }) => {
  const { t } = useLanguage();
  const [date, setDate] = useState(todayIso());
  const [reports, setReports] = useState<CollectorReport[] | null>(null);
  const [records, setRecords] = useState<DailyCollectionRecord[]>([]);
  const [waiting, setWaiting] = useState<CollectorReport[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [deciding, setDeciding] = useState<Deciding | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [day, pending, cols, dayRecords] = await Promise.all([
        api.getCollectorReports({ date }),
        api.getCollectorReports({ status: 'PENDING_APPROVAL' }),
        api.getCollectors(),
        api.getDailyCollections({ date }),
      ]);
      setReports(day);
      setWaiting(pending.filter(r => r.date !== date));
      setCollectors(cols);
      setRecords(dayRecords);
    } catch {
      setReports([]);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async () => {
    if (!deciding) return;
    setBusy(true);
    setError(null);
    try {
      if (deciding.decision === 'VERIFIED') await api.verifyCollectorReport(deciding.report.id, officeName);
      else await api.decideCollectorReport(deciding.report.id, deciding.decision, officeName);
      setDeciding(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.'));
      setDeciding(null);
    } finally {
      setBusy(false);
    }
  };

  if (!reports) return <Spinner />;

  /** The buttons under a report: approve or reject a correction, or verify the report in force. */
  const actions = (r: CollectorReport, all: CollectorReport[]) => {
    if (r.status === 'PENDING_APPROVAL') {
      return (
        <div className="grid grid-cols-2 gap-2">
          <BigButton small tone="red" label={t('reject', 'Reject')} onClick={() => setDeciding({ report: r, decision: 'REJECTED' })} />
          <BigButton small tone="green" icon={CheckCircle2} label={t('approve', 'Approve')} onClick={() => setDeciding({ report: r, decision: 'APPROVED' })} />
        </div>
      );
    }
    if (canVerify(r, all)) {
      return <BigButton tone="green" icon={ShieldCheck} label={t('verifyAndApprove', 'Verify and approve')} onClick={() => setDeciding({ report: r, decision: 'VERIFIED' })} className="w-full" />;
    }
    if (r.verified_at) {
      return (
        <p className="text-sm text-emerald-300 font-semibold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          {t('verifiedBy', 'Verified by')} {r.verified_by} · {formatDateTime(r.verified_at)}
        </p>
      );
    }
    return null;
  };

  const reportBlock = (r: CollectorReport, all: CollectorReport[], changed = false) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">#{r.attempt} · {formatDateTime(r.created_at)}</span>
        <ReportStatusBadge report={r} />
      </div>
      <ReportTally tally={reportTally(r)} />
      {r.note && <p className="text-sm text-slate-300">“{r.note}”</p>}
      {changed && (
        <p className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {t('changedAfterReportOffice', 'Collections changed after this report. The collector has to send a correction.')}
        </p>
      )}
      {!changed && actions(r, all)}
    </div>
  );

  const ids = [...new Set([...collectors.map(c => c.id), ...reports.map(r => r.collector_id)])];
  const nameOf = (id: string) => collectors.find(c => c.id === id)?.name ?? reports.find(r => r.collector_id === id)?.collector_name ?? id;

  return (
    <div className="space-y-4 max-w-3xl">
      {waiting.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-base font-black text-amber-300">{t('correctionToApprove', 'Correction to approve')} ({waiting.length})</h3>
          {waiting.map(r => (
            <div key={r.id} className="glass-card rounded-2xl border border-amber-500/40 p-4 space-y-3">
              <div>
                <div className="font-bold text-white">{r.collector_name}</div>
                <div className="text-xs text-slate-400">{formatDate(r.date)}</div>
              </div>
              {reportBlock(r, [r])}
            </div>
          ))}
        </section>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-bold text-slate-300" htmlFor="collector-report-date">{t('date', 'Date')}</label>
        <input
          id="collector-report-date"
          type="date"
          value={date}
          max={todayIso()}
          onChange={e => setDate(e.target.value || todayIso())}
          className="px-3 py-2.5 bg-navy-950 border border-slate-700 rounded-2xl text-sm text-white"
        />
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {ids.map(id => {
        const theirs = reports.filter(r => r.collector_id === id);
        const hasWork = records.some(r => r.collector_id === id);
        if (theirs.length === 0 && !hasWork && !collectors.some(c => c.id === id && c.status === 'ACTIVE')) return null;
        const current = latestReport(theirs, id, date);
        const live = collectionDaySummary(records.filter(r => r.collector_id === id));
        const changed = !!current && current.status !== 'PENDING_APPROVAL' &&
          (current.summary.collected !== live.collected || current.summary.customersPaid !== live.customersPaid);
        const earlier = theirs.filter(r => r.id !== current?.id);
        return (
          <section key={id} className="glass-card rounded-2xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-black text-white">{nameOf(id)}</h3>
              {theirs.length === 0 && <span className="text-xs font-bold text-slate-400">{t('reportNotSent', 'Not sent')}</span>}
            </div>
            {current && reportBlock(current, theirs, changed)}
            {earlier.length > 0 && (
              <details className="group rounded-xl border border-slate-800">
                <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none text-sm font-bold text-slate-300">
                  <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                  {t('earlierReports', 'Earlier reports')} ({earlier.length})
                </summary>
                <div className="p-3 space-y-4 border-t border-slate-800 opacity-80">
                  {earlier.map(r => (
                    <div key={r.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-400">#{r.attempt} · {formatDateTime(r.created_at)}</span>
                        <ReportStatusBadge report={r} />
                      </div>
                      <ReportTally tally={reportTally(r)} />
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>
        );
      })}

      {deciding && (
        <ConfirmSheet
          title={
            deciding.decision === 'VERIFIED'
              ? t('verifyAndApproveQuestion', 'Approve this report?')
              : deciding.decision === 'APPROVED'
                ? t('approveReportQuestion', 'Approve this correction?')
                : t('rejectReportQuestion', 'Reject this correction?')
          }
          message={`${deciding.report.collector_name} · ${t('amountInCash', 'Amount in cash')} ${formatCurrency(deciding.report.cash_in_app)} · ${t('notesCounted', 'Notes counted')} ${formatCurrency(deciding.report.cash_counted)}`}
          yesLabel={deciding.decision === 'REJECTED' ? t('reject', 'Reject') : t('approve', 'Approve')}
          noLabel={t('no', 'No')}
          danger={deciding.decision === 'REJECTED'}
          busy={busy}
          onYes={decide}
          onNo={() => setDeciding(null)}
        />
      )}
    </div>
  );
};
