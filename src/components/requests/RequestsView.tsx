import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Inbox, Wallet, XCircle } from 'lucide-react';
import { LoanRequest, PaymentClaim, User } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, ConfirmSheet, EmptyState, Spinner } from '../common/ui';
import { IssueLoanModal } from '../loans/IssueLoanModal';

type Pending =
  | { kind: 'reject-loan'; request: LoanRequest }
  | { kind: 'record-upi'; claim: PaymentClaim }
  | { kind: 'not-received'; claim: PaymentClaim };

/**
 * What customers asked from their app: new-loan requests (give the loan or reject) and UPI payments
 * they say they made (record after checking the bank account, or "not received"). The customer is
 * told the result either way. Both show in Loan Management.
 */
export const RequestsView: React.FC<{
  tab: 'loans' | 'upi';
  currentUser: User;
  onOpenCustomer: (customerId: string) => void;
  /** Something was handled: the screen around this refreshes its counts and customers. */
  onChanged: () => void;
}> = ({ tab, currentUser, onOpenCustomer, onChanged }) => {
  const { t } = useLanguage();
  const [loans, setLoans] = useState<LoanRequest[] | null>(null);
  const [claims, setClaims] = useState<PaymentClaim[] | null>(null);
  const [giveLoanFor, setGiveLoanFor] = useState<LoanRequest | null>(null);
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [l, c] = await Promise.all([api.getLoanRequests().catch(() => []), api.getPaymentClaims().catch(() => [])]);
    setLoans(l);
    setClaims(c);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ ok: true, text: okText });
      await load();
      onChanged();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.') });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const recordUpi = (claim: PaymentClaim) =>
    run(async () => {
      if (!claim.collection_account_id) throw new Error(t('noRunningLoanForPayment', 'This customer has no running loan to record it on.'));
      const res = await api.collectPayment({
        collection_account_id: claim.collection_account_id,
        collection_date: todayIso(),
        amount_paid: claim.amount,
        payment_mode: 'UPI',
      });
      await api.decidePaymentClaim(claim.id, { decision: 'RECORDED', by: currentUser.name, receipt_number: res.receipt?.receipt_number });
    }, `${claim.customer_name}: ${formatCurrency(claim.amount)} ${t('upiRecorded', 'recorded')}`);

  if (!loans || !claims) return <Spinner />;

  const pendingLoans = loans.filter(r => r.status === 'PENDING');
  const pendingClaims = claims.filter(c => c.status === 'PENDING');
  const doneLoans = loans.filter(r => r.status !== 'PENDING').slice(0, 20);
  const doneClaims = claims.filter(c => c.status !== 'PENDING').slice(0, 20);

  const who = (customerId: string, name: string, shop?: string) => (
    <button type="button" onClick={() => onOpenCustomer(customerId)} className="text-left">
      <span className="block font-bold text-white underline decoration-slate-600 underline-offset-4">{name}</span>
      {shop && <span className="block text-xs text-slate-400">{shop}</span>}
    </button>
  );

  const doneBadge = (approved: boolean, label: string) => (
    <span className={`px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${
      approved ? 'text-emerald-300 border-emerald-500/40' : 'text-rose-300 border-rose-500/40'
    }`}>
      {approved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </span>
  );

  return (
    <div className="space-y-4 max-w-3xl">
      {notice && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-semibold border ${
          notice.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {notice.text}
        </div>
      )}

      {tab === 'loans' ? (
        <>
          {pendingLoans.length === 0 ? (
            <EmptyState icon={Inbox} text={t('noNewRequests', 'Nothing waiting')} />
          ) : (
            pendingLoans.map(r => (
              <div key={r.id} className="glass-card rounded-2xl p-4 border border-gold-500/30 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  {who(r.customer_id, r.customer_name, r.shop_name)}
                  <div className="text-right">
                    <div className="text-xl font-black font-mono text-gold-300">{formatCurrency(r.requested_amount)}</div>
                    <div className="text-xs text-slate-400">{r.collection_days} {t('days', 'days')}</div>
                  </div>
                </div>
                {(r.purpose || r.remarks) && <p className="text-sm text-slate-300">{[r.purpose, r.remarks].filter(Boolean).join(' · ')}</p>}
                <div className="text-xs text-slate-500">{formatDateTime(r.created_at)}</div>
                <div className="grid grid-cols-2 gap-2">
                  <BigButton tone="red" label={t('reject', 'Reject')} onClick={() => setConfirm({ kind: 'reject-loan', request: r })} disabled={busy} />
                  <BigButton tone="gold" icon={Wallet} label={t('giveLoan', 'Give loan')} onClick={() => setGiveLoanFor(r)} disabled={busy} />
                </div>
              </div>
            ))
          )}
          {doneLoans.length > 0 && (
            <section className="space-y-2 pt-2">
              <h3 className="text-sm font-bold text-slate-400">{t('handled', 'Handled')}</h3>
              {doneLoans.map(r => (
                <div key={r.id} className="glass-card rounded-2xl p-3 border border-slate-800 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-bold text-white">{r.customer_name} · {formatCurrency(r.requested_amount)}</div>
                    <div className="text-xs text-slate-400">{r.decided_at ? formatDateTime(r.decided_at) : ''}{r.decided_by ? ` · ${r.decided_by}` : ''}</div>
                  </div>
                  {doneBadge(r.status === 'APPROVED', r.status === 'APPROVED' ? t('reportStatusApproved', 'Approved') : t('reportStatusRejected', 'Rejected'))}
                </div>
              ))}
            </section>
          )}
        </>
      ) : (
        <>
          {pendingClaims.length === 0 ? (
            <EmptyState icon={Inbox} text={t('noNewRequests', 'Nothing waiting')} />
          ) : (
            pendingClaims.map(c => (
              <div key={c.id} className="glass-card rounded-2xl p-4 border border-gold-500/30 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  {who(c.customer_id, c.customer_name, c.shop_name)}
                  <div className="text-xl font-black font-mono text-gold-300">{formatCurrency(c.amount)}</div>
                </div>
                <div className="text-xs text-slate-400">
                  {formatDateTime(c.created_at)}
                  {c.upi_reference ? ` · ${t('upiReference', 'UPI ref')} ${c.upi_reference}` : ''}
                </div>
                <p className="text-sm text-slate-300">{t('checkBankFirst', 'Check the bank account first.')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <BigButton tone="red" label={t('notReceived', 'Not received')} onClick={() => setConfirm({ kind: 'not-received', claim: c })} disabled={busy} />
                  <BigButton tone="green" icon={CheckCircle2} label={t('recordPayment', 'Record payment')} onClick={() => setConfirm({ kind: 'record-upi', claim: c })} disabled={busy} />
                </div>
              </div>
            ))
          )}
          {doneClaims.length > 0 && (
            <section className="space-y-2 pt-2">
              <h3 className="text-sm font-bold text-slate-400">{t('handled', 'Handled')}</h3>
              {doneClaims.map(c => (
                <div key={c.id} className="glass-card rounded-2xl p-3 border border-slate-800 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-bold text-white">{c.customer_name} · {formatCurrency(c.amount)}</div>
                    <div className="text-xs text-slate-400">
                      {c.decided_at ? formatDateTime(c.decided_at) : ''}{c.receipt_number ? ` · ${c.receipt_number}` : ''}
                    </div>
                  </div>
                  {doneBadge(c.status === 'RECORDED', c.status === 'RECORDED' ? t('recorded', 'Recorded') : t('notReceived', 'Not received'))}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {giveLoanFor && (
        <IssueLoanModal
          customerId={giveLoanFor.customer_id}
          prefill={{ requested_amount: giveLoanFor.requested_amount, collection_days: giveLoanFor.collection_days }}
          onClose={() => setGiveLoanFor(null)}
          onIssued={account => {
            const request = giveLoanFor;
            run(
              () => api.decideLoanRequest(request.id, { decision: 'APPROVED', by: currentUser.name, account_id: account.id }),
              `${request.customer_name}: ${t('loanGiven', 'loan given')}`
            );
          }}
        />
      )}

      {confirm && (
        <ConfirmSheet
          title={
            confirm.kind === 'reject-loan'
              ? t('rejectLoanQuestion', 'Reject this loan request?')
              : confirm.kind === 'record-upi'
              ? t('recordUpiQuestion', 'Record this UPI payment?')
              : t('notReceivedQuestion', 'Mark as not received?')
          }
          message={
            confirm.kind === 'reject-loan'
              ? `${confirm.request.customer_name} · ${formatCurrency(confirm.request.requested_amount)}`
              : `${confirm.claim.customer_name} · ${formatCurrency(confirm.claim.amount)}`
          }
          yesLabel={
            confirm.kind === 'reject-loan' ? t('reject', 'Reject') : confirm.kind === 'record-upi' ? t('recordPayment', 'Record payment') : t('notReceived', 'Not received')
          }
          noLabel={t('no', 'No')}
          danger={confirm.kind !== 'record-upi'}
          busy={busy}
          onYes={() => {
            if (confirm.kind === 'record-upi') recordUpi(confirm.claim);
            else if (confirm.kind === 'not-received') {
              const claim = confirm.claim;
              run(() => api.decidePaymentClaim(claim.id, { decision: 'NOT_RECEIVED', by: currentUser.name }), `${claim.customer_name}: ${t('notReceived', 'Not received')}`);
            } else {
              const request = confirm.request;
              run(() => api.decideLoanRequest(request.id, { decision: 'REJECTED', by: currentUser.name }), `${request.customer_name}: ${t('reportStatusRejected', 'Rejected')}`);
            }
          }}
          onNo={() => setConfirm(null)}
        />
      )}
    </div>
  );
};
