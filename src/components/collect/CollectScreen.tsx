import React, { useCallback, useEffect, useState } from 'react';
import { Printer, Search, CheckCircle2, Users } from 'lucide-react';
import { Area, Collector, DailyCollectionRecord, Receipt, User } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { ConfirmSheet, EmptyState, PageTitle, PillTabs, Spinner, BigButton } from '../common/ui';
import { ReceiptModal } from '../collections/ReceiptModal';
import { DailyCollectionRegisterView } from '../collections/DailyCollectionRegisterView';
import { CollectCard } from './CollectCard';
import { OtherAmountSheet } from './OtherAmountSheet';
import { NotPaidSheet } from './NotPaidSheet';
import { PaymentDoneSheet } from './PaymentDoneSheet';
import { PassbookDrawer } from './PassbookDrawer';
import { CollectTab, dayState, matchesSearch, quickAmount } from './collectHelpers';

interface CollectScreenProps {
  currentUser: User;
  /** When set (from a customer's Collect button), only that loan is shown. */
  focusAccountId?: string | null;
  onClearFocus: () => void;
  /** Office only: open the full customer page. Collectors see the payment history instead. */
  onOpenCustomer?: (customerId: string) => void;
}

type Notice = { kind: 'ok' | 'error'; text: string } | null;

