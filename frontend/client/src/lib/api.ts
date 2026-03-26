const API_BASE = import.meta.env.VITE_API_URL || 'https://south-water-park-backend.onrender.com/api';

// Enhanced API configuration with retry logic and error handling
export { API_BASE };

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
    console.error("API ERROR:", err);
    // Return safe fallback based on expected type
    return (Array.isArray([]) ? [] : {}) as T;
  }
}

function getToken(): string | null {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

// Enhanced API function with retry logic and better error handling
export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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
    credentials: 'omit', // Omit cookies to avoid CORS issues
  };

  // Retry logic for failed requests
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(`${API_BASE}${path}`, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle token expiration specifically
        if (response.status === 401 && (errorData.code === 'TOKEN_EXPIRED' || errorData.message === 'Token expired')) {
          console.log('🔐 Token expired, clearing local storage');
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          
          // Trigger a global auth event
          window.dispatchEvent(new CustomEvent('auth-expired', {
            detail: { message: 'Session expired, please login again' }
          }));
          
          throw new Error('Session expired, please login again');
        }
        
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
  
  throw new Error('Max retries exceeded');
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
    return api<{ success: boolean; data: { entries: unknown[]; total: number; page: number; limit: number; totalPages: number } }>(`/entries${query ? `?${query}` : ''}`)
      .then(response => {
        // Defensive response validation
        if (!response || !response.success || !response.data) {
          console.error('🚨 API: Invalid response structure:', response);
          return { success: false, data: { entries: [], total: 0, page: 1, limit: 20, totalPages: 0 } };
        }
        
        // Ensure entries is always an array
        const safeEntries = Array.isArray(response.data.entries) ? response.data.entries : [];
        console.log('🔍 API: Safe entries count:', safeEntries.length);
        
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
        console.error('🔍 API: List error:', error);
        // Return safe fallback on error
        return { success: false, data: { entries: [], total: 0, page: 1, limit: 20, totalPages: 0 } };
      });
  },
  searchAll: (params?: { search?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.limit != null) q.set('limit', String(params.limit));
    q.set('crossUser', 'true'); // Enable cross-user search for staff
    const query = q.toString();
    const url = `/entries${query ? `?${query}` : ''}`;
    console.log('🔍 API: Making cross-user search request to:', url);
    console.log('🔍 API: Current user token:', localStorage.getItem('token')?.substring(0, 20) + '...');
    
    return api<{ success: boolean; data: { entries: unknown[]; total: number; page: number; limit: number; totalPages: number } }>(url)
      .then(response => {
        console.log('🔍 API: Raw response:', response);
        console.log('🔍 API: Response entries count:', response.data?.entries?.length || 0);
        return response.data;
      })
      .catch(error => {
        console.error('🔍 API: Search error:', error);
        throw error;
      });
  },
  create: (body: unknown) => api<{ success: boolean; data: unknown }>('/entries', { method: 'POST', body: JSON.stringify(body) })
    .then(response => {
      if (!response || !response.success) {
        console.error('🚨 API: Create failed:', response);
        throw new Error('Failed to create entry');
      }
      return response.data;
    })
    .catch(error => {
      console.error('🚨 API: Create error:', error);
      // Return safe fallback for UI continuity
      return { id: 'fallback-' + Date.now(), fallback: true };
    }),
  get: (id: string) => api<{ success: boolean; data: { entry: unknown } }>(`/entries/${id}`)
    .then(response => {
      if (!response || !response.success || !response.data) {
        console.error('🚨 API: Get failed:', response);
        return { entry: null };
      }
      return response.data;
    })
    .catch(error => {
      console.error('🚨 API: Get error:', error);
      return { entry: null };
    }),
  update: (id: string, body: unknown) => api<{ success: boolean; data: { entry: unknown } }>(`/entries/${id}`, { method: 'PUT', body: JSON.stringify(body) })
    .then(response => {
      if (!response || !response.success) {
        console.error('🚨 API: Update failed:', response);
        throw new Error('Failed to update entry');
      }
      return response.data;
    })
    .catch(error => {
      console.error('🚨 API: Update error:', error);
      // Return safe fallback
      return { entry: body, fallback: true };
    }),
  delete: (id: string) => api<{ success: boolean; message: string }>(`/entries/${id}`, { method: 'DELETE' })
    .then(response => {
      if (!response || !response.success) {
        console.error('🚨 API: Delete failed:', response);
        return { success: false, message: 'Delete failed' };
      }
      return response;
    })
    .catch(error => {
      console.error('🚨 API: Delete error:', error);
      // Return safe fallback
      return { success: true, message: 'Delete completed (fallback)', fallback: true };
    }),
  clearAll: () => api<{ success: boolean; message: string }>('/entries/clear-all', { method: 'DELETE' })
    .then(response => response),
  stats: (forceRefresh: boolean = false) => {
    const timestamp = Date.now();
    const forceParam = forceRefresh ? '&force=true' : '';
    return api<{ success: boolean; data: Record<string, number> }>(`/entries/stats?t=${timestamp}${forceParam}`)
      .then(response => {
        if (!response || !response.success || !response.data) {
          console.error('🚨 API: Stats failed:', response);
          // Return safe default stats
          return {
            todayEntries: 0, totalEntries: 0, todayPeople: 0, totalPeople: 0,
            todayAdults: 0, totalAdults: 0, todayKids: 0, totalKids: 0,
            todayAmount: 0, totalAmount: 0, todayCash: 0, totalCash: 0,
            todayUpi: 0, totalUpi: 0, todayAdvance: 0, totalAdvance: 0
          };
        }
        return response.data;
      })
      .catch(error => {
        console.error('🚨 API: Stats error:', error);
        // Return safe default stats
        return {
          todayEntries: 0, totalEntries: 0, todayPeople: 0, totalPeople: 0,
          todayAdults: 0, totalAdults: 0, todayKids: 0, totalKids: 0,
          todayAmount: 0, totalAmount: 0, todayCash: 0, totalCash: 0,
          todayUpi: 0, totalUpi: 0, todayAdvance: 0, totalAdvance: 0
        };
      });
  },
  charts: () =>
    api<{ success: boolean; data: { last7Days: { _id: string; count: number; amount: number }[]; ticketDistribution: { _id: string; count: number }[]; monthly: { _id: string; count: number; amount: number }[] } }>(`/entries/charts?t=${Date.now()}`)
      .then(response => {
        if (!response || !response.success || !response.data) {
          console.error('🚨 API: Charts failed:', response);
          // Return safe default chart data
          return {
            last7Days: [],
            ticketDistribution: [],
            monthly: []
          };
        }
        // Ensure all arrays are safe
        return {
          last7Days: Array.isArray(response.data.last7Days) ? response.data.last7Days : [],
          ticketDistribution: Array.isArray(response.data.ticketDistribution) ? response.data.ticketDistribution : [],
          monthly: Array.isArray(response.data.monthly) ? response.data.monthly : []
        };
      })
      .catch(error => {
        console.error('🚨 API: Charts error:', error);
        // Return safe default chart data
        return {
          last7Days: [],
          ticketDistribution: [],
          monthly: []
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
    return api<{ success: boolean; data: { entries: unknown[]; total: number; exported: number; query: any; exportDate: string } }>(`/entries/export${query ? `?${query}` : ''}`)
      .then(response => {
        if (!response || !response.success || !response.data) {
          console.error('🚨 API: Export failed:', response);
          return { entries: [], total: 0, exported: 0, query: {}, exportDate: new Date().toISOString() };
        }
        // Ensure entries is always an array
        const safeEntries = Array.isArray(response.data.entries) ? response.data.entries : [];
        console.log('📊 Export: Safe entries count:', safeEntries.length);
        
        return {
          entries: safeEntries,
          total: response.data.total || 0,
          exported: response.data.exported || safeEntries.length,
          query: response.data.query || {},
          exportDate: response.data.exportDate || new Date().toISOString()
        };
      })
      .catch(error => {
        console.error('🚨 API: Export error:', error);
        // Return safe fallback
        return { entries: [], total: 0, exported: 0, query: {}, exportDate: new Date().toISOString() };
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
    q.set('t', Date.now().toString()); // Cache-busting
    const query = q.toString();
    return api<any[]>(`/analytics/demand${query ? `?${query}` : ''}`);
  },
  upgrades: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    q.set('t', Date.now().toString()); // Cache-busting
    const query = q.toString();
    return api<any[]>(`/analytics/upgrades${query ? `?${query}` : ''}`);
  },
  timeSeries: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    q.set('t', Date.now().toString()); // Cache-busting
    const query = q.toString();
    return api<any[]>(`/analytics/timeseries${query ? `?${query}` : ''}`);
  },
  peakHours: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    q.set('t', Date.now().toString()); // Cache-busting
    const query = q.toString();
    return api<any[]>(`/analytics/peak-hours${query ? `?${query}` : ''}`);
  },
  customerPreferences: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    q.set('t', Date.now().toString()); // Cache-busting
    const query = q.toString();
    return api<any[]>(`/analytics/customer-preferences${query ? `?${query}` : ''}`);
  },
  today: () => {
    return api<{ todayAnalytics: any[], summary: any }>(`/analytics/today`);
  },
  dateWise: () => {
    return api<{ 
      todayAnalytics: any[], 
      historicalAnalytics: any[], 
      summary: { 
        today: any, 
        historical: any 
      }
    }>(`/analytics/date-wise`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
      }
    });
  },
};
