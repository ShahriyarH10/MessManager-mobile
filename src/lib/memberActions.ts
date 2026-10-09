/**
 * Member self-service write flows — ported from js/member/pages.js and the
 * absence-range helpers in js/manager/features.js.
 *
 * Each flow writes the member's own data directly and files an "update"
 * notification so the manager sees what changed.
 */
import {
  dbGetMealByDate,
  dbGetBazarByDate,
  dbGetRentMonth,
  dbGetUtilityMonth,
  dbUpsertMeals,
  dbUpsertBazar,
  dbUpsertRent,
  dbUpsertUtility,
  dbSaveNotification,
  dbSetAttendance,
  isMonthLocked,
  dbCreateMemberPayment,
} from './db';
import { round2, monthKey, todayStr, MONTHS, previousMonth, monthLabelFromKey } from '../core/format';
import { UTIL_PREPAID_KEYS, UTIL_POSTPAID_KEYS, utilTotalFromBills } from '../core/settlement';
import type { Member, RentEntry, MemberPayment } from '../core/types';

async function notifyManager(type: string, date: string, data: any, note = ''): Promise<void> {
  await dbSaveNotification({ type, date, data, note, status: 'new' });
}

/* ── Meals ─────────────────────────────────────────────── */

export async function saveMyMeal(
  member: Member,
  members: Member[],
  date: string,
  day: number,
  night: number,
  note = '',
): Promise<void> {
  if (day < 0 || night < 0) throw new Error('Meal count cannot be negative');
  const existing = await dbGetMealByDate(date);
  const merged: Record<string, number> = { ...(existing?.meals || {}) };
  merged[member.name + '_day'] = day;
  merged[member.name + '_night'] = night;
  merged[member.name] = round2(day + night);
  members.forEach((m) => {
    if (merged[m.name + '_day'] != null || merged[m.name + '_night'] != null) {
      merged[m.name] = round2(Number(merged[m.name + '_day'] || 0) + Number(merged[m.name + '_night'] || 0));
    }
  });
  await dbUpsertMeals(date, merged);
  await notifyManager('meal_update', date, { member: member.name, day, night, total: round2(day + night) }, note);
}

/* ── Bazar ─────────────────────────────────────────────── */

export async function saveMyBazar(
  member: Member,
  date: string,
  amount: number,
  note = '',
): Promise<void> {
  if (amount < 0) throw new Error('Amount cannot be negative');
  const existing = await dbGetBazarByDate(date);
  const merged: Record<string, number> = { ...(existing?.bazar || {}) };
  merged[member.name] = amount;
  await dbUpsertBazar(date, merged);
  await notifyManager('bazar_update', date, { member: member.name, amount }, note);
}

/* ── Utility / Rent payment ────────────────────────────── */

export type PaymentType = 'elec' | 'wifi' | 'gas' | 'khala' | 'other' | 'rent';

const PAYMENT_LABEL: Record<PaymentType, string> = {
  elec: 'Electricity',
  wifi: 'WiFi',
  gas: 'Gas',
  khala: 'Khala',
  other: 'Other',
  rent: 'Room Rent',
};

