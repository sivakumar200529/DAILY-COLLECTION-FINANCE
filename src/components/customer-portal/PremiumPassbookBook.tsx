import React, { useState } from 'react';
import { Customer360Profile, CollectionAccount, PaymentTransaction } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { LoanFiguresView } from './LoanFigures';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Printer,
  CheckCircle2,
  Edit3,
  Receipt as ReceiptIcon,
} from 'lucide-react';

interface PremiumPassbookBookProps {
  profile: Customer360Profile;
  account: CollectionAccount;
  isAdmin: boolean;
  onEditPayment?: (payment: PaymentTransaction) => void;
  onShowReceipt: (payment: PaymentTransaction) => void;
  onPrintStatement?: () => void;
}

export const PremiumPassbookBook: React.FC<PremiumPassbookBookProps> = ({
  profile,
  account,
  isAdmin,
  onEditPayment,
  onShowReceipt,
  onPrintStatement,
}) => {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const entriesPerPage = 10;

  // Sort payments chronologically from first payment to latest for passbook ledger flow
  const allPayments = [...profile.recentPayments]
    .filter(p => p.collection_account_id === account.id)
    .sort((a, b) => a.collection_date.localeCompare(b.collection_date) || a.created_at.localeCompare(b.created_at));

  const totalPages = Math.max(1, Math.ceil(allPayments.length / entriesPerPage));
  const currentEntries = allPayments.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  return (
    <div className="space-y-4 max-w-4xl mx-auto font-sans select-none">
      
      {/* PASSBOOK COVER & BINDING WRAPPER */}
      <div className="relative rounded-3xl bg-gradient-to-b from-[#0d1627] via-[#09101d] to-[#040810] p-3 sm:p-6 border-2 border-gold-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
        
        {/* Gold ornamental corner flourishes */}
        <div className="absolute top-2 left-2 text-gold-500/30 text-xs font-serif select-none pointer-events-none">⚜</div>
        <div className="absolute top-2 right-2 text-gold-500/30 text-xs font-serif select-none pointer-events-none">⚜</div>
        <div className="absolute bottom-2 left-2 text-gold-500/30 text-xs font-serif select-none pointer-events-none">⚜</div>
        <div className="absolute bottom-2 right-2 text-gold-500/30 text-xs font-serif select-none pointer-events-none">⚜</div>

        {/* Outer Stitched Border */}
        <div className="rounded-2xl border border-gold-500/30 p-4 sm:p-6 bg-gradient-to-b from-[#131f37]/90 to-[#0b1324]/90 backdrop-blur-sm relative space-y-5">
          
          {/* Same four figures as the customer's main screen */}
          <LoanFiguresView loan={account} layout="grid" />

          {/* PHYSICAL PASSBOOK LEDGER PAGES CONTAINER */}
          <div className="bg-[#fcfaf5] text-slate-900 rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.15)] border-2 border-[#e3d8c2] overflow-hidden">
            
            {/* Top Passbook Binder Strip */}
            <div className="bg-[#ece3ce] px-4 py-2 border-b border-[#dacbb0] flex items-center justify-between text-xs font-serif text-[#685536]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#8a7248]" />
                <span className="font-bold tracking-wider uppercase">DOORSTEP REPAYMENT LEDGER • பக்கம் {currentPage}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold">
                <span>Start: {formatDate(account.start_date)}</span>
                <span>&bull;</span>
                <span>End: {formatDate(account.expected_end_date)}</span>
              </div>
            </div>

            {/* Passbook Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-[#f4ecdb] text-[#554326] border-b border-[#dfd1b5] text-[11px] uppercase tracking-wider font-bold">
                    <th className="py-2.5 px-3 border-r border-[#dfd1b5] text-center w-12">#</th>
                    <th className="py-2.5 px-3 border-r border-[#dfd1b5]">{t('date', 'Date')}</th>
                    <th className="py-2.5 px-3 border-r border-[#dfd1b5]">{t('receipt', 'Receipt #')}</th>
                    <th className="py-2.5 px-3 border-r border-[#dfd1b5] text-center">{t('mode', 'Mode')}</th>
                    <th className="py-2.5 px-3 border-r border-[#dfd1b5] text-right">{t('due', 'Due (₹)')}</th>
                    <th className="py-2.5 px-3 border-r border-[#dfd1b5] text-right font-bold text-emerald-800">{t('amountPaid', 'Credit (₹)')}</th>
                    <th className="py-2.5 px-3 border-r border-[#dfd1b5] text-right font-bold text-[#7a2020]">{t('balance', 'Balance (₹)')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status', 'Official Seal & Stamp')}</th>
                    {isAdmin && <th className="py-2.5 px-2 text-center w-16 bg-[#ebdfc6]">{t('edit', 'Modify')}</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#e9ddc4] text-[11px]">
                  {currentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 8} className="py-12 text-center text-[#8a785d] font-sans">
                        {t('noPaymentsYet', 'No payments recorded in passbook yet.')}
                      </td>
                    </tr>
                  ) : (
                    currentEntries.map((p, idx) => {
                      const entryNum = (currentPage - 1) * entriesPerPage + idx + 1;
                      const cancelled = p.status === 'CANCELLED';

                      return (
                        <tr key={p.id} className={`hover:bg-[#f6f0e2] transition-colors ${cancelled ? 'bg-rose-50/60' : ''}`}>
                          {/* Entry Line Number */}
                          <td className="py-2 px-3 border-r border-[#e9ddc4] text-center font-bold text-[#8a785d]">
                            {String(entryNum).padStart(2, '0')}
                          </td>

                          {/* Collection Date */}
                          <td className="py-2 px-3 border-r border-[#e9ddc4] font-bold text-slate-800 whitespace-nowrap">
                            {formatDate(p.collection_date)}
                          </td>

                          {/* Receipt Number with View Button */}
                          <td className="py-2 px-3 border-r border-[#e9ddc4] whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onShowReceipt(p)}
                              className="text-blue-700 hover:text-blue-900 underline font-semibold flex items-center gap-1 cursor-pointer"
                              title="Click to view digital receipt"
                            >
                              <ReceiptIcon className="w-3 h-3 flex-shrink-0" />
                              <span>{p.receipt_number}</span>
                            </button>
                          </td>

                          {/* Payment Mode */}
                          <td className="py-2 px-3 border-r border-[#e9ddc4] text-center font-sans font-semibold text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-[#ebdfc6] text-[#4d3c22]">
                              {t(p.payment_mode, p.payment_mode)}
                            </span>
                          </td>

                          {/* Daily Due */}
                          <td className="py-2 px-3 border-r border-[#e9ddc4] text-right text-slate-600">
                            {p.daily_due || account.daily_collection}
                          </td>

                          {/* Amount Paid / Credit */}
                          <td className={`py-2 px-3 border-r border-[#e9ddc4] text-right font-black ${
                            cancelled ? 'line-through text-slate-400' : 'text-emerald-800'
                          }`}>
                            {formatCurrency(p.amount_paid)}
                          </td>

                          {/* Remaining Balance */}
                          <td className="py-2 px-3 border-r border-[#e9ddc4] text-right font-bold text-[#6d2020]">
                            {formatCurrency(p.remaining_balance)}
                          </td>

                          {/* Authentic Stamp & Signature */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {cancelled ? (
                              <span className="inline-block px-2 py-0.5 rounded border border-rose-600 text-rose-700 font-bold text-[9px] uppercase tracking-wider rotate-[-3deg]">
                                CANCELLED / ரத்து
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-600 text-emerald-800 bg-emerald-100/60 font-bold text-[9px] tracking-tight">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                <span>PAID &bull; {p.collector_name ? t(p.collector_name, p.collector_name) : 'VERIFIED'}</span>
                              </div>
                            )}
                          </td>

                          {/* Admin Only: Modify Button */}
                          {isAdmin && (
                            <td className="py-2 px-2 text-center bg-[#f2e7d1] whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => onEditPayment && onEditPayment(p)}
                                className="p-1 rounded bg-[#dfcfaf] hover:bg-gold-500 hover:text-navy-950 text-slate-800 transition-colors cursor-pointer"
                                title="Admin: Modify amount, date or details of this payment"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Passbook Ledger Footer with Page Controls & Official Seal */}
            <div className="bg-[#ece3ce] px-4 py-3 border-t border-[#dacbb0] flex items-center justify-center gap-3 text-xs font-serif text-[#554326]">
              
              {/* Turn Page Navigation */}
              <div className="flex items-center gap-2 font-mono">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded-lg bg-[#ded0b6] hover:bg-[#cfc0a2] disabled:opacity-40 text-slate-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev Page</span>
                </button>

                <span className="px-3 py-1 font-bold text-xs text-[#413117]">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded-lg bg-[#ded0b6] hover:bg-[#cfc0a2] disabled:opacity-40 text-slate-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Next Page</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

          </div>

          {onPrintStatement && (
            <div className="flex justify-end pt-2 text-xs">
              <button
                type="button"
                onClick={onPrintStatement}
                className="py-2.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-gold-500/20"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t('print', 'Print Passbook Statement')}</span>
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
