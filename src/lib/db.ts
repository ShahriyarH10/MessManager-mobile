/**
 * Database access — ported from js/core/db.js and js/core/db-ext.js.
 *
 * Note: the web app's `sanitize()` HTML-escapes every string on read (XSS
 * defense for innerHTML rendering). React Native has no HTML sink, and escaping
 * would corrupt displayed names ("A & B" -> "A &amp; B"), so we skip it here.
 */
import { getClient } from './supabase';
import { getMessId, getSession } from './session';
import { withCache } from './offline';
import { MONTHS } from '../core/format';
import type {
  Member,
  MealRow,
  BazarRow,
  RentRecord,
  RentEntry,
  UtilityRecord,
  UtilityPayment,
} from '../core/types';

function orderColumn(table: string): string {
  if (table === 'meals' || table === 'bazar') return 'date';
  if (table === 'rent') return 'month_key';
  return 'created_at';
}

/** Paginated full-table fetch scoped to the current mess (Supabase caps at 1000/page). */
export async function dbGetAll<T = any>(table: string): Promise<T[]> {
  return withCache(`all_${table}`, async () => {
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
  });
}

export const dbGetMeals = () => dbGetAll<MealRow>('meals');
export const dbGetBazar = () => dbGetAll<BazarRow>('bazar');
export const dbGetRent = () => dbGetAll<RentRecord>('rent');

export async function dbGetMembers(): Promise<Member[]> {
  return withCache('members', async () => {
    const { data, error } = await getClient()
      .from('members')
      .select('*')
      .eq('mess_id', getMessId())
      .order('created_at');
    if (error) throw error;
    return (data as Member[]) || [];
  });
}

export async function dbGetUtility(): Promise<UtilityRecord[]> {
  return withCache('utility', async () => {
    const { data, error } = await getClient()
      .from('utility_payments')
      .select('*')
      .eq('mess_id', getMessId());
    if (error) throw error;
    return (data as UtilityRecord[]) || [];
  });
}

export async function dbGetMealByDate(date: string): Promise<MealRow | null> {
  const { data, error } = await getClient()
    .from('meals')
    .select('*')
    .eq('mess_id', getMessId())
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return (data as MealRow) || null;
}

