import React, { useState } from 'react';
import { Check, CheckCircle2, Copy, Smartphone } from 'lucide-react';
import { CollectionAccount, Collector } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { upiPayLink, upiQrImage } from '../../utils/upi';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { BigButton, CallButton, Sheet } from '../common/ui';

const inputClass =
  'w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-xl text-white text-base focus:border-gold-500 focus:outline-none';

/**
 * Pay by UPI to the business's UPI ID. The app cannot see the bank account, so nothing is
 * added to the loan here: "I have paid" tells the office, who records it after checking.
 */
export const PayLoanSheet: React.FC<{
  customerId: string;
  customerName: string;
  loan: CollectionAccount;
  collector?: Collector;
  onClose: () => void;
}> = ({ customerId, customerName, loan, collector, onClose }) => {
  const { t } = useLanguage();
  const { config } = useConfig();
  const todayDue = Math.min(loan.daily_collection, loan.remaining_amount);
  const [amount, setAmount] = useState<number>(todayDue);
  const [reference, setReference] = useState('');
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = amount > 0 ? upiPayLink(config.company, amount, `${customerName} ${loan.id}`) : null;
  const upiId = config.company.upi_id?.trim() || '';

  if (!upiId) {
    return (
      <Sheet title={t('payment', 'Payment')} onClose={onClose}>
        <p className="text-base text-slate-200 mb-4">
          {t('upiNotReady', 'Online payment is not ready yet. Please pay your collector.')}
        </p>
        {collector && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-navy-950 border border-slate-800">
            <div className="text-base font-bold text-white">{collector.name}</div>
            <CallButton phone={collector.mobile} label={t('call', 'Call')} />
          </div>
        )}
      </Sheet>
    );
  }

  if (sent) {
    return (
      <Sheet title={t('payment', 'Payment')} onClose={onClose}>
        <div className="text-center space-y-3 py-2">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
          <p className="text-lg font-black text-white">{t('paymentClaimSent', 'Message sent to the office')}</p>
          <p className="text-sm text-slate-300">
            {t('paymentClaimNext', 'Your payment will show in the passbook after the office checks it.')}
          </p>
          <BigButton tone="gold" label={t('done', 'Done')} onClick={onClose} className="w-full" />
        </div>
      </Sheet>
    );
  }

  const chips = [
    { label: t('todayAmount', 'Today'), value: todayDue },
    { label: t('balance', 'Balance'), value: loan.remaining_amount },
  ].filter((c, i, all) => c.value > 0 && all.findIndex(o => o.value === c.value) === i);

  const sendClaim = async () => {
    setSending(true);
    setError(null);
    try {
      await api.claimUpiPayment({ customer_id: customerId, amount, upi_reference: reference.trim() || undefined });
      setSent(true);
    } catch (err: any) {
      setError(err.message || t('somethingWentWrong', 'Something went wrong. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet title={t('payment', 'Payment')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('amountToPay', 'Amount to pay')}</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={loan.remaining_amount}
            value={amount || ''}
            onChange={e => setAmount(Math.min(Number(e.target.value) || 0, loan.remaining_amount))}
            className={`${inputClass} font-mono font-black text-2xl text-gold-300`}
          />
          <div className="flex gap-2 mt-2">
            {chips.map(c => (
              <button
                key={c.label}
                type="button"
                onClick={() => setAmount(c.value)}
                className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                  amount === c.value ? 'bg-gold-500 text-navy-950 border-gold-500' : 'bg-navy-950 text-slate-200 border-slate-700'
                }`}
              >
                {c.label} {formatCurrency(c.value)}
              </button>
            ))}
          </div>
        </div>

        {link && (
          <>
            <div className="p-3 rounded-3xl bg-white w-fit mx-auto">
              <img src={upiQrImage(link)} alt={t('upiQr', 'UPI QR code')} className="w-52 h-52" />
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-navy-950 border border-slate-800">
              <div className="min-w-0">
                <div className="text-xs text-slate-400">{t('upiId', 'UPI ID')}</div>
                <div className="text-sm font-mono font-bold text-emerald-400 truncate">{upiId}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(upiId);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 text-sm font-bold text-slate-200"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? t('copied', 'Copied') : t('copy', 'Copy')}
              </button>
            </div>
            <a
              href={link}
              className="w-full px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <Smartphone className="w-5 h-5" />
              {t('openUpiApp', 'Open UPI app')}
            </a>
          </>
        )}

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <p className="text-sm text-slate-300">{t('afterPayingTell', 'After paying, tell the office here:')}</p>
          <input
            type="text"
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder={t('upiRefOptional', 'UPI reference number (optional)')}
            className={inputClass}
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <BigButton
            tone="gold"
            icon={CheckCircle2}
            label={sending ? t('sending', 'Sending...') : `${t('iHavePaid', 'I have paid')} ${formatCurrency(amount)}`}
            onClick={sendClaim}
            disabled={sending || amount <= 0}
            className="w-full"
          />
        </div>
      </div>
    </Sheet>
  );
};
