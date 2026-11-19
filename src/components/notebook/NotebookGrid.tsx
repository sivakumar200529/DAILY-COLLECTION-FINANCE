import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Lock, RotateCcw, Save } from 'lucide-react';
import { Area, Collector } from '../../types';
import { api } from '../../services/api';
import { useDataChanged } from '../../utils/dataSync';
import { formatCurrency } from '../../utils/formatters';
import { addDaysIso, roundMoney, todayIso } from '../../../shared/finance';
import { NOTEBOOK_MAX_DAYS, NotebookCellError, NotebookChange, NotebookPage, NotebookRow } from '../../../shared/notebook';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, ConfirmSheet, EmptyState, Spinner } from '../common/ui';
import { MONTHS, inputClass, parseAmount } from './notebookShared';

const key = (accountId: string, date: string) => `${accountId}|${date}`;

/**
 * Running loans as in the paper collection notebook: loans down the side, the days of a chosen period
 * across the top, and each day's amount in its cell. Typed amounts are saved together.
 */
export const NotebookGrid: React.FC<{ officeName: string; full: boolean; active: boolean }> = ({ officeName, full, active }) => {
  const { t } = useLanguage();
  const [reopening, setReopening] = useState<NotebookPage['closings'][number] | null>(null);
  const [reopenBusy, setReopenBusy] = useState(false);
  const today = todayIso();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [collector, setCollector] = useState('ALL');
  const [area, setArea] = useState('ALL');
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [page, setPage] = useState<NotebookPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  useEffect(() => {
    api.getCollectors().then(setCollectors).catch(() => setCollectors([]));
    api.getAreas().then(setAreas).catch(() => setAreas([]));
  }, []);

  const dates = useMemo(() => {
    const list: string[] = [];
    if (!page) return list;
    for (let d = page.from; d <= page.to; d = addDaysIso(d, 1)) list.push(d);
    return list;
  }, [page]);

  const periodProblem = !from || !to
    ? t('notebookChooseDates', 'Choose the start date and the end date.')
    : from > to
      ? t('notebookFromAfterTo', 'The start date is after the end date.')
      : Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 > NOTEBOOK_MAX_DAYS
        ? t('notebookTooLong', 'Choose at most {n} days at a time.').replace('{n}', String(NOTEBOOK_MAX_DAYS))
        : null;

  const load = useCallback(async () => {
    if (periodProblem) return;
    setLoading(true);
    setLoadError(null);
    try {
      setPage(await api.getNotebook({ from, to, collector, area }));
      setEdits({});
      setCellErrors({});
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [from, to, collector, area, periodProblem]);

  useEffect(() => {
    load();
  }, [load]);

  const changeCount = Object.keys(edits).length;
  // Saved elsewhere meanwhile: shown at once, unless amounts are typed here (they are never thrown away).
  useDataChanged(() => {
    if (periodProblem) return;
    return api.getNotebook({ from, to, collector, area }).then(setPage);
  }, active && changeCount === 0 && !saving);
  // Opening the tab again shows what was saved meanwhile (e.g. loans from a new card), unless amounts are typed here.
  const [wasActive, setWasActive] = useState(active);
  useEffect(() => {
    if (active && !wasActive && changeCount === 0) load();
    setWasActive(active);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (changeCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changeCount]);

  const closed = useMemo(() => new Set(page?.closed_dates || []), [page]);
  const locked = (row: NotebookRow, date: string) => date > (page?.today || today) || date < row.start_date || closed.has(date);
  const saved = (row: NotebookRow, date: string) => row.cells[date]?.amount || 0;
  const shown = (row: NotebookRow, date: string): string => {
    const k = key(row.account_id, date);
    if (k in edits) return edits[k];
    const amount = saved(row, date);
    return amount ? String(amount) : '';
  };
  const value = (row: NotebookRow, date: string) => {
    const n = parseAmount(shown(row, date));
    return Number.isNaN(n) ? 0 : n;
  };

  const setCell = (row: NotebookRow, date: string, text: string) => {
    const k = key(row.account_id, date);
    setMessage(null);
    setCellErrors(prev => {
      if (!(k in prev)) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
    setEdits(prev => {
      const next = { ...prev };
      const original = saved(row, date);
      const n = parseAmount(text);
      // Back to what is saved: no longer a change.
      if (!Number.isNaN(n) && n === original) delete next[k];
      else next[k] = text;
      return next;
    });
  };

  /** "=" (the notebook's ditto mark) copies the nearest earlier day with an amount. */
  const ditto = (row: NotebookRow, date: string): string => {
    for (let i = dates.indexOf(date) - 1; i >= 0; i--) {
      const v = value(row, dates[i]);
      if (v > 0) return String(v);
    }
    return '';
  };

  const focusCell = (r: number, c: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`);
    if (el) { el.focus(); el.select(); }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length;
    const allSelected = el.selectionStart === 0 && el.selectionEnd === el.value.length;
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(e.shiftKey && e.key === 'Enter' ? r - 1 : r + 1, c); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(r - 1, c); }
    else if (e.key === 'ArrowRight' && (atEnd || allSelected)) { e.preventDefault(); focusCell(r, c + 1); }
    else if (e.key === 'ArrowLeft' && (atStart || allSelected)) { e.preventDefault(); focusCell(r, c - 1); }
  };

  /** A block copied from Excel (tabs between days, new lines between customers) fills from this cell. */
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n');
    lines.forEach((line, i) => {
      const row = rows[r + i];
      if (!row) return;
      let previous = '';
      line.split('\t').forEach((cellText, j) => {
        const date = dates[c + j];
        let text = cellText.trim();
        if (text === '-') text = '';
        // A ditto mark repeats the amount before it in the pasted line (or in the row).
        if (text === '=' || text === '"') text = previous || ditto(row, date);
        if (text) previous = text;
        if (date && !locked(row, date)) setCell(row, date, text);
      });
    });
  };

  const rows = page?.rows || [];
  const invalid = Object.entries(edits).filter(([, text]) => Number.isNaN(parseAmount(text))).map(([k]) => k);
  const rowTotal = (row: NotebookRow) => roundMoney(dates.reduce((s, d) => s + value(row, d), 0));
  const rowDelta = (row: NotebookRow) => roundMoney(dates.reduce((s, d) => s + value(row, d) - saved(row, d), 0));
  const dayTotal = (date: string) => roundMoney(rows.reduce((s, r) => s + value(r, date), 0));
  const grandTotal = roundMoney(dates.reduce((s, d) => s + dayTotal(d), 0));

  const save = async () => {
    if (invalid.length > 0) {
      setMessage({ tone: 'bad', text: t('notebookFixAmounts', 'Some cells are not amounts. Fix the red cells.') });
      return;
    }
    const changes: NotebookChange[] = Object.entries(edits).map(([k, text]) => {
      const [account_id, date] = k.split('|');
      return { account_id, date, amount: parseAmount(text) };
    });
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.saveNotebook(changes);
      if ('errors' in result) {
        const map: Record<string, string> = {};
        result.errors.forEach((er: NotebookCellError) => { map[key(er.account_id, er.date)] = er.error; });
        setCellErrors(map);
        setMessage({ tone: 'bad', text: t('notebookNotSaved', 'Nothing was saved. Fix the red cells (point at one to see why).') });
        return;
      }
      await load();
      setMessage({ tone: 'ok', text: t('notebookSaved', 'Saved {n} days.').replace('{n}', String(result.saved)) });
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setEdits({});
    setCellErrors({});
    setMessage(null);
  };

  const dayHeader = (date: string, i: number) => {
    const [, m, d] = date.split('-');
    const showMonth = i === 0 || d === '01';
    return (
      <div className="leading-tight">
        <div className="text-[13px] font-black">{Number(d)}</div>
        <div className="text-[9px] text-slate-400 uppercase">{showMonth ? MONTHS[Number(m) - 1] : ' '}</div>
      </div>
    );
  };

  const busy = changeCount > 0;

  const closingOf = (date: string) => page?.closings.find(c => c.date === date);
  const reopen = async () => {
    if (!reopening) return;
    setReopenBusy(true);
    try {
      await api.reopenDay(reopening.id, officeName);
      setReopening(null);
      await load();
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not reopen' });
      setReopening(null);
    } finally {
      setReopenBusy(false);
    }
  };

  const content = (
    <>
      <div className={`glass-card rounded-2xl grid grid-cols-2 md:grid-cols-4 ${full ? 'p-2 gap-2' : 'p-4 gap-3'}`}>
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">{t('startDate', 'Start date')}</span>
          <input type="date" value={from} max={today} onChange={e => setFrom(e.target.value)} disabled={busy} className={`w-full ${inputClass}`} />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">{t('endDate', 'End date')}</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} disabled={busy} className={`w-full ${inputClass}`} />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">{t('collector', 'Collector')}</span>
          <select value={collector} onChange={e => setCollector(e.target.value)} disabled={busy} className={`w-full ${inputClass}`}>
            <option value="ALL">{t('allCollectors', 'All Collectors')}</option>
            {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">{t('area', 'Area')}</span>
          <select value={area} onChange={e => setArea(e.target.value)} disabled={busy} className={`w-full ${inputClass}`}>
            <option value="ALL">{t('allAreas', 'All Areas')}</option>
            {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
          </select>
        </label>
        {busy && (
          <p className="col-span-2 md:col-span-4 text-xs text-amber-300">
            {t('notebookSaveFirst', 'Save or discard the typed amounts before changing the dates or filters.')}
          </p>
        )}
        {periodProblem && <p className="col-span-2 md:col-span-4 text-xs text-rose-300">{periodProblem}</p>}
      </div>

      {loadError && <p className="text-sm text-rose-300">{loadError}</p>}
      {loading && !page ? (
        <Spinner />
      ) : rows.length === 0 ? (
        page && <EmptyState icon={BookOpen} text={t('notebookNoLoans', 'No running loans in these days.')} />
      ) : (
        <div className={`glass-card rounded-2xl overflow-auto border border-slate-800 ${full ? 'flex-1 min-h-0' : 'max-h-[70vh]'}`}>
          <table className="border-collapse text-xs whitespace-nowrap">
            <thead className="sticky top-0 z-20">
              <tr className="bg-navy-950 text-slate-300">
                <th className="sticky left-0 z-30 bg-navy-950 px-2 py-2 text-left w-10">#</th>
                <th className="sticky left-10 z-30 bg-navy-950 px-2 py-2 text-left min-w-[11rem] border-r border-slate-700">{t('name', 'Name')}</th>
                <th className="px-2 py-2 text-right">{t('loanAmount', 'Loan amount')}</th>
                <th className="px-2 py-2 text-right border-r border-slate-700">{t('daily', 'Daily')}</th>
                {dates.map((d, i) => (
                  <th
                    key={d}
                    title={closed.has(d) ? t('dayClosed', 'This day is closed') : d}
                    className={`px-1 py-1.5 text-center border-r border-slate-800 ${d === today ? 'text-gold-300 bg-gold-950/50' : 'text-gold-200 bg-gold-950/30'}`}
                  >
                    {dayHeader(d, i)}
                    {closed.has(d) && (
                      <button
                        type="button"
                        onClick={() => setReopening(closingOf(d) || null)}
                        title={t('dayClosedTapToReopen', 'This day is closed. Tap to reopen it.')}
                        className="mx-auto block p-0.5 rounded hover:bg-slate-700"
                      >
                        <Lock className="w-3 h-3 text-slate-300" />
                      </button>
                    )}
                  </th>
                ))}
                <th className="px-2 py-2 text-right bg-emerald-950/60 text-emerald-300 border-l border-slate-700">{t('total', 'Total')}</th>
                <th className="px-2 py-2 text-right">{t('balance', 'Balance')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={row.account_id} className="border-t border-slate-800 hover:bg-slate-800/30">
                  <td className="sticky left-0 z-10 bg-navy-950 px-2 py-1 text-slate-400">{r + 1}</td>
                  <td className="sticky left-10 z-10 bg-navy-950 px-2 py-1 border-r border-slate-700">
                    <div className="font-bold text-white truncate max-w-[11rem]" title={row.customer_name}>{row.customer_name}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[11rem]">{row.customer_id} · {row.collector_name || '—'}</div>
                  </td>
                  <td className="px-2 py-1 text-right text-slate-200">{formatCurrency(row.requested_amount)}</td>
                  <td className="px-2 py-1 text-right text-slate-200 border-r border-slate-700">{formatCurrency(row.daily_collection)}</td>
                  {dates.map((d, c) => {
                    if (locked(row, d)) {
                      const amount = saved(row, d);
                      return (
                        <td key={d} className="px-1 py-1 text-center text-slate-500 border-r border-slate-800 bg-slate-900/40">
                          {amount ? amount : '·'}
                        </td>
                      );
                    }
                    const k = key(row.account_id, d);
                    const changed = k in edits;
                    const bad = cellErrors[k] || (changed && Number.isNaN(parseAmount(edits[k])) ? t('notAnAmount', 'Not an amount') : '');
                    return (
                      <td key={d} className="p-0 border-r border-slate-800">
                        <input
                          data-cell={`${r}-${c}`}
                          inputMode="decimal"
                          value={shown(row, d)}
                          title={bad || undefined}
                          onChange={e => setCell(row, d, e.target.value === '=' || e.target.value === '"' ? ditto(row, d) : e.target.value)}
                          onKeyDown={e => onKeyDown(e, r, c)}
                          onPaste={e => onPaste(e, r, c)}
                          onFocus={e => e.currentTarget.select()}
                          className={`w-16 px-1.5 py-2 text-right bg-transparent focus:outline-none focus:bg-gold-500/15 focus:ring-1 focus:ring-gold-500 ${
                            bad ? 'bg-rose-600/30 text-rose-100' : changed ? 'bg-amber-500/20 text-amber-200 font-bold' : 'text-white'
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right font-bold text-emerald-300 bg-emerald-950/30 border-l border-slate-700">{formatCurrency(rowTotal(row))}</td>
                  <td className="px-2 py-1 text-right text-slate-200">{formatCurrency(Math.max(0, roundMoney(row.balance - rowDelta(row))))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-navy-950 border-t-2 border-gold-500/40 text-gold-300 font-bold">
                <td className="sticky left-0 z-30 bg-navy-950" />
                <td className="sticky left-10 z-30 bg-navy-950 px-2 py-2 border-r border-slate-700">{t('dayTotal', 'Day total')}</td>
                <td />
                <td className="border-r border-slate-700" />
                {dates.map(d => (
                  <td key={d} className="px-1 py-2 text-right border-r border-slate-800">{dayTotal(d) ? dayTotal(d) : ''}</td>
                ))}
                <td className="px-2 py-2 text-right text-emerald-300 bg-emerald-950/40 border-l border-slate-700">{formatCurrency(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {message && (
        <div className={`flex items-center gap-2 text-sm font-bold ${message.tone === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {message.tone === 'ok' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {busy && (
        <div className="sticky bottom-3 z-30 glass-card rounded-2xl p-3 flex items-center justify-between gap-3 border border-gold-500/40">
          <span className="text-sm font-bold text-amber-200">
            {t('notebookChanges', '{n} days typed, not saved yet').replace('{n}', String(changeCount))}
          </span>
          <div className="flex gap-2">
            <BigButton small icon={RotateCcw} label={t('discard', 'Discard')} onClick={discard} disabled={saving} />
            <BigButton small tone="gold" icon={Save} label={saving ? t('saving', 'Saving…') : t('save', 'Save')} onClick={save} disabled={saving} />
          </div>
        </div>
      )}
    </>
  );

  const reopenSheet = reopening && (
    <ConfirmSheet
      title={t('reopenDateQuestion', 'Reopen {date}?').replace('{date}', reopening.date.split('-').reverse().join('-'))}
      message={t('reopenPastDayNote', 'It was closed by {name}. Once reopened, that day\'s collections can be changed here; a past day stays open (only today can be closed on Home).').replace('{name}', reopening.closed_by)}
      yesLabel={t('reopenDay', 'Reopen the day')}
      noLabel={t('no', 'No')}
      busy={reopenBusy}
      onYes={reopen}
      onNo={() => setReopening(null)}
    />
  );

  return (
    <>
      {content}
      {reopenSheet && <div className="relative z-[80]">{reopenSheet}</div>}
    </>
  );
};