export async function dbGetBazarByDate(date: string): Promise<BazarRow | null> {
  const { data, error } = await getClient()
    .from('bazar')
    .select('*')
    .eq('mess_id', getMessId())
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return (data as BazarRow) || null;
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

/* ── Writes ─────────────────────────────────────────────── */

export async function dbUpsertMeals(date: string, meals: Record<string, number>): Promise<void> {
  const { error } = await getClient()
    .from('meals')
    .upsert({ mess_id: getMessId(), date, meals }, { onConflict: 'mess_id,date' });
  if (error) throw error;
}

export async function dbUpsertBazar(date: string, bazar: Record<string, number>): Promise<void> {
  const ex = await dbGetBazarByDate(date);
  const { error } = await getClient()
    .from('bazar')
    .upsert(
      { mess_id: getMessId(), date, bazar, utility: ex?.utility || {} },
      { onConflict: 'mess_id,date' },
    );
  if (error) throw error;
}

export async function dbUpsertRent(
  month: number,
  year: number,
  key: string,
  entries: RentEntry[],
): Promise<void> {
  const { error } = await getClient()
    .from('rent')
    .upsert(
      { mess_id: getMessId(), month_key: key, month, year, month_name: MONTHS[month], entries },
      { onConflict: 'mess_id,month_key' },
    );
  if (error) throw error;
}

export async function dbUpsertUtility(
  month: number,
  year: number,
  key: string,
  bills: Record<string, unknown>,
  payments: Record<string, UtilityPayment>,
): Promise<void> {
  const { error } = await getClient()
    .from('utility_payments')
    .upsert(
      { mess_id: getMessId(), month_key: key, month, year, month_name: MONTHS[month], bills, payments },
      { onConflict: 'mess_id,month_key' },
    );
  if (error) throw error;
}

/* ── Members admin ─────────────────────────────────────── */

export type MemberInput = {
  id?: string;
  name: string;
  username: string;
  password?: string;
  role?: string;
  room?: string;
  phone?: string;
  joined?: string | null;
  meal_default_day?: number;
  meal_default_night?: number;
};

export async function dbSaveMember(row: MemberInput): Promise<void> {
  const payload: Record<string, unknown> = {
    name: row.name,
    username: row.username,
    role: row.role || 'member',
    room: row.room || '',
    phone: row.phone || '',
    joined: row.joined || null,
    meal_default_day: row.meal_default_day ?? 1,
    meal_default_night: row.meal_default_night ?? 1,
    mess_id: getMessId(),
  };
  if (row.password) payload.password = row.password;
  if (row.id) {
    const { error } = await getClient().from('members').update(payload).eq('id', row.id);
    if (error) throw error;
  } else {
    if (!payload.password) throw new Error('Password is required for new members');
    const { error } = await getClient().from('members').insert(payload);
    if (error) throw error;
  }
}

export async function dbDeleteMember(id: string): Promise<void> {
  const { error } = await getClient().from('members').delete().eq('id', id);
  if (error) throw error;
}

export async function dbSetMemberRole(id: string, role: string): Promise<void> {
  const { error } = await getClient().from('members').update({ role }).eq('id', id);
  if (error) throw error;
}

export async function dbSetMemberPassword(id: string, passwordHash: string): Promise<void> {
  const { error } = await getClient().from('members').update({ password: passwordHash }).eq('id', id);
  if (error) throw error;
}

/* ── Notifications ──────────────────────────────────────── */

export type NotificationRow = {
  id: string;
  type: string;
  from_id: string | null;
  from_name: string;
  date: string;
  data: any;
  note: string;
  status: string;
  created_at: string;
};

export async function dbSaveNotification(row: {
  type: string;
  date: string;
  data: any;
  note?: string;
  status?: string;
}): Promise<void> {
  const u = getSession()?.user;
  const { error } = await getClient().from('notifications').insert({
    mess_id: getMessId(),
    type: row.type,
    from_id: u?.memberId ?? null,
    from_name: u?.name ?? 'Member',
    date: row.date,
    data: row.data,
    note: row.note || '',
    status: row.status || 'new',
  });
  if (error) throw error;
}

export async function dbGetNotifications(statusFilter?: string): Promise<NotificationRow[]> {
  let q = getClient()
    .from('notifications')
    .select('*')
    .eq('mess_id', getMessId())
    .order('created_at', { ascending: false });
  if (statusFilter) q = q.eq('status', statusFilter);
  const { data, error } = await q;
  if (error) throw error;
  return (data as NotificationRow[]) || [];
}

/** Most recent notifications (any status) — used by the notification poller. */
export async function dbGetRecentNotifications(limit = 20): Promise<NotificationRow[]> {
  const { data, error } = await getClient()
    .from('notifications')
    .select('*')
    .eq('mess_id', getMessId())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as NotificationRow[]) || [];
}

