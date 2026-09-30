import {
  User,
  CustomerPersonalDetails,
  CustomerAddress,
  BusinessDetails,
  CollectionPlan,
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
  SystemSettings,
  Customer360Profile,
  DashboardStats,
  DashboardCharts,
  MonthlyReportData,
} from '../types';

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

  async getDashboardCharts(): Promise<DashboardCharts> {
    const res = await fetch(`${API_BASE}/dashboard/charts`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Customers
  async getCustomers(params?: { search?: string; status?: string; area?: string }): Promise<(CustomerPersonalDetails & { address?: CustomerAddress; business?: BusinessDetails; activeAccount?: CollectionAccount })[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.area) query.set('area', params.area);

    const res = await fetch(`${API_BASE}/customers?${query.toString()}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async createCustomer(data: { personal: Partial<CustomerPersonalDetails>; address?: Partial<CustomerAddress>; business?: Partial<BusinessDetails> }): Promise<CustomerPersonalDetails> {
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

  // Plans
  async getPlans(): Promise<CollectionPlan[]> {
    const res = await fetch(`${API_BASE}/plans`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async createPlan(data: Partial<CollectionPlan>): Promise<CollectionPlan> {
    const res = await fetch(`${API_BASE}/plans`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updatePlan(id: string, data: Partial<CollectionPlan>): Promise<CollectionPlan> {
    const res = await fetch(`${API_BASE}/plans/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deletePlan(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/plans/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
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

  async createCollectionAccount(data: {
    customer_id: string;
    plan_id?: string;
    requested_amount?: number;
    margin_percentage?: number;
    margin_amount?: number;
    disbursed_amount?: number;
    daily_collection?: number;
    collection_days?: number;
    start_date?: string;
    expected_end_date?: string;
    assigned_collector_id?: string;
    collection_area?: string;
  }): Promise<CollectionAccount> {
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

  async updateCollectionAccount(id: string, data: Partial<CollectionAccount>): Promise<CollectionAccount> {
    const res = await fetch(`${API_BASE}/collection-accounts/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteCollectionAccount(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/collection-accounts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async updateDailyCollection(id: string, data: Partial<DailyCollectionRecord>): Promise<DailyCollectionRecord> {
    const res = await fetch(`${API_BASE}/daily-collections/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
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

  async bulkCollect(data: {
    items: Array<{
      collection_account_id: string;
      amount_paid: number;
      payment_mode?: string;
      collector_id?: string;
      remarks?: string;
    }>;
    collection_date?: string;
    payment_mode?: string;
    collector_id?: string;
  }): Promise<{ success: boolean; processed_count: number; total_collected: number; receipts: Receipt[] }> {
    const res = await fetch(`${API_BASE}/daily-collections/bulk-collect`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
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

  // Audit Logs & Settings
  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/audit-logs`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getSettings(): Promise<SystemSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async resetDatabase(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/seed/reset`, {
      method: 'POST',
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },
};
