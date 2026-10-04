import React, { useState } from 'react';
import { X, QrCode, CheckCircle2, Copy, Check, ShieldCheck, Smartphone, ExternalLink, Sparkles } from 'lucide-react';
import { DailyCollectionRecord } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton } from '../common/ui';
import { quickAmount } from './collectHelpers';

interface AgentCollectQrModalProps {
  record: DailyCollectionRecord;
  busy: boolean;
  onConfirm: (amount: number) => void;
  onClose: () => void;
}

const KRS_UPI_VPA = 'krsfinance@icici';
const KRS_PAYEE_NAME = 'KRS Finance';

export const AgentCollectQrModal: React.FC<AgentCollectQrModalProps> = ({
  record,
  busy,
  onConfirm,
  onClose,
}) => {
  const { t } = useLanguage();
  const defaultDue = quickAmount(record);
  const [amount, setAmount] = useState<number>(defaultDue);
  const [copied, setCopied] = useState<boolean>(false);

  // Quick preset chips
  const presets = [
    { label: t('1day', '1 Day'), value: Math.min(record.daily_due, record.balance_remaining) },
    { label: t('2days', '2 Days'), value: Math.min(record.daily_due * 2, record.balance_remaining) },
    { label: t('3days', '3 Days'), value: Math.min(record.daily_due * 3, record.balance_remaining) },
    { label: t('balance', 'Balance'), value: record.balance_remaining },
  ].filter(p => p.value > 0);

  // Dynamic UPI URI
  const note = `${record.customer_name} ${record.collection_account_id}`.trim();
  const upiUri = `upi://pay?pa=${KRS_UPI_VPA}&pn=${encodeURIComponent(KRS_PAYEE_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(upiUri)}`;

  const handleCopyVpa = () => {
    navigator.clipboard?.writeText(KRS_UPI_VPA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-card rounded-3xl border border-gold-500/40 w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-navy-900 to-navy-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-black text-white leading-tight">{record.customer_name}</div>
              <div className="text-xs text-slate-400 truncate">{record.shop_name || record.collection_area}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-center">
          {/* Amount Display & Input */}
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
              {t('scanToPay', 'Customer Scans to Pay')}
            </div>
            <div className="text-3xl sm:text-4xl font-black text-gold-300">
              {formatCurrency(amount)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {t('balance', 'Remaining Balance')}: {formatCurrency(record.balance_remaining)}
            </div>
          </div>

          {/* Quick Amount Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {presets.map(p => (
              <button
                key={p.label + p.value}
                type="button"
                onClick={() => setAmount(p.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  amount === p.value
                    ? 'bg-gold-500 text-navy-950 shadow-md font-black scale-105'
                    : 'bg-navy-900 hover:bg-navy-800 border border-slate-700 text-slate-300'
                }`}
              >
                {p.label}: {formatCurrency(p.value)}
              </button>
            ))}
          </div>

          {/* Custom Amount Entry */}
          <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
            <span className="text-xs text-slate-400 font-semibold">{t('custom', 'Custom')}: ₹</span>
            <input
              type="number"
              min={1}
              max={record.balance_remaining}
              value={amount || ''}
              onChange={e => {
                const val = Number(e.target.value);
                if (val >= 0) setAmount(Math.min(val, record.balance_remaining));
              }}
              className="w-28 px-3 py-1.5 bg-navy-950 border border-slate-700 rounded-xl text-center text-sm font-bold text-white focus:border-gold-500 focus:outline-none"
            />
          </div>

          {/* QR Code Container */}
          <div className="relative inline-block mx-auto p-4 rounded-3xl bg-white shadow-2xl border-4 border-gold-500/20">
            <img
              src={qrImageUrl}
              alt="Dynamic UPI QR Code"
              className="w-56 h-56 mx-auto object-contain rounded-xl"
              loading="eager"
            />
            <div className="absolute inset-x-0 bottom-2 text-center pointer-events-none">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-navy-950/90 text-[10px] font-bold text-gold-400 shadow">
                <Sparkles className="w-3 h-3" /> {KRS_PAYEE_NAME}
              </span>
            </div>
          </div>

          {/* Apps Supported Badges */}
          <div className="flex items-center justify-center gap-3 text-xs text-slate-400">
            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 font-medium">Google Pay</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 font-medium">PhonePe</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 font-medium">Paytm</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 font-medium">BHIM</span>
          </div>

          {/* UPI ID copy strip */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-navy-900 border border-slate-800 max-w-sm mx-auto text-left">
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">{t('upiId', 'Official UPI VPA')}</div>
              <div className="text-xs font-mono font-bold text-emerald-400 truncate">{KRS_UPI_VPA}</div>
            </div>
            <button
              type="button"
              onClick={handleCopyVpa}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t('copied', 'Copied') : t('copy', 'Copy')}</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{t('instantDirectBank', 'Direct deposit to KRS Finance Bank Account')}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-navy-900/90 border-t border-slate-800 flex flex-col gap-2">
          <BigButton
            tone="green"
            icon={CheckCircle2}
            label={`${t('confirmUpiReceived', 'Confirm Paid (UPI)')} ${formatCurrency(amount)}`}
            onClick={() => onConfirm(amount)}
            disabled={busy || amount <= 0}
            className="w-full text-base py-3.5"
          />
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            {t('cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
