import React from 'react';
import { Coins, Minus, Plus, RotateCcw } from 'lucide-react';
import { CASH_NOTES, countedCash } from '../../../shared/collectorDay';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';

export type NoteCounts = Record<string, number>;
export const emptyNotes = (): NoteCounts => Object.fromEntries(CASH_NOTES.map(n => [n, 0]));

/**
 * Count cash note by note (₹500 × 4 …) plus coins. Used for the cash in hand in the day's report
 * and for the cash a customer hands over when collecting.
 */
export const CashCounter: React.FC<{
  notes: NoteCounts;
  coins: number;
  onChange: (notes: NoteCounts, coins: number) => void;
  title?: string;
  totalLabel?: string;
}> = ({ notes, coins, onChange, title, totalLabel }) => {
  const { t } = useLanguage();
  const setCount = (note: number, count: number) => onChange({ ...notes, [note]: Math.max(0, Math.floor(count) || 0) }, coins);

  return (
    <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black text-white">{title ?? t('countYourCash', 'Count your cash')}</h3>
        <button
          type="button"
          onClick={() => onChange(emptyNotes(), 0)}
          aria-label={t('reset', 'Reset')}
          title={t('reset', 'Reset')}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {CASH_NOTES.map(note => {
        const count = notes[note] || 0;
        return (
          <div key={note} className="flex items-center gap-2">
            <span className="w-16 text-base font-black font-mono text-gold-300">₹{note}</span>
            <span className="text-slate-500">×</span>
            <button
              type="button"
              onClick={() => setCount(note, count - 1)}
              aria-label={`₹${note} −1`}
              className="w-10 h-10 rounded-xl bg-navy-950 border border-slate-700 text-slate-200 flex items-center justify-center"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={count || ''}
              placeholder="0"
              onChange={e => setCount(note, Number(e.target.value))}
              aria-label={`₹${note}`}
              className="w-16 px-2 py-2 bg-navy-950 border border-slate-700 rounded-xl text-center text-base font-bold text-white focus:border-gold-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setCount(note, count + 1)}
              aria-label={`₹${note} +1`}
              className="w-10 h-10 rounded-xl bg-navy-950 border border-slate-700 text-slate-200 flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
            <span className="ml-auto font-mono text-sm text-slate-300">{formatCurrency(note * count)}</span>
          </div>
        );
      })}

      <div className="flex items-center gap-2 pt-1">
        <Coins className="w-5 h-5 text-gold-400" />
        <span className="text-sm font-bold text-slate-300">{t('coinsAndChange', 'Coins / change')}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={coins || ''}
          placeholder="0"
          onChange={e => onChange(notes, Math.max(0, Number(e.target.value) || 0))}
          className="ml-auto w-28 px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-right text-base font-bold text-white focus:border-gold-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <span className="text-sm font-bold text-slate-300">{totalLabel ?? t('cashCounted', 'Cash counted')}</span>
        <span className="text-xl font-black font-mono text-white">{formatCurrency(countedCash(notes, coins))}</span>
      </div>
    </div>
  );
};
