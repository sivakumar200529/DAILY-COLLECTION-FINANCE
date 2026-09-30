import React, { useEffect, useState } from 'react';
import { CollectionAccount, CustomerPersonalDetails, CollectionPlan, Collector, Area } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { exportTableToExcel } from '../../utils/excelExport';
import { calculateEndDate, calculateMonthlyBreakdown, MonthlyBreakdown } from '../../utils/calendarSchedule';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Wallet, 
  PlusCircle, 
  Search, 
  Filter, 
  CheckCircle2, 
  DollarSign, 
  ExternalLink, 
  RefreshCw,
  Building,
  UserCheck,
  Download,
  X,
  AlertCircle,
  Edit3,
  Trash2,
  Save,
  Check,
  Calendar,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Layers,
  Sliders
} from 'lucide-react';

interface CollectionAccountsViewProps {
  onSelectCustomer: (customerId: string) => void;
  onOpenQuickCollect: (accountId: string) => void;
}

export const CollectionAccountsView: React.FC<CollectionAccountsViewProps> = ({
  onSelectCustomer,
  onOpenQuickCollect,
}) => {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<CollectionAccount[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [plans, setPlans] = useState<CollectionPlan[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // 4-Step Disburse Wizard State (Section 20 & 21)
  const [showDisburseModal, setShowDisburseModal] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [requestedAmount, setRequestedAmount] = useState<number>(10000);
  const [marginPercentage, setMarginPercentage] = useState<number>(12);
  const [collectionDays, setCollectionDays] = useState<number>(100);
  const [isCustomDays, setIsCustomDays] = useState<boolean>(false);
  const [customDaysValue, setCustomDaysValue] = useState<number>(100);
  const [dailyCollection, setDailyCollection] = useState<number>(100);
  const [isDailyAuto, setIsDailyAuto] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedCollectorId, setSelectedCollectorId] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('Bazaar Main Road');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Admin Edit Account Modal State
  const [editingAccount, setEditingAccount] = useState<CollectionAccount | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<CollectionAccount>>({});
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accs, custs, pls, cols, ars] = await Promise.all([
        api.getCollectionAccounts(),
        api.getCustomers(),
        api.getPlans(),
        api.getCollectors(),
        api.getAreas(),
      ]);
      setAccounts(accs);
      setCustomers(custs);
      setPlans(pls);
      setCollectors(cols);
      setAreas(ars);

      if (custs.length > 0 && !selectedCustomerId) setSelectedCustomerId(custs[0].id);
      if (cols.length > 0 && !selectedCollectorId) setSelectedCollectorId(cols[0].id);
      if (ars.length > 0 && !selectedArea) setSelectedArea(ars[0].area_name);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);
  const shopDetails = selectedCustomerObj?.business;

  // Section 3: Auto-suggest shop's default finance margin % when customer is selected
  useEffect(() => {
    if (selectedCustomerObj?.business) {
      const defaultMargin = selectedCustomerObj.business.default_margin_percentage;
      if (defaultMargin !== undefined && defaultMargin !== null) {
        setMarginPercentage(Number(defaultMargin));
      }
      if (selectedCustomerObj.business.shop_area) {
        setSelectedArea(selectedCustomerObj.business.shop_area);
      }
    }
  }, [selectedCustomerId]);

  // Section 5: Finance calculations
  const effectiveDays = isCustomDays ? Number(customDaysValue) || 1 : Number(collectionDays) || 1;
  const marginAmount = Math.round(requestedAmount * (marginPercentage / 100));
  const disbursedAmount = Math.max(0, requestedAmount - marginAmount);
  const totalRepayment = requestedAmount; // Customer repays the original requested amount

  // Auto calculate daily collection
  useEffect(() => {
    if (isDailyAuto && effectiveDays > 0) {
      setDailyCollection(Math.round(totalRepayment / effectiveDays));
    }
  }, [totalRepayment, effectiveDays, isDailyAuto]);

  // Section 8, 9, 12, 13: Exact calendar end date and monthly carryover breakdown
  const calculatedEndDate = calculateEndDate(startDate, effectiveDays);
  const monthlyBreakdown: MonthlyBreakdown[] = calculateMonthlyBreakdown(startDate, effectiveDays, dailyCollection);
  const scheduledTotal = dailyCollection * effectiveDays;
  const repaymentDifference = scheduledTotal - totalRepayment;

  const handleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Section 21: Validation
    if (!selectedCustomerId) {
      setError(t('selectCustomerValidation', 'Please select a customer.'));
      return;
    }
    if (requestedAmount <= 0) {
      setError(t('reqAmountPositive', 'Requested amount must be greater than ₹0.'));
      return;
    }
    if (marginPercentage < 0) {
      setError(t('marginNonNegative', 'Margin % must be 0 or greater.'));
      return;
    }
    if (disbursedAmount < 0) {
      setError(t('disbursedNonNegative', 'Disbursed amount cannot be negative.'));
      return;
    }
    if (effectiveDays <= 0) {
      setError(t('periodPositive', 'Collection period must be at least 1 day.'));
      return;
    }
    if (dailyCollection <= 0) {
      setError(t('dailyPositive', 'Daily collection amount must be greater than ₹0.'));
      return;
    }
    if (!startDate) {
      setError(t('validStartDateReq', 'Valid start date is required.'));
      return;
    }

    setSubmitting(true);
    try {
      await api.createCollectionAccount({
        customer_id: selectedCustomerId,
        requested_amount: requestedAmount,
        margin_percentage: marginPercentage,
        margin_amount: marginAmount,
        disbursed_amount: disbursedAmount,
        daily_collection: dailyCollection,
        collection_days: effectiveDays,
        start_date: startDate,
        expected_end_date: calculatedEndDate,
        assigned_collector_id: selectedCollectorId || (collectors[0]?.id ?? 'COL101'),
        collection_area: selectedArea || 'Bazaar Main Road',
      });

      setShowDisburseModal(false);
      setWizardStep(1);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to disburse collection account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditAccount = (acc: CollectionAccount) => {
    setEditingAccount(acc);
    setEditFormData({
      disbursed_amount: acc.disbursed_amount,
      daily_collection: acc.daily_collection,
      collection_days: acc.collection_days,
      total_repayment: acc.total_repayment,
      amount_collected: acc.amount_collected,
      remaining_amount: acc.remaining_amount,
      completed_days: acc.completed_days,
      remaining_days: acc.remaining_days,
      assigned_collector_id: acc.assigned_collector_id,
      assigned_collector_name: acc.assigned_collector_name,
      collection_area: acc.collection_area,
      status: acc.status,
    });
    setEditError(null);
  };

  const handleSaveEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditSubmitting(true);
    setEditError(null);

    try {
      const coll = collectors.find(c => c.id === editFormData.assigned_collector_id);
      const totalRepay = editFormData.total_repayment ?? (Number(editFormData.daily_collection || 0) * Number(editFormData.collection_days || 0));
      const remaining = editFormData.remaining_amount ?? Math.max(0, totalRepay - Number(editFormData.amount_collected || 0));
      const collected = totalRepay - remaining;
      const margin = totalRepay - Number(editFormData.disbursed_amount || 0);
      const pct = totalRepay > 0 ? Math.min(100, Math.round((collected / totalRepay) * 100)) : 0;
      const remDays = Math.max(0, Number(editFormData.collection_days || 0) - Number(editFormData.completed_days || 0));

      const payload: Partial<CollectionAccount> = {
        ...editFormData,
        total_repayment: totalRepay,
        remaining_amount: remaining,
        amount_collected: collected,
        finance_margin: margin,
        collection_percentage: pct,
        remaining_days: remDays,
        assigned_collector_name: coll ? coll.name : editFormData.assigned_collector_name,
      };

      await api.updateCollectionAccount(editingAccount.id, payload);
      setEditingAccount(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update account');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!editingAccount) return;
    if (!window.confirm(`Are you sure you want to permanently delete account ${editingAccount.id} for ${editingAccount.customer_name}? This action cannot be undone.`)) {
      return;
    }
    setEditSubmitting(true);
    try {
      await api.deleteCollectionAccount(editingAccount.id);
      setEditingAccount(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to delete account');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleExport = () => {
    const headers = [
      'Account ID', 'Customer ID', 'Customer Name', 'Shop Name', 'Plan Name',
      'Requested (₹)', 'Disbursed (₹)', 'Daily (₹)', 'Days', 'Repayment (₹)', 'Margin (₹)',
      'Collected (₹)', 'Remaining (₹)', 'Completed Days', 'Remaining Days', '%', 'Collector', 'Status'
    ];
    const rows = accounts.map(a => [
      a.id, a.customer_id, a.customer_name, a.shop_name || '-', a.plan_name,
      a.requested_amount, a.disbursed_amount, a.daily_collection, a.collection_days, a.total_repayment, a.finance_margin,
      a.amount_collected, a.remaining_amount, a.completed_days, a.remaining_days, `${a.collection_percentage}%`,
      a.assigned_collector_name, a.status
    ]);
    exportTableToExcel('Daily Collection - Collection Accounts Master', headers, rows, 'Daily_Collection_Accounts');
  };

  const allCount = accounts.length;
  const activeCount = accounts.filter(a => a.status === 'ACTIVE' && a.remaining_amount > 0).length;
  const overdueCount = accounts.filter(a => a.status === 'OVERDUE').length;
  const closedCount = accounts.filter(a => a.status === 'COMPLETED' || a.remaining_amount === 0).length;

  let filtered = accounts;
  if (statusFilter === 'CLOSED' || statusFilter === 'COMPLETED') {
    filtered = filtered.filter(a => a.status === 'COMPLETED' || a.remaining_amount === 0);
  } else if (statusFilter === 'ACTIVE') {
    filtered = filtered.filter(a => a.status === 'ACTIVE' && a.remaining_amount > 0);
  } else if (statusFilter !== 'ALL') {
    filtered = filtered.filter(a => a.status === statusFilter);
  }
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(a =>
      a.id.toLowerCase().includes(q) ||
      a.customer_name.toLowerCase().includes(q) ||
      a.customer_id.toLowerCase().includes(q) ||
      (a.shop_name && a.shop_name.toLowerCase().includes(q))
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider">
              {t('disbursementLedger', 'Disbursement & Repayment Ledger')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('total', 'Total')}: {accounts.length} &bull; {t('loanClosed', 'Closed')}: {closedCount}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
            {t('collectionAccountsTitle', 'COLLECTION ACCOUNTS')}
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            {t('accountsDesc', 'Every customer account tracks Requested vs Disbursed amount, 100-day doorstep installment schedules, and finance margins.')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowDisburseModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20 flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('createNewAccount', 'Disburse New Loan')}</span>
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2.5 rounded-xl bg-navy-950 border border-slate-700 hover:border-gold-500/40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{t('excelExport', 'Excel Export')}</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-navy-950 border border-slate-700 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gold-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Quick Category Tabs */}
      <div className="glass-card p-4 rounded-2xl space-y-3">
        {/* Status Tabs per User Request */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            {t('allCustomers', 'All Accounts')} ({allCount})
          </button>

          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            {t('activeLoans', 'Active Loans')} ({activeCount})
          </button>

          <button
            onClick={() => setStatusFilter('OVERDUE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'OVERDUE'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            {t('overdueAccounts', 'Overdue Loans')} ({overdueCount})
          </button>

          <button
            onClick={() => setStatusFilter('CLOSED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              statusFilter === 'CLOSED' || statusFilter === 'COMPLETED'
                ? 'bg-emerald-500 text-navy-950 shadow-md shadow-emerald-500/20'
                : 'text-emerald-400 hover:text-white hover:bg-emerald-500/10 border border-emerald-500/30'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('loanClosed', 'Loan Closed')} ({closedCount})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={t('search', 'Search account ID, customer, shop...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-500"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">{t('showing', 'Showing')} {filtered.length} {t('of', 'of')} {accounts.length} {t('records', 'records')}</span>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-gold-500/20 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-navy-950 text-slate-300 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">{t('accountNumber', 'Account ID')}</th>
                <th className="py-3 px-4">{t('customerAndBusiness', 'Customer & Shop')}</th>
                <th className="py-3 px-4 text-right">{t('requested', 'Requested')}</th>
                <th className="py-3 px-4 text-right">{t('disbursed', 'Disbursed')}</th>
                <th className="py-3 px-4 text-right">{t('dailyDue', 'Daily Due')}</th>
                <th className="py-3 px-4 text-right">{t('totalRepayment', 'Repayment Goal')}</th>
                <th className="py-3 px-4 text-right">{t('financeMargin', 'Margin')}</th>
                <th className="py-3 px-4 text-right">{t('totalCollected', 'Collected')}</th>
                <th className="py-3 px-4 text-right">{t('remainingBalance', 'Remaining')}</th>
                <th className="py-3 px-4">{t('collectionProgress', 'Days Progress')}</th>
                <th className="py-3 px-4 text-center">{t('statusHeader', 'Loan Closed Status')}</th>
                <th className="py-3 px-4 text-center">{t('actions', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(a => {
                const badge = getStatusBadgeClass(a.status);
                const isClosed = a.status === 'COMPLETED' || a.remaining_amount === 0;
                return (
                  <tr key={a.id} className={`hover:bg-slate-800/40 transition-colors ${isClosed ? 'bg-emerald-950/10' : ''}`}>
                    <td className="py-3 px-4 font-mono font-bold text-gold-400">{a.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-xs">{a.customer_name}</div>
                      <span className="text-[10px] text-slate-400 block">{a.shop_name} &bull; {a.collection_area}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">{formatCurrency(a.requested_amount)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gold-400">{formatCurrency(a.disbursed_amount)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-200">{formatCurrency(a.daily_collection)}/d</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-purple-300">{formatCurrency(a.total_repayment)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">{formatCurrency(a.finance_margin)}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-400">{formatCurrency(a.amount_collected)}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-amber-400">{formatCurrency(a.remaining_amount)}</td>
                    <td className="py-3 px-4">
                      <div className="w-24 space-y-1">
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className={isClosed ? 'text-emerald-400 font-bold' : 'text-emerald-400'}>{a.collection_percentage}%</span>
                          <span className="text-slate-400">{a.completed_days}/{a.collection_days}d</span>
                        </div>
                        <div className="w-full bg-navy-950 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isClosed ? 'bg-emerald-400' : 'bg-gold-500'}`} style={{ width: `${Math.min(100, a.collection_percentage)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isClosed ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>{t('loanClosed', 'LOAN CLOSED')}</span>
                          </span>
                          <span className="text-[9px] text-emerald-400/80 font-mono mt-0.5">{t('nilDue', 'Nil Due')} &bull; {t('completed', 'Completed')}</span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {t(a.status, a.status)}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">{a.remaining_days} {t('daysLeft', 'days left')}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onOpenQuickCollect(a.id)}
                          className="px-2.5 py-1 rounded bg-gold-500 hover:bg-gold-400 text-navy-950 text-[11px] font-bold flex items-center gap-1"
                        >
                          <DollarSign className="w-3 h-3" />
                          <span>{t('collectPayment', 'Collect')}</span>
                        </button>
                        <button
                          onClick={() => handleStartEditAccount(a)}
                          className="p-1 rounded bg-navy-950 border border-gold-500/40 text-gold-400 hover:bg-gold-500/20"
                          title={t('Admin Edit Account Parameters', 'Admin Edit Account Parameters')}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectCustomer(a.customer_id)}
                          className="p-1 rounded bg-navy-950 border border-slate-700 text-slate-300 hover:text-white"
                          title={t('View 360° Profile', 'View 360° Profile')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4-STEP DISBURSE NEW COLLECTION ACCOUNT WIZARD (Section 20 & 21) */}
      {showDisburseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/50 p-5 sm:p-6 max-w-2xl w-full bg-navy-900 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Header with Step Tracker */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-gold-400 uppercase tracking-widest block">
                  {t('loanDisbursementEngine', 'Doorstep Loan Disbursement Engine')} &bull; Step {wizardStep} of 4
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  {wizardStep === 1 && t('step1CustomerShop', 'Step 1 — Customer & Shop Selection')}
                  {wizardStep === 2 && t('step2FinanceMargin', 'Step 2 — Requested Amount & Shop Margin')}
                  {wizardStep === 3 && t('step3PeriodSchedule', 'Step 3 — Collection Period & Calendar Schedule')}
                  {wizardStep === 4 && t('step4ReviewConfirm', 'Step 4 — Review & Create Collection Account')}
                </h3>
              </div>
              <button 
                onClick={() => { setShowDisburseModal(false); setWizardStep(1); }} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-4 gap-2 pt-3 pb-4">
              {[
                { step: 1, label: t('customer', 'Customer') },
                { step: 2, label: t('finance', 'Finance') },
                { step: 3, label: t('schedule', 'Schedule') },
                { step: 4, label: t('review', 'Review') },
              ].map(s => (
                <div key={s.step} className="space-y-1">
                  <div className={`h-1.5 rounded-full transition-all ${
                    wizardStep >= s.step ? 'bg-gradient-to-r from-gold-500 to-amber-500' : 'bg-slate-800'
                  }`} />
                  <span className={`text-[10px] font-bold block truncate ${
                    wizardStep === s.step ? 'text-gold-300' : (wizardStep > s.step ? 'text-slate-300' : 'text-slate-500')
                  }`}>
                    {s.step}. {s.label}
                  </span>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: CUSTOMER & SHOP */}
            {wizardStep === 1 && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">{t('selectCustomer', 'Select Customer')}</label>
                  <select
                    value={selectedCustomerId}
                    onChange={e => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white font-medium focus:border-gold-500 focus:outline-none text-xs"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.id}) &bull; {c.business?.shop_name || 'Retail Shop'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCustomerObj && (
                  <div className="p-4 rounded-xl bg-navy-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{selectedCustomerObj.full_name}</h4>
                        <p className="text-[11px] text-slate-400 font-mono">ID: {selectedCustomerObj.id} &bull; 📞 {selectedCustomerObj.mobile_number}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {t('activeCustomer', 'Active Customer')}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">{t('shopBusiness', 'Shop / Commercial Business')}:</span>
                        <strong className="text-slate-200">{shopDetails?.shop_name || 'N/A'}</strong>
                        <span className="text-slate-400 block text-[10px]">{shopDetails?.business_type || 'Retail Trade'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{t('shopAreaAddress', 'Beat / Area Address')}:</span>
                        <span className="text-slate-300">{shopDetails?.shop_address || 'Salem'}</span>
                        <span className="text-slate-400 block text-[10px]">{shopDetails?.shop_area || selectedArea}</span>
                      </div>
                    </div>

                    {/* Section 3: Shop Default Margin Badge */}
                    <div className="p-2.5 rounded-lg bg-gold-500/10 border border-gold-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-gold-400" />
                        <div>
                          <span className="text-[11px] font-bold text-gold-300 block">{t('shopDefaultMarginRate', 'Shop Default Finance Margin %')}</span>
                          <span className="text-[10px] text-slate-400">{t('differentShopsDifferentRates', 'Different shops have customized margin rates. Automatically suggested in Step 2.')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black font-mono text-gold-400">
                          {shopDetails?.default_margin_percentage ?? 12}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDisburseModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                  >
                    {t('cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold shadow-md shadow-gold-500/20 flex items-center gap-1.5"
                  >
                    <span>{t('nextFinanceDetails', 'Next: Finance Details')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: FINANCE & MARGIN */}
            {wizardStep === 2 && (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-300 font-bold">{t('requestedAmount (₹)', 'Requested Amount (₹)')}</label>
                    <span className="text-[10px] text-slate-400 font-mono">{t('originalCustomerRequest', 'Full Amount To Be Repaid')}</span>
                  </div>
                  <input
                    type="number"
                    value={requestedAmount}
                    onChange={e => setRequestedAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-bold focus:border-gold-500 focus:outline-none"
                    placeholder="e.g. 10000"
                    min={100}
                    step={100}
                    required
                  />

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[10000, 15000, 20000, 25000, 50000, 100000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setRequestedAmount(amt)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                          requestedAmount === amt
                            ? 'bg-gold-500 text-navy-950'
                            : 'bg-navy-950 border border-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        ₹{amt.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 2 & 3: Shop Specific Margin % */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-300 font-bold">{t('applicableMarginRate (%)', 'Applicable Finance Margin (%)')}</label>
                    <span className="text-[10px] text-gold-400 font-semibold">
                      {t('shopSuggested', 'Shop Profile Suggested')}: {shopDetails?.default_margin_percentage ?? 12}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={marginPercentage}
                      onChange={e => setMarginPercentage(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3.5 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-gold-300 font-mono text-sm font-bold focus:border-gold-500 focus:outline-none"
                      placeholder="e.g. 12"
                      min={0}
                      max={50}
                      step={0.5}
                      required
                    />
                    <div className="flex gap-1">
                      {[10, 12, 15, 18, 20].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMarginPercentage(m)}
                          className={`px-2 py-2 rounded-lg text-[10px] font-mono font-bold ${
                            marginPercentage === m
                              ? 'bg-amber-500 text-navy-950'
                              : 'bg-navy-950 border border-slate-700 text-slate-300'
                          }`}
                        >
                          {m}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t('marginExplained', 'Margin is deducted upfront before disbursement. Customer repays original requested amount.')}
                  </p>
                </div>

                {/* Section 1 & 5: Live Mathematical Calculation Box */}
                <div className="p-4 rounded-xl bg-navy-950 border border-gold-500/30 space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{t('requestedAmount', 'Requested Amount')}:</span>
                    <strong className="text-white text-sm">{formatCurrency(requestedAmount)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-gold-400">
                    <span>{t('marginDeduction', 'Finance Margin')} ({marginPercentage}%):</span>
                    <strong className="text-sm">− {formatCurrency(marginAmount)}</strong>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center bg-gold-500/10 p-2 rounded-lg">
                    <div>
                      <span className="text-gold-300 font-bold block">{t('disbursedAmount', 'Disbursed Principal')}</span>
                      <span className="text-[10px] text-slate-400 font-sans">{t('givenUpfrontToCustomer', '(Handed directly to customer)')}</span>
                    </div>
                    <strong className="text-gold-300 text-base">{formatCurrency(disbursedAmount)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-purple-300 pt-1">
                    <div>
                      <span className="font-bold block">{t('totalRepaymentGoal', 'Total Repayment Goal')}</span>
                      <span className="text-[10px] text-slate-400 font-sans">{t('repaidViaDailyCollections', '(Repaid via doorstep daily collections)')}</span>
                    </div>
                    <strong className="text-purple-300 text-base">{formatCurrency(totalRepayment)}</strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{t('back', 'Back')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold shadow-md shadow-gold-500/20 flex items-center gap-1.5"
                  >
                    <span>{t('nextSchedule', 'Next: Collection Schedule')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: COLLECTION PERIOD & CALENDAR SCHEDULING */}
            {wizardStep === 3 && (
              <div className="space-y-4 text-xs">
                {/* Section 6: Collection Period */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">{t('collectionPeriodDuration', 'Collection Period (Duration)')}</label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {[30, 50, 60, 90, 100, 120].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => { setCollectionDays(days); setIsCustomDays(false); }}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold font-mono transition-all text-center ${
                          !isCustomDays && collectionDays === days
                            ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
                            : 'bg-navy-950 border border-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        {days} {t('d', 'Days')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsCustomDays(true)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all text-center ${
                        isCustomDays
                          ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
                          : 'bg-navy-950 border border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      {t('custom', 'Custom')}
                    </button>
                  </div>

                  {isCustomDays && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">{t('enterCustomDays', 'Enter Custom Days')}:</span>
                      <input
                        type="number"
                        value={customDaysValue}
                        onChange={e => setCustomDaysValue(Math.max(1, Number(e.target.value)))}
                        className="w-24 px-3 py-1.5 bg-navy-950 border border-gold-500 rounded-lg text-white font-mono text-xs font-bold"
                        min={1}
                        max={365}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Daily Collection Amount */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-slate-300 font-bold">{t('dailyDoorstepDue', 'Daily Doorstep Due')}</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDailyAuto(true);
                          setDailyCollection(Math.round(totalRepayment / effectiveDays));
                        }}
                        className="text-[10px] text-gold-400 underline font-semibold"
                      >
                        {t('autoCalculate', 'Auto-Calculate')}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={dailyCollection}
                        onChange={e => {
                          setIsDailyAuto(false);
                          setDailyCollection(Math.max(1, Number(e.target.value)));
                        }}
                        className="w-full px-3.5 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-bold focus:border-gold-500 focus:outline-none"
                        min={1}
                      />
                      <span className="absolute right-3 top-3 text-[10px] text-slate-400 font-mono">₹ / {t('day', 'day')}</span>
                    </div>
                    {repaymentDifference !== 0 && (
                      <span className="text-[10px] text-amber-400 block mt-0.5">
                        {repaymentDifference > 0 ? `+₹${repaymentDifference} higher than loan goal` : `−₹${Math.abs(repaymentDifference)} lower than loan goal`}
                      </span>
                    )}
                  </div>

                  {/* Section 7: Start Date */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">{t('collectionStartDate', 'Collection Start Date')}</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:border-gold-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Section 8 & 9 & 12: Continuous Calendar End Date & Month-to-Month Carryover */}
                <div className="p-3.5 rounded-xl bg-navy-950 border border-slate-800 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gold-400 block tracking-wider">
                        {t('calculatedCalendarSchedule', 'Continuous Calendar Schedule (Crossing Months)')}
                      </span>
                      <span className="text-[11px] text-slate-300 font-mono">
                        {startDate} → <strong className="text-emerald-400">{calculatedEndDate}</strong> ({effectiveDays} {t('days', 'Days')})
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                      Day 1 to Day {effectiveDays}
                    </span>
                  </div>

                  {/* Section 13: Month-by-Month Carryover Grid */}
                  <div className="space-y-1 pt-1 border-t border-slate-850">
                    <span className="text-[10px] text-slate-400 font-semibold block">{t('monthlyCarryoverExpectedTotals', 'Monthly Carryover & Expected Totals')}:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[10px]">
                      {monthlyBreakdown.map(m => (
                        <div key={m.monthKey} className="p-2 rounded-lg bg-navy-900 border border-slate-800">
                          <strong className="text-slate-200 block font-sans text-[11px] truncate">{m.monthName}</strong>
                          <span className="text-slate-400 block text-[9px]">Days {m.startDayNumber}–{m.endDayNumber} ({m.daysCount}d)</span>
                          <span className="text-emerald-400 font-bold block">{formatCurrency(m.expectedAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Collector & Area */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('assignedCollector', 'Assigned Field Collector')}</label>
                    <select
                      value={selectedCollectorId}
                      onChange={e => setSelectedCollectorId(e.target.value)}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white text-xs"
                    >
                      {collectors.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('collectionArea', 'Collection Beat / Area')}</label>
                    <select
                      value={selectedArea}
                      onChange={e => setSelectedArea(e.target.value)}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white text-xs"
                    >
                      {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{t('back', 'Back')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold shadow-md shadow-gold-500/20 flex items-center gap-1.5"
                  >
                    <span>{t('nextReviewLoan', 'Next: Review Loan')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & VALIDATION */}
            {wizardStep === 4 && (
              <div className="space-y-4 text-xs">
                {/* Section 20 Review Box */}
                <div className="p-4 rounded-2xl bg-navy-950 border border-gold-500/40 space-y-3 font-mono">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-sans">
                    <div>
                      <h4 className="text-sm font-bold text-white">{selectedCustomerObj?.full_name}</h4>
                      <p className="text-[11px] text-gold-400">{shopDetails?.shop_name || 'Retail Business'} &bull; {selectedArea}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gold-500/20 text-gold-300 border border-gold-500/40">
                      {effectiveDays}-Day Plan
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-navy-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">{t('requestedAmount', 'Requested')}</span>
                      <strong className="text-white text-sm">{formatCurrency(requestedAmount)}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-navy-900 border border-slate-800">
                      <span className="text-[10px] text-gold-400 block uppercase">{t('marginRate', 'Margin %')}</span>
                      <strong className="text-gold-400 text-sm">{marginPercentage}% ({formatCurrency(marginAmount)})</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-navy-900 border border-gold-500/30">
                      <span className="text-[10px] text-gold-300 block uppercase font-bold">{t('disbursed', 'Disbursed Principal')}</span>
                      <strong className="text-gold-300 text-sm">{formatCurrency(disbursedAmount)}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-navy-900 border border-purple-500/30">
                      <span className="text-[10px] text-purple-300 block uppercase font-bold">{t('totalRepayment', 'Repayment Goal')}</span>
                      <strong className="text-purple-300 text-sm">{formatCurrency(totalRepayment)}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs pt-1">
                    <div className="p-2 rounded-xl bg-navy-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">{t('dailyCollection', 'Daily Due')}</span>
                      <strong className="text-slate-200">{formatCurrency(dailyCollection)} / day</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-navy-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">{t('collectionPeriod', 'Period')}</span>
                      <strong className="text-slate-200">{effectiveDays} {t('days', 'Days')}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-navy-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">{t('startDate', 'Start Date')}</span>
                      <strong className="text-slate-200">{startDate}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-navy-900 border border-emerald-500/30">
                      <span className="text-[10px] text-emerald-400 block">{t('endDate', 'End Date')}</span>
                      <strong className="text-emerald-400">{calculatedEndDate}</strong>
                    </div>
                  </div>
                </div>

                {/* Section 21: Validation Checklist */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-[11px]">
                  <span className="font-bold text-slate-300 block mb-1 uppercase tracking-wider text-[10px]">{t('financialValidationChecks', 'Financial Validation Checks')}:</span>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('requestedAmountValid', 'Requested Amount > ₹0 and Disbursed Amount mathematically positive')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('marginCalculated', 'Shop-specific margin computed and snapshot preserved permanently')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('calendarScheduleVerified', 'Exact calendar days cross months continuously without Day 1 reset')}</span>
                  </div>
                  {repaymentDifference !== 0 && (
                    <div className="flex items-center gap-2 text-amber-400 pt-1 border-t border-slate-800">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{t('installmentRoundDifference', 'Note: Daily installment rounding creates a')} ₹{Math.abs(repaymentDifference)} {t('differenceAdjustedOnLastInstallment', 'difference, which will be automatically adjusted on Day')} {effectiveDays}.</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{t('backToEdit', 'Back to Edit')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisburse}
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black shadow-lg shadow-gold-500/25 flex items-center gap-2 text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{submitting ? t('creatingAccount...', 'Creating Account & Schedule...') : t('createCollectionAccountBtn', 'CREATE COLLECTION ACCOUNT')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIN EDIT ACCOUNT MODAL */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/50 p-6 max-w-xl w-full bg-navy-900 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/30">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t('adminEditCollectionAccount', 'Admin Edit Collection Account')}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Account: {editingAccount.id} &bull; {editingAccount.customer_name} ({editingAccount.customer_id})
                  </p>
                </div>
              </div>
              <button onClick={() => setEditingAccount(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditAccount} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/20 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center">
                <div className="p-2 rounded-lg bg-navy-900">
                  <span className="text-[10px] text-slate-400 block">{t('requested', 'Requested')}</span>
                  <strong className="text-slate-200 text-xs">{formatCurrency(editingAccount.requested_amount)}</strong>
                </div>
                <div className="p-2 rounded-lg bg-navy-900">
                  <span className="text-[10px] text-gold-400 block">{t('disbursed', 'Disbursed')}</span>
                  <strong className="text-gold-300 text-xs">{formatCurrency(editFormData.disbursed_amount ?? editingAccount.disbursed_amount)}</strong>
                </div>
                <div className="p-2 rounded-lg bg-navy-900">
                  <span className="text-[10px] text-purple-300 block">{t('repayment', 'Repayment')}</span>
                  <strong className="text-purple-300 text-xs">
                    {formatCurrency(
                      editFormData.total_repayment ?? 
                      ((editFormData.daily_collection ?? editingAccount.daily_collection) * (editFormData.collection_days ?? editingAccount.collection_days))
                    )}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-navy-900">
                  <span className="text-[10px] text-emerald-400 block">{t('margin', 'Margin')}</span>
                  <strong className="text-emerald-400 text-xs">
                    {formatCurrency(
                      (editFormData.total_repayment ?? ((editFormData.daily_collection ?? editingAccount.daily_collection) * (editFormData.collection_days ?? editingAccount.collection_days))) -
                      (editFormData.disbursed_amount ?? editingAccount.disbursed_amount)
                    )}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('dailyDoorstepDue', 'Daily Doorstep Due')} (₹/{t('day', 'day')})</label>
                  <input
                    type="number"
                    value={editFormData.daily_collection ?? ''}
                    onChange={e => {
                      const val = Number(e.target.value);
                      const days = editFormData.collection_days ?? editingAccount.collection_days;
                      const newTotal = val * days;
                      setEditFormData({
                        ...editFormData,
                        daily_collection: val,
                        total_repayment: newTotal,
                      });
                    }}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    required
                    min={1}
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('duration (collection days)', 'Duration (Collection Days)')}</label>
                  <input
                    type="number"
                    value={editFormData.collection_days ?? ''}
                    onChange={e => {
                      const days = Number(e.target.value);
                      const daily = editFormData.daily_collection ?? editingAccount.daily_collection;
                      const newTotal = daily * days;
                      setEditFormData({
                        ...editFormData,
                        collection_days: days,
                        total_repayment: newTotal,
                      });
                    }}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    required
                    min={1}
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('disbursedPrincipal (₹)', 'Disbursed Principal (₹)')}</label>
                  <input
                    type="number"
                    value={editFormData.disbursed_amount ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, disbursed_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('totalTargetRepayment (₹)', 'Total Target Repayment (₹)')}</label>
                  <input
                    type="number"
                    value={editFormData.total_repayment ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, total_repayment: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('remainingOutstanding (₹)', 'Remaining Outstanding (₹)')}</label>
                  <input
                    type="number"
                    value={editFormData.remaining_amount ?? ''}
                    onChange={e => {
                      const rem = Number(e.target.value);
                      const total = editFormData.total_repayment ?? editingAccount.total_repayment;
                      const collected = Math.max(0, total - rem);
                      const isZero = rem <= 0;
                      setEditFormData({
                        ...editFormData,
                        remaining_amount: rem,
                        amount_collected: collected,
                        status: isZero ? 'COMPLETED' : (editFormData.status === 'COMPLETED' ? 'ACTIVE' : editFormData.status),
                      });
                    }}
                    className="w-full px-3 py-2 bg-navy-950 border border-amber-500/50 rounded-xl text-amber-300 font-mono font-bold"
                    required
                    min={0}
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{t('setting to 0 moves customer to "loan closed"', 'Setting to 0 moves customer to "LOAN CLOSED"')}</span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('completedDays', 'Completed Days')}</label>
                  <input
                    type="number"
                    value={editFormData.completed_days ?? ''}
                    onChange={e => {
                      const completed = Number(e.target.value);
                      const days = editFormData.collection_days ?? editingAccount.collection_days;
                      setEditFormData({
                        ...editFormData,
                        completed_days: completed,
                        remaining_days: Math.max(0, days - completed),
                      });
                    }}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    min={0}
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('assignedFieldCollector', 'Assigned Field Collector')}</label>
                  <select
                    value={editFormData.assigned_collector_id ?? ''}
                    onChange={e => {
                      const selId = e.target.value;
                      const coll = collectors.find(c => c.id === selId);
                      setEditFormData({
                        ...editFormData,
                        assigned_collector_id: selId,
                        assigned_collector_name: coll ? coll.name : '',
                      });
                    }}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                  >
                    {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('collection area / beat', 'Collection Area / Beat')}</label>
                  <select
                    value={editFormData.collection_area ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, collection_area: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                  >
                    {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">{t('accountLoanStatus', 'Account Loan Status')}</label>
                  <select
                    value={editFormData.status ?? 'ACTIVE'}
                    onChange={e => {
                      const newStatus = e.target.value as any;
                      const update: Partial<CollectionAccount> = { status: newStatus };
                      if (newStatus === 'COMPLETED') {
                        update.remaining_amount = 0;
                      }
                      setEditFormData({ ...editFormData, ...update });
                    }}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="ACTIVE">{t('active (ongoing doorstep dues)', 'ACTIVE (Ongoing Doorstep Dues)')}</option>
                    <option value="OVERDUE">{t('overdue (missed consecutive days)', 'OVERDUE (Missed Consecutive Days)')}</option>
                    <option value="COMPLETED">{t('completed (loan closed • nil dues)', 'COMPLETED (Loan Closed • Nil Dues)')}</option>
                    <option value="SUSPENDED">{t('suspended (temporarily held)', 'SUSPENDED (Temporarily Held)')}</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={editSubmitting}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 font-semibold flex items-center gap-1.5 transition-all text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('deleteAccount', 'Delete Account')}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingAccount(null)}
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
                    <span>{editSubmitting ? t('saving...', 'Saving...') : t('saveAccountChanges', 'Save Account Changes')}</span>
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
