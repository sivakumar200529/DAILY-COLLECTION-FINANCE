import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { AppConfig, Area, Collector, LoanProduct, LoanOverride } from '../../types';
import { IssueLoanPayload } from '../../services/api';
import { evaluateLoan, todayIso, describeLoanIssue, LoanEvaluation, LoanIssue } from '../../../shared/finance';
import { calculateMonthlyBreakdown } from '../../utils/calendarSchedule';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';

/** Editable loan terms. `daily_collection` is null while the daily amount is worked out automatically. */
export interface LoanFormState {
  product_id: string;
  requested_amount: number;
  margin_percentage: number;
  collection_days: number;
  daily_collection: number | null;
  start_date: string;
  assigned_collector_id: string;
  collection_area: string;
}

export function activeProducts(config: AppConfig): LoanProduct[] {
  return config.loan_products.filter(p => p.status === 'ACTIVE');
}

/** Initial terms: the first active loan type's defaults, the borrower's area and that area's collector. */
export function initialLoanForm(config: AppConfig, areas: Area[], borrowerArea?: string): LoanFormState {
  const product = activeProducts(config)[0];
  const area = borrowerArea || config.masters.default_location.area;
  return {
    product_id: product?.id ?? '',
    requested_amount: product?.min_amount ?? 0,
    margin_percentage: product?.margin_percentage ?? 0,
    collection_days: product?.default_days ?? 0,
    daily_collection: null,
    start_date: todayIso(),
    assigned_collector_id: areas.find(a => a.area_name === area)?.assigned_collector_id ?? '',
    collection_area: area,
  };
}

/** The shared loan rules plus the two things only the form checks (area and collector chosen). */
export function evaluateLoanForm(config: AppConfig, form: LoanFormState): LoanEvaluation {
  const product = config.loan_products.find(p => p.id === form.product_id);
  const evaluation = evaluateLoan(product, {
    requested_amount: form.requested_amount,
    margin_percentage: form.margin_percentage,
    collection_days: form.collection_days,
    daily_collection: form.daily_collection ?? undefined,
    start_date: form.start_date,
  });
  const extra: LoanIssue[] = [];
  if (!form.collection_area) extra.push({ code: 'NO_AREA' });
  if (!form.assigned_collector_id) extra.push({ code: 'NO_COLLECTOR' });
  return {
    ...evaluation,
    issues: [...evaluation.issues, ...extra],
    errors: [...evaluation.errors, ...extra.map(describeLoanIssue)],
  };
}

/** Translated wording of a loan rule. */
export function loanIssueText(issue: LoanIssue, t: (key: string, fallback?: string) => string): string {
  return t(`loanIssue_${issue.code}`, describeLoanIssue(issue))
    .replace('{product}', issue.product ?? '')
    .replace('{limit}', issue.limit !== undefined ? formatCurrency(issue.limit) : '');
}

export function toIssueLoanPayload(form: LoanFormState): Omit<IssueLoanPayload, 'customer_id'> {
  return {
    product_id: form.product_id,
    requested_amount: form.requested_amount,
    margin_percentage: form.margin_percentage,
    collection_days: form.collection_days,
    ...(form.daily_collection !== null ? { daily_collection: form.daily_collection } : {}),
    start_date: form.start_date,
    assigned_collector_id: form.assigned_collector_id,
    collection_area: form.collection_area,
  };
}

const OVERRIDE_KEYS: Record<LoanOverride['field'], [string, string]> = {
  margin_percentage: ['interestPercent', 'Interest %'],
  collection_days: ['days', 'Days'],
  daily_collection: ['dailyPayment', 'Daily payment'],
};

interface LoanTermsFormProps {
  value: LoanFormState;
  onChange: (next: LoanFormState) => void;
  collectors: Collector[];
  areas: Area[];
  /** The shop's usual interest %, offered as a one-tap choice when terms can be changed. */
  shopDefaultMargin?: number;
}

const inputClass = 'w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-white text-base focus:border-gold-500 focus:outline-none';
const chipClass = (active: boolean) =>
  `px-4 py-2 rounded-xl text-sm font-bold transition-all ${
    active ? 'bg-gold-500 text-navy-950' : 'bg-navy-950 border border-slate-700 text-slate-200 hover:text-white'
  }`;

