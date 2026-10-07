import React, { useEffect, useState } from 'react';
import { Check, Edit3, Trash2, UserPlus, UserCheck } from 'lucide-react';
import { Area, Collector } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { Avatar } from '../common/Avatar';
import { BigButton, CallButton, ConfirmSheet, EmptyState, Sheet, Spinner } from '../common/ui';

const inputClass = 'w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white focus:border-gold-500 focus:outline-none';

interface CollectorEditState extends Partial<Collector> {
  username?: string;
  password?: string;
}

/** Field collectors: who they are, their area, and how much they collected today. */
export const CollectorsView: React.FC = () => {
  const { t } = useLanguage();
  const defaultArea = useConfig().config.masters.default_location.area;
  const [collectors, setCollectors] = useState<Collector[] | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [editing, setEditing] = useState<CollectorEditState | null>(null);
  const [deleting, setDeleting] = useState<Collector | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [cols, ars] = await Promise.all([api.getCollectors(), api.getAreas()]);
    setCollectors(cols);
    setAreas(ars);
  };

  useEffect(() => {
    load().catch(() => setCollectors([]));
  }, []);

  const save = async () => {
    if (!editing) return;
    setError(null);
    const mobile = (editing.mobile || '').replace(/\D/g, '');
    if (!editing.name?.trim()) return setError(t('needName', 'Enter the name.'));
    if (mobile.length !== 10) return setError(t('needMobile', 'Enter a 10-digit mobile number.'));
    const body: Partial<Collector> & { username?: string; password?: string } = {
      name: editing.name.trim(),
      mobile,
      assigned_area: editing.assigned_area || defaultArea,
      target_amount: Number(editing.target_amount) || 0,
      ...(editing.id ? { status: editing.status } : {}),
      ...(editing.username?.trim() ? { username: editing.username.trim() } : {}),
      ...(editing.password?.trim() ? { password: editing.password.trim() } : {}),
    };
    setBusy(true);
    try {
      if (editing.id) await api.updateCollector(editing.id, body);
      else await api.createCollector(body);
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
      await api.deleteCollector(deleting.id);
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

  if (!collectors) return <Spinner />;

  return (
    <div className="space-y-3">
      <BigButton tone="gold" icon={UserPlus} label={t('addCollector', 'Add collector')}
        onClick={() => { setError(null); setEditing({ assigned_area: defaultArea, status: 'ACTIVE', password: '1234' }); }} />

      {error && !editing && <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">{error}</div>}

      {collectors.length === 0 ? (
        <EmptyState icon={UserCheck} text={t('nobodyHere', 'Nobody here')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {collectors.map(c => (
            <div key={c.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <Avatar src={c.photo} name={c.name} className="w-12 h-12 rounded-2xl text-base" />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-black text-white truncate">{c.name}</div>
                <div className="text-sm text-slate-400 truncate">{c.assigned_area}</div>
                <div className="text-xs text-slate-400">
                  {t('today', 'Today')}: <strong className="text-emerald-400">{formatCurrency(c.today_collected_amount ?? 0)}</strong>
                  {c.status !== 'ACTIVE' && <span className="ml-2 text-rose-300 font-bold">{t('stopped', 'Stopped')}</span>}
                </div>
              </div>
              <CallButton phone={c.mobile} label={t('call', 'Call')} />
              <button type="button" onClick={() => { setError(null); setEditing({ ...c, username: c.id, password: '1234' }); }} aria-label={t('edit', 'Edit')}
                className="p-3 rounded-xl bg-navy-950 border border-slate-700 text-slate-200 hover:border-gold-500/60">
                <Edit3 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Sheet title={editing.id ? t('editCollector', 'Edit collector') : t('addCollector', 'Add collector')} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('name', 'Name')} *</label>
              <input className={inputClass} value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('mobile', 'Mobile')} *</label>
              <input className={inputClass} inputMode="tel" maxLength={14} value={editing.mobile ?? ''} onChange={e => setEditing({ ...editing, mobile: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('area', 'Area')}</label>
              <select className={inputClass} value={editing.assigned_area ?? ''} onChange={e => setEditing({ ...editing, assigned_area: e.target.value })}>
                {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('dailyTargetOptional', 'Daily target (optional)')}</label>
              <input className={inputClass} type="number" min={0} value={editing.target_amount || ''} onChange={e => setEditing({ ...editing, target_amount: Number(e.target.value) })} />
            </div>

            {/* Agent / Collector Portal Login Credentials */}
            <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-slate-800 space-y-3">
              <div className="text-sm font-bold text-cyan-400 flex items-center justify-between">
                <span>{t('portalLogin', 'Agent Login Credentials')}</span>
                <span className="text-xs text-slate-400 font-normal">{t('defaultCredentialsHint', 'Default PIN: 1234')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">{t('userId', 'User ID / Username')}</label>
                  <input
                    className={inputClass}
                    placeholder={editing.id ? editing.id : t('autoCollectorId', 'e.g. COL102 or agent_name')}
                    value={editing.username ?? ''}
                    onChange={e => setEditing({ ...editing, username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">{t('password', 'Password / PIN')}</label>
                  <input
                    className={inputClass}
                    placeholder="1234"
                    value={editing.password ?? ''}
                    onChange={e => setEditing({ ...editing, password: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {editing.id && (
              <label className="flex items-center justify-between gap-3 text-base font-bold text-white">
                {t('working', 'Working')}
                <input type="checkbox" className="w-6 h-6 accent-amber-500" checked={editing.status === 'ACTIVE'}
                  onChange={e => setEditing({ ...editing, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })} />
              </label>
            )}
            {error && <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <BigButton label={t('cancel', 'Cancel')} onClick={() => setEditing(null)} />
              <BigButton tone="gold" icon={Check} label={t('save', 'Save')} onClick={save} disabled={busy} />
            </div>
            {editing.id && (
              <button type="button" onClick={() => setDeleting(editing as Collector)} className="text-sm text-rose-300 font-semibold flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> {t('remove', 'Remove')}
              </button>
            )}
          </div>
        </Sheet>
      )}

      {deleting && (
        <ConfirmSheet
          title={t('removeCollectorQuestion', 'Remove this collector?')}
          message={`${deleting.name}. ${t('removeCollectorExplain', 'Only possible when no running loan is assigned to them. Otherwise switch "Working" off.')}`}
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
