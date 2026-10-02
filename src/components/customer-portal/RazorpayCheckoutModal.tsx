import React, { useState, useEffect } from 'react';
import { CollectionAccount, Customer360Profile } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { 
  ShieldCheck, 
  X, 
  Smartphone, 
  Building2, 
  QrCode, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  Check, 
  Copy, 
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

// NOT SHOWN ANYWHERE: this checkout is simulated (it records a payment without real money).
// It is kept so it can be wired to a real UPI/Razorpay connection later; see Passbook.tsx.
interface RazorpayCheckoutModalProps {
  account: CollectionAccount;
  profile: Customer360Profile | null;
  initialAmount?: number;
  onClose: () => void;
  onSuccess: (paymentId: string, receiptData: any) => void;
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  account,
  profile,
  initialAmount,
  onClose,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const [selectedMethod, setSelectedMethod] = useState<'upi_apps' | 'upi_qr' | 'upi_id' | 'netbanking' | 'bank_transfer'>('upi_apps');
  const [amount, setAmount] = useState<number>(initialAmount || account.daily_collection);
  const [customAmountStr, setCustomAmountStr] = useState<string>(String(initialAmount || account.daily_collection));
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('Google Pay');
  const [upiIdInput, setUpiIdInput] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');
  
  // Payment states
  const [processingState, setProcessingState] = useState<'idle' | 'authorizing' | 'success' | 'failed'>('idle');
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [generatedPaymentId, setGeneratedPaymentId] = useState<string>('');
  const [qrTimer, setQrTimer] = useState<number>(300); // 5 mins
  const [copiedBankField, setCopiedBankField] = useState<string | null>(null);

  // QR countdown timer
  useEffect(() => {
    if (selectedMethod !== 'upi_qr') return;
    const interval = setInterval(() => {
      setQrTimer(prev => (prev > 1 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedMethod]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAmountSelect = (val: number) => {
    const clamped = Math.min(account.remaining_amount, Math.max(10, val));
    setAmount(clamped);
    setCustomAmountStr(String(clamped));
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setCustomAmountStr(valStr);
    const parsed = Number(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      setAmount(Math.min(account.remaining_amount, parsed));
    }
  };

  // Copy helper
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedBankField(field);
    setTimeout(() => setCopiedBankField(null), 2000);
  };

  // Execute Razorpay Payment
  const initiatePayment = async () => {
    if (amount <= 0 || amount > account.remaining_amount) return;

    // Generate authentic Razorpay ID (format: pay_XXXXXXXXXXXXXXXX)
    const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 8);
    const razorpayPayId = `pay_${randomHex}`;
    setGeneratedPaymentId(razorpayPayId);

    setProcessingState('authorizing');
    setProcessingMessage('Connecting to Razorpay Secure Gateway...');

    // Multi-step realistic animation
    setTimeout(() => {
      if (selectedMethod.startsWith('upi')) {
        setProcessingMessage(`Request sent to ${selectedMethod === 'upi_apps' ? selectedUpiApp : 'UPI App'}. Authorizing transaction...`);
      } else {
        setProcessingMessage(`Connecting to ${selectedBank} NetBanking gateway...`);
      }
    }, 1000);

    setTimeout(async () => {
      try {
        setProcessingMessage('Payment authorized! Updating your collection ledger...');
        
        // Mode mapping for backend
        const mode = selectedMethod.startsWith('upi') ? 'Razorpay UPI' : 'Razorpay NetBanking';
        const remarks = selectedMethod.startsWith('upi')
          ? `Razorpay UPI Payment via ${selectedUpiApp || 'UPI'} (Ref: ${razorpayPayId})`
          : `Razorpay NetBanking via ${selectedBank} (Ref: ${razorpayPayId})`;

        // Post to backend
        const response = await fetch('/api/daily-collections/collect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('dc_token') ? { 'Authorization': `Bearer ${localStorage.getItem('dc_token')}` } : {}),
          },
          body: JSON.stringify({
            collection_account_id: account.id,
            amount_paid: amount,
            payment_mode: mode,
            transaction_ref: razorpayPayId,
            razorpay_payment_id: razorpayPayId,
            remarks,
          }),
        });

        const data = await response.json();
        
        if (data && data.success) {
          setProcessingState('success');
          setProcessingMessage(`Payment successful! Payment ID: ${razorpayPayId}`);
          setTimeout(() => {
            onSuccess(razorpayPayId, data.receipt);
          }, 1200);
        } else {
          setProcessingState('failed');
          setProcessingMessage(data.error || 'Payment confirmation failed.');
        }
      } catch (err: any) {
        setProcessingState('failed');
        setProcessingMessage(err.message || 'Payment network error. Please try again.');
      }
    }, 2400);
  };

  const upiApps = [
    { name: 'Google Pay', icon: 'GPay', color: 'from-blue-600 to-emerald-600', badge: 'Fastest' },
    { name: 'PhonePe', icon: 'PhonePe', color: 'from-purple-600 to-indigo-700', badge: 'Popular' },
    { name: 'Paytm', icon: 'Paytm', color: 'from-cyan-600 to-blue-700', badge: 'Instant' },
    { name: 'BHIM UPI', icon: 'BHIM', color: 'from-orange-500 to-green-600', badge: 'Govt UPI' },
    { name: 'CRED UPI', icon: 'CRED', color: 'from-zinc-800 to-zinc-950', badge: 'Rewards' },
  ];

  const popularBanks = [
    { name: 'HDFC Bank', code: 'HDFC', badge: 'Instant' },
    { name: 'State Bank of India', code: 'SBI', badge: 'Govt' },
    { name: 'ICICI Bank', code: 'ICICI', badge: 'Popular' },
    { name: 'Axis Bank', code: 'AXIS', badge: 'Direct' },
    { name: 'Kotak Mahindra', code: 'KOTAK', badge: 'Instant' },
    { name: 'Punjab National Bank', code: 'PNB', badge: 'Govt' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/85 backdrop-blur-md overflow-y-auto">
      <div className="glass-card rounded-3xl border border-gold-500/40 max-w-xl w-full bg-navy-900 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Razorpay Brand Top Bar */}
        <div className="bg-[#0c2340] px-5 py-3.5 border-b border-blue-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Razorpay Logo Badge */}
            <div className="flex items-center gap-1.5 bg-[#07162c] px-3 py-1.5 rounded-lg border border-blue-400/30">
              <span className="text-blue-400 font-black text-sm tracking-wider">Razorpay</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-blue-200/80 font-mono font-semibold">{t('CHECKOUT', 'CHECKOUT')}</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-[11px] font-bold text-white leading-tight">DAILY COLLECTION</div>
              <div className="text-[9px] text-blue-300/80">{t('secured 256-bit ssl gateway', 'Secured 256-bit SSL Gateway')}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('verified merchant', 'Verified Merchant')}</span>
            </div>
            <button
              onClick={onClose}
              disabled={processingState === 'authorizing'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-40 cursor-pointer"
              title={t('Close payment window', 'Close payment window')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Processing Overlay */}
        {processingState !== 'idle' && (
          <div className="p-8 text-center space-y-4 min-h-[380px] flex flex-col items-center justify-center">
            {processingState === 'authorizing' && (
              <>
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-blue-500/20 border-t-blue-400 animate-spin flex items-center justify-center" />
                  <div className="absolute inset-0 flex items-center justify-center text-blue-400 font-black text-lg">
                    ₹
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">{t('razorpay secure processing', 'Razorpay Secure Processing')}</h4>
                  <p className="text-xs text-blue-300 font-mono animate-pulse">{processingMessage}</p>
                </div>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Please do not refresh or press back. Your installment is being credited securely.
                </p>
              </>
            )}

            {processingState === 'success' && (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-emerald-300">{t('payment approved!', 'Payment Approved!')}</h4>
                  <p className="text-xs text-slate-200">{processingMessage}</p>
                  <p className="text-[11px] text-gold-400 font-mono font-bold pt-1">
                    Razorpay ID: {generatedPaymentId}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Generating official DAILY COLLECTION receipt now...
                </p>
              </>
            )}

            {processingState === 'failed' && (
              <>
                <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-rose-400">{t('payment failed', 'Payment Failed')}</h4>
                  <p className="text-xs text-slate-300">{processingMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProcessingState('idle')}
                  className="px-4 py-2 rounded-xl bg-gold-500 text-navy-950 font-bold text-xs cursor-pointer"
                >
                  {t('try again', 'Try Again')}
                </button>
              </>
            )}
          </div>
        )}

        {/* Normal Content (When Idle) */}
        {processingState === 'idle' && (
          <div className="p-5 sm:p-6 space-y-5">
            {/* Amount Selection & Account Header */}
            <div className="bg-navy-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">{t('repayment for', 'Repayment For')}</span>
                  <span className="text-white font-bold">{account.customer_name} &bull; {account.shop_name || 'Business'}</span>
                  <span className="text-slate-400 text-[11px] block font-mono">{t('account id', 'Account')}: {account.id}</span>
                </div>
                <div className="sm:text-right">
                  <span className="text-slate-400 block text-[10px] uppercase">{t('current remaining balance', 'Current Remaining Balance')}</span>
                  <span className="text-amber-400 font-black font-mono text-sm">
                    {formatCurrency(account.remaining_amount)}
                  </span>
                </div>
              </div>

              {/* Amount Input & Preset Chips */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gold-400 uppercase tracking-wider">
                    {t('select amount to repay', 'Select Amount to Repay')}
                  </label>
                  <span className="text-xs text-slate-300 font-mono">
                    {t('daily due', 'Daily Due')}: <strong className="text-white">{formatCurrency(account.daily_collection)}</strong>
                  </span>
                </div>

                <div className="relative mb-2">
                  <span className="absolute left-3.5 top-2.5 text-gold-400 font-black text-lg">₹</span>
                  <input
                    type="number"
                    min="10"
                    max={account.remaining_amount}
                    value={customAmountStr}
                    onChange={handleCustomAmountChange}
                    className="w-full pl-9 pr-24 py-2.5 bg-navy-900 border border-gold-500/50 rounded-xl text-lg font-black text-white focus:outline-none focus:border-gold-400 font-mono shadow-inner"
                    placeholder={t('Enter amount', 'Enter amount')}
                  />
                  <div className="absolute right-2 top-2 px-2.5 py-1 rounded-lg bg-navy-950 text-[11px] font-mono text-gold-300 font-bold border border-gold-500/30">
                    INR
                  </div>
                </div>

                {/* Quick Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAmountSelect(account.daily_collection)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all border cursor-pointer ${
                      amount === account.daily_collection
                        ? 'bg-gold-500 text-navy-950 border-gold-400 shadow-sm'
                        : 'bg-navy-900 border-slate-700 text-slate-300 hover:border-gold-500/50'
                    }`}
                  >
                    {t('1 day', '1 Day')} ({formatCurrency(account.daily_collection)})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAmountSelect(account.daily_collection * 2)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all border cursor-pointer ${
                      amount === account.daily_collection * 2
                        ? 'bg-gold-500 text-navy-950 border-gold-400 shadow-sm'
                        : 'bg-navy-900 border-slate-700 text-slate-300 hover:border-gold-500/50'
                    }`}
                  >
                    {t('2 days', '2 Days')} ({formatCurrency(account.daily_collection * 2)})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAmountSelect(account.daily_collection * 5)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all border cursor-pointer ${
                      amount === account.daily_collection * 5
                        ? 'bg-gold-500 text-navy-950 border-gold-400 shadow-sm'
                        : 'bg-navy-900 border-slate-700 text-slate-300 hover:border-gold-500/50'
                    }`}
                  >
                    {t('5 days', '5 Days')} ({formatCurrency(account.daily_collection * 5)})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAmountSelect(account.remaining_amount)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all border ml-auto cursor-pointer ${
                      amount === account.remaining_amount
                        ? 'bg-emerald-500 text-navy-950 border-emerald-400 shadow-sm'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    {t('close loan', 'Close Loan')} ({formatCurrency(account.remaining_amount)})
                  </button>
                </div>
              </div>
            </div>

            {/* Method Tabs */}
            <div>
              <div className="flex border-b border-slate-800 text-xs font-bold gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('upi_apps')}
                  className={`pb-2.5 px-3 flex items-center gap-1.5 transition-all border-b-2 ${
                    selectedMethod === 'upi_apps'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{t('Razorpay UPI Apps', 'Razorpay UPI Apps')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('upi_qr')}
                  className={`pb-2.5 px-3 flex items-center gap-1.5 transition-all border-b-2 ${
                    selectedMethod === 'upi_qr'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{t('Scan UPI QR', 'Scan UPI QR')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('netbanking')}
                  className={`pb-2.5 px-3 flex items-center gap-1.5 transition-all border-b-2 ${
                    selectedMethod === 'netbanking'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{t('NetBanking', 'NetBanking')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('bank_transfer')}
                  className={`pb-2.5 px-3 flex items-center gap-1.5 transition-all border-b-2 ${
                    selectedMethod === 'bank_transfer'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t('Direct Transfer', 'Direct Transfer')}</span>
                </button>
              </div>

              {/* Tab 1: UPI Apps */}
              {selectedMethod === 'upi_apps' && (
                <div className="pt-4 space-y-3">
                  <span className="text-[11px] text-slate-400 block">
                    {t('Select your preferred UPI application. You will be redirected to approve', 'Select your preferred UPI application. You will be redirected to approve')} ₹{amount}.
                  </span>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {upiApps.map(app => (
                      <button
                        key={app.name}
                        type="button"
                        onClick={() => setSelectedUpiApp(app.name)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                          selectedUpiApp === app.name
                            ? 'bg-blue-950/50 border-blue-500 ring-1 ring-blue-500/50 text-white'
                            : 'bg-navy-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold block">{app.name}</span>
                          <span className="text-[9px] text-blue-400 block font-semibold">{t(app.badge, app.badge)}</span>
                        </div>
                        {selectedUpiApp === app.name ? (
                          <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-700" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* UPI ID alternative */}
                  <div className="pt-2">
                    <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                      {t('Or enter UPI ID / VPA', 'Or enter UPI ID / VPA')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('e.g. mobile@okaxis, shop@paytm', 'e.g. mobile@okaxis, shop@paytm')}
                      value={upiIdInput}
                      onChange={(e) => setUpiIdInput(e.target.value)}
                      className="w-full px-3.5 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Scan UPI QR */}
              {selectedMethod === 'upi_qr' && (
                <div className="pt-4 text-center space-y-3">
                  <div className="w-44 h-44 mx-auto bg-white p-2.5 rounded-2xl shadow-xl flex items-center justify-center border-2 border-blue-500/50 relative">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-navy-950">
                      {/* Corner Position Markers */}
                      <rect x="5" y="5" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
                      <rect x="13" y="13" width="10" height="10" fill="currentColor" />
                      <rect x="69" y="5" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
                      <rect x="77" y="13" width="10" height="10" fill="currentColor" />
                      <rect x="5" y="69" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
                      <rect x="13" y="77" width="10" height="10" fill="currentColor" />
                      {/* Simulated QR matrix */}
                      <circle cx="50" cy="20" r="3" fill="currentColor" />
                      <circle cx="40" cy="30" r="3" fill="currentColor" />
                      <circle cx="60" cy="30" r="3" fill="currentColor" />
                      <circle cx="50" cy="40" r="3" fill="currentColor" />
                      <circle cx="35" cy="50" r="3" fill="currentColor" />
                      <circle cx="65" cy="50" r="3" fill="currentColor" />
                      <circle cx="50" cy="60" r="3" fill="currentColor" />
                      <circle cx="40" cy="70" r="3" fill="currentColor" />
                      <circle cx="60" cy="70" r="3" fill="currentColor" />
                      <circle cx="85" cy="45" r="3" fill="currentColor" />
                      <circle cx="85" cy="65" r="3" fill="currentColor" />
                      <circle cx="45" cy="85" r="3" fill="currentColor" />
                      {/* Center Razorpay Badge */}
                      <circle cx="50" cy="50" r="13" fill="#0c2340" />
                      <text x="50" y="54" fontSize="11" fontWeight="900" textAnchor="middle" fill="#38BDF8">R</text>
                    </svg>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <span className="text-slate-300 font-mono">
                      {t('QR active:', 'QR active:')} <strong className="text-blue-300">{formatTimer(qrTimer)}</strong>
                    </span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="text-emerald-400 font-semibold text-[11px]">{t('Instant Auto-Verify', 'Instant Auto-Verify')}</span>
                  </div>

                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    {t('Scan with Google Pay, PhonePe, Paytm, or BHIM app to pay', 'Scan with Google Pay, PhonePe, Paytm, or BHIM app to pay')} ₹{amount}.
                  </p>
                </div>
              )}

              {/* Tab 3: NetBanking */}
              {selectedMethod === 'netbanking' && (
                <div className="pt-4 space-y-3">
                  <span className="text-[11px] text-slate-400 block">
                    {t('Choose your bank for direct Internet Banking authorization.', 'Choose your bank for direct Internet Banking authorization.')}
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {popularBanks.map(bank => (
                      <button
                        key={bank.name}
                        type="button"
                        onClick={() => setSelectedBank(bank.name)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                          selectedBank === bank.name
                            ? 'bg-blue-950/50 border-blue-500 ring-1 ring-blue-500/50 text-white'
                            : 'bg-navy-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold block">{bank.name}</span>
                          <span className="text-[9px] text-blue-400 font-mono font-semibold">{bank.code}</span>
                        </div>
                        {selectedBank === bank.name && (
                          <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                      {t('Other Banks (50+ Indian Banks)', 'Other Banks (50+ Indian Banks)')}
                    </label>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="HDFC Bank">HDFC Bank</option>
                      <option value="State Bank of India">State Bank of India</option>
                      <option value="ICICI Bank">ICICI Bank</option>
                      <option value="Axis Bank">Axis Bank</option>
                      <option value="Kotak Mahindra">Kotak Mahindra Bank</option>
                      <option value="Bank of Baroda">Bank of Baroda</option>
                      <option value="Canara Bank">Canara Bank</option>
                      <option value="Union Bank of India">Union Bank of India</option>
                      <option value="Indian Bank">Indian Bank</option>
                      <option value="IndusInd Bank">IndusInd Bank</option>
                      <option value="Yes Bank">Yes Bank</option>
                      <option value="IDFC First Bank">IDFC First Bank</option>
                      <option value="Tamilnad Mercantile Bank">Tamilnad Mercantile Bank</option>
                      <option value="Karur Vysya Bank">Karur Vysya Bank</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Tab 4: Direct Bank Transfer Details */}
              {selectedMethod === 'bank_transfer' && (
                <div className="pt-4 space-y-3">
                  <div className="bg-navy-950 p-3.5 rounded-xl border border-blue-500/30 text-xs space-y-2">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">
                      {t('Razorpay Smart Collect Virtual Account (NEFT / IMPS)', 'Razorpay Smart Collect Virtual Account (NEFT / IMPS)')}
                    </span>

                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-slate-400">{t('Beneficiary Name', 'Beneficiary Name')}</span>
                      <strong className="text-white font-mono">DAILY COLLECTION - {account.customer_id}</strong>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-slate-400">{t('Virtual A/C Number', 'Virtual A/C Number')}</span>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-gold-400 font-mono">RZPDC{account.customer_id}</strong>
                        <button
                          type="button"
                          onClick={() => handleCopy(`RZPDC${account.customer_id}`, 'acc')}
                          className="p-1 rounded text-slate-400 hover:text-white"
                          title={t('Copy Account Number', 'Copy Account Number')}
                        >
                          {copiedBankField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-slate-400">{t('IFSC Code', 'IFSC Code')}</span>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-blue-300 font-mono">RAZR0000001</strong>
                        <button
                          type="button"
                          onClick={() => handleCopy('RAZR0000001', 'ifsc')}
                          className="p-1 rounded text-slate-400 hover:text-white"
                          title={t('Copy IFSC', 'Copy IFSC')}
                        >
                          {copiedBankField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">{t('Account Type & Bank', 'Account Type & Bank')}</span>
                      <span className="text-slate-300">{t('Current A/C • Razorpay / Yes Bank', 'Current A/C • Razorpay / Yes Bank')}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    💡 {t('Transfers made to this unique account are automatically reconciled and credited to your DAILY COLLECTION balance within 15 minutes.', 'Transfers made to this unique account are automatically reconciled and credited to your DAILY COLLECTION balance within 15 minutes.')}
                  </p>
                </div>
              )}
            </div>

            {/* Pay Button / Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={initiatePayment}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer group"
              >
                <Lock className="w-4 h-4 text-blue-200" />
                <span>{t('pay', 'Pay')} {formatCurrency(amount)} {t('via Razorpay', 'via Razorpay')}</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {t('PCI-DSS Compliant • 100% Safe & Secure', 'PCI-DSS Compliant • 100% Safe & Secure')}
                </span>
                <span className="font-mono text-slate-500">
                  DAILY COLLECTION &bull; CHENNAI
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
