import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MonthlyReportData, Collector, Area, PaymentTransaction, CollectionAccount, MonthlyReportRow } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { exportMonthlyReportToExcel } from '../../utils/excelExport';
import { useLanguage } from '../../context/LanguageContext';
import { 
  FileSpreadsheet, 
  Download, 
  Filter, 
  Calendar, 
  RefreshCw, 
  Users, 
  DollarSign, 
  TrendingUp, 
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Edit3,
  Minimize2,
  ArrowUp
} from 'lucide-react';
import { PaymentEditModal } from '../common/PaymentEditModal';

export const MonthlyExcelReportView: React.FC = () => {
  const { t } = useLanguage();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [selectedCollector, setSelectedCollector] = useState<string>('ALL');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [reportData, setReportData] = useState<MonthlyReportData | null>(null);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Scrolling down onto the register opens it on the whole screen, with the filters. At the top of the
  // list two separate upward scrolls (or swipes), or the arrow shown there, go back to the page; one
  // stray scroll does not.
  const registerRef = useRef<HTMLDivElement>(null);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const focusScrollRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [edgeHits, setEdgeHits] = useState(0);
  const [atTop, setAtTop] = useState(true);
  const leftAt = useRef(0);

  const leave = useCallback(() => {
    leftAt.current = Date.now();
    setFocused(false);
    setEdgeHits(0);
    // Back on the page with the register just below the middle of the screen, its list at the first row.
    requestAnimationFrame(() => {
      const wrap = registerRef.current;
      if (!wrap) return;
      if (pageScrollRef.current) pageScrollRef.current.scrollTop = 0;
      const main = wrap.closest('main');
      const scroller = main && main.scrollHeight > main.clientHeight ? main : document.scrollingElement;
      if (!scroller) return;
      const viewTop = scroller === main ? main.getBoundingClientRect().top : 0;
      const viewHeight = scroller === main ? main.clientHeight : window.innerHeight;
      scroller.scrollTop += wrap.getBoundingClientRect().top - viewTop - viewHeight * 0.6;
    });
  }, []);

  useEffect(() => {
    if (focused) return;
    const wrap = registerRef.current;
    if (!wrap) return;
    const open = () => {
      if (Date.now() - leftAt.current <= 700) return false;
      setAtTop(true);
      setFocused(true);
      return true;
    };
    // The page or the content area may be what scrolls, so every scroll is watched.
    const last = new WeakMap<Element, number>();
    for (const el of [document.scrollingElement, wrap.closest('main')]) if (el) last.set(el, el.scrollTop);
    const onScroll = (e: Event) => {
      const el = (e.target === document ? document.scrollingElement : e.target) as Element | null;
      if (!el || !('scrollTop' in el)) return;
      const before = last.get(el) ?? 0;
      last.set(el, el.scrollTop);
      if (el.scrollTop <= before) return;
      const top = wrap.getBoundingClientRect().top;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      if (top <= window.innerHeight * 0.3 || atBottom) open();
    };
    // The scroll that opens the full view must not also scroll the list on the page, or it is found
    // further down when coming back.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0 && Math.abs(e.deltaY) > Math.abs(e.deltaX) && open()) e.preventDefault();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      wrap.removeEventListener('wheel', onWheel);
    };
  }, [focused, reportData]);

  useEffect(() => {
    if (!focused) return;
    const el = focusScrollRef.current;
    if (!el) return;
    setAtTop(el.scrollTop <= 0);
    let lastWheel = 0;
    let hits = 0;
    let touchStartY: number | null = null;
    const hit = () => {
      hits += 1;
      setEdgeHits(hits);
      if (hits >= 2) leave();
    };
    const reset = () => {
      if (hits === 0) return;
      hits = 0;
      setEdgeHits(0);
    };
    // A pause of a quarter second ends one scroll; reaching the top during a scroll does not count.
    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      const fresh = now - lastWheel > 250;
      lastWheel = now;
      if (e.deltaY > 0) return reset();
      if (e.deltaY < 0 && el.scrollTop <= 0 && fresh) hit();
    };
    const onScroll = () => {
      setAtTop(el.scrollTop <= 0);
      if (el.scrollTop > 0) reset();
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = el.scrollTop <= 0 ? e.touches[0].clientY : null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY !== null && el.scrollTop <= 0 && e.changedTouches[0].clientY - touchStartY > 50) hit();
      touchStartY = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave();
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, [focused, leave]);

  const currentUser = (() => {
    try {
      const cached = localStorage.getItem('krs_user');
      return cached ? JSON.parse(cached) : { name: 'admin', role: 'ADMIN' };
    } catch {
      return { name: 'admin', role: 'ADMIN' };
    }
  })();
  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';

  const [editModalData, setEditModalData] = useState<{
    account: CollectionAccount;
    customerName: string;
    shopName?: string;
    defaultDate: string;
    payment: PaymentTransaction | null;
  } | null>(null);

  const handleCellClick = async (r: MonthlyReportRow, d: number) => {
    if (!isAdmin) return;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    try {
      const [payments, account] = await Promise.all([
        api.getPayments({ customer_id: r.customerId }),
        api.getCollectionAccount(r.collectionAccountId).catch(() => null),
      ]);
      const payment = payments.find(
        p => p.collection_account_id === r.collectionAccountId && p.collection_date === dateStr && p.status !== 'CANCELLED'
      ) || null;

      const targetAccount: CollectionAccount = account || {
        id: r.collectionAccountId,
        customer_id: r.customerId,
        customer_name: r.customerName,
        shop_name: r.shopName,
        collection_area: r.area,
        assigned_collector_id: '',
        assigned_collector_name: r.collector,
        requested_amount: r.requestedAmount,
        margin_percentage: r.marginPercentage,
        margin_amount: r.marginAmount,
        disbursed_amount: r.disbursedAmount,
        daily_collection: r.dailyCollection,
        collection_days: r.collectionDays,
        total_repayment: r.totalRepayment,
        finance_margin: r.financeMargin,
        amount_collected: r.amountCollected,
        remaining_amount: r.remainingAmount,
        start_date: r.startDate,
        expected_end_date: r.endDate,
        collection_percentage: r.collectionPercentage,
        plan_id: '',
        plan_name: '100-Day Collection',
        completed_days: r.completedDays,
        remaining_days: r.remainingDays,
        status: (r.status as any) || 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setEditModalData({
        account: targetAccount,
        customerName: r.customerName,
        shopName: r.shopName,
        defaultDate: dateStr,
        payment,
      });
    } catch (err) {
      console.error('Failed to open payment modal:', err);
    }
  };

  const months = [
    { num: 1, name: 'January' },
    { num: 2, name: 'February' },
    { num: 3, name: 'March' },
    { num: 4, name: 'April' },
    { num: 5, name: 'May' },
    { num: 6, name: 'June' },
    { num: 7, name: 'July' },
    { num: 8, name: 'August' },
    { num: 9, name: 'September' },
    { num: 10, name: 'October' },
    { num: 11, name: 'November' },
    { num: 12, name: 'December' },
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const [rep, cols, ars] = await Promise.all([
        api.getMonthlyReport({
          month,
          year,
          collector: selectedCollector,
          area: selectedArea,
          status: selectedStatus,
        }),
        api.getCollectors(),
        api.getAreas(),
      ]);
      setReportData(rep);
      setCollectors(cols);
      setAreas(ars);
    } catch (err) {
      console.error('Failed to load monthly report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [month, year, selectedCollector, selectedArea, selectedStatus]);

  const handleExport = () => {
    if (reportData) {
      exportMonthlyReportToExcel(reportData);
    }
  };

  const daysArray = reportData ? Array.from({ length: reportData.daysInMonth }, (_, i) => i + 1) : [];

  const filters = (
      <div className="glass-card p-4 rounded-2xl space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Month Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('month', 'Month')}</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500"
            >
              {months.map(m => (
                <option key={m.num} value={m.num}>{m.name}</option>
              ))}
            </select>
          </div>
  
          {/* Year Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('year', 'Year')}</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500 font-mono"
            >
              {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
  
          {/* Collector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('collector', 'Collector')}</label>
            <select
              value={selectedCollector}
              onChange={(e) => setSelectedCollector(e.target.value)}
              className="w-full px-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500"
            >
              <option value="ALL">{t('all collectors', 'All Collectors')}</option>
              {collectors.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
  
          {/* Area */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('area', 'Area')}</label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full px-3 py-2 bg-navy-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold-500"
            >
              <option value="ALL">{t('all areas', 'All Areas')}</option>
              {areas.map(a => (
                <option key={a.id} value={a.area_name}>{a.area_name}</option>
              ))}
            </select>
          </div>
  
          <div className="flex items-end">
            <button
              onClick={handleExport}
              disabled={!reportData || reportData.rows.length === 0}
              className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>
  );

  /** The register table: inside the page (`full` false) or filling the screen. */
  const table = (full: boolean) => (
      <div ref={full ? undefined : registerRef} className={`glass-card rounded-2xl overflow-hidden border border-gold-500/20 shadow-xl ${full ? 'h-full flex flex-col relative' : ''}`}>
        {full && atTop && (
          <button
            type="button"
            onClick={leave}
            aria-label={t('backToPage', 'Back to page')}
            className="absolute left-1/2 -translate-x-1/2 top-12 z-40 px-4 py-2 rounded-full bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-black flex items-center gap-1.5 shadow-lg shadow-black/50"
          >
            <ArrowUp className="w-4 h-4" />
            {t('backToPage', 'Back to page')}
          </button>
        )}
        <div ref={full ? focusScrollRef : pageScrollRef} className={full ? 'flex-1 min-h-0 overflow-auto overscroll-contain relative' : 'overflow-x-auto max-h-[600px] relative'}>
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
            <thead className="sticky top-0 z-20">
              <tr className="bg-navy-950 text-white font-bold uppercase tracking-wider border-b border-slate-800">
                {/* Fixed Info Headers */}
                <th className="py-2.5 px-3 bg-navy-950 sticky left-0 z-30 shadow-md">{t('customer id', 'Customer ID')}</th>
                <th className="py-2.5 px-3 bg-navy-950 sticky left-[80px] z-30 shadow-md">{t('customer name', 'Customer Name')}</th>
                <th className="py-2.5 px-3">{t('shop / business', 'Shop / Business')}</th>
                <th className="py-2.5 px-3">{t('area', 'Area')}</th>
                <th className="py-2.5 px-3">{t('collector', 'Collector')}</th>
                <th className="py-2.5 px-3 text-right">{t('amount', 'Amount')} (₹)</th>
                <th className="py-2.5 px-3 text-right">{t('disb', 'Disb')} (₹)</th>
                <th className="py-2.5 px-3 text-right">{t('daily', 'Daily')} (₹)</th>
                <th className="py-2.5 px-3 text-right">{t('margin', 'Margin')} (₹)</th>
  
                {/* Day-by-Day Columns (01 to 30/31) */}
                {daysArray.map(d => (
                  <th key={d} className="py-2.5 px-2 text-center bg-gold-950/60 border-l border-r border-slate-800 text-[10px] text-gold-300">
                    {String(d).padStart(2, '0')}-{reportData?.monthName.slice(0, 3)}
                  </th>
                ))}
  
                {/* Final Summary Columns */}
                <th className="py-2.5 px-3 text-right bg-emerald-950/60 text-emerald-300 font-bold border-l border-slate-800">
                  {t('monthly total', 'Monthly Total')} (₹)
                </th>
                <th className="py-2.5 px-3 text-right">{t('expected', 'Expected')} (₹)</th>
                <th className="py-2.5 px-3 text-right">{t('pending', 'Pending')} (₹)</th>
                <th className="py-2.5 px-3 text-center">{t('col %', 'Col %')}</th>
                <th className="py-2.5 px-3 text-center">{t('status', 'Status')}</th>
              </tr>
            </thead>
  
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={14 + daysArray.length} className="py-12 text-center text-slate-400">
                    {t('loading monthly matrix data...', 'Loading monthly matrix data...')}
                  </td>
                </tr>
              ) : !reportData || reportData.rows.length === 0 ? (
                <tr>
                  <td colSpan={14 + daysArray.length} className="py-12 text-center text-slate-400">
                    {t('no collection accounts found for the selected period.', 'No collection accounts found for the selected period.')}
                  </td>
                </tr>
              ) : (
                reportData.rows.map((r) => (
                  <tr key={r.collectionAccountId} className="hover:bg-slate-800/40 transition-colors">
                    {/* Fixed Info */}
                    <td className="py-2 px-3 font-mono font-bold text-gold-400 bg-navy-950/90 sticky left-0 z-10 shadow-sm">
                      {r.customerId}
                    </td>
                    <td className="py-2 px-3 font-bold text-white bg-navy-950/90 sticky left-[80px] z-10 shadow-sm">
                      {t(r.customerName, r.customerName)}
                    </td>
                    <td className="py-2 px-3 text-slate-300">{t(r.shopName, r.shopName)}</td>
                    <td className="py-2 px-3 text-slate-400">{t(r.area, r.area)}</td>
                    <td className="py-2 px-3 text-slate-400">{t(r.collector, r.collector)}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-300">{r.requestedAmount}</td>
                    <td className="py-2 px-3 text-right font-mono text-gold-400 font-semibold">{r.disbursedAmount}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-200">{r.dailyCollection}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-400 font-semibold">{r.financeMargin}</td>
  
                    {/* Daily Columns */}
                    {daysArray.map(d => {
                      const dayPaid = r.dailyCollections[d] || 0;
                      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      return (
                        <td
                          key={d}
                          onClick={() => handleCellClick(r, d)}
                          title={isAdmin ? `Admin: Click to edit or record payment for ${dateStr}` : undefined}
                          className={`py-2 px-2 text-center font-mono border-l border-r border-slate-800/50 transition-all ${
                            isAdmin ? 'cursor-pointer hover:bg-gold-500/20 hover:text-white hover:font-black' : ''
                          } ${
                            dayPaid > 0 
                              ? 'text-emerald-400 font-bold bg-emerald-500/5' 
                              : 'text-slate-600'
                          }`}
                        >
                          {dayPaid > 0 ? dayPaid : '-'}
                        </td>
                      );
                    })}
  
                    {/* Summary Columns */}
                    <td className="py-2 px-3 text-right font-mono font-black text-emerald-400 bg-emerald-950/20 border-l border-slate-800">
                      {r.monthlyTotal}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-300">
                      {r.expectedMonthlyCollection}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-rose-400">
                      {r.monthlyPending}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-gold-300">
                      {r.collectionPercentage}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        r.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' :
                        r.status === 'OVERDUE' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {t(r.status.toLowerCase(), r.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
  
            {/* GRAND TOTALS ROW */}
            {reportData && reportData.rows.length > 0 && (
              <tfoot className="sticky bottom-0 z-20 bg-navy-950 font-bold text-white border-t-2 border-gold-500 shadow-2xl">
                <tr>
                  <td colSpan={2} className="py-3 px-3 uppercase tracking-wider text-gold-400 bg-navy-950 sticky left-0 z-30 shadow-md">
                    {t('grand totals', 'GRAND TOTALS')}
                  </td>
                  <td colSpan={3} className="py-3 px-3 text-slate-400">-</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-200">{reportData.totals.requested}</td>
                  <td className="py-3 px-3 text-right font-mono text-gold-400">{reportData.totals.disbursed}</td>
                  <td className="py-3 px-3 text-right text-slate-400">-</td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400">{reportData.totals.financeMargin}</td>
  
                  {/* Daily totals */}
                  {daysArray.map(d => (
                    <td key={d} className="py-3 px-2 text-center font-mono text-gold-300 border-l border-r border-slate-800 bg-navy-900">
                      {reportData.totals.dailyTotals[d] || 0}
                    </td>
                  ))}
  
                  {/* Final totals */}
                  <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 bg-emerald-950/40 border-l border-slate-800">
                    {reportData.totals.actualMonthly}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">{reportData.totals.expectedMonthly}</td>
                  <td className="py-3 px-3 text-right font-mono text-rose-400">{reportData.totals.monthlyPending}</td>
                  <td className="py-3 px-3 text-center text-gold-400">{reportData.totals.collectionPercentage}%</td>
                  <td className="py-3 px-3 text-center">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
  );

  const editModal = editModalData && (
        <PaymentEditModal
          isOpen={!!editModalData}
          onClose={() => setEditModalData(null)}
          payment={editModalData.payment}
          account={editModalData.account}
          customerName={editModalData.customerName}
          shopName={editModalData.shopName}
          defaultDate={editModalData.defaultDate}
          currentUser={currentUser}
          onSuccess={() => {
            loadData();
          }}
        />
  );

  return (
    <div className="space-y-4 font-sans">
      {/* This month in three numbers */}
      {reportData && (
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card rounded-2xl p-3">
            <div className="text-xs text-slate-400 font-semibold">{t('expectedThisMonth', 'Expected')}</div>
            <div className="text-lg sm:text-2xl font-black text-white">{formatCurrency(reportData.totals.expectedMonthly)}</div>
          </div>
          <div className="glass-card rounded-2xl p-3">
            <div className="text-xs text-slate-400 font-semibold">{t('collected', 'Collected')}</div>
            <div className="text-lg sm:text-2xl font-black text-emerald-400">{formatCurrency(reportData.totals.actualMonthly)}</div>
          </div>
          <div className="glass-card rounded-2xl p-3">
            <div className="text-xs text-slate-400 font-semibold">{t('stillToCollect', 'Still to collect')}</div>
            <div className="text-lg sm:text-2xl font-black text-rose-400">{formatCurrency(reportData.totals.monthlyPending)}</div>
          </div>
        </div>
      )}

      {filters}

      {table(false)}

      {focused
        ? createPortal(
            <div className="fixed inset-0 z-[70] bg-navy-950 flex flex-col gap-2 sm:gap-3 p-2 sm:p-4 font-sans" role="dialog" aria-label={t('monthlyRegister', 'Monthly register')}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-gold-300">{t('monthlyRegister', 'Monthly register')}</h2>
                  <p className={`text-xs ${edgeHits > 0 ? 'text-gold-300 font-bold' : 'text-slate-400'}`}>
                    {edgeHits > 0
                      ? t('scrollUpOnceMore', 'Scroll up once more to go back to the page')
                      : t('scrollUpTwiceOrArrowHint', 'At the top of the list, scroll up twice or tap the arrow to go back')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={leave}
                  className="px-3 py-2 rounded-xl bg-navy-900 border border-slate-700 text-slate-200 text-sm font-bold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Minimize2 className="w-4 h-4 text-gold-400" />
                  {t('backToPage', 'Back to page')}
                </button>
              </div>
              {filters}
              <div className="flex-1 min-h-0">{table(true)}</div>
            </div>,
            document.body
          )
        : null}

      {editModal && (focused ? createPortal(<div className="relative z-[80]">{editModal}</div>, document.body) : editModal)}
    </div>
  );
};
