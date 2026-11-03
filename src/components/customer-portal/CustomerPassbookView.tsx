import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Download, Edit3, List, Receipt as ReceiptIcon, RotateCcw } from 'lucide-react';
import { CollectionAccount, Customer360Profile, PaymentTransaction, Receipt } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { EmptyState } from '../common/ui';
import { ReceiptModal } from '../collections/ReceiptModal';
import { PremiumPassbookBook } from './PremiumPassbookBook';
import { PassbookStatementPrint } from './PassbookStatementPrint';

type PassbookMode = 'simple' | 'book';
const MODE_KEY = 'krs_passbook_mode';

function savedMode(): PassbookMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'book' ? 'book' : 'simple';
  } catch {
    return 'simple';
  }
}

/**
 * The passbook: a simple list of receipts, or the book view (the choice is remembered), with the PDF
 * statement. Customers see it behind Back; the office's customer page adds Modify and Undo.
 */
export const CustomerPassbookView: React.FC<{
  profile: Customer360Profile;
  loan?: CollectionAccount;
  onBack?: () => void;
  office?: {
    onModify: (payment: PaymentTransaction) => void;
    onUndo: (payment: PaymentTransaction) => void;
  };
}> = ({ profile, loan, onBack, office }) => {
  const { t } = useLanguage();
  const { config } = useConfig();
  const [mode, setModeState] = useState<PassbookMode>(savedMode);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [printing, setPrinting] = useState(false);

  const setMode = (next: PassbookMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Remembering the choice is only a convenience.
    }
  };

  const payments = [...profile.recentPayments].sort(
    (a, b) => b.collection_date.localeCompare(a.collection_date) || b.created_at.localeCompare(a.created_at)
  );
  const receiptFor = (receiptNumber?: string) => profile.receipts.find(r => r.receipt_number === receiptNumber);

  const modeButton = (value: PassbookMode, Icon: typeof List, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={`px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 ${
        mode === value ? 'bg-gold-500 text-navy-950' : 'text-slate-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-2 py-2 rounded-xl text-slate-200 hover:bg-slate-800 font-bold"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-lg">{t('navPassbook', 'Passbook')}</span>
          </button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {loan && (
            <button
              type="button"
              onClick={() => setPrinting(true)}
              className="px-3 py-2 rounded-xl bg-navy-900 border border-slate-700 text-slate-200 text-sm font-bold flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-gold-400" />
              <span>PDF</span>
            </button>
          )}
          <div className="flex p-1 rounded-2xl bg-navy-950 border border-slate-800">
            {modeButton('simple', List, t('passbookSimple', 'Simple'))}
            {modeButton('book', BookOpen, t('passbookBook', 'Book'))}
          </div>
        </div>
      </div>

      {mode === 'book' && loan ? (
        <PremiumPassbookBook
          profile={profile}
          account={loan}
          isAdmin={!!office}
          onEditPayment={office?.onModify}
          onShowReceipt={p => {
            const rec = receiptFor(p.receipt_number);
            if (rec) setReceipt(rec);
          }}
        />
      ) : payments.length === 0 ? (
        <EmptyState icon={ReceiptIcon} text={t('noPaymentsYet', 'No payments yet')} />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                <th className="py-2.5 pl-3 pr-1 font-semibold">{t('amountPaid', 'Amount paid')}</th>
                <th className="py-2.5 px-1 font-semibold">{t('date', 'Date')}</th>
                <th className="py-2.5 px-1 font-semibold">{t('mode', 'Mode')}</th>
                <th className="py-2.5 px-1 font-semibold">{t('collector', 'Collector')}</th>
                <th className="py-2.5 pl-1 pr-3 font-semibold text-center">{t('receipt', 'Receipt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {payments.map(p => {
                const cancelled = p.status === 'CANCELLED';
                const rec = receiptFor(p.receipt_number);
                return (
                  <tr key={p.id} className={cancelled ? 'text-slate-500' : 'text-slate-200'}>
                    <td className={`py-2.5 pl-3 pr-1 font-mono font-black whitespace-nowrap ${cancelled ? 'line-through' : 'text-white'}`}>
                      {formatCurrency(p.amount_paid)}
                    </td>
                    <td className="py-2.5 px-1">{formatDate(p.collection_date)}</td>
                    <td className="py-2.5 px-1">{t(p.payment_mode || 'Cash', p.payment_mode || 'Cash')}</td>
                    <td className="py-2.5 px-1">{p.collector_name ? t(p.collector_name, p.collector_name) : '-'}</td>
                    <td className="py-2 pl-1 pr-3 text-center whitespace-nowrap">
                      {rec ? (
                        <button
                          type="button"
                          onClick={() => setReceipt(rec)}
                          aria-label={`${t('receipt', 'Receipt')} ${rec.receipt_number}`}
                          title={rec.receipt_number}
                          className="p-2 rounded-xl bg-gold-500/10 border border-gold-500/30 text-gold-300"
                        >
                          <ReceiptIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        '-'
                      )}
                      {office && !cancelled && (
                        <>
                          <button
                            type="button"
                            onClick={() => office.onModify(p)}
                            aria-label={t('edit', 'Modify')}
                            title={t('edit', 'Modify')}
                            className="p-2 ml-1.5 rounded-xl bg-navy-900 border border-slate-700 text-gold-300"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => office.onUndo(p)}
                            aria-label={t('undo', 'Undo')}
                            title={t('undo', 'Undo')}
                            className="p-2 ml-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-rose-300"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {receipt && <ReceiptModal receipt={receipt} customerMobile={profile.personal.mobile_number} onClose={() => setReceipt(null)} />}
      {printing && loan && (
        <PassbookStatementPrint profile={profile} account={loan} company={config.company} onClose={() => setPrinting(false)} />
      )}
    </div>
  );
};
