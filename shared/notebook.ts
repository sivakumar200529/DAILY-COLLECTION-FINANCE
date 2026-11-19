// The notebook page: loans down the side, the days of a chosen period across the top, and each
// day's amount in its cell, as in the office's paper collection notebook.

/** One loan's line in the notebook. */
export interface NotebookRow {
  account_id: string;
  customer_id: string;
  customer_name: string;
  shop_name: string;
  area: string;
  collector_id: string;
  collector_name: string;
  requested_amount: number;
  total_repayment: number;
  daily_collection: number;
  start_date: string;
  end_date: string;
  status: string;
  /** Balance now (after every payment, also those after the period). */
  balance: number;
  /** Paid by each day of the period that has a payment. */
  cells: Record<string, { amount: number; payment_id: string }>;
}

export interface NotebookPage {
  from: string;
  to: string;
  today: string;
  /** Days of the period whose business was closed (no changes until reopened). */
  closed_dates: string[];
  /** The closings behind them, so a day can be reopened from the notebook. */
  closings: { id: string; date: string; closed_by: string }[];
  rows: NotebookRow[];
}

/** A cell as typed: the day's amount (0 clears a recorded payment). */
export interface NotebookChange {
  account_id: string;
  date: string;
  amount: number;
}

export interface NotebookCellError extends NotebookChange {
  error: string;
}

/** Longest period one page shows. */
export const NOTEBOOK_MAX_DAYS = 92;

// ---------------------------------------------------------------------------------------------
// A new sheet from a notebook card: the card's terms (start, total loan, daily, end) are the same
// for every row; each row is one customer and their amount on each day from start to end.

/** Longest loan a card sheet covers (one column per day). */
export const CARD_MAX_DAYS = 400;

export interface CardSheetRow {
  /** An existing customer; otherwise a new one is added from the name and mobile number. */
  customer_id?: string;
  name: string;
  mobile: string;
  area: string;
  /** Optional, and not taken from the area: collectors move between areas. */
  collector_id?: string;
  /** Amount paid on each day (YYYY-MM-DD); empty days are left out. */
  payments: Record<string, number>;
}

export interface CardSheetInput {
  product_id: string;
  start_date: string;
  end_date: string;
  /** Total loan (கடன் தொகை), what the customer repays. */
  total: number;
  /** Payment per day (தினத்தவணை தொகை). */
  daily: number;
  rows: CardSheetRow[];
}

/** What is wrong with a row (row is 0-based); with a date, with that day's cell. */
export interface CardSheetError {
  row: number;
  date?: string;
  error: string;
}

export interface CardSheetResult {
  customers_added: number;
  loans: { customer_id: string; customer_name: string; account_id: string }[];
  payments: number;
}

/** Days from start to end, both counted. */
export function cardDays(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}
