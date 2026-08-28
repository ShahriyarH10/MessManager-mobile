/**
 * Database access — ported from js/core/db.js.
 *
 * Note: the web app's `sanitize()` HTML-escapes every string on read (XSS
 * defense for innerHTML rendering). React Native has no HTML sink, and escaping
 * would corrupt displayed names ("A & B" -> "A &amp; B"), so we deliberately
 * skip it here.
 */
import { getClient } from './supabase';
import { getMessId } from './session';
import type { Member, MealRow, BazarRow, RentRecord, UtilityRecord } from '../core/types';

type TimeTable = 'meals' | 'bazar';
type KeyedTable = 'rent';

function orderColumn(table: string): string {
  if (table === 'meals' || table === 'bazar') return 'date';
  if (table === 'rent') return 'month_key';
  return 'created_at';
}

/** Paginated full-table fetch scoped to the current mess (Supabase caps at 1000/page). */
export async function dbGetAll<T = any>(table: string): Promise<T[]> {
  const orderCol = orderColumn(table);
  const PAGE = 1000;
  let all: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await getClient()
      .from(table)
      .select('*')
      .eq('mess_id', getMessId())
      .order(orderCol)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat((data as T[]) || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export const dbGetMeals = () => dbGetAll<MealRow>('meals');
export const dbGetBazar = () => dbGetAll<BazarRow>('bazar');
export const dbGetRent = () => dbGetAll<RentRecord>('rent');

export async function dbGetMembers(): Promise<Member[]> {
  const { data, error } = await getClient()
    .from('members')
    .select('*')
    .eq('mess_id', getMessId())
    .order('created_at');
  if (error) throw error;
  return (data as Member[]) || [];
}

/** All utility_payments rows for the mess (the web app queries this directly). */
export async function dbGetUtility(): Promise<UtilityRecord[]> {
  const { data, error } = await getClient()
    .from('utility_payments')
    .select('*')
    .eq('mess_id', getMessId());
  if (error) throw error;
  return (data as UtilityRecord[]) || [];
}

export async function dbGetRentMonth(key: string): Promise<RentRecord | null> {
  const { data, error } = await getClient()
    .from('rent')
    .select('*')
    .eq('mess_id', getMessId())
    .eq('month_key', key)
    .maybeSingle();
  if (error) throw error;
  return (data as RentRecord) || null;
}

export async function dbGetUtilityMonth(key: string): Promise<UtilityRecord | null> {
  const { data, error } = await getClient()
    .from('utility_payments')
    .select('*')
    .eq('mess_id', getMessId())
    .eq('month_key', key)
    .maybeSingle();
  if (error) throw error;
  return (data as UtilityRecord) || null;
}

export async function dbGetAnnouncements() {
  const { data, error } = await getClient()
    .from('announcements')
    .select('*')
    .eq('mess_id', getMessId())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Connectivity check — used to show the "Connected" indicator. */
export async function checkDb(): Promise<boolean> {
  try {
    const { error } = await getClient().from('messes').select('id', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}
