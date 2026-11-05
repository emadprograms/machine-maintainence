const BASE = '/api';
export const TOKEN_KEY = 'maintainx.token';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('maintainx.auth');
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = token;

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      handleUnauthorized();
    }
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  equipment: {
    list: () => request<any[]>('/equipment'),
    get: (id: string) => request<any>(`/equipment/${id}`),
    create: (data: any) => request<any>('/equipment', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/equipment/${id}`, { method: 'DELETE' }),
    faults: (id: string) => request<any[]>(`/equipment/${id}/faults`),
    addImages: (id: string, images: string[], mode: 'append' | 'replace' = 'append') =>
      request<any>(`/equipment/${id}/images`, { method: 'PATCH', body: JSON.stringify({ images, mode }) }),
  },
  faults: {
    list: () => request<any[]>('/faults'),
    listMine: () => request<any[]>('/faults?assignedTo=me'),
    get: (id: string) => request<any>(`/faults/${id}`),
    create: (data: any) => request<any>('/faults', { method: 'POST', body: JSON.stringify(data) }),
    assign: (id: string, technician_id: string) =>
      request<any>(`/faults/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ technician_id }) }),
    updateStatus: (id: string, status: string, user_id?: string) =>
      request<any>(`/faults/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, user_id }) }),
    addComment: (id: string, data: any) => request<any>(`/faults/${id}/comments`, { method: 'POST', body: JSON.stringify(data) }),
    addImages: (id: string, images: string[], mode: 'append' | 'replace' = 'append') =>
      request<any>(`/faults/${id}/images`, { method: 'PATCH', body: JSON.stringify({ images, mode }) }),
    submitReport: (id: string, data: any) =>
      request<any>(`/faults/${id}/report`, { method: 'POST', body: JSON.stringify(data) }),
    getReport: (id: string) => request<any>(`/faults/${id}/report`),
  },
  spareParts: {
    list: () => request<any[]>('/spare-parts'),
    get: (id: string) => request<any>(`/spare-parts/${id}`),
    create: (data: any) => request<any>('/spare-parts', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) =>
      request<any>(`/spare-parts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
  notifications: {
    list: () => request<{ activities: any[]; unread: number }>('/notifications'),
    unreadCount: () => request<{ unread: number }>('/notifications/unread-count'),
    markRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request<any>('/notifications/mark-all-read', { method: 'POST' }),
  },
  dashboard: {
    get: () => request<any>('/dashboard'),
  },
  users: {
    list: () => request<any[]>('/users'),
    get: (id: string) => request<any>(`/users/${id}`),
  },
  auth: {
    login: (email: string, password: string) =>
      request<{ user: any; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (data: { name: string; email: string; password: string; role?: string; company_id?: string }) =>
      request<{ user?: any; token?: string; message?: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<{ user: any }>('/auth/me'),
    updateMe: (data: { name?: string; phone?: string }) =>
      request<{ user: any }>('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean }>('/auth/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
    onboardingDone: () => request<{ ok: boolean }>('/auth/me/onboarding-done', { method: 'PUT' }),
  },
  admin: {
    dashboard: () => request<any>('/admin/dashboard'),
    activity: () => request<any[]>('/admin/activity'),
    onlineUsers: () => request<any[]>('/admin/online-users'),
    users: (params?: Record<string, string>) => {
      const q = new URLSearchParams(params || {}).toString();
      return request<any[]>(`/admin/users${q ? `?${q}` : ''}`);
    },
    pendingUsers: () => request<any[]>('/admin/users/pending'),
    createUser: (data: any) => request<any>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    updateRole: (id: string, role: string) => request<any>(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    updateStatus: (id: string, status: string) => request<any>(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    approveUser: (id: string) => request<any>(`/admin/users/${id}/approve`, { method: 'PUT' }),
    companies: () => request<any[]>('/admin/companies'),
    createCompany: (data: any) => request<any>('/admin/companies', { method: 'POST', body: JSON.stringify(data) }),
    companyStats: (id: string) => request<any>(`/admin/companies/${id}/stats`),
    breakdowns: (params?: Record<string, string>) => {
      const q = new URLSearchParams(params || {}).toString();
      return request<any[]>(`/admin/breakdowns${q ? `?${q}` : ''}`);
    },
    assignBreakdown: (id: string, technician_id: string) =>
      request<any>(`/admin/breakdowns/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ technician_id }) }),
    audit: (params?: Record<string, string>) => {
      const q = new URLSearchParams(params || '').toString();
      return request<any[]>(`/admin/audit${q ? `?${q}` : ''}`);
    },
    settings: () => request<any>('/admin/settings'),
    updateSettings: (data: any) => request<any>('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
};
