import React, { useEffect, useState } from 'react';
import { CustomerPersonalDetails, CustomerAddress, BusinessDetails, CollectionAccount, Area, Collector } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { exportTableToExcel } from '../../utils/excelExport';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Building, 
  Phone, 
  MapPin, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  Download, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  DollarSign, 
  AlertCircle, 
  Save,
  Plus,
  Wallet,
  CalendarCheck,
  Sparkles,
  Clock
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

function calculateEndDate(startDate: string, days: number): string {
  if (!startDate || days <= 0) return '';
  const [y, m, d] = startDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + (days - 1));
  const yStr = date.getUTCFullYear();
  const mStr = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dStr = String(date.getUTCDate()).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

interface CustomerManagementProps {
  onSelectCustomer: (customerId: string) => void;
  onOpenQuickCollect?: (accountId: string) => void;
}

export const CustomerManagement: React.FC<CustomerManagementProps> = ({
  onSelectCustomer,
  onOpenQuickCollect,
}) => {
  const { t } = useLanguage();
  type CustomerItem = CustomerPersonalDetails & { address?: CustomerAddress; business?: BusinessDetails; activeAccount?: CollectionAccount };

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [loanFilter, setLoanFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');

  // Add Customer Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'personal' | 'address' | 'business' | 'loan'>('personal');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Disburse Loan Modal for existing customer
  const [disburseCustomer, setDisburseCustomer] = useState<CustomerItem | null>(null);
  const [disburseAmount, setDisburseAmount] = useState<number>(10000);
  const [disburseMargin, setDisburseMargin] = useState<number>(12);
  const [disburseDays, setDisburseDays] = useState<number>(100);
  const [disburseDaily, setDisburseDaily] = useState<number>(100);
  const [disburseIsDailyAuto, setDisburseIsDailyAuto] = useState<boolean>(true);
  const [disburseStartDate, setDisburseStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [disburseCollectorId, setDisburseCollectorId] = useState<string>('');
  const [disburseSubmitting, setDisburseSubmitting] = useState<boolean>(false);
  const [disburseError, setDisburseError] = useState<string | null>(null);

  // Admin Edit Customer Modal
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [editTab, setEditTab] = useState<'personal' | 'address' | 'business'>('personal');
  const [editFormData, setEditFormData] = useState<any>({});
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    gender: 'Male' as const,
    dob: '1988-06-15',
    father_or_husband_name: '',
    mother_name: '',
    marital_status: 'Married' as const,
    mobile_number: '',
    alternate_number: '',
    whatsapp_number: '',
    email: '',
    door_number: '',
    street: '',
    area: 'Bazaar Main Road',
    city: 'Salem',
    district: 'Salem',
    state: 'Tamil Nadu',
    pincode: '636001',
    landmark: '',
    shop_name: '',
    business_type: 'Retail Grocery & Provisions',
    business_category: 'FMCG / Daily Essentials',
    shop_mobile: '',
    years_in_business: 6,
    approx_daily_sales: 12000,
    approx_monthly_income: 60000,
    // Loan details
    create_loan: true,
    requested_amount: 10000,
    margin_percentage: 12,
    collection_days: 100,
    daily_collection: 100,
    is_daily_auto: true,
    start_date: new Date().toISOString().slice(0, 10),
    assigned_collector_id: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [custList, areaList, colList] = await Promise.all([
        api.getCustomers({ search, status: statusFilter, area: areaFilter }),
        api.getAreas(),
        api.getCollectors(),
      ]);
      setCustomers(custList);
      setAreas(areaList);
      setCollectors(colList);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, areaFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.full_name || !formData.mobile_number) {
      setFormError('Customer full name and mobile number are required.');
      return;
    }

    if (formData.create_loan && formData.requested_amount <= 0) {
      setFormError('Requested loan amount must be greater than ₹0.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        personal: {
          full_name: formData.full_name,
          gender: formData.gender,
          dob: formData.dob,
          father_or_husband_name: formData.father_or_husband_name,
          mother_name: formData.mother_name,
          marital_status: formData.marital_status,
          mobile_number: formData.mobile_number,
          alternate_number: formData.alternate_number,
          whatsapp_number: formData.whatsapp_number || formData.mobile_number,
          email: formData.email,
        },
        address: {
          door_number: formData.door_number,
          street: formData.street,
          area: formData.area,
          city: formData.city,
          district: formData.district,
          state: formData.state,
          pincode: formData.pincode,
          landmark: formData.landmark,
        },
        business: {
          shop_name: formData.shop_name || `${formData.full_name}'s Store`,
          business_type: formData.business_type,
          business_category: formData.business_category,
          shop_mobile: formData.shop_mobile || formData.mobile_number,
          years_in_business: Number(formData.years_in_business),
          approx_daily_sales: Number(formData.approx_daily_sales),
          approx_monthly_income: Number(formData.approx_monthly_income),
          shop_area: formData.area,
          shop_city: formData.city,
          shop_district: formData.district,
          shop_pincode: formData.pincode,
          default_margin_percentage: Number(formData.margin_percentage),
        },
      };

      if (formData.create_loan && formData.requested_amount > 0) {
        payload.loan = {
          requested_amount: Number(formData.requested_amount),
          margin_percentage: Number(formData.margin_percentage),
          collection_days: Number(formData.collection_days),
          daily_collection: Number(formData.daily_collection),
          start_date: formData.start_date,
          assigned_collector_id: formData.assigned_collector_id || (collectors[0]?.id ?? 'COL101'),
          collection_area: formData.area || 'Bazaar Main Road',
        };
      }

      await api.createCustomer(payload);

      setShowAddModal(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDisburseForCustomer = (c: CustomerItem) => {
    setDisburseCustomer(c);
    setDisburseAmount(10000);
    setDisburseMargin(c.business?.default_margin_percentage ?? 12);
    setDisburseDays(100);
    setDisburseDaily(100);
    setDisburseIsDailyAuto(true);
    setDisburseStartDate(new Date().toISOString().slice(0, 10));
    setDisburseCollectorId(collectors[0]?.id ?? 'COL101');
    setDisburseError(null);
  };

  const handleConfirmDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disburseCustomer) return;
    if (disburseAmount <= 0) {
      setDisburseError('Requested loan amount must be greater than ₹0.');
      return;
    }
    setDisburseSubmitting(true);
    setDisburseError(null);
    try {
      const mAmount = Math.round(disburseAmount * (disburseMargin / 100));
      const dAmount = Math.max(0, disburseAmount - mAmount);
      const endDate = calculateEndDate(disburseStartDate, disburseDays);

      await api.createCollectionAccount({
        customer_id: disburseCustomer.id,
        requested_amount: disburseAmount,
        margin_percentage: disburseMargin,
        margin_amount: mAmount,
        disbursed_amount: dAmount,
        daily_collection: disburseDaily,
        collection_days: disburseDays,
        start_date: disburseStartDate,
        expected_end_date: endDate,
        assigned_collector_id: disburseCollectorId || (collectors[0]?.id ?? 'COL101'),
        collection_area: disburseCustomer.business?.shop_area || disburseCustomer.address?.area || 'Bazaar Main Road',
      });

      setDisburseCustomer(null);
      await loadData();
    } catch (err: any) {
      setDisburseError(err.message || 'Failed to issue loan account.');
    } finally {
      setDisburseSubmitting(false);
    }
  };

  const handleStartEdit = (c: CustomerItem) => {
    setEditingCustomer(c);
    setEditTab('personal');
    setEditError(null);
    setEditFormData({
      full_name: c.full_name || '',
      gender: c.gender || 'Male',
      dob: c.dob || '',
      father_or_husband_name: c.father_or_husband_name || '',
      mother_name: c.mother_name || '',
      marital_status: c.marital_status || 'Married',
      mobile_number: c.mobile_number || '',
      alternate_number: c.alternate_number || '',
      whatsapp_number: c.whatsapp_number || c.mobile_number || '',
      email: c.email || '',
      status: c.status || 'ACTIVE',
      door_number: c.address?.door_number || '',
      street: c.address?.street || '',
      area: c.address?.area || 'Bazaar Main Road',
      city: c.address?.city || 'Salem',
      district: c.address?.district || 'Salem',
      state: c.address?.state || 'Tamil Nadu',
      pincode: c.address?.pincode || '636001',
      landmark: c.address?.landmark || '',
      shop_name: c.business?.shop_name || '',
      business_type: c.business?.business_type || 'Retail',
      business_category: c.business?.business_category || 'Commercial',
      shop_mobile: c.business?.shop_mobile || c.mobile_number || '',
      years_in_business: c.business?.years_in_business || 5,
      approx_daily_sales: c.business?.approx_daily_sales || 10000,
      approx_monthly_income: c.business?.approx_monthly_income || 50000,
    });
  };

  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setEditSubmitting(true);
    setEditError(null);

    try {
      await api.updateCustomer(editingCustomer.id, {
        personal: {
          full_name: editFormData.full_name,
          gender: editFormData.gender,
          dob: editFormData.dob,
          father_or_husband_name: editFormData.father_or_husband_name,
          mother_name: editFormData.mother_name,
          marital_status: editFormData.marital_status,
          mobile_number: editFormData.mobile_number,
          alternate_number: editFormData.alternate_number,
          whatsapp_number: editFormData.whatsapp_number,
          email: editFormData.email,
          status: editFormData.status,
        },
        address: {
          door_number: editFormData.door_number,
          street: editFormData.street,
          area: editFormData.area,
          city: editFormData.city,
          district: editFormData.district,
          state: editFormData.state,
          pincode: editFormData.pincode,
          landmark: editFormData.landmark,
        },
        business: {
          shop_name: editFormData.shop_name,
          business_type: editFormData.business_type,
          business_category: editFormData.business_category,
          shop_mobile: editFormData.shop_mobile,
          years_in_business: Number(editFormData.years_in_business),
          approx_daily_sales: Number(editFormData.approx_daily_sales),
          approx_monthly_income: Number(editFormData.approx_monthly_income),
          shop_area: editFormData.area,
          shop_city: editFormData.city,
        },
      });

      setEditingCustomer(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update customer');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!editingCustomer) return;
    if (!window.confirm(`Are you sure you want to deactivate customer ${editingCustomer.full_name} (${editingCustomer.id})?`)) return;
    setEditSubmitting(true);
    try {
      await api.deleteCustomer(editingCustomer.id);
      setEditingCustomer(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to deactivate customer');
    } finally {
      setEditSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      gender: 'Male',
      dob: '1988-06-15',
      father_or_husband_name: '',
      mother_name: '',
      marital_status: 'Married',
      mobile_number: '',
      alternate_number: '',
      whatsapp_number: '',
      email: '',
      door_number: '',
      street: '',
      area: 'Bazaar Main Road',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      pincode: '636001',
      landmark: '',
      shop_name: '',
      business_type: 'Retail Grocery & Provisions',
      business_category: 'FMCG / Daily Essentials',
      shop_mobile: '',
      years_in_business: 6,
      approx_daily_sales: 12000,
      approx_monthly_income: 60000,
      create_loan: true,
      requested_amount: 10000,
      margin_percentage: 12,
      collection_days: 100,
      daily_collection: 100,
      is_daily_auto: true,
      start_date: new Date().toISOString().slice(0, 10),
      assigned_collector_id: '',
    });
  };

  const handleExportExcel = () => {
    const headers = [
      'Customer ID',
      'Full Name',
      'Mobile Number',
      'Shop / Business Name',
      'Business Type',
      'Area',
      'Daily Sales (₹)',
      'Account ID',
      'Repayment Goal (₹)',
      'Collected (₹)',
      'Remaining (₹)',
      'Progress %',
      'Status',
    ];

    const rows = customers.map(c => [
      c.id,
      c.full_name,
      c.mobile_number,
      c.business?.shop_name || '-',
      c.business?.business_type || '-',
      c.address?.area || '-',
      c.business?.approx_daily_sales || 0,
      c.activeAccount?.id || '-',
      c.activeAccount?.total_repayment || 0,
      c.activeAccount?.amount_collected || 0,
      c.activeAccount?.remaining_amount || 0,
      `${c.activeAccount?.collection_percentage || 0}%`,
      c.status,
    ]);

    exportTableToExcel('Daily Collection - Customer Master List', headers, rows, 'Daily_Collection_Customers');
  };

  const totalCustomers = customers.length;
  const activeLoanCount = customers.filter(c => c.activeAccount && c.activeAccount.status === 'ACTIVE' && c.activeAccount.remaining_amount > 0).length;
  const closedLoanCount = customers.filter(c => c.activeAccount && (c.activeAccount.status === 'COMPLETED' || c.activeAccount.remaining_amount === 0)).length;

  const filteredCustomers = customers.filter(c => {
    if (loanFilter === 'CLOSED') {
      const isClosed = c.activeAccount && (c.activeAccount.status === 'COMPLETED' || c.activeAccount.remaining_amount === 0);
      if (!isClosed) return false;
    } else if (loanFilter === 'ACTIVE') {
      const isActive = c.activeAccount && c.activeAccount.status === 'ACTIVE' && c.activeAccount.remaining_amount > 0;
      if (!isActive) return false;
    }
    if (areaFilter !== 'ALL' && c.address?.area !== areaFilter) return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = c.full_name.toLowerCase().includes(q);
      const matchId = c.id.toLowerCase().includes(q);
      const matchShop = c.business?.shop_name?.toLowerCase().includes(q);
      const matchPhone = c.mobile_number.includes(q);
      if (!matchName && !matchId && !matchShop && !matchPhone) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Banner */}
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider">
              {t('customerRegistry', 'Customer Registry')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('total', 'Total')}: {customers.length} &bull; {t('loanClosed', 'Closed Loans')}: {closedLoanCount}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            {t('customerManagement', 'CUSTOMER MANAGEMENT')}
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            {t('manageKycProfiles', 'Manage KYC profiles, shop details, active collection accounts, and access 360-degree customer dossiers.')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20 flex items-center gap-1.5 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addNewCustomer', 'Add New Customer')}</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 rounded-xl bg-navy-950 border border-slate-700 hover:border-gold-500/40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{t('excelExport', 'Excel Export')}</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-navy-950 border border-slate-700 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gold-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Quick Category Tabs */}
      <div className="glass-card p-4 rounded-2xl space-y-3">
        {/* Quick Loan State Category Tabs per request */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setLoanFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              loanFilter === 'ALL'
                ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            {t('allCustomers', 'All Customers')} ({totalCustomers})
          </button>

          <button
            onClick={() => setLoanFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              loanFilter === 'ACTIVE'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            {t('activeLoans', 'Active Loans')} ({activeLoanCount})
          </button>

          <button
            onClick={() => setLoanFilter('CLOSED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              loanFilter === 'CLOSED'
                ? 'bg-emerald-500 text-navy-950 shadow-md shadow-emerald-500/20'
                : 'text-emerald-400 hover:text-white hover:bg-emerald-500/10 border border-emerald-500/30'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('loanClosed', 'Loan Closed')} ({closedLoanCount})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={t('searchCustomerPlaceholder', 'Search by name, ID, shop, or mobile...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-500"
              />
            </form>

            {/* Area Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-gold-400" />
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-navy-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500"
              >
                <option value="ALL">{t('allAreas', 'All Areas')}</option>
                {areas.map(a => (
                  <option key={a.id} value={a.area_name}>{a.area_name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-gold-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-navy-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500"
              >
                <option value="ALL">{t('allStatuses', 'All Statuses')}</option>
                <option value="ACTIVE">{t('active', 'ACTIVE')}</option>
                <option value="INACTIVE">{t('inactive', 'INACTIVE')}</option>
              </select>
            </div>
          </div>

          <span className="text-xs text-slate-400 font-mono">{t('showing', 'Showing')} {filteredCustomers.length} {t('of', 'of')} {totalCustomers} {t('customers', 'customers')}</span>
        </div>
      </div>

      {/* Customers Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-gold-500/20 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-navy-950 text-slate-300 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">{t('customerId', 'Customer ID')}</th>
                <th className="py-3 px-4">{t('customer', 'Customer')}</th>
                <th className="py-3 px-4">{t('shopAndArea', 'Shop / Business')}</th>
                <th className="py-3 px-4">{t('contactAndArea', 'Area & Mobile')}</th>
                <th className="py-3 px-4">{t('activeCollectionLoan', 'Active Plan')}</th>
                <th className="py-3 px-4">{t('collectionProgress', 'Loan Progress & Status')}</th>
                <th className="py-3 px-4 text-center">{t('statusHeader', 'Status')}</th>
                <th className="py-3 px-4 text-center">{t('actions', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">{t('loadingCustomers', 'Loading customers...')}</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">{t('noCustomersFound', 'No customers found for selected filter.')}</td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const badge = getStatusBadgeClass(c.status);
                  const acc = c.activeAccount;

                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Customer ID */}
                      <td className="py-3 px-4 font-mono font-bold text-gold-400">
                        <button
                          onClick={() => onSelectCustomer(c.id)}
                          className="hover:underline flex items-center gap-1"
                        >
                          {c.id}
                        </button>
                      </td>

                      {/* Customer Details */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={c.profile_photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                            alt={c.full_name}
                            className="w-8 h-8 rounded-full object-cover border border-gold-500/30"
                          />
                          <div>
                            <span className="font-bold text-white text-xs block">{c.full_name}</span>
                            <span className="text-[10px] text-slate-400">{t(c.gender, c.gender)} &bull; {formatDate(c.dob)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Shop Name */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" />
                          <span className="truncate max-w-[170px]">{c.business?.shop_name || 'Retail Store'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block ml-5">{c.business?.business_category}</span>
                      </td>

                      {/* Area & Mobile */}
                      <td className="py-3 px-4">
                        <div className="text-slate-300 font-mono text-[11px] flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gold-400" />
                          <a href={`tel:${c.mobile_number}`} className="hover:underline">{c.mobile_number}</a>
                        </div>
                        <span className="text-[10px] text-slate-400 block">{c.address?.area}</span>
                      </td>

                      {/* Active Plan */}
                      <td className="py-3 px-4">
                        {acc ? (
                          <div>
                            <span className="font-bold text-slate-200 text-xs">{formatCurrency(acc.requested_amount)} {t('loan', 'Loan')}</span>
                            <span className="block text-[10px] text-gold-400 font-semibold">{formatCurrency(acc.daily_collection)}/day &times; {acc.collection_days}d</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenDisburseForCustomer(c)}
                            className="px-2.5 py-1 rounded-lg bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/40 text-gold-300 text-xs font-bold inline-flex items-center gap-1 transition-all"
                            title={t('Issue New Loan Account', 'Issue New Loan Account')}
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t('issueLoan', 'Issue Loan')}</span>
                          </button>
                        )}
                      </td>

                      {/* Loan Progress & Closed Status */}
                      <td className="py-3 px-4">
                        {acc ? (
                          acc.status === 'COMPLETED' || acc.remaining_amount === 0 ? (
                            <div className="w-32 space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>{t('loanClosed', 'LOAN CLOSED')}</span>
                              </span>
                              <span className="block text-[9px] text-emerald-400/80 font-mono">100% Repaid &bull; {t('nilDue', 'Nil Due')}</span>
                            </div>
                          ) : (
                            <div className="w-32 space-y-1">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-emerald-400 font-bold">{acc.collection_percentage}%</span>
                                <span className="text-slate-400">{acc.completed_days}/{acc.collection_days}d</span>
                              </div>
                              <div className="w-full bg-navy-950 h-2 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className="bg-gradient-to-r from-gold-500 to-emerald-400 h-full rounded-full"
                                  style={{ width: `${acc.collection_percentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-500 text-xs italic">{t('noActiveLoan', 'No active loan')}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {t(c.status, c.status)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {(!acc || acc.status === 'COMPLETED') && (
                            <button
                              onClick={() => handleOpenDisburseForCustomer(c)}
                              className="px-2 py-1.5 rounded-lg bg-gold-500/20 hover:bg-gold-500/30 border border-gold-500/50 text-gold-300 text-xs font-bold inline-flex items-center gap-1 transition-all"
                              title={t('Issue Loan', 'Issue Loan')}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{t('loan', 'Loan')}</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit(c)}
                            className="px-2 py-1.5 rounded-lg bg-navy-950 hover:bg-gold-500/20 border border-gold-500/30 text-gold-300 text-xs font-semibold inline-flex items-center gap-1 transition-all"
                            title={t('Admin Edit Customer', 'Admin Edit Customer')}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{t('edit', 'Edit')}</span>
                          </button>
                          <button
                            onClick={() => onSelectCustomer(c.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-navy-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold inline-flex items-center gap-1 transition-all"
                          >
                            <span>{t('viewDossier', '360° View')}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
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

      {/* ADD CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/40 p-6 max-w-2xl w-full bg-navy-900 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-gold-400" />
                <h3 className="text-base font-bold text-white">{t('registerNewCustomer', 'Register New Customer')}</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-800 mb-4 gap-2 text-xs font-semibold overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setModalTab('personal')}
                className={`py-2 px-3 border-b-2 transition-all whitespace-nowrap ${
                  modalTab === 'personal'
                    ? 'border-gold-500 text-gold-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('1. Personal Details', '1. Personal Details')}
              </button>
              <button
                type="button"
                onClick={() => setModalTab('address')}
                className={`py-2 px-3 border-b-2 transition-all whitespace-nowrap ${
                  modalTab === 'address'
                    ? 'border-gold-500 text-gold-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('2. Residential Address', '2. Residential Address')}
              </button>
              <button
                type="button"
                onClick={() => setModalTab('business')}
                className={`py-2 px-3 border-b-2 transition-all whitespace-nowrap ${
                  modalTab === 'business'
                    ? 'border-gold-500 text-gold-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('3. Shop / Business Details', '3. Shop / Business Details')}
              </button>
              <button
                type="button"
                onClick={() => setModalTab('loan')}
                className={`py-2 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  modalTab === 'loan'
                    ? 'border-gold-500 text-gold-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('4. Loan & Collection Plan', '4. Loan & Collection Plan')}</span>
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
              {/* TAB 1: PERSONAL */}
              {modalTab === 'personal' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1">{t('fullLegalName', 'Full Legal Name')} *</label>
                    <input
                      type="text"
                      required
                      placeholder={t('e.g. Ramesh Kumar', 'e.g. Ramesh Kumar')}
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('gender', 'Gender')}</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    >
                      <option value="Male">{t('male', 'Male')}</option>
                      <option value="Female">{t('female', 'Female')}</option>
                      <option value="Other">{t('other', 'Other')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('dateOfBirth', 'Date of Birth')}</label>
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t("father's / Husband's Name", "Father's / Husband's Name")}</label>
                    <input
                      type="text"
                      placeholder={t('e.g. Shanmugam K.', 'e.g. Shanmugam K.')}
                      value={formData.father_or_husband_name}
                      onChange={(e) => setFormData({ ...formData, father_or_husband_name: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t("mother's Name", "Mother's Name")}</label>
                    <input
                      type="text"
                      placeholder={t('e.g. Lakshmi S.', 'e.g. Lakshmi S.')}
                      value={formData.mother_name}
                      onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('mobileNumber', 'Mobile Number')} *</label>
                    <input
                      type="text"
                      required
                      placeholder={t('10-digit mobile', '10-digit mobile')}
                      value={formData.mobile_number}
                      onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('whatsappNumber', 'WhatsApp Number')}</label>
                    <input
                      type="text"
                      placeholder={t('Same as mobile', 'Same as mobile')}
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1">{t('emailAddress', 'Email Address')}</label>
                    <input
                      type="email"
                      placeholder={t('customer@gmail.com', 'customer@gmail.com')}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: ADDRESS */}
              {modalTab === 'address' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('doorNumber', 'Door Number')}</label>
                    <input
                      type="text"
                      placeholder={t('e.g. 12/4', 'e.g. 12/4')}
                      value={formData.door_number}
                      onChange={(e) => setFormData({ ...formData, door_number: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('street', 'Street')}</label>
                    <input
                      type="text"
                      placeholder={t('e.g. Agraharam North Street', 'e.g. Agraharam North Street')}
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('area', 'Area')}</label>
                    <select
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    >
                      {areas.map(a => (
                        <option key={a.id} value={a.area_name}>{a.area_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('city', 'City')}</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('pincode', 'Pincode')}</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('landmark', 'Landmark')}</label>
                    <input
                      type="text"
                      placeholder={t('e.g. Near Temple', 'e.g. Near Temple')}
                      value={formData.landmark}
                      onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: BUSINESS */}
              {modalTab === 'business' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1">{t('shop / Business Name', 'Shop / Business Name')}</label>
                    <input
                      type="text"
                      placeholder={t('e.g. Sri Krishna Supermarket & Provisions', 'e.g. Sri Krishna Supermarket & Provisions')}
                      value={formData.shop_name}
                      onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('businessType', 'Business Type')}</label>
                    <input
                      type="text"
                      placeholder={t('e.g. Retail Grocery, Textiles, Tea Stall...', 'e.g. Retail Grocery, Textiles, Tea Stall...')}
                      value={formData.business_type}
                      onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('yearsInBusiness', 'Years in Business')}</label>
                    <input
                      type="number"
                      value={formData.years_in_business}
                      onChange={(e) => setFormData({ ...formData, years_in_business: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('approxDailySales (₹)', 'Approx Daily Sales (₹)')}</label>
                    <input
                      type="number"
                      value={formData.approx_daily_sales}
                      onChange={(e) => setFormData({ ...formData, approx_daily_sales: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('approxMonthlyIncome (₹)', 'Approx Monthly Income (₹)')}</label>
                    <input
                      type="number"
                      value={formData.approx_monthly_income}
                      onChange={(e) => setFormData({ ...formData, approx_monthly_income: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: LOAN & COLLECTION PLAN */}
              {modalTab === 'loan' && (() => {
                const reqAmount = Number(formData.requested_amount) || 0;
                const marginPct = Number(formData.margin_percentage) || 0;
                const mAmount = Math.round(reqAmount * (marginPct / 100));
                const dAmount = Math.max(0, reqAmount - mAmount);
                const days = Number(formData.collection_days) || 100;
                const dailyVal = formData.is_daily_auto ? Math.round(reqAmount / (days || 1)) : Number(formData.daily_collection);
                const endDate = calculateEndDate(formData.start_date, days);

                return (
                  <div className="space-y-4">
                    {/* Toggle: Disburse Loan Now */}
                    <div className="p-3.5 rounded-xl bg-navy-950 border border-gold-500/40 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Wallet className="w-5 h-5 text-gold-400 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-white text-xs block">{t('disburseInitialLoan', 'Disburse Initial Loan Account Immediately')}</span>
                          <span className="text-[11px] text-slate-400 block">{t('autoGenerateSchedule', 'Automatically generate active collection account and doorstep register.')}</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.create_loan}
                          onChange={e => setFormData({ ...formData, create_loan: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                      </label>
                    </div>

                    {formData.create_loan && (
                      <div className="space-y-3.5">
                        {/* 1. Requested Loan Amount */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-slate-300 font-semibold">{t('requestedLoanAmount (₹)', 'Requested Loan Amount (₹)')} *</label>
                            <span className="text-[10px] text-slate-400 font-mono">{t('totalRepaidByCustomer', 'Amount repaid by customer')}</span>
                          </div>
                          <input
                            type="number"
                            min={500}
                            step={500}
                            value={formData.requested_amount}
                            onChange={e => {
                              const amt = Math.max(0, Number(e.target.value));
                              const autoDaily = formData.is_daily_auto ? Math.round(amt / (formData.collection_days || 1)) : formData.daily_collection;
                              setFormData({ ...formData, requested_amount: amt, daily_collection: autoDaily });
                            }}
                            className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:border-gold-500"
                          />
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {[10000, 15000, 20000, 25000, 50000, 100000].map(amt => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => {
                                  const autoDaily = formData.is_daily_auto ? Math.round(amt / (formData.collection_days || 1)) : formData.daily_collection;
                                  setFormData({ ...formData, requested_amount: amt, daily_collection: autoDaily });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                                  formData.requested_amount === amt
                                    ? 'bg-gold-500 text-navy-950'
                                    : 'bg-navy-950 border border-slate-700 text-slate-300 hover:text-white'
                                }`}
                              >
                                ₹{amt.toLocaleString('en-IN')}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 2. Shop Finance Margin % */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-slate-300 font-semibold">{t('shopMarginRate (%)', 'Shop Finance Margin (%)')} *</label>
                            <span className="text-[10px] text-gold-400 font-mono">Deducted Upfront: − {formatCurrency(mAmount)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={50}
                              step={0.5}
                              value={formData.margin_percentage}
                              onChange={e => setFormData({ ...formData, margin_percentage: Math.max(0, Number(e.target.value)) })}
                              className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-gold-300 font-mono font-bold text-sm focus:border-gold-500"
                            />
                            <div className="flex gap-1">
                              {[10, 12, 15, 18, 20].map(m => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, margin_percentage: m })}
                                  className={`px-2.5 py-2 rounded-lg text-[10px] font-mono font-bold ${
                                    formData.margin_percentage === m
                                      ? 'bg-amber-500 text-navy-950'
                                      : 'bg-navy-950 border border-slate-700 text-slate-300'
                                  }`}
                                >
                                  {m}%
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 3. Collection Period & Daily Due */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-300 font-semibold mb-1">{t('collectionPeriod', 'Collection Period (Days)')}</label>
                            <select
                              value={formData.collection_days}
                              onChange={e => {
                                const d = Number(e.target.value);
                                const autoDaily = formData.is_daily_auto ? Math.round(formData.requested_amount / (d || 1)) : formData.daily_collection;
                                setFormData({ ...formData, collection_days: d, daily_collection: autoDaily });
                              }}
                              className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                            >
                              <option value={30}>30 {t('days', 'Days')}</option>
                              <option value={50}>50 {t('days', 'Days')}</option>
                              <option value={60}>60 {t('days', 'Days')}</option>
                              <option value={90}>90 {t('days', 'Days')}</option>
                              <option value={100}>100 {t('days', 'Days')}</option>
                              <option value={120}>120 {t('days', 'Days')}</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-slate-300 font-semibold">{t('dailyCollectionDue (₹)', 'Daily Due (₹/day)')}</label>
                              <span className="text-[10px] text-slate-400 font-mono">{formData.is_daily_auto ? 'Auto (Req/Days)' : 'Custom'}</span>
                            </div>
                            <input
                              type="number"
                              min={1}
                              value={dailyVal}
                              onChange={e => setFormData({ ...formData, daily_collection: Number(e.target.value), is_daily_auto: false })}
                              className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono font-bold focus:border-gold-500"
                            />
                          </div>
                        </div>

                        {/* 4. Start Date & Collector */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-300 font-semibold mb-1">{t('collectionStartDate', 'Collection Start Date')}</label>
                            <input
                              type="date"
                              value={formData.start_date}
                              onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                              className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500 font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-300 font-semibold mb-1">{t('assignedCollector', 'Assigned Field Collector')}</label>
                            <select
                              value={formData.assigned_collector_id || (collectors[0]?.id ?? '')}
                              onChange={e => setFormData({ ...formData, assigned_collector_id: e.target.value })}
                              className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                            >
                              {collectors.map(col => (
                                <option key={col.id} value={col.id}>{col.name} ({col.id})</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Live Calculation Preview Card */}
                        <div className="p-3.5 rounded-xl bg-navy-950 border border-gold-500/30 space-y-2 text-xs font-mono">
                          <div className="flex justify-between text-slate-300">
                            <span>{t('requestedAmount', 'Requested Amount')}:</span>
                            <strong className="text-white">{formatCurrency(reqAmount)}</strong>
                          </div>
                          <div className="flex justify-between text-gold-400">
                            <span>{t('financeMargin', 'Finance Margin')} ({marginPct}%):</span>
                            <strong>− {formatCurrency(mAmount)}</strong>
                          </div>
                          <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center text-gold-300 bg-gold-500/10 p-2 rounded-lg">
                            <span className="font-bold">{t('disbursedAmount', 'Disbursed Principal Handed to Customer')}:</span>
                            <strong className="text-base font-black">{formatCurrency(dAmount)}</strong>
                          </div>
                          <div className="flex justify-between text-purple-300">
                            <span>{t('totalRepayment', 'Total Repayment Goal')}:</span>
                            <strong>{formatCurrency(reqAmount)}</strong>
                          </div>
                          <div className="flex justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800">
                            <span>{t('scheduleTimeline', 'Schedule')}: {formData.start_date} &rarr; {endDate}</span>
                            <span className="text-emerald-400 font-bold">{formatCurrency(dailyVal)}/day &times; {days}d</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Form Navigation / Submit */}
              <div className="pt-3 border-t border-slate-800 flex justify-between">
                {modalTab !== 'personal' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (modalTab === 'loan') setModalTab('business');
                      else if (modalTab === 'business') setModalTab('address');
                      else setModalTab('personal');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    {t('previous', 'Previous')}
                  </button>
                ) : <div />}

                {modalTab !== 'loan' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (modalTab === 'personal') setModalTab('address');
                      else if (modalTab === 'address') setModalTab('business');
                      else setModalTab('loan');
                    }}
                    className="px-4 py-2 rounded-xl bg-navy-950 border border-gold-500/40 text-gold-300 text-xs font-bold"
                  >
                    {t('next', 'Next')} &rarr;
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs shadow-md shadow-gold-500/20 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {submitting
                        ? t('registering...', 'Registering Customer & Loan...')
                        : formData.create_loan
                        ? `${t('registerCustomerAndDisburse', 'Register Customer & Disburse Loan')} (₹${(formData.requested_amount || 0).toLocaleString('en-IN')})`
                        : t('completeCustomerRegistration', 'Complete Customer Registration')}
                    </span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ISSUE LOAN MODAL FOR EXISTING CUSTOMER */}
      {disburseCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/50 p-6 max-w-lg w-full bg-navy-900 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-gold-400" />
                <div>
                  <h3 className="text-base font-bold text-white">{t('issueNewLoan', 'Issue New Loan Account')}</h3>
                  <p className="text-[11px] text-slate-400">{disburseCustomer.full_name} ({disburseCustomer.id}) &bull; {disburseCustomer.business?.shop_name || 'Retail Shop'}</p>
                </div>
              </div>
              <button
                onClick={() => setDisburseCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {disburseError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{disburseError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDisburse} className="space-y-3.5 text-xs">
              {/* Requested Amount */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-semibold">{t('requestedAmount (₹)', 'Requested Amount (₹)')} *</label>
                  <span className="text-[10px] text-slate-400 font-mono">100% Repaid by Customer</span>
                </div>
                <input
                  type="number"
                  min={500}
                  step={500}
                  value={disburseAmount}
                  onChange={e => {
                    const amt = Math.max(0, Number(e.target.value));
                    setDisburseAmount(amt);
                    if (disburseIsDailyAuto) setDisburseDaily(Math.round(amt / (disburseDays || 1)));
                  }}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:border-gold-500"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[10000, 15000, 20000, 25000, 50000, 100000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setDisburseAmount(amt);
                        if (disburseIsDailyAuto) setDisburseDaily(Math.round(amt / (disburseDays || 1)));
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        disburseAmount === amt ? 'bg-gold-500 text-navy-950' : 'bg-navy-950 border border-slate-700 text-slate-300'
                      }`}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Margin Rate */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-semibold">{t('financeMarginRate (%)', 'Finance Margin (%)')}</label>
                  <span className="text-[10px] text-gold-400 font-mono">− ₹{Math.round(disburseAmount * (disburseMargin / 100)).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={disburseMargin}
                    onChange={e => setDisburseMargin(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-gold-300 font-mono font-bold focus:border-gold-500"
                  />
                  <div className="flex gap-1">
                    {[10, 12, 15, 18, 20].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDisburseMargin(m)}
                        className={`px-2 py-1.5 rounded text-[10px] font-mono font-bold ${
                          disburseMargin === m ? 'bg-amber-500 text-navy-950' : 'bg-navy-950 border border-slate-700 text-slate-300'
                        }`}
                      >
                        {m}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Days & Daily */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('collectionPeriod', 'Period (Days)')}</label>
                  <select
                    value={disburseDays}
                    onChange={e => {
                      const d = Number(e.target.value);
                      setDisburseDays(d);
                      if (disburseIsDailyAuto) setDisburseDaily(Math.round(disburseAmount / (d || 1)));
                    }}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono focus:border-gold-500"
                  >
                    <option value={30}>30 Days</option>
                    <option value={50}>50 Days</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={100}>100 Days</option>
                    <option value={120}>120 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('dailyCollection (₹)', 'Daily Due (₹/day)')}</label>
                  <input
                    type="number"
                    min={1}
                    value={disburseDaily}
                    onChange={e => {
                      setDisburseDaily(Number(e.target.value));
                      setDisburseIsDailyAuto(false);
                    }}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono font-bold focus:border-gold-500"
                  />
                </div>
              </div>

              {/* Start Date & Collector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('startDate', 'Start Date')}</label>
                  <input
                    type="date"
                    value={disburseStartDate}
                    onChange={e => setDisburseStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono focus:border-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('collector', 'Collector')}</label>
                  <select
                    value={disburseCollectorId || (collectors[0]?.id ?? '')}
                    onChange={e => setDisburseCollectorId(e.target.value)}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:border-gold-500"
                  >
                    {collectors.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Calculation Summary Box */}
              <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/30 font-mono space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Requested Amount:</span>
                  <strong className="text-white">{formatCurrency(disburseAmount)}</strong>
                </div>
                <div className="flex justify-between text-gold-400">
                  <span>Margin ({disburseMargin}%):</span>
                  <strong>− {formatCurrency(Math.round(disburseAmount * (disburseMargin / 100)))}</strong>
                </div>
                <div className="pt-1 border-t border-slate-800 flex justify-between text-gold-300 font-bold bg-gold-500/10 p-1.5 rounded">
                  <span>Disbursed Handed to Customer:</span>
                  <span className="text-sm">{formatCurrency(Math.max(0, disburseAmount - Math.round(disburseAmount * (disburseMargin / 100))))}</span>
                </div>
                <div className="flex justify-between text-purple-300 pt-0.5">
                  <span>Total Repayment Goal:</span>
                  <strong>{formatCurrency(disburseAmount)}</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDisburseCustomer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium text-xs"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={disburseSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs shadow-md shadow-gold-500/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{disburseSubmitting ? t('disbursing...', 'Disbursing...') : t('disburseAccountAndStartSchedule', 'DISBURSE ACCOUNT & START SCHEDULE')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN EDIT CUSTOMER MODAL */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/50 p-6 max-w-2xl w-full bg-navy-900 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/30">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t('adminEditCustomerProfile', 'Admin Edit Customer Profile')}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {editingCustomer.id} &bull; {editingCustomer.full_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-800 mb-4 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setEditTab('personal')}
                className={`py-2 px-3 border-b-2 transition-all ${
                  editTab === 'personal'
                    ? 'border-gold-500 text-gold-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('1. Personal Details', '1. Personal Details')}
              </button>
              <button
                type="button"
                onClick={() => setEditTab('address')}
                className={`py-2 px-3 border-b-2 transition-all ${
                  editTab === 'address'
                    ? 'border-gold-500 text-gold-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('2. Residential Address', '2. Residential Address')}
              </button>
              <button
                type="button"
                onClick={() => setEditTab('business')}
                className={`py-2 px-3 border-b-2 transition-all ${
                  editTab === 'business'
                    ? 'border-gold-500 text-gold-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('3. Business Details', '3. Business Details')}
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditCustomer} className="space-y-4 text-xs">
              {/* TAB 1: PERSONAL */}
              {editTab === 'personal' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1">{t('fullLegalName', 'Full Legal Name')} *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.full_name ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, full_name: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('mobileNumber (Primary)', 'Mobile Number (Primary)')} *</label>
                    <input
                      type="tel"
                      required
                      value={editFormData.mobile_number ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, mobile_number: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('whatsappNumber', 'WhatsApp Number')}</label>
                    <input
                      type="tel"
                      value={editFormData.whatsapp_number ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, whatsapp_number: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('alternateNumber', 'Alternate Number')}</label>
                    <input
                      type="tel"
                      value={editFormData.alternate_number ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, alternate_number: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('emailAddress', 'Email Address')}</label>
                    <input
                      type="email"
                      value={editFormData.email ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('father / Husband Name', 'Father / Husband Name')}</label>
                    <input
                      type="text"
                      value={editFormData.father_or_husband_name ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, father_or_husband_name: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t("mother's Name", "Mother's Name")}</label>
                    <input
                      type="text"
                      value={editFormData.mother_name ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, mother_name: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('maritalStatus', 'Marital Status')}</label>
                    <select
                      value={editFormData.marital_status ?? 'Married'}
                      onChange={e => setEditFormData({ ...editFormData, marital_status: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    >
                      <option value="Married">{t('married', 'Married')}</option>
                      <option value="Single">{t('single', 'Single')}</option>
                      <option value="Divorced">{t('divorced', 'Divorced')}</option>
                      <option value="Widowed">{t('widowed', 'Widowed')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('customerAccountStatus', 'Customer Account Status')}</label>
                    <select
                      value={editFormData.status ?? 'ACTIVE'}
                      onChange={e => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-bold"
                    >
                      <option value="ACTIVE">{t('active', 'ACTIVE')}</option>
                      <option value="INACTIVE">{t('inactive', 'INACTIVE')}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: ADDRESS */}
              {editTab === 'address' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('door / Flat Number', 'Door / Flat Number')}</label>
                    <input
                      type="text"
                      value={editFormData.door_number ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, door_number: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('street / Cross Name', 'Street / Cross Name')}</label>
                    <input
                      type="text"
                      value={editFormData.street ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, street: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('area / Locality', 'Area / Locality')}</label>
                    <select
                      value={editFormData.area ?? 'Bazaar Main Road'}
                      onChange={e => setEditFormData({ ...editFormData, area: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    >
                      {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('city / Town', 'City / Town')}</label>
                    <input
                      type="text"
                      value={editFormData.city ?? 'Salem'}
                      onChange={e => setEditFormData({ ...editFormData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('district', 'District')}</label>
                    <input
                      type="text"
                      value={editFormData.district ?? 'Salem'}
                      onChange={e => setEditFormData({ ...editFormData, district: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('pincode', 'Pincode')}</label>
                    <input
                      type="text"
                      value={editFormData.pincode ?? '636001'}
                      onChange={e => setEditFormData({ ...editFormData, pincode: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1">{t('landmark', 'Landmark')}</label>
                    <input
                      type="text"
                      value={editFormData.landmark ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, landmark: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: BUSINESS */}
              {editTab === 'business' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1">{t('shop / Business Name', 'Shop / Business Name')}</label>
                    <input
                      type="text"
                      value={editFormData.shop_name ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, shop_name: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('businessType', 'Business Type')}</label>
                    <input
                      type="text"
                      value={editFormData.business_type ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, business_type: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('businessCategory', 'Business Category')}</label>
                    <input
                      type="text"
                      value={editFormData.business_category ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, business_category: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('shopContactNumber', 'Shop Contact Number')}</label>
                    <input
                      type="tel"
                      value={editFormData.shop_mobile ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, shop_mobile: e.target.value })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('yearsInOperation', 'Years in Operation')}</label>
                    <input
                      type="number"
                      value={editFormData.years_in_business ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, years_in_business: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('approx. Daily Sales (₹)', 'Approx. Daily Sales (₹)')}</label>
                    <input
                      type="number"
                      value={editFormData.approx_daily_sales ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, approx_daily_sales: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{t('approx. Monthly Net Income (₹)', 'Approx. Monthly Net Income (₹)')}</label>
                    <input
                      type="number"
                      value={editFormData.approx_monthly_income ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, approx_monthly_income: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleDeleteCustomer}
                  disabled={editSubmitting}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 font-semibold flex items-center gap-1.5 transition-all text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('deactivateCustomer', 'Deactivate Customer')}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
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
                    <span>{editSubmitting ? t('saving...', 'Saving...') : t('saveProfileChanges', 'Save Profile Changes')}</span>
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
