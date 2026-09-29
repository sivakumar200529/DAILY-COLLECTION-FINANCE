// DAILY COLLECTION - Comprehensive TypeScript Type Definitions

export type Role = 'ADMIN' | 'CUSTOMER' | 'COLLECTOR';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  name: string;
  phone: string;
  customer_id?: string;
  collector_id?: string;
  is_active: boolean;
  avatar?: string;
  created_at: string;
}

export type MaritalStatus = 'Married' | 'Single' | 'Other';
export type Gender = 'Male' | 'Female' | 'Other';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface CustomerPersonalDetails {
  id: string; // e.g. DC10001
  full_name: string;
  profile_photo?: string;
  gender: Gender;
  dob: string;
  father_or_husband_name: string;
  mother_name: string;
  marital_status: MaritalStatus;
  mobile_number: string;
  alternate_number?: string;
  whatsapp_number?: string;
  email?: string;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  door_number: string;
  street: string;
  area: string;
  village_or_town: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  landmark: string;
}

export type BusinessStatus = 'ACTIVE' | 'CLOSED' | 'TEMPORARY_SHUT';

export interface BusinessDetails {
  id: string; // Shop ID e.g. SHP1001
  customer_id: string;
  shop_name: string;
  owner_name: string;
  business_type: string; // Retail, Wholesale, Grocery, Textile, Hardware, etc.
  business_category: string;
  shop_mobile: string;
  shop_address: string;
  shop_area: string;
  shop_city: string;
  shop_district: string;
  shop_pincode: string;
  landmark: string;
  years_in_business: number;
  approx_monthly_income: number;
  approx_daily_sales: number;
  business_status: BusinessStatus;
  shop_photo?: string;
  business_proof?: string;
}

export type DocumentType =
  | 'Aadhaar Card'
  | 'PAN Card'
  | 'Driving Licence'
  | 'Voter ID'
  | 'Passport'
  | 'Address Proof'
  | 'Bank Passbook'
  | 'Bank Statement'
  | 'Business Proof'
  | 'Shop Licence'
  | 'Customer Photo'
  | 'Signature'
  | 'Other Documents';

export type VerificationStatus = 'Pending Verification' | 'Verified' | 'Rejected';