export async function saveMyPayment(
  member: Member,
  members: Member[],
  month: number,
  year: number,
  billType: PaymentType,
  amount: number,
  note = '',
): Promise<void> {
  if (amount <= 0) throw new Error('Enter a valid amount');
  const key = monthKey(year, month);

  if (billType === 'rent') {
    const rentRec = await dbGetRentMonth(key);
    let entries: RentEntry[] = rentRec?.entries
      ? rentRec.entries.map((e) => ({ ...e }))
      : members.map((m) => ({ name: m.name, rent: 0, paid: 0, status: 'unpaid', notes: '' }));

    let found = false;
    entries = entries.map((e) => {
      if (e.name !== member.name) return e;
      found = true;
      const rentDue = Number(e.rent || 0);
      const newPaid = round2(Number(e.paid || 0) + amount);
      return {
        ...e,
        paid: newPaid,
        status: rentDue > 0 && newPaid >= rentDue ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid',
        notes: note || `Paid ৳${amount} by member`,
      };
    });
    if (!found) {
      entries.push({ name: member.name, rent: 0, paid: amount, status: 'partial', notes: note || `Paid ৳${amount} by member` });
    }
    await dbUpsertRent(month, year, key, entries);
    await notifyManager(
      'rent_update',
      todayStr(),
      { member: member.name, monthKey: key, monthName: MONTHS[month], year, amount },
      note,
    );
    return;
  }

  const prev = previousMonth(month, year);
  const [curRec, prevRec] = await Promise.all([dbGetUtilityMonth(key), dbGetUtilityMonth(prev.key)]);
  const currentPrepaid = utilTotalFromBills(curRec?.bills || {}, UTIL_PREPAID_KEYS);
  const previousPostpaid = utilTotalFromBills(prevRec?.bills || {}, UTIL_POSTPAID_KEYS);
  const myShare = members.length > 0 ? round2((currentPrepaid + previousPostpaid) / members.length) : 0;

  const payments = { ...(curRec?.payments || {}) };
  const old = payments[member.name] || { paid: 0, status: 'unpaid', notes: '' };
  const newPaid = round2(Number(old.paid || 0) + amount);
  payments[member.name] = {
    ...old,
    paid: newPaid,
    status: myShare > 0 && newPaid >= myShare ? 'paid' : 'partial',
    notes: note || `Paid ৳${amount} for ${PAYMENT_LABEL[billType]}`,
  };
  await dbUpsertUtility(month, year, key, curRec?.bills || {}, payments);
  await notifyManager(
    'utility_update',
    todayStr(),
    { member: member.name, billType, billLabel: PAYMENT_LABEL[billType], monthKey: key, monthName: MONTHS[month], year, amount },
    note,
  );
}

/* ── Give payment (month-end settlement request) ───────── */

/**
 * The member says "I am giving ৳X for this month". This only files a PENDING
 * request and notifies the managers — nothing is credited to rent / utility /
 * meals until a manager confirms it (see confirmMemberPayment).
 */
export async function submitMyPayment(
  member: Member,
  month: number,
  year: number,
  dueNow: number,
  amount: number,
): Promise<MemberPayment> {
  if (!(amount > 0)) throw new Error('Enter a valid amount');
  const key = monthKey(year, month);
  if (await isMonthLocked(key)) {
    throw new Error(`${monthLabelFromKey(key)} is closed by the manager — contact them to pay.`);
  }
  const payment = await dbCreateMemberPayment({
    memberId: member.id,
    memberName: member.name,
    monthKey: key,
    month,
    year,
    amount,
    dueAtSubmit: dueNow,
  });
  try {
    await notifyManager(
      'payment_request',
      todayStr(),
      { member: member.name, paymentId: payment.id, monthKey: key, monthName: MONTHS[month], year, amount },
      `Wants to give ৳${amount} for ${MONTHS[month]} ${year} — please confirm`,
    );
  } catch {
    /* the request itself is saved; the manager still sees it in Collect */
  }
  return payment;
}

/* ── Absence range ─────────────────────────────────────── */

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (cur <= end) {
    out.push(todayStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function markAbsenceRange(
  memberId: string,
  from: string,
  to: string,
  skipDay: boolean,
  skipNight: boolean,
): Promise<number> {
  if (to < from) throw new Error('End date must be on or after the start date');
  if (!skipDay && !skipNight) throw new Error('Choose at least one meal to skip');
  const dates = enumerateDates(from, to);
  if (dates.length > 90) throw new Error('Range too large (max 90 days)');
  await Promise.all(dates.map((d) => dbSetAttendance(memberId, d, !skipDay, !skipNight)));
  return dates.length;
}

export async function clearAbsenceRange(memberId: string, from: string, to: string): Promise<number> {
  if (to < from) throw new Error('End date must be on or after the start date');
  const dates = enumerateDates(from, to);
  if (dates.length > 90) throw new Error('Range too large (max 90 days)');
  await Promise.all(dates.map((d) => dbSetAttendance(memberId, d, true, true)));
  return dates.length;
}
