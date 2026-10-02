import React from 'react';
import { CheckCircle2, MessageCircle, Receipt as ReceiptIcon, RotateCcw, ArrowRight } from 'lucide-react';
import { Receipt } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { receiptMessage, shareOnWhatsApp } from '../../utils/receiptShare';
import { BigButton, Sheet } from '../common/ui';

interface PaymentDoneSheetProps {
  receipt: Receipt;
  customerMobile?: string;
  busy: boolean;
  onShowReceipt: () => void;
  onUndo: () => void;
  onClose: () => void;
}

/** Shown right after a payment is saved: clear confirmation, share the receipt, or undo. */
export const PaymentDoneSheet: React.FC<PaymentDoneSheetProps> = ({ receipt, customerMobile, busy, onShowReceipt, onUndo, onClose }) => {
  const { t } = useLanguage();
  const { company } = useConfig().config;

  return (
    <Sheet title={t('paymentSaved', 'Payment saved')} onClose={onClose}>
      <div className="text-center mb-5">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
        <div className="text-4xl font-black text-white mt-2">{formatCurrency(receipt.amount_paid)}</div>
        <div className="text-base text-slate-300 mt-1">{receipt.customer_name}</div>
        <div className="text-sm text-slate-400 mt-1">
          {t('balance', 'Balance')}: <strong className="text-slate-200">{formatCurrency(receipt.remaining_balance)}</strong>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <BigButton
          tone="green"
          icon={MessageCircle}
          label="WhatsApp"
          onClick={() => shareOnWhatsApp(customerMobile, receiptMessage(receipt, company, t))}
        />
        <BigButton icon={ReceiptIcon} label={t('receipt', 'Receipt')} onClick={onShowReceipt} />
        <BigButton icon={RotateCcw} label={t('undo', 'Undo')} onClick={onUndo} disabled={busy} />
        <BigButton tone="gold" icon={ArrowRight} label={t('nextCustomer', 'Next')} onClick={onClose} />
      </div>
    </Sheet>
  );
};
