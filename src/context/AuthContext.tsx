import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { initSession, type Mess, type SessionUser } from '../lib/session';
import { login as doLogin, logout as doLogout } from '../lib/auth';

export type ViewMode = 'auto' | 'member';

type AuthContextValue = {
  ready: boolean;
  user: SessionUser | null;
  mess: Mess | null;
  /** True when the signed-in user can access manager tools. */
  isManager: boolean;
  /** 'member' = a manager chose to browse the member UI. */
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  /** The area the router should land on right now. */
  area: 'manager' | 'member';
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const MANAGER_ROLES = ['manager', 'sub_manager'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mess, setMess] = useState<Mess | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('auto');

  useEffect(() => {
    let cancelled = false;
    initSession().then((s) => {
      if (cancelled) return;
      if (s) {
        setUser(s.user);
        setMess(s.mess);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const { user: u, mess: m } = await doLogin(username, password);
    setUser(u);
    setMess(m);
    setViewMode('auto');
  }, []);

  const signOut = useCallback(async () => {
    await doLogout();
    setUser(null);
    setMess(null);
    setViewMode('auto');
  }, []);

  const isManager = !!user && MANAGER_ROLES.includes(user.role);
  const area: 'manager' | 'member' = isManager && viewMode === 'auto' ? 'manager' : 'member';

  const value = useMemo(
    () => ({ ready, user, mess, isManager, viewMode, setViewMode, area, signIn, signOut }),
    [ready, user, mess, isManager, viewMode, area, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