/** The daily round: one card per customer with Paid / Other amount / Not paid, and Undo. */
export const CollectScreen: React.FC<CollectScreenProps> = ({ currentUser, focusAccountId, onClearFocus, onOpenCustomer }) => {
  const { t } = useLanguage();
  const isOffice = currentUser.role === 'ADMIN';
  const today = todayIso();

  const [date, setDate] = useState<string>(today);
  const [collector, setCollector] = useState<string>(isOffice ? 'ALL' : currentUser.collector_id || 'ALL');
  const [area, setArea] = useState<string>('ALL');
  const [tab, setTab] = useState<CollectTab>('todo');
  const [search, setSearch] = useState<string>('');

  const [records, setRecords] = useState<DailyCollectionRecord[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const [otherFor, setOtherFor] = useState<DailyCollectionRecord | null>(null);
  const [notPaidFor, setNotPaidFor] = useState<DailyCollectionRecord | null>(null);
  const [done, setDone] = useState<{ receipt: Receipt; phone: string } | null>(null);
  const [receiptView, setReceiptView] = useState<{ receipt: Receipt; phone: string } | null>(null);
  const [passbookFor, setPassbookFor] = useState<DailyCollectionRecord | null>(null);
  const [undoFor, setUndoFor] = useState<{ receiptNumber: string; name: string; amount: number } | null>(null);
  const [showRegister, setShowRegister] = useState<boolean>(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await api.getDailyCollections({ date, collector, area }));
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not load the list' });
    } finally {
      setLoading(false);
    }
  }, [date, collector, area]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isOffice) return;
    Promise.all([api.getCollectors(), api.getAreas()])
      .then(([cols, ars]) => {
        setCollectors(cols);
        setAreas(ars);
      })
      .catch(() => undefined);
  }, [isOffice]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const collectorFor = (record: DailyCollectionRecord) =>
    isOffice ? record.collector_id : currentUser.collector_id || record.collector_id;

  const savePayment = async (record: DailyCollectionRecord, amount: number, paymentMode?: string) => {
    setBusyId(record.id);
    try {
      const res = await api.collectPayment({
        collection_account_id: record.collection_account_id,
        collection_date: date,
        amount_paid: amount,
        payment_mode: paymentMode,
        collector_id: collectorFor(record),
      });
      setOtherFor(null);
      if (res.receipt) setDone({ receipt: res.receipt, phone: record.mobile_number });
      await load();
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setBusyId(null);
    }
  };

  const saveNotPaid = async (record: DailyCollectionRecord, reason: string, note: string) => {
    setBusyId(record.id);
    try {
      await api.collectPayment({
        collection_account_id: record.collection_account_id,
        collection_date: date,
        amount_paid: 0,
        is_missed: true,
        reason,
        remarks: note || undefined,
        collector_id: collectorFor(record),
      });
      setNotPaidFor(null);
      setNotice({ kind: 'ok', text: `${record.customer_name}: ${t('notPaid', 'Not paid')}` });
      await load();
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmUndo = async () => {
    if (!undoFor) return;
    setBusyId(undoFor.receiptNumber);
    try {
      await api.undoPayment(undoFor.receiptNumber, { name: currentUser.name, role: currentUser.role });
      setNotice({ kind: 'ok', text: `${t('paymentUndone', 'Payment undone')}: ${undoFor.name}` });
      setUndoFor(null);
      setDone(null);
      await load();
    } catch (err) {
      setUndoFor(null);
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not undo' });
    } finally {
      setBusyId(null);
    }
  };

  const showReceipt = async (receiptNumber: string, phone: string) => {
    try {
      setReceiptView({ receipt: await api.getReceipt(receiptNumber), phone });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Receipt not found' });
    }
  };

  if (showRegister) {
    return (
      <DailyCollectionRegisterView
        onBack={() => setShowRegister(false)}
        date={date}
        collectorId={collector}
        area={area}
      />
    );
  }

  const focused = focusAccountId ? records.filter(r => r.collection_account_id === focusAccountId) : null;
  const counts = {
    todo: records.filter(r => dayState(r) === 'todo').length,
    paid: records.filter(r => dayState(r) === 'paid').length,
    notPaid: records.filter(r => dayState(r) === 'not-paid').length,
  };
  const visible = (focused ?? records.filter(r => tab === 'all' || dayState(r) === tab)).filter(r => matchesSearch(r, search));

  const totalDue = records.reduce((s, r) => s + r.daily_due, 0);
  const collected = records.reduce((s, r) => s + r.paid_amount, 0);
  const left = records.filter(r => dayState(r) === 'todo').reduce((s, r) => s + quickAmount(r), 0);
  const canCollect = date === today;

  return (
    <div className="space-y-4 pb-8">
      <PageTitle
        title={t('navCollect', 'Collect')}
        subtitle={date === today ? t('today', 'Today') : formatDate(date)}
        action={<BigButton small icon={Printer} label={t('printList', 'Print list')} onClick={() => setShowRegister(true)} />}
      />

      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-2xl p-3">
          <div className="text-xs text-slate-400 font-semibold">{t('toCollect', 'To collect')}</div>
          <div className="text-lg sm:text-2xl font-black text-white">{formatCurrency(totalDue)}</div>
        </div>
        <div className="glass-card rounded-2xl p-3">
          <div className="text-xs text-slate-400 font-semibold">{t('collected', 'Collected')}</div>
          <div className="text-lg sm:text-2xl font-black text-emerald-400">{formatCurrency(collected)}</div>
        </div>
        <div className="glass-card rounded-2xl p-3">
          <div className="text-xs text-slate-400 font-semibold">{t('left', 'Left')}</div>
          <div className="text-lg sm:text-2xl font-black text-gold-300">{formatCurrency(left)}</div>
        </div>
      </div>

      {isOffice && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => setDate(e.target.value || today)}
            className="px-3 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-sm text-white"
            aria-label={t('date', 'Date')}
          />
          <select
            value={collector}
            onChange={e => setCollector(e.target.value)}
            className="px-3 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-sm text-white"
            aria-label={t('collector', 'Collector')}
          >
            <option value="ALL">{t('all collectors', 'All collectors')}</option>
            {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={area}
            onChange={e => setArea(e.target.value)}
            className="px-3 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-sm text-white"
            aria-label={t('area', 'Area')}
          >
            <option value="ALL">{t('all areas', 'All areas')}</option>
            {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
          </select>
        </div>
      )}

      {focused ? (
        <div className="flex items-center justify-between gap-3 glass-card rounded-2xl px-4 py-3">
          <span className="text-sm text-slate-300 font-semibold">{t('showingOneCustomer', 'Showing one customer')}</span>
          <BigButton small icon={Users} label={t('showEveryone', 'Show everyone')} onClick={onClearFocus} />
        </div>
      ) : (
        <>
          <PillTabs<CollectTab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'todo', label: t('tabToCollect', 'To collect'), count: counts.todo },
              { id: 'paid', label: t('tabPaid', 'Paid'), count: counts.paid },
              { id: 'not-paid', label: t('notPaid', 'Not paid'), count: counts.notPaid },
              { id: 'all', label: t('all', 'All'), count: records.length },
            ]}
          />
          <div className="relative">
            <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchCustomers', 'Search name, shop or mobile')}
              className="w-full pl-12 pr-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white placeholder-slate-500 focus:border-gold-500 focus:outline-none"
            />
          </div>
        </>
      )}

      {notice && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-semibold border ${
          notice.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          text={tab === 'todo' && !search && !focused ? t('allDoneToday', 'Everyone is done for today') : t('nobodyHere', 'Nobody here')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map(record => (
            <CollectCard
              key={record.id}
              record={record}
              busy={busyId === record.id}
              canCollect={canCollect}
              canUndo={canCollect && !!record.receipt_number}
              onPaid={() => savePayment(record, quickAmount(record))}
              onOther={() => setOtherFor(record)}
              onNotPaid={() => setNotPaidFor(record)}
              onReceipt={() => record.receipt_number && showReceipt(record.receipt_number, record.mobile_number)}
              onUndo={() =>
                record.receipt_number &&
                setUndoFor({ receiptNumber: record.receipt_number, name: record.customer_name, amount: record.paid_amount })
              }
              onOpenCustomer={() => (onOpenCustomer ? onOpenCustomer(record.customer_id) : setPassbookFor(record))}
            />
          ))}
        </div>
      )}

      {otherFor && (
        <OtherAmountSheet
          record={otherFor}
          busy={busyId === otherFor.id}
          onSave={(amount, mode) => savePayment(otherFor, amount, mode)}
          onClose={() => setOtherFor(null)}
        />
      )}
      {notPaidFor && (
        <NotPaidSheet
          record={notPaidFor}
          busy={busyId === notPaidFor.id}
          onSave={(reason, note) => saveNotPaid(notPaidFor, reason, note)}
          onClose={() => setNotPaidFor(null)}
        />
      )}
      {done && (
        <PaymentDoneSheet
          receipt={done.receipt}
          customerMobile={done.phone}
          busy={busyId === done.receipt.receipt_number}
          onShowReceipt={() => setReceiptView(done)}
          onUndo={() =>
            setUndoFor({ receiptNumber: done.receipt.receipt_number, name: done.receipt.customer_name, amount: done.receipt.amount_paid })
          }
          onClose={() => setDone(null)}
        />
      )}
      {undoFor && (
        <ConfirmSheet
          title={t('undoQuestion', 'Undo this payment?')}
          message={`${undoFor.name} • ${formatCurrency(undoFor.amount)}. ${t('undoExplain', 'The receipt will be marked cancelled and the balance goes back.')}`}
          yesLabel={t('yesUndo', 'Yes, undo')}
          noLabel={t('no', 'No')}
          danger
          busy={busyId === undoFor.receiptNumber}
          onYes={confirmUndo}
          onNo={() => setUndoFor(null)}
        />
      )}
      {passbookFor && (
        <PassbookDrawer
          customerId={passbookFor.customer_id}
          customerName={passbookFor.customer_name}
          balance={passbookFor.balance_remaining}
          dailyDue={passbookFor.daily_due}
          onShowReceipt={receiptNumber => showReceipt(receiptNumber, passbookFor.mobile_number)}
          onClose={() => setPassbookFor(null)}
        />
      )}
      {receiptView && (
        <ReceiptModal receipt={receiptView.receipt} customerMobile={receiptView.phone} onClose={() => setReceiptView(null)} />
      )}
    </div>
  );
};
