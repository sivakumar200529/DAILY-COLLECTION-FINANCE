import React, { useEffect, useState } from 'react';
import { SystemSettings } from '../../types';
import { api } from '../../services/api';
import { Settings, Save, RotateCcw, Building, Phone, Mail, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeLanguageSwitch } from '../common/ThemeLanguageSwitch';

export const SettingsView: React.FC = () => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [resetting, setResetting] = useState<boolean>(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await api.updateSettings(settings);
      setSavedMessage('Settings successfully saved and applied system-wide!');
      setTimeout(() => setSavedMessage(null), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleResetData = async () => {
    if (!confirm('Reset entire Daily Collection database to factory sample data (including 100-day records & Ramesh Kumar sample)?')) return;
    setResetting(true);
    try {
      await api.resetDatabase();
      alert('Database successfully reset to pristine Daily Collection sample seed.');
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset database:', err);
    } finally {
      setResetting(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans max-w-4xl mx-auto">
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider block w-fit mb-1">
            {t('settings', 'Configuration')}
          </span>
          <h1 className="text-xl md:text-2xl font-black text-white">{t('systemSettings', 'SYSTEM SETTINGS')}</h1>
          <p className="text-xs text-slate-300 mt-0.5">{t('customize branch business parameters, receipt prefix, and system defaults.', 'Customize branch business parameters, receipt prefix, and system defaults.')}</p>
        </div>

        <button
          onClick={handleResetData}
          disabled={resetting}
          className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          <span>{t('reset sample demo data', 'Reset Sample Demo Data')}</span>
        </button>
      </div>

      {savedMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{savedMessage}</span>
        </div>
      )}

      {/* Theme and Language Selection Card */}
      <div className="glass-card p-6 rounded-2xl border border-gold-500/30 space-y-4">
        <h3 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          {t('systemPreferences', 'System Preferences')} &bull; {t('displayAndLanguage', 'Display & Language')}
        </h3>
        <p className="text-xs text-slate-300">
          {t('themeDesc', 'Switch between Dark (Midnight Gold) and Light (Executive Slate) themes')} &bull; {t('languageDesc', 'Choose preferred application language (English or தமிழ்)')}
        </p>
        <ThemeLanguageSwitch variant="full" />
      </div>

      <form onSubmit={handleSave} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-5 text-xs">
        <h3 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-2">
          <Building className="w-4 h-4" />
          {t('company & branch identity', 'Company & Branch Identity')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">{t('company brand name', 'Company Brand Name')}</label>
            <input
              type="text"
              value={settings.company_name}
              onChange={e => setSettings({ ...settings, company_name: e.target.value })}
              className="w-full px-3 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">{t('system tagline', 'System Tagline')}</label>
            <input
              type="text"
              value={settings.company_tagline}
              onChange={e => setSettings({ ...settings, company_tagline: e.target.value })}
              className="w-full px-3 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-300 font-semibold mb-1">{t('registered office address', 'Registered Office Address')}</label>
            <input
              type="text"
              value={settings.company_address}
              onChange={e => setSettings({ ...settings, company_address: e.target.value })}
              className="w-full px-3 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">{t('official telephone / mobile', 'Official Telephone / Mobile')}</label>
            <input
              type="text"
              value={settings.company_phone}
              onChange={e => setSettings({ ...settings, company_phone: e.target.value })}
              className="w-full px-3 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">{t('official support email', 'Official Support Email')}</label>
            <input
              type="email"
              value={settings.company_email}
              onChange={e => setSettings({ ...settings, company_email: e.target.value })}
              className="w-full px-3 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white"
            />
          </div>
        </div>

        <h3 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-2 pt-4 border-t border-slate-800">
          <FileText className="w-4 h-4" />
          {t('receipt & collection parameters', 'Receipt & Collection Parameters')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">{t('receipt number prefix', 'Receipt Number Prefix')}</label>
            <input
              type="text"
              value={settings.receipt_prefix}
              onChange={e => setSettings({ ...settings, receipt_prefix: e.target.value })}
              className="w-full px-3 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">{t('currency symbol', 'Currency Symbol')}</label>
            <input
              type="text"
              value={settings.currency}
              onChange={e => setSettings({ ...settings, currency: e.target.value })}
              className="w-full px-3 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">{t('default collection days', 'Default Collection Days')}</label>
            <input
              type="number"
              value={settings.default_collection_days}
              onChange={e => setSettings({ ...settings, default_collection_days: Number(e.target.value) })}
              className="w-full px-3 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
            />
          </div>
        </div>

        <div className="pt-3">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{t('save configuration', 'Save Configuration')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
