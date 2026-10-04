import React, { useCallback, useEffect, useState } from 'react';
import {
  Printer,
  Receipt as ReceiptIcon,
  RotateCcw,
  Wallet,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Plus,
  Minus,
  Check,
  Building2,
  Smartphone,
  Coins,
} from 'lucide-react';
import { DailyCollectionRecord, Receipt, User } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, ConfirmSheet, EmptyState, PageTitle, Spinner } from '../common/ui';
import { ReceiptModal } from '../collections/ReceiptModal';
import { DailyCollectionRegisterView } from '../collections/DailyCollectionRegisterView';
import { dayState } from './collectHelpers';
import { printHtmlViaIframe } from '../../utils/printHelper';

const DENOM_LIST = [500, 200, 100, 50, 20, 10];

const DENOM_THEMES: Record<number, { bg: string; text: string; border: string }> = {
  500: { bg: 'bg-stone-500/20', text: 'text-stone-300', border: 'border-stone-500/40' },
  200: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40' },
  100: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
  50: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40' },
  20: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  10: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/40' },
};

/** A collector's day at a glance: collections by mode, denomination counter, cash handover slip & today's receipts. */
export const MyDayView: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const { t, language } = useLanguage();
  const isTamil = language === 'ta';
  const today = todayIso();
  const collectorId = currentUser.collector_id || 'ALL';

  const [records, setRecords] = useState<DailyCollectionRecord[] | null>(null);
  const [receiptView, setReceiptView] = useState<{ receipt: Receipt; phone: string } | null>(null);
  const [undoFor, setUndoFor] = useState<DailyCollectionRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  // End-of-Day Denomination Counter State
  const [denominations, setDenominations] = useState<{ [key: number]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
  });
  const [coins, setCoins] = useState<number>(0);

  const load = useCallback(async () => {
    try {
      setRecords(await api.getDailyCollections({ date: today, collector: collectorId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
      setRecords([]);
    }
  }, [today, collectorId]);

  useEffect(() => {
    load();
  }, [load]);

  if (showRegister) {
    return <DailyCollectionRegisterView onBack={() => setShowRegister(false)} date={today} collectorId={collectorId} />;
  }
  if (!records) return <Spinner />;

  const paid = records.filter(r => dayState(r) === 'paid');
  const total = paid.reduce((s, r) => s + r.paid_amount, 0);
  const byMode = paid.reduce<Record<string, number>>((acc, r) => {
    const mode = r.payment_mode || 'Cash';
    acc[mode] = (acc[mode] || 0) + r.paid_amount;
    return acc;
  }, {});

  // Cash vs Online Breakdown
  const expectedCash = Object.entries(byMode).reduce((sum, [mode, amount]) => {
    if (mode.toLowerCase().includes('cash')) return sum + amount;
    return sum;
  }, 0);

  const expectedUpi = Object.entries(byMode).reduce((sum, [mode, amount]) => {
    if (mode.toLowerCase().includes('upi') || mode.toLowerCase().includes('online') || mode.toLowerCase().includes('razorpay')) {
      return sum + amount;
    }
    return sum;
  }, 0);

  // Denominations live sum
  const countedNotesCash = DENOM_LIST.reduce((sum, denom) => sum + (denominations[denom] || 0) * denom, 0);
  const totalPhysicalCash = countedNotesCash + (Number(coins) || 0);
  const cashDifference = totalPhysicalCash - expectedCash;

  const handleDenomChange = (denom: number, count: number) => {
    setDenominations(prev => ({
      ...prev,
      [denom]: Math.max(0, count || 0),
    }));
  };

  const handleIncrement = (denom: number, delta: number) => {
    setDenominations(prev => ({
      ...prev,
      [denom]: Math.max(0, (prev[denom] || 0) + delta),
    }));
  };

  const resetCalculator = () => {
    setDenominations({
      500: 0,
      200: 0,
      100: 0,
      50: 0,
      20: 0,
      10: 0,
    });
    setCoins(0);
  };

  const undo = async () => {
    if (!undoFor?.receipt_number) return;
    setBusy(true);
    try {
      await api.undoPayment(undoFor.receipt_number, { name: currentUser.name, role: currentUser.role });
      setUndoFor(null);
      await load();
    } catch (err) {
      setUndoFor(null);
      setError(err instanceof Error ? err.message : 'Could not undo');
    } finally {
      setBusy(false);
    }
  };

  const openReceipt = async (record: DailyCollectionRecord) => {
    if (!record.receipt_number) return;
    try {
      setReceiptView({ receipt: await api.getReceipt(record.receipt_number), phone: record.mobile_number });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receipt not found');
    }
  };

  // Generate & Print Cash Handover Slip
  const printHandoverSlip = () => {
    const dateFormatted = formatDate(today);
    const timeFormatted = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const denomRows = DENOM_LIST.map(denom => {
      const count = denominations[denom] || 0;
      const subtotal = count * denom;
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">₹${denom} Notes</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${count}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">₹${subtotal.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');

    const bodyHtml = `
      <div style="max-width: 440px; margin: 0 auto; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a;">
        <div style="text-align: center; border-bottom: 2px dashed #0f172a; padding-bottom: 14px; margin-bottom: 16px;">
          <h1 style="font-size: 22px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: 0.5px;">KRS FINANCE</h1>
          <p style="font-size: 13px; font-weight: bold; color: #475569; margin: 4px 0 0 0;">DAILY COLLECTION • CASH HANDOVER SLIP</p>
          <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Date: ${dateFormatted} • ${timeFormatted}</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Collection Officer:</span>
            <strong>${currentUser.name} (${currentUser.collector_id || 'COL101'})</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Collections Done:</span>
            <strong>${paid.length} Paid / ${records.length} Total Customers</strong>
          </div>
        </div>

        <h3 style="font-size: 12px; text-transform: uppercase; color: #475569; margin-bottom: 8px; letter-spacing: 0.5px; font-weight: bold;">Currency Denominations</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569;">
              <th style="padding: 6px 12px;">Denomination</th>
              <th style="padding: 6px 12px; text-align: center;">Count</th>
              <th style="padding: 6px 12px; text-align: right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${denomRows}
            ${coins > 0 ? `
              <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Coins / Small Change</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">—</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">₹${coins.toLocaleString('en-IN')}</td>
              </tr>
            ` : ''}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 900; font-size: 14px;">
              <td colspan="2" style="padding: 10px 12px; border-top: 2px solid #0f172a;">Total Physical Cash Handover:</td>
              <td style="padding: 10px 12px; border-top: 2px solid #0f172a; text-align: right; color: #047857;">₹${totalPhysicalCash.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 24px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Expected App Cash:</span>
            <strong>₹${expectedCash.toLocaleString('en-IN')}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Digital / UPI Collections:</span>
            <strong>₹${expectedUpi.toLocaleString('en-IN')}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
            <span style="color: #64748b;">Total Day's Collection:</span>
            <strong style="color: #047857; font-size: 14px;">₹${total.toLocaleString('en-IN')}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
            <span style="color: #64748b;">Reconciliation Status:</span>
            <strong style="color: ${cashDifference === 0 ? '#047857' : cashDifference < 0 ? '#b91c1c' : '#b45309'};">
              ${
                cashDifference === 0
                  ? '✅ EXACT MATCH (0 Discrepancy)'
                  : cashDifference < 0
                  ? `⚠️ SHORTAGE OF ₹${Math.abs(cashDifference).toLocaleString('en-IN')}`
                  : `⚠️ EXCESS OF ₹${cashDifference.toLocaleString('en-IN')}`
              }
            </strong>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 12px; font-size: 12px; color: #475569;">
          <div style="text-align: center; width: 45%;">
            <div style="border-top: 1px solid #94a3b8; padding-top: 6px; font-weight: bold;">Collector Signature</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${currentUser.name}</div>
          </div>
          <div style="text-align: center; width: 45%;">
            <div style="border-top: 1px solid #94a3b8; padding-top: 6px; font-weight: bold;">Cashier / Office Signature</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">KRS Finance Salem</div>
          </div>
        </div>
      </div>
    `;

    printHtmlViaIframe(`Cash_Handover_${today}_${currentUser.name}`, '', bodyHtml);
  };

  // WhatsApp Handover Message
  const shareWhatsAppHandover = () => {
    const dateFormatted = formatDate(today);
    const denomBreakdown = DENOM_LIST.filter(d => (denominations[d] || 0) > 0)
      .map(d => `• ₹${d} x ${denominations[d]} = ₹${(denominations[d] * d).toLocaleString('en-IN')}`)
      .join('\n');

    const msg = `*KRS FINANCE - CASH HANDOVER SLIP*
📅 Date: ${dateFormatted}
👤 Collector: ${currentUser.name} (${currentUser.collector_id || 'COL101'})

*💵 DENOMINATION BREAKDOWN:*
${denomBreakdown || '• No notes entered'}
${coins > 0 ? `• Coins/Change: ₹${coins}\n` : ''}
*Total Physical Cash Handover: ₹${totalPhysicalCash.toLocaleString('en-IN')}*
📱 Digital/UPI Collections: ₹${expectedUpi.toLocaleString('en-IN')}
📊 Total Collections Today: ₹${total.toLocaleString('en-IN')}

*RECONCILIATION:*
${cashDifference === 0 ? '✅ MATCHED EXACT (0 Discrepancy)' : cashDifference < 0 ? `⚠️ SHORTAGE OF -₹${Math.abs(cashDifference)}` : `⚠️ EXCESS OF +₹${cashDifference}`}

Verified by: ${currentUser.name}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-4 pb-8">
      <PageTitle
        title={t('navMyDay', 'My day')}
        subtitle={t('today', 'Today')}
        action={<BigButton small icon={Printer} label={t('printList', 'Print list')} onClick={() => setShowRegister(true)} />}
      />

      {/* Today's Collection Overview */}
      <div className="glass-card rounded-2xl p-5">
        <div className="text-sm text-slate-400 font-semibold flex items-center gap-2">
          <Wallet className="w-5 h-5 text-gold-400" />
          {t('collectedToday', 'Collected today')}
        </div>
        <div className="text-4xl font-black text-emerald-400 mt-1">{formatCurrency(total)}</div>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(byMode).map(([mode, amount]) => (
            <span key={mode} className="px-3 py-1.5 rounded-xl bg-navy-950 border border-slate-700 text-sm text-slate-200 font-semibold">
              {t(mode, mode)}: {formatCurrency(amount)}
            </span>
          ))}
        </div>
      </div>

      {/* Today's Counts */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('tabPaid', 'Paid'), value: paid.length, tone: 'text-emerald-400' },
          { label: t('notPaid', 'Not paid'), value: records.filter(r => dayState(r) === 'not-paid').length, tone: 'text-rose-400' },
          { label: t('left', 'Left'), value: records.filter(r => dayState(r) === 'todo').length, tone: 'text-gold-300' },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-2xl p-3 text-center">
            <div className={`text-2xl font-black ${item.tone}`}>{item.value}</div>
            <div className="text-xs text-slate-400 font-semibold">{item.label}</div>
          </div>
        ))}
      </div>

      {/* FEATURE: End-of-Day Cash Handover & Denomination Calculator */}
      <div className="glass-card rounded-3xl p-5 border border-gold-500/30 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                {t('denominationCalculator', 'Cash Handover & Denomination Counter')}
              </h2>
              <p className="text-xs text-slate-400">
                {t('denomCounterDesc', 'Count cash notes for office handover and verify against app collections')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetCalculator}
            title={t('reset', 'Reset')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('reset', 'Reset')}</span>
          </button>
        </div>

        {/* Currency Denominations Counter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {DENOM_LIST.map(denom => {
            const count = denominations[denom] || 0;
            const subtotal = count * denom;
            const theme = DENOM_THEMES[denom] || { bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-700' };

            return (
              <div
                key={denom}
                className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-navy-950/80 border border-slate-800"
              >
                {/* Denomination badge */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-14 text-center py-1 rounded-xl text-xs font-black border ${theme.bg} ${theme.text} ${theme.border}`}
                  >
                    ₹{denom}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">×</span>
                </div>

                {/* Input with - and + buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleIncrement(denom, -1)}
                    disabled={count <= 0}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center font-bold transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={count === 0 ? '' : count}
                    placeholder="0"
                    onChange={e => handleDenomChange(denom, Number(e.target.value))}
                    className="w-14 text-center py-1 bg-navy-900 border border-slate-700 rounded-lg text-sm font-black text-white focus:border-gold-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleIncrement(denom, 1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subtotal */}
                <div className="w-20 text-right text-xs font-black text-slate-200 truncate">
                  {formatCurrency(subtotal)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Coins / Small Change Row */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-navy-950/80 border border-slate-800">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-gold-400" />
            <span className="text-xs font-bold text-slate-300">{t('coinsAndChange', 'Coins / Change Amount')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">₹</span>
            <input
              type="number"
              min={0}
              value={coins === 0 ? '' : coins}
              placeholder="0"
              onChange={e => setCoins(Math.max(0, Number(e.target.value)))}
              className="w-24 text-right px-3 py-1 bg-navy-900 border border-slate-700 rounded-lg text-sm font-black text-white focus:border-gold-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Live Reconciliation Summary Card */}
        <div className="p-4 rounded-2xl bg-navy-950 border border-slate-800 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[11px] text-slate-400 font-semibold">{t('physicalCashCounted', 'Physical Cash Counted')}</div>
              <div className="text-xl font-black text-emerald-400">{formatCurrency(totalPhysicalCash)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-semibold">{t('expectedCashInApp', 'Expected Cash in App')}</div>
              <div className="text-xl font-black text-white">{formatCurrency(expectedCash)}</div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-[11px] text-slate-400 font-semibold">{t('digitalUpi', 'Digital / UPI')}</div>
              <div className="text-xl font-black text-blue-400">{formatCurrency(expectedUpi)}</div>
            </div>
          </div>

          {/* Status Indicator */}
          {totalPhysicalCash > 0 ? (
            cashDifference === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>
                  {t('cashMatchedExact', 'Cash Matches Exactly!')} ({formatCurrency(totalPhysicalCash)}) • {t('zeroDiscrepancy', '0 Discrepancy')}
                </span>
              </div>
            ) : cashDifference < 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-bold">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>
                  {t('cashShortage', 'Shortage')}: -{formatCurrency(Math.abs(cashDifference))} ({t('cashShortageDesc', 'Counted cash is less than recorded collections')})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-bold">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>
                  {t('cashExcess', 'Excess')}: +{formatCurrency(cashDifference)} ({t('cashExcessDesc', 'Counted cash is more than recorded collections')})
                </span>
              </div>
            )
          ) : (
            <div className="text-xs text-slate-400 text-center py-1">
              {t('enterDenomHint', 'Enter counted note quantities above to verify cash before office handover.')}
            </div>
          )}
        </div>

        {/* Handover Action Buttons: Print Slip & WhatsApp Share */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={printHandoverSlip}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-sm shadow-md transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>{t('printHandoverSlip', 'Print Handover Slip')}</span>
          </button>
          <button
            type="button"
            onClick={shareWhatsAppHandover}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md transition-all active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{t('shareWhatsApp', 'Share Slip on WhatsApp')}</span>
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">{error}</div>}

      {/* Today's Receipts List */}
      <h2 className="text-lg font-black text-white pt-2">{t('todaysReceipts', "Today's receipts")}</h2>
      {paid.length === 0 ? (
        <EmptyState icon={ReceiptIcon} text={t('noPaymentsYet', 'No payments yet')} />
      ) : (
        <div className="space-y-2">
          {paid.map(r => (
            <div key={r.id} className="glass-card rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-bold text-white truncate">{r.customer_name}</div>
                <div className="text-xs text-slate-400">
                  {formatCurrency(r.paid_amount)} • {r.payment_mode ? t(r.payment_mode, r.payment_mode) : ''}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <BigButton small icon={ReceiptIcon} label={t('receipt', 'Receipt')} onClick={() => openReceipt(r)} />
                <BigButton small icon={RotateCcw} label={t('undo', 'Undo')} onClick={() => setUndoFor(r)} disabled={busy} />
              </div>
            </div>
          ))}
        </div>
      )}

      {undoFor && (
        <ConfirmSheet
          title={t('undoQuestion', 'Undo this payment?')}
          message={`${undoFor.customer_name} • ${formatCurrency(undoFor.paid_amount)}. ${t('undoExplain', 'The receipt will be marked cancelled and the balance goes back.')}`}
          yesLabel={t('yesUndo', 'Yes, undo')}
          noLabel={t('no', 'No')}
          danger
          busy={busy}
          onYes={undo}
          onNo={() => setUndoFor(null)}
        />
      )}
      {receiptView && (
        <ReceiptModal receipt={receiptView.receipt} customerMobile={receiptView.phone} onClose={() => setReceiptView(null)} />
      )}
    </div>
  );
};
