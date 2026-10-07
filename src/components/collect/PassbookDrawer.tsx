import React, { useEffect, useState } from 'react';
import { PaymentTransaction, CollectionAccount } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { Sheet, Spinner } from '../common/ui';
import { BookOpen, CheckCircle2, Edit3, Award, Receipt as ReceiptIcon } from 'lucide-react';
import { PaymentEditModal } from '../common/PaymentEditModal';

interface PassbookDrawerProps {
  customerId: string;
  customerName: string;
  balance: number;
  dailyDue: number;
  onShowReceipt: (receiptNumber: string) => void;
  onClose: () => void;
}

/** Authentic Premium Customer Passbook Ledger Drawer */
export const PassbookDrawer: React.FC<PassbookDrawerProps> = ({
  customerId,
  customerName,
  balance,
  dailyDue,
  onShowReceipt,
  onClose,
}) => {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<PaymentTransaction[] | null>(null);
  const [account, setAccount] = useState<CollectionAccount | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentTransaction | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);

  const currentUser = (() => {
    try {
      const cached = localStorage.getItem('krs_user');
      return cached ? JSON.parse(cached) : { name: 'admin', role: 'AGENT' };
    } catch {
      return { name: 'admin', role: 'AGENT' };
    }
  })();
  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';

  const loadPayments = () => {
    api.getPayments({ customer_id: customerId })
      .then(setPayments)
      .catch(() => setPayments([]));

    api.getCustomer360(customerId)
      .then(prof => {
        if (prof.activeAccount) setAccount(prof.activeAccount);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadPayments();
  }, [customerId]);

  return (
    <Sheet title={t(customerName, customerName)} onClose={onClose}>
      
      {/* Premium Passbook Top Header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-navy-950 via-[#0d1627] to-navy-950 p-4 border border-gold-500/30 text-center mb-4 space-y-2 shadow-lg">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/30 text-[9px] font-black uppercase tracking-wider text-gold-300">
          <Award className="w-3 h-3 text-gold-400" />
          <span>{t('premiumPassbook', 'Official Passbook Book')}</span>
        </div>
        <div className="text-base font-serif font-black text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-amber-200 to-gold-400">
          KRS FINANCE • PASSBOOK
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          Customer ID: <strong className="text-slate-200">{customerId}</strong>
        </div>

        {/* Dual Financial Parameters */}
        <div className="grid grid-cols-2 gap-2 pt-2 text-left">
          <div className="glass-card rounded-xl p-2.5 bg-navy-900/90 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-semibold">{t('balance', 'Balance')}</div>
            <div className="text-lg font-black text-gold-300 font-mono">{formatCurrency(balance)}</div>
          </div>
          <div className="glass-card rounded-xl p-2.5 bg-navy-900/90 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-semibold">{t('dailyPayment', 'Daily payment')}</div>
            <div className="text-lg font-black text-white font-mono">{formatCurrency(dailyDue)}</div>
          </div>
        </div>
      </div>

      {payments === null ? (
        <Spinner />
      ) : payments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">{t('noPaymentsYet', 'No payments yet')}</p>
      ) : (
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {payments.map((p, idx) => {
            const cancelled = p.status === 'CANCELLED';
            return (
              <div
                key={p.id}
                className="w-full glass-card rounded-2xl p-3 flex items-center justify-between gap-3 text-left border border-slate-800/80 hover:border-slate-700 transition-all"
              >
                <button
                  type="button"
                  onClick={() => onShowReceipt(p.receipt_number)}
                  className="min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-bold font-mono ${cancelled ? 'line-through text-slate-500' : 'text-white'}`}>
                      {formatCurrency(p.amount_paid)}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-navy-950 border border-slate-800">
                      {t(p.payment_mode, p.payment_mode)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                    <span>{formatDate(p.collection_date)}</span>
                    <span>&bull;</span>
                    <span className="text-blue-400 underline">{p.receipt_number}</span>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {cancelled ? (
                    <span className="text-xs font-bold text-rose-400">{t('cancelled', 'Cancelled')}</span>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 text-[9px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>PAID</span>
                    </div>
                  )}

                  {/* ONLY ADMIN CAN MODIFY PAYMENT HISTORY */}
                  {isAdmin && !cancelled && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPayment(p);
                        setShowEditModal(true);
                      }}
                      className="p-1.5 rounded-xl bg-navy-900 hover:bg-gold-500 hover:text-navy-950 border border-slate-700 text-gold-300 font-bold text-xs transition-colors cursor-pointer"
                      title="Admin: Modify payment amount or date"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Payment Edit Modal */}
      {showEditModal && account && isAdmin && (
        <PaymentEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingPayment(null);
          }}
          payment={editingPayment}
          account={account}
          customerName={customerName}
          currentUser={currentUser}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingPayment(null);
            loadPayments();
          }}
        />
      )}

    </Sheet>
  );
};
