import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, IndianRupee, PlusCircle, Receipt as ReceiptIcon } from 'lucide-react';
import { Collector, Customer360Profile, LoanRequest, User } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { CallButton, EmptyState, Spinner } from '../common/ui';
import { CustomerPassbookView } from './CustomerPassbookView';
import { PayLoanSheet } from './PayLoanSheet';
import { CustomerSettingsSheet } from './CustomerSettingsSheet';
import { LoanRenewalRequestModal } from './LoanRenewalRequestModal';
import { LoanFiguresView } from './LoanFigures';

/** The customer's only screen: loan figures, today's status, collector, and three actions. */
export const CustomerHome: React.FC<{
  currentUser: User;
  settingsOpen: boolean;
  onCloseSettings: () => void;
  onLogout: () => void;
}> = ({ currentUser, settingsOpen, onCloseSettings, onLogout }) => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Customer360Profile | null>(null);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'home' | 'passbook'>('home');
  const [paying, setPaying] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
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
      setRequests(reqs);
    } catch {
      setFailed(true);
    }
  }, [currentUser.customer_id]);

  useEffect(() => {
    load();
  }, [load]);

  const settings = settingsOpen && (
    <CustomerSettingsSheet profile={profile} onLogout={onLogout} onClose={onCloseSettings} />
  );

  if (failed) {
    return (
      <>
        <EmptyState icon={ReceiptIcon} text={t('passbookUnavailable', 'Your passbook could not be opened. Please call the office.')} />
        {settings}
      </>
    );
  }
  if (!profile) {
    return (
      <>
        <Spinner />
        {settings}
      </>
    );
  }

  const loan = profile.activeAccount ?? profile.latestAccount;
  const running = !!profile.activeAccount;
  const collector = collectors.find(c => c.id === loan?.assigned_collector_id);

  if (view === 'passbook') {
    return (
      <div className="max-w-2xl mx-auto pb-8">
        <CustomerPassbookView profile={profile} loan={loan} onBack={() => setView('home')} />
        {settings}
      </div>
    );
  }

  const today = todayIso();
  const paidToday = profile.recentPayments
    .filter(p => p.collection_account_id === loan?.id && p.collection_date === today && p.status !== 'CANCELLED')
    .reduce((sum, p) => sum + p.amount_paid, 0);
  const pendingRequest = requests.find(r => r.status === 'PENDING');

  const actionButton = (label: string, Icon: typeof BookOpen, onClick: () => void, primary = false, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1.5 px-2 py-4 rounded-2xl font-bold text-sm text-center leading-tight transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
        primary
          ? 'bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 shadow-md shadow-gold-500/20'
          : 'bg-navy-900 border border-slate-700 text-slate-100 hover:border-gold-500/60'
      }`}
    >
      <Icon className="w-6 h-6" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-black text-white">
          {t('hello', 'Hello')}, {profile.personal.full_name}
        </h1>
        {profile.business?.shop_name && <p className="text-sm text-slate-400">{profile.business.shop_name}</p>}
      </div>

      {loan ? (
        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-gold-500/20">
          <LoanFiguresView loan={loan} layout="list" />

          {running && (
            <div
              className={`mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-base font-bold border ${
                paidToday > 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}
            >
              {paidToday > 0 ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              <span>
                {t('today', 'Today')}:{' '}
                {paidToday > 0 ? `${t('paidToday', 'Paid')} ${formatCurrency(paidToday)}` : t('notPaidYet', 'Not paid yet')}
              </span>
            </div>
          )}
          {!running && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-base font-bold border bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
              <CheckCircle2 className="w-5 h-5" />
              <span>{t('loanFullyPaid', 'Loan fully paid. Thank you!')}</span>
            </div>
          )}

          {collector && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-400">{t('collector', 'Collector')}</div>
                <div className="text-base font-bold text-white">{collector.name}</div>
              </div>
              <CallButton phone={collector.mobile} label={t('call', 'Call')} />
            </div>
          )}
        </div>
      ) : (
        <EmptyState icon={ReceiptIcon} text={t('noRunningLoan', 'No running loan')} />
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {actionButton(t('navPassbook', 'Passbook'), BookOpen, () => setView('passbook'))}
        {actionButton(t('payment', 'Payment'), IndianRupee, () => setPaying(true), true, !running)}
        {actionButton(t('applyNewLoan', 'Apply for New Loan'), PlusCircle, () => setApplying(true))}
      </div>

      {pendingRequest && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gold-500/5 border border-gold-500/30 text-sm text-slate-200">
          <Clock className="w-4 h-4 text-gold-400 flex-shrink-0" />
          <span>
            {t('loanRequestWaiting', 'New loan request waiting for the office')}: {formatCurrency(pendingRequest.requested_amount)}
          </span>
        </div>
      )}

      {paying && loan && running && (
        <PayLoanSheet
          customerId={profile.personal.id}
          customerName={profile.personal.full_name}
          loan={loan}
          collector={collector}
          onClose={() => setPaying(false)}
        />
      )}
      {applying && (
        <LoanRenewalRequestModal
          profile={profile}
          account={loan ?? null}
          onClose={() => setApplying(false)}
          onSuccess={async () => {
            setApplying(false);
            await load();
          }}
        />
      )}
      {settings}
    </div>
  );
};
