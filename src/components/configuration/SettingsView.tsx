import React, { useEffect, useMemo, useState } from 'react';
import { Check, UserCheck, Users } from 'lucide-react';
import { Area, CompanyProfile, DefaultLocation, MasterLists } from '../../types';
import { api } from '../../services/api';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, PageTitle, PillTabs, Spinner } from '../common/ui';
import { ListEditor, Notice, inputClass, useSaveNotice } from './ConfigShared';
import { LoanProductsView } from './LoanProductsView';
import { DataManagementView } from './DataManagementView';
import { PersonEntry } from '../setup/PersonEntry';
import { ExcelImport } from '../setup/ExcelImport';

export type SettingsTab = 'organisation' | 'collectors' | 'customers' | 'rules' | 'loan-types' | 'testing';

/**
 * Everything the office sets up, in the order it is needed: the organisation, then its collectors and
 * customers (typed, spoken or from an Excel file), the collection rules and the loan types (logins
 * have their own menu item). A new installation opens here. Technical settings (ID numbering) stay automatic.
 */
export const SettingsView: React.FC<{ initialTab?: SettingsTab }> = ({ initialTab }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? 'organisation');
  return (
    <div className="space-y-4 pb-8">
      <PageTitle title={t('settings', 'Settings')} />
      <PillTabs<SettingsTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'organisation', label: t('organisation', 'Organisation') },
          { id: 'collectors', label: t('collectors', 'Collectors') },
          { id: 'customers', label: t('customers', 'Customers') },
          { id: 'rules', label: t('collectionRules', 'Collection rules') },
          { id: 'loan-types', label: t('loanTypes', 'Loan types') },
          { id: 'testing', label: t('testing', 'Testing') },
        ]}
      />
      {tab === 'organisation' && <OrganisationSettings />}
      {tab === 'collectors' && <PeopleSettings kind="collector" />}
      {tab === 'customers' && <PeopleSettings kind="customer" />}
      {tab === 'rules' && <CollectionRules />}
      {tab === 'loan-types' && <LoanProductsView />}
      {tab === 'testing' && <DataManagementView />}
    </div>
  );
};

/** The details printed on every receipt, UPI, and the town used for addresses and maps. */
const OrganisationSettings: React.FC = () => {
  const { t } = useLanguage();
  const { config, updateSection } = useConfig();
  const [company, setCompany] = useState<CompanyProfile>(config.company);
  const [location, setLocation] = useState<DefaultLocation>(config.masters.default_location);
  const { notice, saving, run } = useSaveNotice();

  const companyField = (key: keyof CompanyProfile, label: string, type = 'text') => (
    <div>
      <label htmlFor={`org-${key}`} className="block text-sm font-bold text-slate-300 mb-1.5">{label}</label>
      <input
        id={`org-${key}`}
        type={type}
        className={inputClass}
        value={company[key] !== undefined && company[key] !== null ? String(company[key]) : ''}
        onChange={e => setCompany({ ...company, [key]: type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value })}
      />
    </div>
  );
  const locationField = (key: keyof DefaultLocation, label: string) => (
    <div>
      <label htmlFor={`org-${key}`} className="block text-sm font-bold text-slate-300 mb-1.5">{label}</label>
      <input id={`org-${key}`} className={inputClass} value={location[key]} onChange={e => setLocation({ ...location, [key]: e.target.value })} />
    </div>
  );

  // Saving the organisation once ends the first-time start in Settings.
  const save = () =>
    run(async () => {
      if (!company.company_name?.trim()) throw new Error(t('needBusinessName', 'Enter the business name.'));
      await updateSection('company', { ...company, setup_completed: true });
      await updateSection('masters', { ...config.masters, default_location: location });
    }, t('saved', 'Saved'));

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 max-w-2xl">
      <p className="text-sm text-slate-400">{t('printedOnReceipts', 'These are printed on every receipt.')}</p>
      {companyField('company_name', `${t('businessName', 'Business name')} *`)}
      {companyField('company_tagline', t('taglineOptional', 'Tagline (optional)'))}
      {companyField('company_address', t('address', 'Address'))}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {companyField('company_phone', t('phone', 'Phone'), 'tel')}
        {companyField('company_email', t('emailOptional', 'Email (optional)'), 'email')}
        {locationField('city', t('city', 'City / town'))}
        {locationField('district', t('district', 'District'))}
        {locationField('state', t('state', 'State'))}
        {locationField('pincode', t('pincode', 'Pincode'))}
      </div>
      <p className="text-sm text-slate-400 pt-2">{t('upiSettingsHint', 'Customers and collectors pay to this UPI ID. Leave it empty to turn off UPI payment.')}</p>
      {companyField('upi_id', t('upiIdLabel', 'UPI ID (for example shopname@okicici)'))}
      {companyField('upi_name', t('upiNameLabel', 'Name shown in UPI apps (optional)'))}
      <Notice notice={notice} />
      <BigButton tone="gold" icon={Check} label={saving ? t('saving', 'Saving...') : t('save', 'Save')} disabled={saving} onClick={save} />
    </div>
  );
};

