import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { api, CustomerListItem } from '../../services/api';
import { Area, CollectionAccount, Collector } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, Sheet, Spinner } from '../common/ui';
import { LoanFormState, LoanTermsForm, evaluateLoanForm, initialLoanForm, toIssueLoanPayload } from './LoanTermsForm';

interface IssueLoanModalProps {
  customerId: string;
  onClose: () => void;
  onIssued?: (account: CollectionAccount) => void;
}

/** The single "Give loan" flow, opened from the Customers list and the customer page. */
export const IssueLoanModal: React.FC<IssueLoanModalProps> = ({ customerId, onClose, onIssued }) => {
  const { config } = useConfig();
  const { t } = useLanguage();
  const [customer, setCustomer] = useState<CustomerListItem | null>(null);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [form, setForm] = useState<LoanFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getCustomers(), api.getCollectors(), api.getAreas()])
      .then(([custs, cols, ars]) => {
        const found = custs.find(c => c.id === customerId) ?? null;
        setCustomer(found);
        setCollectors(cols.filter(c => c.status === 'ACTIVE'));
        setAreas(ars);
        setForm(initialLoanForm(config, ars, found?.business?.shop_area || found?.address?.area));
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load'));
  }, [customerId]);

  const evaluation = form ? evaluateLoanForm(config, form) : null;
  const canSubmit = !!customer && !!evaluation && evaluation.issues.length === 0 && !submitting;

  const handleSubmit = async () => {
    if (!customer || !form) return;
    setSubmitting(true);
    setError(null);
    try {
      const account = await api.createCollectionAccount({ customer_id: customer.id, ...toIssueLoanPayload(form) });
      onIssued?.(account);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not give the loan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet title={customer ? `${t('giveLoan', 'Give loan')}: ${customer.full_name}` : t('giveLoan', 'Give loan')} onClose={onClose} wide>
      {!form ? (
        error ? <p className="text-sm text-rose-300">{error}</p> : <Spinner />
      ) : (
        <div className="space-y-4">
          <LoanTermsForm
            value={form}
            onChange={setForm}
            collectors={collectors}
            areas={areas}
            shopDefaultMargin={customer?.business?.default_margin_percentage}
          />

          {error && <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <BigButton label={t('cancel', 'Cancel')} onClick={onClose} />
            <BigButton
              tone="gold"
              icon={Wallet}
              label={
                submitting
                  ? t('saving', 'Saving...')
                  : `${t('give', 'Give')} ${formatCurrency(evaluation?.calculation.disbursed_amount ?? 0)}`
              }
              onClick={handleSubmit}
              disabled={!canSubmit}
            />
          </div>
        </div>
      )}
    </Sheet>
  );
};
