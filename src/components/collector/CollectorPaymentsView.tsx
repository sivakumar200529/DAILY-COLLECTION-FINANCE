import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { DailyCollectionRecord, User } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { CollectionList } from '../collect/CollectionList';

/** The collector's Payment screen: today's customers, with a way back to the main screen. */
export const CollectorPaymentsView: React.FC<{
  currentUser: User;
  records: DailyCollectionRecord[];
  onChanged: () => Promise<void>;
  onBack: () => void;
}> = ({ currentUser, records, onChanged, onBack }) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-2 py-2 rounded-xl text-slate-200 hover:bg-slate-800 font-bold">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-lg">{t('payment', 'Payment')}</span>
      </button>
      <CollectionList currentUser={currentUser} records={records} onChanged={onChanged} />
    </div>
  );
};
