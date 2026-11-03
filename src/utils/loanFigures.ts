import type { CollectionAccount } from '../types';
import { TermProgress, termProgress, todayIso } from '../../shared/finance';

/** The four figures shown to customers: on their main screen, in the passbook and on the PDF statement. */
export interface LoanFigures {
  total: number;
  principal: number;
  interest: number;
  /** Still to pay of each part; null until the way payments split between them is decided. */
  pending: { principal: number; interest: number } | null;
  terms: TermProgress;
}

/**
 * How much of the principal and interest is still pending. The way a payment is split between
 * the two has not been decided yet, so for now only the totals are shown (returns null).
 */
function pendingSplit(_loan: CollectionAccount): LoanFigures['pending'] {
  return null;
}

export function loanFigures(loan: CollectionAccount, today: string = todayIso()): LoanFigures {
  return {
    total: loan.total_repayment,
    principal: loan.disbursed_amount,
    interest: loan.finance_margin,
    pending: pendingSplit(loan),
    terms: termProgress(loan, today),
  };
}

/** Money of the pending terms, never more than what is still owed. */
export function amountBehind(loan: Pick<CollectionAccount, 'days_behind' | 'daily_collection' | 'remaining_amount'>): number {
  return Math.min((loan.days_behind ?? 0) * loan.daily_collection, loan.remaining_amount);
}
