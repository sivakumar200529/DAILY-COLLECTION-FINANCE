import { KRSFinanceDatabase, CollectionAccount, DailyCollectionRecord, Collector, CustomerPersonalDetails, nextId } from './db.ts';
import { evaluateLoan, scheduleDates, todayIso, LoanCalculation, LoanOverride } from '../shared/finance.ts';
import { LoanProduct } from '../shared/config.ts';

export interface IssueLoanInput {
  customer_id?: string;
  product_id: string;
  requested_amount: number;
  margin_percentage?: number;
  collection_days?: number;
  /** Only when the daily amount was entered manually. */
  daily_collection?: number;
  start_date?: string;
  assigned_collector_id?: string;
  collection_area?: string;
}

/** What the loan needs to know about the borrower; the customer may not be saved yet. */
export interface LoanParty {
  shop_name?: string;
  shop_area?: string;
  home_area?: string;
}

export interface PlannedLoan {
  product: LoanProduct;
  calculation: LoanCalculation;
  overrides: LoanOverride[];
  collector: Collector;
  area: string;
}

export class LoanValidationError extends Error {}

function optionalNumber(v: unknown): number | undefined {
  return v === undefined || v === null || v === '' ? undefined : Number(v);
}

/** Validates loan terms against the product and resolves area/collector. Does not modify the database. */
export function planLoan(db: KRSFinanceDatabase, input: IssueLoanInput, party: LoanParty): PlannedLoan {
  const product = db.config.loan_products.find(p => p.id === input.product_id);
  const { calculation, overrides, errors } = evaluateLoan(product, {
    requested_amount: Number(input.requested_amount),
    margin_percentage: optionalNumber(input.margin_percentage) ?? product?.margin_percentage ?? 0,
    collection_days: optionalNumber(input.collection_days) ?? product?.default_days ?? 0,
    daily_collection: optionalNumber(input.daily_collection),
    start_date: input.start_date || todayIso(),
  });
  if (errors.length > 0) throw new LoanValidationError(errors.join(' '));

  const area = input.collection_area || party.shop_area || party.home_area || db.config.masters.default_location.area;
  if (!area) throw new LoanValidationError('Select a collection area.');
  const areaRecord = db.areas.find(a => a.area_name === area);
  const collectorId = input.assigned_collector_id || areaRecord?.assigned_collector_id;
  const collector = db.collectors.find(c => c.id === collectorId);
  if (!collector) throw new LoanValidationError('Assign a collector (none is set for this area).');

  return { product: product!, calculation, overrides, collector, area };
}

/** Writes the collection account and its full day-by-day schedule. */
export function commitLoan(
  db: KRSFinanceDatabase,
  planned: PlannedLoan,
  customer: Pick<CustomerPersonalDetails, 'id' | 'full_name' | 'mobile_number'>,
  party: LoanParty
): CollectionAccount {
  const { product, calculation, overrides, collector, area } = planned;
  const accId = nextId(db, 'account', db.collection_accounts.map(a => a.id));
  const now = new Date().toISOString();
  const shopName = party.shop_name || customer.full_name;

  const account: CollectionAccount = {
    id: accId,
    customer_id: customer.id,
    customer_name: customer.full_name,
    shop_name: shopName,
    plan_id: product.id,
    plan_name: product.name,
    requested_amount: calculation.requested_amount,
    margin_percentage: calculation.margin_percentage,
    margin_amount: calculation.margin_amount,
    disbursed_amount: calculation.disbursed_amount,
    daily_collection: calculation.daily_collection,
    collection_days: calculation.collection_days,
    total_repayment: calculation.total_repayment,
    finance_margin: calculation.margin_amount,
    start_date: calculation.start_date,
    expected_end_date: calculation.expected_end_date,
    amount_collected: 0,
    remaining_amount: calculation.total_repayment,
    completed_days: 0,
    remaining_days: calculation.collection_days,
    collection_percentage: 0,
    assigned_collector_id: collector.id,
    assigned_collector_name: collector.name,
    collection_area: area,
    status: 'ACTIVE',
    ...(overrides.length > 0 ? { overrides } : {}),
    created_at: now,
    updated_at: now,
  };
  db.collection_accounts.push(account);

  scheduleDates(calculation.start_date, calculation.collection_days).forEach((dateStr, i) => {
    const record: DailyCollectionRecord = {
      id: `DC-${dateStr}-${accId}`,
      collection_account_id: accId,
      customer_id: customer.id,
      customer_name: customer.full_name,
      shop_name: shopName,
      mobile_number: customer.mobile_number,
      collection_day_number: i + 1,
      calendar_date: dateStr,
      date: dateStr,
      daily_due: calculation.daily_collection,
      due_amount: calculation.daily_collection,
      paid_amount: 0,
      pending_amount: calculation.daily_collection,
      advance_amount: 0,
      status: 'PENDING',
      collector_id: collector.id,
      collector_name: collector.name,
      collection_area: area,
      remarks: 'Scheduled collection day',
      balance_remaining: calculation.total_repayment,
    };
    db.daily_collections.push(record);
  });

  return account;
}

/** Issues a loan to an existing customer. */
export function createLoanAccount(db: KRSFinanceDatabase, input: IssueLoanInput): CollectionAccount {
  const customer = db.customers.find(c => c.id === input.customer_id);
  if (!customer) throw new LoanValidationError('Valid customer is required.');
  const biz = db.business_details.find(b => b.customer_id === customer.id);
  const addr = db.customer_addresses.find(a => a.customer_id === customer.id);
  const party: LoanParty = { shop_name: biz?.shop_name, shop_area: biz?.shop_area, home_area: addr?.area };
  return commitLoan(db, planLoan(db, input, party), customer, party);
}