export async function dbUpdateNotifStatus(id: string, status: string): Promise<void> {
  const { error } = await getClient().from('notifications').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function getPendingCount(): Promise<number> {
  const { count, error } = await getClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('mess_id', getMessId())
    .in('status', ['new', 'pending']);
  if (error) return 0;
  return count || 0;
}

/* ── Push tokens ────────────────────────────────────────── */

/** Register / refresh this device's Expo push token for the signed-in member. */
export async function dbUpsertPushToken(token: string, platform: string): Promise<void> {
  const u = getSession()?.user;
  const messId = getSession()?.mess?.id;
  if (!u || !messId) return;
  const { error } = await getClient()
    .from('push_tokens')
    .upsert(
      {
        mess_id: messId,
        member_id: u.memberId,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
  if (error) throw error;
}

/** Drop this device's token (called on sign-out). */
export async function dbDeletePushToken(token: string): Promise<void> {
  await getClient().from('push_tokens').delete().eq('token', token);
}

/** How many device tokens the backend currently has for the signed-in member. */
export async function dbCountPushTokensForMember(): Promise<number> {
  const u = getSession()?.user;
  if (!u?.memberId) return 0;
  const { count, error } = await getClient()
    .from('push_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', u.memberId);
  if (error) return 0;
  return count || 0;
}

/* ── Announcements ──────────────────────────────────────── */

export type Announcement = {
  id: string;
  title: string;
  body: string;
  author: string;
  pinned: boolean;
  created_at: string;
};

export async function dbGetAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await getClient()
    .from('announcements')
    .select('*')
    .eq('mess_id', getMessId())
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Announcement[]) || [];
}

export async function dbSaveAnnouncement(row: {
  id?: string;
  title: string;
  body: string;
  pinned: boolean;
}): Promise<void> {
  const u = getSession()?.user;
  if (row.id) {
    const { error } = await getClient()
      .from('announcements')
      .update({ title: row.title, body: row.body, pinned: row.pinned })
      .eq('id', row.id);
    if (error) throw error;
  } else {
    const { error } = await getClient().from('announcements').insert({
      mess_id: getMessId(),
      title: row.title,
      body: row.body,
      pinned: row.pinned || false,
      author: u?.name ?? 'Manager',
    });
    if (error) throw error;
  }
}

export async function dbDeleteAnnouncement(id: string): Promise<void> {
  const { error } = await getClient().from('announcements').delete().eq('id', id);
  if (error) throw error;
}

/* ── Mess Rules ─────────────────────────────────────────── */

export type MessRules = {
  wifi_pass?: string;
  bank_info?: string;
  rules_text?: string;
  contacts?: string;
};

export async function dbGetMessRules(): Promise<MessRules | null> {
  return withCache('mess_rules', async () => {
    const { data, error } = await getClient()
      .from('mess_rules')
      .select('*')
      .eq('mess_id', getMessId())
      .maybeSingle();
    if (error) throw error;
    return (data as MessRules) || null;
  });
}

export async function dbSaveMessRules(rules: MessRules): Promise<void> {
  const { error } = await getClient()
    .from('mess_rules')
    .upsert(
      {
        mess_id: getMessId(),
        wifi_pass: rules.wifi_pass || '',
        bank_info: rules.bank_info || '',
        rules_text: rules.rules_text || '',
        contacts: rules.contacts || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'mess_id' },
    );
  if (error) throw error;
}

/* ── Broadcasts ─────────────────────────────────────────── */

export type Broadcast = {
  id: string;
  message: string;
  priority: string;
  pinned: boolean;
  author: string;
  expires_at: string | null;
  created_at: string;
};

/** All broadcasts (pinned first). Filter expired at the call site for members. */
export async function dbGetBroadcastsRaw(): Promise<Broadcast[]> {
  return withCache('broadcasts', async () => {
    const { data, error } = await getClient()
      .from('broadcasts')
      .select('*')
      .eq('mess_id', getMessId())
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data as Broadcast[]) || [];
  });
}

export async function dbGetActiveBroadcasts(): Promise<Broadcast[]> {
  const all = await dbGetBroadcastsRaw();
  const now = Date.now();
  return all.filter((b) => !b.expires_at || new Date(b.expires_at).getTime() > now);
}

export async function dbPostBroadcast(
  message: string,
  priority: string,
  pinned: boolean,
  expiresInHours: number | null,
): Promise<void> {
  const u = getSession()?.user;
  const { error } = await getClient().from('broadcasts').insert({
    mess_id: getMessId(),
    message,
    priority,
    pinned,
    author: u?.name ?? 'Manager',
    expires_at: expiresInHours ? new Date(Date.now() + expiresInHours * 3600000).toISOString() : null,
  });
  if (error) throw error;
}

