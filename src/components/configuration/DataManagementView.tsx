import React, { useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, ConfirmSheet } from '../common/ui';

/** Testing only: replaces everything with the committed sample data set (data/sample_data.json). */
export const DataManagementView: React.FC = () => {
  const { t } = useLanguage();
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSample = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.loadSampleData();
      // Every screen and the configuration depend on the data, so start fresh.
      window.location.reload();
    } catch (err) {
      setAsking(false);
      setError(err instanceof Error ? err.message : 'Failed to load sample data');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-rose-500/50 bg-rose-500/10 p-5 space-y-3">
        <div className="flex items-center gap-2 text-rose-300 font-black text-lg">
          <AlertTriangle className="w-6 h-6" />
          {t('forTestingOnly', 'For testing only')}
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">
          {t('sampleDataDesc', 'Loading the sample data removes ALL customers, loans, payments and settings, and puts back the sample set kept in data/sample_data.json.')}
        </p>
        <BigButton tone="red" icon={Download} label={t('loadSampleData', 'Load sample data')} onClick={() => setAsking(true)} disabled={loading} />
        {error && <p className="text-sm text-rose-300 font-semibold">{error}</p>}
      </div>

      {asking && (
        <ConfirmSheet
          title={t('loadSampleQuestion', 'Remove all data and load the sample?')}
          message={t('cannotBeUndone', 'This cannot be undone.')}
          yesLabel={t('yesLoadSample', 'Yes, load sample')}
          noLabel={t('no', 'No')}
          danger
          busy={loading}
          onYes={loadSample}
          onNo={() => setAsking(false)}
        />
      )}
    </div>
  );
};