/** Adding collectors or customers: from an Excel file, or one by one, typed or spoken. */
const PeopleSettings: React.FC<{ kind: 'collector' | 'customer' }> = ({ kind }) => {
  const { t } = useLanguage();
  const [mobiles, setMobiles] = useState<string[] | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);

  const load = () =>
    Promise.all([
      kind === 'collector'
        ? api.getCollectors().then(list => list.map(c => c.mobile))
        : api.getCustomers().then(list => list.map(c => c.mobile_number)),
      api.getAreas(),
    ]).then(([found, ars]) => {
      setMobiles(found);
      setAreas(ars);
    });

  useEffect(() => {
    load().catch(() => setMobiles([]));
  }, [kind]);

  const existing = useMemo(() => new Set((mobiles ?? []).map(m => m.replace(/\D/g, '').slice(-10))), [mobiles]);
  if (!mobiles) return <Spinner />;

  return (
    <div className="space-y-4 max-w-4xl">
      <p className="text-sm font-bold text-slate-300 flex items-center gap-2">
        {kind === 'collector' ? <UserCheck className="w-4 h-4 text-gold-400" /> : <Users className="w-4 h-4 text-gold-400" />}
        {kind === 'collector' ? t('collectorsAddedSoFar', 'Collectors added so far') : t('customersAddedSoFar', 'Customers added so far')}: {mobiles.length}
      </p>
      <section className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-3">
        <h3 className="text-base font-black text-white">{t('uploadExcel', 'Upload Excel')}</h3>
        <ExcelImport key={kind} kind={kind} existingMobiles={existing} onAdded={load} />
      </section>
      <section className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-3">
        <h3 className="text-base font-black text-white">{t('addOneByOne', 'Add one by one (type or speak)')}</h3>
        <PersonEntry key={kind} kind={kind} areaNames={areas.map(a => a.area_name)} onAdded={load} />
      </section>
    </div>
  );
};

/** Payment ways, "not paid" reasons, the not-paying rule and how often a collector may send the report. */
const CollectionRules: React.FC = () => {
  const { t } = useLanguage();
  const { config, updateSection } = useConfig();
  const [masters, setMasters] = useState<MasterLists>(config.masters);
  const { notice, saving, run } = useSaveNotice();

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
        <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('longPendingAfterTerms', 'Count as "Long pending" after how many pending terms?')}</label>
        <input type="number" min={1} className={inputClass} value={masters.long_pending_after_terms}
          onChange={e => set({ long_pending_after_terms: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
        <p className="text-xs text-slate-400 mt-1">{t('longPendingAfterTermsHint', 'Used for "Long standing loans" on Home, the collector\'s list and the Long pending report.')}</p>
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('reportSendLimitLabel', 'How many times can a collector send the day\'s report?')}</label>
        <input type="number" min={1} className={inputClass} value={masters.report_send_limit}
          onChange={e => set({ report_send_limit: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
        <p className="text-xs text-slate-400 mt-1">{t('reportSendLimitHint', 'After this, a collector\'s corrections wait for your approval on Home.')}</p>
      </div>
      <Notice notice={notice} />
      <BigButton tone="gold" icon={Check} label={saving ? t('saving', 'Saving...') : t('save', 'Save')} disabled={saving} onClick={save} />
    </div>
  );
};
