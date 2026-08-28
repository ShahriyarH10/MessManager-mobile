/**
 * Manager entry write flows — ported from js/manager/meals.js, bazar.js,
 * utility.js, and the utility half of bazar.js. All check the month lock and
 * write an audit-log entry, matching the web app.
 */
import {
  dbUpsertMeals,
  dbUpsertBazar,
  dbUpsertRent,
  dbUpsertUtility,
  dbGetUtilityMonth,
  isMonthLocked,
  logAudit,
} from './db';
import { round2, monthLabelFromKey } from '../core/format';
import { UTIL_PREPAID_KEYS, UTIL_POSTPAID_KEYS, utilTotalFromBills } from '../core/settlement';
import type { Member, RentEntry } from '../core/types';

export class LockedMonthError extends Error {}

async function assertUnlocked(key: string) {
  if (await isMonthLocked(key)) {
    throw new LockedMonthError(`${monthLabelFromKey(key)} is locked — unlock it first.`);
  }
}

/** members -> { [memberId]: { day, night } } */
export async function saveMeals(
  members: Member[],
  date: string,
  values: Record<string, { day: number; night: number }>,
): Promise<void> {
  await assertUnlocked(date.slice(0, 7));
  const meals: Record<string, number> = {};
  members.forEach((m) => {
    const v = values[m.id] || { day: 0, night: 0 };
    meals[m.name + '_day'] = v.day || 0;
    meals[m.name + '_night'] = v.night || 0;
    meals[m.name] = round2((v.day || 0) + (v.night || 0));
  });
  await dbUpsertMeals(date, meals);
  await logAudit('update', 'meal', date, `Meals saved for ${date}`);
}

/** members -> { [memberId]: amount } */
export async function saveBazar(
  members: Member[],
  date: string,
  values: Record<string, number>,
): Promise<void> {
  await assertUnlocked(date.slice(0, 7));
  const bazar: Record<string, number> = {};
  members.forEach((m) => {
    bazar[m.name] = values[m.id] || 0;
  });
  await dbUpsertBazar(date, bazar);
  await logAudit('update', 'bazar', date, `Bazar saved for ${date}`);
}

export async function saveRent(
  members: Member[],
  month: number,
  year: number,
  key: string,
  rows: Record<string, { rent: number; paid: number; status: string; notes: string }>,
): Promise<void> {
  await assertUnlocked(key);
  const entries: RentEntry[] = members.map((m) => {
    const r = rows[m.id] || { rent: 0, paid: 0, status: 'unpaid', notes: '' };
    return { name: m.name, rent: r.rent, paid: r.paid, status: r.status, notes: r.notes };
  });
  await dbUpsertRent(month, year, key, entries);
  await logAudit('update', 'rent', key, `Rent saved for ${monthLabelFromKey(key)}`);
}

/** type 'prepaid' -> {elec,gas,wifi}; 'postpaid' -> {khala,other} */
export async function saveUtilityBills(
  month: number,
  year: number,
  key: string,
  type: 'prepaid' | 'postpaid',
  amounts: Record<string, number>,
): Promise<void> {
  await assertUnlocked(key);
  const rec = await dbGetUtilityMonth(key);
  const bills = { ...(rec?.bills || {}) } as Record<string, unknown>;
  const fields = type === 'prepaid' ? ['elec', 'gas', 'wifi'] : ['khala', 'other'];
  fields.forEach((f) => {
    bills[f] = amounts[f] || 0;
  });
  await dbUpsertUtility(month, year, key, bills, rec?.payments || {});
  await logAudit('update', 'utility', key, `${type} bills saved for ${monthLabelFromKey(key)}`);
}

export async function saveUtilityPayments(
  members: Member[],
  month: number,
  year: number,
  key: string,
  rows: Record<string, { paid: number; status: string; notes: string }>,
): Promise<void> {
  await assertUnlocked(key);
  const rec = await dbGetUtilityMonth(key);
  const payments: Record<string, { paid: number; status: string; notes: string }> = {};
  members.forEach((m) => {
    const r = rows[m.id] || { paid: 0, status: 'unpaid', notes: '' };
    payments[m.name] = { paid: r.paid, status: r.status, notes: r.notes };
  });
  await dbUpsertUtility(month, year, key, rec?.bills || {}, payments);
  await logAudit('update', 'utility', key, `Utility payments saved for ${monthLabelFromKey(key)}`);
}

/** perHead due for a settlement month = current prepaid + previous postpaid, ÷ members. */
export async function utilityPerHead(key: string, prevKey: string, memberCount: number): Promise<{
  perHead: number;
  currentPrepaid: number;
  previousPostpaid: number;
}> {
  const [cur, prev] = await Promise.all([dbGetUtilityMonth(key), dbGetUtilityMonth(prevKey)]);
  const currentPrepaid = utilTotalFromBills(cur?.bills || {}, UTIL_PREPAID_KEYS);
  const previousPostpaid = utilTotalFromBills(prev?.bills || {}, UTIL_POSTPAID_KEYS);
  const total = round2(currentPrepaid + previousPostpaid);
  return {
    perHead: memberCount > 0 ? round2(total / memberCount) : 0,
    currentPrepaid,
    previousPostpaid,
  };
}
