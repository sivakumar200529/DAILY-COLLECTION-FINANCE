import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, History, PencilLine, Send } from 'lucide-react';
import { CollectorReport, DailyCollectionRecord } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { collectionDaySummary, countedCash, dayPaymentSplit } from '../../../shared/collectorDay';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { BigButton, ConfirmSheet, EmptyState, Sheet, Spinner } from '../common/ui';
import { CashCounter, NoteCounts, emptyNotes } from './CashCounter';
import { ReportStatusBadge, ReportTally, reportTally } from './ReportTally';

/**
 * End-of-day tally sent to the office. Before sending: the app's figures and the note counter, with a
 * cross after "Amount in cash" until the counted notes equal it, then a tick. After sending: the report as sent, with
 * Correction (the day's sends are limited in Settings; later corrections wait for office approval).
 */
export const CollectorReportView: React.FC<{
  collectorId: string;
  records: DailyCollectionRecord[];
  onBack: () => void;
}> = ({ collectorId, records, onBack }) => {
  const { t } = useLanguage();
  const limit = useConfig().config.masters.report_send_limit;
  const [notes, setNotes] = useState<NoteCounts>(emptyNotes);
  const [coins, setCoins] = useState(0);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<CollectorReport[] | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const loadSent = useCallback(async () => {
    try {
      setSent(await api.getCollectorReports({ date: todayIso(), collector_id: collectorId }));
    } catch {
      setSent([]);
    }
  }, [collectorId]);

  useEffect(() => {
    loadSent();
  }, [loadSent]);

  if (!sent) return <Spinner />;

  const summary = collectionDaySummary(records);
  // The same split the server stores with the report.
  const { cash: cashInApp, upi: upiInApp } = dayPaymentSplit(records);
  const counted = countedCash(notes, coins);
  const latest = sent[0];
  const needsApproval = sent.length >= limit;

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const report = await api.sendCollectorReport({ collector_id: collectorId, cash_notes: notes, coins, note: note.trim() || undefined });
      setMessage({
        ok: true,
        text: report.status === 'PENDING_APPROVAL'
          ? t('reportSentForApproval', 'Correction sent. The office will check and approve it.')
          : t('reportSent', 'Report sent to the office.'),
      });
      setNote('');
      setCorrecting(false);
      await loadSent();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.') });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const header = (
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-2 py-2 rounded-xl text-slate-200 hover:bg-slate-800 font-bold">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-lg">{t('report', 'Report')}</span>
      </button>
      <button
        type="button"
        onClick={() => setShowHistory(true)}
        className="px-3 py-2 rounded-xl bg-navy-900 border border-slate-700 text-slate-200 text-sm font-bold flex items-center gap-1.5"
      >
        <History className="w-4 h-4 text-gold-400" />
        {t('history', 'History')}
      </button>
    </div>
  );

  const notice = message && (
    <div className={`px-4 py-3 rounded-2xl text-sm font-semibold border ${
      message.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
    }`}>
      {message.text}
    </div>
  );

  const history = showHistory && <ReportHistorySheet collectorId={collectorId} onClose={() => setShowHistory(false)} />;

  // Already sent today: show the report as sent, with Correction.
  if (latest && !correcting) {
    const changedSince = latest.summary.collected !== summary.collected;
    return (
      <div className="space-y-4">
        {header}
        {notice}
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-400">
            {t('lastSent', 'Last sent')} #{latest.attempt} · {formatDateTime(latest.created_at)}
          </div>
          <ReportStatusBadge report={latest} />
        </div>
        <ReportTally tally={reportTally(latest)} />
        {latest.note && <p className="text-sm text-slate-300">“{latest.note}”</p>}
        {changedSince && (
          <p className="px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {t('collectionChangedSinceReport', 'Collections changed after this report. Send a correction.')}
          </p>
        )}
        <BigButton
          tone="gold"
          icon={PencilLine}
          label={t('correction', 'Correction')}
          onClick={() => {
            setMessage(null);
            setCorrecting(true);
          }}
          className="w-full py-4 text-base"
        />
        <p className="text-xs text-slate-400 text-center">
          {needsApproval
            ? t('reportLimitReached', 'Daily sending limit reached. Corrections need office approval.')
            : `${t('reportsSentToday', 'Sent today')}: ${sent.length} / ${limit}`}
        </p>
        {history}
      </div>
    );
  }

  // Not sent yet today, or making a correction: live figures and the note counter.
  const anythingCounted = counted > 0 || cashInApp === 0;
  return (
    <div className="space-y-4">
      {header}
      <ReportTally tally={{ summary, cashInApp, upiInApp, cashCounted: anythingCounted ? counted : null }} />

      <CashCounter
        notes={notes}
        coins={coins}
        onChange={(n, c) => {
          setNotes(n);
          setCoins(c);
        }}
      />

      <div>
        <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('noteOptional', 'Note (optional)')}</label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white focus:border-gold-500 focus:outline-none"
        />
      </div>

      {notice}

      <BigButton
        tone="gold"
        icon={Send}
        label={needsApproval ? t('sendCorrection', 'Send correction for approval') : t('sendToOffice', 'Send to office')}
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="w-full py-4 text-base"
      />
      <p className="text-xs text-slate-400 text-center">
        {needsApproval
          ? t('reportLimitReached', 'Daily sending limit reached. Corrections need office approval.')
          : `${t('reportsSentToday', 'Sent today')}: ${sent.length} / ${limit}`}
      </p>
      {correcting && (
        <button type="button" onClick={() => setCorrecting(false)} className="w-full text-sm text-slate-400 py-2">
          {t('cancel', 'Cancel')}
        </button>
      )}

      {confirming && (
        <ConfirmSheet
          title={needsApproval ? t('sendCorrection', 'Send correction for approval') : t('sendToOffice', 'Send to office')}
          message={`${t('amountInCash', 'Amount in cash')} ${formatCurrency(cashInApp)} · ${t('notesCounted', 'Notes counted')} ${formatCurrency(counted)}`}
          yesLabel={t('yesSend', 'Yes, send')}
          noLabel={t('no', 'No')}
          busy={busy}
          onYes={send}
          onNo={() => setConfirming(false)}
        />
      )}
      {history}
    </div>
  );
};

