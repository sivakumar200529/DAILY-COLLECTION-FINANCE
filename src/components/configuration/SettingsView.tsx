import React, { useEffect, useMemo, useState } from 'react';
import { Check, UserCheck, Users } from 'lucide-react';
import { Area, CompanyProfile, DefaultLocation, MasterLists, Numbering, NumberingKind } from '../../types';
import { api } from '../../services/api';
import { useConfig } from '../../context/ConfigContext';
import { formatId, isLogoData } from '../../../shared/config';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, PageTitle, PillTabs, Spinner } from '../common/ui';
import { ListEditor, Notice, inputClass, useSaveNotice } from './ConfigShared';
import { LoanProductsView } from './LoanProductsView';
import { DataManagementView } from './DataManagementView';
import { PersonEntry } from '../setup/PersonEntry';
import { ExcelImport } from '../setup/ExcelImport';

export type SettingsTab = 'organisation' | 'collectors' | 'customers' | 'rules' | 'loan-types' | 'numbers' | 'testing';

/**
 * Everything the office sets up, in the order it is needed: the organisation, then its collectors and
 * customers (typed, spoken or from an Excel file), the collection rules and the loan types (logins
 * have their own menu item), and how new IDs and receipt numbers look. A new installation opens here.
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
          { id: 'numbers', label: t('idNumbers', 'ID numbers') },
          { id: 'testing', label: t('testing', 'Testing') },
        ]}
      />
      {tab === 'organisation' && <OrganisationSettings />}
      {tab === 'collectors' && <PeopleSettings kind="collector" />}
      {tab === 'customers' && <PeopleSettings kind="customer" />}
      {tab === 'rules' && <CollectionRules />}
      {tab === 'loan-types' && <LoanProductsView />}
      {tab === 'numbers' && <NumberingSettings />}
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
      <LogoPicker value={company.company_logo || ''} onChange={v => setCompany({ ...company, company_logo: v })} />
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
      <div>
        {companyField('opening_balance', t('openingBalanceLabel', 'Opening balance (₹)'), 'number')}
        <p className="text-sm text-slate-400 mt-1">{t('openingBalanceHint', 'Money you had for lending when you started. Home shows the money in hand from it: opening balance + collected − loans given.')}</p>
      </div>
      <label className="flex items-center gap-3 text-base text-slate-200 cursor-pointer">
        <input
          type="checkbox"
          className="w-5 h-5 accent-amber-500"
          checked={company.notifications_enabled !== false}
          onChange={e => setCompany({ ...company, notifications_enabled: e.target.checked })}
        />
        {t('notificationsOn', 'Show alerts (payments, missed days, requests) in the bell')}
      </label>
      <p className="text-sm text-slate-400 pt-2">{t('upiSettingsHint', 'Customers and collectors pay to this UPI ID. Leave it empty to turn off UPI payment.')}</p>
      {companyField('upi_id', t('upiIdLabel', 'UPI ID (for example shopname@okicici)'))}
      {companyField('upi_name', t('upiNameLabel', 'Name shown in UPI apps (optional)'))}
      <Notice notice={notice} />
      <BigButton tone="gold" icon={Check} label={saving ? t('saving', 'Saving...') : t('save', 'Save')} disabled={saving} onClick={save} />
    </div>
  );
};

/** How new IDs look: customers, loans, receipts, collectors and areas. Numbers already given never change. */
const NumberingSettings: React.FC = () => {
  const { t } = useLanguage();
  const { config, updateSection } = useConfig();
  const [numbering, setNumbering] = useState<Numbering>(config.numbering);
  const { notice, saving, run } = useSaveNotice();
  const kinds: [NumberingKind, string][] = [
    ['customer', t('customers', 'Customers')],
    ['account', t('loans', 'Loans')],
    ['receipt', t('receipts', 'Receipts')],
    ['collector', t('collectors', 'Collectors')],
    ['area', t('areas', 'Areas')],
  ];
  const set = (kind: NumberingKind, patch: Partial<Numbering[NumberingKind]>) =>
    setNumbering({ ...numbering, [kind]: { ...numbering[kind], ...patch } });
  const save = () =>
    run(async () => {
      for (const [kind, label] of kinds) {
        if (!/^[A-Za-z0-9_-]{0,12}$/.test(numbering[kind].prefix)) throw new Error(`${label}: ${t('prefixRule', 'the start letters can be up to 12 letters, numbers, - or _.')}`);
      }
      const saved = await updateSection('numbering', numbering);
      if (saved) setNumbering(saved.numbering);
    }, t('saved', 'Saved'));

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 max-w-3xl">
      <p className="text-sm text-slate-400">{t('numberingHint', 'How new IDs look. IDs already given stay as they are, and the next number never goes back to one already used.')}</p>
      {kinds.map(([kind, label]) => {
        const rule = numbering[kind];
        return (
          <div key={kind} className="rounded-2xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="text-base font-bold text-white">{label}</span>
              <span className="text-sm text-slate-400">
                {t('nextIdWillBe', 'Next')}: <strong className="font-mono text-gold-300">{formatId(rule, rule.next)}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label htmlFor={`num-${kind}-prefix`} className="block text-sm font-bold text-slate-300 mb-1.5">{t('idPrefix', 'Starts with')}</label>
                <input id={`num-${kind}-prefix`} className={`${inputClass} font-mono`} maxLength={12} value={rule.prefix} onChange={e => set(kind, { prefix: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label htmlFor={`num-${kind}-pad`} className="block text-sm font-bold text-slate-300 mb-1.5">{t('idDigits', 'Digits')}</label>
                <input id={`num-${kind}-pad`} type="number" min={1} max={10} className={`${inputClass} font-mono`} value={rule.pad} onChange={e => set(kind, { pad: Math.max(1, Math.min(10, Math.floor(Number(e.target.value) || 1))) })} />
              </div>
              <div>
                <label htmlFor={`num-${kind}-next`} className="block text-sm font-bold text-slate-300 mb-1.5">{t('idNextNumber', 'Next number')}</label>
                <input id={`num-${kind}-next`} type="number" min={config.numbering[kind].next} className={`${inputClass} font-mono`} value={rule.next} onChange={e => set(kind, { next: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer pb-3">
                <input type="checkbox" className="w-5 h-5 accent-amber-500" checked={rule.include_year} onChange={e => set(kind, { include_year: e.target.checked })} />
                {t('idIncludeYear', 'Add the year')}
              </label>
            </div>
          </div>
        );
      })}
      <Notice notice={notice} />
      <BigButton tone="gold" icon={Check} label={saving ? t('saving', 'Saving...') : t('save', 'Save')} disabled={saving} onClick={save} />
    </div>
  );
};

/** The business logo: a picture from the phone or computer, made small so it loads fast and prints well. */
const LogoPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const pick = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError(t('logoWrongType', 'Choose a PNG, JPG or WEBP picture.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 256 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const data = canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
      if (!isLogoData(data)) return setError(t('logoTooBig', 'This picture is too big. Choose a smaller one.'));
      onChange(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError(t('logoWrongType', 'Choose a PNG, JPG or WEBP picture.'));
    };
    img.src = url;
  };
  return (
    <div>
      <span className="block text-sm font-bold text-slate-300 mb-1.5">{t('logoOptional', 'Logo (optional)')}</span>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-16 h-16 rounded-2xl bg-navy-950 border border-slate-700 flex items-center justify-center overflow-hidden">
          {value ? <img src={value} alt={t('logo', 'Logo')} className="w-full h-full object-contain" /> : <span className="text-xs text-slate-500">{t('noLogo', 'None')}</span>}
        </div>
        <label className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-100 font-bold text-sm cursor-pointer hover:bg-slate-700">
          {value ? t('changeLogo', 'Change logo') : t('chooseLogo', 'Choose logo')}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {value && (
          <button type="button" onClick={() => onChange('')} className="px-4 py-2.5 rounded-xl border border-rose-500/40 text-rose-300 font-bold text-sm hover:bg-rose-500/10">
            {t('removeLogo', 'Remove logo')}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-rose-300 mt-1.5">{error}</p>}
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
    run(async () => { await updateSection('masters', next); }, t('saved', 'Saved'));
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5 max-w-2xl">
      <ListEditor<string>
        label={t('paymentWays', 'Ways customers pay')}
        values={masters.payment_modes}
        onChange={v => set({ payment_modes: v })}
      />
      <p className="text-sm text-slate-400 -mt-3">
        {t('othersAlwaysOffered', '"Others" is always offered too, with a box to write how it was paid. Only the mode named UPI shows the QR code and UPI ID.')}
      </p>
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