export interface CustomerDocument {
  id: string;
  customer_id: string;
  document_type: DocumentType;
  document_number: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  upload_date: string;
  uploaded_by: string;
  verification_status: VerificationStatus;
  remarks?: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface CollectionPlan {
  id: string;
  plan_name: string;
  requested_amount: number; // e.g. 10,000
  disbursed_amount: number; // e.g. 8,800
  daily_collection: number; // e.g. 100
  collection_days: number;  // e.g. 100
  total_repayment: number;  // e.g. 10,000 (Daily * Days)
  finance_margin: number;   // e.g. 1,200 (Total Repayment - Disbursed)
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
  created_at: string;
}

export type CollectionAccountStatus = 'ACTIVE' | 'COMPLETED' | 'OVERDUE' | 'PENDING' | 'CANCELLED';

export interface CollectionAccount {
  id: string; // e.g. ACC-2026-001
  customer_id: string;
  customer_name: string;
  shop_name?: string;
  plan_id: string;
  plan_name: string;
  requested_amount: number;
  disbursed_amount: number;
  daily_collection: number;
  collection_days: number;
  total_repayment: number;
  finance_margin: number;
  start_date: string;
  expected_end_date: string;
  actual_completion_date?: string;
  amount_collected: number;
  remaining_amount: number;
  completed_days: number;
  remaining_days: number;
  collection_percentage: number;
  assigned_collector_id: string;
  assigned_collector_name: string;
  collection_area: string;
  status: CollectionAccountStatus;
  created_at: string;
  updated_at: string;
}

export type PaymentMode = 'Cash' | 'Razorpay UPI' | 'Razorpay NetBanking' | 'UPI' | 'Bank Transfer' | 'Other';
export type DailyCollectionStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'MISSED' | 'ADVANCE';

export interface DailyCollectionRecord {
  id: string;
  collection_account_id: string;
  customer_id: string;
  customer_name: string;
  shop_name: string;
  mobile_number: string;
  date: string; // YYYY-MM-DD
  daily_due: number;
  paid_amount: number;
  pending_amount: number;
  advance_amount: number;
  status: DailyCollectionStatus;
  payment_mode?: PaymentMode;
  collector_id: string;
  collector_name: string;
  collection_area: string;
  reason?: string;
  remarks?: string;
  receipt_id?: string;
  receipt_number?: string;
  balance_remaining: number;
  route_order?: number;
  missed_days_count?: number;
  missed_amount?: number;
}

export interface PaymentTransaction {
  id: string;
  receipt_number: string;
  collection_account_id: string;
  customer_id: string;
  customer_name: string;
  shop_name: string;
  collection_date: string;
  daily_due: number;
  amount_paid: number;
  advance_amount: number;
  payment_mode: PaymentMode;
  collector_id: string;
  collector_name: string;
  previous_balance: number;
  remaining_balance: number;
  status: 'SUCCESS' | 'PARTIAL' | 'ADVANCE';
  transaction_ref?: string;
  remarks?: string;
  created_at: string;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  payment_id: string;
  collection_account_id: string;
  customer_id: string;
  customer_name: string;
  shop_name: string;
  daily_due: number;
  amount_paid: number;
  payment_mode: string;
  transaction_ref?: string;
  previous_balance: number;
  remaining_balance: number;
  collector_name: string;
  date: string;
  created_at: string;
  remarks?: string;
}

export interface Collector {
  id: string; // COL101
  name: string;
  photo?: string;
  mobile: string;
  email: string;
  address: string;
  assigned_area: string;
  joining_date: string;
  target_amount: number;
  status: 'ACTIVE' | 'INACTIVE';
  today_customers_count?: number;
  today_collected_amount?: number;
  monthly_collected_amount?: number;
}

export interface Area {
  id: string; // AREA101
  area_name: string;
  city: string;
  district: string;
  pincode: string;
  assigned_collector_id: string;
  assigned_collector_name: string;
  customer_count: number;
}

export interface Notification {
  id: string;
  recipient_role: Role;
  customer_id?: string;
  title: string;
  message: string;
  type: 'PAYMENT' | 'MISSED' | 'OVERDUE' | 'KYC' | 'ACCOUNT' | 'SYSTEM';
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user: string;
  role: string;
  action: string;
  record_id: string;
  record_type: string;
  previous_value?: any;
  new_value?: any;
  timestamp: string;
}

export interface SystemSettings {
  company_name: string;
  company_tagline: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo?: string;
  receipt_prefix: string;
  currency: string;
  default_collection_days: number;
  default_payment_mode: PaymentMode;
  notifications_enabled: boolean;
}

// 360-degree aggregated Customer profile
export interface Customer360Profile {
  personal: CustomerPersonalDetails;
  address?: CustomerAddress;
  business?: BusinessDetails;
  accounts: CollectionAccount[];
  activeAccount?: CollectionAccount;
  recentPayments: PaymentTransaction[];
  receipts: Receipt[];
  documents: CustomerDocument[];
  notes: CustomerNote[];
  auditLogs: AuditLog[];
  metrics: {
    totalRequested: number;
    totalDisbursed: number;
    totalRepayment: number;
    totalCollected: number;
    totalRemaining: number;
    completedDays: number;
    remainingDays: number;
    overallPercentage: number;
    missedCount: number;
    overdueDays: number;
  };
}

// Dashboard statistics
export interface DashboardStats {
  totalCustomers: number;
  activeAccounts: number;
  todayExpected: number;
  todayCollected: number;
  todayPending: number;
  todayCollectionRate: number;
  monthlyCollection: number;
  totalOutstanding: number;
  totalFinanceMargin: number;
  totalDisbursed: number;
  totalRepayment: number;
  overdueCustomersCount: number;
}

export interface DashboardCharts {
  dailyTrend: { date: string; expected: number; collected: number; pending: number }[];
  monthlyTrend: { month: string; target: number; collected: number; disbursed: number }[];
  paymentStatusDistribution: { name: string; value: number; color: string }[];
  financeSummary: { name: string; amount: number; fill: string }[];
  areaPerformance: { area: string; collected: number; target: number }[];
}

// Monthly Excel Report row format
export interface MonthlyReportRow {
  customerId: string;
  customerName: string;
  mobile: string;
  shopName: string;
  shopAddress: string;
  area: string;
  collector: string;
  collectionAccountId: string;
  requestedAmount: number;
  disbursedAmount: number;
  dailyCollection: number;
  collectionDays: number;
  totalRepayment: number;
  financeMargin: number;
  amountCollected: number;
  remainingAmount: number;
  startDate: string;
  endDate: string;
  completedDays: number;
  remainingDays: number;
  status: string;
  dailyCollections: { [day: number]: number }; // day 1 to 31 -> amount collected
  monthlyTotal: number;
  expectedMonthlyCollection: number;
  actualMonthlyCollection: number;
  monthlyPending: number;
  collectionPercentage: number;
}

export interface MonthlyReportData {
  month: number; // 1-12
  year: number;
  monthName: string;
  daysInMonth: number;
  rows: MonthlyReportRow[];
  totals: {
    requested: number;
    disbursed: number;
    totalRepayment: number;
    financeMargin: number;
    monthlyTotal: number;
    expectedMonthly: number;
    actualMonthly: number;
    monthlyPending: number;
    collectionPercentage: number;
    dailyTotals: { [day: number]: number };
  };
}
