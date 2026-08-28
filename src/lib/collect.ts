/**
 * Collect Payment data + save — ported from loadCollectMonth / saveCollectRow
 * in js/manager/collect.js.
 */
import {
  dbGetMeals,
  dbGetBazar,
  dbGetRent,
  dbGetUtility,
  dbGetMembers,
  dbGetUtilityMonth,
  dbGetRentMonth,
  dbUpsertUtility,
  dbUpsertRent,
  logAudit,
} from './db';
import { round2, monthKey, previousMonthFromKey } from '../core/format';
import { calcMemberSettlement, calcPrevDueForMember } from '../core/settlement';
import { computeSplit, type Split } from '../core/collect';
import type { Member } from '../core/types';

export type CollectRow = {
  id: string;
  name: string;
  phone?: string;
  mealRem: number; // mealCost - bazar - mealPaid  (can be negative = surplus)
  utilRem: number;
  rentRem: number;
  prevDue: number;
  netPayable: number;
  total: number; // netPayable + prevDue (what to collect)
  messCredit: number;
};

export async function loadCollectData(month: number, year: number): Promise<{
  key: string;
  rows: CollectRow[];
}> {
  const key = monthKey(year, month);
  const prevKey = previousMonthFromKey(key).key;
  const [members, meals, bazar, rent, utility] = await Promise.all([
    dbGetMembers(),
    dbGetMeals(),
    dbGetBazar(),
    dbGetRent(),
    dbGetUtility(),
  ]);
  const rentRec = rent.find((r) => r.month_key === key) ?? null;
  const utilRec = utility.find((u) => u.month_key === key) ?? null;
  const prevUtilRec = utility.find((u) => u.month_key === prevKey) ?? null;

  const rows: CollectRow[] = members.map((m: Member) => {
    const p = calcMemberSettlement(m, meals, bazar, rentRec, utilRec, prevUtilRec, key, members);
    const prevDue = calcPrevDueForMember(m, meals, bazar, rent, utility, key, members);
    const utilDue = round2(Math.max(0, p.prepaidUtility + p.postpaidUtility - p.messCredit));
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      mealRem: round2(p.mealCost - p.memberBazar - p.mealPaid),
      utilRem: round2(Math.max(0, utilDue - p.utilityPaid)),
      rentRem: round2(Math.max(0, p.roomRent - p.roomRentPaid)),
      prevDue: round2(prevDue),
      netPayable: p.netPayable,
      total: round2(p.netPayable + prevDue),
      messCredit: p.messCredit,
    };
  });

  return { key, rows };
}

export async function saveCollectRow(
  members: Member[],
  month: number,
  year: number,
  key: string,
  row: CollectRow,
  amount: number,
): Promise<Split & { newNet: number }> {
  const split = computeSplit(amount, row.mealRem, row.utilRem, row.rentRem, row.prevDue);
  const { allocMeal, allocUtil, allocRent, allocPrevDue, change } = split;
  const member = members.find((m) => m.id === row.id);
  if (!member) throw new Error('Member not found');

  // 1) utility_payments: paid / meal_paid / prev_due_paid
  if (allocUtil > 0 || allocMeal > 0 || allocPrevDue > 0) {
    const rec = await dbGetUtilityMonth(key);
    const bills = (rec?.bills || {}) as Record<string, unknown>;
    const payments = { ...(rec?.payments || {}) };
    const cur = payments[member.name] || {};
    const newPaid = round2(Number(cur.paid || 0) + allocUtil);
    const utilDue = round2(Math.max(0, row.utilRem + Number(cur.paid || 0)));
    payments[member.name] = {
      ...cur,
      paid: newPaid,
      meal_paid: round2(Number(cur.meal_paid || 0) + allocMeal),
      prev_due_paid: round2(Number(cur.prev_due_paid || 0) + allocPrevDue),
      status: newPaid <= 0 ? 'unpaid' : newPaid >= utilDue ? 'paid' : 'partial',
      notes: cur.notes || '',
    };
    await dbUpsertUtility(month, year, key, bills, payments);
  }

  // 2) rent
  if (allocRent > 0) {
    const rec = await dbGetRentMonth(key);
    const existing = rec?.entries || [];
    const entries = members.map((mm) => {
      const e = existing.find((x) => x.name === mm.name) || ({} as any);
      return {
        name: mm.name,
        rent: Number(e.rent || 0),
        paid: Number(e.paid || 0),
        status: e.status || 'unpaid',
        notes: e.notes || '',
      };
    });
    const target = entries.find((x) => x.name === member.name)!;
    target.paid = round2(target.paid + allocRent);
    target.status = target.paid <= 0 ? 'unpaid' : target.paid >= target.rent ? 'paid' : 'partial';
    await dbUpsertRent(month, year, key, entries);
  }

  // 3) persist pending change
  if (change > 0) {
    const rec = await dbGetUtilityMonth(key);
    const bills = { ...((rec?.bills || {}) as Record<string, any>) };
    const pending = { ...(bills.pending_change || {}) };
    pending[member.name] = round2(Number(pending[member.name] || 0) + change);
    bills.pending_change = pending;
    await dbUpsertUtility(month, year, key, bills, rec?.payments || {});
  }

  await logAudit('update', 'collect', key, `Collected ${amount} from ${member.name}`, split);

  const newNet = round2(row.netPayable - allocMeal - allocUtil - allocRent);
  return { ...split, newNet };
}
