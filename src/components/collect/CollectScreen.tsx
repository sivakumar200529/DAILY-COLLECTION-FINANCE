import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Printer, Users } from 'lucide-react';
import { Area, Collector, CollectorReport, DailyCollectionRecord, User } from '../../types';
import { api, DayAssignmentStatus } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { activeClosing } from '../../../shared/collectorDay';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, PageTitle, Spinner } from '../common/ui';
import { DailyCollectionRegisterView } from '../collections/DailyCollectionRegisterView';
import { FigureCard, TodayFigureLines } from '../dashboard/DayFigures';
import { AssignWorkPanel } from './AssignWorkPanel';
import { CollectionList } from './CollectionList';

interface CollectScreenProps {
  currentUser: User;
  /** When set (from a customer's Collect button), only that loan is shown. */
  focusAccountId?: string | null;
  onClearFocus: () => void;
  onOpenCustomer: (customerId: string) => void;
  onOpenCollectorReports: () => void;
}

/**
 * The office's Daily Collection: all of today's work. Today's figures, assigning the work to collectors
 * and how each is doing, then the same list the collectors use, for any collector, area and day (past
 * days are read-only), and the printed list.
 */
export const CollectScreen: React.FC<CollectScreenProps> = ({ currentUser, focusAccountId, onClearFocus, onOpenCustomer, onOpenCollectorReports }) => {
  const { t } = useLanguage();
  const today = todayIso();
  const [date, setDate] = useState<string>(today);
  const [collector, setCollector] = useState<string>('ALL');
  const [area, setArea] = useState<string>('ALL');
  const [records, setRecords] = useState<DailyCollectionRecord[] | null>(null);
  const [todayRecords, setTodayRecords] = useState<DailyCollectionRecord[]>([]);
  const [reports, setReports] = useState<CollectorReport[]>([]);
  const [todayReports, setTodayReports] = useState<CollectorReport[]>([]);
  const [assignment, setAssignment] = useState<DayAssignmentStatus | null>(null);
  const [closed, setClosed] = useState(false);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, allToday, dayReports, reportsToday, assigned, closings] = await Promise.all([
        api.getDailyCollections({ date, collector, area }),
        api.getDailyCollections({ date: today }),
        api.getCollectorReports({ date }),
        api.getCollectorReports({ date: today }),
        api.getDayAssignment(today),
        api.getDayClosings(date).catch(() => []),
      ]);
      setClosed(!!activeClosing(closings, date));
      setRecords(list);
      setTodayRecords(allToday);
      setReports(dayReports);
      setTodayReports(reportsToday);
      setAssignment(assigned);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.'));
      setRecords(prev => prev ?? []);
    }
  }, [date, collector, area, today, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([api.getCollectors(), api.getAreas()])
      .then(([cols, ars]) => {
        setCollectors(cols);
        setAreas(ars);
      })
      .catch(() => undefined);
  }, []);

  if (showRegister) {
    return <DailyCollectionRegisterView onBack={() => setShowRegister(false)} date={date} collectorId={collector} area={area} />;
  }

  const focused = focusAccountId && records ? records.filter(r => r.collection_account_id === focusAccountId) : null;
  const shown = focused ?? records ?? [];
  const selectClass = 'px-3 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-sm text-white';

  return (
    <div className="space-y-4 pb-8">
      <PageTitle
        title={t('navCollect', 'Daily Collection')}
        subtitle={date === today ? t('today', 'Today') : formatDate(date)}
        action={<BigButton small icon={Printer} label={t('printList', 'Print list')} onClick={() => setShowRegister(true)} />}
      />

      <FigureCard title={date === today ? t('todaysWork', "Today's work") : formatDate(date)} prominent>
        <TodayFigureLines records={records ?? []} reports={reports} />
      </FigureCard>

      {closed && (
        <div className="flex items-center gap-2 glass-card rounded-2xl px-4 py-3 border border-emerald-500/40 text-emerald-300 text-sm font-bold">
          <Lock className="w-4 h-4 flex-shrink-0" />
          {t('dayClosedLocked', "This day's business is closed. Reopen it on Home to change collections.")}
        </div>
      )}

      {assignment && (
        <AssignWorkPanel
          officeName={currentUser.name}
          records={todayRecords}
          collectors={collectors}
          reports={todayReports}
          assignment={assignment}
          onChanged={load}
          onOpenReports={onOpenCollectorReports}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="date"
          value={date}
          max={today}
          onChange={e => setDate(e.target.value || today)}
          className={selectClass}
          aria-label={t('date', 'Date')}
        />
        <select value={collector} onChange={e => setCollector(e.target.value)} className={selectClass} aria-label={t('collector', 'Collector')}>
          <option value="ALL">{t('all collectors', 'All collectors')}</option>
          {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={area} onChange={e => setArea(e.target.value)} className={selectClass} aria-label={t('area', 'Area')}>
          <option value="ALL">{t('all areas', 'All areas')}</option>
          {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
        </select>
      </div>

      {focused && (
        <div className="flex items-center justify-between gap-3 glass-card rounded-2xl px-4 py-3">
          <span className="text-sm text-slate-300 font-semibold">{t('showingOneCustomer', 'Showing one customer')}</span>
          <BigButton small icon={Users} label={t('showEveryone', 'Show everyone')} onClick={onClearFocus} />
        </div>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {!records ? (
        <Spinner />
      ) : (
        <CollectionList
          currentUser={currentUser}
          records={shown}
          onChanged={load}
          canCollect={date === today && !closed}
          onOpenCustomer={onOpenCustomer}
        />
      )}
    </div>
  );
};
