const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'krs_finance_data.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('--- BEFORE ADJUSTMENT ---');
const acc = db.collection_accounts.find(a => a.id === 'ACC-2026-001');
console.log('Account ACC-2026-001:', {
  amount_collected: acc.amount_collected,
  remaining_amount: acc.remaining_amount,
  completed_days: acc.completed_days,
  remaining_days: acc.remaining_days,
});

// 1. Find payment on 2026-08-10 for ACC-2026-001
const targetPayment = db.payments.find(p => p.collection_account_id === 'ACC-2026-001' && p.collection_date === '2026-08-10');
if (targetPayment) {
  console.log('Found 2026-08-10 payment:', targetPayment.amount_paid, targetPayment.advance_amount);
  targetPayment.amount_paid = 100;
  targetPayment.advance_amount = 0;
  targetPayment.status = 'SUCCESS';
  targetPayment.remarks = 'Daily collection installment';
}

// 2. Recalculate all payments for ACC-2026-001 chronologically
const accPayments = db.payments
  .filter(p => p.collection_account_id === 'ACC-2026-001' && p.status !== 'CANCELLED')
  .sort((a, b) => a.collection_date.localeCompare(b.collection_date) || (a.created_at || '').localeCompare(b.created_at || ''));

let currentBalance = acc.total_repayment; // 10000
accPayments.forEach((p, idx) => {
  p.previous_balance = currentBalance;
  currentBalance = currentBalance - p.amount_paid;
  p.remaining_balance = currentBalance;
});

console.log(`Re-balanced ${accPayments.length} payments. Final remaining balance: ${currentBalance}`);

// 3. Update receipts for ACC-2026-001
const receiptMap = new Map();
accPayments.forEach(p => {
  if (p.receipt_number) {
    receiptMap.set(p.receipt_number, {
      amount_paid: p.amount_paid,
      previous_balance: p.previous_balance,
      remaining_balance: p.remaining_balance,
    });
  }
});

db.receipts.forEach(r => {
  if (r.collection_account_id === 'ACC-2026-001' && receiptMap.has(r.receipt_number)) {
    const updated = receiptMap.get(r.receipt_number);
    r.amount_paid = updated.amount_paid;
    r.previous_balance = updated.previous_balance;
    r.remaining_balance = updated.remaining_balance;
  }
});

// 4. Update daily_collections for ACC-2026-001
const dcRecord = db.daily_collections.find(d => d.collection_account_id === 'ACC-2026-001' && d.date === '2026-08-10');
if (dcRecord) {
  dcRecord.paid_amount = 100;
  dcRecord.advance_amount = 0;
  dcRecord.pending_amount = 0;
  dcRecord.status = 'PAID';
  dcRecord.remarks = 'Scheduled collection day';
}

// Update balance_remaining in all daily_collections for ACC-2026-001
const dcPaymentsMap = new Map();
accPayments.forEach(p => {
  dcPaymentsMap.set(p.collection_date, p.remaining_balance);
});

db.daily_collections.forEach(d => {
  if (d.collection_account_id === 'ACC-2026-001' && dcPaymentsMap.has(d.date)) {
    d.balance_remaining = dcPaymentsMap.get(d.date);
  }
});

// 5. Update collection_account ACC-2026-001
const totalPaid = accPayments.reduce((s, p) => s + p.amount_paid, 0);
acc.amount_collected = totalPaid;
acc.remaining_amount = acc.total_repayment - totalPaid;
acc.completed_days = Math.floor(totalPaid / acc.daily_collection);
acc.remaining_days = acc.collection_days - acc.completed_days;
acc.collection_percentage = Math.round((totalPaid / acc.total_repayment) * 100);

console.log('--- AFTER ADJUSTMENT ---');
console.log('Account ACC-2026-001:', {
  amount_collected: acc.amount_collected,
  remaining_amount: acc.remaining_amount,
  completed_days: acc.completed_days,
  remaining_days: acc.remaining_days,
  collection_percentage: acc.collection_percentage,
});

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('Successfully saved krs_finance_data.json!');
