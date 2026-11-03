import React from 'react';
import { Customer360Profile, CollectionAccount, CompanyProfile } from '../../types';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { printPassbookStatement } from '../../utils/printHelper';
import { loanFigures } from '../../utils/loanFigures';
import { roundMoney } from '../../../shared/finance';
import { Printer, Download, X } from 'lucide-react';

interface PassbookStatementPrintProps {
  profile: Customer360Profile;
  account: CollectionAccount;
  company?: CompanyProfile | null;
  onClose: () => void;
}

export const PassbookStatementPrint: React.FC<PassbookStatementPrintProps> = ({
  profile,
  account,
  company,
  onClose,
}) => {
  const { t } = useLanguage();
  const companyName = company?.company_name || 'DAILY COLLECTION FINANCE';
  const companyAddress = company?.company_address || '';
  const companyPhone = company?.company_phone || '';

  const payments = [...profile.recentPayments]
    .filter(p => p.status !== 'CANCELLED' && (!p.collection_account_id || p.collection_account_id === account.id))
    .sort((a, b) => a.collection_date.localeCompare(b.collection_date) || (a.created_at || '').localeCompare(b.created_at || ''));

  const figures = loanFigures(account);
  const money = (total: number, pending?: number) =>
    `${pending !== undefined ? `${formatCurrency(pending)} / ` : ''}${formatCurrency(total)}`;

  const handlePrint = () => {
    printPassbookStatement(profile, account, company, t);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto print:m-0 print:w-full print:max-w-none print:shadow-none print:rounded-none">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print bg-navy-950 text-white p-4 border-b border-gold-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-gold-400" />
            <span className="font-bold text-sm">Passbook Statement Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="py-1.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Save as PDF / Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 space-y-6 text-xs text-slate-800 font-sans" id="passbook-printable-area">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight uppercase">
                {companyName}
              </h1>
              {companyAddress && <p className="text-xs text-slate-600 mt-0.5">{companyAddress}</p>}
              {companyPhone && <p className="text-xs font-semibold text-slate-700">Helpline: {companyPhone}</p>}
            </div>
            <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
              <span className="inline-block px-2.5 py-1 rounded bg-slate-100 border border-slate-300 font-bold uppercase tracking-wider text-[10px] text-slate-700">
                Official Account Statement
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Generated: {formatDateTime(new Date().toISOString())}</p>
            </div>
          </div>

          {/* Customer & Account Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer Information</span>
              <div className="text-sm font-black text-slate-900">{profile.personal.full_name}</div>
              <div className="text-xs font-semibold text-slate-700">{profile.business?.shop_name || ''}</div>
              <div className="text-xs text-slate-600 font-mono">Mobile: {profile.personal.mobile_number}</div>
              <div className="text-xs text-slate-500">ID: {profile.personal.id} &bull; Area: {account.collection_area}</div>
            </div>

            <div className="space-y-1 sm:text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Loan Account Information</span>
              <div className="text-sm font-black text-navy-900 font-mono">A/C: {account.id}</div>
              <div className="text-xs text-slate-700">Plan: {account.plan_name} ({account.collection_days} Days)</div>
              <div className="text-xs text-slate-600">Period: {formatDate(account.start_date)} &ndash; {formatDate(account.expected_end_date)}</div>
              <div className="text-xs font-bold text-emerald-700">Status: {account.status}</div>
            </div>
          </div>

          {/* The same four figures as the customer's main screen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('totalLoanLabel', 'Total loan')}</span>
              <span className="text-base font-black text-slate-900 font-mono"><span className="text-blue-900">{formatCurrency(figures.total)}</span></span>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('principal', 'Principal')}</span>
              <span className="text-base font-black text-slate-900 font-mono">{money(figures.principal, figures.pending?.principal)}</span>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('interest', 'Interest')}</span>
              <span className="text-base font-black text-slate-900 font-mono">{money(figures.interest, figures.pending?.interest)}</span>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('terms', 'Terms')}</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {figures.terms.pending} / {figures.terms.total} |{' '}
                <span className="text-rose-700">{figures.terms.missed}</span> /{' '}
                <span className="text-emerald-700">{figures.terms.advance}</span>
              </span>
              <span className="text-[9px] text-slate-500 block">{t('termsLegend', 'pending/total | missed/advance')}</span>
            </div>
          </div>

          {/* Chronological Payment Transactions Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Payment Transaction Ledger ({payments.length} Payments Recorded)
            </h3>
            
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Collection Date</th>
                    <th className="py-2 px-3">Receipt No</th>
                    <th className="py-2 px-3">Mode</th>
                    <th className="py-2 px-3 text-right">Amount Paid</th>
                    <th className="py-2 px-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-500">
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p, idx) => {
                      // Worked out from the payments in date order (a stored balance goes stale when an earlier payment changes).
                      const runBal = Math.max(0, roundMoney(account.total_repayment - payments.slice(0, idx + 1).reduce((s, item) => s + item.amount_paid, 0)));

                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{formatDate(p.collection_date)}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.receipt_number || '-'}</td>
                          <td className="py-2 px-3 text-slate-600">{p.payment_mode || 'Cash'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(p.amount_paid)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(runBal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statement Footer with Signatures */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-6 text-[10px] text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">Daily Collection Financial Record</p>
              <p>This is a computer-verified passbook statement generated directly from the DAILY COLLECTION system.</p>
              <p>For discrepancies, please reach out to your assigned collector or call the office hotline.</p>
            </div>
            <div className="sm:text-right space-y-1">
              <div className="font-bold text-slate-900 text-xs">{companyName}</div>
              <p className="italic">Authorized System Seal & Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
