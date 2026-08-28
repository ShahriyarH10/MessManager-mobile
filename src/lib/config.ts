/**
 * Backend configuration.
 *
 * These are the same public Supabase credentials the web app ships with
 * (js/core/config.js). The anon/publishable key is safe to embed in a client;
 * row-level security + the signed session JWT are what actually scope data
 * access per mess.
 *
 * To point the app at a different Supabase project, override these with
 * EXPO_PUBLIC_ env vars (see .env.example).
 */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://lrzotklutnyzcadutgwf.supabase.co';

export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable__22c2PXW3UFp8RGF_C1rpQ_uvcyFXnb';

/** Session lifetime — mirrors SESSION_TTL_MS in the web app (30 days). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Hour of day after which meal entry screens show "tomorrow". */
export const LATE_NIGHT_HOUR = 23;
