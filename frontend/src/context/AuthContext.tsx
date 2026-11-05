import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, TOKEN_KEY } from '../services/api';
import { homeRoute, ROLE_LABELS as NAV_ROLE_LABELS } from '../lib/navigation';

export type Role = 'admin' | 'manager' | 'technician' | 'client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  company_id?: string;
  status?: string;
  first_login?: number;
  phone?: string;
}

export type Permission = 'equipment:write' | 'equipment:delete' | 'parts:manage' | 'admin:access';

const PERMISSIONS: Record<Role, Permission[]> = {
  admin: ['equipment:write', 'equipment:delete', 'parts:manage', 'admin:access'],
  manager: ['equipment:write', 'parts:manage'],
  technician: [],
  client: [],
};

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
  company_id?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  can: (permission: Permission) => boolean;
  refreshUser: () => Promise<void>;
  homePath: string;
}

const STORAGE_KEY = 'maintainx.auth';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const { user: me } = await api.auth.me();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(me));
      setUser(me);
    } catch {
      /* keep cached user */
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setUser(JSON.parse(raw));
        if (localStorage.getItem(TOKEN_KEY)) await refreshUser();
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  function persistSession(u: AuthUser, token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }

  async function login(email: string, password: string) {
    const { user: u, token } = await api.auth.login(email, password);
    persistSession(u, token);
  }

  async function register(data: RegisterData) {
    const res = await api.auth.register(data);
    if (res.user && res.token) persistSession(res.user, res.token);
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function can(permission: Permission) {
    if (!user) return false;
    return PERMISSIONS[user.role]?.includes(permission) ?? false;
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, can, refreshUser,
      homePath: homeRoute(user?.role),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export const ROLE_LABELS: Record<string, string> = NAV_ROLE_LABELS;