export async function dbDeleteBroadcast(id: string): Promise<void> {
  const { error } = await getClient().from('broadcasts').delete().eq('id', id);
  if (error) throw error;
}

export async function dbSetBroadcastPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await getClient().from('broadcasts').update({ pinned }).eq('id', id);
  if (error) throw error;
}

/* ── Mess fund (stored in utility_payments.bills.fund_entries) ── */

export type FundEntry = {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  note: string;
  actor: string;
  month_key: string;
};

export async function dbGetFundEntries(): Promise<FundEntry[]> {
  const { data, error } = await getClient()
    .from('utility_payments')
    .select('bills,month_key')
    .eq('mess_id', getMessId())
    .order('month_key', { ascending: false });
  if (error) throw error;
  const out: FundEntry[] = [];
  (data || []).forEach((row: any) => {
    ((row.bills?.fund_entries as any[]) || []).forEach((e) => out.push({ ...e, month_key: row.month_key }));
  });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export async function dbAddFundEntry(entry: {
  type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  note: string;
}): Promise<void> {
  const key = entry.date.slice(0, 7);
  const [y, m] = key.split('-').map(Number);
  const rec = await dbGetUtilityMonth(key);
  const bills = { ...((rec?.bills || {}) as Record<string, any>) };
  const entries = [...(bills.fund_entries || [])];
  entries.push({
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    type: entry.type,
    amount: entry.amount,
    date: entry.date,
    note: entry.note,
    actor: getSession()?.user.name ?? 'Manager',
    created: new Date().toISOString(),
  });
  bills.fund_entries = entries;
  await dbUpsertUtility(m - 1, y, key, bills, rec?.payments || {});
}

export async function dbDeleteFundEntry(monthKey: string, entryId: string): Promise<void> {
  const [y, m] = monthKey.split('-').map(Number);
  const rec = await dbGetUtilityMonth(monthKey);
  if (!rec) return;
  const bills = { ...((rec.bills || {}) as Record<string, any>) };
  bills.fund_entries = (bills.fund_entries || []).filter((e: any) => e.id !== entryId);
  await dbUpsertUtility(m - 1, y, monthKey, bills, rec.payments || {});
}

/* ── Meal attendance (absence toggle) ───────────────────── */

export type AttendanceRow = {
  id: string;
  member_id: string;
  date: string;
  day_meal: boolean;
  night_meal: boolean;
};

export async function dbGetMyUpcomingAbsences(memberId: string, fromDate: string): Promise<AttendanceRow[]> {
  const { data, error } = await getClient()
    .from('meal_attendance')
    .select('*')
    .eq('mess_id', getMessId())
    .eq('member_id', memberId)
    .gte('date', fromDate)
    .order('date', { ascending: true })
    .limit(60);
  if (error) throw error;
  return ((data as AttendanceRow[]) || []).filter((a) => !a.day_meal || !a.night_meal);
}

export async function dbSetAttendance(
  memberId: string,
  date: string,
  dayMeal: boolean,
  nightMeal: boolean,
): Promise<void> {
  const { error } = await getClient()
    .from('meal_attendance')
    .upsert(
      {
        mess_id: getMessId(),
        member_id: memberId,
        date,
        day_meal: dayMeal,
        night_meal: nightMeal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'mess_id,member_id,date' },
    );
  if (error) throw error;
}

export async function dbDeleteAttendance(id: string): Promise<void> {
  const { error } = await getClient().from('meal_attendance').delete().eq('id', id);
  if (error) throw error;
}

export async function dbGetAttendanceForDate(date: string): Promise<AttendanceRow[]> {
  const { data, error } = await getClient()
    .from('meal_attendance')
    .select('*')
    .eq('mess_id', getMessId())
    .eq('date', date);
  if (error) throw error;
  return (data as AttendanceRow[]) || [];
}

export async function dbGetAttendanceRange(from: string, to: string): Promise<AttendanceRow[]> {
  const { data, error } = await getClient()
    .from('meal_attendance')
    .select('*')
    .eq('mess_id', getMessId())
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;
  return (data as AttendanceRow[]) || [];
}

/* ── Row delete (meals/bazar) ──────────────────────────── */

export async function dbDeleteRow(table: string, id: string): Promise<void> {
  const { error } = await getClient().from(table).delete().eq('id', id).eq('mess_id', getMessId());
  if (error) throw error;
}

/* ── Month lock ────────────────────────────────────────── */

export async function isMonthLocked(key: string): Promise<boolean> {
  try {
    const { data } = await getClient()
      .from('utility_payments')
      .select('bills')
      .eq('mess_id', getMessId())
      .eq('month_key', key)
      .maybeSingle();
    return !!(data?.bills as any)?.locked;
  } catch {
    return false;
  }
}

export async function dbSetMonthLocked(key: string, locked: boolean): Promise<void> {
  const [y, m] = key.split('-').map(Number);
  const rec = await dbGetUtilityMonth(key);
  const bills = { ...((rec?.bills || {}) as Record<string, unknown>) };
  if (locked) bills.locked = true;
  else delete bills.locked;
  await dbUpsertUtility(m - 1, y, key, bills, rec?.payments || {});
}

/** All month keys that have any data (meals/bazar/rent/utility) + their lock state. */
export async function dbGetMonthLockList(): Promise<
  { key: string; locked: boolean; mealDays: number; bazarDays: number }[]
> {
  const [util, rent, meals, bazar] = await Promise.all([
    getClient().from('utility_payments').select('month_key,bills').eq('mess_id', getMessId()),
    getClient().from('rent').select('month_key').eq('mess_id', getMessId()),
    dbGetMeals(),
    dbGetBazar(),
  ]);
  const keys = new Set<string>();
  (util.data || []).forEach((r: any) => keys.add(r.month_key));
  (rent.data || []).forEach((r: any) => keys.add(r.month_key));
  meals.forEach((r) => keys.add(String(r.date || '').slice(0, 7)));
  bazar.forEach((r) => keys.add(String(r.date || '').slice(0, 7)));
  keys.delete('');
  const lockMap: Record<string, boolean> = {};
  (util.data || []).forEach((r: any) => (lockMap[r.month_key] = !!r.bills?.locked));
  return Array.from(keys)
    .filter(Boolean)
    .sort()
    .reverse()
    .slice(0, 24)
    .map((key) => ({
      key,
      locked: lockMap[key] || false,
      mealDays: meals.filter((r) => String(r.date || '').startsWith(key)).length,
      bazarDays: bazar.filter((r) => String(r.date || '').startsWith(key)).length,
    }));
}

/* ── Audit log ─────────────────────────────────────────── */

export type AuditRow = {
  id: string;
  actor_name: string;
  action: string;
  entity: string;
  entity_id: string;
  summary: string;
  details: any;
  created_at: string;
};

export async function logAudit(
  action: string,
  entity: string,
  entityId: string | number,
  summary: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    const u = getSession()?.user;
    await getClient().from('audit_log').insert({
      mess_id: getMessId(),
      actor_id: u?.memberId ?? null,
      actor_name: u?.name ?? 'Unknown',
      action,
      entity,
      entity_id: String(entityId || ''),
      summary,
      details,
    });
  } catch (e) {
    console.warn('[audit] failed', e);
  }
}

export async function dbGetAuditLog(
  limit = 50,
  offset = 0,
  entityFilter?: string | null,
): Promise<AuditRow[]> {
  let q = getClient()
    .from('audit_log')
    .select('*')
    .eq('mess_id', getMessId())
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (entityFilter) q = q.eq('entity', entityFilter);
  const { data, error } = await q;
  if (error) throw error;
  return (data as AuditRow[]) || [];
}

/* ── Connectivity ──────────────────────────────────────── */

export async function checkDb(): Promise<boolean> {
  try {
    const { error } = await getClient().from('messes').select('id', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}
