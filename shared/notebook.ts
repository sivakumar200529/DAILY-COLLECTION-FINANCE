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
