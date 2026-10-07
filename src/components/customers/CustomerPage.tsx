import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, BookOpen, Calendar, CalendarCheck, Camera, Check, ChevronDown, ChevronUp, Edit3, FileText,
  MapPin, PlusCircle, Receipt as ReceiptIcon, RotateCcw, Send, Trash2, UserX, Wallet,
} from 'lucide-react';
import {
  Area, Collector, Customer360Profile, CustomerDocument, DailyCollectionRecord, DocumentType, PaymentTransaction, Receipt, User,
} from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { todayIso } from '../../../shared/finance';
import { useLanguage } from '../../context/LanguageContext';
import { Avatar } from '../common/Avatar';
import { BigButton, CallButton, ConfirmSheet, EmptyState, PillTabs, ProgressBar, Sheet, Spinner } from '../common/ui';
import { PhotoPicker } from '../common/PhotoPicker';
import { ReceiptModal } from '../collections/ReceiptModal';
import { IssueLoanModal } from '../loans/IssueLoanModal';
import { CustomerForm } from './CustomerForm';
import { PaymentEditModal } from '../common/PaymentEditModal';
import { PremiumPassbookBook } from '../customer-portal/PremiumPassbookBook';
import { CustomerScheduleCalendar } from '../customer-portal/CustomerScheduleCalendar';
import { HandNoteBulkModal } from './HandNoteBulkModal';

type PageTab = 'loan' | 'schedule' | 'payments' | 'details';

interface CustomerPageProps {
  customerId: string;
  currentUser: User;
  onBack: () => void;
  onCollect: (accountId: string) => void;
}

const DOCUMENT_TYPES: DocumentType[] = ['Aadhaar Card', 'PAN Card', 'Business Proof', 'Other Documents'];

/** Plain words for the change history. */
const AUDIT_LABELS: Record<string, [string, string]> = {
  CREATE_CUSTOMER: ['audit_CREATE_CUSTOMER', 'Customer added'],
  UPDATE_CUSTOMER: ['audit_UPDATE_CUSTOMER', 'Details changed'],
  DEACTIVATE_CUSTOMER: ['audit_DEACTIVATE_CUSTOMER', 'Customer made inactive'],
  DISBURSE_COLLECTION_ACCOUNT: ['audit_DISBURSE_COLLECTION_ACCOUNT', 'Loan given'],
  OVERRIDE_LOAN_TERMS: ['audit_OVERRIDE_LOAN_TERMS', 'Loan terms changed from loan type'],
  UPDATE_COLLECTION_ACCOUNT: ['audit_UPDATE_COLLECTION_ACCOUNT', 'Collector or area changed'],
  CANCEL_LOAN: ['audit_CANCEL_LOAN', 'Loan cancelled'],
  COLLECT_PAYMENT: ['audit_COLLECT_PAYMENT', 'Payment collected'],
  MISSED_COLLECTION: ['audit_MISSED_COLLECTION', 'Marked not paid'],
  UNDO_PAYMENT: ['audit_UNDO_PAYMENT', 'Payment undone'],
  ADD_NOTE: ['audit_ADD_NOTE', 'Note added'],
  UPLOAD_DOCUMENT: ['audit_UPLOAD_DOCUMENT', 'Document added'],
  VERIFY_DOCUMENT: ['audit_VERIFY_DOCUMENT', 'Document checked'],
  UPDATE_SHOP_MARGIN: ['audit_UPDATE_SHOP_MARGIN', 'Usual interest changed'],
};

