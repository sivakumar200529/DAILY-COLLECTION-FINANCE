import {
  User,
  CustomerPersonalDetails,
  CustomerAddress,
  BusinessDetails,
  CollectionAccount,
  DailyCollectionRecord,
  PaymentTransaction,
  Receipt,
  Collector,
  Area,
  CustomerDocument,
  Notification,
  CustomerNote,
  AuditLog,
  Customer360Profile,
  DashboardStats,
  MonthlyReportData,
  AppConfig,
  ConfigSection,
} from '../types';

/** Payload for issuing a loan; money values are computed by the server from these terms. */
export interface IssueLoanPayload {
  customer_id?: string;
  product_id: string;
  requested_amount: number;
  margin_percentage: number;
  collection_days: number;
  /** Only sent when the daily amount was entered manually. */
  daily_collection?: number;
  start_date: string;
  assigned_collector_id: string;
  collection_area: string;
}

/** A customer row as returned by the list endpoint. */
export type CustomerListItem = CustomerPersonalDetails & {
  address?: CustomerAddress;
  business?: BusinessDetails;
  /** The running loan, with days_behind filled in. */
  activeAccount?: CollectionAccount;
  /** The newest loan, running or closed. */
  latestAccount?: CollectionAccount;
};

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text();
    let message = 'API request failed';
    try {
      const errorJson = JSON.parse(errorText);
      message = errorJson.error || message;
    } catch {
      message = errorText || message;
    }
    throw new Error(message);
  }
  return res.json();
}

