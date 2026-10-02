import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { DailyCollectionRecord } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { BigButton, Sheet } from '../common/ui';
import { quickAmount, withMissedAmount } from './collectHelpers';

interface OtherAmountSheetProps {
  record: DailyCollectionRecord;
  busy: boolean;
  onSave: (amount: number, paymentMode: string) => void;
  onClose: () => void;
}

/** For a payment that is not exactly today's amount: quick choices, a number, and how it was paid. */
export const OtherAmountSheet: React.FC<OtherAmountSheetProps> = ({ record, busy, onSave, onClose }) => {
  const { t } = useLanguage();
  const { payment_modes: modes, default_payment_mode: defaultMode } = useConfig().config.masters;
  const [amount, setAmount] = useState<string>(String(quickAmount(record)));
  const [mode, setMode] = useState<string>(modes.includes(defaultMode) ? defaultMode : modes[0] ?? '');

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= record.balance_remaining;

  const choices: { label: string; value: number }[] = [
    { label: t('todayDue', 'Today'), value: quickAmount(record) },
  ];
  if ((record.missed_days_count || 0) > 0) {
    choices.push({ label: t('todayPlusMissed', 'Today + missed'), value: withMissedAmount(record) });
  }
  choices.push({ label: t('fullBalance', 'Full balance'), value: record.balance_remaining });

  return (
    <Sheet title={`${t('amountFrom', 'Amount from')} ${record.customer_name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-2">
          {choices.map(choice => (
            <button
              key={choice.label}
              type="button"
              onClick={() => setAmount(String(choice.value))}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-base font-bold ${
                value === choice.value ? 'bg-gold-500/20 border-gold-500 text-gold-300' : 'bg-navy-950 border-slate-700 text-slate-200'
              }`}
            >
              <span>{choice.label}</span>
              <span>{formatCurrency(choice.value)}</span>
            </button>
          ))}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">{t('orTypeAmount', 'Or type the amount')}</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">₹</span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={record.balance_remaining}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-3xl font-black text-white focus:border-gold-500 focus:outline-none"
            />
          </div>
          {!valid && amount !== '' && (
            <p className="text-sm text-rose-300 mt-1">
              {value > record.balance_remaining
                ? `${t('moreThanBalance', 'More than the balance')} (${formatCurrency(record.balance_remaining)})`
                : t('enterAmount', 'Enter an amount')}
            </p>
          )}
        </div>

        {modes.length > 1 && (
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">{t('paidBy', 'Paid by')}</label>
            <div className="flex flex-wrap gap-2">
              {modes.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-5 py-3 rounded-2xl border text-base font-bold ${
                    mode === m ? 'bg-gold-500 border-gold-500 text-navy-950' : 'bg-navy-950 border-slate-700 text-slate-200'
                  }`}
                >
                  {t(m, m)}
                </button>
              ))}
            </div>
          </div>
        )}

        <BigButton
          tone="green"
          icon={Check}
          label={valid ? `${t('save', 'Save')} ${formatCurrency(value)}` : t('save', 'Save')}
          onClick={() => onSave(value, mode)}
          disabled={!valid || busy}
          className="w-full py-4 text-base"
        />
      </div>
    </Sheet>
  );
};
