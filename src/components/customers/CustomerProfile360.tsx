import React, { useEffect, useState } from 'react';
import { Customer360Profile, CustomerDocument, Receipt } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, formatDateTime, getStatusBadgeClass } from '../../utils/formatters';
import { ReceiptModal } from '../collections/ReceiptModal';
import { useLanguage } from '../../context/LanguageContext';
import { 
  ArrowLeft, 
  User, 
  MapPin, 
  Building, 
  Wallet, 
  Clock, 
  FileCheck, 
  Receipt as ReceiptIcon, 
  StickyNote, 
  History, 
  Phone, 
  Mail, 
  CheckCircle, 
  XCircle, 
  PlusCircle, 
  Send, 
  Printer, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';

interface CustomerProfile360Props {
  customerId: string;
  onBack: () => void;
  onOpenCollectForCustomer?: (accountId: string) => void;
}

export const CustomerProfile360: React.FC<CustomerProfile360Props> = ({
  customerId,
  onBack,
  onOpenCollectForCustomer,
}) => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Customer360Profile | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState<boolean>(true);

  // New Note state
  const [newNote, setNewNote] = useState<string>('');
  const [submittingNote, setSubmittingNote] = useState<boolean>(false);

  // Document verification modal/state
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getCustomer360(customerId);
      setProfile(data);
    } catch (err) {
      console.error('Failed to load customer 360 profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [customerId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmittingNote(true);
    try {
      await api.addCustomerNote(customerId, newNote.trim(), 'Admin');
      setNewNote('');
      await loadProfile();
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleVerifyDocument = async (docId: string, status: 'Verified' | 'Rejected') => {
    try {
      await api.verifyDocument(docId, status, `Reviewed and ${status.toLowerCase()} by Admin`);
      await loadProfile();
    } catch (err) {
      console.error('Failed to verify document:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-semibold tracking-wider">{t('LOADING 360° CUSTOMER DOSSIER...', 'LOADING 360° CUSTOMER DOSSIER...')}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 glass-card rounded-2xl p-6">
        <p className="text-sm text-slate-300">{t('Customer profile not found.', 'Customer profile not found.')}</p>
        <button
          onClick={onBack}
          className="mt-3 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs"
        >
          {t('Return to Customers', 'Return to Customers')}
        </button>
      </div>
    );
  }

  const { personal, address, business, activeAccount, metrics, notes, documents, receipts, recentPayments, auditLogs } = profile;

  // 10 Tabs per Section 28
  const tabs = [
    { id: 'overview', label: t('overview', 'Overview'), icon: User },
    { id: 'personal', label: t('personalDetails', 'Personal Details'), icon: User },
    { id: 'address', label: t('address', 'Address'), icon: MapPin },
    { id: 'business', label: t('shopAndArea', 'Shop / Business'), icon: Building },
    { id: 'accounts', label: t('accounts', 'Collection Account'), icon: Wallet },
    { id: 'payments', label: t('paymentHistory', 'Payment History'), icon: Clock },
    { id: 'documents', label: t('kycDocuments', 'KYC Documents'), icon: FileCheck },
    { id: 'receipts', label: t('receipts', 'Receipts'), icon: ReceiptIcon },
    { id: 'notes', label: t('notes', 'Notes'), icon: StickyNote, count: notes.length },
    { id: 'audit', label: t('auditHistory', 'Audit History'), icon: History },
  ];

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Navigation & Profile Header */}
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 relative overflow-hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-gold-300 font-semibold mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('backToCustomers', 'Back to Customers List')}</span>
        </button>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={personal.profile_photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={personal.full_name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-gold-500/40 shadow-xl"
              />
              <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-navy-950 ${
                personal.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-500'
              }`} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {personal.full_name}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 font-mono text-xs font-bold border border-gold-500/30">
                  {personal.id}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                <Building className="w-3.5 h-3.5 text-gold-400" />
                <span className="font-semibold text-white">{business?.shop_name || 'Retail Store'}</span>
                <span className="text-slate-500">&bull;</span>
                <span className="text-slate-400">{address?.area || 'Bazaar Main Road'}</span>
              </p>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-gold-400" />
                  {personal.mobile_number}
                </span>
                {personal.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-500" />
                    {personal.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions per Section 15: Call, WhatsApp, Collect, Receipt */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`tel:${personal.mobile_number}`}
              className="px-3 py-2 rounded-xl bg-navy-950 border border-slate-700 hover:border-emerald-500/50 text-slate-200 hover:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer"
              title="Call Customer"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('call', 'Call')}</span>
            </a>

            <button
              type="button"
              onClick={() => {
                const clean = personal.mobile_number.replace(/\D/g, '');
                const phone = clean.length === 10 ? `91${clean}` : clean;
                const msg = encodeURIComponent(`Hello ${personal.full_name}, regarding your Daily Collection account with DAILY COLLECTION.`);
                window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
              }}
              className="px-3 py-2 rounded-xl bg-navy-950 border border-emerald-500/40 hover:bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer"
              title="WhatsApp Customer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('whatsApp', 'WhatsApp')}</span>
            </button>

            {activeAccount && onOpenCollectForCustomer && (
              <button
                type="button"
                onClick={() => onOpenCollectForCustomer(activeAccount.id)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs shadow-md shadow-gold-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Collect Today's Payment"
              >
                <PlusCircle className="w-4 h-4 text-navy-950" />
                <span>{t('collect', 'Collect')}</span>
              </button>
            )}

            {receipts && receipts.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedReceipt(receipts[0])}
                className="px-3 py-2 rounded-xl bg-navy-950 border border-gold-500/30 hover:border-gold-500 text-gold-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer"
                title="View Latest Receipt"
              >
                <ReceiptIcon className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('receipt', 'Receipt')}</span>
              </button>
            )}
          </div>
        </div>

        {/* 10 Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pt-5 mt-4 border-t border-slate-800 scrollbar-none">
          {tabs.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-navy-950/20 text-navy-950' : 'bg-slate-800 text-gold-400'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT PANELS */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Active Account Progress Card (Section 16: Financial Summary) */}
          {activeAccount ? (
            <div className="glass-card p-6 rounded-2xl border border-gold-500/30 bg-gradient-to-br from-navy-900 via-navy-850 to-navy-900 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <span className="text-[10px] font-bold text-gold-400 uppercase tracking-widest block">{t('Active 100-Day Collection Account', 'Active 100-Day Collection Account')}</span>
                  <h3 className="text-base font-bold text-white">{activeAccount.plan_name}</h3>
                  <p className="text-xs text-slate-400">{t('Account ID:', 'Account ID:')} <span className="font-mono text-slate-300">{activeAccount.id}</span></p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-slate-400 uppercase block">{t('repayment goal', 'Total Repayment Goal')}</span>
                  <span className="text-xl font-black text-white font-mono">{formatCurrency(activeAccount.total_repayment)}</span>
                  <span className="text-xs text-gold-400 block font-semibold">{t('margin', 'Finance Margin')}: {formatCurrency(activeAccount.finance_margin)}</span>
                </div>
              </div>

              {/* Large Progress Visualization (Section 16: 35% Completed) */}
              <div className="space-y-2 mb-5 p-4 rounded-xl bg-navy-950/80 border border-gold-500/20">
                <div className="flex justify-between items-baseline text-xs font-bold">
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t('totalRepaidSoFar', 'Repaid So Far')}</span>
                    <span className="text-emerald-400 font-mono text-base font-black">
                      {formatCurrency(activeAccount.amount_collected)}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-gold-400 font-mono text-lg md:text-xl font-black">
                      {activeAccount.collection_percentage}% {t('completed', 'Completed')}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {activeAccount.completed_days} of {activeAccount.collection_days} {t('days', 'days')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[11px] block">{t('balanceRemaining', 'Remaining')}</span>
                    <span className="text-amber-400 font-mono text-base font-black">
                      {formatCurrency(activeAccount.remaining_amount)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-navy-950 h-4 rounded-full overflow-hidden p-0.5 border border-slate-700 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-gold-500 via-amber-500 to-emerald-400 h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, activeAccount.collection_percentage)}%` }}
                  />
                </div>
              </div>

              {/* 8 Financial Summary KPI Boxes (Section 16 requirement) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                {/* 1. Requested Amount */}
                <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('requestedAmount', 'Requested Amount')}</span>
                  <strong className="text-slate-200 text-sm font-mono block mt-0.5">{formatCurrency(activeAccount.requested_amount)}</strong>
                </div>

                {/* 2. Disbursed */}
                <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/30">
                  <span className="text-gold-400 block text-[10px] uppercase font-bold">{t('disbursed', 'Disbursed Principal')}</span>
                  <strong className="text-gold-300 text-sm font-mono block mt-0.5">{formatCurrency(activeAccount.disbursed_amount)}</strong>
                </div>

                {/* 3. Daily Collection */}
                <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('dailyCollection', 'Daily Collection')}</span>
                  <strong className="text-white text-sm font-mono block mt-0.5">{formatCurrency(activeAccount.daily_collection)} / day</strong>
                </div>

                {/* 4. Collection Period */}
                <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t('collectionPeriod', 'Collection Period')}</span>
                  <strong className="text-white text-sm font-mono block mt-0.5">{activeAccount.collection_days} {t('days', 'Days')}</strong>
                </div>

                {/* 5. Total Repayment */}
                <div className="p-3 rounded-xl bg-navy-950 border border-purple-500/30">
                  <span className="text-purple-300 block text-[10px] uppercase font-bold">{t('totalRepayment', 'Total Repayment')}</span>
                  <strong className="text-purple-300 text-sm font-mono block mt-0.5">{formatCurrency(activeAccount.total_repayment)}</strong>
                </div>

                {/* 6. Finance Margin */}
                <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/40">
                  <span className="text-gold-400 block text-[10px] uppercase font-bold">{t('financeMargin', 'Finance Margin')}</span>
                  <strong className="text-gold-400 text-sm font-mono block mt-0.5">{formatCurrency(activeAccount.finance_margin)}</strong>
                </div>

                {/* 7. Collected */}
                <div className="p-3 rounded-xl bg-navy-950 border border-emerald-500/30">
                  <span className="text-emerald-400 block text-[10px] uppercase font-bold">{t('collectedSoFar', 'Collected')}</span>
                  <strong className="text-emerald-400 text-sm font-mono block mt-0.5">{formatCurrency(activeAccount.amount_collected)}</strong>
                </div>

                {/* 8. Remaining */}
                <div className="p-3 rounded-xl bg-navy-950 border border-amber-500/30">
                  <span className="text-amber-400 block text-[10px] uppercase font-bold">{t('remainingDue', 'Remaining')}</span>
                  <strong className="text-amber-400 text-sm font-mono block mt-0.5">{formatCurrency(activeAccount.remaining_amount)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 glass-card rounded-2xl text-center text-slate-400 text-xs">
              {t('No active collection account for this customer.', 'No active collection account for this customer.')}
            </div>
          )}

          {/* Business & Address Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Shop Details */}
            <div className="glass-card p-4 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4" />
                {t('Shop & Commercial Details', 'Shop & Commercial Details')}
              </h4>
              <div className="text-xs space-y-1.5 pt-1">
                <div className="flex justify-between"><span className="text-slate-400">{t('shop name', 'Shop Name:')}</span> <strong className="text-white">{business?.shop_name}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('business type', 'Business Type:')}</span> <span className="text-slate-300">{business?.business_type}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('Shop Address:', 'Shop Address:')}</span> <span className="text-slate-300">{business?.shop_address}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('Approx Daily Sales:', 'Approx Daily Sales:')}</span> <span className="text-emerald-400 font-mono font-bold">{formatCurrency(business?.approx_daily_sales)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('Years in Business:', 'Years in Business:')}</span> <span className="text-slate-200">{business?.years_in_business} {t('years', 'Years')}</span></div>
              </div>
            </div>

            {/* Residential Address */}
            <div className="glass-card p-4 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {t('Residential Address', 'Residential Address')}
              </h4>
              <div className="text-xs space-y-1.5 pt-1">
                <div className="flex justify-between"><span className="text-slate-400">{t('Door & Street:', 'Door & Street:')}</span> <span className="text-slate-200">{address?.door_number}, {address?.street}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('area', 'Area:')}</span> <span className="text-slate-200">{address?.area}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('City & Pincode:', 'City & Pincode:')}</span> <span className="text-slate-200">{address?.city} - {address?.pincode}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('Landmark:', 'Landmark:')}</span> <span className="text-slate-300">{address?.landmark || '-'}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PERSONAL DETAILS TAB */}
      {activeTab === 'personal' && (
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-gold-400">{t('personalDetails', 'Personal Information')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Full Legal Name', 'Full Legal Name')}</span>
              <strong className="text-white text-sm">{personal.full_name}</strong>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Gender & DOB', 'Gender & DOB')}</span>
              <span className="text-slate-200 text-sm">{personal.gender} &bull; {formatDate(personal.dob)}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Father / Husband Name', 'Father / Husband Name')}</span>
              <span className="text-slate-200 text-sm">{personal.father_or_husband_name || '-'}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Mother Name', 'Mother Name')}</span>
              <span className="text-slate-200 text-sm">{personal.mother_name || '-'}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Marital Status', 'Marital Status')}</span>
              <span className="text-slate-200 text-sm">{personal.marital_status}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('mobile', 'Mobile Number')}</span>
              <span className="text-slate-200 text-sm font-mono">{personal.mobile_number}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('WhatsApp Number', 'WhatsApp Number')}</span>
              <span className="text-slate-200 text-sm font-mono">{personal.whatsapp_number || personal.mobile_number}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('email', 'Email')}</span>
              <span className="text-slate-200 text-sm">{personal.email || '-'}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('status', 'Account Status')}</span>
              <span className="text-emerald-400 font-bold text-sm">{t(personal.status, personal.status)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. ADDRESS TAB */}
      {activeTab === 'address' && address && (
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-gold-400">{t('Residential Address', 'Residential Address')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Door Number & Street', 'Door Number & Street')}</span>
              <span className="text-slate-200 text-sm">{address.door_number}, {address.street}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Area & Town', 'Area & Town')}</span>
              <span className="text-slate-200 text-sm">{address.area}, {address.village_or_town}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('City & District', 'City & District')}</span>
              <span className="text-slate-200 text-sm">{address.city}, {address.district}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('State & Pincode', 'State & Pincode')}</span>
              <span className="text-slate-200 text-sm font-mono">{address.state} - {address.pincode}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800 md:col-span-2">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Landmark', 'Landmark')}</span>
              <span className="text-slate-200 text-sm">{address.landmark || '-'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. SHOP / BUSINESS DETAILS TAB */}
      {activeTab === 'business' && business && (
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-gold-400">{t('Shop / Business Profile', 'Shop / Business Profile')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Shop / Business Name', 'Shop / Business Name')}</span>
              <strong className="text-white text-sm">{business.shop_name}</strong>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('business category', 'Business Category')}</span>
              <span className="text-slate-200 text-sm">{business.business_category}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Shop Mobile', 'Shop Mobile')}</span>
              <span className="text-slate-200 text-sm font-mono">{business.shop_mobile}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Approx Daily Sales', 'Approx Daily Sales')}</span>
              <span className="text-emerald-400 font-mono font-bold text-sm">{formatCurrency(business.approx_daily_sales)}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Approx Monthly Income', 'Approx Monthly Income')}</span>
              <span className="text-emerald-400 font-mono font-bold text-sm">{formatCurrency(business.approx_monthly_income)}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Years in Business', 'Years in Business')}</span>
              <span className="text-slate-200 text-sm">{business.years_in_business} {t('years', 'Years')}</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-950 border border-slate-800 md:col-span-3">
              <span className="text-slate-400 block text-[10px] uppercase">{t('Shop Address & Landmark', 'Shop Address & Landmark')}</span>
              <span className="text-slate-200 text-sm">{business.shop_address}, {business.shop_area}, {business.shop_city} - {business.shop_pincode} ({business.landmark})</span>
            </div>
          </div>

          {/* Premium Shop Commercial Photo Gallery per Section 17 */}
          <div className="pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5 uppercase tracking-wider">
              <Building className="w-3.5 h-3.5 text-gold-400" />
              <span>{t('shopPhotoGallery', 'Shop Commercial Photo Gallery & Storefront')}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { title: 'Storefront & Signboard', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500' },
                { title: 'Stock & Inventory Counter', url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500' },
                { title: 'Billing Cash Counter', url: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=500' },
              ].map((img, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-700/80 group">
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                    <span className="text-[11px] font-bold text-white">{img.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. COLLECTION ACCOUNTS TAB */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {profile.accounts.map(acc => (
            <div key={acc.id} className="glass-card p-5 rounded-2xl border border-gold-500/30">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-slate-800 mb-3">
                <div>
                  <span className="font-mono text-xs font-bold text-gold-400">{acc.id}</span>
                  <h4 className="text-sm font-bold text-white">{acc.plan_name}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    acc.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                    acc.status === 'OVERDUE' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {acc.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                <div className="p-2 rounded-lg bg-navy-950 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">{t('req', 'Requested')}</span>
                  <strong className="text-white font-mono">{formatCurrency(acc.requested_amount)}</strong>
                </div>
                <div className="p-2 rounded-lg bg-navy-950 border border-gold-500/30">
                  <span className="text-gold-400 text-[10px] block font-semibold">{t('disb', 'Disbursed')}</span>
                  <strong className="text-gold-300 font-mono">{formatCurrency(acc.disbursed_amount)}</strong>
                </div>
                <div className="p-2 rounded-lg bg-navy-950 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">{t('daily', 'Daily Collection')}</span>
                  <strong className="text-white font-mono">{formatCurrency(acc.daily_collection)} / {t('day', 'day')}</strong>
                </div>
                <div className="p-2 rounded-lg bg-navy-950 border border-emerald-500/30">
                  <span className="text-emerald-400 text-[10px] block font-semibold">{t('financeMargin', 'Finance Margin')}</span>
                  <strong className="text-emerald-400 font-mono">{formatCurrency(acc.finance_margin)}</strong>
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>{t('date', 'Start Date')}: <strong>{formatDate(acc.start_date)}</strong></span>
                <span>{t('Expected End:', 'Expected End:')} <strong>{formatDate(acc.expected_end_date)}</strong></span>
                <span>{t('assignedCollector', 'Assigned Collector')}: <strong>{acc.assigned_collector_name}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. PAYMENT HISTORY TAB */}
      {activeTab === 'payments' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('date', 'Date')}</th>
                  <th className="py-3 px-4">{t('receipt #', 'Receipt #')}</th>
                  <th className="py-3 px-4 text-right">{t('amount paid', 'Amount Paid')}</th>
                  <th className="py-3 px-4">{t('mode', 'Mode')}</th>
                  <th className="py-3 px-4 text-right">{t('remaining balance', 'Remaining Balance')}</th>
                  <th className="py-3 px-4">{t('collector', 'Collector')}</th>
                  <th className="py-3 px-4 text-center">{t('status', 'Status')}</th>
                  <th className="py-3 px-4 text-center">{t('receipt', 'Receipt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentPayments.length === 0 ? (
                  <tr><td colSpan={8} className="py-6 text-center text-slate-400">{t('No payment transactions recorded yet.', 'No payment transactions recorded yet.')}</td></tr>
                ) : (
                  recentPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono text-slate-300">{formatDate(p.collection_date)}</td>
                      <td className="py-2.5 px-4 font-mono text-gold-400 font-bold">{p.receipt_number}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">{formatCurrency(p.amount_paid)}</td>
                      <td className="py-2.5 px-4 text-slate-300">{t(p.payment_mode, p.payment_mode)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-200">{formatCurrency(p.remaining_balance)}</td>
                      <td className="py-2.5 px-4 text-slate-400">{p.collector_name}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                          {t(p.status, p.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={async () => {
                            const rec = receipts.find(r => r.receipt_number === p.receipt_number);
                            if (rec) setSelectedReceipt(rec);
                          }}
                          className="p-1 rounded bg-navy-950 border border-slate-700 text-slate-300 hover:text-gold-400"
                          title={t('View & Print Receipt', 'View & Print Receipt')}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. KYC DOCUMENTS TAB */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map(doc => (
              <div key={doc.id} className="glass-card p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{t(doc.document_type, doc.document_type)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    doc.verification_status === 'Verified' ? 'bg-emerald-500/20 text-emerald-300' :
                    doc.verification_status === 'Rejected' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {t(doc.verification_status, doc.verification_status)}
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-1">
                  <div>{t('Number:', 'Number:')} <strong className="text-slate-200 font-mono">{doc.document_number}</strong></div>
                  <div>{t('Uploaded:', 'Uploaded:')} <span className="font-mono">{formatDate(doc.upload_date)}</span> {t('by', 'by')} {doc.uploaded_by}</div>
                  {doc.remarks && <div className="text-[11px] text-slate-500 italic">{doc.remarks}</div>}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  {doc.verification_status === 'Pending Verification' && (
                    <>
                      <button
                        onClick={() => handleVerifyDocument(doc.id, 'Verified')}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
                      >
                        {t('approve', 'Approve')}
                      </button>
                      <button
                        onClick={() => handleVerifyDocument(doc.id, 'Rejected')}
                        className="py-1.5 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 text-[11px] font-bold"
                      >
                        {t('reject', 'Reject')}
                      </button>
                    </>
                  )}
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-navy-950 border border-slate-700 text-slate-300 hover:text-gold-400 flex items-center justify-center text-xs"
                    title={t('View Document', 'View Document')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. RECEIPTS TAB */}
      {activeTab === 'receipts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {receipts.map(rec => (
            <div key={rec.id} className="glass-card p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-gold-400">{rec.receipt_number}</span>
                <span className="text-[10px] text-slate-400">{formatDate(rec.date)}</span>
              </div>
              <div className="flex justify-between text-white font-bold">
                <span>{t('Amount Paid:', 'Amount Paid:')}</span>
                <span className="text-emerald-400 font-mono">{formatCurrency(rec.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>{t('Remaining Balance:', 'Remaining Balance:')}</span>
                <span className="font-mono">{formatCurrency(rec.remaining_balance)}</span>
              </div>
              <button
                onClick={() => setSelectedReceipt(rec)}
                className="w-full mt-2 py-1.5 rounded-lg bg-navy-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('View & Print Receipt', 'View & Print Receipt')}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 9. NOTES TAB (Section 29) */}
      {activeTab === 'notes' && (
        <div className="glass-card p-6 rounded-2xl space-y-6">
          <form onSubmit={handleAddNote} className="space-y-3">
            <label className="block text-xs font-bold text-gold-400 uppercase tracking-wider">
              {t('Add Field Note / Collection Remark', 'Add Field Note / Collection Remark')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('e.g. Shop closed today, customer requested collection after 5 PM...', 'e.g. Shop closed today, customer requested collection after 5 PM...')}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500"
              />
              <button
                type="submit"
                disabled={submittingNote || !newNote.trim()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t('Add Note', 'Add Note')}</span>
              </button>
            </div>
          </form>

          {/* Notes History */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {t('Recorded Chronological Notes', 'Recorded Chronological Notes')}
            </h4>
            {notes.length === 0 ? (
              <p className="text-xs text-slate-500">{t('No notes recorded yet.', 'No notes recorded yet.')}</p>
            ) : (
              notes.map(n => (
                <div key={n.id} className="p-3.5 rounded-xl bg-navy-950/80 border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <strong className="text-gold-400">{n.created_by}</strong>
                    <span className="font-mono">{formatDateTime(n.created_at)}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{n.note}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 10. AUDIT HISTORY TAB (Section 35) */}
      {activeTab === 'audit' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-300 uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-2.5 px-4">{t('Timestamp', 'Timestamp')}</th>
                  <th className="py-2.5 px-4">{t('User', 'User')}</th>
                  <th className="py-2.5 px-4">{t('action', 'Action')}</th>
                  <th className="py-2.5 px-4">{t('Details', 'Details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-400">{t('No audit logs for this customer.', 'No audit logs for this customer.')}</td></tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id}>
                      <td className="py-2 px-4 font-mono text-slate-400 text-[11px]">{formatDateTime(log.timestamp)}</td>
                      <td className="py-2 px-4 text-gold-400 font-semibold">{log.user} ({log.role})</td>
                      <td className="py-2 px-4 font-mono font-bold text-slate-200">{log.action}</td>
                      <td className="py-2 px-4 text-slate-400 font-mono text-[10px] truncate max-w-xs">
                        {log.new_value ? JSON.stringify(log.new_value) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
};
