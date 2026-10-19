import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import * as api from '../api/api';
import type { Role, Session } from '../types';

interface AuthValue {
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isStaff: boolean;
  isAdmin: boolean;
  isPatron: boolean;
}

const AuthContext = createContext<AuthValue | null>(null);
const KEY = 'library_session';

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);

  const login = useCallback(async (email: string, password: string) => {
    const s = await api.login(email, password);
    sessionStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(KEY);
    setSession(null);
  }, []);

  const value = useMemo<AuthValue>(() => {
    const role: Role | undefined = session?.role;
    return {
      session, login, logout,
      isStaff: role === 'employee' || role === 'admin',
      isAdmin: role === 'admin',
      isPatron: role === 'student' || role === 'faculty',
    };
  }, [session, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
