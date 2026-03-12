const API_BASE = import.meta.env.VITE_API_URL || '/api';

export { API_BASE };

function getToken(): string | null {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

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
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { 
      ...options, 
      headers,
      credentials: 'include'
    });
  } catch (err) {
    throw new Error('Cannot reach server. Make sure the backend is running (npm run dev in server folder).');
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.message || res.statusText || 'API error';
    throw new Error(errorMessage);
  }
  return res.json();
}

export const authApi = {
  login: (username: string, password: string) =>
    api<{ token: string; user: { id: string; username: string; fullName?: string; role: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => api<{ user: { id: string; username: string; fullName?: string; role: string } | null }>('/api/auth/me'),
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
    return api<{ success: boolean; data: { entries: unknown[]; total: number; page: number; limit: number; totalPages: number } }>(`/api/entries${query ? `?${query}` : ''}`)
      .then(response => response.data);
  },
  searchAll: (params?: { search?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.limit != null) q.set('limit', String(params.limit));
    q.set('crossUser', 'true'); // Enable cross-user search for staff
    const query = q.toString();
    const url = `/api/entries${query ? `?${query}` : ''}`;
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
  create: (body: unknown) => api<{ success: boolean; data: unknown }>('/api/entries', { method: 'POST', body: JSON.stringify(body) })
    .then(response => response.data),
  get: (id: string) => api<{ success: boolean; data: { entry: unknown } }>(`/api/entries/${id}`)
    .then(response => response.data),
  update: (id: string, body: unknown) => api<{ success: boolean; data: { entry: unknown } }>(`/api/entries/${id}`, { method: 'PUT', body: JSON.stringify(body) })
    .then(response => response.data),
  delete: (id: string) => api<{ success: boolean; message: string }>(`/api/entries/${id}`, { method: 'DELETE' })
    .then(response => response),
  clearAll: () => api<{ success: boolean; message: string }>('/api/entries/clear-all', { method: 'DELETE' })
    .then(response => response),
  stats: () => api<{ success: boolean; data: Record<string, number> }>('/api/entries/stats')
    .then(response => response.data),
  charts: () =>
    api<{ success: boolean; data: { last7Days: { _id: string; count: number; amount: number }[]; ticketDistribution: { _id: string; count: number }[]; monthly: { _id: string; count: number; amount: number }[] } }>(`/api/entries/charts`)
    .then(response => response.data),
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
    const query = q.toString();
    return api<any[]>(`/analytics/demand${query ? `?${query}` : ''}`);
  },
  upgrades: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    const query = q.toString();
    return api<any[]>(`/analytics/upgrades${query ? `?${query}` : ''}`);
  },
  timeSeries: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    const query = q.toString();
    return api<any[]>(`/analytics/timeseries${query ? `?${query}` : ''}`);
  },
  peakHours: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    const query = q.toString();
    return api<any[]>(`/analytics/peak-hours${query ? `?${query}` : ''}`);
  },
  customerPreferences: (timeRange?: string) => {
    const q = new URLSearchParams();
    if (timeRange) q.set('timeRange', timeRange);
    const query = q.toString();
    return api<any[]>(`/analytics/customer-preferences${query ? `?${query}` : ''}`);
  },
};
