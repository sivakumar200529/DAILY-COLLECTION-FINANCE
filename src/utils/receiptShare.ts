import { CompanyProfile, Receipt } from '../types';
import { formatCurrency, formatDateTime } from './formatters';

type Translate = (key: string, fallback?: string) => string;

/** Plain-text receipt for WhatsApp, in the person's chosen language. */
export function receiptMessage(receipt: Receipt, company: CompanyProfile, t: Translate): string {
  const line = '------------------------------';
  return [
    `*${company.company_name} – ${t('receipt', 'Receipt')}*`,
    line,
    `${t('receiptNo', 'Receipt No')}: ${receipt.receipt_number}`,
    `${t('date', 'Date')}: ${formatDateTime(receipt.created_at)}`,
    `${t('customer', 'Customer')}: ${receipt.customer_name}`,
    receipt.shop_name ? `${t('shop', 'Shop')}: ${receipt.shop_name}` : '',
    line,
    `*${t('paidToday', 'Paid')}: ${formatCurrency(receipt.amount_paid)}* (${t(receipt.payment_mode, receipt.payment_mode)})`,
    `${t('balance', 'Balance')}: ${formatCurrency(receipt.remaining_balance)}`,
    `${t('collectedBy', 'Collected by')}: ${receipt.collector_name}`,
    line,
    [company.company_name, company.company_phone].filter(Boolean).join(' • '),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Opens WhatsApp with the message; 10-digit numbers get the India code. */
export function shareOnWhatsApp(phone: string | undefined, text: string) {
  const digits = (phone || '').replace(/\D/g, '');
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  const url = withCountry
    ? `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}
