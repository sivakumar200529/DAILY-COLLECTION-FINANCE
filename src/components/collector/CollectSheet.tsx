import React, { useState } from 'react';
import { ArrowLeft, Banknote, CheckCircle2, Smartphone, X } from 'lucide-react';
import { DailyCollectionRecord } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { upiPayLink, upiQrImage } from '../../utils/upi';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { BigButton, Sheet } from '../common/ui';
import { dayState, quickAmount, withMissedAmount } from '../collect/collectHelpers';

const isUpi = (mode: string) => mode.trim().toLowerCase() === 'upi';

/**
 * Collect from one customer: the amount (filled in; can be changed), then how they paid. Cash saves at once; UPI first shows the business's QR code. "Not paid" is here too.
 */
export const CollectSheet: React.FC<{
  record: DailyCollectionRecord;
  busy: boolean;
  onSave: (amount: number, mode: string) => void;
  onNotPaid: () => void;
  onClose: () => void;
}> = ({ record, busy, onSave, onNotPaid, onClose }) => {
  const { t } = useLanguage();
  const { config } = useConfig();
  const full = withMissedAmount(record);
  const [amount, setAmount] = useState<number>(full);
  const [upiStep, setUpiStep] = useState<string | null>(null);

  const chips = [
    { label: t('todayAmount', 'Today'), value: quickAmount(record) },
    { label: t('withPendingTerms', 'With pending terms'), value: full },
  ].filter((c, i, all) => c.value > 0 && all.findIndex(o => o.value === c.value) === i);

  if (upiStep) {
    const link = upiPayLink(config.company, amount, `${record.customer_name} ${record.collection_account_id}`);
    return (
      <Sheet title={`${record.customer_name}: ${upiStep}`} onClose={onClose}>
        <div className="space-y-4 text-center">
          <div className="text-3xl font-black font-mono text-gold-300">{formatCurrency(amount)}</div>
          {link ? (
            <>
              <div className="p-3 rounded-3xl bg-white w-fit mx-auto">
                <img src={upiQrImage(link)} alt={t('upiQr', 'UPI QR code')} className="w-52 h-52" />
              </div>
              <p className="text-sm text-slate-300">{t('customerScansQr', 'Customer scans this and pays.')}</p>
            </>
          ) : (
            <p className="text-sm text-amber-200 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              {t('upiNotSetUp', 'UPI is not set up yet. Ask the office to add the UPI ID in Settings → Business.')}
            </p>
          )}
          <BigButton
            tone="green"
            icon={CheckCircle2}
            label={`${t('upiReceived', 'UPI received')} ${formatCurrency(amount)}`}
            onClick={() => onSave(amount, upiStep)}
            disabled={busy}
            className="w-full py-4 text-base"
          />
          <button type="button" onClick={() => setUpiStep(null)} className="text-sm text-slate-400 flex items-center gap-1 mx-auto">
            <ArrowLeft className="w-4 h-4" />
            {t('back', 'Back')}
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={`${record.customer_name}: ${t('collect', 'Collect')}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('amount', 'Amount')}</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={record.balance_remaining}
            value={amount || ''}
            onChange={e => setAmount(Math.min(Number(e.target.value) || 0, record.balance_remaining))}
            className="w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-xl font-mono font-black text-2xl text-gold-300 focus:border-gold-500 focus:outline-none"
          />
          {chips.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-2">
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
          )}
        </div>

        <div className={`grid gap-3 ${config.masters.payment_modes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {config.masters.payment_modes.map(mode => (
            <BigButton
              key={mode}
              tone={isUpi(mode) ? 'gold' : 'green'}
              icon={isUpi(mode) ? Smartphone : Banknote}
              label={t(mode, mode)}
              onClick={() => (isUpi(mode) ? setUpiStep(mode) : onSave(amount, mode))}
              disabled={busy || amount <= 0}
              className="py-5 text-lg"
            />
          ))}
        </div>

        {dayState(record) === 'todo' && (
          <button
            type="button"
            onClick={onNotPaid}
            disabled={busy}
            className="w-full px-4 py-3 rounded-2xl border border-rose-500/40 text-rose-300 font-bold flex items-center justify-center gap-2 hover:bg-rose-500/10 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
            {t('notPaid', 'Not paid')}
          </button>
        )}
      </div>
    </Sheet>
  );
};
