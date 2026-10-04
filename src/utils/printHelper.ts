import { Receipt, CompanyProfile, Customer360Profile, CollectionAccount } from '../types';
import { formatCurrency, formatDate, formatDateTime } from './formatters';

type Translate = (key: string, fallback?: string) => string;

/**
 * Universal isolated iframe print engine:
 * Prints documents directly without CSS conflicts, dark mode bleeding,
 * or viewport clipping from modals / parent containers.
 */
export function printHtmlViaIframe(title: string, styles: string, bodyHtml: string) {
  // Remove any stale print iframes
  const oldIframe = document.getElementById('krs-print-engine');
  if (oldIframe) {
    oldIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'krs-print-engine';
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #ffffff !important;
            color: #111827 !important;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          ${styles}
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
    </html>
  `);
  doc.close();

  // Allow styles & fonts to render before triggering print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Iframe print error, falling back to window.print():', e);
      window.print();
    }
    // Cleanup after user closes print dialog
    setTimeout(() => {
      iframe.remove();
    }, 2000);
  }, 250);
}

/**
 * Prints a clean, professional receipt slip (80mm POS or A4).
 */
export function printReceiptSlip(receipt: Receipt, company: CompanyProfile, t: Translate) {
  const cancelled = receipt.status === 'CANCELLED';
  const companyName = company.company_name || 'DAILY COLLECTION FINANCE';
  const companyAddress = company.company_address || '';
  const companyPhone = company.company_phone || '';

  const styles = `
    @page {
      size: 80mm auto;
      margin: 4mm;
    }
    body {
      padding: 6px;
      font-size: 12px;
      max-width: 80mm;
      margin: 0 auto;
    }
    .receipt-box {
      border: 1px dashed #4b5563;
      padding: 12px;
      background: #ffffff;
      position: relative;
    }
    .header {
      text-align: center;
      padding-bottom: 8px;
      border-bottom: 1px dashed #9ca3af;
      margin-bottom: 8px;
    }
    .title {
      font-size: 15px;
      font-weight: 900;
      color: #000;
      text-transform: uppercase;
    }
    .subtitle {
      font-size: 11px;
      color: #4b5563;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .label {
      color: #4b5563;
    }
    .val {
      font-weight: 700;
      color: #111827;
      text-align: right;
    }
    .amount-box {
      text-align: center;
      padding: 10px 0;
      border-top: 1px dashed #9ca3af;
      border-bottom: 1px dashed #9ca3af;
      margin: 8px 0;
    }
    .amount-title {
      font-size: 11px;
      text-transform: uppercase;
      color: #4b5563;
      font-weight: 600;
    }
    .amount-num {
      font-size: 24px;
      font-weight: 900;
      color: #000;
      margin: 2px 0;
    }
    .badge-mode {
      font-size: 11px;
      font-weight: 600;
      color: #374151;
    }
    .balance-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 800;
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px solid #e5e7eb;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      color: #6b7280;
      margin-top: 10px;
      border-top: 1px dashed #9ca3af;
      padding-top: 6px;
    }
    .cancelled-watermark {
      position: absolute;
      top: 40%;
      left: 10%;
      right: 10%;
      border: 3px solid #dc2626;
      color: #dc2626;
      font-size: 22px;
      font-weight: 900;
      text-align: center;
      padding: 6px;
      transform: rotate(-15deg);
      background: rgba(255, 255, 255, 0.9);
    }
  `;

  const bodyHtml = `
    <div class="receipt-box">
      ${cancelled ? '<div class="cancelled-watermark">CANCELLED</div>' : ''}
      <div class="header">
        <div class="title">${companyName}</div>
        ${companyAddress ? `<div class="subtitle">${companyAddress}</div>` : ''}
        ${companyPhone ? `<div class="subtitle">Helpline: ${companyPhone}</div>` : ''}
      </div>

      <div class="row">
        <span class="label">Receipt No:</span>
        <span class="val font-mono">${receipt.receipt_number}</span>
      </div>
      <div class="row">
        <span class="label">Date:</span>
        <span class="val">${formatDateTime(receipt.created_at)}</span>
      </div>
      <div class="row">
        <span class="label">Customer:</span>
        <span class="val">${receipt.customer_name}</span>
      </div>
      ${receipt.shop_name ? `
        <div class="row">
          <span class="label">Shop:</span>
          <span class="val">${receipt.shop_name}</span>
        </div>
      ` : ''}

      <div class="amount-box">
        <div class="amount-title">Paid Amount</div>
        <div class="amount-num">${formatCurrency(receipt.amount_paid)}</div>
        <div class="badge-mode">Mode: ${receipt.payment_mode || 'Cash'}</div>
      </div>

      <div class="balance-row">
        <span>Balance Remaining:</span>
        <span>${formatCurrency(receipt.remaining_balance)}</span>
      </div>
      <div class="row" style="margin-top: 4px;">
        <span class="label">Collected By:</span>
        <span class="val">${receipt.collector_name}</span>
      </div>

      <div class="footer">
        Thank you for prompt repayment.<br />
        Authorized Computer Generated Receipt
      </div>
    </div>
  `;

  printHtmlViaIframe(`Receipt-${receipt.receipt_number}`, styles, bodyHtml);
}

/**
 * Prints a complete official passbook statement with full itemized transactions.
 */
export function printPassbookStatement(
  profile: Customer360Profile,
  account: CollectionAccount,
  company: CompanyProfile | null | undefined,
  t: Translate
) {
  const companyName = company?.company_name || 'DAILY COLLECTION FINANCE';
  const companyAddress = company?.company_address || 'Bazaar Street, Main Road, Tamil Nadu';
  const companyPhone = company?.company_phone || '+91 98422 10001';

  const payments = [...profile.recentPayments]
    .filter(p => p.status !== 'CANCELLED' && (!p.collection_account_id || p.collection_account_id === account.id))
    .sort((a, b) => a.collection_date.localeCompare(b.collection_date) || (a.created_at || '').localeCompare(b.created_at || ''));

  const styles = `
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    body {
      padding: 10px;
      font-size: 11px;
      color: #1f2937;
      background: #ffffff !important;
    }
    .statement-container {
      max-width: 210mm;
      margin: 0 auto;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #111827;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .company-title {
      font-size: 20px;
      font-weight: 900;
      color: #0b1f3a;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .company-sub {
      font-size: 11px;
      color: #4b5563;
      margin-top: 2px;
    }
    .doc-badge {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
      text-align: right;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .section-title {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .main-name {
      font-size: 14px;
      font-weight: 800;
      color: #111827;
    }
    .info-line {
      font-size: 11px;
      color: #374151;
      margin-top: 2px;
    }
    .terms-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      text-align: center;
      margin-bottom: 14px;
    }
    .term-card {
      border: 1px solid #e5e7eb;
      background: #ffffff;
      border-radius: 6px;
      padding: 8px;
    }
    .term-label {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      color: #6b7280;
    }
    .term-val {
      font-size: 14px;
      font-weight: 900;
      color: #111827;
      margin-top: 2px;
    }
    .summary-card {
      background: #0f172a;
      color: #ffffff;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .summary-top {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .progress-bar-bg {
      background: #334155;
      height: 8px;
      border-radius: 9999px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .progress-bar-fill {
      background: #10b981;
      height: 100%;
    }
    .summary-bottom {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-bottom: 16px;
    }
    th {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      padding: 6px 8px;
      font-weight: 800;
      text-align: left;
      color: #374151;
      text-transform: uppercase;
      font-size: 9.5px;
    }
    td {
      border: 1px solid #e5e7eb;
      padding: 6px 8px;
      color: #1f2937;
    }
    tr:nth-child(even) td {
      background: #fbfbfb;
    }
    .text-right {
      text-align: right;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .footer-box {
      border-top: 1px solid #d1d5db;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 9.5px;
      color: #6b7280;
    }
    .sign-box {
      text-align: right;
      font-weight: 700;
      color: #111827;
    }
  `;

  const rowsHtml = payments.length === 0
    ? `<tr><td colspan="6" style="text-align:center; padding: 12px; color: #6b7280;">No payments recorded yet.</td></tr>`
    : payments.map((p, idx) => {
        const bal = (p as any).remaining_balance !== undefined && (p as any).remaining_balance !== null
          ? (p as any).remaining_balance
          : Math.max(0, account.total_repayment - payments.slice(0, idx + 1).reduce((s, item) => s + item.amount_paid, 0));

        return `
          <tr>
            <td class="font-mono text-right" style="width: 30px;">${idx + 1}</td>
            <td>${formatDate(p.collection_date)}</td>
            <td class="font-mono" style="font-weight:700;">${p.receipt_number || '-'}</td>
            <td>${p.payment_mode || 'Cash'}</td>
            <td class="text-right font-mono" style="font-weight:800; color: #047857;">${formatCurrency(p.amount_paid)}</td>
            <td class="text-right font-mono" style="font-weight:800;">${formatCurrency(bal)}</td>
          </tr>
        `;
      }).join('');

  const bodyHtml = `
    <div class="statement-container">
      <div class="header-box">
        <div>
          <div class="company-title">${companyName}</div>
          <div class="company-sub">${companyAddress}</div>
          <div class="company-sub" style="font-weight: 600;">Helpline: ${companyPhone}</div>
        </div>
        <div style="text-align: right;">
          <div class="doc-badge">Official Passbook Statement</div>
          <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">
            Generated: ${formatDateTime(new Date().toISOString())}
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <div class="section-title">Customer &amp; Shop Profile</div>
          <div class="main-name">${profile.personal.full_name}</div>
          <div class="info-line" style="font-weight: 600;">${profile.business?.shop_name || 'Commercial Business'}</div>
          <div class="info-line">Mobile: <span class="font-mono">${profile.personal.mobile_number}</span></div>
          <div class="info-line" style="color: #6b7280;">Cust ID: ${profile.personal.id} &bull; Area: ${account.collection_area}</div>
        </div>

        <div style="text-align: right;">
          <div class="section-title">Loan Account Terms</div>
          <div class="main-name font-mono">A/C: ${account.id}</div>
          <div class="info-line">${account.plan_name} (${account.collection_days} Days)</div>
          <div class="info-line">Start: ${formatDate(account.start_date)} &bull; End: ${formatDate(account.expected_end_date)}</div>
          <div class="info-line" style="font-weight: 800; color: #047857;">Status: ${account.status}</div>
        </div>
      </div>

      <div class="terms-grid">
        <div class="term-card">
          <div class="term-label">Requested Amount</div>
          <div class="term-val font-mono">${formatCurrency(account.requested_amount)}</div>
        </div>
        <div class="term-card">
          <div class="term-label">Disbursed (Net)</div>
          <div class="term-val font-mono">${formatCurrency(account.disbursed_amount)}</div>
          <div style="font-size: 8.5px; color: #6b7280;">Margin: ${account.margin_percentage || 10}%</div>
        </div>
        <div class="term-card">
          <div class="term-label">Total Repayment</div>
          <div class="term-val font-mono" style="color: #1e3a8a;">${formatCurrency(account.total_repayment)}</div>
        </div>
        <div class="term-card">
          <div class="term-label">Daily Installment</div>
          <div class="term-val font-mono" style="color: #b45309;">${formatCurrency(account.daily_collection)}</div>
          <div style="font-size: 8.5px; color: #6b7280;">/ day</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-top">
          <span>Total Collected: <strong style="color: #34d399;">${formatCurrency(account.amount_collected)}</strong></span>
          <span>Balance Remaining: <strong style="color: #fde047;">${formatCurrency(account.remaining_amount)}</strong></span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, account.collection_percentage))}%;"></div>
        </div>
        <div class="summary-bottom">
          <span>${account.completed_days} of ${account.collection_days} installments completed</span>
          <span style="font-weight: 800; color: #fde047;">${account.collection_percentage}% Repaid</span>
          <span>${account.remaining_days} days remaining</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="text-right" style="width: 30px;">#</th>
            <th>Collection Date</th>
            <th>Receipt No</th>
            <th>Payment Mode</th>
            <th class="text-right">Amount Paid</th>
            <th class="text-right">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer-box">
        <div>
          <div><strong>Daily Collection Official Financial Statement</strong></div>
          <div>This is a computer-verified statement generated from the DAILY COLLECTION system.</div>
          <div>For questions, contact your collector (${account.assigned_collector_name}) or branch helpline.</div>
        </div>
        <div class="sign-box">
          <div>${companyName}</div>
          <div style="font-size: 9px; font-weight: normal; color: #6b7280; margin-top: 4px;">Authorized Seal &amp; System Record</div>
        </div>
      </div>
    </div>
  `;

  printHtmlViaIframe(`Passbook-Statement-${account.id}`, styles, bodyHtml);
}
