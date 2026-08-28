/**
 * Collect Payment data + save — ported from loadCollectMonth / saveCollectRow /
 * saveChangeRow / saveCreditRow in js/manager/collect.js.
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
import { round2, monthKey, previousMonthFromKey, nextMonth } from '../core/format';
import { calcMemberSettlement, calcPrevDueForMember } from '../core/settlement';
import { computeSplit, type Split } from '../core/collect';
import type { Member } from '../core/types';

export type CollectRow = {
  id: string;
  name: string;
  phone?: string;
  mealRem: number;
  utilRem: number;
  rentRem: number;
  prevDue: number;
  netPayable: number;
  total: number;
  messCredit: number;
  creditPaid: number;
  /** overpayment persisted this month, not yet returned/carried */
  pendingChange: number;
  /** change already carried to next month */
  existingChangeCredit: number;
  /** mess-owes credit already carried to next month */
  existingCarryCredit: number;
};

export type CollectData = {
  key: string;
  nextKey: string;
  nextMonth: number;
  nextYear: number;
  rows: CollectRow[];
};

export async function loadCollectData(month: number, year: number): Promise<CollectData> {
  const key = monthKey(year, month);
  const prevKey = previousMonthFromKey(key).key;
  const nx = nextMonth(month, year);
  const [members, meals, bazar, rent, utility, utilNext] = await Promise.all([
    dbGetMembers(),
    dbGetMeals(),
    dbGetBazar(),
    dbGetRent(),
    dbGetUtility(),
    dbGetUtilityMonth(nx.key),
  ]);
  const rentRec = rent.find((r) => r.month_key === key) ?? null;
  const utilRec = utility.find((u) => u.month_key === key) ?? null;
  const prevUtilRec = utility.find((u) => u.month_key === prevKey) ?? null;

  const existingCredits = ((utilNext?.bills as any)?.mess_credit || {}) as Record<string, number>;
  const existingChangeCredits = ((utilNext?.bills as any)?.change_credit || {}) as Record<string, number>;
  const pendingChangeBills = ((utilRec?.bills as any)?.pending_change || {}) as Record<string, number>;

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
      creditPaid: p.creditPaid || 0,
      pendingChange: round2(Number(pendingChangeBills[m.name] || 0)),
      existingChangeCredit: round2(Number(existingChangeCredits[m.name] || 0)),
      existingCarryCredit: round2(Number(existingCredits[m.name] || 0)),
    };
  });

  return { key, nextKey: nx.key, nextMonth: nx.month, nextYear: nx.year, rows };
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

/**
 * Resolve an overpayment: hand `cashNow` back, carry the rest to next month's
 * bills.change_credit; clear this month's pending_change entry.
 */
export async function saveChangeRow(
  memberName: string,
  month: number,
  year: number,
  key: string,
  nextMonthIdx: number,
  nextYear: number,
  nextKey: string,
  row: CollectRow,
  cashNowRaw: number,
): Promise<{ cashNow: number; carry: number }> {
  const remaining = round2(Math.max(0, row.pendingChange - row.existingChangeCredit));
  const cashNow = round2(Math.min(Math.max(0, cashNowRaw), remaining));
  const carry = round2(remaining - cashNow);

  const nextRec = await dbGetUtilityMonth(nextKey);
  const nextBills = { ...((nextRec?.bills || {}) as Record<string, any>) };
  const changeCredits = { ...(nextBills.change_credit || {}) };
  if (carry > 0) changeCredits[memberName] = carry;
  else delete changeCredits[memberName];
  nextBills.change_credit = changeCredits;
  await dbUpsertUtility(nextMonthIdx, nextYear, nextKey, nextBills, nextRec?.payments || {});

  const curRec = await dbGetUtilityMonth(key);
  const curBills = { ...((curRec?.bills || {}) as Record<string, any>) };
  const pending = { ...(curBills.pending_change || {}) };
  delete pending[memberName];
  if (Object.keys(pending).length === 0) delete curBills.pending_change;
  else curBills.pending_change = pending;
  await dbUpsertUtility(month, year, key, curBills, curRec?.payments || {});

  await logAudit('update', 'collect', key, `Change to ${memberName}: cash ${cashNow}, carry ${carry}`);
  return { cashNow, carry };
}

/**
 * Draw down a "mess owes" credit: record `cashNow` as credit_paid this month,
 * carry the rest to next month's bills.mess_credit.
 */
export async function saveCreditRow(
  memberName: string,
  month: number,
  year: number,
  key: string,
  nextMonthIdx: number,
  nextYear: number,
  nextKey: string,
  row: CollectRow,
  cashNowRaw: number,
): Promise<{ cashNow: number; carry: number }> {
  const messOwes = round2(Math.abs(row.netPayable));
  const remaining = round2(Math.max(0, messOwes - row.existingCarryCredit));
  const cashNow = round2(Math.min(Math.max(0, cashNowRaw), remaining));
  const carry = round2(remaining - cashNow);

  if (cashNow > 0) {
    const curRec = await dbGetUtilityMonth(key);
    const curBills = (curRec?.bills || {}) as Record<string, unknown>;
    const payments = { ...(curRec?.payments || {}) };
    const cur = { ...(payments[memberName] || {}) };
    cur.credit_paid = round2(Number(cur.credit_paid || 0) + cashNow);
    payments[memberName] = cur;
    await dbUpsertUtility(month, year, key, curBills, payments);
  }

  const nextRec = await dbGetUtilityMonth(nextKey);
  const nextBills = { ...((nextRec?.bills || {}) as Record<string, any>) };
  const credit = { ...(nextBills.mess_credit || {}) };
  if (carry > 0) credit[memberName] = carry;
  else delete credit[memberName];
  nextBills.mess_credit = credit;
  await dbUpsertUtility(nextMonthIdx, nextYear, nextKey, nextBills, nextRec?.payments || {});

  await logAudit('update', 'collect', key, `Mess-owes to ${memberName}: cash ${cashNow}, carry ${carry}`);
  return { cashNow, carry };
}
