import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportTableToExcel } from '../../utils/excelExport';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  DollarSign, 
  ShieldCheck, 
  UserCheck, 
  Calendar,
  Search
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const ReportsView: React.FC = () => {
  const { t } = useLanguage();
  const [activeReport, setActiveReport] = useState<string>('outstanding');
  const [loading, setLoading] = useState<boolean>(true);

  // Data sets
  const [accounts, setAccounts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [collectors, setCollectors] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accs, pays, cols] = await Promise.all([
        api.getCollectionAccounts(),
        api.getPayments(),
        api.getCollectors(),
      ]);
      setAccounts(accs);
      setPayments(pays);
      setCollectors(cols);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const reportTabs = [
    { id: 'outstanding', label: t('outstanding balance report', 'Outstanding Balance Report'), icon: DollarSign },
    { id: 'overdue', label: t('overdue accounts report', 'Overdue Accounts Report'), icon: AlertTriangle },
    { id: 'margin', label: t('finance margin report', 'Finance Margin Report'), icon: ShieldCheck },
    { id: 'collector', label: t('collector performance report', 'Collector Performance Report'), icon: UserCheck },
    { id: 'payments', label: t('payment ledger report', 'Payment Ledger Report'), icon: TrendingUp },
  ];

  const handleExport = () => {
    if (activeReport === 'outstanding') {
      const headers = ['Account ID', 'Customer ID', 'Customer Name', 'Shop Name', 'Total Repayment', 'Collected', 'Outstanding Balance', 'Completed Days', 'Status'];
      const rows = accounts.map(a => [
        a.id, a.customer_id, a.customer_name, a.shop_name, a.total_repayment, a.amount_collected, a.remaining_amount, a.completed_days, a.status
      ]);
      exportTableToExcel('Daily Collection - Outstanding Balance Report', headers, rows, 'Daily_Collection_Outstanding_Report');
    } else if (activeReport === 'overdue') {
      const overdues = accounts.filter(a => a.status === 'OVERDUE');
      const headers = ['Account ID', 'Customer Name', 'Shop Name', 'Daily Due', 'Remaining Balance', 'Assigned Collector', 'Status'];
      const rows = overdues.map(a => [
        a.id, a.customer_name, a.shop_name, a.daily_collection, a.remaining_amount, a.assigned_collector_name, a.status
      ]);
      exportTableToExcel('Daily Collection - Overdue Accounts Report', headers, rows, 'Daily_Collection_Overdue_Report');
    } else if (activeReport === 'margin') {
      const headers = ['Account ID', 'Customer Name', 'Requested Amount', 'Disbursed Amount', 'Repayment Goal', 'Finance Margin', 'Status'];
      const rows = accounts.map(a => [
        a.id, a.customer_name, a.requested_amount, a.disbursed_amount, a.total_repayment, a.finance_margin, a.status
      ]);
      exportTableToExcel('Daily Collection - Finance Margin Report', headers, rows, 'Daily_Collection_Finance_Margin_Report');
    } else if (activeReport === 'collector') {
      const headers = ['Collector ID', 'Name', 'Assigned Area', 'Mobile', 'Target Amount', 'Today Collected', 'Monthly Collected'];
      const rows = collectors.map(c => [
        c.id, c.name, c.assigned_area, c.mobile, c.target_amount, c.today_collected_amount, c.monthly_collected_amount
      ]);
      exportTableToExcel('Daily Collection - Collector Performance Report', headers, rows, 'Daily_Collection_Collector_Performance_Report');
    } else if (activeReport === 'payments') {
      const headers = ['Receipt #', 'Date', 'Customer Name', 'Daily Due', 'Amount Paid', 'Mode', 'Collector', 'Remaining Balance'];
      const rows = payments.map(p => [
        p.receipt_number, p.collection_date, p.customer_name, p.daily_due, p.amount_paid, p.payment_mode, p.collector_name, p.remaining_balance
      ]);
      exportTableToExcel('Daily Collection - Payment Ledger Report', headers, rows, 'Daily_Collection_Payment_Ledger_Report');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider block w-fit mb-1">
            {t('financial intelligence', 'Financial Intelligence')}
          </span>
          <h1 className="text-xl md:text-2xl font-black text-white">{t('reports & audit suite', 'REPORTS & AUDIT SUITE')}</h1>
          <p className="text-xs text-slate-300 mt-0.5">{t('generate, filter, and export detailed analytical reports to excel.', 'Generate, filter, and export detailed analytical reports to Excel.')}</p>
        </div>

        <button
          onClick={handleExport}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{t('export current report to excel', 'Export Current Report to Excel')}</span>
        </button>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
        {reportTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-gold-500 text-navy-950 font-bold shadow-md shadow-gold-500/20'
                  : 'glass-card text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Table Display */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
        <div className="overflow-x-auto">
          {activeReport === 'outstanding' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('account id', 'Account ID')}</th>
                  <th className="py-3 px-4">{t('customer', 'Customer')}</th>
                  <th className="py-3 px-4">{t('shop', 'Shop')}</th>
                  <th className="py-3 px-4 text-right">{t('repayment goal', 'Repayment Goal')}</th>
                  <th className="py-3 px-4 text-right">{t('amount collected', 'Collected')}</th>
                  <th className="py-3 px-4 text-right">{t('outstanding balance', 'Outstanding Balance')}</th>
                  <th className="py-3 px-4 text-center">{t('progress %', 'Progress %')}</th>
                  <th className="py-3 px-4 text-center">{t('status', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {accounts.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-bold text-gold-400">{a.id}</td>
                    <td className="py-2.5 px-4 font-sans font-bold text-white">{a.customer_name}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-300">{a.shop_name}</td>
                    <td className="py-2.5 px-4 text-right">{formatCurrency(a.total_repayment)}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-400 font-bold">{formatCurrency(a.amount_collected)}</td>
                    <td className="py-2.5 px-4 text-right text-amber-400 font-black">{formatCurrency(a.remaining_amount)}</td>
                    <td className="py-2.5 px-4 text-center text-gold-300 font-bold">{a.collection_percentage}%</td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-200">
                        {t(a.status?.toLowerCase() || '', a.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'margin' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('account id', 'Account ID')}</th>
                  <th className="py-3 px-4">{t('customer name', 'Customer Name')}</th>
                  <th className="py-3 px-4 text-right">{t('req', 'Requested')}</th>
                  <th className="py-3 px-4 text-right">{t('disb', 'Disbursed (Loan)')}</th>
                  <th className="py-3 px-4 text-right">{t('repayment goal', 'Repayment Goal')}</th>
                  <th className="py-3 px-4 text-right">{t('finance margin', 'Finance Margin')}</th>
                  <th className="py-3 px-4 text-center">{t('status', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {accounts.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-bold text-gold-400">{a.id}</td>
                    <td className="py-2.5 px-4 font-sans font-bold text-white">{a.customer_name}</td>
                    <td className="py-2.5 px-4 text-right text-slate-300">{formatCurrency(a.requested_amount)}</td>
                    <td className="py-2.5 px-4 text-right text-gold-400 font-bold">{formatCurrency(a.disbursed_amount)}</td>
                    <td className="py-2.5 px-4 text-right text-purple-300">{formatCurrency(a.total_repayment)}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-400 font-black">{formatCurrency(a.finance_margin)}</td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-200">
                        {t(a.status?.toLowerCase() || '', a.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'overdue' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('account id', 'Account ID')}</th>
                  <th className="py-3 px-4">{t('customer name', 'Customer Name')}</th>
                  <th className="py-3 px-4">{t('shop', 'Shop')}</th>
                  <th className="py-3 px-4 text-right">{t('daily due', 'Daily Due')}</th>
                  <th className="py-3 px-4 text-right">{t('remaining balance', 'Remaining Balance')}</th>
                  <th className="py-3 px-4">{t('assigned collector', 'Assigned Collector')}</th>
                  <th className="py-3 px-4 text-center">{t('status', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {accounts.filter(a => a.status === 'OVERDUE').map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-bold text-rose-400">{a.id}</td>
                    <td className="py-2.5 px-4 font-sans font-bold text-white">{a.customer_name}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-300">{a.shop_name}</td>
                    <td className="py-2.5 px-4 text-right text-slate-200">{formatCurrency(a.daily_collection)}</td>
                    <td className="py-2.5 px-4 text-right text-rose-400 font-black">{formatCurrency(a.remaining_amount)}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-300">{a.assigned_collector_name}</td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">
                        {t('overdue', 'OVERDUE')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'collector' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('collector id', 'Collector ID')}</th>
                  <th className="py-3 px-4">{t('customer name', 'Name')}</th>
                  <th className="py-3 px-4">{t('route / area', 'Route / Area')}</th>
                  <th className="py-3 px-4">{t('mobile', 'Mobile')}</th>
                  <th className="py-3 px-4 text-right">{t('target', 'Target')}</th>
                  <th className="py-3 px-4 text-right">{t('today collected', 'Today Collected')}</th>
                  <th className="py-3 px-4 text-right">{t('monthly collection', 'Monthly Collected')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {collectors.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-bold text-gold-400">{c.id}</td>
                    <td className="py-2.5 px-4 font-sans font-bold text-white">{c.name}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-300">{c.assigned_area}</td>
                    <td className="py-2.5 px-4 text-slate-400">{c.mobile}</td>
                    <td className="py-2.5 px-4 text-right">{formatCurrency(c.target_amount)}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-400 font-bold">{formatCurrency(c.today_collected_amount || 0)}</td>
                    <td className="py-2.5 px-4 text-right text-gold-300 font-black">{formatCurrency(c.monthly_collected_amount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'payments' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('receipt #', 'Receipt #')}</th>
                  <th className="py-3 px-4">{t('date', 'Date')}</th>
                  <th className="py-3 px-4">{t('customer', 'Customer')}</th>
                  <th className="py-3 px-4 text-right">{t('daily due', 'Daily Due')}</th>
                  <th className="py-3 px-4 text-right">{t('amount paid', 'Amount Paid')}</th>
                  <th className="py-3 px-4">{t('mode', 'Mode')}</th>
                  <th className="py-3 px-4">{t('collector', 'Collector')}</th>
                  <th className="py-3 px-4 text-right">{t('remaining balance', 'Remaining Balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {payments.slice(0, 50).map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-4 font-bold text-gold-400">{p.receipt_number}</td>
                    <td className="py-2 px-4 text-slate-300">{formatDate(p.collection_date)}</td>
                    <td className="py-2 px-4 font-sans font-bold text-white">{p.customer_name}</td>
                    <td className="py-2 px-4 text-right text-slate-400">{formatCurrency(p.daily_due)}</td>
                    <td className="py-2 px-4 text-right text-emerald-400 font-black">{formatCurrency(p.amount_paid)}</td>
                    <td className="py-2 px-4 text-slate-300 font-sans uppercase text-[10px]">{p.payment_mode ? t(p.payment_mode.toLowerCase(), p.payment_mode) : ''}</td>
                    <td className="py-2 px-4 font-sans text-slate-400">{p.collector_name}</td>
                    <td className="py-2 px-4 text-right text-slate-200">{formatCurrency(p.remaining_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
