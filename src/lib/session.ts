/**
 * Session storage — port of saveSession / loadSession / clearSession +
 * _getSessionToken from the web app, backed by AsyncStorage instead of
 * localStorage.
 *
 * The session holds a signed JWT (from the sign-session-jwt edge function)
 * used to scope every DB query to one mess via RLS. If JWT signing fails the
 * app still works against the anon key, exactly like the web app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SESSION_TTL_MS } from './config';

const STORAGE_KEY = 'mm_session';

export type SessionUser = {
  name: string;
  username: string;
  role: string;
  memberId: string | null;
};

export type Mess = {
  id: string;
  name: string;
  location?: string;
  created_at?: string;
};

export type Session = {
  user: SessionUser;
  mess: Mess | null;
  jwt: string | null;
  exp: number;
};

let _session: Session | null = null;

/** Load the persisted session into memory. Call once on app boot. */
export async function initSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      _session = null;
      return null;
    }
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.exp || Date.now() > parsed.exp) {
      await clearSession();
      return null;
    }
    _session = parsed;
    return _session;
  } catch {
    _session = null;
    return null;
  }
}

export async function saveSession(
  user: SessionUser,
  mess: Mess | null,
  jwt: string | null = null,
): Promise<Session> {
  _session = { user, mess, jwt, exp: Date.now() + SESSION_TTL_MS };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_session));
  return _session;
}

export async function clearSession(): Promise<void> {
  _session = null;
  await AsyncStorage.multiRemove([STORAGE_KEY, 'mm_user', 'mm_mess']);
}

/** Synchronous access to the in-memory session (after initSession). */
export function getSession(): Session | null {
  return _session;
}

export function getSessionToken(): string | null {
  return _session?.jwt ?? null;
}

export function getMessId(): string {
  const id = _session?.mess?.id;
  if (!id) throw new Error('No mess loaded — please sign out and sign in again.');
  return id;
}
