import React, { useEffect, useState } from 'react';
import { CollectionPlan } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, safeRound } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Layers, 
  PlusCircle, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  Calculator,
  RefreshCw,
  X,
  Edit3,
  Trash2,
  Save
} from 'lucide-react';

export const CollectionPlansView: React.FC = () => {
  const { t } = useLanguage();
  const [plans, setPlans] = useState<CollectionPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Admin Edit Plan Modal State
  const [editingPlan, setEditingPlan] = useState<CollectionPlan | null>(null);
  const [editPlanData, setEditPlanData] = useState<Partial<CollectionPlan>>({});
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Form State
  const [planName, setPlanName] = useState<string>('Standard 100-Day Plan');
  const [requestedAmount, setRequestedAmount] = useState<number>(10000);
  const [disbursedAmount, setDisbursedAmount] = useState<number>(8800);
  const [dailyCollection, setDailyCollection] = useState<number>(100);
  const [collectionDays, setCollectionDays] = useState<number>(100);
  const [description, setDescription] = useState<string>('');

  // Automatically computed formula (Section 2 requirement)
  const totalRepayment = safeRound(dailyCollection * collectionDays, 2);
  const financeMargin = safeRound(totalRepayment - disbursedAmount, 2);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await api.getPlans();
      setPlans(data);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (requestedAmount <= 0 || disbursedAmount <= 0 || dailyCollection <= 0 || collectionDays <= 0) {
      setError('All amounts and duration must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createPlan({
        plan_name: planName,
        requested_amount: Number(requestedAmount),
        disbursed_amount: Number(disbursedAmount),
        daily_collection: Number(dailyCollection),
        collection_days: Number(collectionDays),
        description: description || `${formatCurrency(requestedAmount)} requested, ${formatCurrency(disbursedAmount)} disbursed. Margin: ${formatCurrency(financeMargin)}`,
      });
      setShowAddModal(false);
      resetForm();
      await loadPlans();
    } catch (err: any) {
      setError(err.message || 'Failed to create plan');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setPlanName('Standard 100-Day Plan');
    setRequestedAmount(10000);
    setDisbursedAmount(8800);
    setDailyCollection(100);
    setCollectionDays(100);
    setDescription('');
  };

  const handleStartEditPlan = (p: CollectionPlan) => {
    setEditingPlan(p);
    setEditPlanData({
      plan_name: p.plan_name,
      requested_amount: p.requested_amount,
      disbursed_amount: p.disbursed_amount,
      daily_collection: p.daily_collection,
      collection_days: p.collection_days,
      status: p.status,
      description: p.description,
    });
    setEditError(null);
  };

  const handleSaveEditPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const daily = Number(editPlanData.daily_collection || 0);
      const days = Number(editPlanData.collection_days || 0);
      const disb = Number(editPlanData.disbursed_amount || 0);
      const totalRepay = safeRound(daily * days, 2);
      const margin = safeRound(totalRepay - disb, 2);

      await api.updatePlan(editingPlan.id, {
        ...editPlanData,
        requested_amount: Number(editPlanData.requested_amount),
        disbursed_amount: disb,
        daily_collection: daily,
        collection_days: days,
        total_repayment: totalRepay,
        finance_margin: margin,
      });

      setEditingPlan(null);
      await loadPlans();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update plan');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!editingPlan) return;
    if (!window.confirm(`Are you sure you want to permanently delete plan "${editingPlan.plan_name}" (${editingPlan.id})?`)) return;
    setEditSubmitting(true);
    try {
      await api.deletePlan(editingPlan.id);
      setEditingPlan(null);
      await loadPlans();
    } catch (err: any) {
      setEditError(err.message || 'Failed to delete plan');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Banner */}
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider">
              {t('financialArchitecture', 'Financial Architecture')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('100-Day Dynamic Formula', '100-Day Dynamic Formula')}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            {t('collectionPlansTitle', 'FLEXIBLE COLLECTION PLANS')}
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            {t('plansDesc', 'Configure flexible doorstep daily collection schemes. The system strictly isolates Requested Amount from Disbursed Amount and automatically computes Repayment and Margin.')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20 flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('createNewPlan', 'Create Custom Plan')}</span>
          </button>
          <button
            onClick={loadPlans}
            disabled={loading}
            className="p-2.5 rounded-xl bg-navy-950 border border-slate-700 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gold-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((p) => {
          const isStandard10k = p.requested_amount === 10000 && p.disbursed_amount === 8800;

          return (
            <div
              key={p.id}
              className={`glass-card p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
                isStandard10k
                  ? 'border-gold-500/50 bg-gradient-to-br from-gold-950/20 via-navy-900 to-navy-900 shadow-xl shadow-gold-500/10'
                  : 'border-slate-800 hover:border-gold-500/30'
              }`}
            >
              {isStandard10k && (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-gold-500 text-navy-950 font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3" />
                  {t('Core Model', 'Core Model')}
                </div>
              )}

              <div className="mb-3">
                <span className="text-[10px] font-mono text-gold-400 font-bold">{p.id}</span>
                <h3 className="text-base font-bold text-white leading-snug">{p.plan_name}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {p.description}
                </p>
              </div>

              {/* Formula Metrics Breakdown */}
              <div className="space-y-2 text-xs py-3 my-3 border-t border-b border-slate-800 font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">{t('loanAmount', 'Requested Amount')}:</span>
                  <span className="text-white font-bold">{formatCurrency(p.requested_amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gold-400 font-semibold">{t('disbursed', 'Disbursed to Customer')}:</span>
                  <span className="text-gold-300 font-black">{formatCurrency(p.disbursed_amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">{t('dailyDue', 'Daily Doorstep Due')}:</span>
                  <span className="text-slate-200">{formatCurrency(p.daily_collection)} / d</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">{t('collectionDays', 'Collection Period')}:</span>
                  <span className="text-slate-200">{p.collection_days} {t('days', 'Days')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-800">
                  <span className="text-purple-300 font-semibold">{t('totalRepayment', 'Total Repayment')}:</span>
                  <span className="text-purple-300 font-bold">{formatCurrency(p.total_repayment)}</span>
                </div>
                <div className="flex justify-between items-center bg-gold-500/10 p-2 rounded-lg border border-gold-500/20">
                  <span className="text-gold-400 font-bold">{t('financeMargin', 'Finance Margin')}:</span>
                  <span className="text-gold-400 font-black text-sm">{formatCurrency(p.finance_margin)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 mt-1">
                <span>{t('statusHeader', 'Status')}: <strong className="text-emerald-400 font-semibold">{t(p.status, p.status)}</strong></span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-slate-500">{formatCurrency(p.daily_collection)} &times; {p.collection_days}d</span>
                  <button
                    onClick={() => handleStartEditPlan(p)}
                    className="px-2 py-1 rounded-lg bg-navy-950 hover:bg-gold-500/20 border border-gold-500/30 text-gold-300 font-semibold text-[10px] flex items-center gap-1 transition-all"
                    title={t('edit', 'Edit')}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{t('edit', 'Edit')}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE PLAN MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/40 p-6 max-w-lg w-full bg-navy-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-gold-400" />
                <h3 className="text-base font-bold text-white">{t('Create New Collection Plan', 'Create New Collection Plan')}</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('Plan Name', 'Plan Name')} *</label>
                <input
                  type="text"
                  required
                  placeholder={t('e.g. Silver 100-Day Plan (₹20,000)', 'e.g. Silver 100-Day Plan (₹20,000)')}
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('Requested Amount (₹)', 'Requested Amount (₹)')} *</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    required
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-gold-400 font-bold mb-1 uppercase tracking-wider">{t('Disbursed Amount (₹)', 'Disbursed Amount (₹)')} *</label>
                  <input
                    type="number"
                    min="500"
                    step="100"
                    required
                    value={disbursedAmount}
                    onChange={(e) => setDisbursedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-navy-950 border border-gold-500/40 rounded-xl text-gold-300 focus:border-gold-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('Daily Collection (₹)', 'Daily Collection (₹)')} *</label>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    required
                    value={dailyCollection}
                    onChange={(e) => setDailyCollection(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('Collection Days', 'Collection Days')} *</label>
                  <input
                    type="number"
                    min="10"
                    max="365"
                    required
                    value={collectionDays}
                    onChange={(e) => setCollectionDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                  />
                </div>
              </div>

              {/* Live Formula Preview Box */}
              <div className="p-3.5 rounded-xl bg-navy-950 border border-gold-500/30 space-y-2">
                <span className="text-[10px] font-bold text-gold-400 uppercase tracking-widest block">
                  {t('Automatic Live Formula Calculation', 'Automatic Live Formula Calculation')}
                </span>
                <div className="flex justify-between items-center font-mono">
                  <span className="text-slate-400">{t('Total Customer Repayment:', 'Total Customer Repayment:')}</span>
                  <strong className="text-purple-300 text-sm">
                    {formatCurrency(totalRepayment)}
                  </strong>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  = {formatCurrency(dailyCollection)} &times; {collectionDays} {t('days', 'days')}
                </div>

                <div className="flex justify-between items-center font-mono pt-1.5 border-t border-slate-800">
                  <span className="text-gold-400 font-bold">{t('financeMargin', 'Finance Margin')}:</span>
                  <strong className="text-gold-400 text-base">
                    {formatCurrency(financeMargin)}
                  </strong>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  = {formatCurrency(totalRepayment)} ({t('repay', 'Repay')}) &minus; {formatCurrency(disbursedAmount)} ({t('disbursed', 'Disbursed')})
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('description', 'Description')}</label>
                <input
                  type="text"
                  placeholder={t('Optional plan description...', 'Optional plan description...')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20"
                >
                  {submitting ? t('Creating...', 'Creating...') : t('Save Collection Plan', 'Save Collection Plan')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  {t('cancel', 'Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN EDIT PLAN MODAL */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/50 p-6 max-w-lg w-full bg-navy-900 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/30">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t('Admin Edit Collection Plan', 'Admin Edit Collection Plan')}</h3>
                  <p className="text-xs text-slate-400 font-mono">{t('Plan ID:', 'Plan ID:')} {editingPlan.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditPlan} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('Plan Name', 'Plan Name')} *</label>
                <input
                  type="text"
                  required
                  value={editPlanData.plan_name ?? ''}
                  onChange={(e) => setEditPlanData({ ...editPlanData, plan_name: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('Requested (₹)', 'Requested (₹)')} *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editPlanData.requested_amount ?? ''}
                    onChange={(e) => setEditPlanData({ ...editPlanData, requested_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-gold-400 font-semibold mb-1 uppercase tracking-wider">{t('Disbursed (₹)', 'Disbursed (₹)')} *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editPlanData.disbursed_amount ?? ''}
                    onChange={(e) => setEditPlanData({ ...editPlanData, disbursed_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-navy-950 border border-gold-500/40 rounded-xl text-gold-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('daily due (₹)', 'Daily Due (₹)')} *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editPlanData.daily_collection ?? ''}
                    onChange={(e) => setEditPlanData({ ...editPlanData, daily_collection: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('Days (Duration)', 'Days (Duration)')} *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editPlanData.collection_days ?? ''}
                    onChange={(e) => setEditPlanData({ ...editPlanData, collection_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              {/* Live Formula Preview Box */}
              <div className="p-3.5 rounded-xl bg-navy-950 border border-gold-500/30 space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>{t('Computed Repayment', 'Computed Repayment')} ({editPlanData.daily_collection || 0} &times; {editPlanData.collection_days || 0}d):</span>
                  <span className="text-purple-300 font-bold">
                    {formatCurrency(safeRound(Number(editPlanData.daily_collection || 0) * Number(editPlanData.collection_days || 0), 2))}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800">
                  <span className="text-gold-400 font-bold">{t('Calculated Finance Margin:', 'Calculated Finance Margin:')}</span>
                  <span className="text-gold-400 font-black text-sm">
                    {formatCurrency(safeRound(
                      (Number(editPlanData.daily_collection || 0) * Number(editPlanData.collection_days || 0)) -
                      Number(editPlanData.disbursed_amount || 0),
                      2
                    ))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('Plan Status', 'Plan Status')}</label>
                  <select
                    value={editPlanData.status ?? 'ACTIVE'}
                    onChange={(e) => setEditPlanData({ ...editPlanData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="ACTIVE">{t('active', 'ACTIVE')}</option>
                    <option value="INACTIVE">{t('INACTIVE', 'INACTIVE')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">{t('description', 'Description')}</label>
                  <input
                    type="text"
                    value={editPlanData.description ?? ''}
                    onChange={(e) => setEditPlanData({ ...editPlanData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleDeletePlan}
                  disabled={editSubmitting}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 font-semibold flex items-center gap-1.5 transition-all text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('Delete Plan', 'Delete Plan')}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs"
                  >
                    {t('cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold shadow-md shadow-gold-500/20 flex items-center gap-1.5 text-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{editSubmitting ? t('Saving...', 'Saving...') : t('Save Plan Changes', 'Save Plan Changes')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
