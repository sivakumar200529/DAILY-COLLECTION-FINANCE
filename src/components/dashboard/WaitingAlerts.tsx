import React, { useEffect, useState } from 'react';
import { ChevronRight, ClipboardCheck, Inbox, Smartphone } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

/**
 * What is waiting for the office (new-loan requests, UPI payments to check, collector corrections to
 * approve). Shows nothing when all is handled, unless `alwaysShowLoans` keeps New loans (and so the
 * handled requests) reachable, as in Loan Management.
 */
export const WaitingAlerts: React.FC<{
  onOpenLoanRequests: () => void;
  /** The items below are left out where they do not belong. */
  onOpenUpiPayments?: () => void;
  onOpenCollectorReports?: () => void;
  alwaysShowLoans?: boolean;
  /** Change it to count again. */
  refreshKey?: number;
}> = ({ onOpenLoanRequests, onOpenUpiPayments, onOpenCollectorReports, alwaysShowLoans, refreshKey }) => {
  const { t } = useLanguage();
  const [counts, setCounts] = useState({ loans: 0, upi: 0, corrections: 0 });

  useEffect(() => {
    Promise.all([
      api.getLoanRequests('PENDING').catch(() => []),
      api.getPaymentClaims('PENDING').catch(() => []),
      api.getCollectorReports({ status: 'PENDING_APPROVAL' }).catch(() => []),
    ]).then(([loans, upi, corrections]) =>
      setCounts({ loans: loans.length, upi: upi.length, corrections: corrections.length })
    );
  }, [refreshKey]);

  const items = [
    { count: counts.loans, label: t('newLoanRequests', 'New loans'), icon: Inbox, onClick: onOpenLoanRequests, keep: alwaysShowLoans },
    ...(onOpenUpiPayments ? [{ count: counts.upi, label: t('upiPayments', 'UPI payments'), icon: Smartphone, onClick: onOpenUpiPayments }] : []),
    ...(onOpenCollectorReports
      ? [{ count: counts.corrections, label: t('correctionToApprove', 'Correction to approve'), icon: ClipboardCheck, onClick: onOpenCollectorReports }]
      : []),
  ].filter(i => i.count > 0 || ('keep' in i && i.keep));
  if (items.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
      <div className="text-sm font-black text-amber-300 px-1">{t('waitingForYou', 'Waiting for you')}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {items.map(({ count, label, icon: Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="flex items-center gap-2 px-3 py-3 rounded-xl bg-navy-950 border border-slate-700 hover:border-amber-500/60 text-left"
          >
            <Icon className="w-5 h-5 text-amber-300 flex-shrink-0" />
            <span className="text-2xl font-black text-white">{count}</span>
            <span className="text-sm font-bold text-slate-200 flex-1">{label}</span>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        ))}
      </div>
    </div>
  );
};
