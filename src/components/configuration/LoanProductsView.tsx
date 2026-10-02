import React, { useState } from 'react';
import { Edit3, Package, PlusCircle, Save, Trash2, X } from 'lucide-react';
import { LoanProduct } from '../../types';
import { calculateLoan, todayIso } from '../../../shared/finance';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency } from '../../utils/formatters';
import { ListEditor, Notice, inputClass, primaryButtonClass, useSaveNotice } from './ConfigShared';
import { BigButton, ConfirmSheet } from '../common/ui';

/** A new loan type starts from the periods and interest of the existing ones. */
function newProduct(existing: LoanProduct[]): LoanProduct {
  const known = Array.from(new Set(existing.flatMap(p => p.day_options))).sort((a, b) => a - b);
  const days = known.length > 0 ? known : [100];
  return {
    id: `PROD-${Date.now().toString(36).toUpperCase()}`,
    name: '',
    description: '',
    margin_percentage: existing[0]?.margin_percentage ?? 0,
    day_options: days,
    default_days: days[days.length - 1],
    min_amount: 0,
    max_amount: 0,
    allow_overrides: true,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
  };
}

/** Loan types: the terms every loan starts from (interest, periods, amount limits, whether staff may change them). */
export const LoanProductsView: React.FC = () => {
  const { config, updateSection } = useConfig();
  const { t } = useLanguage();
  const [editing, setEditing] = useState<LoanProduct | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<LoanProduct | null>(null);
  const { notice, saving, run } = useSaveNotice();

  const products = config.loan_products;

  const save = (next: LoanProduct[], message: string) =>
    run(async () => {
      await updateSection('loan_products', next);
      setEditing(null);
    }, message);

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const next = isNew ? [...products, editing] : products.map(p => (p.id === editing.id ? editing : p));
    save(next, `${t('saved', 'Saved')}: ${editing.name}`);
  };

  const handleDelete = (p: LoanProduct) => {
    setDeleting(null);
    save(products.filter(x => x.id !== p.id), `${t('removed', 'Removed')}: ${p.name}`);
  };

  const exampleAmount = (p: LoanProduct) => p.min_amount > 0 ? p.min_amount : p.max_amount;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        {t('loanTypesDesc', 'Every loan starts from a loan type. If "can change" is on, staff may change interest, days or daily payment for one loan; each change is recorded.')}
      </p>
      <BigButton tone="gold" icon={PlusCircle} label={t('addLoanType', 'Add loan type')} onClick={() => { setEditing(newProduct(products)); setIsNew(true); }} />
      <Notice notice={notice} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => {
          const amount = exampleAmount(p);
          const example = amount > 0
            ? calculateLoan({ requested_amount: amount, margin_percentage: p.margin_percentage, collection_days: p.default_days, start_date: todayIso() })
            : null;
          return (
            <div key={p.id} className={`glass-card p-5 rounded-2xl border ${p.status === 'ACTIVE' ? 'border-slate-800 hover:border-gold-500/30' : 'border-slate-800 opacity-60'}`}>
              <div className="mb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-gold-400 font-bold">{p.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${p.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                    {t(p.status, p.status)}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white leading-snug">{p.name}</h3>
                {p.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</p>}
              </div>

              <div className="space-y-1.5 text-xs py-3 border-t border-b border-slate-800 font-mono">
                <div className="flex justify-between"><span className="text-slate-400">{t('interestPercent', 'Interest %')}</span><span className="text-gold-300 font-bold">{p.margin_percentage}%</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('collectionDays', 'Periods')}</span><span className="text-slate-200">{p.day_options.join(' / ')} ({t('default', 'default')} {p.default_days})</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('amountRange', 'Amount')}</span><span className="text-slate-200">{p.min_amount > 0 ? formatCurrency(p.min_amount) : '—'} – {p.max_amount > 0 ? formatCurrency(p.max_amount) : '∞'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('canChange', 'Can change per loan')}</span><span className="text-slate-200">{p.allow_overrides ? t('yes', 'Yes') : t('no', 'No')}</span></div>
                {example && (
                  <div className="pt-2 mt-1 border-t border-dashed border-slate-800 text-[11px] text-slate-400">
                    {formatCurrency(example.requested_amount)} → {t('disbursed', 'disbursed')} <span className="text-gold-300">{formatCurrency(example.disbursed_amount)}</span>, {formatCurrency(example.daily_collection)} × {example.collection_days}d
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-1.5 pt-3">
                <button type="button" onClick={() => setDeleting(p)} className="px-2 py-1 rounded-lg bg-navy-950 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-semibold flex items-center gap-1">
                  <Trash2 className="w-3 h-3" />
                  {t('delete', 'Delete')}
                </button>
                <button type="button" onClick={() => { setEditing({ ...p }); setIsNew(false); }} className="px-2 py-1 rounded-lg bg-navy-950 hover:bg-gold-500/20 border border-gold-500/30 text-gold-300 text-[10px] font-semibold flex items-center gap-1">
                  <Edit3 className="w-3 h-3" />
                  {t('edit', 'Edit')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <form onSubmit={handleSaveProduct} className="glass-card rounded-2xl border border-gold-500/40 p-6 max-w-lg w-full bg-navy-900 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-gold-400" />
                <h3 className="text-base font-bold text-white">{isNew ? t('addLoanType', 'Add loan type') : t('editLoanType', 'Edit loan type')}</h3>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">{t('productName', 'Name')} *</label>
              <input className={inputClass} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">{t('description', 'Description')}</label>
              <input className={inputClass} value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('interestPercent', 'Interest %')}</label>
                <input type="number" min={0} max={99} step={0.5} className={`${inputClass} font-mono`} value={editing.margin_percentage} onChange={e => setEditing({ ...editing, margin_percentage: Number(e.target.value) })} required />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('minAmount', 'Min amount')}</label>
                <input type="number" min={0} className={`${inputClass} font-mono`} value={editing.min_amount} onChange={e => setEditing({ ...editing, min_amount: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('maxAmount', 'Max amount')}</label>
                <input type="number" min={0} className={`${inputClass} font-mono`} value={editing.max_amount} onChange={e => setEditing({ ...editing, max_amount: Number(e.target.value) })} />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 -mt-2">{t('zeroNoLimit', '0 means no limit.')}</p>

            <ListEditor<number>
              label={t('collectionPeriods', 'Collection periods (days)')}
              values={editing.day_options}
              numeric
              suffix="d"
              onChange={days => setEditing({
                ...editing,
                day_options: days,
                default_days: days.includes(editing.default_days) ? editing.default_days : (days[days.length - 1] ?? 0),
              })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('defaultDays', 'Default period')}</label>
                <select className={inputClass} value={editing.default_days} onChange={e => setEditing({ ...editing, default_days: Number(e.target.value) })}>
                  {editing.day_options.map(d => <option key={d} value={d}>{d} {t('days', 'days')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('statusHeader', 'Status')}</label>
                <select className={inputClass} value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as LoanProduct['status'] })}>
                  <option value="ACTIVE">{t('ACTIVE', 'Active')}</option>
                  <option value="INACTIVE">{t('INACTIVE', 'Inactive')}</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-slate-300 font-semibold">
              <input type="checkbox" checked={editing.allow_overrides} onChange={e => setEditing({ ...editing, allow_overrides: e.target.checked })} className="w-4 h-4 accent-amber-500" />
              {t('allowOverrides', 'Staff can change interest, days and daily payment for one loan (recorded)')}
            </label>

            <Notice notice={notice} />

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold">
                {t('cancel', 'Cancel')}
              </button>
              <button type="submit" disabled={saving || editing.day_options.length === 0} className={primaryButtonClass}>
                <Save className="w-4 h-4" />
                <span>{saving ? t('saving', 'Saving...') : t('save', 'Save')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <ConfirmSheet
          title={t('removeLoanTypeQuestion', 'Remove this loan type?')}
          message={`${deleting.name}. ${t('removeLoanTypeExplain', 'A loan type already used by loans cannot be removed; switch it to Inactive instead.')}`}
          yesLabel={t('yesRemove', 'Yes, remove')}
          noLabel={t('no', 'No')}
          danger
          busy={saving}
          onYes={() => handleDelete(deleting)}
          onNo={() => setDeleting(null)}
        />
      )}
    </div>
  );
};
