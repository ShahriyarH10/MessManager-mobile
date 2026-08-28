/**
 * Supabase clients — port of `sb` / `getClient()` from js/core/config.js.
 *
 *  - `anonClient`  : used during login / mess lookup, before a JWT exists.
 *  - `getClient()` : mess-scoped client that sends `Authorization: Bearer <jwt>`
 *                    so RLS can read `mess_id` from the token. Falls back to the
 *                    anon client when no JWT is present. Memoized per token.
 *
 * We do NOT use Supabase Auth — the web app has its own PBKDF2 credential
 * system — so session persistence / auto-refresh are disabled.
 */
import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config';
import { getSessionToken } from './session';

const commonOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

export const anonClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, commonOptions);

let _cachedToken: string | null = null;
let _cachedClient: SupabaseClient = anonClient;

export function getClient(): SupabaseClient {
  const token = getSessionToken();
  if (!token) return anonClient;
  if (token === _cachedToken) return _cachedClient;
  _cachedToken = token;
  _cachedClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    ...commonOptions,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return _cachedClient;
}

/** Call after login/logout so the next getClient() rebuilds with the new token. */
export function resetClientCache(): void {
  _cachedToken = null;
  _cachedClient = anonClient;
}
