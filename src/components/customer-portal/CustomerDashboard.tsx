import React, { useEffect, useState } from 'react';
import { User, Customer360Profile, Receipt, CustomerDocument } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, formatDateTime, getStatusBadgeClass } from '../../utils/formatters';
import { ReceiptModal } from '../collections/ReceiptModal';
import { RazorpayCheckoutModal } from './RazorpayCheckoutModal';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Wallet, 
  Clock, 
  CalendarCheck, 
  CheckCircle2, 
  Building, 
  Phone, 
  FileCheck, 
  Upload, 
  Printer, 
  Bell, 
  ShieldCheck, 
  AlertCircle,
  TrendingUp,
  User as UserIcon,
  QrCode,
  Copy,
  Check,
  CreditCard,
  ArrowRight,
  X
} from 'lucide-react';

interface CustomerDashboardProps {
  currentUser: User;
  onLogout: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ currentUser, onLogout }) => {
  const { t } = useLanguage();
  const customerId = currentUser.customer_id || 'DC10001';
  const [profile, setProfile] = useState<Customer360Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'account' | 'payments' | 'documents' | 'profile'>('account');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  // Upload Doc state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [docType, setDocType] = useState<string>('Aadhaar Card');
  const [docNumber, setDocNumber] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);

  // Razorpay Checkout Modal state (UPI & Bank Transfer)
  const [showRazorpayModal, setShowRazorpayModal] = useState<boolean>(false);
  const [razorpayInitialAmount, setRazorpayInitialAmount] = useState<number>(100);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getCustomer360(customerId);
      setProfile(data);
    } catch (err) {
      console.error('Failed to load customer profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerId]);

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      await api.uploadDocument({
        customer_id: customerId,
        document_type: docType as any,
        document_number: docNumber || 'DOC-DC-' + Date.now(),
        file_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600',
        file_name: `${docType.toLowerCase().replace(/\s+/g, '_')}.jpg`,
        uploaded_by: currentUser.name,
      });
      setShowUploadModal(false);
      setDocNumber('');
      await loadData();
    } catch (err) {
      console.error('Failed to upload document:', err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-semibold tracking-wider">{t('loadingYourAccount', 'LOADING YOUR ACCOUNT...')}</p>
      </div>
    );
  }

  const acc = profile?.activeAccount;
  const personal = profile?.personal;
  const business = profile?.business;
  const payments = profile?.recentPayments || [];
  const documents = profile?.documents || [];

  return (
    <div className="space-y-6 pb-12 font-sans max-w-5xl mx-auto">
      {/* Welcome Customer Card */}
      <div className="glass-card p-5 md:p-6 rounded-2xl border border-gold-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center text-navy-950 font-black text-xl shadow-md shadow-gold-500/20">
              {personal?.full_name ? personal.full_name.charAt(0) : 'C'}
            </div>
            <div>
              <span className="text-[10px] font-bold text-gold-400 uppercase tracking-widest block">
                {t('customerSelfServicePortal', 'Customer Self-Service Portal')}
              </span>
              <h1 className="text-xl md:text-2xl font-black text-white">
                {t('welcome', 'Welcome')}, {personal?.full_name}!
              </h1>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-gold-400" />
                <span className="font-semibold text-white">{business?.shop_name || 'Retail Business'}</span>
                <span className="text-slate-500">&bull;</span>
                <span className="font-mono text-gold-300 font-bold">ID: {customerId}</span>
              </p>
            </div>
          </div>

          <div className="bg-navy-950/80 px-4 py-2.5 rounded-xl border border-gold-500/20 text-right">
            <span className="text-[10px] text-slate-400 block uppercase">{t('dailyDue', 'Daily Collection Due')}</span>
            <span className="text-lg font-black text-gold-400 font-mono">
              {formatCurrency(acc?.daily_collection || 100)} / {t('days', 'day')}
            </span>
            <span className="text-[10px] text-emerald-400 block font-semibold">{t('collectors', 'Collector')}: {acc?.assigned_collector_name}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-800 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl transition-all ${
              activeTab === 'account'
                ? 'bg-gold-500 text-navy-950 font-bold shadow-md shadow-gold-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>{t('myCollection', 'My Collection Account')}</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl transition-all ${
              activeTab === 'payments'
                ? 'bg-gold-500 text-navy-950 font-bold shadow-md shadow-gold-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t('paymentHistory', 'Payment History')}</span>
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl transition-all ${
              activeTab === 'documents'
                ? 'bg-gold-500 text-navy-950 font-bold shadow-md shadow-gold-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>{t('myDocuments', 'My Documents')} ({documents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl transition-all ${
              activeTab === 'profile'
                ? 'bg-gold-500 text-navy-950 font-bold shadow-md shadow-gold-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>{t('myProfile', 'Shop & Profile')}</span>
          </button>
        </div>
      </div>

      {/* 1. MY COLLECTION ACCOUNT TAB (Section 20 requirement) */}
      {activeTab === 'account' && acc && (
        <div className="space-y-6">
          {/* Main Visual Progress Card */}
          <div className="glass-card p-6 rounded-2xl border border-gold-500/40 bg-gradient-to-br from-navy-900 via-navy-850 to-navy-900 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-gold-400 uppercase tracking-widest block">{t('activeRepaymentCycle', 'Active Repayment Cycle')}</span>
                <h3 className="text-lg font-bold text-white">{acc.plan_name}</h3>
                <span className="text-xs text-slate-400 font-mono">{t('accountNumber', 'Account ID')}: {acc.id}</span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 w-fit">
                {t(acc.status, acc.status)}
              </span>
            </div>

            {/* Visual Progress Bar (Section 20: ₹3,500 / ₹10,000 -> 35% Completed) */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-emerald-400 font-mono text-sm">
                  {formatCurrency(acc.amount_collected)} {t('paidToday', 'Paid')}
                </span>
                <span className="text-gold-400 font-mono text-sm">
                  {acc.collection_percentage}% {t('completedDays', 'Completed')}
                </span>
                <span className="text-amber-400 font-mono text-sm">
                  {formatCurrency(acc.remaining_amount)} {t('remainingBalance', 'Remaining')}
                </span>
              </div>
              <div className="w-full bg-navy-950 h-4 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="bg-gradient-to-r from-gold-500 via-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, acc.collection_percentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>{acc.completed_days} {t('days', 'Days')} {t('paidToday', 'Paid')}</span>
                <span>{acc.remaining_days} {t('daysRemaining', 'Days Left')}</span>
              </div>
            </div>

            {/* Account Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-800">
              <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">{t('requestedAmount', 'Requested Amount')}</span>
                <strong className="text-white text-base font-mono">{formatCurrency(acc.requested_amount)}</strong>
              </div>
              <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/30">
                <span className="text-gold-400 block text-[10px] uppercase font-bold">{t('disbursedAmount', 'Disbursed Amount')}</span>
                <strong className="text-gold-300 text-base font-mono">{formatCurrency(acc.disbursed_amount)}</strong>
              </div>
              <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">{t('dailyDue', 'Daily Due')}</span>
                <strong className="text-white text-base font-mono">{formatCurrency(acc.daily_collection)}</strong>
              </div>
              <div className="p-3 rounded-xl bg-navy-950 border border-purple-500/30">
                <span className="text-purple-300 block text-[10px] uppercase font-bold">{t('totalRepayment', 'Total Repayment')}</span>
                <strong className="text-purple-300 text-base font-mono">{formatCurrency(acc.total_repayment)}</strong>
              </div>
            </div>

            {/* Dates & Collector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs p-3 rounded-xl bg-navy-950/60 border border-slate-800/80">
              <div>
                <span className="text-slate-400 block text-[10px]">{t('startDate', 'Start Date')}:</span>
                <strong className="text-slate-200 font-mono">{formatDate(acc.start_date)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{t('expectedCompletion', 'Expected Completion')}:</span>
                <strong className="text-slate-200 font-mono">{formatDate(acc.expected_end_date)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{t('doorstepCollector', 'Doorstep Collector')}:</span>
                <strong className="text-gold-400">{acc.assigned_collector_name} ({acc.collection_area})</strong>
              </div>
            </div>
          </div>

          {/* Self Repayment Section: Pay by UPI & Bank Transfer */}
          {acc.remaining_amount > 0 ? (
            <div className="space-y-4">
              {/* Payment Options Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Razorpay Online Repayment (UPI & NetBanking) */}
                <div className="glass-card p-5 md:p-6 rounded-2xl border border-blue-500/40 bg-gradient-to-br from-navy-900 via-blue-950/20 to-navy-900 shadow-xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 bg-[#0c2340] px-2.5 py-1 rounded-lg border border-blue-400/30">
                        <span className="text-blue-400 font-black text-xs tracking-wider">Razorpay</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] text-blue-200 font-mono font-semibold">{t('ONLINE GATEWAY', 'ONLINE GATEWAY')}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{t('Daily Due:', 'Daily Due:')} {formatCurrency(acc.daily_collection)}</span>
                    </div>

                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      {t('payOnlineRazorpay', 'Pay Online via Razorpay')}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {t('Instant self-repayment via Google Pay, PhonePe, Paytm, BHIM, UPI QR or NetBanking. Remaining loan balance decreases instantly.', 'Instant self-repayment via Google Pay, PhonePe, Paytm, BHIM, UPI QR or NetBanking. Remaining loan balance decreases instantly.')}
                    </p>

                    {/* Supported UPI & Bank pills */}
                    <div className="flex items-center gap-1.5 pt-3 flex-wrap text-[10px] text-slate-300 font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-navy-950 border border-slate-700">Google Pay</span>
                      <span className="px-2 py-0.5 rounded-md bg-navy-950 border border-slate-700">PhonePe</span>
                      <span className="px-2 py-0.5 rounded-md bg-navy-950 border border-slate-700">Paytm</span>
                      <span className="px-2 py-0.5 rounded-md bg-navy-950 border border-slate-700">UPI QR</span>
                      <span className="px-2 py-0.5 rounded-md bg-navy-950 border border-slate-700">NetBanking</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRazorpayInitialAmount(acc.daily_collection);
                        setShowRazorpayModal(true);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer group"
                    >
                      <QrCode className="w-4 h-4 group-hover:scale-110 transition-transform text-blue-200" />
                      <span>{t('payOnlineRazorpay', 'Pay Installment via Razorpay')}</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>

                {/* 2. Cash Payment Policy: Strictly Collected by Authorized Agent */}
                <div className="glass-card p-5 md:p-6 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-navy-900 via-amber-950/20 to-navy-900 shadow-xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-amber-400" />
                        {t('inPersonCashOnly', 'In-Person Cash Collection Only')}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        {t('fieldAgentBanner', 'Field Agent')}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-amber-400" />
                      {t('cashCollectedByAgent', 'Cash Collected by Authorized Agent')}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {t('cashPolicyDesc', 'Cash is strictly collected in person by your authorized field collection officer at your doorstep or shop. Customers cannot submit cash online.')}
                    </p>

                    {/* Assigned Collector Details Box */}
                    <div className="mt-3 p-3 rounded-xl bg-navy-950/80 border border-amber-500/20 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">{t('assignedCollector', 'Assigned Collector')}:</span>
                        <strong className="text-gold-300 font-semibold">{acc.assigned_collector_name || 'Murugan S.'}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">{t('collectorHelpline', 'Collector Helpline')}:</span>
                        <a href="tel:+919842111223" className="font-mono text-white hover:text-gold-400 flex items-center gap-1 font-semibold">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          +91 98421 11223
                        </a>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">{t('collectionArea', 'Collection Area')}:</span>
                        <span className="text-slate-200">{acc.collection_area || 'Bazaar Main Road'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200/90 leading-tight">
                    {t('safetyAdvisory', '🛡️ Safety Advisory: Never hand cash to any unauthorized person. Always verify the collector and ensure an instant digital receipt is generated on the spot.')}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-6 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-navy-900 to-navy-950 text-center space-y-2 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-emerald-300">
                {t('congratsLoanClosed', '🎉 Congratulations! Your Loan is Fully Closed!')}
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                {t('loanClosedDesc', 'You have successfully completed 100% of your repayments for this collection cycle. Remaining balance is ₹0. Your account is categorized under Loan Closed.')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. PAYMENT HISTORY TAB (Section 21 requirement) */}
      {activeTab === 'payments' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white">{t('doorstepHistory', 'Doorstep Repayment History')}</h3>
              <p className="text-xs text-slate-400">{t('allRecordedPayments', 'All recorded payments with digital receipts')}</p>
            </div>
            <span className="text-xs text-gold-400 font-mono font-bold">{payments.length} {t('transactions', 'Transactions')}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('date', 'Date')}</th>
                  <th className="py-3 px-4">{t('receiptNumber', 'Receipt #')}</th>
                  <th className="py-3 px-4 text-right">{t('amountPaid', 'Amount Paid')}</th>
                  <th className="py-3 px-4">{t('mode', 'Mode')}</th>
                  <th className="py-3 px-4 text-right">{t('remainingBalance', 'Remaining Balance')}</th>
                  <th className="py-3 px-4 text-center">{t('statusHeader', 'Status')}</th>
                  <th className="py-3 px-4 text-center">{t('receipt', 'Receipt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">{t('noPaymentsRecorded', 'No payments recorded yet.')}</td></tr>
                ) : (
                  payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono text-slate-300">{formatDate(p.collection_date)}</td>
                      <td className="py-2.5 px-4 font-mono text-gold-400 font-bold">{p.receipt_number}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">{formatCurrency(p.amount_paid)}</td>
                      <td className="py-2.5 px-4 text-slate-300">{p.payment_mode}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-200">{formatCurrency(p.remaining_balance)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={async () => {
                            const rec = profile?.receipts.find(r => r.receipt_number === p.receipt_number);
                            if (rec) setSelectedReceipt(rec);
                          }}
                          className="px-2.5 py-1 rounded bg-navy-950 hover:bg-gold-500/20 border border-gold-500/30 text-gold-300 text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>{t('receipt', 'Receipt')}</span>
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

      {/* 3. KYC DOCUMENTS TAB */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white">{t('kycBusinessDocuments', 'KYC & Business Documents')}</h3>
              <p className="text-xs text-slate-400">{t('officialIdRecords', 'Official identification and shop verification records')}</p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3 py-1.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('uploadDocument', 'Upload Document')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map(doc => (
              <div key={doc.id} className="glass-card p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <strong className="text-white">{t(doc.document_type, doc.document_type)}</strong>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    doc.verification_status === 'Verified' ? 'bg-emerald-500/20 text-emerald-300' :
                    doc.verification_status === 'Rejected' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {t(doc.verification_status, doc.verification_status)}
                  </span>
                </div>
                <div className="text-slate-400">{t('docNumber', 'Doc Number')}: <span className="font-mono text-slate-200">{doc.document_number}</span></div>
                <div className="text-slate-400 text-[11px]">{t('uploadedOn', 'Uploaded on')}: {formatDate(doc.upload_date)} {t('by', 'by')} {doc.uploaded_by}</div>
                {doc.remarks && <div className="text-[11px] text-slate-500 italic">{doc.remarks}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SHOP & PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Business Info */}
          <div className="glass-card p-5 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4" />
              {t('shopCommercialDetails', 'Shop / Commercial Details')}
            </h3>
            <div className="text-xs space-y-2 pt-1">
              <div className="flex justify-between"><span className="text-slate-400">{t('shopName', 'Shop Name')}:</span> <strong className="text-white">{business?.shop_name}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">{t('category', 'Category')}:</span> <span className="text-slate-300">{business?.business_category}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">{t('shopAddress', 'Shop Address')}:</span> <span className="text-slate-300">{business?.shop_address}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">{t('shopArea', 'Shop Area')}:</span> <span className="text-slate-300">{business?.shop_area}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">{t('approxDailySales', 'Approx Daily Sales')}:</span> <span className="text-emerald-400 font-mono font-bold">{formatCurrency(business?.approx_daily_sales)}</span></div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="glass-card p-5 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon className="w-4 h-4" />
              {t('ownerPersonalProfile', 'Owner Personal Profile')}
            </h3>
            <div className="text-xs space-y-2 pt-1">
              <div className="flex justify-between"><span className="text-slate-400">{t('ownerName', 'Owner Name')}:</span> <strong className="text-white">{personal?.full_name}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">{t('customerId', 'Customer ID')}:</span> <span className="font-mono text-gold-400 font-bold">{customerId}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">{t('mobileNumber', 'Mobile Number')}:</span> <span className="font-mono text-slate-200">{personal?.mobile_number}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">{t('residentialCity', 'Residential City')}:</span> <span className="text-slate-300">{profile?.address?.city}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">{t('portalAccessPin', 'Portal Access PIN')}:</span> <span className="font-mono text-slate-400">•••• ({t('configured', 'Configured')})</span></div>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/40 p-6 max-w-md w-full bg-navy-900 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-3">{t('uploadKycDocument', 'Upload KYC Document')}</h3>
            <form onSubmit={handleUploadDoc} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('documentType', 'Document Type')}</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                >
                  <option value="Aadhaar Card">{t('aadhaarCard', 'Aadhaar Card')}</option>
                  <option value="PAN Card">{t('panCard', 'PAN Card')}</option>
                  <option value="Shop Licence">{t('shopLicence', 'Shop Licence')}</option>
                  <option value="Bank Passbook">{t('bankPassbook', 'Bank Passbook')}</option>
                  <option value="Driving Licence">{t('drivingLicense', 'Driving Licence')}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('documentNumberId', 'Document Number / ID')}</label>
                <input
                  type="text"
                  placeholder={t('e.g. 1234 5678 9012', 'e.g. 1234 5678 9012')}
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold"
                >
                  {uploading ? t('uploading...', 'Uploading...') : t('submitDocument', 'Submit Document')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300"
                >
                  {t('cancel', 'Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RAZORPAY CHECKOUT MODAL (For UPI, QR, NetBanking Repayments) */}
      {showRazorpayModal && acc && (
        <RazorpayCheckoutModal
          account={acc}
          profile={profile}
          initialAmount={razorpayInitialAmount}
          onClose={() => setShowRazorpayModal(false)}
          onSuccess={async (paymentId, receipt) => {
            setShowRazorpayModal(false);
            await loadData();
            if (receipt) {
              setSelectedReceipt(receipt);
            }
          }}
        />
      )}

      {/* RECEIPT MODAL (Auto-closes in 5 seconds per request) */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          autoClose={true}
        />
      )}
    </div>
  );
};
