import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';

export const inputClass = 'w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white focus:border-gold-500 focus:outline-none';
export const primaryButtonClass = 'px-6 py-3 rounded-2xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-sm shadow-md shadow-gold-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

export type NoticeState = { kind: 'success' | 'error'; text: string } | null;

export const Notice: React.FC<{ notice: NoticeState }> = ({ notice }) => {
  if (!notice) return null;
  const ok = notice.kind === 'success';
  return (
    <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
      ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
    }`}>
      {ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      <span>{notice.text}</span>
    </div>
  );
};

/** Runs a save and turns the outcome into a notice message. */
export function useSaveNotice() {
  const [notice, setNotice] = useState<NoticeState>(null);
  const [saving, setSaving] = useState(false);
  const run = async (action: () => Promise<void>, successText: string) => {
    setSaving(true);
    setNotice(null);
    try {
      await action();
      setNotice({ kind: 'success', text: successText });
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };
  return { notice, saving, run };
}

/** Editable list of chips (numbers or text) with add / remove. */
export function ListEditor<T extends string | number>({
  label,
  values,
  onChange,
  numeric,
  suffix = '',
  placeholder,
}: {
  label: string;
  values: T[];
  onChange: (next: T[]) => void;
  numeric?: boolean;
  suffix?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    const value = (numeric ? Number(raw) : raw) as T;
    if (numeric && !(Number(value) > 0)) return;
    if (values.includes(value)) return setDraft('');
    const next = [...values, value];
    onChange(numeric ? ([...next].sort((a, b) => Number(a) - Number(b)) as T[]) : next);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <label className="block text-slate-300 font-semibold">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {values.length === 0 && <span className="text-[11px] text-slate-500">—</span>}
        {values.map(v => (
          <span key={String(v)} className="px-2.5 py-1 rounded-lg bg-navy-950 border border-slate-700 text-slate-200 text-[11px] font-mono flex items-center gap-1.5">
            {v}{suffix}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="text-slate-500 hover:text-rose-400" aria-label={`Remove ${v}`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type={numeric ? 'number' : 'text'}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white text-xs"
        />
        <button type="button" onClick={add} className="px-3 py-2 rounded-xl bg-navy-950 border border-gold-500/40 text-gold-300 text-xs font-bold flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
