import React, { useState, useEffect } from 'react';
import { Receipt } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { 
  Printer, 
  Download, 
  X, 
  CheckCircle, 
  ShieldCheck, 
  Clock, 
  Pause,
  Share2,
  Check,
  FileText,
  Smartphone,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ReceiptModalProps {
  receipt: Receipt | null;
  customerMobile?: string;
  onClose: () => void;
  autoClose?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ 
  receipt, 
  customerMobile,
  onClose, 
  autoClose = false 
}) => {
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState<'standard' | 'whatsapp' | 'thermal'>('standard');
  const [countdown, setCountdown] = useState<number>(autoClose ? 5 : 0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [targetPhone, setTargetPhone] = useState<string>(customerMobile || '');
  const [delivered, setDelivered] = useState<boolean>(false);

  useEffect(() => {
    if (!autoClose || isPaused || !receipt) return;
    if (countdown <= 0) {
      onClose();
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoClose, isPaused, countdown, onClose, receipt]);

  if (!receipt) return null;

  const handlePrint = (mode: 'standard' | 'thermal' = 'standard') => {
    setIsPaused(true);
    setActiveView(mode);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleDownloadPDF = () => {
    setIsPaused(true);
    setActiveView('standard');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const getWhatsAppMessage = () => {
    return (
`*DAILY COLLECTION - OFFICIAL PAYMENT RECEIPT*
----------------------------------------
*Receipt No:* ${receipt.receipt_number}
*Date:* ${formatDateTime(receipt.created_at)}
*Customer:* ${receipt.customer_name} (${receipt.customer_id})
*Shop/Business:* ${receipt.shop_name || 'Retail'}
*Account ID:* ${receipt.collection_account_id}
----------------------------------------
*Daily Due:* ${formatCurrency(receipt.daily_due)}
*Amount Paid:* *${formatCurrency(receipt.amount_paid)}*
*Payment Mode:* ${receipt.payment_mode}
${receipt.transaction_ref ? `*Ref/Razorpay ID:* ${receipt.transaction_ref}\n` : ''}----------------------------------------
*Previous Balance:* ${formatCurrency(receipt.previous_balance)}
*Remaining Balance:* *${formatCurrency(receipt.remaining_balance)}*
*Collected By:* ${receipt.collector_name}
----------------------------------------
Thank you for your prompt daily payment.
DAILY COLLECTION • Mount Road, Chennai - 600002`
    );
  };

  const handleSendWhatsApp = () => {
    setIsPaused(true);
    const cleanPhone = (targetPhone || customerMobile || '').replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(getWhatsAppMessage());
    const waUrl = phoneWithCountry 
      ? `https://wa.me/${phoneWithCountry}?text=${text}`
      : `https://wa.me/?text=${text}`;
    
    window.open(waUrl, '_blank');
    setDelivered(true);
  };

  const formattedTime = new Date(receipt.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/85 backdrop-blur-md overflow-y-auto">
      <div className="glass-card rounded-2xl border border-gold-500/40 p-4 sm:p-6 max-w-lg w-full bg-navy-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Modal Controls (Not Printed) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gold-400" />
            <h3 className="text-sm font-bold text-white">{t('payment receipt & share', 'Payment Receipt & Share')}</h3>
          </div>

          <div className="flex items-center gap-2">
            {autoClose && !isPaused && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
                <Clock className="w-3 h-3 animate-spin" />
                <span>{t('closing in', 'Closing in')} {countdown}s</span>
                <button
                  type="button"
                  onClick={() => setIsPaused(true)}
                  className="ml-1 text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  title={t('pause auto-closing', 'Pause auto-closing')}
                >
                  {t('pause', 'Pause')}
                </button>
              </div>
            )}
            {autoClose && isPaused && (
              <span className="text-[10px] text-slate-400 italic">{t('auto-close paused', 'Auto-close paused')}</span>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={t('close receipt', 'Close Receipt')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher (Standard PDF Receipt, WhatsApp Share, Thermal Receipt) */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-navy-950 border border-slate-800 mb-4 no-print text-xs font-bold">
          <button
            type="button"
            onClick={() => { setActiveView('standard'); setIsPaused(true); }}
            className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeView === 'standard'
                ? 'bg-gold-500 text-navy-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('official receipt', 'Official Receipt')}</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveView('whatsapp'); setIsPaused(true); }}
            className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeView === 'whatsapp'
                ? 'bg-emerald-500 text-navy-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t('whatsapp share', 'WhatsApp Share')}</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveView('thermal'); setIsPaused(true); }}
            className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeView === 'thermal'
                ? 'bg-slate-200 text-navy-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('thermal slip', 'Thermal Slip')}</span>
          </button>
        </div>

        {/* 1. STANDARD OFFICIAL RECEIPT (Printable & Downloadable PDF) */}
        {activeView === 'standard' && (
          <div id="receipt-print" className="printable-area bg-white text-slate-900 p-5 sm:p-6 rounded-xl border border-slate-200 shadow-inner font-sans">
            {/* Header with Gold Coin Logo */}
            <div className="text-center pb-3 border-b-2 border-slate-900/80 mb-3">
              <div className="flex items-center justify-center gap-2.5 mb-1">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 via-gold-400 to-amber-300 flex items-center justify-center text-navy-950 font-black text-lg shadow-sm border border-amber-600">
                  ₹
                </div>
                <div className="text-left">
                  <h2 className="text-xl font-black tracking-tight text-slate-950 leading-none">
                    DAILY COLLECTION
                  </h2>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block mt-0.5">
                    Mount Road, Chennai - 600002
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Tamil Nadu &bull; Phone: +91 94432 10001 &bull; support@dailycollection.com
              </p>
            </div>

            {/* Receipt Meta */}
            <div className="flex items-center justify-between text-[11px] mb-3 pb-2 border-b border-slate-200 font-mono">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-sans">{t('receipt number', 'Receipt Number')}</span>
                <strong className="text-slate-900 font-bold">{receipt.receipt_number}</strong>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[9px] uppercase font-sans">{t('date & time', 'Date & Time')}</span>
                <span className="text-slate-900 font-semibold">{formatDateTime(receipt.created_at)}</span>
              </div>
            </div>

            {/* Customer & Shop Details */}
            <div className="space-y-1 text-xs mb-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('customer id', 'Customer ID')}:</span>
                <strong className="text-slate-900 font-mono">{receipt.customer_id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('customer name', 'Customer Name')}:</span>
                <strong className="text-slate-900">{receipt.customer_name}</strong>
              </div>
              {receipt.shop_name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('shop / business', 'Shop / Business')}:</span>
                  <span className="text-slate-800 font-semibold">{receipt.shop_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">{t('account id', 'Account ID')}:</span>
                <span className="text-slate-800 font-mono">{receipt.collection_account_id}</span>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="border border-slate-300 rounded-lg overflow-hidden text-xs mb-3">
              <div className="bg-slate-100 px-3 py-1.5 flex justify-between font-bold text-slate-700 border-b border-slate-300">
                <span>{t('description', 'Description')}</span>
                <span>{t('amount', 'Amount')}</span>
              </div>
              <div className="p-3 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>{t('daily installment due', 'Daily Installment Due')}</span>
                  <span>{formatCurrency(receipt.daily_due)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-dashed border-slate-300">
                  <span className="text-amber-800">{t('amount collected', 'Amount Collected')}</span>
                  <span className="text-emerald-700 font-extrabold">{formatCurrency(receipt.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px] pt-1">
                  <span>{t('payment mode', 'Payment Mode')}</span>
                  <span className="font-semibold text-slate-700 uppercase">{receipt.payment_mode ? t(receipt.payment_mode.toLowerCase(), receipt.payment_mode) : ''}</span>
                </div>
                {receipt.transaction_ref && (
                  <div className="flex justify-between text-slate-500 text-[10px] pt-1">
                    <span>{t('txn / ref', 'Txn / Ref')}</span>
                    <span className="font-mono font-bold text-slate-800">{receipt.transaction_ref}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Balance Status (Decreasing remaining balance) */}
            <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs mb-3 space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>{t('previous balance', 'Previous Balance')}:</span>
                <span className="font-mono">{formatCurrency(receipt.previous_balance)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>{t('remaining loan balance', 'Remaining Loan Balance')}:</span>
                <span className="text-amber-900 font-mono text-sm">{formatCurrency(receipt.remaining_balance)}</span>
              </div>
            </div>

            {/* Collector & Sign Off */}
            <div className="flex items-end justify-between pt-2 border-t border-slate-300 text-[10px]">
              <div>
                <span className="text-slate-500 block">{t('authorized collector', 'Authorized Collector')}:</span>
                <strong className="text-slate-800">{receipt.collector_name}</strong>
              </div>
              <div className="text-right">
                <div className="w-24 border-b border-slate-400 mb-1" />
                <span className="text-slate-500">{t('collector signature', 'Collector Signature')}</span>
              </div>
            </div>

            {/* Footer Thank You */}
            <div className="mt-3 pt-2 border-t border-dashed border-slate-300 text-center">
              <p className="text-xs font-bold text-slate-900">{t('thank you for your prompt payment.', 'Thank you for your prompt payment.')}</p>
            </div>
          </div>
        )}

        {/* 2. WHATSAPP SHARE CARD (Matches Mobile Mockup in Image 2!) */}
        {activeView === 'whatsapp' && (
          <div className="space-y-4">
            {/* Phone Screen Mockup Card */}
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-navy-950 p-4 sm:p-5 space-y-4 shadow-xl">
              {/* WhatsApp Header Pill */}
              <div className="bg-[#128C7E] px-4 py-3 rounded-xl flex items-center gap-3 text-white shadow-md">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-black text-sm">
                  💬
                </div>
                <div>
                  <h4 className="text-sm font-bold leading-tight">WhatsApp</h4>
                  <p className="text-[10px] text-emerald-100">{t('share receipt with customer', 'Share receipt with customer')}</p>
                </div>
              </div>

              {/* Receipt Attachment Card (Matching Image 2) */}
              <div className="bg-white text-slate-900 p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-xs flex flex-col items-center justify-center shadow-md flex-shrink-0">
                  <span className="text-[10px] tracking-wider">PDF</span>
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="text-xs text-slate-900 block truncate">{t('payment receipt', 'Payment receipt')}</strong>
                  <div className="text-sm font-bold text-slate-800">
                    {formatCurrency(receipt.amount_paid)} &bull; {t('today', 'Today')}
                  </div>
                  <span className="text-[11px] font-mono text-blue-600 font-semibold block">
                    {t('receipt #', 'Receipt #')}{receipt.receipt_number}
                  </span>
                </div>
              </div>

              {/* Send on WhatsApp Button */}
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer group"
              >
                <span>{t('send on whatsapp', 'Send on WhatsApp')}</span>
                <ExternalLink className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Delivery Status Badge (Like Image 2) */}
              {delivered ? (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-navy-950 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>{t('receipt delivered', 'Receipt delivered')}</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-navy-900 border border-slate-800 text-slate-400 text-xs flex items-center justify-between">
                  <span>{t('send to:', 'Send to:')}</span>
                  <input
                    type="tel"
                    placeholder={t('Enter customer WhatsApp number', 'Enter customer WhatsApp number')}
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    className="px-2 py-1 bg-navy-950 border border-slate-700 rounded-lg text-xs text-white font-mono w-44 text-right focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Customer Chat Bubble Preview (Matching Image 2) */}
              <div className="bg-[#DCF8C6] text-slate-900 p-3 rounded-xl rounded-tl-none border border-emerald-300/50 text-xs space-y-1 shadow-sm max-w-sm">
                <span className="font-bold text-[11px] text-emerald-950 block">{receipt.customer_name}</span>
                <p className="text-slate-800 text-xs">
                  EMI of {formatCurrency(receipt.amount_paid)} received. PDF receipt attached.
                </p>
                <div className="text-[10px] text-emerald-900/80 font-mono text-right flex items-center justify-end gap-1">
                  <span>{t('receipt delivered', 'Delivered')} &bull; {formattedTime}</span>
                  <span className="text-blue-600 font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. THERMAL 58mm / 80mm RECEIPT (For Field Bluetooth Printers) */}
        {activeView === 'thermal' && (
          <div className="space-y-3">
            <div id="receipt-print" className="printable-area bg-white text-black p-4 rounded-xl border-2 border-dashed border-slate-400 max-w-[300px] mx-auto font-mono text-[11px] leading-tight shadow-md">
              <div className="text-center pb-2 border-b border-dashed border-black">
                <h3 className="font-extrabold text-sm tracking-wider">{t('appName', 'DAILY COLLECTION')}</h3>
                <p className="text-[10px]">{t('MOUNT ROAD, CHENNAI', 'MOUNT ROAD, CHENNAI')}</p>
                <p className="text-[9px]">{t('PH:', 'PH:')} +91 94432 10001</p>
              </div>

              <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10px]">
                <div>{t('RCPT:', 'RCPT:')} {receipt.receipt_number}</div>
                <div>{t('DATE:', 'DATE:')} {receipt.created_at.slice(0, 16).replace('T', ' ')}</div>
                <div>{t('CUST:', 'CUST:')} {receipt.customer_name}</div>
                <div>{t('ID:', 'ID:')} {receipt.customer_id}</div>
                {receipt.shop_name && <div>{t('SHOP:', 'SHOP:')} {receipt.shop_name}</div>}
              </div>

              <div className="py-2 border-b border-dashed border-black space-y-1 font-bold">
                <div className="flex justify-between">
                  <span>{t('DAILY DUE:', 'DAILY DUE:')}</span>
                  <span>{formatCurrency(receipt.daily_due)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>{t('PAID AMT:', 'PAID AMT:')}</span>
                  <span>{formatCurrency(receipt.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-normal">
                  <span>{t('MODE:', 'MODE:')}</span>
                  <span>{receipt.payment_mode ? t(receipt.payment_mode.toLowerCase(), receipt.payment_mode) : ''}</span>
                </div>
                {receipt.transaction_ref && (
                  <div className="flex justify-between text-[9px] font-normal">
                    <span>{t('REF:', 'REF:')}</span>
                    <span>{receipt.transaction_ref}</span>
                  </div>
                )}
              </div>

              <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>{t('PREV BAL:', 'PREV BAL:')}</span>
                  <span>{formatCurrency(receipt.previous_balance)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs">
                  <span>{t('REM BAL:', 'REM BAL:')}</span>
                  <span>{formatCurrency(receipt.remaining_balance)}</span>
                </div>
              </div>

              <div className="pt-2 text-center text-[9px] space-y-1">
                <div>{t('COLLECTOR:', 'COLLECTOR:')} {receipt.collector_name}</div>
                <div className="pt-1">{t('*** THANK YOU ***', '*** THANK YOU ***')}</div>
                <div>{t('KEEP RECEIPT FOR DISPUTES', 'KEEP RECEIPT FOR DISPUTES')}</div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              {t('Formatted for 58mm / 80mm Bluetooth ESC/POS mobile printers.', '🖨️ Formatted for 58mm / 80mm Bluetooth ESC/POS mobile printers.')}
            </p>
          </div>
        )}

        {/* Action Buttons (Not Printed) */}
        <div className="mt-4 pt-3 flex flex-wrap gap-2 no-print border-t border-slate-800">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="flex-1 min-w-[130px] py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{t('whatsapp share', 'WhatsApp Share')}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            className="flex-1 min-w-[120px] py-2.5 px-3 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t('download pdf', 'Download PDF')}</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrint(activeView === 'thermal' ? 'thermal' : 'standard')}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>{t('print', 'Print')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            {t('close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
