import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, RotateCcw, Save, Trash2, UserCheck } from 'lucide-react';
import { Area, Collector } from '../../types';
import { api, CustomerListItem } from '../../services/api';
import { useDataChanged } from '../../utils/dataSync';
import { formatCurrency } from '../../utils/formatters';
import { addDaysIso, roundMoney, todayIso } from '../../../shared/finance';
import { CARD_MAX_DAYS, CardSheetRow, cardDays } from '../../../shared/notebook';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { BigButton } from '../common/ui';
import { MONTHS, cardDate, inputClass, parseAmount } from './notebookShared';

interface Row {
  key: number;
  customer_id?: string;
  name: string;
  mobile: string;
  area: string;
  collector_id: string;
  /** Each day's amount as typed. */
  cells: Record<string, string>;
}

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, name: '', mobile: '', area: '', collector_id: '', cells: {} });
const isBlank = (r: Row) => !r.customer_id && !r.name.trim() && !r.mobile.trim() && Object.values(r.cells).every(v => !v.trim());
const pickLabel = (c: CustomerListItem) => `${c.full_name} · ${c.mobile_number} · ${c.id}`;

/**
 * A sheet made from a notebook card (100 நாள் தவணை). The card's terms come first: start date,
 * total loan, payment per day and end date. The sheet then has one column for each day from
 * start to end and one customer per row ("Add row +" adds the next). Saving adds each customer
 * (or uses the one picked), gives the loan from the start date and records each day's amount,
 * so the loan carries on in the app from where the notebook is.
 */