export const CustomerPage: React.FC<CustomerPageProps> = ({ customerId, currentUser, onBack, onCollect }) => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Customer360Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<PageTab>('loan');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [showGiveLoan, setShowGiveLoan] = useState(false);
  const [receiptView, setReceiptView] = useState<Receipt | null>(null);
  const [undoFor, setUndoFor] = useState<PaymentTransaction | null>(null);
  const [askCancelLoan, setAskCancelLoan] = useState(false);
  const [askDeactivate, setAskDeactivate] = useState(false);
  const [removeDoc, setRemoveDoc] = useState<CustomerDocument | null>(null);
  const [placeSheet, setPlaceSheet] = useState(false);
  const [schedule, setSchedule] = useState<DailyCollectionRecord[] | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentTransaction | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPassbookBook, setShowPassbookBook] = useState(false);
  const [showHandNoteModal, setShowHandNoteModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setProfile(await api.getCustomer360(customerId));
    } catch {
      setNotFound(true);
    }
  };

  useEffect(() => {
    load();
  }, [customerId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const run = async (action: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    try {
      await action();
      setNotice({ kind: 'ok', text: okText });
      await load();
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <div className="space-y-4">
        <BigButton icon={ArrowLeft} label={t('customers', 'Customers')} onClick={onBack} />
        <EmptyState icon={UserX} text={t('customerNotFound', 'Customer not found')} />
      </div>
    );
  }
  if (!profile) return <Spinner />;

  const { personal, address, business, activeAccount: loan, documents, notes, auditLogs } = profile;
  const payments = [...profile.recentPayments].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const activePayments = payments.filter(p => p.status !== 'CANCELLED');
  const pastLoans = profile.accounts.filter(a => a.id !== loan?.id);
  const isOffice = currentUser.role === 'ADMIN';
  const loanHasPayments = !!loan && activePayments.some(p => p.collection_account_id === loan.id);

  const undoable = (p: PaymentTransaction) =>
    p.status !== 'CANCELLED' &&
    (isOffice || (p.collection_date === todayIso() &&
      activePayments.find(x => x.collection_account_id === p.collection_account_id)?.id === p.id));

  const openReceipt = (p: PaymentTransaction) => {
    const receipt = profile.receipts.find(r => r.receipt_number === p.receipt_number);
    if (receipt) setReceiptView(receipt);
  };

  const toggleSchedule = async () => {
    const next = !showSchedule;
    setShowSchedule(next);
    if (next && loan && !schedule) setSchedule(await api.getCollectionAccountSchedule(loan.id));
  };

  return (
    <div className="space-y-4 pb-8">
      <BigButton small icon={ArrowLeft} label={t('customers', 'Customers')} onClick={onBack} />

      <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
        <div className="relative group flex-shrink-0">
          <Avatar src={personal.profile_photo} name={personal.full_name} className="w-16 h-16 rounded-2xl text-xl" />
          {isOffice && (
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              title={t('changePhoto', 'Upload / Change photo')}
              aria-label={t('changePhoto', 'Upload / Change photo')}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-gold-500 text-navy-950 hover:bg-gold-400 shadow-md border-2 border-navy-900 cursor-pointer active:scale-95 transition-transform"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-white truncate">{t(personal.full_name, personal.full_name)}</h1>
          <div className="text-sm text-slate-300 truncate">{t(business?.shop_name || '', business?.shop_name || '—')}</div>
          <div className="text-xs text-slate-400 flex items-center gap-1 truncate">
            <MapPin className="w-3.5 h-3.5" />
            {t(business?.shop_area || address?.area || '', business?.shop_area || address?.area || '—')}
          </div>
          {personal.status !== 'ACTIVE' && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-700 text-slate-200">{t('inactive', 'Inactive')}</span>
          )}
        </div>
        <CallButton phone={personal.mobile_number} label={t('call', 'Call')} />
      </div>

      <PillTabs<PageTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'loan', label: t('tabLoan', 'Loan') },
          { id: 'schedule', label: t('dailySchedule', '📅 Daily Days Grid'), count: loan?.collection_days },
          { id: 'payments', label: t('tabPayments', 'Payments'), count: activePayments.length },
          { id: 'details', label: t('tabDetails', 'Details') },
        ]}
      />

      {notice && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-semibold border ${
          notice.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {notice.text}
        </div>
      )}

      {tab === 'loan' && (
        <div className="space-y-4">
          {loan ? (
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400 font-semibold">{t('balance', 'Balance')}</div>
                  <div className="text-4xl font-black text-gold-300">{formatCurrency(loan.remaining_amount)}</div>
                </div>
                <div className="text-right text-sm text-slate-300">
                  {t('paidSoFar', 'Paid')} <strong className="text-white">{formatCurrency(loan.amount_collected)}</strong>
                  <div className="text-xs text-slate-400">{t('of', 'of')} {formatCurrency(loan.total_repayment)}</div>
                </div>
              </div>
              <ProgressBar percent={loan.collection_percentage} tone={(loan.days_behind ?? 0) > 0 ? 'gold' : 'green'} />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-navy-950 border border-slate-800 p-2">
                  <div className="text-xs text-slate-400">{t('dailyPayment', 'Daily payment')}</div>
                  <div className="text-base font-black text-white">{formatCurrency(loan.daily_collection)}</div>
                </div>
                <div className="rounded-xl bg-navy-950 border border-slate-800 p-2">
                  <div className="text-xs text-slate-400">{t('daysLeft', 'Days left')}</div>
                  <div className="text-base font-black text-white">{loan.remaining_days}</div>
                </div>
                <div className="rounded-xl bg-navy-950 border border-slate-800 p-2">
                  <div className="text-xs text-slate-400">{t('lastDay', 'Last day')}</div>
                  <div className="text-sm font-black text-white">{formatDate(loan.expected_end_date)}</div>
                </div>
              </div>
              {(loan.days_behind ?? 0) > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  {loan.days_behind} {t('daysNotPaid', 'days not paid')} • {formatCurrency((loan.days_behind ?? 0) * loan.daily_collection)}
                </div>
              )}
              <div className="text-sm text-slate-400">
                {t('given', 'Given')}: {formatCurrency(loan.disbursed_amount)} • {t('collector', 'Collector')}: {loan.assigned_collector_name} • {loan.plan_name}
              </div>
              <BigButton tone="green" icon={CalendarCheck} label={t('navCollect', 'Collect')} onClick={() => onCollect(loan.id)} className="w-full py-4 text-base" />
              
              {/* Fast Grid & Hand Note Access */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTab('schedule')}
                  className="py-2.5 px-3 rounded-xl bg-navy-900 hover:bg-slate-800 border border-gold-500/30 text-gold-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
                >
                  <Calendar className="w-4 h-4 text-gold-400" />
                  <span>{t('viewDaysGrid', '📅 View Daily Days Grid')} ({loan.completed_days}/{loan.collection_days})</span>
                </button>
                {isOffice && (
                  <button
                    type="button"
                    onClick={() => setShowHandNoteModal(true)}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-gold-500/20 active:scale-95 transition-all"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{t('handNoteUpload', '📓 Upload from Hand Note')}</span>
                  </button>
                )}
              </div>

              {isOffice && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <BigButton small icon={MapPin} label={t('changeCollectorArea', 'Change collector or area')} onClick={() => setPlaceSheet(true)} />
                  {!loanHasPayments && (
                    <BigButton small icon={Trash2} label={t('cancelLoan', 'Cancel this loan')} onClick={() => setAskCancelLoan(true)} />
                  )}
                </div>
              )}
              <button type="button" onClick={toggleSchedule} className="flex items-center gap-1.5 text-sm font-bold text-gold-400">
                {showSchedule ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {t('seeAllDays', 'See all days')}
              </button>
              {showSchedule && (
                schedule === null ? <Spinner /> : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 rounded-xl border border-slate-800">
                    {schedule.map(day => (
                      <div key={day.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-slate-300">{formatDate(day.date)}</span>
                        <span className={
                          day.paid_amount > 0 ? 'text-emerald-400 font-bold' : day.status === 'MISSED' ? 'text-rose-400 font-bold' : 'text-slate-500'
                        }>
                          {day.paid_amount > 0 ? formatCurrency(day.paid_amount) : day.status === 'MISSED' ? t('notPaid', 'Not paid') : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6 text-center space-y-3">
              <Wallet className="w-10 h-10 text-gold-400 mx-auto" />
              <p className="text-base font-bold text-white">{t('noRunningLoan', 'No running loan')}</p>
              {personal.status === 'ACTIVE' && isOffice && (
                <BigButton tone="gold" icon={Wallet} label={t('giveLoan', 'Give loan')} onClick={() => setShowGiveLoan(true)} className="mx-auto" />
              )}
            </div>
          )}

          {pastLoans.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-black text-white">{t('pastLoans', 'Past loans')}</h2>
              {pastLoans.map(a => (
                <div key={a.id} className="glass-card rounded-2xl p-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-bold text-white">{formatCurrency(a.total_repayment)}</div>
                    <div className="text-xs text-slate-400">{formatDate(a.start_date)} – {formatDate(a.actual_completion_date || a.expected_end_date)}</div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${a.status === 'CANCELLED' ? 'bg-slate-700 text-slate-200' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {a.status === 'CANCELLED' ? t('cancelled', 'Cancelled') : t('closed', 'Closed')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-4">
          {loan ? (
            <CustomerScheduleCalendar
              account={loan}
              isAdmin={isOffice}
              onRefresh={load}
              onSelectReceipt={(receiptNum) => {
                const r = profile.receipts.find(rc => rc.receipt_number === receiptNum);
                if (r) setReceiptView(r);
              }}
            />
          ) : (
            <div className="glass-card rounded-2xl p-6 text-center space-y-3">
              <Wallet className="w-10 h-10 text-gold-400 mx-auto" />
              <p className="text-base font-bold text-white">{t('noRunningLoan', 'No running loan')}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-3">
          {/* Top Passbook & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-400 font-semibold">
              {t('paymentHistory', 'Payment History')} ({activePayments.length})
            </div>
            <div className="flex items-center gap-2">
              {loan && (
                <button
                  type="button"
                  onClick={() => setShowPassbookBook(true)}
                  className="py-1.5 px-3 rounded-xl bg-navy-900 hover:bg-slate-800 border border-gold-500/30 text-gold-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Open authentic physical passbook book"
                >
                  <BookOpen className="w-3.5 h-3.5 text-gold-400" />
                  <span>{t('viewPassbookBook', 'Open Passbook Book')}</span>
                </button>
              )}
              {loan && isOffice && (
                <button
                  type="button"
                  onClick={() => setShowHandNoteModal(true)}
                  className="py-1.5 px-3 rounded-xl bg-navy-900 hover:bg-slate-800 border border-gold-500/40 text-gold-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Admin: Fast bulk upload from physical notebook"
                >
                  <BookOpen className="w-3.5 h-3.5 text-gold-400" />
                  <span>{t('handNoteUpload', '📓 Hand Note Upload')}</span>
                </button>
              )}
              {loan && isOffice && (
                <button
                  type="button"
                  onClick={() => { setEditingPayment(null); setShowPaymentModal(true); }}
                  className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-gold-500/20"
                  title="Admin: Record payment for any past or future date"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{t('recordPaymentAnyDate', '+ Record Payment (Any Date)')}</span>
                </button>
              )}
            </div>
          </div>

          {payments.length === 0 ? (
            <EmptyState icon={ReceiptIcon} text={t('noPaymentsYet', 'No payments yet')} />
          ) : (
            <div className="space-y-2">
              {payments.map(p => {
                const cancelled = p.status === 'CANCELLED';
                return (
                  <div key={p.id} className="glass-card rounded-2xl p-3 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => openReceipt(p)} className="text-left min-w-0">
                      <div className={`text-lg font-black ${cancelled ? 'line-through text-slate-500' : 'text-white'}`}>{formatCurrency(p.amount_paid)}</div>
                      <div className="text-xs text-slate-400">
                        {formatDate(p.collection_date)} • {t(p.payment_mode, p.payment_mode)} • {p.receipt_number}
                      </div>
                      {cancelled && <div className="text-xs font-bold text-rose-400">{t('cancelled', 'Cancelled')}</div>}
                    </button>
                    <div className="flex gap-2 flex-shrink-0">
                      <BigButton small icon={ReceiptIcon} label={t('receipt', 'Receipt')} onClick={() => openReceipt(p)} />
                      {/* STRICT: ONLY ADMIN can modify customer payment history! */}
                      {isOffice && !cancelled && (
                        <button
                          type="button"
                          onClick={() => { setEditingPayment(p); setShowPaymentModal(true); }}
                          className="py-1 px-2.5 rounded-xl bg-navy-900 hover:bg-gold-500 hover:text-navy-950 border border-slate-700 text-gold-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          title="Admin: Modify amount, date (before/after month), or mode"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{t('edit', 'Modify')}</span>
                        </button>
                      )}
                      {undoable(p) && <BigButton small icon={RotateCcw} label={t('undo', 'Undo')} onClick={() => setUndoFor(p)} disabled={busy} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'details' && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4 space-y-2 text-sm">
            {[
              [t('mobile', 'Mobile'), personal.mobile_number],
              [t('otherPhone', 'Other phone'), personal.alternate_number],
              [t('fatherHusbandName', 'Father / husband name'), personal.father_or_husband_name],
              [t('shopName', 'Shop name'), business?.shop_name],
              [t('address', 'Address'), business?.shop_address || [address?.door_number, address?.street].filter(Boolean).join(', ')],
              [t('landmark', 'Landmark'), business?.landmark || address?.landmark],
              [t('area', 'Area'), business?.shop_area || address?.area],
              [t('usualInterest', 'Usual interest % for this shop'), business?.default_margin_percentage !== undefined ? `${business.default_margin_percentage}%` : ''],
              [t('customerSince', 'Customer since'), formatDate(personal.created_at)],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-slate-800/60 pb-2 last:border-0">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white font-semibold text-right">{value}</span>
                </div>
              ))}
            {isOffice && (
              <BigButton small icon={Edit3} label={t('edit', 'Edit')} onClick={() => setShowEdit(true)} className="mt-2" />
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-black text-white">{t('documents', 'Documents')}</h2>
            <DocumentAdder
              customerId={customerId}
              uploadedBy={currentUser.name}
              onAdded={() => { setNotice({ kind: 'ok', text: t('documentAdded', 'Document added') }); load(); }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {documents.map(doc => (
                <div key={doc.id} className="glass-card rounded-2xl p-3 space-y-2">
                  {/\.(jpe?g|png|webp)$/i.test(doc.file_url) || doc.file_url.startsWith('/api/uploads/') ? (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <img src={doc.file_url} alt={doc.document_type} className="w-full h-32 object-cover rounded-xl border border-slate-800" />
                    </a>
                  ) : (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gold-400 font-bold">
                      <FileText className="w-5 h-5" /> {doc.file_name}
                    </a>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">{t(doc.document_type, doc.document_type)}</span>
                    {doc.verification_status === 'Verified' ? (
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1"><Check className="w-4 h-4" />{t('checked', 'Checked')}</span>
                    ) : isOffice ? (
                      <BigButton small icon={Check} label={t('markChecked', 'Mark checked')}
                        onClick={() => run(() => api.verifyDocument(doc.id, 'Verified'), t('checked', 'Checked'))} disabled={busy} />
                    ) : (
                      <span className="text-xs font-bold text-amber-300">{t('notCheckedYet', 'Not checked yet')}</span>
                    )}
                  </div>
                  {isOffice && (
                    <button type="button" onClick={() => setRemoveDoc(doc)} className="text-xs text-rose-300 font-semibold flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> {t('remove', 'Remove')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <NotesBox
            notes={notes}
            onAdd={note => run(() => api.addCustomerNote(customerId, note, currentUser.name), t('noteAdded', 'Note added'))}
            busy={busy}
          />

          <div className="space-y-2">
            <button type="button" onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 text-sm font-bold text-gold-400">
              {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {t('changeHistory', 'Change history')}
            </button>
            {showHistory && (
              <div className="glass-card rounded-2xl divide-y divide-slate-800/60">
                {auditLogs.length === 0 ? (
                  <p className="p-4 text-sm text-slate-400">{t('nothingYet', 'Nothing yet')}</p>
                ) : (
                  auditLogs.map(log => {
                    const [key, fallback] = AUDIT_LABELS[log.action] ?? [log.action, log.action.replace(/_/g, ' ').toLowerCase()];
                    return (
                      <div key={log.id} className="px-4 py-2.5 flex justify-between gap-3 text-sm">
                        <span className="text-white font-semibold">{t(key, fallback)}</span>
                        <span className="text-xs text-slate-400 text-right">{formatDateTime(log.timestamp)}<br />{log.user}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {isOffice && personal.status === 'ACTIVE' && !loan && (
            <BigButton small icon={UserX} label={t('makeInactive', 'Make customer inactive')} onClick={() => setAskDeactivate(true)} />
          )}
        </div>
      )}

      {showEdit && (
        <CustomerForm
          initial={{ personal, address, business }}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); setNotice({ kind: 'ok', text: t('saved', 'Saved') }); load(); }}
        />
      )}
      {showGiveLoan && (
        <IssueLoanModal customerId={customerId} onClose={() => setShowGiveLoan(false)} onIssued={() => load()} />
      )}
      {placeSheet && loan && (
        <ChangePlaceSheet
          currentArea={loan.collection_area}
          currentCollectorId={loan.assigned_collector_id}
          busy={busy}
          onClose={() => setPlaceSheet(false)}
          onSave={(collectorId, area) => {
            setPlaceSheet(false);
            run(() => api.updateCollectionAccount(loan.id, { assigned_collector_id: collectorId, collection_area: area }), t('saved', 'Saved'));
          }}
        />
      )}
      {receiptView && (
        <ReceiptModal receipt={receiptView} customerMobile={personal.mobile_number} onClose={() => setReceiptView(null)} />
      )}
      {showPaymentModal && loan && (
        <PaymentEditModal
          isOpen={showPaymentModal}
          onClose={() => { setShowPaymentModal(false); setEditingPayment(null); }}
          payment={editingPayment}
          account={loan}
          customerName={personal.full_name}
          shopName={business?.shop_name}
          currentUser={currentUser}
          onSuccess={() => {
            setNotice({ kind: 'ok', text: t('paymentUpdated', 'Payment successfully updated') });
            load();
          }}
        />
      )}
      {showHandNoteModal && loan && (
        <HandNoteBulkModal
          isOpen={showHandNoteModal}
          onClose={() => setShowHandNoteModal(false)}
          account={loan}
          customerName={personal.full_name}
          currentUser={{ name: currentUser.name, role: currentUser.role }}
          onSuccess={() => {
            setNotice({ kind: 'ok', text: t('bulkSuccess', 'Hand note collections recorded successfully!') });
            load();
          }}
        />
      )}
      {showPassbookBook && loan && (
        <Sheet title={t('premiumPassbook', 'Official Passbook Book')} onClose={() => setShowPassbookBook(false)}>
          <PremiumPassbookBook
            profile={profile}
            account={loan}
            isAdmin={isOffice}
            onEditPayment={(p) => {
              setEditingPayment(p);
              setShowPaymentModal(true);
            }}
            onShowReceipt={(p) => openReceipt(p)}
          />
        </Sheet>
      )}
      {undoFor && (
        <ConfirmSheet
          title={t('undoQuestion', 'Undo this payment?')}
          message={`${formatCurrency(undoFor.amount_paid)} • ${formatDate(undoFor.collection_date)}. ${t('undoExplain', 'The receipt will be marked cancelled and the balance goes back.')}`}
          yesLabel={t('yesUndo', 'Yes, undo')}
          noLabel={t('no', 'No')}
          danger
          busy={busy}
          onYes={() => {
            const payment = undoFor;
            setUndoFor(null);
            run(() => api.undoPayment(payment.id, { name: currentUser.name, role: currentUser.role }), t('paymentUndone', 'Payment undone'));
          }}
          onNo={() => setUndoFor(null)}
        />
      )}
      {askCancelLoan && loan && (
        <ConfirmSheet
          title={t('cancelLoanQuestion', 'Cancel this loan?')}
          message={t('cancelLoanExplain', 'Only for a loan given by mistake. No payments have been taken on it.')}
          yesLabel={t('yesCancelLoan', 'Yes, cancel loan')}
          noLabel={t('no', 'No')}
          danger
          busy={busy}
          onYes={() => { setAskCancelLoan(false); run(() => api.cancelLoan(loan.id), t('loanCancelled', 'Loan cancelled')); }}
          onNo={() => setAskCancelLoan(false)}
        />
      )}
      {askDeactivate && (
        <ConfirmSheet
          title={t('makeInactiveQuestion', 'Make this customer inactive?')}
          message={t('makeInactiveExplain', 'They will not be able to log in, and no new loan can be given.')}
          yesLabel={t('yes', 'Yes')}
          noLabel={t('no', 'No')}
          danger
          busy={busy}
          onYes={() => { setAskDeactivate(false); run(() => api.deleteCustomer(customerId), t('saved', 'Saved')); }}
          onNo={() => setAskDeactivate(false)}
        />
      )}
      {removeDoc && (
        <ConfirmSheet
          title={t('removeDocumentQuestion', 'Remove this document?')}
          message={t(removeDoc.document_type, removeDoc.document_type)}
          yesLabel={t('yesRemove', 'Yes, remove')}
          noLabel={t('no', 'No')}
          danger
          busy={busy}
          onYes={() => { const doc = removeDoc; setRemoveDoc(null); run(() => api.deleteDocument(doc.id), t('removed', 'Removed')); }}
          onNo={() => setRemoveDoc(null)}
        />
      )}
    </div>
  );
};

/** Pick the document type, then take its photo; saved as soon as the photo is uploaded. */
const DocumentAdder: React.FC<{ customerId: string; uploadedBy: string; onAdded: () => void }> = ({ customerId, uploadedBy, onAdded }) => {
  const { t } = useLanguage();
  const [type, setType] = useState<DocumentType | ''>('');
  const [error, setError] = useState<string | null>(null);

  const save = async (url: string) => {
    if (!url || !type) return;
    try {
      await api.uploadDocument({ customer_id: customerId, document_type: type, file_url: url, uploaded_by: uploadedBy });
      setType('');
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  };

  return (
    <div className="glass-card rounded-2xl p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {DOCUMENT_TYPES.map(dt => (
          <button
            key={dt}
            type="button"
            onClick={() => setType(dt)}
            className={`px-3 py-2 rounded-xl text-sm font-bold border ${type === dt ? 'bg-gold-500 border-gold-500 text-navy-950' : 'bg-navy-950 border-slate-700 text-slate-200'}`}
          >
            {t(dt, dt)}
          </button>
        ))}
      </div>
      {type ? (
        <PhotoPicker label={t('addDocumentPhoto', 'Photo of the document')} onChange={save} />
      ) : (
        <p className="text-xs text-slate-400">{t('chooseDocumentType', 'Choose the document type to add a photo')}</p>
      )}
      {error && <p className="text-sm text-rose-300">{error}</p>}
    </div>
  );
};

const NotesBox: React.FC<{ notes: Customer360Profile['notes']; onAdd: (note: string) => void; busy: boolean }> = ({ notes, onAdd, busy }) => {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-black text-white">{t('notes', 'Notes')}</h2>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('writeNote', 'Write a note')}
          className="flex-1 px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white focus:border-gold-500 focus:outline-none"
        />
        <BigButton icon={Send} label={t('add', 'Add')} disabled={busy || !text.trim()} onClick={() => { onAdd(text.trim()); setText(''); }} />
      </div>
      {notes.map(n => (
        <div key={n.id} className="glass-card rounded-2xl p-3 text-sm">
          <div className="text-white">{n.note}</div>
          <div className="text-xs text-slate-400 mt-1">{n.created_by} • {formatDateTime(n.created_at)}</div>
        </div>
      ))}
    </div>
  );
};

const ChangePlaceSheet: React.FC<{
  currentArea: string;
  currentCollectorId: string;
  busy: boolean;
  onSave: (collectorId: string, area: string) => void;
  onClose: () => void;
}> = ({ currentArea, currentCollectorId, busy, onSave, onClose }) => {
  const { t } = useLanguage();
  const [areas, setAreas] = useState<Area[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [area, setArea] = useState(currentArea);
  const [collectorId, setCollectorId] = useState(currentCollectorId);

  useEffect(() => {
    Promise.all([api.getAreas(), api.getCollectors()]).then(([ars, cols]) => {
      setAreas(ars);
      setCollectors(cols.filter(c => c.status === 'ACTIVE'));
    });
  }, []);

  const selectClass = 'w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white';
  return (
    <Sheet title={t('changeCollectorArea', 'Change collector or area')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('area', 'Area')}</label>
          <select className={selectClass} value={area} onChange={e => {
            setArea(e.target.value);
            const areaCollector = areas.find(a => a.area_name === e.target.value)?.assigned_collector_id;
            if (areaCollector) setCollectorId(areaCollector);
          }}>
            {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
            {!areas.some(a => a.area_name === area) && <option value={area}>{area}</option>}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('collector', 'Collector')}</label>
          <select className={selectClass} value={collectorId} onChange={e => setCollectorId(e.target.value)}>
            {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <BigButton label={t('cancel', 'Cancel')} onClick={onClose} />
          <BigButton tone="gold" icon={Check} label={t('save', 'Save')} onClick={() => onSave(collectorId, area)} disabled={busy} />
        </div>
      </div>
    </Sheet>
  );
};
