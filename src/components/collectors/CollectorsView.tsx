import React, { useEffect, useState } from 'react';
import { Check, Edit3, Trash2, UserPlus, UserCheck } from 'lucide-react';
import { Area, Collector } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { Avatar } from '../common/Avatar';
import { AmountList, BigButton, CallButton, ConfirmSheet, EmptyState, Sheet, Spinner } from '../common/ui';
import { PhotoPicker } from '../common/PhotoPicker';

const inputClass = 'w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white focus:border-gold-500 focus:outline-none';

/** Field collectors: each name with their amounts as a list; tapping the name opens their profile. */
export const CollectorsView: React.FC = () => {
  const { t } = useLanguage();
  const [collectors, setCollectors] = useState<Collector[] | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [editing, setEditing] = useState<Partial<Collector> | null>(null);
  const [profile, setProfile] = useState<Collector | null>(null);
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
    const body: Partial<Collector> = {
      name: editing.name.trim(),
      mobile,
      photo: editing.photo || '',
      assigned_area: editing.assigned_area || '',
      target_amount: Number(editing.target_amount) || 0,
      ...(editing.id ? { status: editing.status } : {}),
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-white">{t('collectors', 'Collectors')}</h2>
        <BigButton small tone="gold" icon={UserPlus} label={t('addCollector', 'Add collector')}
          onClick={() => { setError(null); setEditing({ assigned_area: '', status: 'ACTIVE' }); }} />
      </div>

      {error && !editing && <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">{error}</div>}

      {collectors.length === 0 ? (
        <EmptyState icon={UserCheck} text={t('nobodyHere', 'Nobody here')} />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 divide-y divide-slate-800">
          {collectors.map(c => (
            <div key={c.id} className="flex items-start justify-between gap-3 p-4">
              <button type="button" onClick={() => setProfile(c)} className="min-w-0 flex-1 flex items-center gap-3 text-left">
                <Avatar src={c.photo} name={c.name} className="w-10 h-10 rounded-xl text-sm flex-shrink-0" />
                <span className="min-w-0">
                  <span className="block font-black text-white underline decoration-slate-600 underline-offset-4">{t(c.name, c.name)}</span>
                  <span className="block text-xs text-slate-400">{t(c.assigned_area, c.assigned_area)}</span>
                  {c.status !== 'ACTIVE' && <span className="block text-xs text-rose-300 font-bold">{t('stopped', 'Stopped')}</span>}
                </span>
              </button>
              <AmountList
                rows={[
                  [t('today', 'Today'), formatCurrency(c.today_collected_amount ?? 0), 'text-emerald-400'],
                  [t('thisMonth', 'This month'), formatCurrency(c.month_collected ?? 0)],
                  [t('balance', 'Balance'), formatCurrency(c.balance_to_collect ?? 0), 'text-gold-300'],
                ]}
              />
            </div>
          ))}
        </div>
      )}

      {profile && (
        <Sheet title={t('collectorProfile', 'Collector profile')} onClose={() => setProfile(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar src={profile.photo} name={profile.name} className="w-16 h-16 rounded-2xl text-lg" />
              <div className="min-w-0 flex-1">
                <div className="text-xl font-black text-white">{t(profile.name, profile.name)}</div>
                <div className="text-sm text-slate-400">{profile.id}</div>
                {profile.status !== 'ACTIVE' && <div className="text-sm text-rose-300 font-bold">{t('stopped', 'Stopped')}</div>}
              </div>
              <CallButton phone={profile.mobile} label={t('call', 'Call')} />
            </div>
            <dl className="rounded-2xl bg-navy-950 border border-slate-800 divide-y divide-slate-800">
              {([
                [t('mobile', 'Mobile'), profile.mobile],
                [t('email', 'Email'), profile.email],
                [t('address', 'Address'), profile.address],
                [t('joiningDate', 'Joining date'), profile.joining_date ? formatDate(profile.joining_date) : ''],
                [t('areas', 'Areas'), areas.filter(a => a.assigned_collector_id === profile.id).map(a => a.area_name).join(', ') || profile.assigned_area],
                [t('runningLoansLabel', 'Running loans'), String(profile.running_loans ?? 0)],
                [t('balanceToCollect', 'Balance to collect'), formatCurrency(profile.balance_to_collect ?? 0)],
                [t('today', 'Today'), formatCurrency(profile.today_collected_amount ?? 0)],
                [t('thisMonth', 'This month'), formatCurrency(profile.month_collected ?? 0)],
                [t('dailyTarget', 'Daily target'), profile.target_amount ? formatCurrency(profile.target_amount) : ''],
              ] as [string, string][]).filter(([, value]) => value).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="text-white font-semibold text-right">{value}</dd>
                </div>
              ))}
            </dl>
            <BigButton icon={Edit3} label={t('edit', 'Edit')} onClick={() => { setError(null); setEditing(profile); setProfile(null); }} />
          </div>
        </Sheet>
      )}

      {editing && (
        <Sheet title={editing.id ? t('editCollector', 'Edit collector') : t('addCollector', 'Add collector')} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div className="flex justify-center pb-1">
              <PhotoPicker
                label={t('collectorPhoto', 'Agent / Collector Photo')}
                value={editing.photo}
                onChange={photo => setEditing({ ...editing, photo })}
              />
            </div>
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

            {!editing.id && (
              <p className="text-xs text-slate-400">{t('collectorLoginHint', 'Their login is created with this. See it in User Management.')}</p>
            )}

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
