import React, { useState } from 'react';
import { CollectionAccount, Customer360Profile, LoanRequest } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { X, Sparkles, Send, CheckCircle2, Building, Calendar, Wallet } from 'lucide-react';

interface LoanRenewalRequestModalProps {
  profile: Customer360Profile;
  account: CollectionAccount | null;
  onClose: () => void;
  onSuccess: (request: LoanRequest) => void;
}

export const LoanRenewalRequestModal: React.FC<LoanRenewalRequestModalProps> = ({
  profile,
  account,
  onClose,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const [amount, setAmount] = useState<number>(account ? account.requested_amount : 10000);
  const [customAmountStr, setCustomAmountStr] = useState<string>(String(account ? account.requested_amount : 10000));
  const [days, setDays] = useState<number>(account ? account.collection_days : 100);
  const [purpose, setPurpose] = useState<string>('Shop Stock / FMCG Replenishment');
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedRequest, setSubmittedRequest] = useState<LoanRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = [10000, 15000, 20000, 25000, 30000, 50000];
  const dayOptions = [30, 50, 60, 90, 100, 120];

  const handlePresetSelect = (val: number) => {
    setAmount(val);
    setCustomAmountStr(String(val));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setCustomAmountStr(valStr);
    const parsed = Number(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      setAmount(parsed);
    }
  };

  const estimatedDaily = Math.round(amount / (days || 100));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Please enter a valid requested amount.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.requestLoanRenewal({
        customer_id: profile.personal.id,
        requested_amount: amount,
        collection_days: days,
        purpose,
        remarks: remarks.trim() || undefined,
      });

      if (res && res.success) {
        setSubmittedRequest(res.request);
        setTimeout(() => {
          onSuccess(res.request);
        }, 1800);
      } else {
        setError('Could not submit request. Please try again or call the office.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/85 backdrop-blur-md overflow-y-auto">
      <div className="glass-card rounded-3xl border border-gold-500/40 max-w-lg w-full bg-navy-900 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-gold-500/20 via-amber-500/10 to-transparent p-5 border-b border-gold-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gold-500/20 border border-gold-500/40 flex items-center justify-center text-gold-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Apply for Loan Renewal / Top-up</h3>
              <p className="text-xs text-slate-300">Fast-track approval based on your repayment track record</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {submittedRequest ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-black text-emerald-300">Request Submitted Successfully!</h4>
              <p className="text-xs text-slate-300">
                Reference ID: <strong className="text-gold-400 font-mono">{submittedRequest.id}</strong>
              </p>
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Our branch manager has been notified and will verify your shop before disbursal. Thank you for your partnership with KRS Finance!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
            {/* Customer & Shop Context Card */}
            <div className="bg-navy-950/70 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Applicant / Shop</span>
                <span className="text-white font-bold text-sm block">{profile.personal.full_name}</span>
                <span className="text-gold-400 text-xs block">{profile.business?.shop_name || 'Business'} &bull; {profile.personal.mobile_number}</span>
              </div>
              {account && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Repayment</span>
                  <span className="text-emerald-400 font-bold font-mono text-sm block">{account.collection_percentage}%</span>
                  <span className="text-slate-400 text-[10px] block">{account.completed_days} of {account.collection_days} days</span>
                </div>
              )}
            </div>

            {/* Requested Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gold-400 uppercase tracking-wider block">
                Requested Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-gold-400 font-black text-base">₹</span>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  value={customAmountStr}
                  onChange={handleAmountChange}
                  className="w-full pl-9 pr-4 py-2.5 bg-navy-950 border border-gold-500/40 rounded-xl text-base font-black text-white focus:outline-none focus:border-gold-400 font-mono"
                  placeholder="Enter requested amount"
                  required
                />
              </div>

              {/* Amount Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {presets.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handlePresetSelect(val)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all border cursor-pointer ${
                      amount === val
                        ? 'bg-gold-500 text-navy-950 border-gold-400 shadow-sm'
                        : 'bg-navy-950 border-slate-700 text-slate-300 hover:border-gold-500/40'
                    }`}
                  >
                    {formatCurrency(val)}
                  </button>
                ))}
              </div>
            </div>

            {/* Tenure Options */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Preferred Collection Period (Days)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {dayOptions.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`py-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      days === d
                        ? 'bg-gold-500 text-navy-950 border-gold-400 shadow-sm'
                        : 'bg-navy-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {d} Days
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Estimation Preview Card */}
            <div className="bg-gradient-to-r from-amber-500/10 via-gold-500/10 to-transparent p-3.5 rounded-2xl border border-gold-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gold-300 font-bold uppercase tracking-wider block">Estimated Daily Installment</span>
                <span className="text-slate-300 text-xs">Based on {days} equal daily payments</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-white font-mono">{formatCurrency(estimatedDaily)}</span>
                <span className="text-[10px] text-slate-400 block">/ day</span>
              </div>
            </div>

            {/* Purpose */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Purpose of Loan</label>
              <select
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-navy-950 border border-slate-800 rounded-xl text-white font-medium text-xs focus:outline-none focus:border-gold-400"
              >
                <option value="Shop Stock / FMCG Replenishment">Shop Stock / FMCG Replenishment</option>
                <option value="Festival Season Stock">Festival Season Stock (Diwali / Pongal / New Year)</option>
                <option value="Shop Renovation / Equipment">Shop Renovation / New Equipment</option>
                <option value="Working Capital / Cash Flow">Working Capital / Cash Flow</option>
                <option value="Bulk Purchase Discount">Bulk Goods Purchase for Higher Margin</option>
                <option value="Other Commercial Purpose">Other Commercial Purpose</option>
              </select>
            </div>

            {/* Additional Remarks */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Additional Notes / Message for Office</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={2}
                placeholder="e.g. Please visit tomorrow morning after 10 AM, stock arrival planned on Monday."
                className="w-full px-3.5 py-2 bg-navy-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-gold-400"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-sm shadow-lg shadow-gold-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting Request...' : 'Submit Loan Request'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
