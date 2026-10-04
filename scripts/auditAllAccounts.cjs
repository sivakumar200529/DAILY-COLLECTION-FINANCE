const path = require('path');
const d = require(path.resolve(__dirname, '../krs_finance_data.json'));
let issues = 0;
d.collection_accounts.forEach(acc => {
  const payments = d.payments.filter(p => p.collection_account_id === acc.id && p.status !== 'CANCELLED');
  const sumPaid = payments.reduce((s, p) => s + p.amount_paid, 0);
  const expectedRemaining = acc.total_repayment - sumPaid;
  const expectedDays = Math.floor(sumPaid / acc.daily_collection);

  const hasMismatch = sumPaid !== acc.amount_collected ||
                      expectedRemaining !== acc.remaining_amount ||
                      expectedDays !== acc.completed_days;

  if (hasMismatch) {
    issues++;
    console.log(`MISMATCH in account ${acc.id} (${acc.customer_name}):`, {
      total: acc.total_repayment,
      daily: acc.daily_collection,
      collected: acc.amount_collected,
      sumPaid,
      remaining: acc.remaining_amount,
      expectedRemaining,
      completedDays: acc.completed_days,
      expectedDays,
      paymentsCount: payments.length
    });
  }
});

if (issues === 0) {
  console.log('ALL collection accounts have 100% matched collections, balances, and days!');
} else {
  console.log(`Found ${issues} accounts with discrepancies.`);
}
