import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Receipt as ReceiptIcon } from 'lucide-react';
import { Collector, Customer360Profile, Receipt, User } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { CallButton, EmptyState, ProgressBar, Spinner } from '../common/ui';
import { ReceiptModal } from '../collections/ReceiptModal';

/**
 * The borrower's whole app: how much is paid, what is left, today's status, the collector to call,
 * and every receipt. (Online payment is hidden until a real UPI connection exists; see
 * RazorpayCheckoutModal.tsx, kept for that.)
 */
export const Passbook: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Customer360Profile | null>(null);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [failed, setFailed] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    if (!currentUser.customer_id) {
      setFailed(true);
      return;
    }
    Promise.all([api.getCustomer360(currentUser.customer_id), api.getCollectors()])
      .then(([p, cols]) => {
        setProfile(p);
        setCollectors(cols);
      })
      .catch(() => setFailed(true));
  }, [currentUser.customer_id]);

  if (failed) return <EmptyState icon={ReceiptIcon} text={t('passbookUnavailable', 'Your passbook could not be opened. Please call the office.')} />;
  if (!profile) return <Spinner />;

  const loan = profile.activeAccount ?? profile.latestAccount;
  const running = !!profile.activeAccount;
  const payments = [...profile.recentPayments].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const paidToday = payments.find(p => p.collection_date === todayIso() && p.status !== 'CANCELLED');
  const collector = collectors.find(c => c.id === loan?.assigned_collector_id);

  return (
    <div className="space-y-4 pb-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black text-white">
        {t('hello', 'Hello')}, {profile.personal.full_name}
      </h1>

      {loan ? (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          {running ? (
            <>
              <div>
                <div className="text-sm text-slate-400 font-semibold">{t('balance', 'Balance')}</div>
                <div className="text-5xl font-black text-gold-300">{formatCurrency(loan.remaining_amount)}</div>
              </div>
              <div className="text-base text-slate-200">
                {t('paidSoFar', 'Paid')} <strong className="text-white">{formatCurrency(loan.amount_collected)}</strong> {t('of', 'of')} {formatCurrency(loan.total_repayment)}
              </div>
              <ProgressBar percent={loan.collection_percentage} />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-navy-950 border border-slate-800 p-2">
                  <div className="text-xs text-slate-400">{t('dailyPayment', 'Daily payment')}</div>
                  <div className="text-lg font-black text-white">{formatCurrency(loan.daily_collection)}</div>
                </div>
                <div className="rounded-xl bg-navy-950 border border-slate-800 p-2">
                  <div className="text-xs text-slate-400">{t('daysLeft', 'Days left')}</div>
                  <div className="text-lg font-black text-white">{loan.remaining_days}</div>
                </div>
                <div className="rounded-xl bg-navy-950 border border-slate-800 p-2">
                  <div className="text-xs text-slate-400">{t('lastDay', 'Last day')}</div>
                  <div className="text-sm font-black text-white">{formatDate(loan.expected_end_date)}</div>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-base font-bold border ${
                paidToday ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}>
                {paidToday ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                {paidToday ? `${t('paidToday', 'Paid')} ${formatCurrency(paidToday.amount_paid)} ${t('today', 'today')}` : t('notPaidYetToday', 'Not paid yet today')}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 text-emerald-300 text-lg font-black">
              <CheckCircle2 className="w-8 h-8" />
              {t('loanFullyPaid', 'Loan fully paid. Thank you!')}
            </div>
          )}
        </div>
      ) : (
        <EmptyState icon={ReceiptIcon} text={t('noLoanYet', 'No loan yet')} />
      )}

      {running && collector && (
        <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-400 font-semibold">{t('yourCollector', 'Your collector')}</div>
            <div className="text-lg font-black text-white">{collector.name}</div>
          </div>
          <CallButton phone={collector.mobile} label={t('call', 'Call')} />
        </div>
      )}

      <h2 className="text-lg font-black text-white pt-2">{t('myPayments', 'My payments')}</h2>
      {payments.length === 0 ? (
        <EmptyState icon={ReceiptIcon} text={t('noPaymentsYet', 'No payments yet')} />
      ) : (
        <div className="space-y-2">
          {payments.map(p => {
            const cancelled = p.status === 'CANCELLED';
            const rec = profile.receipts.find(r => r.receipt_number === p.receipt_number);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => rec && setReceipt(rec)}
                className="w-full glass-card rounded-2xl p-3 flex items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className={`text-lg font-black ${cancelled ? 'line-through text-slate-500' : 'text-white'}`}>{formatCurrency(p.amount_paid)}</div>
                  <div className="text-xs text-slate-400">{formatDate(p.collection_date)}</div>
                </div>
                {cancelled ? (
                  <span className="text-xs font-bold text-rose-400">{t('cancelled', 'Cancelled')}</span>
                ) : (
                  <span className="flex items-center gap-1 text-sm font-bold text-gold-400"><ReceiptIcon className="w-4 h-4" />{t('receipt', 'Receipt')}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 text-sm space-y-1">
        <div className="text-xs text-slate-400 font-semibold mb-1">{t('myDetails', 'My details')}</div>
        <div className="text-white font-semibold">{profile.personal.full_name}</div>
        {profile.business?.shop_name && <div className="text-slate-300">{profile.business.shop_name}</div>}
        <div className="text-slate-300">{profile.personal.mobile_number}</div>
      </div>

      {receipt && <ReceiptModal receipt={receipt} customerMobile={profile.personal.mobile_number} onClose={() => setReceipt(null)} />}
    </div>
  );
};
