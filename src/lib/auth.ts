/**
 * Auth primitives — ported from js/core/auth.js (doLogin, signSessionJWT).
 * Superadmin login is intentionally omitted from the mobile app for now.
 */
import { SUPABASE_URL } from './config';
import { anonClient, resetClientCache } from './supabase';
import { comparePassword, hashPassword, isLegacyHash } from './crypto';
import { saveSession, clearSession, type Mess, type SessionUser } from './session';

/** Calls the sign-session-jwt edge function to get a mess-scoped JWT for RLS. */
export async function signSessionJWT(
  memberId: string,
  messId: string,
  role: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-session-jwt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, messId, role }),
    });
    const data = await res.json();
    return data.token || null;
  } catch (e) {
    console.warn('[auth] JWT signing failed — continuing without RLS token', e);
    return null;
  }
}

export class LoginError extends Error {}

export async function login(
  username: string,
  password: string,
): Promise<{ user: SessionUser; mess: Mess | null }> {
  const user = username.trim();
  if (!user || !password) throw new LoginError('Enter username and password.');

  const { data: memberRow, error } = await anonClient
    .from('members')
    .select('*, messes(*)')
    .eq('username', user)
    .maybeSingle();

  if (error) throw new LoginError('Connection error. Check your network.');
  if (!memberRow) throw new LoginError('Invalid username or password.');

  const ok = await comparePassword(password, memberRow.password);
  if (!ok) throw new LoginError('Invalid username or password.');

  // Transparently upgrade a legacy SHA-256 hash to PBKDF2.
  if (isLegacyHash(memberRow.password)) {
    try {
      const newHash = await hashPassword(password);
      await anonClient.from('members').update({ password: newHash }).eq('id', memberRow.id);
    } catch {
      /* non-fatal */
    }
  }

  let messObj: Mess | null = (memberRow as any).messes ?? null;
  if (!messObj && memberRow.mess_id) {
    const { data: fetched } = await anonClient
      .from('messes')
      .select('*')
      .eq('id', memberRow.mess_id)
      .maybeSingle();
    messObj = (fetched as Mess) ?? null;
  }

  const jwt = await signSessionJWT(memberRow.id, memberRow.mess_id, memberRow.role);

  const sessionUser: SessionUser = {
    name: memberRow.name,
    username: user,
    role: memberRow.role,
    memberId: memberRow.id,
  };

  await saveSession(sessionUser, messObj, jwt);
  resetClientCache();
  return { user: sessionUser, mess: messObj };
}

export async function logout(): Promise<void> {
  await clearSession();
  resetClientCache();
}
