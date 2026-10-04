import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  Clock,
  Receipt as ReceiptIcon,
  Smartphone,
  Calendar,
  Download,
  Sparkles,
  Share2,
  ArrowRight,
  ShieldCheck,
  Building,
  User as UserIcon,
} from 'lucide-react';
import { Collector, Customer360Profile, Receipt, User, LoanRequest } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { CallButton, EmptyState, ProgressBar, Spinner, BigButton } from '../common/ui';
import { ReceiptModal } from '../collections/ReceiptModal';
import { RazorpayCheckoutModal } from './RazorpayCheckoutModal';
import { CustomerScheduleCalendar } from './CustomerScheduleCalendar';
import { PassbookStatementPrint } from './PassbookStatementPrint';
import { LoanRenewalRequestModal } from './LoanRenewalRequestModal';
import { receiptMessage, shareOnWhatsApp } from '../../utils/receiptShare';

export const Passbook: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const { config } = useConfig();
  const [profile, setProfile] = useState<Customer360Profile | null>(null);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [failed, setFailed] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Tab switch: 'passbook' (Passbook & Dues) vs 'schedule' (100-Day Calendar Schedule)
  const [activeTab, setActiveTab] = useState<'passbook' | 'schedule'>('passbook');

  // Modals for the 4 core customer capabilities
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [showStatementPrint, setShowStatementPrint] = useState<boolean>(false);
  const [showRenewalModal, setShowRenewalModal] = useState<boolean>(false);
  const [recentRenewalRequest, setRecentRenewalRequest] = useState<LoanRequest | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentUser.customer_id) {
      setFailed(true);
      return;
    }
    try {
      const [p, cols, reqs] = await Promise.all([
        api.getCustomer360(currentUser.customer_id),
        api.getCollectors(),
        api.getCustomerLoanRequests(currentUser.customer_id).catch(() => [] as LoanRequest[]),
      ]);
      setProfile(p);
      setCollectors(cols);
      if (reqs.length > 0) {
        setRecentRenewalRequest(reqs[0]);
      }
    } catch {
      setFailed(true);
    }
  }, [currentUser.customer_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (failed) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        text={t('passbookUnavailable', 'Your passbook could not be opened. Please call the office.')}
      />
    );
  }
  if (!profile) return <Spinner />;

  const loan = profile.activeAccount ?? profile.latestAccount;
  const running = !!profile.activeAccount;
  const payments = [...profile.recentPayments].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const paidToday = payments.find(p => p.collection_date === todayIso() && p.status !== 'CANCELLED');
  const collector = collectors.find(c => c.id === loan?.assigned_collector_id);

  // Eligible for renewal when progress is high (>= 70%) or loan is closed
  const isEligibleForRenewal = !running || (loan && loan.collection_percentage >= 70);

  const handleSharePaymentWhatsApp = (p: typeof payments[0]) => {
    const rec = profile.receipts.find(r => r.receipt_number === p.receipt_number);
    if (!rec) {
      showToast('Receipt details not found.');
      return;
    }
    const msg = receiptMessage(rec, config.company, t);
    shareOnWhatsApp(profile.personal.whatsapp_number || profile.personal.mobile_number, msg);
  };

  return (
    <div className="space-y-4 pb-8 max-w-2xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 p-4 rounded-2xl bg-emerald-500 text-navy-950 font-bold text-xs shadow-2xl animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">
            {t('hello', 'Hello')}, {profile.personal.full_name}
          </h1>
          <p className="text-xs text-slate-400">
            {profile.business?.shop_name || 'Commercial Shop'} &bull; ID: {profile.personal.id}
          </p>
        </div>

        {/* Action Buttons: Print Statement & Apply for Renewal */}
        <div className="flex items-center gap-2">
          {loan && (
            <button
              type="button"
              onClick={() => setShowStatementPrint(true)}
              className="py-2 px-3 rounded-xl bg-navy-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Download official PDF passbook statement"
            >
              <Download className="w-3.5 h-3.5 text-gold-400" />
              <span>Statement (PDF)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowRenewalModal(true)}
            className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-gold-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Apply for Loan</span>
          </button>
        </div>
      </div>

      {/* View Switcher: Passbook & Dues vs 100-Day Calendar Schedule */}
      {loan && (
        <div className="flex bg-navy-950 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('passbook')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'passbook'
                ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ReceiptIcon className="w-4 h-4" />
            <span>Passbook &amp; Payments</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>100-Day Schedule Calendar</span>
          </button>
        </div>
      )}

      {/* TAB 1: PASSBOOK & PAYMENTS */}
      {activeTab === 'passbook' && (
        <div className="space-y-4">
          {loan ? (
            <div className="glass-card rounded-2xl p-5 space-y-4 border border-gold-500/20">
              {running ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm text-slate-400 font-semibold">{t('balance', 'Balance')}</div>
                      <div className="text-4xl sm:text-5xl font-black text-gold-300 font-mono">
                        {formatCurrency(loan.remaining_amount)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Account</span>
                      <span className="font-mono text-xs text-slate-200 font-bold">{loan.id}</span>
                      <span className="text-[10px] text-emerald-400 block mt-0.5">{loan.plan_name}</span>
                    </div>
                  </div>

                  <div className="text-sm sm:text-base text-slate-200">
                    {t('paidSoFar', 'Paid')} <strong className="text-white font-mono">{formatCurrency(loan.amount_collected)}</strong> {t('of', 'of')}{' '}
                    <span className="font-mono">{formatCurrency(loan.total_repayment)}</span>
                  </div>

                  <ProgressBar percent={loan.collection_percentage} />

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-navy-950 border border-slate-800 p-2">
                      <div className="text-[11px] text-slate-400">{t('dailyPayment', 'Daily payment')}</div>
                      <div className="text-base sm:text-lg font-black text-white font-mono">{formatCurrency(loan.daily_collection)}</div>
                    </div>
                    <div className="rounded-xl bg-navy-950 border border-slate-800 p-2">
                      <div className="text-[11px] text-slate-400">{t('daysLeft', 'Days left')}</div>
                      <div className="text-base sm:text-lg font-black text-white">{loan.remaining_days}</div>
                    </div>
                    <div className="rounded-xl bg-navy-950 border border-slate-800 p-2">
                      <div className="text-[11px] text-slate-400">{t('lastDay', 'Last day')}</div>
                      <div className="text-xs sm:text-sm font-black text-white">{formatDate(loan.expected_end_date)}</div>
                    </div>
                  </div>

                  {/* Today's Status Banner */}
                  <div
                    className={`flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-sm font-bold border ${
                      paidToday
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {paidToday ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Clock className="w-5 h-5 text-amber-400" />}
                      <span>
                        {paidToday
                          ? `${t('paidToday', 'Paid')} ${formatCurrency(paidToday.amount_paid)} ${t('today', 'today')}`
                          : t('notPaidYetToday', 'Not paid yet today')}
                      </span>
                    </div>

                    {paidToday && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {paidToday.payment_mode || 'Cash'}
                      </span>
                    )}
                  </div>

                  {/* UPI / QR ONLINE PAYMENT BUTTON */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPayModal(true)}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer group"
                    >
                      <Smartphone className="w-5 h-5 text-blue-200" />
                      <span>Pay Online via UPI / QR (GPay &bull; PhonePe &bull; Paytm)</span>
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 pt-1.5">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Instant Ledger Credit
                      </span>
                      <span>&bull;</span>
                      <span>Zero Extra Charges</span>
                      <span>&bull;</span>
                      <span>Official Digital Receipt</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3 text-center py-4">
                  <div className="flex items-center justify-center gap-3 text-emerald-300 text-xl font-black">
                    <CheckCircle2 className="w-8 h-8" />
                    <span>{t('loanFullyPaid', 'Loan fully paid. Thank you!')}</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Your account has been settled in full. You are eligible for an instant renewal with increased limit!
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRenewalModal(true)}
                    className="py-2.5 px-6 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-gold-500/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Apply for New Loan Now</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <EmptyState icon={ReceiptIcon} text={t('noLoanYet', 'No loan yet')} />
          )}

          {/* Renewal Status Banner if already applied */}
          {recentRenewalRequest && recentRenewalRequest.status === 'PENDING' && (
            <div className="glass-card rounded-2xl p-4 border border-gold-500/30 bg-gold-500/5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-gold-400" />
                <div>
                  <span className="text-xs font-bold text-white block">Loan Renewal Request Under Review</span>
                  <span className="text-[11px] text-slate-300">
                    Requested: <strong className="text-gold-300 font-mono">{formatCurrency(recentRenewalRequest.requested_amount)}</strong> ({recentRenewalRequest.collection_days} days) &bull; Ref: {recentRenewalRequest.id}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/30 uppercase">
                Pending
              </span>
            </div>
          )}

          {/* Assigned Collector Card */}
          {running && collector && (
            <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-400 font-semibold">{t('yourCollector', 'Your collector')}</div>
                <div className="text-lg font-black text-white">{collector.name}</div>
                <div className="text-xs text-slate-400">{accountArea(loan)}</div>
              </div>
              <CallButton phone={collector.mobile} label={t('call', 'Call')} />
            </div>
          )}

          {/* My Payments History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pt-2">
              <h2 className="text-lg font-black text-white">{t('myPayments', 'My payments')}</h2>
              <span className="text-xs text-slate-400 font-semibold">{payments.length} transactions</span>
            </div>

            {payments.length === 0 ? (
              <EmptyState icon={ReceiptIcon} text={t('noPaymentsYet', 'No payments yet')} />
            ) : (
              <div className="space-y-2">
                {payments.map(p => {
                  const cancelled = p.status === 'CANCELLED';
                  const rec = profile.receipts.find(r => r.receipt_number === p.receipt_number);

                  return (
                    <div
                      key={p.id}
                      className="w-full glass-card rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 text-left border border-slate-800 hover:border-slate-700 transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-base sm:text-lg font-black font-mono ${cancelled ? 'line-through text-slate-500' : 'text-white'}`}>
                            {formatCurrency(p.amount_paid)}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-navy-950 border border-slate-800">
                            {p.payment_mode || 'Cash'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {formatDate(p.collection_date)} &bull; {p.receipt_number || 'No receipt'}
                        </div>
                      </div>

                      {cancelled ? (
                        <span className="text-xs font-bold text-rose-400">{t('cancelled', 'Cancelled')}</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {/* Receipt Modal Trigger */}
                          {rec && (
                            <button
                              type="button"
                              onClick={() => setReceipt(rec)}
                              className="py-1.5 px-2.5 rounded-xl bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 font-bold text-xs flex items-center gap-1 border border-gold-500/30 cursor-pointer transition-colors"
                              title="View official receipt"
                            >
                              <ReceiptIcon className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Receipt</span>
                            </button>
                          )}

                          {/* WhatsApp Share Button */}
                          <button
                            type="button"
                            onClick={() => handleSharePaymentWhatsApp(p)}
                            className="py-1.5 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-bold text-xs flex items-center gap-1 border border-emerald-500/30 cursor-pointer transition-colors"
                            title="Share receipt via WhatsApp"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer & Shop Profile Card */}
          <div className="glass-card rounded-2xl p-4 text-xs space-y-2 border border-slate-800">
            <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-gold-400" />
              <span>{t('myDetails', 'My details')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Borrower Name</span>
                <strong className="text-white text-sm">{profile.personal.full_name}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Shop Name</span>
                <strong className="text-white text-sm">{profile.business?.shop_name || 'Commercial Shop'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Registered Mobile</span>
                <span className="font-mono text-slate-200">{profile.personal.mobile_number}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Area / Market</span>
                <span className="text-slate-200">{profile.business?.shop_area || 'Bazaar'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 100-DAY SCHEDULE CALENDAR */}
      {activeTab === 'schedule' && loan && (
        <CustomerScheduleCalendar
          account={loan}
          onSelectReceipt={receiptNumber => {
            const found = profile.receipts.find(r => r.receipt_number === receiptNumber);
            if (found) {
              setReceipt(found);
            } else {
              showToast(`Receipt #${receiptNumber}`);
            }
          }}
        />
      )}

      {/* 1. UPI / QR ONLINE CHECKOUT MODAL */}
      {showPayModal && loan && (
        <RazorpayCheckoutModal
          account={loan}
          profile={profile}
          onClose={() => setShowPayModal(false)}
          onSuccess={async (paymentId, rec) => {
            setShowPayModal(false);
            await loadData();
            showToast(`Payment successful! ID: ${paymentId}`);
            if (rec) setReceipt(rec);
          }}
        />
      )}

      {/* 2. OFFICIAL RECEIPT MODAL */}
      {receipt && (
        <ReceiptModal
          receipt={receipt}
          customerMobile={profile.personal.mobile_number}
          onClose={() => setReceipt(null)}
        />
      )}

      {/* 3. OFFICIAL PASSBOOK STATEMENT PDF / PRINT */}
      {showStatementPrint && loan && (
        <PassbookStatementPrint
          profile={profile}
          account={loan}
          company={config?.company}
          onClose={() => setShowStatementPrint(false)}
        />
      )}

      {/* 4. LOAN RENEWAL / TOP-UP APPLICATION MODAL */}
      {showRenewalModal && (
        <LoanRenewalRequestModal
          profile={profile}
          account={loan ?? null}
          onClose={() => setShowRenewalModal(false)}
          onSuccess={async newReq => {
            setShowRenewalModal(false);
            setRecentRenewalRequest(newReq);
            await loadData();
            showToast('Renewal request submitted! Our office will contact you.');
          }}
        />
      )}
    </div>
  );
};

function accountArea(loan: any): string {
  return loan?.collection_area || 'Market Area';
}
