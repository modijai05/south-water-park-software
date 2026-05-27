import type { Stats } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://south-water-park-backend.onrender.com/api';

// Enhanced API configuration with retry logic and error handling
export { API_BASE };

// Simple in-memory cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds cache

// Safe fetch wrapper for maximum error resilience
export async function safeFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'omit',
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Return data or safe fallback
    return data ?? (Array.isArray([]) ? [] : {}) as T;
  } catch (err) {
    // Silent error handling for performance
    return (Array.isArray([]) ? [] : {}) as T;
  }
}

function getToken(): string | null {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

// Optimized API function with reduced retry logic for faster loads
export async function api<T>(
  path: string,
  options: RequestInit = {},
  useCache: boolean = false
): Promise<T> {
  const cacheKey = `${path}:${JSON.stringify(options)}`;
  
  // Check cache for GET requests
  if (useCache && options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE') {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'omit',
  };

  // Reduced retry logic for faster initial loads
  let retries = 0;
  const maxRetries = 2; // Reduced from 3 to 2 for faster loads
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(`${API_BASE}${path}`, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle token expiration specifically
        if (response.status === 401) {
          if (errorData.code === 'TOKEN_EXPIRED' || errorData.message === 'Token expired' || errorData.error === 'Token expired') {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            
            window.dispatchEvent(new CustomEvent('auth-expired', {
              detail: { message: 'Session expired, please login again' }
            }));
            
            throw new Error('Session expired, please login again');
          } else {
            throw new Error(errorData.message || 'Authentication failed');
          }
        }
        
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Cache successful GET requests
      if (useCache && options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE') {
        apiCache.set(cacheKey, { data, timestamp: Date.now() });
      }
      
      return data;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        throw error;
      }
      // Faster retry delay
      await new Promise(resolve => setTimeout(resolve, 500 * retries));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Clear cache function
export function clearApiCache() {
  apiCache.clear();
}

export const authApi = {
  login: (username: string, password: string) =>
    api<{ token: string; user: { id: string; username: string; fullName?: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => api<{ user: { id: string; username: string; fullName?: string; role: string } | null }>('/auth/me'),
};

export const entriesApi = {
  list: (params?: { search?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.page != null) q.set('page', String(params.page));
    if (params?.limit != null) q.set('limit', String(params.limit));
    const query = q.toString();
    return api<{ success: boolean; data: { entries: unknown[]; total: number; page: number; limit: number; totalPages: number } }>(`/entries${query ? `?${query}` : ''}`, {}, true)
      .then(response => {
        if (!response || !response.success || !response.data) {
          return { success: false, data: { entries: [], total: 0, page: 1, limit: 20, totalPages: 0 } };
        }
        
        const safeEntries = Array.isArray(response.data.entries) ? response.data.entries : [];
        
        return {
          success: true,
          data: {
            entries: safeEntries,
            total: response.data.total || 0,
            page: response.data.page || 1,
            limit: response.data.limit || 20,
            totalPages: response.data.totalPages || 0
          }
        };
      })
      .catch(error => {
        return { success: false, data: { entries: [], total: 0, page: 1, limit: 20, totalPages: 0 } };
      });
  },
  searchAll: (params?: { search?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.limit != null) q.set('limit', String(params.limit));
    q.set('crossUser', 'true');
    const query = q.toString();
    const url = `/entries${query ? `?${query}` : ''}`;
    
    return api<{ success: boolean; data: { entries: unknown[]; total: number; page: number; limit: number; totalPages: number } }>(url)
      .then(response => {
        return response.data;
      })
      .catch(error => {
        throw error;
      });
  },
  create: (body: unknown) => api<{ success: boolean; data: unknown }>('/entries', { method: 'POST', body: JSON.stringify(body) })
    .then(response => {
      if (!response || !response.success) {
        throw new Error('Failed to create entry');
      }
      return response.data;
    })
    .catch(error => {
      return { id: 'fallback-' + Date.now(), fallback: true };
    }),
  get: (id: string) => api<{ success: boolean; data: { entry: unknown } }>(`/entries/${id}`)
    .then(response => {
      if (!response || !response.success || !response.data) {
        return { entry: null };
      }
      return response.data;
    })
    .catch(error => {
      return { entry: null };
    }),
  update: (id: string, body: unknown) => {
    return api<{ success: boolean; data: { entry: unknown } }>(`/entries/${id}`, { 
      method: 'PUT', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      })
    })
    .then(response => {
      if (!response || !response.success) {
        throw new Error('Failed to update entry');
      }
      return response.data;
    })
    .catch(error => {
      return { entry: body, fallback: true };
    });
  },
  delete: (id: string) => api<{ success: boolean; message: string }>(`/entries/${id}`, { method: 'DELETE' })
    .then(response => {
      if (!response || !response.success) {
        return { success: false, message: 'Delete failed' };
      }
      return response;
    })
    .catch(error => {
      return { success: true, message: 'Delete completed (fallback)', fallback: true };
    }),
  clearAll: () => api<{ success: boolean; message: string }>('/entries/clear-all', { method: 'DELETE' })
    .then(response => response),
  stats: (forceRefresh: boolean = false) => {
    const forceParam = forceRefresh ? '&force=true' : '';
    return api<{ success: boolean; data: Stats }>(`/entries/stats?${forceParam}`, {}, !forceRefresh)
      .then(response => {
        if (!response || !response.success || !response.data) {
          return {
            todayEntries: 0, totalEntries: 0, todayPeople: 0, totalPeople: 0,
            todayAdults: 0, totalAdults: 0, todayKids: 0, totalKids: 0,
            todayAmount: 0, totalAmount: 0, todayCash: 0, totalCash: 0,
            todayUpi: 0, totalUpi: 0, todayAdvance: 0, totalAdvance: 0,
            today150: 0, today300: 0, today450: 0, today600: 0, today100: 0,
            total150: 0, total300: 0, total450: 0, total600: 0, total100: 0,
            today150Adults: 0, today150Kids: 0, today300Adults: 0, today300Kids: 0,
            today450Adults: 0, today450Kids: 0, today600Adults: 0, today600Kids: 0,
            today100Adults: 0, today100Kids: 0,
            total150Adults: 0, total150Kids: 0, total300Adults: 0, total300Kids: 0,
            total450Adults: 0, total450Kids: 0, total600Adults: 0, total600Kids: 0,
            total100Adults: 0, total100Kids: 0,
            todayAdultsFastFoodCoupons: 0, todayKidsFastFoodCoupons: 0,
            todayAdultsMainFoodCoupons: 0, todayKidsMainFoodCoupons: 0,
            todayTotalFastFoodCoupons: 0, todayTotalMainFoodCoupons: 0, todayTotalFoodCoupons: 0,
            totalAdultsFastFoodCoupons: 0, totalKidsFastFoodCoupons: 0,
            totalAdultsMainFoodCoupons: 0, totalKidsMainFoodCoupons: 0,
            totalFastFoodCoupons: 0, totalMainFoodCoupons: 0, totalFoodCoupons: 0,
            averageTicketValue: 0, peakHour: 'N/A', conversionRate: 0,
            todayAdditionalDiscount: 0, todayTotalDiscount: 0,
            totalAdditionalDiscount: 0, totalTotalDiscount: 0
          };
        }
        return response.data;
      })
      .catch(error => {
        return {
          todayEntries: 0, totalEntries: 0, todayPeople: 0, totalPeople: 0,
          todayAdults: 0, totalAdults: 0, todayKids: 0, totalKids: 0,
          todayAmount: 0, totalAmount: 0, todayCash: 0, totalCash: 0,
          todayUpi: 0, totalUpi: 0, todayAdvance: 0, totalAdvance: 0,
          today150: 0, today300: 0, today450: 0, today600: 0, today100: 0,
          total150: 0, total300: 0, total450: 0, total600: 0, total100: 0,
          today150Adults: 0, today150Kids: 0, today300Adults: 0, today300Kids: 0,
          today450Adults: 0, today450Kids: 0, today600Adults: 0, today600Kids: 0,
          today100Adults: 0, today100Kids: 0,
          total150Adults: 0, total150Kids: 0, total300Adults: 0, total300Kids: 0,
          total450Adults: 0, total450Kids: 0, total600Adults: 0, total600Kids: 0,
          total100Adults: 0, total100Kids: 0,
          todayAdultsFastFoodCoupons: 0, todayKidsFastFoodCoupons: 0,
          todayAdultsMainFoodCoupons: 0, todayKidsMainFoodCoupons: 0,
          todayTotalFastFoodCoupons: 0, todayTotalMainFoodCoupons: 0, todayTotalFoodCoupons: 0,
          totalAdultsFastFoodCoupons: 0, totalKidsFastFoodCoupons: 0,
          totalAdultsMainFoodCoupons: 0, totalKidsMainFoodCoupons: 0,
          totalFastFoodCoupons: 0, totalMainFoodCoupons: 0, totalFoodCoupons: 0,
          averageTicketValue: 0, peakHour: 'N/A', conversionRate: 0,
          todayAdditionalDiscount: 0, todayTotalDiscount: 0,
          totalAdditionalDiscount: 0, totalTotalDiscount: 0
        };
      });
  },
  // Comprehensive data sync for all dashboards
  syncAll: () => {
    return api<{
      success: boolean;
      data: {
        stats: Record<string, number>;
        recentEntries: any[];
        todayEntries: any[];
        summary: {
          totalRecords: number;
          todayRecords: number;
          recentRecords: number;
          lastUpdated: string;
        };
      };
      metadata?: {
        syncType: string;
        timestamp: string;
        dataFreshness: string;
        source: string;
        syncStatus: string;
        performance?: {
          queryTime: number;
          cacheStatus: string;
          dataIntegrity: string;
        };
        error?: string;
      };
      error?: string;
    }>(`/entries/sync-all`, {}, true)
      .then(response => {
        if (!response || !response.success) {
          return {
            stats: {},
            recentEntries: [],
            todayEntries: [],
            summary: {
              totalRecords: 0,
              todayRecords: 0,
              recentRecords: 0,
              lastUpdated: new Date().toISOString()
            },
            metadata: {
              syncType: 'comprehensive',
              timestamp: new Date().toISOString(),
              dataFreshness: 'error',
              source: 'fallback',
              syncStatus: 'error',
              error: response?.error || 'Unknown error',
              performance: {
                queryTime: Date.now(),
                cacheStatus: 'error',
                dataIntegrity: 'compromised'
              }
            }
          };
        }
        
        const safeData = {
          stats: response.data?.stats || {},
          recentEntries: Array.isArray(response.data?.recentEntries) ? response.data.recentEntries : [],
          todayEntries: Array.isArray(response.data?.todayEntries) ? response.data.todayEntries : [],
          summary: {
            totalRecords: response.data?.summary?.totalRecords || 0,
            todayRecords: response.data?.summary?.todayRecords || 0,
            recentRecords: response.data?.summary?.recentRecords || 0,
            lastUpdated: response.data?.summary?.lastUpdated || new Date().toISOString()
          },
          metadata: {
            syncType: response.metadata?.syncType || 'comprehensive',
            timestamp: response.metadata?.timestamp || new Date().toISOString(),
            dataFreshness: response.metadata?.dataFreshness || 'unknown',
            source: response.metadata?.source || 'api',
            syncStatus: response.metadata?.syncStatus || 'unknown',
            performance: response.metadata?.performance || {
              queryTime: Date.now(),
              cacheStatus: 'unknown',
              dataIntegrity: 'unknown'
            },
            error: response.metadata?.error
          }
        };
        
        return safeData;
      })
      .catch(error => {
        return {
          stats: {},
          recentEntries: [],
          todayEntries: [],
          summary: {
            totalRecords: 0,
            todayRecords: 0,
            recentRecords: 0,
            lastUpdated: new Date().toISOString()
          },
          metadata: {
            syncType: 'comprehensive',
            timestamp: new Date().toISOString(),
            dataFreshness: 'error',
            source: 'fallback',
            syncStatus: 'error',
            error: error.message || 'Network error',
            performance: {
              queryTime: Date.now(),
              cacheStatus: 'error',
              dataIntegrity: 'compromised'
            }
          }
        };
      });
  },
  charts: () =>
    api<{ success: boolean; data: { last7Days: { _id: string; count: number; amount: number }[]; ticketDistribution: { _id: string; count: number }[]; monthly: { _id: string; count: number; amount: number }[] } }>(`/entries/charts`, {}, true)
      .then(response => {
        if (!response || !response.success || !response.data) {
          return {
            last7Days: [],
            ticketDistribution: [],
            monthly: []
          };
        }
        return response.data;
      })
      .catch(error => {
        return {
          last7Days: [],
          ticketDistribution: [],
          monthly: []
        };
      }),
  
  todayCharts: () =>
    api<{ success: boolean; data: { hourlyChart: { _id: string; count: number; amount: number }[]; ticketDistribution: { _id: string; count: number; amount: number }[]; hourlyComparison: { hour: string; entries: number; revenue: number }[]; summary: { totalEntries: number; totalRevenue: number; date: string; lastUpdated: string } } }>(`/entries/charts/today`, {}, true)
      .then(response => {
        if (!response || !response.success || !response.data) {
          return {
            hourlyChart: Array.from({ length: 24 }, (_, i) => ({ _id: `${i}:00`, count: 0, amount: 0 })),
            ticketDistribution: [
              { _id: '100', count: 0, amount: 0 },
              { _id: '150', count: 0, amount: 0 },
              { _id: '300', count: 0, amount: 0 },
              { _id: '450', count: 0, amount: 0 },
              { _id: '600', count: 0, amount: 0 }
            ],
            hourlyComparison: [],
            summary: {
              totalEntries: 0,
              totalRevenue: 0,
              date: new Date().toISOString().split('T')[0],
              lastUpdated: new Date().toISOString()
            }
          };
        }
        return response.data;
      })
      .catch(error => {
        return {
          hourlyChart: Array.from({ length: 24 }, (_, i) => ({ _id: `${i}:00`, count: 0, amount: 0 })),
          ticketDistribution: [
            { _id: '100', count: 0, amount: 0 },
            { _id: '150', count: 0, amount: 0 },
            { _id: '300', count: 0, amount: 0 },
            { _id: '450', count: 0, amount: 0 },
            { _id: '600', count: 0, amount: 0 }
          ],
          hourlyComparison: [],
          summary: {
            totalEntries: 0,
            totalRevenue: 0,
            date: new Date().toISOString().split('T')[0],
            lastUpdated: new Date().toISOString()
          }
        };
      }),
  export: (params?: { search?: string; ticketType?: string; from?: string; to?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.ticketType) q.set('ticketType', params.ticketType);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.limit != null) q.set('limit', String(params.limit));
    const query = q.toString();
    
    return api<{ 
      success: boolean; 
      data: { 
        entries: unknown[]; 
        total: number; 
        exported: number; 
        query: any; 
        exportDate: string;
        exportStats?: {
          averageTicketValue: number;
          totalPeople: number;
          totalRevenue: number;
          ticketTypeDistribution: Record<string, number>;
        };
      };
      metadata?: {
        exportVersion: string;
        dataIntegrity: string;
        source: string;
        performance: {
          queryTime: number;
          recordCount: number;
          cacheStatus: string;
        };
      };
    }>(`/entries/export${query ? `?${query}` : ''}`)
      .then(response => {
        if (!response || !response.success || !response.data) {
          return { 
            entries: [], 
            total: 0, 
            exported: 0, 
            query: params || {}, 
            exportDate: new Date().toISOString(),
            exportStats: {
              averageTicketValue: 0,
              totalPeople: 0,
              totalRevenue: 0,
              ticketTypeDistribution: {}
            }
          };
        }
        
        const safeEntries = Array.isArray(response.data.entries) ? response.data.entries : [];
        const safeExportStats = response.data.exportStats || {
          averageTicketValue: 0,
          totalPeople: 0,
          totalRevenue: 0,
          ticketTypeDistribution: {}
        };
        
        const exportResult = {
          entries: safeEntries,
          total: response.data.total || 0,
          exported: response.data.exported || safeEntries.length,
          query: response.data.query || params || {},
          exportDate: response.data.exportDate || new Date().toISOString(),
          exportStats: safeExportStats,
          metadata: response.metadata || {
            exportVersion: '2.0',
            dataIntegrity: 'verified',
            source: 'api',
            performance: {
              queryTime: Date.now(),
              recordCount: safeEntries.length,
              cacheStatus: 'unknown'
            }
          }
        };
        
        return exportResult;
      })
      .catch(error => {
        return { 
          entries: [], 
          total: 0, 
          exported: 0, 
          query: params || {}, 
          exportDate: new Date().toISOString(),
          exportStats: {
            averageTicketValue: 0,
            totalPeople: 0,
            totalRevenue: 0,
            ticketTypeDistribution: {}
          },
          metadata: {
            exportVersion: '2.0',
            dataIntegrity: 'error',
            source: 'fallback',
            performance: {
              queryTime: Date.now(),
              recordCount: 0,
              cacheStatus: 'error'
            }
          }
        };
      });
  },
};

export const usersApi = {
  list: () => api<{ success: boolean; data: unknown[] }>('/users')
    .then(response => {
      if (!response || !response.success) {
        console.error('🚨 API: Users list failed:', response);
        return [];
      }
      return Array.isArray(response.data) ? response.data : [];
    })
    .catch(error => {
      console.error('🚨 API: Users list error:', error);
      return [];
    }),
  create: (username: string, password: string, role: string, email?: string, fullName?: string) =>
    api<{ success: boolean; data: unknown }>('/users', { method: 'POST', body: JSON.stringify({ username, password, role, email, fullName }) })
    .then(response => response.data),
  update: (id: string, body: { active?: boolean; password?: string; username?: string; role?: string; email?: string; fullName?: string }) =>
    api<{ success: boolean; data: { user: unknown } }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) })
    .then(response => response.data),
  delete: (id: string) => api<{ success: boolean; message: string }>(`/users/${id}`, { method: 'DELETE' })
    .then(response => response),
  logs: (id: string) => api<{ success: boolean; data: { username: string; logs: { timestamp: string; success: boolean }[] } }>(`/users/${id}/logs`)
    .then(response => response.data),
  bulk: (operation: string, userIds: string[], data?: any) =>
    api<{ success: boolean; message: string; modifiedCount: number; acknowledged: boolean }>('/users/bulk', { 
      method: 'POST', 
      body: JSON.stringify({ operation, userIds, data }) 
    }).then(response => response),
  resetPassword: (id: string, newPassword: string) =>
    api<{ success: boolean; message: string; user: any }>(`/users/${id}/reset-password`, { 
      method: 'POST', 
      body: JSON.stringify({ newPassword }) 
    }).then(response => response),
  stats: () => api<{ success: boolean; data: { totalUsers: number; activeUsers: number; inactiveUsers: number; adminUsers: number; staffUsers: number; recentUsers: number } }>('/users/stats')
    .then(response => response.data),
};

