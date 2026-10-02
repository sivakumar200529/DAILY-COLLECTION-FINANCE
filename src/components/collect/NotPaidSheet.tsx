import React, { useState } from 'react';
import { X } from 'lucide-react';
import { DailyCollectionRecord } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { BigButton, Sheet } from '../common/ui';

interface NotPaidSheetProps {
  record: DailyCollectionRecord;
  busy: boolean;
  onSave: (reason: string, note: string) => void;
  onClose: () => void;
}

/** Marks today as not paid, with one of the reasons set in Settings and an optional note. */
export const NotPaidSheet: React.FC<NotPaidSheetProps> = ({ record, busy, onSave, onClose }) => {
  const { t } = useLanguage();
  const reasons = useConfig().config.masters.not_paid_reasons;
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState<string>('');

  return (
    <Sheet title={`${record.customer_name}: ${t('notPaid', 'Not paid')}`} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-slate-300 mb-2">{t('why', 'Why?')}</p>
          <div className="grid grid-cols-1 gap-2">
            {reasons.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`px-4 py-3 rounded-2xl border text-left text-base font-bold ${
                  reason === r ? 'bg-rose-500/20 border-rose-500 text-rose-200' : 'bg-navy-950 border-slate-700 text-slate-200'
                }`}
              >
                {t(r, r)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">{t('noteOptional', 'Note (optional)')}</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white focus:border-gold-500 focus:outline-none"
          />
        </div>

        <BigButton
          tone="red"
          icon={X}
          label={t('saveNotPaid', 'Save as not paid')}
          onClick={() => onSave(reason, note.trim())}
          disabled={!reason || busy}
          className="w-full py-4 text-base"
        />
      </div>
    </Sheet>
  );
};
