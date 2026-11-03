// Things customers ask the office for, kept until the office acts on them.

/**
 * A customer says they paid by UPI. The office checks the bank account, then records the payment
 * (RECORDED) or tells the customer it was not found (NOT_RECEIVED).
 */
export type PaymentClaimStatus = 'PENDING' | 'RECORDED' | 'NOT_RECEIVED';

export interface PaymentClaim {
  id: string;
  customer_id: string;
  customer_name: string;
  shop_name?: string;
  /** The customer's running loan when they sent it. */
  collection_account_id?: string;
  amount: number;
  upi_reference?: string;
  status: PaymentClaimStatus;
  created_at: string;
  decided_by?: string;
  decided_at?: string;
  /** Receipt of the payment the office recorded. */
  receipt_number?: string;
}
