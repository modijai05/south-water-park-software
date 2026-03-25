const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Enhanced API configuration with retry logic and error handling
export { API_BASE };

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
      .then(response => response.data);
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
    .then(response => response.data),
  get: (id: string) => api<{ success: boolean; data: { entry: unknown } }>(`/entries/${id}`)
    .then(response => response.data),
  update: (id: string, body: unknown) => api<{ success: boolean; data: { entry: unknown } }>(`/entries/${id}`, { method: 'PUT', body: JSON.stringify(body) })
    .then(response => response.data),
  delete: (id: string) => api<{ success: boolean; message: string }>(`/entries/${id}`, { method: 'DELETE' })
    .then(response => response),
  clearAll: () => api<{ success: boolean; message: string }>('/entries/clear-all', { method: 'DELETE' })
    .then(response => response),
  stats: (forceRefresh: boolean = false) => {
    const timestamp = Date.now();
    const forceParam = forceRefresh ? '&force=true' : '';
    return api<{ success: boolean; data: Record<string, number> }>(`/entries/stats?t=${timestamp}${forceParam}`)
      .then(response => response.data)
  },
  charts: () =>
    api<{ success: boolean; data: { last7Days: { _id: string; count: number; amount: number }[]; ticketDistribution: { _id: string; count: number }[]; monthly: { _id: string; count: number; amount: number }[] } }>(`/entries/charts?t=${Date.now()}`)
    .then(response => response.data),
  export: (params?: { search?: string; ticketType?: string; from?: string; to?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.ticketType) q.set('ticketType', params.ticketType);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.limit != null) q.set('limit', String(params.limit));
    const query = q.toString();
    return api<{ success: boolean; data: { entries: unknown[]; total: number; exported: number; query: any; exportDate: string } }>(`/entries/export${query ? `?${query}` : ''}`)
      .then(response => response.data);
  },
};

export const usersApi = {
  list: () => api<{ success: boolean; data: unknown[] }>('/users')
    .then(response => response.data || []),
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
