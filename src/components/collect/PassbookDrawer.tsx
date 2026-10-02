import React, { useEffect, useState } from 'react';
import { PaymentTransaction } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { Sheet, Spinner } from '../common/ui';

interface PassbookDrawerProps {
  customerId: string;
  customerName: string;
  balance: number;
  dailyDue: number;
  onShowReceipt: (receiptNumber: string) => void;
  onClose: () => void;
}

/** A customer's payments, newest first. Opened from the collection list. */
export const PassbookDrawer: React.FC<PassbookDrawerProps> = ({ customerId, customerName, balance, dailyDue, onShowReceipt, onClose }) => {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<PaymentTransaction[] | null>(null);

  useEffect(() => {
    api.getPayments({ customer_id: customerId }).then(setPayments).catch(() => setPayments([]));
  }, [customerId]);

  return (
    <Sheet title={customerName} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass-card rounded-2xl p-3">
          <div className="text-xs text-slate-400 font-semibold">{t('balance', 'Balance')}</div>
          <div className="text-xl font-black text-gold-300">{formatCurrency(balance)}</div>
        </div>
        <div className="glass-card rounded-2xl p-3">
          <div className="text-xs text-slate-400 font-semibold">{t('dailyPayment', 'Daily payment')}</div>
          <div className="text-xl font-black text-white">{formatCurrency(dailyDue)}</div>
        </div>
      </div>

      {payments === null ? (
        <Spinner />
      ) : payments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">{t('noPaymentsYet', 'No payments yet')}</p>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {payments.map(p => {
            const cancelled = p.status === 'CANCELLED';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onShowReceipt(p.receipt_number)}
                className="w-full flex items-center justify-between py-3 text-left"
              >
                <div>
                  <div className={`text-base font-bold ${cancelled ? 'line-through text-slate-500' : 'text-white'}`}>
                    {formatCurrency(p.amount_paid)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatDate(p.collection_date)} • {t(p.payment_mode, p.payment_mode)}
                  </div>
                </div>
                {cancelled && <span className="text-xs font-bold text-rose-400">{t('cancelled', 'Cancelled')}</span>}
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
};
