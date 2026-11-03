import React from 'react';
import { LogOut } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageChoice, ThemeToggle } from './ThemeLanguageSwitch';
import { Sheet } from './ui';

/**
 * The ⚙️ sheet: the person's details (read-only), language, light/dark screen and sign out.
 */
export const AccountSettingsSheet: React.FC<{
  details: [label: string, value: string | undefined][];
  onLogout: () => void;
  onClose: () => void;
  /** Collectors and customers change their details through the office. */
  changeViaOffice?: boolean;
}> = ({ details, onLogout, onClose, changeViaOffice = true }) => {
  const { t } = useLanguage();
  const rows = details.filter(([, value]) => value);

  return (
    <Sheet title={t('settings', 'Settings')} onClose={onClose}>
      <div className="space-y-5">
        {rows.length > 0 && (
          <section>
            <h4 className="text-sm font-bold text-gold-400 mb-2">{t('myDetails', 'My details')}</h4>
            <dl className="rounded-2xl bg-navy-950 border border-slate-800 divide-y divide-slate-800">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="text-white font-semibold text-right">{value}</dd>
                </div>
              ))}
            </dl>
            {changeViaOffice && <p className="text-xs text-slate-400 mt-2">{t('detailsChangeViaOffice', 'To change your details, please call the office.')}</p>}
          </section>
        )}

        <section>
          <h4 className="text-sm font-bold text-gold-400 mb-2">{t('language', 'Language')}</h4>
          <LanguageChoice />
        </section>

        <section className="rounded-2xl bg-navy-950 border border-slate-800 p-1">
          <ThemeToggle />
        </section>

        <button
          type="button"
          onClick={onLogout}
          className="w-full px-4 py-3 rounded-2xl border border-rose-500/40 text-rose-300 font-bold flex items-center justify-center gap-2 hover:bg-rose-500/10"
        >
          <LogOut className="w-5 h-5" />
          {t('logout', 'Sign Out')}
        </button>
      </div>
    </Sheet>
  );
};
