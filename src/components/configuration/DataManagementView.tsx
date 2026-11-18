import React, { useState } from 'react';
import { AlertTriangle, Download, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, ConfirmSheet, Sheet } from '../common/ui';

/**
 * Loading the sample data (to try the app) and removing it again (to start real work). Both keep a
 * copy of the data they replace beside the data file.
 */
export const DataManagementView: React.FC = () => {
  const { t } = useLanguage();
  const [asking, setAsking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [keepStaff, setKeepStaff] = useState(true);
  const [typed, setTyped] = useState('');
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

  const clearData = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.clearData(keepStaff);
      window.location.reload();
    } catch (err) {
      setClearing(false);
      setError(err instanceof Error ? err.message : 'Could not remove the data');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-rose-500/50 bg-rose-500/10 p-5 space-y-3">
        <div className="flex items-center gap-2 text-rose-300 font-black text-lg">
          <Trash2 className="w-6 h-6" />
          {t('removeAllData', 'Remove the data')}
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">
          {t('removeAllDataDesc', 'Removes every customer, loan, payment, receipt and day report, to start real work after trying the sample. Settings, loan types and office logins stay. A copy of the removed data is kept beside the data file.')}
        </p>
        <BigButton tone="red" icon={Trash2} label={t('removeAllData', 'Remove the data')} onClick={() => { setTyped(''); setClearing(true); }} disabled={loading} />
      </div>

      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2 text-amber-300 font-black text-lg">
          <AlertTriangle className="w-6 h-6" />
          {t('forTestingOnly', 'For testing only')}
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">
          {t('sampleDataDesc', 'Loading the sample data removes ALL customers, loans, payments and settings, and puts back the sample set kept in data/sample_data.json.')}
        </p>
        <BigButton icon={Download} label={t('loadSampleData', 'Load sample data')} onClick={() => setAsking(true)} disabled={loading} />
      </div>
      {error && <p className="text-sm text-rose-300 font-semibold">{error}</p>}

      {asking && (
        <ConfirmSheet
          title={t('loadSampleQuestion', 'Remove all data and load the sample?')}
          message={t('copyIsKept', 'A copy of the current data is kept beside the data file.')}
          yesLabel={t('yesLoadSample', 'Yes, load sample')}
          noLabel={t('no', 'No')}
          danger
          busy={loading}
          onYes={loadSample}
          onNo={() => setAsking(false)}
        />
      )}

      {clearing && (
        <Sheet title={t('removeAllDataQuestion', 'Remove all customers, loans and payments?')} onClose={() => setClearing(false)}>
          <div className="space-y-4">
            <label className="flex items-start gap-3 text-sm text-slate-200 cursor-pointer">
              <input type="checkbox" checked={keepStaff} onChange={e => setKeepStaff(e.target.checked)} className="w-5 h-5 mt-0.5 accent-amber-500" />
              <span>
                <span className="font-bold">{t('keepCollectorsAreas', 'Keep collectors and areas')}</span>
                <span className="block text-xs text-slate-400">{t('keepCollectorsAreasHint', 'Untick to remove the collectors (and their logins) and the areas too.')}</span>
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-slate-300">{t('typeDeleteToConfirm', 'Type DELETE to confirm')}</span>
              <input
                value={typed}
                onChange={e => setTyped(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-3 bg-navy-950/80 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-rose-500"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <BigButton label={t('no', 'No')} onClick={() => setClearing(false)} />
              <BigButton tone="red" icon={Trash2} label={t('removeAllData', 'Remove the data')} onClick={clearData} disabled={loading || typed.trim() !== 'DELETE'} />
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
};