export const NotebookCardSheet: React.FC<{ full: boolean }> = ({ full }) => {
  const { t } = useLanguage();
  const { config } = useConfig();
  const products = config.loan_products.filter(p => p.status === 'ACTIVE');
  const today = todayIso();

  const [productId, setProductId] = useState(products.find(p => p.allow_overrides)?.id || products[0]?.id || '');
  const [start, setStart] = useState('');
  const [total, setTotal] = useState('');
  const [daily, setDaily] = useState('');
  const [end, setEnd] = useState('');
  const [endTyped, setEndTyped] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  /** The row whose mobile, collector and area are open (the others fold to one line); none set: the last row. */
  const [openKey, setOpenKey] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);

  const loadLists = () => {
    api.getCustomers().then(setCustomers).catch(() => setCustomers([]));
    api.getAreas().then(setAreas).catch(() => setAreas([]));
    api.getCollectors().then(list => setCollectors(list.filter(c => c.status === 'ACTIVE'))).catch(() => setCollectors([]));
  };
  useEffect(loadLists, []);
  useDataChanged(loadLists);

  // Customers who can take a loan now: active, with no running loan.
  const pickable = useMemo(() => customers.filter(c => c.status === 'ACTIVE' && !c.activeAccount), [customers]);

  const totalN = parseAmount(total);
  const dailyN = parseAmount(daily);

  // The end date follows the start, total and daily until it is typed in.
  useEffect(() => {
    if (endTyped) return;
    if (start && totalN > 0 && dailyN > 0) setEnd(addDaysIso(start, Math.ceil(totalN / dailyN) - 1));
  }, [start, totalN, dailyN, endTyped]);

  const days = start && end && end >= start ? cardDays(start, end) : 0;
  const cardProblem = !start
    ? t('cardEnterStart', 'Enter the start date from the card.')
    : start > today
      ? t('cardStartFuture', 'The start date has not come yet.')
      : !(totalN > 0)
        ? t('cardEnterTotal', 'Enter the total loan.')
        : !(dailyN > 0)
          ? t('cardEnterDaily', 'Enter the payment per day.')
          : !end
            ? t('cardEnterEnd', 'Enter the end date.')
            : end < start
              ? t('cardEndBeforeStart', 'The end date is before the start date.')
              : days > CARD_MAX_DAYS
                ? t('cardTooLong', 'A card can cover at most {n} days.').replace('{n}', String(CARD_MAX_DAYS))
                : roundMoney(dailyN * days) < totalN
                  ? t('cardDailyTooLow', '{daily} a day for {days} days is {sum}, less than the total loan.')
                    .replace('{daily}', formatCurrency(dailyN)).replace('{days}', String(days)).replace('{sum}', formatCurrency(roundMoney(dailyN * days)))
                  : !productId
                    ? t('cardNoLoanType', 'Add a loan type first (Settings → Loan types).')
                    : null;

  const dates = useMemo(() => {
    if (cardProblem) return [] as string[];
    const list: string[] = [];
    for (let d = start; d <= end; d = addDaysIso(d, 1)) list.push(d);
    return list;
  }, [cardProblem, start, end]);

  const typedRows = rows.filter(r => !isBlank(r));
  useEffect(() => {
    if (typedRows.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [typedRows.length]);

  const clearErrors = (index: number, date?: string) => {
    setMessage(null);
    setRowErrors(prev => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
    if (date) {
      setCellErrors(prev => {
        const k = `${index}|${date}`;
        if (!(k in prev)) return prev;
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  };

  const updateRow = (index: number, change: Partial<Row>, date?: string) => {
    clearErrors(index, date);
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...change } : r)));
  };

  /** Typing a name: picking one from the list uses that customer; anything else is a new customer. */
  const setName = (index: number, text: string) => {
    const picked = pickable.find(c => pickLabel(c) === text);
    if (picked) {
      updateRow(index, {
        customer_id: picked.id,
        name: picked.full_name,
        mobile: picked.mobile_number,
        area: picked.business?.shop_area || picked.address?.area || rows[index].area,
      });
    } else {
      // Leaving a picked customer: the mobile number was theirs.
      updateRow(index, { customer_id: undefined, name: text, ...(rows[index].customer_id ? { mobile: '' } : {}) });
    }
  };

  const setCell = (index: number, date: string, text: string) => {
    clearErrors(index, date);
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, cells: { ...r.cells, [date]: text } } : r)));
  };

  const value = (row: Row, date: string) => {
    const n = parseAmount(row.cells[date] || '');
    return Number.isNaN(n) ? 0 : n;
  };
  /** "=" (the notebook's ditto mark) copies the nearest earlier day with an amount. */
  const ditto = (row: Row, date: string): string => {
    for (let i = dates.indexOf(date) - 1; i >= 0; i--) {
      const v = value(row, dates[i]);
      if (v > 0) return String(v);
    }
    return daily;
  };
  const locked = (date: string) => date > today;
  /** What an empty day of a row being filled shows in grey: the card's payment per day. */
  const suggestion = (row: Row) => (row.customer_id || row.name.trim()) && dailyN > 0 ? String(dailyN) : '';
  const paid = (row: Row) => roundMoney(dates.reduce((s, d) => s + value(row, d), 0));
  const dayTotal = (date: string) => roundMoney(rows.reduce((s, r) => s + value(r, date), 0));

  const focusCell = (r: number, c: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-card-cell="${r}-${c}"]`);
    if (el) { el.focus(); el.select(); }
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const el = e.currentTarget;
    // Tab confirms the grey day amount shown in an empty day, then moves on to the next day.
    if (e.key === 'Tab' && !e.shiftKey && !el.value && suggestion(rows[r])) {
      setCell(r, dates[c], suggestion(rows[r]));
      return;
    }
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length;
    const allSelected = el.selectionStart === 0 && el.selectionEnd === el.value.length;
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(e.shiftKey && e.key === 'Enter' ? r - 1 : r + 1, c); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(r - 1, c); }
    else if (e.key === 'ArrowRight' && (atEnd || allSelected)) { e.preventDefault(); focusCell(r, c + 1); }
    else if (e.key === 'ArrowLeft' && (atStart || allSelected)) { e.preventDefault(); focusCell(r, c - 1); }
  };
  /** A block copied from Excel fills from this cell; extra lines add rows. */
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n');
    setMessage(null);
    setRows(prev => {
      const next = prev.map(row => ({ ...row, cells: { ...row.cells } }));
      while (next.length < r + lines.length) next.push(emptyRow());
      lines.forEach((line, i) => {
        const row = next[r + i];
        let previous = '';
        line.split('\t').forEach((cellText, j) => {
          const date = dates[c + j];
          if (!date || locked(date)) return;
          let v = cellText.trim();
          if (v === '-') v = '';
          if (v === '=' || v === '"') v = previous || ditto(row, date);
          if (v) previous = v;
          row.cells[date] = v;
        });
      });
      return next;
    });
  };

  const addRow = () => {
    const next = emptyRow();
    setRows(prev => [...prev, next]);
    // The row before folds its details away; the new row is the one being entered.
    setOpenKey(next.key);
    setMessage(null);
  };
  const removeRow = (index: number) => {
    setRows(prev => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));
    setRowErrors({});
    setCellErrors({});
  };
  const discard = () => {
    setRows([emptyRow()]);
    setRowErrors({});
    setCellErrors({});
    setMessage(null);
  };

  const save = async () => {
    if (cardProblem) return;
    // Rows left empty are not saved; their numbers below still match the screen.
    const indexes = rows.map((r, i) => (isBlank(r) ? -1 : i)).filter(i => i >= 0);
    if (indexes.length === 0) {
      setMessage({ tone: 'bad', text: t('cardNoRows', 'Type at least one customer.') });
      return;
    }
    const bad: Record<string, string> = {};
    indexes.forEach(i => Object.entries(rows[i].cells).forEach(([d, v]) => {
      if (Number.isNaN(parseAmount(v))) bad[`${i}|${d}`] = t('notAnAmount', 'Not an amount');
    }));
    if (Object.keys(bad).length > 0) {
      setCellErrors(bad);
      setMessage({ tone: 'bad', text: t('notebookFixAmounts', 'Some cells are not amounts. Fix the red cells.') });
      return;
    }
    const sent: CardSheetRow[] = indexes.map(i => {
      const r = rows[i];
      const payments: Record<string, number> = {};
      dates.forEach(d => {
        const n = parseAmount(r.cells[d] || '');
        if (n > 0) payments[d] = n;
      });
      return { customer_id: r.customer_id, name: r.name.trim(), mobile: r.mobile, area: r.area, collector_id: r.collector_id || undefined, payments };
    });
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.saveNotebookCard({ product_id: productId, start_date: start, end_date: end, total: totalN, daily: dailyN, rows: sent });
      if ('error' in result) {
        const rowMap: Record<number, string> = {};
        const cellMap: Record<string, string> = {};
        result.errors.forEach(er => {
          const index = indexes[er.row] ?? er.row;
          if (er.date) cellMap[`${index}|${er.date}`] = er.error;
          else rowMap[index] = er.error;
        });
        setRowErrors(rowMap);
        // The first row with a problem opens, so its details can be fixed.
        const firstBad = Object.keys(rowMap).map(Number).sort((a, b) => a - b)[0];
        if (firstBad !== undefined && rows[firstBad]) setOpenKey(rows[firstBad].key);
        setCellErrors(cellMap);
        setMessage({ tone: 'bad', text: `${result.error} ${t('notebookNothingSaved', 'Nothing was saved.')}` });
        return;
      }
      setRows([emptyRow()]);
      setRowErrors({});
      setCellErrors({});
      loadLists();
      setMessage({
        tone: 'ok',
        text: t('cardSaved', 'Saved: {loans} loan(s), {customers} new customer(s), {payments} payment(s). Each loan now carries on in Daily Collection and Loan Management.')
          .replace('{loans}', String(result.loans.length))
          .replace('{customers}', String(result.customers_added))
          .replace('{payments}', String(result.payments)),
      });
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const label = 'block truncate text-[11px] font-bold text-slate-300 uppercase tracking-wider';
  const shownKey = rows.some(r => r.key === openKey) ? openKey : rows[rows.length - 1]?.key;
  const detailLabel ='w-16 shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-wide';
  const cellInput = 'w-full px-2 py-2 bg-transparent text-white focus:outline-none focus:bg-gold-500/15 focus:ring-1 focus:ring-gold-500';

  return (
    <>
      {/* The card, as on paper */}
      <div className={`glass-card rounded-2xl border border-gold-500/30 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 ${full ? 'p-2 gap-2' : 'p-4 gap-3'}`}>
        <label className="flex flex-col justify-end gap-1 min-w-0">
          <span className={label}>{t('startDate', 'Start date')}</span>
          <input type="date" value={start} max={today} onChange={e => setStart(e.target.value)} className={`w-full h-11 ${inputClass}`} />
        </label>
        <label className="flex flex-col justify-end gap-1 min-w-0">
          <span className={label}>{t('totalLoan', 'Total loan')}</span>
          <input inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} placeholder="20000" className={`w-full h-11 ${inputClass}`} />
        </label>
        <label className="flex flex-col justify-end gap-1 min-w-0">
          <span className={label}>{t('paymentPerDay', 'Payment per day')}</span>
          <input inputMode="decimal" value={daily} onChange={e => setDaily(e.target.value)} placeholder="200" className={`w-full h-11 ${inputClass}`} />
        </label>
        <label className="flex flex-col justify-end gap-1 min-w-0">
          <span className={label}>{t('endDate', 'End date')}</span>
          <input type="date" value={end} min={start || undefined} onChange={e => { setEnd(e.target.value); setEndTyped(!!e.target.value); }} className={`w-full h-11 ${inputClass}`} />
        </label>
        <label className="flex flex-col justify-end gap-1 min-w-0 col-span-2 lg:col-span-1">
          <span className={label}>{t('loanType', 'Loan type')}</span>
          <select value={productId} onChange={e => setProductId(e.target.value)} className={`w-full h-11 ${inputClass}`}>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <p className={`col-span-2 lg:col-span-3 xl:col-span-5 text-xs ${cardProblem ? 'text-amber-300' : 'text-slate-300'}`}>
          {cardProblem ||
            t('cardSummary', '{days} days, {from} to {to} · {daily} a day · total {total}')
              .replace('{days}', String(days)).replace('{from}', cardDate(start)).replace('{to}', cardDate(end))
              .replace('{daily}', formatCurrency(dailyN)).replace('{total}', formatCurrency(totalN))}
        </p>
      </div>

      {!cardProblem && areas.length === 0 && (
        <p className="text-sm text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {t('cardNeedsAreaOnly', 'Add an area first (Staff & areas); every loan needs one. A collector is optional.')}
        </p>
      )}

      {/* The sheet: one customer per row, one column per day of the card */}
      {!cardProblem && (
        <div className={`glass-card rounded-2xl overflow-auto border border-slate-800 ${full ? 'flex-1 min-h-0' : 'max-h-[70vh]'}`}>
          <datalist id="card-customers">
            {pickable.map(c => <option key={c.id} value={pickLabel(c)} />)}
          </datalist>
          <table className="border-collapse text-xs whitespace-nowrap">
            <thead className="sticky top-0 z-20">
              <tr className="bg-navy-950 text-slate-300">
                <th className="sticky left-0 z-30 bg-navy-950 px-2 py-2 text-left w-8">#</th>
                <th className="sticky left-8 z-30 bg-navy-950 px-2 py-2 text-left min-w-[14rem] border-r border-slate-700">{t('customerName', 'Customer name')}</th>
                {dates.map((d, i) => {
                  const [, m, day] = d.split('-');
                  return (
                    <th key={d} title={cardDate(d)} className={`px-1 py-1.5 text-center border-r border-slate-800 ${d === today ? 'text-gold-300 bg-gold-950/50' : 'text-gold-200 bg-gold-950/30'}`}>
                      <div className="text-[13px] font-black leading-tight">{Number(day)}</div>
                      <div className="text-[9px] text-slate-400 uppercase leading-tight">{i === 0 || day === '01' ? MONTHS[Number(m) - 1] : ' '}</div>
                    </th>
                  );
                })}
                <th className="px-2 py-2 text-right bg-emerald-950/60 text-emerald-300 border-l border-slate-700">{t('paid', 'Paid')}</th>
                <th className="px-2 py-2 text-right">{t('balance', 'Balance')}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => {
                const rowError = rowErrors[r];
                const balance = roundMoney(totalN - paid(row));
                return (
                  <tr key={row.key} className={`border-t border-slate-800 ${rowError ? 'bg-rose-950/40' : 'hover:bg-slate-800/30'}`}>
                    <td className="sticky left-0 z-10 bg-navy-950 px-2 py-1 text-slate-400 align-top">{r + 1}</td>
                    <td className="sticky left-8 z-10 bg-navy-950 p-0 border-r border-slate-700 align-top">
                      <input
                        list="card-customers"
                        value={row.name}
                        onChange={e => setName(r, e.target.value)}
                        onFocus={() => setOpenKey(row.key)}
                        placeholder={t('nameOrPick', 'New name, or pick a customer')}
                        className={`${cellInput} min-w-[14rem] font-bold`}
                      />
                      <div className={`px-2 pb-1 text-[10px] ${rowError ? 'text-rose-300 whitespace-normal max-w-[14rem]' : 'text-slate-500'}`}>
                        {rowError || (row.customer_id
                          ? <span className="inline-flex items-center gap-1 text-emerald-400"><UserCheck className="w-3 h-3" />{row.customer_id}</span>
                          : row.name.trim() ? t('newCustomer', 'New customer') : '')}
                      </div>
                      {/* Folded: one line, tap to open again. */}
                      {(row.customer_id || row.name.trim()) && row.key !== shownKey && (
                        <button
                          type="button"
                          onClick={() => setOpenKey(row.key)}
                          title={t('showDetails', 'Show mobile, collector and area')}
                          className="block w-full max-w-[14rem] px-2 pb-1.5 text-left text-[10px] text-slate-400 truncate hover:text-gold-300"
                        >
                          {[row.mobile || '—', collectors.find(c => c.id === row.collector_id)?.name || t('noCollector', 'No collector'), row.area || t('noArea', 'No area')].join(' · ')}
                        </button>
                      )}
                      {/* Open while this customer is being entered: mobile number, collector, area. */}
                      {(row.customer_id || row.name.trim()) && row.key === shownKey && (
                        <div className="px-2 pb-2 space-y-1.5 max-w-[14rem]">
                          <label className="flex items-center gap-2">
                            <span className={detailLabel}>{t('mobile', 'Mobile')}</span>
                            <input
                              inputMode="tel"
                              value={row.mobile}
                              disabled={!!row.customer_id}
                              onChange={e => updateRow(r, { mobile: e.target.value })}
                              placeholder="98765 43210"
                              className={`flex-1 min-w-0 ${inputClass} py-1.5 text-xs disabled:text-slate-400`}
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            <span className={detailLabel}>{t('collector', 'Collector')}</span>
                            <select value={row.collector_id} onChange={e => updateRow(r, { collector_id: e.target.value })} className={`flex-1 min-w-0 ${inputClass} py-1.5 text-xs`}>
                              <option value="">{t('noCollector', 'No collector')}</option>
                              {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </label>
                          <label className="flex items-center gap-2">
                            <span className={detailLabel}>{t('area', 'Area')}</span>
                            <select value={row.area} onChange={e => updateRow(r, { area: e.target.value })} className={`flex-1 min-w-0 ${inputClass} py-1.5 text-xs ${row.area ? '' : 'border-amber-500/60'}`}>
                              <option value="">{t('choose', 'Choose…')}</option>
                              {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
                            </select>
                          </label>
                        </div>
                      )}
                    </td>
                    {dates.map((d, c) => {
                      if (locked(d)) {
                        return <td key={d} className="px-1 py-1 text-center text-slate-600 border-r border-slate-800 bg-slate-900/40 align-top">·</td>;
                      }
                      const k = `${r}|${d}`;
                      const typed = row.cells[d] || '';
                      const bad = cellErrors[k] || (Number.isNaN(parseAmount(typed)) ? t('notAnAmount', 'Not an amount') : '');
                      return (
                        <td key={d} className="p-0 border-r border-slate-800 align-top">
                          <input
                            data-card-cell={`${r}-${c}`}
                            inputMode="decimal"
                            value={typed}
                            placeholder={suggestion(row)}
                            title={bad || (typed ? cardDate(d) : t('tabToConfirm', '{date}: Tab confirms {amount}').replace('{date}', cardDate(d)).replace('{amount}', suggestion(row)))}
                            onChange={e => setCell(r, d, e.target.value === '=' || e.target.value === '"' ? ditto(row, d) : e.target.value)}
                            onKeyDown={e => onKeyDown(e, r, c)}
                            onPaste={e => onPaste(e, r, c)}
                            onFocus={e => e.currentTarget.select()}
                            className={`w-16 px-1.5 py-2 text-right bg-transparent placeholder:text-slate-600 placeholder:font-normal focus:outline-none focus:bg-gold-500/15 focus:ring-1 focus:ring-gold-500 ${
                              bad ? 'bg-rose-600/30 text-rose-100' : typed ? 'text-white font-bold' : 'text-white'
                            }`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-right font-bold text-emerald-300 bg-emerald-950/30 border-l border-slate-700 align-top">{formatCurrency(paid(row))}</td>
                    <td className={`px-2 py-2 text-right align-top ${balance < 0 ? 'text-rose-300 font-bold' : 'text-slate-200'}`}>{formatCurrency(balance)}</td>
                    <td className="px-1 py-1 align-top">
                      <button type="button" onClick={() => removeRow(r)} title={t('removeRow', 'Remove this row')} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-slate-800">
                <td className="sticky left-0 z-10 bg-navy-950" />
                <td className="sticky left-8 z-10 bg-navy-950 p-1.5 border-r border-slate-700" colSpan={1}>
                  <button
                    type="button"
                    onClick={addRow}
                    className="w-full px-3 py-2 rounded-xl border border-dashed border-gold-500/50 text-gold-300 font-bold flex items-center justify-center gap-1.5 hover:bg-gold-500/10"
                  >
                    {t('addRow', 'Add row')} <Plus className="w-4 h-4" />
                  </button>
                </td>
                <td colSpan={dates.length + 3} />
              </tr>
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-navy-950 border-t-2 border-gold-500/40 text-gold-300 font-bold">
                <td className="sticky left-0 z-30 bg-navy-950" />
                <td className="sticky left-8 z-30 bg-navy-950 px-2 py-2 border-r border-slate-700">{t('dayTotal', 'Day total')}</td>
                {dates.map(d => (
                  <td key={d} className="px-1 py-2 text-right border-r border-slate-800">{dayTotal(d) ? dayTotal(d) : ''}</td>
                ))}
                <td className="px-2 py-2 text-right text-emerald-300 bg-emerald-950/40 border-l border-slate-700">{formatCurrency(roundMoney(rows.reduce((s, r) => s + paid(r), 0)))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {message && (
        <div className={`flex items-center gap-2 text-sm font-bold ${message.tone === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {message.tone === 'ok' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          {message.text}
        </div>
      )}

      {!cardProblem && typedRows.length > 0 && (
        <div className="sticky bottom-3 z-30 glass-card rounded-2xl p-3 flex items-center justify-between gap-3 border border-gold-500/40">
          <span className="text-sm font-bold text-amber-200">
            {t('cardRowsTyped', '{n} customer(s) typed, not saved yet').replace('{n}', String(typedRows.length))}
          </span>
          <div className="flex gap-2">
            <BigButton small icon={RotateCcw} label={t('discard', 'Discard')} onClick={discard} disabled={saving} />
            <BigButton small tone="gold" icon={Save} label={saving ? t('saving', 'Saving…') : t('save', 'Save')} onClick={save} disabled={saving} />
          </div>
        </div>
      )}
    </>
  );
};
