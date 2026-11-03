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
  // Rounded up to the paisa, so the schedule always covers the loan (the last day is simply smaller).
  const autoDaily = days > 0 ? Math.ceil(roundMoney((totalRepayment / days) * 100, 6)) / 100 : 0;
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
  | 'DAILY_TOO_LOW'
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
    case 'DAILY_TOO_LOW': return 'The daily payment for these days does not repay the loan amount. Raise the daily payment or the days.';
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
  else if (calculation.collection_days > 0 && roundMoney(calculation.daily_collection * calculation.collection_days) < calculation.total_repayment) {
    issues.push({ code: 'DAILY_TOO_LOW' });
  }
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


/** Days counted in terms of the daily amount, as shown on the customer's screen. */
export interface TermProgress {
  total: number;
  completed: number;
  pending: number;
  /** Days that should have been paid before today but were not covered by payments. */
  missed: number;
  /** Days paid beyond what is due up to and including today. */
  advance: number;
}

/**
 * Terms are worked out from money, not from individual day records, so part payments and
 * advance payments count correctly: completed = paid / daily amount. Today is never counted
 * as missed (the collector may still come), and a payment made today is not counted as advance.
 */
/** Whole days from one YYYY-MM-DD date to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

/** The first and last date of a YYYY-MM month. */
export function monthBounds(month: string): { start: string; end: string } {
  const [year, mon] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` };
}

/**
 * What a loan is expected to pay in a month: its daily amount for every day it is being collected in
 * that month (a loan past its end date is still collected until paid), never more than it still owed
 * when the month began. Money paid beyond that also counts as expected, so expected - paid is never
 * below zero. Home's month figures and the monthly register both use this.
 */
export function monthExpected(
  loan: { daily_collection: number; total_repayment: number; start_date: string; status: string; actual_completion_date?: string },
  paidBeforeMonth: number,
  paidInMonth: number,
  month: string
): number {
  const days = monthDueDays(loan, month);
  if (days === 0) return roundMoney(paidInMonth);
  const owedAtStart = Math.max(0, roundMoney(loan.total_repayment - paidBeforeMonth));
  return roundMoney(Math.max(paidInMonth, Math.min(loan.daily_collection * days, owedAtStart)));
}

/**
 * The days of a month a loan is due on: from its start (or the 1st) to the month's end, or to the day
 * it was paid off. A loan past its end date and still owing stays due every day.
 */
export function monthDueDays(
  loan: { start_date: string; status: string; actual_completion_date?: string },
  month: string
): number {
  const { start, end } = monthBounds(month);
  if (loan.status === 'CANCELLED' || loan.start_date > end) return 0;
  const from = loan.start_date > start ? loan.start_date : start;
  const until = loan.status === 'COMPLETED' && loan.actual_completion_date && loan.actual_completion_date < end
    ? loan.actual_completion_date
    : end;
  return Math.max(0, daysBetween(from, until) + 1);
}

/** Days left in the date's month: 0 on its last day. */
export function daysLeftInMonth(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate() - day;
}

export function termProgress(
  account: { collection_days: number; daily_collection: number; amount_collected: number; start_date: string; total_repayment?: number },
  today: string = todayIso()
): TermProgress {
  const total = account.collection_days;
  // A loan paid in full has every term done, even when the last day was smaller than the rest.
  const paidOff = account.total_repayment !== undefined && account.total_repayment > 0 &&
    roundMoney(account.amount_collected) >= roundMoney(account.total_repayment);
  const completed = paidOff
    ? total
    : account.daily_collection > 0
      ? Math.min(total, Math.floor(roundMoney(account.amount_collected / account.daily_collection, 6)))
      : 0;
  const daysBeforeToday = Math.round((Date.parse(today) - Date.parse(account.start_date)) / 86400000);
  const dueBeforeToday = Math.min(total, Math.max(0, daysBeforeToday));
  const dueIncludingToday = Math.min(total, Math.max(0, daysBeforeToday + 1));
  return {
    total,
    completed,
    pending: total - completed,
    missed: Math.max(0, dueBeforeToday - completed),
    advance: Math.max(0, completed - dueIncludingToday),
  };
}