const Toggle: React.FC<{ open: boolean; onClick: () => void; label: string }> = ({ open, onClick, label }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-1.5 text-sm font-bold text-gold-400 hover:text-gold-300">
    {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    {label}
  </button>
);

/** The one loan form used everywhere a loan is given: loan type, amount, and a plain summary. */
export const LoanTermsForm: React.FC<LoanTermsFormProps> = ({ value, onChange, collectors, areas, shopDefaultMargin }) => {
  const { config } = useConfig();
  const { t } = useLanguage();
  const [showTerms, setShowTerms] = useState(false);
  const [showPlace, setShowPlace] = useState(false);
  const [showMonths, setShowMonths] = useState(false);

  const products = activeProducts(config);
  const product = config.loan_products.find(p => p.id === value.product_id);
  const { calculation, overrides, issues } = evaluateLoanForm(config, value);
  const canChange = product?.allow_overrides ?? false;

  // Quick choices come from the loan types themselves (and the shop's usual rate).
  const marginChoices = Array.from(new Set([
    ...products.map(p => p.margin_percentage),
    ...(shopDefaultMargin !== undefined ? [shopDefaultMargin] : []),
  ])).sort((a, b) => a - b);
  const dayChoices = Array.from(new Set(products.flatMap(p => p.day_options))).sort((a, b) => a - b);
  const monthly = showMonths && calculation.collection_days > 0 && value.start_date
    ? calculateMonthlyBreakdown(value.start_date, calculation.collection_days, calculation.daily_collection)
    : [];
  const collectorName = collectors.find(c => c.id === value.assigned_collector_id)?.name;

  const set = (patch: Partial<LoanFormState>) => onChange({ ...value, ...patch });

  const selectProduct = (id: string) => {
    const p = config.loan_products.find(x => x.id === id);
    if (!p) return set({ product_id: id });
    const amount = value.requested_amount;
    const inRange = (p.min_amount <= 0 || amount >= p.min_amount) && (p.max_amount <= 0 || amount <= p.max_amount);
    set({
      product_id: p.id,
      margin_percentage: p.margin_percentage,
      collection_days: p.default_days,
      daily_collection: null,
      requested_amount: inRange ? amount : p.min_amount,
    });
  };

  const selectArea = (area: string) => {
    const collectorId = areas.find(a => a.area_name === area)?.assigned_collector_id;
    set({ collection_area: area, ...(collectorId ? { assigned_collector_id: collectorId } : {}) });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('loanType', 'Loan type')}</label>
        <select value={value.product_id} onChange={e => selectProduct(e.target.value)} className={inputClass}>
          {products.length === 0 && <option value="">{t('noLoanTypes', 'No loan types – add one in Settings')}</option>}
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('loanAmount', 'Loan amount')}</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">₹</span>
          <input
            type="number"
            inputMode="numeric"
            value={value.requested_amount || ''}
            onChange={e => set({ requested_amount: Math.max(0, Number(e.target.value)) })}
            className="w-full pl-10 pr-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-3xl font-black text-white focus:border-gold-500 focus:outline-none"
            min={product?.min_amount || 0}
            max={product?.max_amount || undefined}
          />
        </div>
      </div>

      {/* The whole loan in one sentence, computed exactly as the server stores it. */}
      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-1.5">
        <div className="text-lg font-black text-white">
          {t('giveNow', 'Give now')}: <span className="text-emerald-300">{formatCurrency(calculation.disbursed_amount)}</span>
        </div>
        <div className="text-base font-bold text-slate-200">
          {t('collectDaily', 'Collect')} {formatCurrency(calculation.daily_collection)} {t('perDayFor', 'a day for')} {calculation.collection_days} {t('days', 'days')}
        </div>
        <div className="text-sm text-slate-300">
          {t('lastDay', 'Last day')}: <strong>{formatDate(calculation.expected_end_date)}</strong> • {t('interest', 'Interest')}: {formatCurrency(calculation.margin_amount)} ({calculation.margin_percentage}%)
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('startDate', 'Start date')}</label>
        <input type="date" value={value.start_date} onChange={e => set({ start_date: e.target.value })} className={inputClass} />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-300">
          {t('area', 'Area')}: <strong>{value.collection_area || '—'}</strong> • {t('collector', 'Collector')}: <strong>{collectorName || '—'}</strong>
        </div>
        <Toggle open={showPlace} onClick={() => setShowPlace(!showPlace)} label={t('change', 'Change')} />
        {showPlace && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={value.collection_area} onChange={e => selectArea(e.target.value)} className={inputClass} aria-label={t('area', 'Area')}>
              <option value="">{t('selectArea', 'Choose area')}</option>
              {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
              {value.collection_area && !areas.some(a => a.area_name === value.collection_area) && (
                <option value={value.collection_area}>{value.collection_area}</option>
              )}
            </select>
            <select
              value={value.assigned_collector_id}
              onChange={e => set({ assigned_collector_id: e.target.value })}
              className={inputClass}
              aria-label={t('collector', 'Collector')}
            >
              <option value="">{t('selectCollector', 'Choose collector')}</option>
              {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {canChange && (
        <div className="space-y-3">
          <Toggle open={showTerms} onClick={() => setShowTerms(!showTerms)} label={t('changeTerms', 'Change interest or days')} />
          {showTerms && (
            <div className="space-y-4 rounded-2xl border border-slate-800 p-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-bold text-slate-300">{t('interestPercent', 'Interest %')}</label>
                  {shopDefaultMargin !== undefined && shopDefaultMargin !== value.margin_percentage && (
                    <button
                      type="button"
                      onClick={() => set({ margin_percentage: shopDefaultMargin })}
                      className="text-xs text-gold-400 underline font-semibold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      {t('useShopMargin', 'Shop usual')} {shopDefaultMargin}%
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {marginChoices.map(m => (
                    <button key={m} type="button" onClick={() => set({ margin_percentage: m })} className={chipClass(value.margin_percentage === m)}>
                      {m}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={value.margin_percentage}
                  onChange={e => set({ margin_percentage: Math.max(0, Number(e.target.value)) })}
                  className={inputClass}
                  min={0}
                  max={99}
                  step={0.5}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('days', 'Days')}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {dayChoices.map(d => (
                    <button key={d} type="button" onClick={() => set({ collection_days: d })} className={chipClass(value.collection_days === d)}>
                      {d}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={value.collection_days || ''}
                  onChange={e => set({ collection_days: Math.max(0, Math.floor(Number(e.target.value))) })}
                  className={inputClass}
                  min={1}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-bold text-slate-300">{t('dailyPayment', 'Daily payment')}</label>
                  {value.daily_collection !== null && (
                    <button type="button" onClick={() => set({ daily_collection: null })} className="text-xs text-gold-400 underline font-semibold">
                      {t('autoCalculate', 'Work it out for me')}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  value={value.daily_collection ?? calculation.daily_collection}
                  onChange={e => set({ daily_collection: Math.max(0, Number(e.target.value)) })}
                  className={inputClass}
                  min={1}
                  step={0.01}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <Toggle open={showMonths} onClick={() => setShowMonths(!showMonths)} label={t('seeByMonth', 'See by month')} />
      {monthly.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {monthly.map(m => (
            <div key={m.monthKey} className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <div className="text-sm font-bold text-slate-200">{m.monthName}</div>
              <div className="text-xs text-slate-400">{m.daysCount} {t('days', 'days')}</div>
              <div className="text-sm font-bold text-emerald-400">{formatCurrency(m.expectedAmount)}</div>
            </div>
          ))}
        </div>
      )}

      {overrides.length > 0 && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200 space-y-1">
          <span className="font-bold block">{t('overridesRecorded', 'Changed from the loan type (this is recorded)')}:</span>
          {overrides.map(o => (
            <div key={o.field}>
              {t(OVERRIDE_KEYS[o.field][0], OVERRIDE_KEYS[o.field][1])}: {o.product_value} → {o.applied_value}
            </div>
          ))}
        </div>
      )}

      {issues.length > 0 && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 space-y-1">
          {issues.map(issue => (
            <div key={issue.code} className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {loanIssueText(issue, t)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
