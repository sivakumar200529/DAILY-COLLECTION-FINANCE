import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Area, CompanyProfile, MasterLists } from '../../types';
import { api } from '../../services/api';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, PageTitle, PillTabs } from '../common/ui';
import { ListEditor, Notice, inputClass, useSaveNotice } from './ConfigShared';
import { UserManagementView } from './UserManagementView';

type SettingsTab = 'business' | 'users' | 'payments';

/** Everything the office can set, in one place. Technical settings (ID numbering) stay automatic. */
export const SettingsView: React.FC = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<SettingsTab>('business');
  return (
    <div className="space-y-4 pb-8">
      <PageTitle title={t('settings', 'Settings')} />
      <PillTabs<SettingsTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'business', label: t('businessDetails', 'Business') },
          { id: 'users', label: t('userAccounts', 'Users & Logins') },
          { id: 'payments', label: t('paymentsAndReasons', 'Payments') },
        ]}
      />
      {tab === 'business' && <BusinessDetails />}
      {tab === 'users' && <UserManagementView />}
      {tab === 'payments' && <PaymentSettings />}
    </div>
  );
};

/** Name, address and phone printed on every receipt. */
const BusinessDetails: React.FC = () => {
  const { t } = useLanguage();
  const { config, updateSection } = useConfig();
  const [company, setCompany] = useState<CompanyProfile>(config.company);
  const { notice, saving, run } = useSaveNotice();

  const field = (key: keyof CompanyProfile, label: string, type = 'text') => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1.5">{label}</label>
      <input
        type={type}
        className={inputClass}
        value={company[key] !== undefined && company[key] !== null ? String(company[key]) : ''}
        onChange={e =>
          setCompany({
            ...company,
            [key]: type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
          })
        }
      />
    </div>
  );

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 max-w-2xl">
      <p className="text-sm text-slate-400">{t('printedOnReceipts', 'These are printed on every receipt.')}</p>
      {field('company_name', t('businessName', 'Business name'))}
      {field('company_address', t('address', 'Address'))}
      {field('company_phone', t('phone', 'Phone'), 'tel')}
      {field('company_email', t('emailOptional', 'Email (optional)'), 'email')}
      {field('opening_balance', t('openingBalance', 'Opening Cash Capital (₹)'), 'number')}
      <Notice notice={notice} />
      <BigButton tone="gold" icon={Check} label={saving ? t('saving', 'Saving...') : t('save', 'Save')} disabled={saving}
        onClick={() => run(() => updateSection('company', company), t('saved', 'Saved'))} />
    </div>
  );
};

/** Payment ways, "not paid" reasons, the not-paying rule and the default area for new customers. */
const PaymentSettings: React.FC = () => {
  const { t } = useLanguage();
  const { config, updateSection } = useConfig();
  const [masters, setMasters] = useState<MasterLists>(config.masters);
  const [areas, setAreas] = useState<Area[]>([]);
  const { notice, saving, run } = useSaveNotice();

  useEffect(() => {
    api.getAreas().then(setAreas).catch(() => setAreas([]));
  }, []);

  const set = (patch: Partial<MasterLists>) => setMasters({ ...masters, ...patch });

  const save = () => {
    const modes = masters.payment_modes;
    const next = modes.includes(masters.default_payment_mode) ? masters : { ...masters, default_payment_mode: modes[0] ?? '' };
    run(() => updateSection('masters', next), t('saved', 'Saved'));
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5 max-w-2xl">
      <ListEditor<string>
        label={t('paymentWays', 'Ways customers pay')}
        values={masters.payment_modes}
        onChange={v => set({ payment_modes: v })}
      />
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('defaultPaymentMode', 'Used for one-tap "Paid"')}</label>
        <select className={inputClass} value={masters.default_payment_mode} onChange={e => set({ default_payment_mode: e.target.value })}>
          {masters.payment_modes.map(m => <option key={m} value={m}>{t(m, m)}</option>)}
        </select>
      </div>
      <ListEditor<string>
        label={t('notPaidReasons', 'Reasons for "Not paid"')}
        values={masters.not_paid_reasons}
        onChange={v => set({ not_paid_reasons: v })}
      />
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('notPayingAfterDays', 'Count as "Not paying" after how many missed days?')}</label>
        <input type="number" min={1} className={inputClass} value={masters.not_paying_after_days}
          onChange={e => set({ not_paying_after_days: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('defaultArea', 'Area for new customers')}</label>
        <select className={inputClass} value={masters.default_location.area}
          onChange={e => set({ default_location: { ...masters.default_location, area: e.target.value } })}>
          <option value="">—</option>
          {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
        </select>
      </div>
      <Notice notice={notice} />
      <BigButton tone="gold" icon={Check} label={saving ? t('saving', 'Saving...') : t('save', 'Save')} disabled={saving} onClick={save} />
    </div>
  );
};
