import React, { useEffect, useState } from 'react';
import { Check, Edit3, MapPin, Navigation, PlusCircle, Trash2 } from 'lucide-react';
import { Area, Collector, DailyCollectionRecord } from '../../types';
import { api, CustomerListItem } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { mapsDirections, mapsSearch } from '../../utils/maps';
import { collectionDaySummary } from '../../../shared/collectorDay';
import { todayIso } from '../../../shared/finance';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import { AmountList, BigButton, ConfirmSheet, EmptyState, Sheet, Spinner } from '../common/ui';

const inputClass = 'w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white focus:border-gold-500 focus:outline-none';

/** Collection areas: each name with its amounts as a list; tapping the name opens its shops and figures. */
export const AreasView: React.FC<{ onOpenCustomer: (customerId: string) => void }> = ({ onOpenCustomer }) => {
  const { t } = useLanguage();
  const { default_location: location, long_pending_after_terms: longAfter } = useConfig().config.masters;
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [records, setRecords] = useState<DailyCollectionRecord[]>([]);
  const [assigned, setAssigned] = useState(false);
  const [profile, setProfile] = useState<Area | null>(null);
  const [editing, setEditing] = useState<Partial<Area> | null>(null);
  const [deleting, setDeleting] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const today = todayIso();
    const [ars, cols, custs, recs, assignment] = await Promise.all([
      api.getAreas(),
      api.getCollectors(),
      api.getCustomers(),
      api.getDailyCollections({ date: today }),
      api.getDayAssignment(today),
    ]);
    setAreas(ars);
    setCollectors(cols.filter(c => c.status === 'ACTIVE'));
    setCustomers(custs);
    setRecords(recs);
    setAssigned(assignment.assigned);
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

  /** A running loan's area decides; a customer without one belongs to their shop's area. */
  const areaOf = (c: CustomerListItem) => c.activeAccount?.collection_area || c.business?.shop_area || c.address?.area;
  const figures = (area: Area) => {
    const shops = customers.filter(c => areaOf(c) === area.area_name);
    const loans = shops.flatMap(c => (c.activeAccount ? [c.activeAccount] : []));
    const today = records.filter(r => r.collection_area === area.area_name);
    const collectorsToday = [...new Set(today.map(r => r.collector_name))];
    return {
      shops,
      today: collectionDaySummary(today),
      collectorsToday: collectorsToday.length > 0 ? collectorsToday : [area.assigned_collector_name],
      runningLoans: loans.length,
      totalLoan: loans.reduce((sum, l) => sum + l.total_repayment, 0),
      collected: loans.reduce((sum, l) => sum + l.amount_collected, 0),
      balance: loans.reduce((sum, l) => sum + l.remaining_amount, 0),
      longPending: loans.filter(l => (l.days_behind ?? 0) >= longAfter).length,
    };
  };
  const mapButton = 'p-2 rounded-xl bg-navy-950 border border-slate-700 text-gold-300 hover:border-gold-500/60';
  const shown = profile ? figures(profile) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-white">{t('areas', 'Areas')}</h2>
        <BigButton small tone="gold" icon={PlusCircle} label={t('addArea', 'Add area')}
          onClick={() => { setError(null); setEditing({ assigned_collector_id: collectors[0]?.id }); }} />
      </div>

      {error && !editing && <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">{error}</div>}

      {areas.length === 0 ? (
        <EmptyState icon={MapPin} text={t('nobodyHere', 'Nobody here')} />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 divide-y divide-slate-800">
          {areas.map(a => {
            const area = figures(a);
            return (
              <div key={a.id} className="flex items-start justify-between gap-3 p-4">
                <button type="button" onClick={() => setProfile(a)} className="min-w-0 flex-1 flex items-center gap-3 text-left">
                  <MapPin className="w-6 h-6 text-gold-400 flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-black text-white underline decoration-slate-600 underline-offset-4">{a.area_name}</span>
                    <span className="block text-xs text-slate-400">{area.collectorsToday.map(name => t(name, name)).join(', ')}</span>
                  </span>
                </button>
                <AmountList
                  rows={[
                    [t('today', 'Today'), formatCurrency(area.today.collected), 'text-emerald-400'],
                    [t('runningLoansLabel', 'Running loans'), area.runningLoans],
                    [t('balance', 'Balance'), formatCurrency(area.balance), 'text-gold-300'],
                  ]}
                />
              </div>
            );
          })}
        </div>
      )}

      {profile && shown && (
        <Sheet title={profile.area_name} onClose={() => setProfile(null)} wide>
          <div className="space-y-4">
            <a
              href={mapsSearch([profile.area_name, profile.city || location.city, location.state])}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-navy-950 border border-gold-500/40 text-gold-300 font-bold"
            >
              <MapPin className="w-5 h-5" />
              {t('openInGoogleMaps', 'Open in Google Maps')}
            </a>

            <dl className="rounded-2xl bg-navy-950 border border-slate-800 divide-y divide-slate-800 text-sm">
              {([
                [assigned ? t('collectorToday', 'Collector today') : t('usualCollector', 'Usual collector (not assigned yet)'), shown.collectorsToday.map(name => t(name, name)).join(', ')],
                [t('shopsCustomers', 'Shops / customers'), shown.shops.length],
                [t('runningLoansLabel', 'Running loans'), shown.runningLoans],
                [t('totalLoanLabel', 'Total loan'), formatCurrency(shown.totalLoan)],
                [t('collected', 'Collected'), formatCurrency(shown.collected)],
                [t('balanceToCollect', 'Balance to collect'), formatCurrency(shown.balance)],
                [t('collectionTodayShort', 'Collection today'), `${formatCurrency(shown.today.collected)} / ${formatCurrency(shown.today.expected)}`],
                [t('longPending', 'Long pending'), shown.longPending],
              ] as [string, React.ReactNode][]).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 px-4 py-2.5">
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="text-white font-semibold text-right">{value}</dd>
                </div>
              ))}
            </dl>

            {shown.shops.length === 0 ? (
              <EmptyState icon={MapPin} text={t('nobodyHere', 'Nobody here')} />
            ) : (
              <div className="rounded-2xl border border-slate-800 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 pl-3 pr-1 font-semibold">{t('shopsCustomers', 'Shops / customers')}</th>
                      <th className="py-2.5 px-1 font-semibold text-right">{t('balance', 'Balance')}</th>
                      <th className="py-2.5 px-1 font-semibold text-center">{t('pendingTermsShort', 'Pending terms')}</th>
                      <th className="py-2.5 pl-1 pr-3 font-semibold text-center">{t('map', 'Map')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {shown.shops.map(c => {
                      const behind = c.activeAccount?.days_behind ?? 0;
                      return (
                        <tr key={c.id} className={behind > 0 ? 'bg-rose-500/10' : undefined}>
                          <td className="py-2.5 pl-3 pr-1">
                            <button type="button" onClick={() => onOpenCustomer(c.id)} className="text-left">
                              <span className="block font-bold text-white underline decoration-slate-600 underline-offset-4">{c.business?.shop_name || t(c.full_name, c.full_name)}</span>
                              {c.business?.shop_name && <span className="block text-xs text-slate-400">{t(c.full_name, c.full_name)}</span>}
                            </button>
                          </td>
                          <td className="py-2.5 px-1 text-right font-mono font-bold text-gold-300 whitespace-nowrap">
                            {c.activeAccount ? formatCurrency(c.activeAccount.remaining_amount) : <span className="text-slate-500">–</span>}
                          </td>
                          <td className="py-2.5 px-1 text-center font-mono">
                            {behind > 0 ? <strong className="text-rose-300">{behind}</strong> : <span className="text-slate-500">–</span>}
                          </td>
                          <td className="py-2 pl-1 pr-3 text-center">
                            <a
                              href={mapsDirections([c.business?.shop_name, c.business?.shop_address || c.address?.street, profile.area_name, location.city, location.state])}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`${t('map', 'Map')}: ${c.business?.shop_name || c.full_name}`}
                              className={`inline-flex ${mapButton}`}
                            >
                              <Navigation className="w-4 h-4" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <BigButton icon={Edit3} label={t('edit', 'Edit')} onClick={() => { setError(null); setEditing(profile); setProfile(null); }} />
          </div>
        </Sheet>
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
