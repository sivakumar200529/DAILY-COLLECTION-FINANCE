import React, { useMemo, useState } from 'react';
import { Check, FileSpreadsheet, Upload } from 'lucide-react';
import readExcelFile from 'read-excel-file/browser';
import { api, ImportResult } from '../../services/api';
import {
  Cell, DetectedTable, ImportRow, PERSON_FIELDS, PersonField, PersonKind, PersonValues,
  cellText, detectTable, extractRows, parseCsv, parseMobiles, personIssue,
} from '../../utils/peopleImport';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton } from '../common/ui';
import { usePersonFieldLabel, usePersonIssueText } from './personLabels';

interface Sheet {
  name: string;
  rows: Cell[][];
}

/** The rows shown for checking; the people beyond this are added as they are if they have no problem. */
const SHOWN_ROWS = 300;
const smallInput = 'w-full min-w-[7rem] px-2 py-1.5 bg-navy-950 border border-slate-700 rounded-lg text-sm text-white focus:border-gold-500 focus:outline-none';

/**
 * Upload an Excel or CSV file in any layout: the columns are worked out by rules, and the office can
 * correct them and every row before anything is added. Rows with a problem are left out until fixed.
 */
export const ExcelImport: React.FC<{
  kind: PersonKind;
  existingMobiles: Set<string>;
  onAdded: () => void;
}> = ({ kind, existingMobiles, onAdded }) => {
  const { t } = useLanguage();
  const label = usePersonFieldLabel();
  const issueText = usePersonIssueText();
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [table, setTable] = useState<DetectedTable | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const open = (sheet: Sheet, detected: DetectedTable) => {
    setTable(detected);
    setRows(extractRows(sheet.rows, detected, kind));
  };

  const readFile = async (file: File) => {
    setError(null);
    setResult(null);
    setSheets([]);
    setTable(null);
    setRows([]);
    setFileName(file.name);
    try {
      const lower = file.name.toLowerCase();
      let read: Sheet[];
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        read = [{ name: file.name, rows: parseCsv(await file.text()) }];
      } else if (lower.endsWith('.xlsx')) {
        read = (await readExcelFile(file)).map(s => ({ name: s.sheet, rows: s.data as Cell[][] }));
      } else {
        setError(t('excelOldFormat', 'Please save the file as .xlsx or .csv in Excel (File > Save As) and upload that.'));
        return;
      }
      // Start with the sheet that holds the most people.
      const scored = read.map(sheet => extractRows(sheet.rows, detectTable(sheet.rows, kind), kind).length);
      const best = scored.indexOf(Math.max(0, ...scored));
      setSheets(read);
      setSheetIndex(Math.max(0, best));
      if (read[best]) open(read[best], detectTable(read[best].rows, kind));
      else setError(t('excelEmpty', 'No people were found in this file.'));
    } catch {
      setError(t('excelUnreadable', 'This file could not be read. Please check it opens in Excel.'));
    }
  };

  const changeColumn = (col: number, field: PersonField | null) => {
    if (!table) return;
    const columns = table.columns.map((current, i) => (i === col ? field : field && current === field ? null : current));
    open(sheets[sheetIndex], { ...table, columns });
  };

  const setCell = (index: number, field: PersonField, value: string) =>
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, values: { ...row.values, [field]: value } } : row)));

  const issues = useMemo(() => {
    const seen = new Set<string>();
    return rows.map(row => personIssue(row.values, existingMobiles, seen));
  }, [rows, existingMobiles]);
  const readyCount = issues.filter(issue => !issue).length;

  // Problems first, so they are seen without scrolling; the sheet's order stays within each group.
  const shownOrder = useMemo(() => {
    const indexes = rows.map((_, i) => i);
    return [...indexes.filter(i => issues[i]), ...indexes.filter(i => !issues[i])].slice(0, SHOWN_ROWS);
  }, [rows.length, issues]);

  const addAll = async () => {
    setBusy(true);
    setError(null);
    try {
      const ready: PersonValues[] = rows
        .filter((_, i) => !issues[i])
        .map(row => ({ ...row.values, mobile: parseMobiles(row.values.mobile!)[0] }));
      const outcome = await api.importPeople(kind, ready);
      setResult(outcome);
      setRows(prev => prev.filter((_, i) => issues[i]));
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const fields = PERSON_FIELDS[kind];
  const sheet = sheets[sheetIndex];
  const dataStart = table?.headerIndex === null || !table ? 0 : table.headerIndex + 1;
  const sampleOf = (col: number) => sheet?.rows.slice(dataStart).map(r => cellText(r[col])).find(Boolean) ?? '';

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-navy-950 border border-dashed border-gold-500/50 text-gold-300 font-bold cursor-pointer hover:bg-slate-800/50">
        <Upload className="w-5 h-5" />
        {fileName || t('chooseExcelFile', 'Choose Excel or CSV file')}
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          className="sr-only"
          aria-label={t('chooseExcelFile', 'Choose Excel or CSV file')}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = '';
          }}
        />
      </label>
      <p className="text-xs text-slate-400">{t('excelAnyLayout', 'Any layout works, in English or Tamil. You can check and correct everything before it is added.')}</p>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {result && (
        <div className="px-4 py-3 rounded-2xl text-sm border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 space-y-1">
          <div className="font-bold">{result.created} {t('added', 'added')}</div>
          {result.skipped.map(s => <div key={`${s.name}-${s.reason}`} className="text-rose-300">{s.name}: {s.reason}</div>)}
          {result.new_areas.length > 0 && (
            <div className="text-slate-300">{t('newAreasCreated', 'New areas created (check their collector in Staff & areas)')}: {result.new_areas.join(', ')}</div>
          )}
        </div>
      )}

      {table && sheet && (
        <div className="space-y-3">
          {sheets.length > 1 && (
            <select
              value={sheetIndex}
              aria-label={t('sheet', 'Sheet')}
              className={smallInput}
              onChange={e => {
                const index = Number(e.target.value);
                setSheetIndex(index);
                setResult(null);
                open(sheets[index], detectTable(sheets[index].rows, kind));
              }}
            >
              {sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
            </select>
          )}

          <section className="space-y-2">
            <h4 className="text-sm font-bold text-gold-400 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              {t('whatEachColumnHolds', 'What each column holds')}
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {table.columns.map((field, col) => {
                const title = table.titles[col] || sampleOf(col);
                if (!title && !field) return null;
                return (
                  <label key={col} className="block rounded-xl bg-navy-950 border border-slate-800 p-2 min-w-0">
                    <span className="block text-xs text-slate-400 truncate" title={title}>{title || '-'}</span>
                    <select
                      value={field ?? ''}
                      onChange={e => changeColumn(col, (e.target.value || null) as PersonField | null)}
                      className={`${smallInput} min-w-0 mt-1`}
                    >
                      <option value="">{t('ignoreColumn', 'Leave out')}</option>
                      {fields.map(f => <option key={f} value={f}>{label(f)}</option>)}
                    </select>
                  </label>
                );
              })}
            </div>
          </section>

          <p className="text-sm font-bold">
            <span className="text-emerald-300">{readyCount} {t('readyToAdd', 'ready to add')}</span>
            {rows.length > readyCount && <span className="text-rose-300"> • {rows.length - readyCount} {t('needFixing', 'need fixing')}</span>}
          </p>

          {rows.length > 0 && (
            <div className="rounded-2xl border border-slate-800 overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-navy-900">
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                    <th className="py-2 pl-3 pr-1 font-semibold">{t('row', 'Row')}</th>
                    {fields.map(f => <th key={f} className="py-2 px-1 font-semibold">{label(f)}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {shownOrder.map(i => {
                    const issue = issues[i];
                    return (
                      <tr key={rows[i].sheetRow} className={issue ? 'bg-rose-500/10' : undefined}>
                        <td className="py-1.5 pl-3 pr-1 align-top text-xs text-slate-400 whitespace-nowrap">
                          {rows[i].sheetRow}
                          {issue && <span className="block text-rose-300 whitespace-normal min-w-[7rem]">{issueText(issue)}</span>}
                        </td>
                        {fields.map(f => (
                          <td key={f} className="py-1.5 px-1 align-top">
                            <input
                              className={smallInput}
                              aria-label={`${label(f)} ${rows[i].sheetRow}`}
                              value={rows[i].values[f] ?? ''}
                              onChange={e => setCell(i, f, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > SHOWN_ROWS && (
            <p className="text-xs text-slate-400">{t('showingFirstRows', 'Showing the first rows, problems first. The rest are added as they are if they have no problem.')}</p>
          )}

          <BigButton
            tone="gold"
            icon={Check}
            label={busy ? t('saving', 'Saving...') : `${t('add', 'Add')} ${readyCount}`}
            onClick={addAll}
            disabled={busy || readyCount === 0}
          />
        </div>
      )}
    </div>
  );
};
