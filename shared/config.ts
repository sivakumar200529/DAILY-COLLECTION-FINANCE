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
  /** A customer is "long pending" (long standing) once this many terms are pending. */
  long_pending_after_terms: number;
  /** How many times a collector may send the day's report; corrections after that need office approval. */
  report_send_limit: number;
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
  opening_balance?: number;
  /** UPI ID customers and collectors pay to (shown as a QR code). Empty = online payment not set up. */
  upi_id?: string;
  /** Name shown in the customer's UPI app; defaults to company_name. */
  upi_name?: string;
  /** The startup setup was finished; until then a new installation opens it after login. */
  setup_completed?: boolean;
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
    long_pending_after_terms: 2,
    report_send_limit: 2,
    default_location: { city: '', district: '', state: '', pincode: '' },
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

// ---- Logo ----
// The logo is stored with the settings as a small picture (resized on upload), so it works offline and in prints.
export const LOGO_MAX_CHARS = 300_000;
export const isLogoData = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= LOGO_MAX_CHARS && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v);

// ---- Payment modes ----
// The office lists its own modes in Settings. "Others" is always offered as well, for a payment made
// some other way; it then carries a short description of how it was paid.

export const OTHER_MODE = 'Others';
export const MODE_NOTE_MAX = 80;

const sameMode = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const isOtherMode = (mode?: string): boolean => !!mode && sameMode(mode, OTHER_MODE);
/** Only the mode named UPI shows the QR code and the UPI ID. */
export const isUpiMode = (mode?: string): boolean => !!mode && sameMode(mode, 'UPI');
export const upiOffered = (modes: string[]): boolean => modes.some(isUpiMode);

/** The modes to choose from: the ones in Settings, then "Others". */
export function modeChoices(modes: string[]): string[] {
  return [...modes.filter(m => !isOtherMode(m)), OTHER_MODE];
}

/** How a payment's mode reads on screens and receipts, e.g. "Others (Cheque 123456)". */
export function modeText(mode?: string, note?: string, translate: (m: string) => string = m => m): string {
  const name = translate(mode || 'Cash');
  return note && note.trim() ? `${name} (${note.trim()})` : name;
}
