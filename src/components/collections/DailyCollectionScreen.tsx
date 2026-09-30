import React, { useEffect, useState, useMemo } from 'react';
import { DailyCollectionRecord, CollectionAccount, Receipt, Collector, Area, PaymentTransaction } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { ReceiptModal } from './ReceiptModal';
import { 
  Calendar, 
  Search, 
  Filter, 
  Phone, 
  PlusCircle, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Printer, 
  RefreshCw,
  Building,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  X,
  Zap,
  CheckSquare,
  Square,
  History,
  Navigation,
  MapPin,
  Share2,
  Layers,
  ArrowUpDown,
  Check,
  ExternalLink,
  CreditCard,
  Edit3,
  Save,
  MessageSquare
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface DailyCollectionScreenProps {
  onNavigateToCustomer: (customerId: string) => void;
  onNavigateToRegister: () => void;
  preselectedAccountId?: string | null;
  currentUser?: any;
}

export const DailyCollectionScreen: React.FC<DailyCollectionScreenProps> = ({
  onNavigateToCustomer,
  onNavigateToRegister,
  preselectedAccountId,
  currentUser,
}) => {
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [selectedCollector, setSelectedCollector] = useState<string>(() => {
    return currentUser?.role === 'COLLECTOR' && currentUser?.collector_id ? currentUser.collector_id : 'ALL';
  });
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortMode, setSortMode] = useState<'route' | 'pending_first' | 'missed_high' | 'due_high' | 'balance_high'>('route');

  const [collections, setCollections] = useState<DailyCollectionRecord[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Admin Edit Daily Record Modal
  const [editingRecord, setEditingRecord] = useState<DailyCollectionRecord | null>(null);
  const [editRecordData, setEditRecordData] = useState<Partial<DailyCollectionRecord>>({});
  const [editRecordSubmitting, setEditRecordSubmitting] = useState<boolean>(false);
  const [editRecordError, setEditRecordError] = useState<string | null>(null);

  // Selection state for Bulk Collection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkCollectType, setBulkCollectType] = useState<'daily_due' | 'remaining_balance'>('daily_due');
  const [bulkPaymentMode, setBulkPaymentMode] = useState<string>('Cash');
  const [bulkCollectorId, setBulkCollectorId] = useState<string>('');
  const [bulkProcessing, setBulkProcessing] = useState<boolean>(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  // Single Payment Entry Modal
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [activeRecord, setActiveRecord] = useState<DailyCollectionRecord | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(100);
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [collectorId, setCollectorId] = useState<string>('');
  const [isMissed, setIsMissed] = useState<boolean>(false);
  const [missedReason, setMissedReason] = useState<string>('Shop closed today');
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [quickCollectingId, setQuickCollectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Customer Payment History Drawer
  const [historyCustomer, setHistoryCustomer] = useState<{ id: string; name: string; shop?: string } | null>(null);
  const [customerHistoryList, setCustomerHistoryList] = useState<PaymentTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Receipt popup
  const [generatedReceipt, setGeneratedReceipt] = useState<Receipt | null>(null);
  const [receiptCustomerPhone, setReceiptCustomerPhone] = useState<string>('');
  const [successPayment, setSuccessPayment] = useState<{ amount: number; receipt: Receipt; phone: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [colls, cols, ars] = await Promise.all([
        api.getDailyCollections({
          date: selectedDate,
          area: selectedArea,
          collector: selectedCollector,
          status: selectedStatus,
          search: searchQuery,
        }),
        api.getCollectors(),
        api.getAreas(),
      ]);
      setCollections(colls);
      setCollectors(cols);
      setAreas(ars);
      if (cols.length > 0 && !bulkCollectorId) {
        setBulkCollectorId(cols[0].id);
      }

      // If preselected account passed, open modal for it
      if (preselectedAccountId && colls.length > 0) {
        const target = colls.find(c => c.collection_account_id === preselectedAccountId);
        if (target) {
          openPaymentModal(target);
        }
      }
    } catch (err) {
      console.error('Failed to load daily collection data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedArea, selectedCollector, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Sort and filter records
  const sortedCollections = useMemo(() => {
    const list = [...collections];
    switch (sortMode) {
      case 'route':
        return list.sort((a, b) => (a.route_order || 9999) - (b.route_order || 9999));
      case 'pending_first':
        return list.sort((a, b) => {
          const aPending = a.status === 'PENDING' || a.status === 'PARTIAL' ? 0 : 1;
          const bPending = b.status === 'PENDING' || b.status === 'PARTIAL' ? 0 : 1;
          return aPending - bPending;
        });
      case 'missed_high':
        return list.sort((a, b) => (b.missed_days_count || 0) - (a.missed_days_count || 0));
      case 'due_high':
        return list.sort((a, b) => b.daily_due - a.daily_due);
      case 'balance_high':
        return list.sort((a, b) => b.balance_remaining - a.balance_remaining);
      default:
        return list;
    }
  }, [collections, sortMode]);

  // Bulk Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.length === collections.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(collections.map(c => c.collection_account_id));
    }
  };

  const handleSelectPendingOnly = () => {
    const pendingIds = collections
      .filter(c => c.status === 'PENDING' || c.status === 'PARTIAL' || c.status === 'MISSED')
      .map(c => c.collection_account_id);
    setSelectedIds(pendingIds);
  };

  const handleToggleRow = (accId: string) => {
    setSelectedIds(prev => 
      prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]
    );
  };

  const selectedRecords = useMemo(() => {
    return collections.filter(c => selectedIds.includes(c.collection_account_id));
  }, [collections, selectedIds]);

  const selectedTotalDue = useMemo(() => {
    return selectedRecords.reduce((sum, r) => sum + (r.daily_due - r.paid_amount), 0);
  }, [selectedRecords]);

  const selectedTotalRemaining = useMemo(() => {
    return selectedRecords.reduce((sum, r) => sum + r.balance_remaining, 0);
  }, [selectedRecords]);

  // 1-Tap Quick Collect Handler (for fast field collection)
  const handleQuickCollect = async (record: DailyCollectionRecord) => {
    setQuickCollectingId(record.id);
    try {
      const amountToCollect = Math.min(record.balance_remaining, record.daily_due);
      const res = await api.collectPayment({
        collection_account_id: record.collection_account_id,
        collection_date: selectedDate,
        amount_paid: amountToCollect,
        payment_mode: 'Cash',
        collector_id: record.collector_id || collectors[0]?.id || '',
        remarks: '1-Tap Quick Doorstep Cash Collection',
      });

      if (res && res.success) {
        await loadData();
        if (res.receipt) {
          setReceiptCustomerPhone(record.mobile_number || '');
          setGeneratedReceipt(res.receipt);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Quick collection failed');
    } finally {
      setQuickCollectingId(null);
    }
  };

  // Open Payment Modal
  const openPaymentModal = (record: DailyCollectionRecord) => {
    setActiveRecord(record);
    setPaidAmount(record.paid_amount > 0 ? record.paid_amount : record.daily_due);
    setPaymentMode(record.payment_mode || 'Cash');
    setCollectorId(record.collector_id || collectors[0]?.id || '');
    setIsMissed(record.status === 'MISSED');
    setMissedReason(record.reason || 'Shop closed today');
    setRemarks(record.remarks || '');
    setError(null);
    setSuccessPayment(null);
    setShowPaymentModal(true);
  };

  // Submit Single Payment
  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await api.collectPayment({
        collection_account_id: activeRecord.collection_account_id,
        collection_date: selectedDate,
        amount_paid: isMissed ? 0 : Number(paidAmount),
        payment_mode: paymentMode,
        collector_id: collectorId,
        reason: isMissed ? missedReason : undefined,
        remarks: remarks || (isMissed ? missedReason : 'Collected at doorstep'),
        is_missed: isMissed,
      });

      if (res && res.success) {
        await loadData();
        if (res.receipt) {
          setSuccessPayment({
            amount: isMissed ? 0 : Number(paidAmount),
            receipt: res.receipt,
            phone: activeRecord.mobile_number || '',
          });
        } else {
          setShowPaymentModal(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to record collection payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Bulk Collection
  const handleExecuteBulkCollection = async () => {
    if (selectedRecords.length === 0) return;
    setBulkProcessing(true);
    setBulkFeedback(null);

    try {
      const itemsToCollect = selectedRecords.map(rec => ({
        collection_account_id: rec.collection_account_id,
        amount_paid: bulkCollectType === 'remaining_balance' ? rec.balance_remaining : rec.daily_due,
        payment_mode: bulkPaymentMode,
        collector_id: bulkCollectorId,
        remarks: bulkCollectType === 'remaining_balance'
          ? 'Bulk collect remaining balance closing'
          : "Bulk collect today's daily due",
      }));

      const res = await api.bulkCollect({
        items: itemsToCollect,
        collection_date: selectedDate,
        payment_mode: bulkPaymentMode,
        collector_id: bulkCollectorId,
      });

      if (res && res.success) {
        setBulkFeedback(`Successfully collected ${res.processed_count} payments totaling ${formatCurrency(res.total_collected)}!`);
        setSelectedIds([]);
        await loadData();
        setTimeout(() => {
          setShowBulkModal(false);
          setBulkFeedback(null);
          if (res.receipts && res.receipts.length > 0) {
            setGeneratedReceipt(res.receipts[0]);
          }
        }, 1500);
      }
    } catch (err: any) {
      setBulkFeedback(`Bulk error: ${err.message || 'Failed to process bulk collection'}`);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleStartEditRecord = (rec: DailyCollectionRecord) => {
    setEditingRecord(rec);
    setEditRecordData({
      daily_due: rec.daily_due,
      paid_amount: rec.paid_amount,
      route_order: rec.route_order || 1,
      status: rec.status,
      payment_mode: rec.payment_mode || 'Cash',
      collector_id: rec.collector_id,
      collector_name: rec.collector_name,
      reason: rec.reason || '',
      remarks: rec.remarks || '',
      balance_remaining: rec.balance_remaining,
    });
    setEditRecordError(null);
  };

  const handleSaveEditRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setEditRecordSubmitting(true);
    setEditRecordError(null);
    try {
      const coll = collectors.find(c => c.id === editRecordData.collector_id);
      await api.updateDailyCollection(editingRecord.id, {
        ...editRecordData,
        daily_due: Number(editRecordData.daily_due),
        paid_amount: Number(editRecordData.paid_amount),
        route_order: Number(editRecordData.route_order),
        collector_name: coll ? coll.name : editRecordData.collector_name,
      });
      setEditingRecord(null);
      await loadData();
    } catch (err: any) {
      setEditRecordError(err.message || 'Failed to update daily collection record');
    } finally {
      setEditRecordSubmitting(false);
    }
  };

  // Open Customer Payment History Drawer
  const openCustomerHistory = async (record: DailyCollectionRecord) => {
    setHistoryCustomer({ id: record.customer_id, name: record.customer_name, shop: record.shop_name });
    setHistoryLoading(true);
    try {
      const payments = await api.getPayments({ customer_id: record.customer_id });
      setCustomerHistoryList(payments);
    } catch (err) {
      console.error('Failed to load customer payment history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Top metric calculations
  const totalExpected = collections.reduce((s, c) => s + c.daily_due, 0);
  const totalCollected = collections.reduce((s, c) => s + c.paid_amount, 0);
  const totalPending = Math.max(0, totalExpected - totalCollected);
  const totalMissedCount = collections.filter(c => (c.missed_days_count || 0) > 0).length;
  const collectionRate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 pb-24 font-sans">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-5 rounded-2xl border border-gold-500/25">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3 text-gold-400" />
              {t('fieldRapidCollection', 'Rapid Field Collection Engine')}
            </span>
            <span className="text-xs text-slate-400 font-mono">Date: {formatDate(selectedDate)}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            {t('todaysCollectionHeader', "TODAY'S COLLECTION")}
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            {t('dailyCollectionTagline', 'Fastest collection workflow: 1-Tap collect, mobile cards, instant WhatsApp receipts, and full route sequence.')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onNavigateToRegister}
            className="px-3.5 py-2 rounded-xl bg-navy-950 border border-gold-500/30 hover:border-gold-500 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4 text-gold-400" />
            <span>{t('printSlip', 'Print Register')}</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-navy-950 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={t('Refresh Collections', 'Refresh Collections')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gold-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Strip (Section 11: Expected, Collected, Pending, Collection %) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-xl border-l-4 border-l-blue-500">
          <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider block mb-1">{t('totalExpected', 'Total Expected')}</span>
          <span className="text-xl md:text-2xl font-black text-white">{formatCurrency(totalExpected)}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{collections.length} {t('dues', 'dues')}</span>
        </div>

        <div className="glass-card p-4 rounded-xl border-l-4 border-l-emerald-500">
          <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block mb-1">{t('totalCollected', 'Total Collected')}</span>
          <span className="text-xl md:text-2xl font-black text-emerald-400">{formatCurrency(totalCollected)}</span>
          <span className="text-[10px] text-emerald-300/80 block mt-0.5 font-bold">{collectionRate}% {t('collectionRate', 'rate')}</span>
        </div>

        <div className="glass-card p-4 rounded-xl border-l-4 border-l-amber-500">
          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block mb-1">{t('totalPending', 'Total Pending')}</span>
          <span className="text-xl md:text-2xl font-black text-amber-400">{formatCurrency(totalPending)}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{t('pendingDues', 'Pending')}</span>
        </div>

        <div className="glass-card p-4 rounded-xl border-l-4 border-l-rose-500">
          <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block mb-1">{t('missedDays', 'Missed Days / Overdue')}</span>
          <span className="text-xl md:text-2xl font-black text-rose-300">
            {totalMissedCount} {t('customers', 'Customers')}
          </span>
          <span className="text-[10px] text-rose-300/80 block mt-0.5 font-bold">{t('overdue', 'Overdue')}</span>
        </div>
      </div>

      {/* LARGE PROMINENT SEARCH BAR (Section 11 requirement) */}
      <div className="glass-card p-3 md:p-3.5 rounded-2xl border border-gold-500/30 shadow-lg">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="w-5 h-5 text-gold-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder={t('prominentSearchPlaceholder', 'Search customer, mobile, shop or customer ID...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-24 py-3 bg-navy-950/90 border border-slate-700/80 rounded-xl text-sm md:text-base font-semibold text-white placeholder-slate-400 focus:outline-none focus:border-gold-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTimeout(() => loadData(), 50);
              }}
              className="absolute right-20 text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 px-4 py-2 rounded-lg bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs transition-all shadow cursor-pointer"
          >
            {t('search', 'Search')}
          </button>
        </form>
      </div>

      {/* Filter, Sort & Route Sequence Controls */}
      <div className="glass-card p-4 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('date', 'Date')}</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500 font-mono"
            />
          </div>

          {/* Area Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('areas', 'Area')}</label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full px-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500"
            >
              <option value="ALL">{t('allAreas', 'All Areas')}</option>
              {areas.map(a => (
                <option key={a.id} value={a.area_name}>{a.area_name}</option>
              ))}
            </select>
          </div>

          {/* Collector Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('collectors', 'Collector')}</label>
            <select
              value={selectedCollector}
              onChange={(e) => setSelectedCollector(e.target.value)}
              className="w-full px-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500"
            >
              <option value="ALL">{t('allCollectors', 'All Collectors')}</option>
              {collectors.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('statusHeader', 'Status')}</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500"
            >
              <option value="ALL">{t('allStatuses', 'All Statuses')}</option>
              <option value="PENDING">{t('statusPending', 'Pending Dues')}</option>
              <option value="MISSED_DAYS">⚠️ {t('missedDays', 'Missed Days / Overdue')}</option>
              <option value="PAID">{t('statusPaid', 'Paid in Full')}</option>
              <option value="PARTIAL">{t('statusPartial', 'Partial Paid')}</option>
              <option value="MISSED">{t('statusMissed', 'Logged Missed')}</option>
              <option value="ADVANCE">{t('statusAdvance', 'Advance Paid')}</option>
            </select>
          </div>

          {/* Route Order / Sort By */}
          <div>
            <label className="block text-[11px] font-bold text-gold-400 mb-1 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />
              {t('routeOrder', 'Route Order')}
            </label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
              className="w-full px-3 py-2 bg-navy-950/80 border border-gold-500/40 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500 font-medium"
            >
              <option value="route">{t('routeOrder', 'Route Order')} (1, 2, 3...)</option>
              <option value="pending_first">{t('statusPending', 'Pending First')}</option>
              <option value="missed_high">{t('missedDays', 'Most Missed Days First')}</option>
              <option value="due_high">{t('dailyDue', 'Daily Due')} (High to Low)</option>
              <option value="balance_high">{t('remainingBalance', 'Balance')} (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Quick Selection Shortcuts */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="px-2.5 py-1 rounded-lg bg-navy-950 border border-slate-700 hover:border-gold-400 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors font-medium"
            >
              {selectedIds.length === collections.length && collections.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-gold-400" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              <span>Select All ({collections.length})</span>
            </button>

            <button
              type="button"
              onClick={handleSelectPendingOnly}
              className="px-2.5 py-1 rounded-lg bg-navy-950 border border-slate-700 hover:border-gold-400 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors font-medium"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('Select Pending Dues', 'Select Pending Dues')}</span>
            </button>
          </div>

          <div className="font-mono text-[11px]">
            {t('showing', 'Showing')} <strong className="text-white">{sortedCollections.length}</strong> {t('accounts', 'accounts')}
          </div>
        </div>
      </div>

      {/* Desktop Main Daily Collection Working Table (Section 12 requirement) */}
      <div className="hidden md:block glass-card rounded-2xl overflow-hidden border border-gold-500/20 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-navy-950/90 text-slate-300 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === collections.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-700 bg-navy-900 text-gold-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-2 text-center w-14">{t('routeOrder', 'Route')}</th>
                <th className="py-3 px-3">{t('customerId', 'Customer ID')}</th>
                <th className="py-3 px-3">{t('customerAndMobile', 'Customer & Mobile')}</th>
                <th className="py-3 px-3">{t('shopAndArea', 'Shop / Area')}</th>
                <th className="py-3 px-3 text-right">{t('dailyDue', 'Daily Due')}</th>
                <th className="py-3 px-3 text-center">{t('missedDays', 'Missed Status')}</th>
                <th className="py-3 px-3 text-right">{t('paidToday', 'Paid Today')}</th>
                <th className="py-3 px-3 text-right">{t('remainingBalance', 'Remaining Balance')}</th>
                <th className="py-3 px-3 text-center">{t('statusHeader', 'Status')}</th>
                <th className="py-3 px-3 text-center">{t('fastActions', 'Fast Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedCollections.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No collection accounts found matching the current filters.
                  </td>
                </tr>
              ) : (
                sortedCollections.map((row) => {
                  const badge = getStatusBadgeClass(row.status);
                  const isPaidFull = row.status === 'PAID' || row.status === 'ADVANCE';
                  const isSelected = selectedIds.includes(row.collection_account_id);
                  const hasMissed = (row.missed_days_count || 0) > 0;

                  return (
                    <tr 
                      key={row.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-gold-500/10' : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(row.collection_account_id)}
                          className="rounded border-slate-700 bg-navy-900 text-gold-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Route Order */}
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-400">
                        <span className="px-1.5 py-0.5 rounded bg-navy-950 border border-slate-800 text-[10px]">
                          #{row.route_order || 1}
                        </span>
                      </td>

                      {/* Customer ID */}
                      <td className="py-3 px-3 font-mono font-bold text-gold-400">
                        <button
                          onClick={() => {
                            if (currentUser?.role === 'ADMIN') {
                              onNavigateToCustomer(row.customer_id);
                            } else {
                              openCustomerHistory(row);
                            }
                          }}
                          className="hover:underline flex items-center gap-1"
                          title={currentUser?.role === 'ADMIN' ? 'Admin 360 Customer Profile' : 'View Customer Payment History'}
                        >
                          {row.customer_id}
                        </button>
                      </td>

                      {/* Customer & Mobile */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white text-xs">{row.customer_name}</div>
                        {row.mobile_number && (
                          <a
                            href={`tel:${row.mobile_number}`}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-gold-400 font-mono mt-0.5"
                          >
                            <Phone className="w-3 h-3 text-gold-500" />
                            {row.mobile_number}
                          </a>
                        )}
                      </td>

                      {/* Shop / Business */}
                      <td className="py-3 px-3">
                        <div className="text-slate-200 font-medium flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate max-w-[150px]">{row.shop_name || 'Retail Business'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block ml-5">{row.collection_area}</span>
                      </td>

                      {/* Daily Due */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                        {formatCurrency(row.daily_due)}
                      </td>

                      {/* Missed Status Indicator */}
                      <td className="py-3 px-3 text-center">
                        {hasMissed ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                              {row.missed_days_count}d Missed ({formatCurrency(row.missed_amount || row.missed_days_count! * row.daily_due)})
                            </span>
                            {row.missed_days_count! >= 7 && (
                              <span className="text-[9px] text-rose-400 font-bold block mt-0.5">
                                {Math.floor(row.missed_days_count! / 7)}w Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
                            <Check className="w-3 h-3" />
                            Regular
                          </span>
                        )}
                      </td>

                      {/* Paid Today */}
                      <td className="py-3 px-3 text-right font-mono font-extrabold">
                        {row.paid_amount > 0 ? (
                          <span className="text-emerald-400">{formatCurrency(row.paid_amount)}</span>
                        ) : (
                          <span className="text-slate-500">₹0</span>
                        )}
                        {row.advance_amount > 0 && (
                          <span className="block text-[9px] text-amber-400">+{formatCurrency(row.advance_amount)} Adv</span>
                        )}
                      </td>

                      {/* Balance Remaining */}
                      <td className="py-3 px-3 text-right font-mono text-slate-200 font-bold">
                        {formatCurrency(row.balance_remaining)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {row.status}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 1-Tap Quick Collect Button for pending customers */}
                          {!isPaidFull && (
                            <button
                              type="button"
                              onClick={() => handleQuickCollect(row)}
                              disabled={quickCollectingId === row.id}
                              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1 transition-all disabled:opacity-50"
                              title={t("1-Tap Collect Today's Due in Cash", "1-Tap Collect Today's Due in Cash")}
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>{quickCollectingId === row.id ? t('saving...', 'Saving...') : `${t('quick', 'Quick')} ${formatCurrency(row.daily_due)}`}</span>
                            </button>
                          )}

                          {/* Full Collection Modal Button */}
                          <button
                            onClick={() => openPaymentModal(row)}
                            className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all shadow-md ${
                              isPaidFull
                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                : 'bg-navy-950 border border-gold-500/50 hover:bg-gold-500/20 text-gold-300'
                            }`}
                            title={t('Collect custom amount, missed days, or record missed', 'Collect custom amount, missed days, or record missed')}
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>{isPaidFull ? t('edit', 'Edit') : t('collect', 'Collect')}</span>
                          </button>

                          {/* Customer Payment History Drawer */}
                          <button
                            type="button"
                            onClick={() => openCustomerHistory(row)}
                            className="p-1.5 rounded-lg bg-navy-950 border border-slate-700 text-slate-300 hover:text-white"
                            title={t('View Customer Repayment History', 'View Customer Repayment History')}
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {/* Admin Edit Record Button */}
                          {currentUser?.role === 'ADMIN' && (
                            <button
                              type="button"
                              onClick={() => handleStartEditRecord(row)}
                              className="p-1.5 rounded-lg bg-navy-950 border border-gold-500/40 text-gold-400 hover:bg-gold-500/20"
                              title={t('Admin Edit Daily Record (Due, Status, Mode, Route)', 'Admin Edit Daily Record (Due, Status, Mode, Route)')}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* View & WhatsApp Share Receipt Button */}
                          {row.receipt_id && (
                            <button
                              onClick={async () => {
                                const rec = await api.getReceipt(row.receipt_id!);
                                if (rec) {
                                  setReceiptCustomerPhone(row.mobile_number || '');
                                  setGeneratedReceipt(rec);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                              title={t('Print & WhatsApp Share Receipt', 'Print & WhatsApp Share Receipt')}
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Collection Cards View (Section 12: On mobile, convert it into cards) */}
      <div className="block md:hidden space-y-3.5">
        {sortedCollections.length === 0 ? (
          <div className="glass-card p-6 text-center text-slate-400 text-xs rounded-2xl">
            {t('noCollectionAccountsFound', 'No collection accounts found matching the current filters.')}
          </div>
        ) : (
          sortedCollections.map((row) => {
            const badge = getStatusBadgeClass(row.status);
            const isPaidFull = row.status === 'PAID' || row.status === 'ADVANCE';
            const isSelected = selectedIds.includes(row.collection_account_id);
            const hasMissed = (row.missed_days_count || 0) > 0;

            return (
              <div 
                key={row.id}
                className={`glass-card p-4 rounded-2xl border transition-all ${
                  isSelected ? 'border-gold-500 bg-gold-500/10' : 'border-slate-800 hover:border-gold-500/30'
                }`}
              >
                {/* Header: Shop name, Customer ID, Route Order & Status Badge */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleRow(row.collection_account_id)}
                      className="rounded border-slate-700 bg-navy-900 text-gold-500 focus:ring-0 cursor-pointer w-4 h-4 mt-0.5"
                    />
                    <div>
                      <h4 className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" />
                        <span className="truncate max-w-[190px]">{row.shop_name || 'Retail Business'}</span>
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                        <button
                          onClick={() => {
                            if (currentUser?.role === 'ADMIN') {
                              onNavigateToCustomer(row.customer_id);
                            } else {
                              openCustomerHistory(row);
                            }
                          }}
                          className="text-gold-400 font-bold hover:underline"
                        >
                          {row.customer_id}
                        </button>
                        <span>&bull;</span>
                        <span className="text-slate-300 font-medium">{row.customer_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {row.status}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-navy-950 border border-slate-800 text-[9px] font-mono text-slate-400 font-bold">
                      Route #{row.route_order || 1}
                    </span>
                  </div>
                </div>

                {/* Mobile Phone link & Area */}
                <div className="flex items-center justify-between py-2 border-y border-slate-800/80 text-xs mb-3">
                  {row.mobile_number ? (
                    <a
                      href={`tel:${row.mobile_number}`}
                      className="inline-flex items-center gap-1.5 text-slate-300 hover:text-gold-400 font-mono font-semibold"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{row.mobile_number}</span>
                    </a>
                  ) : (
                    <span className="text-slate-500 font-mono text-[11px]">No mobile</span>
                  )}
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {row.collection_area}
                  </span>
                </div>

                {/* 3-Column Financial Snapshot (Section 12: Due, Collected, Remaining) */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-navy-950/80 border border-slate-800 mb-3 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">{t('todayDue', "Today's Due")}</span>
                    <strong className="text-base font-black text-white font-mono block mt-0.5">
                      {formatCurrency(row.daily_due)}
                    </strong>
                  </div>

                  <div className="border-x border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">{t('collected', 'Collected')}</span>
                    <strong className="text-base font-black text-emerald-400 font-mono block mt-0.5">
                      {row.paid_amount > 0 ? formatCurrency(row.paid_amount) : '₹0'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">{t('remaining', 'Remaining')}</span>
                    <strong className="text-base font-black text-amber-400 font-mono block mt-0.5">
                      {formatCurrency(row.balance_remaining)}
                    </strong>
                  </div>
                </div>

                {/* Missed Days alert banner if applicable */}
                {hasMissed && (
                  <div className="mb-3 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {row.missed_days_count} {t('daysMissed', 'days missed')} ({formatCurrency(row.missed_amount || row.missed_days_count! * row.daily_due)})
                    </span>
                    {row.missed_days_count! >= 7 && (
                      <span className="text-[9px] uppercase tracking-wider bg-rose-500 text-white px-1.5 py-0.2 rounded font-black">
                        {Math.floor(row.missed_days_count! / 7)}w Overdue
                      </span>
                    )}
                  </div>
                )}

                {/* Primary Action Button: COLLECT PAYMENT (Section 12: Must be highly visible) */}
                <div className="flex items-center gap-2">
                  {!isPaidFull ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openPaymentModal(row)}
                        className="flex-1 py-3 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Zap className="w-4 h-4 text-emerald-200" />
                        <span>{t('collectPaymentUpper', 'COLLECT PAYMENT')} ({formatCurrency(row.daily_due)})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickCollect(row)}
                        disabled={quickCollectingId === row.id}
                        className="py-3 px-3 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs shadow-md shadow-gold-500/20 flex items-center gap-1"
                        title="1-Tap Instant Cash Collect"
                      >
                        {quickCollectingId === row.id ? '...' : t('1-Tap', '1-Tap')}
                      </button>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('paidToday', 'PAID TODAY')}</span>
                      </div>
                      <button
                        onClick={() => openPaymentModal(row)}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                      >
                        {t('edit', 'Edit')}
                      </button>
                    </div>
                  )}

                  {/* Receipt WhatsApp / Print */}
                  {row.receipt_id && (
                    <button
                      onClick={async () => {
                        const rec = await api.getReceipt(row.receipt_id!);
                        if (rec) {
                          setReceiptCustomerPhone(row.mobile_number || '');
                          setGeneratedReceipt(rec);
                        }
                      }}
                      className="p-3 rounded-xl bg-navy-950 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
                      title={t('Share Receipt', 'Share Receipt')}
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* History button */}
                  <button
                    onClick={() => openCustomerHistory(row)}
                    className="p-3 rounded-xl bg-navy-950 border border-slate-700 text-slate-300 hover:text-white"
                    title={t('View History', 'View History')}
                  >
                    <History className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* STICKY FLOATING BULK COLLECTION ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-4xl mx-auto z-40 bg-navy-900/95 border-2 border-gold-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gold-500 text-navy-950 flex items-center justify-center font-black text-sm shadow-md">
                {selectedIds.length}
              </div>
              <div>
                <span className="text-white font-bold block text-sm">
                  {selectedIds.length} {t('customers selected for bulk processing', 'Customers Selected for Bulk Processing')}
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {t('Total Daily Due:', 'Total Daily Due:')} <strong className="text-gold-400">{formatCurrency(selectedTotalDue)}</strong> &bull; {t('Total Balance:', 'Total Balance:')} <strong className="text-amber-400">{formatCurrency(selectedTotalRemaining)}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setBulkCollectType('daily_due');
                  setShowBulkModal(true);
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>{t('bulk collect today\'s dues', "Bulk Collect Today's Dues")} ({formatCurrency(selectedTotalDue)})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBulkCollectType('remaining_balance');
                  setShowBulkModal(true);
                }}
                className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-navy-950 border border-amber-500/40 hover:bg-amber-500/20 text-amber-300 font-bold text-xs"
              >
                <span>{t('close all balances', 'Close All Balances')} ({formatCurrency(selectedTotalRemaining)})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                title={t('Cancel Selection', 'Cancel Selection')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK COLLECTION MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/40 p-6 max-w-lg w-full bg-navy-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t('bulk collection confirmation', 'Bulk Collection Confirmation')}</h3>
                  <p className="text-xs text-slate-400">{t('process', 'Process')} {selectedRecords.length} {t('accounts simultaneously', 'accounts simultaneously')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bulkFeedback && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{bulkFeedback}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-navy-950 border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('selected accounts:', 'Selected Accounts:')}</span>
                  <strong className="text-white">{selectedRecords.length} {t('Customers', 'Customers')}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('collection type:', 'Collection Type:')}</span>
                  <strong className="text-gold-400">
                    {bulkCollectType === 'daily_due' ? t('today\'s daily due', "Today's Daily Due") : t('full remaining balance', "Full Remaining Balance")}
                  </strong>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-slate-800">
                  <span className="text-slate-300 font-bold">{t('total to collect:', 'Total to Collect:')}</span>
                  <strong className="text-emerald-400 font-mono font-black text-base">
                    {formatCurrency(bulkCollectType === 'daily_due' ? selectedTotalDue : selectedTotalRemaining)}
                  </strong>
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                  {t('payment mode for bulk batch', 'Payment Mode for Bulk Batch')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Cash', 'Razorpay UPI', 'Bank Transfer'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBulkPaymentMode(m)}
                      className={`py-2 px-2 text-center rounded-xl border font-bold transition-all ${
                        bulkPaymentMode === m
                          ? 'bg-gold-500/20 border-gold-500 text-gold-300'
                          : 'bg-navy-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t(m, m)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Collector Selector */}
              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                  {t('collecting agent', 'Collecting Agent')}
                </label>
                <select
                  value={bulkCollectorId}
                  onChange={(e) => setBulkCollectorId(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-white text-xs"
                >
                  {collectors.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.assigned_area})</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleExecuteBulkCollection}
                  disabled={bulkProcessing}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {bulkProcessing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{t('confirm & collect all', 'Confirm & Collect All')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  {t('cancel', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE PAYMENT ENTRY MODAL (With Missed Days & Preset Chips) */}
      {showPaymentModal && activeRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/40 p-6 max-w-lg w-full bg-navy-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gold-500/10 text-gold-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t('doorstep payment collection', 'Doorstep Payment Collection')}</h3>
                  <p className="text-xs text-slate-400">{t('Account:', 'Account:')} {activeRecord.collection_account_id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {successPayment ? (
              /* Success View per Section 14 */
              <div className="py-6 px-2 text-center space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div>
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">
                    ✓ {t('paymentSuccessful', 'PAYMENT SUCCESSFUL')}
                  </span>
                  <h3 className="text-3xl md:text-4xl font-black text-white font-mono mt-1 tracking-tight">
                    {formatCurrency(successPayment.amount)}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    {t('Receipt No:', 'Receipt No:')} <span className="text-gold-400 font-bold">{successPayment.receipt?.receipt_number}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-navy-950 border border-slate-800 text-xs text-slate-300 space-y-1.5 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('Customer:', 'Customer:')}</span>
                    <strong className="text-white">{activeRecord.customer_name} ({activeRecord.customer_id})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('Shop:', 'Shop:')}</span>
                    <span className="text-slate-200 font-medium">{activeRecord.shop_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('Remaining Balance:', 'Remaining Balance:')}</span>
                    <strong className="text-amber-400 font-mono font-bold">
                      {formatCurrency(successPayment.receipt?.remaining_balance ?? Math.max(0, activeRecord.balance_remaining - successPayment.amount))}
                    </strong>
                  </div>
                </div>

                {/* 3 Action Buttons per Section 14: VIEW RECEIPT, SHARE, DONE */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptCustomerPhone(successPayment.phone);
                      setGeneratedReceipt(successPayment.receipt);
                      setShowPaymentModal(false);
                      setSuccessPayment(null);
                    }}
                    className="py-3 px-2 rounded-xl bg-navy-950 border border-gold-500/50 hover:bg-gold-500/20 text-gold-300 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-gold-400" />
                    <span>{t('viewReceipt', 'VIEW RECEIPT')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cleanPhone = (successPayment.phone || '').replace(/\D/g, '');
                      const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                      const msg = encodeURIComponent(
                        `*DAILY COLLECTION - OFFICIAL PAYMENT RECEIPT*\n` +
                        `----------------------------------------\n` +
                        `*Receipt No:* ${successPayment.receipt?.receipt_number}\n` +
                        `*Customer:* ${activeRecord.customer_name} (${activeRecord.customer_id})\n` +
                        `*Shop:* ${activeRecord.shop_name}\n` +
                        `*Amount Paid:* ${formatCurrency(successPayment.amount)}\n` +
                        `*Remaining Balance:* ${formatCurrency(successPayment.receipt?.remaining_balance ?? Math.max(0, activeRecord.balance_remaining - successPayment.amount))}\n` +
                        `*Date:* ${new Date().toLocaleDateString('en-IN')}\n` +
                        `----------------------------------------\n` +
                        `Thank you for your prompt daily payment.\n` +
                        `DAILY COLLECTION • Mount Road, Chennai`
                      );
                      window.open(`https://wa.me/${phoneWithCountry}?text=${msg}`, '_blank');
                    }}
                    className="py-3 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/25 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{t('share', 'SHARE')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentModal(false);
                      setSuccessPayment(null);
                    }}
                    className="py-3 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer"
                  >
                    <span>{t('done', 'DONE')}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCollectSubmit} className="space-y-4">
                {/* Account Quick Glance */}
                <div className="p-3 rounded-xl bg-navy-950/80 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('Customer:', 'Customer:')}</span>
                    <strong className="text-white">{activeRecord.customer_name} ({activeRecord.customer_id})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('Shop:', 'Shop:')}</span>
                    <span className="text-slate-300">{activeRecord.shop_name} ({activeRecord.collection_area})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('Daily Installment Due:', 'Daily Installment Due:')}</span>
                    <strong className="text-gold-400 font-mono">{formatCurrency(activeRecord.daily_due)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('Current Remaining Balance:', 'Current Remaining Balance:')}</span>
                    <strong className="text-amber-400 font-mono">{formatCurrency(activeRecord.balance_remaining)}</strong>
                  </div>
                  {activeRecord.missed_days_count && activeRecord.missed_days_count > 0 && (
                    <div className="flex justify-between pt-1 border-t border-slate-800/80 text-rose-400 font-semibold">
                      <span>{t('missed days', 'Missed Days')} ({activeRecord.missed_days_count} {t('days', 'days')}):</span>
                      <span className="font-mono">{formatCurrency(activeRecord.missed_amount || activeRecord.missed_days_count * activeRecord.daily_due)}</span>
                    </div>
                  )}
                </div>

                {/* Missed / Not Paid Checkbox */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-navy-950 border border-slate-800">
                  <input
                    type="checkbox"
                    id="isMissed"
                    checked={isMissed}
                    onChange={(e) => setIsMissed(e.target.checked)}
                    className="rounded border-slate-700 bg-navy-900 text-rose-500 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="isMissed" className="text-xs font-semibold text-slate-300 cursor-pointer">
                    {t('mark as missed collection (customer unable to pay today)', 'Mark as Missed Collection (Customer unable to pay today)')}
                  </label>
                </div>

                {!isMissed ? (
                  <>
                    {/* Amount Paid Input & Quick Preset Chips */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1 uppercase tracking-wider">
                        {t('Amount Paid (₹)', 'Amount Paid (₹)')}
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          max={activeRecord.balance_remaining}
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(Number(e.target.value))}
                          required
                          className="w-full pl-8 pr-4 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-gold-500 font-mono"
                        />
                      </div>

                      {/* Quick Preset Buttons for Agents visiting 50+ shops */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px] font-mono">
                        <button
                          type="button"
                          onClick={() => setPaidAmount(activeRecord.daily_due)}
                          className="px-2 py-1 rounded-lg bg-navy-950 border border-slate-700 hover:border-gold-500 text-slate-300"
                        >
                          {t('1 day', '1 Day')} ({formatCurrency(activeRecord.daily_due)})
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaidAmount(activeRecord.daily_due * 2)}
                          className="px-2 py-1 rounded-lg bg-navy-950 border border-slate-700 hover:border-gold-500 text-slate-300"
                        >
                          {t('2 days', '2 Days')} ({formatCurrency(activeRecord.daily_due * 2)})
                        </button>

                        {activeRecord.missed_days_count && activeRecord.missed_days_count > 0 && (
                          <button
                            type="button"
                            onClick={() => setPaidAmount(activeRecord.missed_amount || activeRecord.missed_days_count! * activeRecord.daily_due)}
                            className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold"
                          >
                            {activeRecord.missed_days_count} {t('missed days', 'Missed Days')} ({formatCurrency(activeRecord.missed_amount || activeRecord.missed_days_count! * activeRecord.daily_due)})
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setPaidAmount(activeRecord.daily_due * 7)}
                          className="px-2 py-1 rounded-lg bg-navy-950 border border-slate-700 hover:border-gold-500 text-slate-300"
                        >
                          {t('1 week', '1 Week')} ({formatCurrency(activeRecord.daily_due * 7)})
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaidAmount(activeRecord.balance_remaining)}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold ml-auto"
                        >
                          {t('full balance', 'Full Balance')} ({formatCurrency(activeRecord.balance_remaining)})
                        </button>
                      </div>
                    </div>

                    {/* Payment Mode */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1 uppercase tracking-wider">
                        {t('Payment Mode', 'Payment Mode')}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'Cash', label: t('Cash (Agent Doorstep)', 'Cash (Agent Doorstep)'), desc: t('Field Agent In-Person', 'Field Agent In-Person') },
                          { id: 'Razorpay UPI', label: t('Razorpay UPI', 'Razorpay UPI'), desc: t('GPay, PhonePe, QR', 'GPay, PhonePe, QR') },
                          { id: 'Razorpay NetBanking', label: t('Razorpay NetBanking', 'Razorpay NetBanking'), desc: t('Online Bank Gateway', 'Online Bank Gateway') },
                          { id: 'Bank Transfer', label: t('Direct Bank Transfer', 'Direct Bank Transfer'), desc: t('NEFT / IMPS / RTGS', 'NEFT / IMPS / RTGS') },
                        ].map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setPaymentMode(item.id)}
                            className={`py-2 px-2 text-center rounded-xl border transition-all flex flex-col items-center justify-center gap-0.5 ${
                              paymentMode === item.id
                                ? 'bg-gold-500/20 border-gold-500 text-gold-300 font-bold shadow-sm'
                                : 'bg-navy-950 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className="text-xs">{item.label}</span>
                            <span className="text-[9px] text-slate-500">{item.desc}</span>
                          </button>
                        ))}
                      </div>
                      {paymentMode === 'Cash' && (
                        <p className="mt-1.5 text-[10px] text-amber-400/90 font-medium">
                          🛡️ {t('Cash collection policy: Cash is collected strictly in-person by the authorized agent at the customer\'s shop. Instant digital receipt will be recorded.', 'Cash collection policy: Cash is collected strictly in-person by the authorized agent at the customer\'s shop. Instant digital receipt will be recorded.')}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  /* Missed Collection Reason */
                  <div>
                    <label className="block text-xs font-bold text-rose-300 mb-1 uppercase tracking-wider">
                      {t('reason for missed collection', 'Reason for Missed Collection')}
                    </label>
                    <select
                      value={missedReason}
                      onChange={(e) => setMissedReason(e.target.value)}
                      className="w-full px-3 py-2.5 bg-navy-950 border border-rose-500/40 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400"
                    >
                      <option value="Shop closed today">{t('shop closed today', 'Shop closed today')}</option>
                      <option value="Customer out of town">{t('customer out of town', 'Customer out of town')}</option>
                      <option value="Cash shortage - promised tomorrow">{t('cash shortage - promised tomorrow', 'Cash shortage - promised tomorrow')}</option>
                      <option value="Medical / Family emergency">{t('medical / family emergency', 'Medical / Family emergency')}</option>
                      <option value="Bank holiday / ATM issue">{t('bank holiday / atm issue', 'Bank holiday / ATM issue')}</option>
                      <option value="Refused to pay / Dispute">{t('refused to pay / dispute', 'Refused to pay / Dispute')}</option>
                    </select>
                  </div>
                )}

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('remarks / notes', 'Remarks / Notes')}</label>
                  <input
                    type="text"
                    placeholder={t('e.g. Collected cash at cash counter / promised tomorrow morning', 'e.g. Collected cash at cash counter / promised tomorrow morning')}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3.5 py-2 bg-navy-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-500"
                  />
                </div>

                {/* Primary Button: CONFIRM COLLECTION (Section 14 requirement) */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-gold-500 via-amber-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs shadow-lg shadow-gold-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <div className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-navy-950" />
                        <span>{isMissed ? t('RECORD MISSED', 'RECORD MISSED') : `${t('CONFIRM COLLECTION', 'CONFIRM COLLECTION')} (${formatCurrency(paidAmount)})`}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    {t('cancel', 'Cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CUSTOMER REPAYMENT HISTORY DRAWER / SLIDE-OVER */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg h-full bg-navy-900 border-l border-gold-500/30 p-5 overflow-y-auto space-y-4 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gold-500/20 text-gold-400">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{historyCustomer.name}</h3>
                    <p className="text-xs text-slate-400">{historyCustomer.shop || 'Retail'} &bull; {historyCustomer.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryCustomer(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs text-slate-300">
                {t('full payment ledger and digital receipt records for this customer:', 'Full payment ledger and digital receipt records for this customer:')}
              </div>

              {historyLoading ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
                  <span>{t('loading history...', 'Loading history...')}</span>
                </div>
              ) : customerHistoryList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-navy-950 p-4 rounded-xl border border-slate-800">
                  {t('No payment transactions recorded for this customer yet.', 'No payment transactions recorded for this customer yet.')}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {customerHistoryList.map(tx => (
                    <div key={tx.id} className="p-3.5 rounded-xl bg-navy-950 border border-slate-800 space-y-1.5 text-xs hover:border-gold-500/30 transition-colors">
                      <div className="flex justify-between items-center">
                        <strong className="text-gold-400 font-mono">{tx.receipt_number}</strong>
                        <span className="text-slate-400 font-mono">{formatDate(tx.collection_date)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">{t('Amount Paid:', 'Amount Paid:')}</span>
                        <strong className="text-emerald-400 font-mono text-sm">{formatCurrency(tx.amount_paid)}</strong>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>{t('Mode:', 'Mode:')} {t(tx.payment_mode, tx.payment_mode)}</span>
                        <span>{t('Bal after:', 'Bal after:')} {formatCurrency(tx.remaining_balance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setHistoryCustomer(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              {t('Close History', 'Close History')}
            </button>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL WITH WHATSAPP SHARE, THERMAL POS SLIP & PDF */}
      {generatedReceipt && (
        <ReceiptModal
          receipt={generatedReceipt}
          customerMobile={receiptCustomerPhone}
          onClose={() => {
            setGeneratedReceipt(null);
            setReceiptCustomerPhone('');
          }}
          autoClose={true}
        />
      )}

      {/* ADMIN EDIT DAILY RECORD MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/50 p-6 max-w-lg w-full bg-navy-900 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/30">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t('admin edit daily collection record', 'Admin Edit Daily Collection Record')}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {editingRecord.customer_name} ({editingRecord.customer_id}) &bull; {editingRecord.date}
                  </p>
                </div>
              </div>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editRecordError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{editRecordError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditRecord} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-navy-950 border border-slate-800 space-y-1 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>{t('Account ID:', 'Account ID:')}</span>
                  <span className="text-slate-200">{editingRecord.collection_account_id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{t('Shop / Area:', 'Shop / Area:')}</span>
                  <span className="text-slate-200">{editingRecord.shop_name} ({editingRecord.collection_area})</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{t('Remaining Account Bal:', 'Remaining Account Bal:')}</span>
                  <span className="text-amber-400 font-bold">{formatCurrency(editingRecord.balance_remaining)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('daily due (₹)', 'Daily Due (₹)')} *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editRecordData.daily_due ?? ''}
                    onChange={e => setEditRecordData({ ...editRecordData, daily_due: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('paid amount (₹)', 'Paid Amount (₹)')} *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editRecordData.paid_amount ?? ''}
                    onChange={e => {
                      const paid = Number(e.target.value);
                      const due = editRecordData.daily_due ?? editingRecord.daily_due;
                      let newStatus: any = 'PENDING';
                      if (paid >= due) newStatus = 'PAID';
                      else if (paid > 0) newStatus = 'PARTIAL';
                      setEditRecordData({
                        ...editRecordData,
                        paid_amount: paid,
                        status: newStatus,
                      });
                    }}
                    className="w-full px-3 py-2 bg-navy-950 border border-emerald-500/40 rounded-xl text-emerald-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('route order sequence (#)', 'Route Order Sequence (#)')}</label>
                  <input
                    type="number"
                    min={1}
                    value={editRecordData.route_order ?? ''}
                    onChange={e => setEditRecordData({ ...editRecordData, route_order: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('payment status', 'Payment Status')}</label>
                  <select
                    value={editRecordData.status ?? 'PENDING'}
                    onChange={e => setEditRecordData({ ...editRecordData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="PENDING">{t('PENDING', 'PENDING')}</option>
                    <option value="PAID">{t('PAID', 'PAID')}</option>
                    <option value="PARTIAL">{t('PARTIAL', 'PARTIAL')}</option>
                    <option value="MISSED">{t('MISSED', 'MISSED')}</option>
                    <option value="ADVANCE">{t('ADVANCE', 'ADVANCE')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('Payment Mode', 'Payment Mode')}</label>
                  <select
                    value={editRecordData.payment_mode ?? 'Cash'}
                    onChange={e => setEditRecordData({ ...editRecordData, payment_mode: e.target.value as any })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="Cash">{t('Cash (Agent Collected)', 'Cash (Agent Collected)')}</option>
                    <option value="UPI">{t('UPI (GPay / PhonePe / Paytm)', 'UPI (GPay / PhonePe / Paytm)')}</option>
                    <option value="Bank Transfer">{t('Bank Transfer (NEFT / IMPS)', 'Bank Transfer (NEFT / IMPS)')}</option>
                    <option value="Razorpay UPI">{t('Razorpay UPI Gateway', 'Razorpay UPI Gateway')}</option>
                    <option value="Razorpay NetBanking">{t('Razorpay NetBanking', 'Razorpay NetBanking')}</option>
                    <option value="Other">{t('Other Mode', 'Other Mode')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('assigned field collector', 'Assigned Field Collector')}</label>
                  <select
                    value={editRecordData.collector_id ?? ''}
                    onChange={e => setEditRecordData({ ...editRecordData, collector_id: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                  >
                    {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('remarks / reason', 'Remarks / Reason')}</label>
                <input
                  type="text"
                  placeholder={t('e.g. Paid at shop, or reason for delay', 'e.g. Paid at shop, or reason for delay')}
                  value={editRecordData.remarks ?? editRecordData.reason ?? ''}
                  onChange={e => setEditRecordData({ ...editRecordData, remarks: e.target.value, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editRecordSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold shadow-md shadow-gold-500/20 flex items-center gap-1.5 text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editRecordSubmitting ? t('Saving...', 'Saving...') : t('save record changes', 'Save Record Changes')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