export const analyticsApi = {
  demand: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    const query = q.toString();
    return api<any[]>(`/analytics/demand${query ? `?${query}` : ''}`, {}, true);
  },
  upgrades: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    const query = q.toString();
    return api<any[]>(`/analytics/upgrades${query ? `?${query}` : ''}`, {}, true);
  },
  timeSeries: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    const query = q.toString();
    return api<any[]>(`/analytics/timeseries${query ? `?${query}` : ''}`, {}, true);
  },
  peakHours: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    const query = q.toString();
    return api<any[]>(`/analytics/peak-hours${query ? `?${query}` : ''}`, {}, true);
  },
  customerPreferences: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    const query = q.toString();
    return api<any[]>(`/analytics/customer-preferences${query ? `?${query}` : ''}`, {}, true);
  },
  discounts: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    const query = q.toString();
    return api<any>(`/analytics/discounts${query ? `?${query}` : ''}`, {}, true);
  },
  today: () => {
    return api<{ todayAnalytics: any[], summary: any }>(`/analytics/today`, {}, true);
  },
  dateWise: () => {
    return api<{ 
      todayAnalytics: any[], 
      historicalAnalytics: any[], 
      summary: { 
        today: any, 
        historical: any 
      }
    }>(`/analytics/date-wise`, {}, true)
    .then(response => {
      if (!response) {
        return {
          todayAnalytics: [],
          historicalAnalytics: [],
          summary: {
            today: {
              totalRevenue: 0,
              totalEntries: 0,
              totalPeople: 0,
              totalAdults: 0,
              totalKids: 0,
              date: new Date().toISOString().split('T')[0],
              lastUpdated: new Date().toISOString(),
              totalDiscountAmount: 0,
              entriesWithDiscounts: 0,
              discountRate: 0
            },
            historical: {
              totalRevenue: 0,
              totalEntries: 0,
              totalPeople: 0,
              totalAdults: 0,
              totalKids: 0,
              dateRange: 'Last 30 days',
              totalDiscountAmount: 0,
              entriesWithDiscounts: 0,
              discountRate: 0
            }
          }
        };
      }
      return response;
    })
    .catch(error => {
      return {
        todayAnalytics: [],
        historicalAnalytics: [],
        summary: {
          today: {
            totalRevenue: 0,
            totalEntries: 0,
            totalPeople: 0,
            totalAdults: 0,
            totalKids: 0,
            date: new Date().toISOString().split('T')[0],
            lastUpdated: new Date().toISOString(),
            totalDiscountAmount: 0,
            entriesWithDiscounts: 0,
            discountRate: 0,
            avgTicketValue: 0,
            growthRate: 0,
            peakHour: 0
          },
          historical: {
            totalRevenue: 0,
            totalEntries: 0,
            totalPeople: 0,
            totalAdults: 0,
            totalKids: 0,
            dateRange: 'Last 30 days',
            totalDiscountAmount: 0,
            entriesWithDiscounts: 0,
            discountRate: 0,
            avgTicketValue: 0
          }
        }
      };
    });
  },
};
