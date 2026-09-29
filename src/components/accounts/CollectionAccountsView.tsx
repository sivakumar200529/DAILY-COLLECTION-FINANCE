import React, { useEffect, useState } from 'react';
import { CollectionAccount, CustomerPersonalDetails, CollectionPlan, Collector, Area } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { exportTableToExcel } from '../../utils/excelExport';
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
  Check
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
  const [customers, setCustomers] = useState<CustomerPersonalDetails[]>([]);
  const [plans, setPlans] = useState<CollectionPlan[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Disburse Modal State
  const [showDisburseModal, setShowDisburseModal] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedCollectorId, setSelectedCollectorId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
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

      if (custs.length > 0) setSelectedCustomerId(custs[0].id);
      if (pls.length > 0) setSelectedPlanId(pls[0].id);
      if (cols.length > 0) setSelectedCollectorId(cols[0].id);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.createCollectionAccount({
        customer_id: selectedCustomerId,
        plan_id: selectedPlanId,
        assigned_collector_id: selectedCollectorId,
        start_date: startDate,
      });

      setShowDisburseModal(false);
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

  const selectedPlanObj = plans.find(p => p.id === selectedPlanId);

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

      {/* DISBURSE NEW LOAN MODAL */}
      {showDisburseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/40 p-6 max-w-lg w-full bg-navy-900 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">{t('disburseNewCollectionAccount', 'Disburse New Collection Account')}</h3>
              <button onClick={() => setShowDisburseModal(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleDisburse} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('selectCustomer', 'Select Customer')}</label>
                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('selectCollectionPlan', 'Select Collection Plan')}</label>
                <select
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.plan_name}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic Model Calculation Box */}
              {selectedPlanObj && (
                <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/30 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">{t('requested', 'Requested')}:</span> <strong className="text-white">{formatCurrency(selectedPlanObj.requested_amount)}</strong></div>
                  <div className="flex justify-between"><span className="text-gold-400 font-bold">{t('disbursed (given to cust)', 'Disbursed (Given to Cust)')}:</span> <strong className="text-gold-300">{formatCurrency(selectedPlanObj.disbursed_amount)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-400">{t('dailyDoorstepDue', 'Daily Doorstep Due')}:</span> <span>{formatCurrency(selectedPlanObj.daily_collection)} / {t('day', 'day')}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">{t('duration', 'Duration')}:</span> <span>{selectedPlanObj.collection_days} {t('days', 'Days')}</span></div>
                  <div className="flex justify-between pt-1 border-t border-slate-800"><span className="text-purple-300 font-bold">{t('totalRepayment', 'Total Repayment')}:</span> <strong className="text-purple-300">{formatCurrency(selectedPlanObj.total_repayment)}</strong></div>
                  <div className="flex justify-between"><span className="text-emerald-400 font-bold">{t('financeMargin', 'Finance Margin')}:</span> <strong className="text-emerald-400">{formatCurrency(selectedPlanObj.finance_margin)}</strong></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('assignedCollector', 'Assigned Collector')}</label>
                  <select
                    value={selectedCollectorId}
                    onChange={e => setSelectedCollectorId(e.target.value)}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                  >
                    {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('startDate', 'Start Date')}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold shadow-md shadow-gold-500/20"
                >
                  {submitting ? t('disbursing...', 'Disbursing...') : t('confirmLoanAndDisburse', 'Confirm Loan & Disburse')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300"
                >
                  {t('cancel', 'Cancel')}
                </button>
              </div>
            </form>
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
