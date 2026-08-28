import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { initSession, type Mess, type SessionUser } from '../lib/session';
import { login as doLogin, logout as doLogout } from '../lib/auth';

type AuthContextValue = {
  ready: boolean;
  user: SessionUser | null;
  mess: Mess | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mess, setMess] = useState<Mess | null>(null);

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
  }, []);

  const signOut = useCallback(async () => {
    await doLogout();
    setUser(null);
    setMess(null);
  }, []);

  const value = useMemo(
    () => ({ ready, user, mess, signIn, signOut }),
    [ready, user, mess, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
