import React, { useEffect, useState } from 'react';
import { DailyCollectionRecord, Collector, Area } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Printer, RefreshCw, Calendar, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface DailyCollectionRegisterViewProps {
  onBack: () => void;
}

export const DailyCollectionRegisterView: React.FC<DailyCollectionRegisterViewProps> = ({ onBack }) => {
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedCollector, setSelectedCollector] = useState<string>('ALL');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');

  const [records, setRecords] = useState<DailyCollectionRecord[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recs, cols, ars] = await Promise.all([
        api.getDailyCollections({
          date: selectedDate,
          collector: selectedCollector,
          area: selectedArea,
        }),
        api.getCollectors(),
        api.getAreas(),
      ]);
      setRecords(recs);
      setCollectors(cols);
      setAreas(ars);
    } catch (err) {
      console.error('Failed to load register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedCollector, selectedArea]);

  const handlePrint = () => {
    window.print();
  };

  const totalExpected = records.reduce((s, r) => s + r.daily_due, 0);
  const totalCollected = records.reduce((s, r) => s + r.paid_amount, 0);
  const totalPending = Math.max(0, totalExpected - totalCollected);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Banner (No Print) */}
      <div className="no-print glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-gold-300 font-semibold mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back to daily collections', 'Back to Daily Collections')}</span>
          </button>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
            {t('daily register', 'DAILY COLLECTION REGISTER')}
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            {t('official field register ready for daily printing, physical collector audit, and shopkeeper signatures.', 'Official field register ready for daily printing, physical collector audit, and shopkeeper signatures.')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20 flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>{t('print register (a4 / ledger)', 'Print Register (A4 / Ledger)')}</span>
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

      {/* Filter Controls (No Print) */}
      <div className="no-print glass-card p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('date', 'Date')}</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('area', 'Area')}</label>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-xs text-white"
          >
            <option value="ALL">{t('all areas', 'All Areas')}</option>
            {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">{t('collector', 'Collector')}</label>
          <select
            value={selectedCollector}
            onChange={(e) => setSelectedCollector(e.target.value)}
            className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-xs text-white"
          >
            <option value="ALL">{t('all collectors', 'All Collectors')}</option>
            {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* PRINTABLE REGISTER DOCUMENT */}
      <div className="printable-area bg-white text-slate-900 p-6 md:p-8 rounded-2xl shadow-xl border border-slate-300 font-sans">
        {/* Register Header */}
        <div className="text-center pb-4 border-b-2 border-slate-900 mb-4">
          <h2 className="text-2xl font-black text-slate-950 tracking-tight">{t('appName', 'DAILY COLLECTION')}</h2>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mt-0.5">
            {t('daily doorstep collection register', 'DAILY DOORSTEP COLLECTION REGISTER')}
          </p>
          <div className="flex flex-wrap justify-between items-center text-xs mt-3 pt-2 border-t border-slate-300 font-mono">
            <span><strong>{t('date', 'Date')}:</strong> {formatDate(selectedDate)}</span>
            <span><strong>{t('area', 'Area')}:</strong> {selectedArea === 'ALL' ? t('all areas', 'All Assigned Areas') : selectedArea}</span>
            <span><strong>{t('collector', 'Collector')}:</strong> {selectedCollector === 'ALL' ? t('all collectors', 'All Field Agents') : selectedCollector}</span>
          </div>
        </div>

        {/* Register Table */}
        <table className="w-full text-left text-xs border border-slate-400 border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="py-2 px-2 border-r border-slate-400 text-center w-10">{t('sl.', 'Sl.')}</th>
              <th className="py-2 px-2.5 border-r border-slate-400">{t('cust id', 'Cust ID')}</th>
              <th className="py-2 px-3 border-r border-slate-400">{t('customer name', 'Customer Name')}</th>
              <th className="py-2 px-3 border-r border-slate-400">{t('shop / business', 'Shop / Business')}</th>
              <th className="py-2 px-2.5 border-r border-slate-400 text-right">{t('daily due', 'Daily Due')}</th>
              <th className="py-2 px-2.5 border-r border-slate-400 text-right">{t('amount collected', 'Collected')}</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center">{t('mode', 'Mode')}</th>
              <th className="py-2 px-3 border-r border-slate-400 text-center w-28">{t('customer sign', 'Customer Sign')}</th>
              <th className="py-2 px-3">{t('collector remarks', 'Collector Remarks')}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => (
              <tr key={r.id} className="border-b border-slate-300">
                <td className="py-2 px-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                <td className="py-2 px-2.5 border-r border-slate-300 font-mono font-bold">{r.customer_id}</td>
                <td className="py-2 px-3 border-r border-slate-300 font-semibold">{r.customer_name}</td>
                <td className="py-2 px-3 border-r border-slate-300">{r.shop_name}</td>
                <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono">{formatCurrency(r.daily_due)}</td>
                <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono font-bold">
                  {r.paid_amount > 0 ? formatCurrency(r.paid_amount) : '-'}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-center uppercase font-mono text-[10px]">
                  {r.payment_mode ? t(r.payment_mode.toLowerCase(), r.payment_mode) : '-'}
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-center">
                  <div className="h-6" />
                </td>
                <td className="py-2 px-3 text-[11px] text-slate-600">
                  {r.remarks || r.reason || '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
              <td colSpan={4} className="py-2.5 px-3 uppercase text-right border-r border-slate-400">
                {t('totals:', 'TOTALS:')}
              </td>
              <td className="py-2.5 px-2.5 text-right font-mono border-r border-slate-400">
                {formatCurrency(totalExpected)}
              </td>
              <td className="py-2.5 px-2.5 text-right font-mono text-emerald-800 font-black border-r border-slate-400">
                {formatCurrency(totalCollected)}
              </td>
              <td colSpan={3} className="py-2.5 px-3">
                <span className="text-rose-800">{t('pending to collect:', 'Pending to Collect:')} <strong>{formatCurrency(totalPending)}</strong></span>
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Register Bottom Summary & Sign-off (Section 26) */}
        <div className="mt-8 pt-4 border-t-2 border-slate-300 grid grid-cols-3 gap-6 text-xs">
          <div>
            <span className="text-slate-600 block">{t('total due expected:', 'Total Due Expected:')}</span>
            <strong className="text-base text-slate-950 font-mono">{formatCurrency(totalExpected)}</strong>
          </div>
          <div>
            <span className="text-slate-600 block">{t('total actual collected:', 'Total Actual Collected:')}</span>
            <strong className="text-base text-emerald-800 font-mono">{formatCurrency(totalCollected)}</strong>
          </div>
          <div>
            <span className="text-slate-600 block">{t('total field pending:', 'Total Field Pending:')}</span>
            <strong className="text-base text-rose-800 font-mono">{formatCurrency(totalPending)}</strong>
          </div>
        </div>

        <div className="mt-12 flex justify-between pt-6 border-t border-slate-400 text-xs">
          <div className="text-center">
            <div className="w-36 border-b border-slate-500 mb-1" />
            <span>{t('field collector signature', 'Field Collector Signature')}</span>
          </div>
          <div className="text-center">
            <div className="w-36 border-b border-slate-500 mb-1" />
            <span>{t('branch manager signature', 'Branch Manager Signature')}</span>
          </div>
          <div className="text-center">
            <div className="w-36 border-b border-slate-500 mb-1" />
            <span>{t('accountant audit sign', 'Accountant Audit Sign')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
