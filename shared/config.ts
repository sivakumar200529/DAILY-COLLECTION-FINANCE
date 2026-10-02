// Runtime configuration stored in the data file (db.config) and editable from the
// admin Configuration screen. Shared by server and client so both read the same shape.

export interface LoanProduct {
  id: string;
  name: string;
  description?: string;
  margin_percentage: number;
  /** Collection periods offered by this product; the first entry is not special. */
  day_options: number[];
  default_days: number;
  /** 0 means no limit. */
  min_amount: number;
  max_amount: number;
  /** When false, margin / days / daily amount must match the product exactly. */
  allow_overrides: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface DefaultLocation {
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export interface MasterLists {
  payment_modes: string[];
  default_payment_mode: string;
  /** Choices offered when a collector marks a customer as "Not paid". */
  not_paid_reasons: string[];
  /** A loan counts as "not paying" once it is this many days behind its schedule. */
  not_paying_after_days: number;
  default_location: DefaultLocation;
}

export interface NumberingRule {
  prefix: string;
  include_year: boolean;
  pad: number;
  next: number;
}

export type NumberingKind = 'customer' | 'account' | 'receipt' | 'collector' | 'area';
export type Numbering = Record<NumberingKind, NumberingRule>;

export interface CompanyProfile {
  company_name: string;
  company_tagline: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo?: string;
  currency: string;
  notifications_enabled: boolean;
}

export interface AppConfig {
  company: CompanyProfile;
  loan_products: LoanProduct[];
  masters: MasterLists;
  numbering: Numbering;
}

export type ConfigSection = keyof AppConfig;
export const CONFIG_SECTIONS: ConfigSection[] = ['company', 'loan_products', 'masters', 'numbering'];

/** Starting values for a data file that has no config block yet. Editable afterwards. */
export const DEFAULT_CONFIG: AppConfig = {
  company: {
    company_name: 'DAILY COLLECTION',
    company_tagline: 'Daily Collection System',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_logo: '',
    currency: '₹',
    notifications_enabled: true,
  },
  loan_products: [
    {
      id: 'PROD-FLEX',
      name: 'Flexible Daily Loan',
      description: 'Any amount within limits; choose the collection period.',
      margin_percentage: 12,
      day_options: [30, 50, 60, 90, 100, 120],
      default_days: 100,
      min_amount: 1000,
      max_amount: 500000,
      allow_overrides: true,
      status: 'ACTIVE',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  masters: {
    payment_modes: ['Cash', 'UPI'],
    default_payment_mode: 'Cash',
    not_paid_reasons: ['Shop closed', 'No money today', 'Asked to come later', 'Customer not there'],
    not_paying_after_days: 3,
    default_location: { area: '', city: '', district: '', state: '', pincode: '' },
  },
  numbering: {
    customer: { prefix: 'DC', include_year: false, pad: 5, next: 10001 },
    account: { prefix: 'ACC-', include_year: true, pad: 3, next: 1 },
    receipt: { prefix: 'DC-REC-', include_year: true, pad: 5, next: 1 },
    collector: { prefix: 'COL', include_year: false, pad: 3, next: 101 },
    area: { prefix: 'AREA', include_year: false, pad: 3, next: 101 },
  },
};

/** Renders an ID such as ACC-2026-031 or DC10032 from a rule and a sequence number. */
export function formatId(rule: NumberingRule, seq: number, date: Date = new Date()): string {
  const year = rule.include_year ? `${date.getFullYear()}-` : '';
  return `${rule.prefix}${year}${String(seq).padStart(rule.pad, '0')}`;
}
