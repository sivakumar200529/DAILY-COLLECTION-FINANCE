import React from 'react';
import { MessageCircle, Printer, X } from 'lucide-react';
import { Receipt } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { receiptMessage, shareOnWhatsApp } from '../../utils/receiptShare';
import { printReceiptSlip } from '../../utils/printHelper';

interface ReceiptModalProps {
  receipt: Receipt | null;
  customerMobile?: string;
  onClose: () => void;
}

/** One receipt layout (narrow slip that also reads well on a phone) with WhatsApp / Print / Close. */
export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, customerMobile, onClose }) => {
  const { t } = useLanguage();
  const { company } = useConfig().config;
  if (!receipt) return null;
  const cancelled = receipt.status === 'CANCELLED';

  const handlePrint = () => {
    printReceiptSlip(receipt, company, t);
  };

  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-slate-600">{label}</span>
      <span className={strong ? 'font-black text-slate-950' : 'font-semibold text-slate-900'}>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-950/85 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('receipt', 'Receipt')}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-navy-900 border border-gold-500/40 rounded-t-3xl sm:rounded-2xl p-5 max-h-[94vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex justify-end no-print">
          <button onClick={onClose} aria-label={t('close', 'Close')} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="receipt-print relative bg-white text-slate-900 rounded-xl p-4 font-mono text-[13px] leading-snug shadow-md">
          <div className="text-center pb-2 border-b border-dashed border-slate-400">
            <div className="font-sans font-black text-base text-slate-950">{company.company_name}</div>
            {company.company_address && <div className="text-[11px]">{company.company_address}</div>}
            {company.company_phone && <div className="text-[11px]">{t('phone', 'Phone')}: {company.company_phone}</div>}
          </div>

          <div className="py-2 border-b border-dashed border-slate-400">
            {row(t('receiptNo', 'Receipt No'), receipt.receipt_number)}
            {row(t('date', 'Date'), formatDateTime(receipt.created_at))}
            {row(t('customer', 'Customer'), receipt.customer_name)}
            {receipt.shop_name && row(t('shop', 'Shop'), receipt.shop_name)}
          </div>

          <div className="py-3 text-center border-b border-dashed border-slate-400">
            <div className="text-[11px] text-slate-600 font-sans">{t('paidToday', 'Paid')}</div>
            <div className="text-3xl font-black text-slate-950 font-sans">{formatCurrency(receipt.amount_paid)}</div>
            <div className="text-[11px] font-sans">{t(receipt.payment_mode, receipt.payment_mode)}</div>
          </div>

          <div className="py-2">
            {row(t('balance', 'Balance'), formatCurrency(receipt.remaining_balance), true)}
            {row(t('collectedBy', 'Collected by'), receipt.collector_name)}
          </div>

          {cancelled && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="border-4 border-rose-600 text-rose-600 font-sans font-black text-2xl px-4 py-1 rounded-lg -rotate-12 bg-white/80">
                {t('cancelled', 'CANCELLED')}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 no-print">
          <button
            type="button"
            onClick={() => shareOnWhatsApp(customerMobile, receiptMessage(receipt, company, t))}
            disabled={cancelled}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <MessageCircle className="w-5 h-5" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 rounded-2xl py-3 font-bold text-sm flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" />
            {t('print', 'Print')}
          </button>
        </div>
      </div>
    </div>
  );
};