function getAuthHeader(): HeadersInit {
  const token = localStorage.getItem('krs_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Authentication
  async login(payload: { username?: string; password?: string; role?: string }): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getCurrentUser(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/dashboard/stats`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Customers
  async getCustomers(params?: { search?: string; status?: string; area?: string }): Promise<CustomerListItem[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.area) query.set('area', params.area);

    const res = await fetch(`${API_BASE}/customers?${query.toString()}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async createCustomer(data: {
    personal: Partial<CustomerPersonalDetails>;
    address?: Partial<CustomerAddress>;
    business?: Partial<BusinessDetails>;
    loan?: Omit<IssueLoanPayload, 'customer_id'>;
  }): Promise<CustomerPersonalDetails & { activeAccount?: CollectionAccount }> {
    const res = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateCustomer(id: string, data: { personal?: Partial<CustomerPersonalDetails>; address?: Partial<CustomerAddress>; business?: Partial<BusinessDetails> }): Promise<CustomerPersonalDetails> {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteCustomer(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getCustomer360(id: string): Promise<Customer360Profile> {
    const res = await fetch(`${API_BASE}/customers/${id}/360`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async addCustomerNote(id: string, note: string, created_by?: string): Promise<CustomerNote> {
    const res = await fetch(`${API_BASE}/customers/${id}/notes`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ note, created_by }),
    });
    return handleResponse(res);
  },

  // Configuration (loan products, master lists, numbering, company profile)
  async getConfig(): Promise<AppConfig> {
    const res = await fetch(`${API_BASE}/config`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async updateConfigSection<K extends ConfigSection>(section: K, value: AppConfig[K]): Promise<AppConfig> {
    const res = await fetch(`${API_BASE}/config/${section}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(value),
    });
    return handleResponse(res);
  },

  // Collection Accounts
  async getCollectionAccounts(): Promise<CollectionAccount[]> {
    const res = await fetch(`${API_BASE}/collection-accounts`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async createCollectionAccount(data: IssueLoanPayload & { customer_id: string }): Promise<CollectionAccount> {
    const res = await fetch(`${API_BASE}/collection-accounts`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getCollectionAccountSchedule(id: string): Promise<DailyCollectionRecord[]> {
    const res = await fetch(`${API_BASE}/collection-accounts/${id}/schedule`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async updateShopMargin(customerId: string, default_margin_percentage: number): Promise<BusinessDetails> {
    const res = await fetch(`${API_BASE}/customers/${customerId}/business-margin`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify({ default_margin_percentage }),
    });
    return handleResponse(res);
  },

  /** Only the collector and area of a running loan can change. */
  async updateCollectionAccount(id: string, data: { assigned_collector_id?: string; collection_area?: string }): Promise<CollectionAccount> {
    const res = await fetch(`${API_BASE}/collection-accounts/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  /** Cancels a loan issued by mistake; refused once any payment has been taken. */
  async cancelLoan(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/collection-accounts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Daily Collections & Collecting Payments
  async getDailyCollections(params?: { date?: string; area?: string; collector?: string; status?: string; search?: string }): Promise<DailyCollectionRecord[]> {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.area) query.set('area', params.area);
    if (params?.collector) query.set('collector', params.collector);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`${API_BASE}/daily-collections?${query.toString()}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async collectPayment(data: {
    collection_account_id: string;
    collection_date?: string;
    amount_paid: number;
    payment_mode?: string;
    collector_id?: string;
    reason?: string;
    remarks?: string;
    is_missed?: boolean;
    transaction_ref?: string;
    razorpay_payment_id?: string;
  }): Promise<{ success: boolean; dailyRecord: DailyCollectionRecord; account: CollectionAccount; receipt: Receipt | null }> {
    const res = await fetch(`${API_BASE}/daily-collections/collect`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  /** Undoes one of today's payments (by payment ID or receipt number). */
  async undoPayment(paymentOrReceiptId: string, by: { name: string; role: string }): Promise<{ success: boolean; account: CollectionAccount; dailyRecord?: DailyCollectionRecord }> {
    const res = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentOrReceiptId)}/undo`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ by: by.name, role: by.role }),
    });
    return handleResponse(res);
  },

  /** Saves a photo (data URL, already shrunk in the browser) and returns where it is served from. */
  async uploadPhoto(dataUrl: string): Promise<{ url: string }> {
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ data_url: dataUrl }),
    });
    return handleResponse(res);
  },

  // Payments & Receipts
  async getPayments(params?: { search?: string; mode?: string; customer_id?: string }): Promise<PaymentTransaction[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.mode) query.set('mode', params.mode);
    if (params?.customer_id) query.set('customer_id', params.customer_id);

    const res = await fetch(`${API_BASE}/payments?${query.toString()}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getReceipts(params?: { customer_id?: string }): Promise<Receipt[]> {
    const query = new URLSearchParams();
    if (params?.customer_id) query.set('customer_id', params.customer_id);

    const res = await fetch(`${API_BASE}/receipts?${query.toString()}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getReceipt(id: string): Promise<Receipt> {
    const res = await fetch(`${API_BASE}/receipts/${id}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Monthly Report
  async getMonthlyReport(params?: { month?: number; year?: number; collector?: string; area?: string; customer_id?: string; status?: string }): Promise<MonthlyReportData> {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    if (params?.collector) query.set('collector', params.collector);
    if (params?.area) query.set('area', params.area);
    if (params?.customer_id) query.set('customer_id', params.customer_id);
    if (params?.status) query.set('status', params.status);

    const res = await fetch(`${API_BASE}/reports/monthly?${query.toString()}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Collectors & Areas
  async getCollectors(): Promise<Collector[]> {
    const res = await fetch(`${API_BASE}/collectors`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async createCollector(data: Partial<Collector>): Promise<Collector> {
    const res = await fetch(`${API_BASE}/collectors`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateCollector(id: string, data: Partial<Collector>): Promise<Collector> {
    const res = await fetch(`${API_BASE}/collectors/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteCollector(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/collectors/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getAreas(): Promise<Area[]> {
    const res = await fetch(`${API_BASE}/areas`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async createArea(data: Partial<Area>): Promise<Area> {
    const res = await fetch(`${API_BASE}/areas`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateArea(id: string, data: Partial<Area>): Promise<Area> {
    const res = await fetch(`${API_BASE}/areas/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteArea(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/areas/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Documents
  async getDocuments(params?: { customer_id?: string; status?: string }): Promise<CustomerDocument[]> {
    const query = new URLSearchParams();
    if (params?.customer_id) query.set('customer_id', params.customer_id);
    if (params?.status) query.set('status', params.status);

    const res = await fetch(`${API_BASE}/documents?${query.toString()}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async uploadDocument(data: Partial<CustomerDocument>): Promise<CustomerDocument> {
    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async verifyDocument(id: string, status: 'Verified' | 'Rejected', remarks?: string): Promise<CustomerDocument> {
    const res = await fetch(`${API_BASE}/documents/${id}/verify`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify({ verification_status: status, remarks }),
    });
    return handleResponse(res);
  },

  async deleteDocument(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Notifications
  async getNotifications(params?: { role?: string; customer_id?: string }): Promise<Notification[]> {
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.customer_id) query.set('customer_id', params.customer_id);

    const res = await fetch(`${API_BASE}/notifications?${query.toString()}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Audit Logs & Data
  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/audit-logs`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  /** Replaces the live data with the committed sample data set. */
  async loadSampleData(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/seed/reset`, {
      method: 'POST',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },
};