/** Every report this collector has sent, newest first, grouped by day. */
const ReportHistorySheet: React.FC<{
  collectorId: string;
  onClose: () => void;
}> = ({ collectorId, onClose }) => {
  const { t } = useLanguage();
  const [reports, setReports] = useState<CollectorReport[] | null>(null);

  useEffect(() => {
    api.getCollectorReports({ collector_id: collectorId }).then(setReports).catch(() => setReports([]));
  }, [collectorId]);

  const days = Array.from(new Set((reports ?? []).map(r => r.date)));

  return (
    <Sheet title={t('reportHistory', 'Report history')} onClose={onClose}>
      {!reports ? (
        <Spinner />
      ) : reports.length === 0 ? (
        <EmptyState icon={History} text={t('noReportsYet', 'No reports sent yet')} />
      ) : (
        <div className="space-y-4">
          {days.map(day => (
            <section key={day} className="space-y-2">
              <h4 className="text-sm font-bold text-gold-400">{formatDate(day)}</h4>
              {reports.filter(r => r.date === day).map(r => (
                <div key={r.id} className="rounded-2xl p-3 border border-slate-800 bg-navy-950 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-400">#{r.attempt} · {formatDateTime(r.created_at)}</span>
                    <ReportStatusBadge report={r} />
                  </div>
                  <div className="text-sm text-slate-200">
                    {t('totalCollection', 'Total collection')} <strong className="font-mono">{formatCurrency(r.summary.collected)}</strong> ·{' '}
                    {t('customersPaid', 'Customers paid')} {r.summary.customersPaid}/{r.summary.customersAssigned}
                  </div>
                  <div className="text-sm text-slate-200 flex items-center gap-1.5">
                    {t('amountInCash', 'Amount in cash')} <strong className="font-mono">{formatCurrency(r.cash_in_app)}</strong>
                    {r.cash_counted === r.cash_in_app ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="text-rose-300">
                        ({t('notesCounted', 'Notes counted')} {formatCurrency(r.cash_counted)})
                      </span>
                    )}
                    · UPI <strong className="font-mono">{formatCurrency(r.upi_in_app)}</strong>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
};
