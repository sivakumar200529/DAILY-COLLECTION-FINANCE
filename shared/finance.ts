// Single source of truth for loan money calculations.
// Imported by both the Express server and the React client, so the preview a user
// sees is always computed exactly the way the server stores it.

import type { LoanProduct } from './config';

export function roundMoney(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/** Today's date (YYYY-MM-DD) in the machine's local timezone, not UTC. */
export function todayIso(date: Date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Adds whole calendar days to a YYYY-MM-DD date using UTC math (no timezone drift). */
export function addDaysIso(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Day 1 is the start date, so day N is start + (N - 1). */
export function calculateEndDate(startDateStr: string, collectionDays: number): string {
  if (!startDateStr || collectionDays <= 0) return startDateStr || '';
  return addDaysIso(startDateStr, collectionDays - 1);
}

/** Calendar dates for day 1..N of a collection schedule. */
export function scheduleDates(startDateStr: string, collectionDays: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < collectionDays; i++) dates.push(addDaysIso(startDateStr, i));
  return dates;
}

export interface LoanTerms {
  requested_amount: number;
  margin_percentage: number;
  collection_days: number;
  /** Set only when the daily amount is entered manually; otherwise it is derived. */
  daily_collection?: number;
  start_date: string;
}

export interface LoanCalculation {
  requested_amount: number;
  margin_percentage: number;
  margin_amount: number;
  disbursed_amount: number;
  total_repayment: number;
  daily_collection: number;
  collection_days: number;
  start_date: string;
  expected_end_date: string;
}

/**
 * Business model: the customer repays the requested amount in daily instalments;
 * the margin is deducted up front from what is handed over.
 */
export function calculateLoan(terms: LoanTerms): LoanCalculation {
  const amount = Number(terms.requested_amount) || 0;
  const marginPct = Number(terms.margin_percentage) || 0;
  const days = Math.max(0, Math.floor(Number(terms.collection_days) || 0));
  const marginAmount = roundMoney(amount * (marginPct / 100));
  const totalRepayment = amount;
  const autoDaily = days > 0 ? roundMoney(totalRepayment / days) : 0;
  const daily = terms.daily_collection !== undefined && terms.daily_collection !== null
    ? Number(terms.daily_collection)
    : autoDaily;

  return {
    requested_amount: amount,
    margin_percentage: marginPct,
    margin_amount: marginAmount,
    disbursed_amount: roundMoney(amount - marginAmount),
    total_repayment: totalRepayment,
    daily_collection: daily,
    collection_days: days,
    start_date: terms.start_date,
    expected_end_date: calculateEndDate(terms.start_date, days),
  };
}

export type OverridableField = 'margin_percentage' | 'collection_days' | 'daily_collection';

export interface LoanOverride {
  field: OverridableField;
  product_value: number;
  applied_value: number;
}

/** A broken loan rule, as a code the screens can translate. */
export type LoanIssueCode =
  | 'NO_PRODUCT'
  | 'PRODUCT_INACTIVE'
  | 'AMOUNT_ZERO'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'DAYS_ZERO'
  | 'MARGIN_RANGE'
  | 'DAILY_ZERO'
  | 'NO_START'
  | 'OVERRIDES_NOT_ALLOWED'
  | 'NO_AREA'
  | 'NO_COLLECTOR';

export interface LoanIssue {
  code: LoanIssueCode;
  product?: string;
  limit?: number;
}

/** English wording of a loan rule (used by the server and as the translation fallback). */
export function describeLoanIssue(issue: LoanIssue): string {
  switch (issue.code) {
    case 'NO_PRODUCT': return 'Select a loan type.';
    case 'PRODUCT_INACTIVE': return `Loan type "${issue.product}" is switched off.`;
    case 'AMOUNT_ZERO': return 'Enter the loan amount.';
    case 'BELOW_MIN': return `The amount must be at least {limit} for "${issue.product}".`;
    case 'ABOVE_MAX': return `The amount must not be more than {limit} for "${issue.product}".`;
    case 'DAYS_ZERO': return 'Enter the number of days.';
    case 'MARGIN_RANGE': return 'Interest % must be between 0 and 100.';
    case 'DAILY_ZERO': return 'Daily payment must be more than zero.';
    case 'NO_START': return 'Choose the start date.';
    case 'OVERRIDES_NOT_ALLOWED': return `"${issue.product}" does not allow changing its terms.`;
    case 'NO_AREA': return 'Choose the area.';
    case 'NO_COLLECTOR': return 'Choose the collector.';
  }
}

export interface LoanEvaluation {
  calculation: LoanCalculation;
  overrides: LoanOverride[];
  issues: LoanIssue[];
  /** English sentences for the issues (server messages). */
  errors: string[];
}

/**
 * Checks loan terms against the chosen product: which values deviate from the product
 * (overrides) and which rules are broken (errors). Used for the live form preview and
 * enforced again on the server.
 */
export function evaluateLoan(product: LoanProduct | undefined, terms: LoanTerms): LoanEvaluation {
  const calculation = calculateLoan(terms);
  const issues: LoanIssue[] = [];
  const overrides: LoanOverride[] = [];
  const done = (): LoanEvaluation => ({
    calculation,
    overrides,
    issues,
    errors: issues.map(i => describeLoanIssue(i).replace('{limit}', String(i.limit ?? ''))),
  });

  if (!product) {
    issues.push({ code: 'NO_PRODUCT' });
    return done();
  }
  if (product.status !== 'ACTIVE') issues.push({ code: 'PRODUCT_INACTIVE', product: product.name });

  if (!(calculation.requested_amount > 0)) issues.push({ code: 'AMOUNT_ZERO' });
  if (product.min_amount > 0 && calculation.requested_amount < product.min_amount) {
    issues.push({ code: 'BELOW_MIN', product: product.name, limit: product.min_amount });
  }
  if (product.max_amount > 0 && calculation.requested_amount > product.max_amount) {
    issues.push({ code: 'ABOVE_MAX', product: product.name, limit: product.max_amount });
  }
  if (!(calculation.collection_days > 0)) issues.push({ code: 'DAYS_ZERO' });
  if (calculation.margin_percentage < 0 || calculation.margin_percentage >= 100) issues.push({ code: 'MARGIN_RANGE' });
  if (!(calculation.daily_collection > 0)) issues.push({ code: 'DAILY_ZERO' });
  if (!terms.start_date) issues.push({ code: 'NO_START' });

  if (calculation.margin_percentage !== product.margin_percentage) {
    overrides.push({ field: 'margin_percentage', product_value: product.margin_percentage, applied_value: calculation.margin_percentage });
  }
  if (!product.day_options.includes(calculation.collection_days)) {
    overrides.push({ field: 'collection_days', product_value: product.default_days, applied_value: calculation.collection_days });
  }
  const autoDaily = calculateLoan({ ...terms, daily_collection: undefined }).daily_collection;
  if (terms.daily_collection !== undefined && terms.daily_collection !== null && Number(terms.daily_collection) !== autoDaily) {
    overrides.push({ field: 'daily_collection', product_value: autoDaily, applied_value: calculation.daily_collection });
  }
  if (overrides.length > 0 && !product.allow_overrides) {
    issues.push({ code: 'OVERRIDES_NOT_ALLOWED', product: product.name });
  }

  return done();
}

