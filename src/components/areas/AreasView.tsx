import React, { useEffect, useState } from 'react';
import { Check, Edit3, MapPin, PlusCircle, Trash2 } from 'lucide-react';
import { Area, Collector } from '../../types';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, ConfirmSheet, EmptyState, Sheet, Spinner } from '../common/ui';

const inputClass = 'w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white focus:border-gold-500 focus:outline-none';

/** Collection areas and which collector covers each one. */
export const AreasView: React.FC = () => {
  const { t } = useLanguage();
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [editing, setEditing] = useState<Partial<Area> | null>(null);
  const [deleting, setDeleting] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [ars, cols] = await Promise.all([api.getAreas(), api.getCollectors()]);
    setAreas(ars);
    setCollectors(cols.filter(c => c.status === 'ACTIVE'));
  };

  useEffect(() => {
    load().catch(() => setAreas([]));
  }, []);

  const save = async () => {
    if (!editing) return;
    setError(null);
    if (!editing.area_name?.trim()) return setError(t('needAreaName', 'Enter the area name.'));
    const collector = collectors.find(c => c.id === editing.assigned_collector_id);
    if (!collector) return setError(t('needCollector', 'Choose the collector.'));
    const body: Partial<Area> = {
      area_name: editing.area_name.trim(),
      assigned_collector_id: collector.id,
      assigned_collector_name: collector.name,
    };
    setBusy(true);
    try {
      if (editing.id) await api.updateArea(editing.id, body);
      else await api.createArea(body);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteArea(deleting.id);
      setDeleting(null);
      setEditing(null);
      await load();
    } catch (err) {
      setDeleting(null);
      setError(err instanceof Error ? err.message : 'Could not remove');
    } finally {
      setBusy(false);
    }
  };

  if (!areas) return <Spinner />;

  return (
    <div className="space-y-3">
      <BigButton tone="gold" icon={PlusCircle} label={t('addArea', 'Add area')}
        onClick={() => { setError(null); setEditing({ assigned_collector_id: collectors[0]?.id }); }} />

      {error && !editing && <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">{error}</div>}

      {areas.length === 0 ? (
        <EmptyState icon={MapPin} text={t('nobodyHere', 'Nobody here')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {areas.map(a => (
            <div key={a.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <MapPin className="w-8 h-8 text-gold-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-black text-white truncate">{a.area_name}</div>
                <div className="text-sm text-slate-400 truncate">{a.assigned_collector_name}</div>
                <div className="text-xs text-slate-500">{a.customer_count} {t('runningLoans', 'running loans')}</div>
              </div>
              <button type="button" onClick={() => { setError(null); setEditing(a); }} aria-label={t('edit', 'Edit')}
                className="p-3 rounded-xl bg-navy-950 border border-slate-700 text-slate-200 hover:border-gold-500/60">
                <Edit3 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Sheet title={editing.id ? t('editArea', 'Edit area') : t('addArea', 'Add area')} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('areaName', 'Area name')} *</label>
              <input className={inputClass} value={editing.area_name ?? ''} onChange={e => setEditing({ ...editing, area_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('collector', 'Collector')} *</label>
              <select className={inputClass} value={editing.assigned_collector_id ?? ''} onChange={e => setEditing({ ...editing, assigned_collector_id: e.target.value })}>
                <option value="">{t('selectCollector', 'Choose collector')}</option>
                {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {error && <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <BigButton label={t('cancel', 'Cancel')} onClick={() => setEditing(null)} />
              <BigButton tone="gold" icon={Check} label={t('save', 'Save')} onClick={save} disabled={busy} />
            </div>
            {editing.id && (
              <button type="button" onClick={() => setDeleting(editing as Area)} className="text-sm text-rose-300 font-semibold flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> {t('remove', 'Remove')}
              </button>
            )}
          </div>
        </Sheet>
      )}

      {deleting && (
        <ConfirmSheet
          title={t('removeAreaQuestion', 'Remove this area?')}
          message={`${deleting.area_name}. ${t('removeAreaExplain', 'Only possible when no running loan is in this area.')}`}
          yesLabel={t('yesRemove', 'Yes, remove')}
          noLabel={t('no', 'No')}
          danger
          busy={busy}
          onYes={remove}
          onNo={() => setDeleting(null)}
        />
      )}
    </div>
  );
};
