/**
 * Settlement formula — the single source of truth, ported from
 * js/core/helpers.js (calcSettlementTotals / calcMemberSettlement /
 * calcPrevDueForMember).
 *
 * The one structural change from the web version: the web functions read a
 * module-global `members` array; here `members` is an explicit parameter so the
 * math is pure and testable.
 *
 * Settlement model (see README of the web app):
 *   Postpaid  (from previous month) : meal cost, khala share, other share
 *   Prepaid   (from current month)  : room rent, utility share (elec+gas+wifi)
 *   Credits   (deducted)            : bazar, rent paid, utility paid, meal paid,
 *                                     carry-forward, previous due paid
 */
import { round2, monthIndexFromKey, yearFromKey, previousMonth, previousMonthFromKey } from './format';
import type { Member, MealRow, BazarRow, RentRecord, UtilityRecord } from './types';

export const UTIL_PREPAID_KEYS = ['elec', 'gas', 'wifi'] as const;
export const UTIL_POSTPAID_KEYS = ['khala', 'other'] as const;
export const UTIL_ALL_KEYS = [...UTIL_PREPAID_KEYS, ...UTIL_POSTPAID_KEYS];

export function utilTotalFromBills(
  bills: Record<string, unknown> | null | undefined,
  keys: readonly string[] = UTIL_ALL_KEYS,
): number {
  return keys.reduce((sum, key) => sum + Number((bills as any)?.[key] || 0), 0);
}

export function calcSettlementSourceKey(settlementMonth: number, settlementYear: number): string {
  return previousMonth(settlementMonth, settlementYear).key;
}

export type SettlementTotals = {
  totalMeals: number;
  totalBazar: number;
  mealRate: number;
  memberMeals: Record<string, number>;
  memberBazar: Record<string, number>;
};

export function calcSettlementTotals(
  allMeals: MealRow[] | null,
  allBazar: BazarRow[] | null,
  sourceKey: string,
  members: Member[],
): SettlementTotals {
  const mealRows = (allMeals || []).filter((r) => String(r.date || '').startsWith(sourceKey));
  const bazarRows = (allBazar || []).filter((r) => String(r.date || '').startsWith(sourceKey));
  const memberMeals: Record<string, number> = {};
  const memberBazar: Record<string, number> = {};
  members.forEach((m) => {
    memberMeals[m.name] = 0;
    memberBazar[m.name] = 0;
  });
  let totalMeals = 0;
  let totalBazar = 0;

  mealRows.forEach((row) => {
    const mObj = row.meals || {};
    const keys = Object.keys(mObj);
    const hasSplit = keys.some((k) => k.endsWith('_day') || k.endsWith('_night'));

    if (hasSplit) {
      keys.forEach((k) => {
        if (k.endsWith('_day') || k.endsWith('_night')) totalMeals += Number(mObj[k]) || 0;
      });
    } else {
      Object.values(mObj).forEach((v) => {
        totalMeals += Number(v) || 0;
      });
    }

    const keyMealTotals: Record<string, number> = {};
    if (hasSplit) {
      keys.forEach((k) => {
        if (k.endsWith('_day')) {
          const base = k.slice(0, -4);
          keyMealTotals[base] = (keyMealTotals[base] || 0) + (Number(mObj[k]) || 0);
        } else if (k.endsWith('_night')) {
          const base = k.slice(0, -6);
          keyMealTotals[base] = (keyMealTotals[base] || 0) + (Number(mObj[k]) || 0);
        }
      });
    } else {
      keys.forEach((k) => {
        keyMealTotals[k] = Number(mObj[k]) || 0;
      });
    }
    members.forEach((m) => {
      let v: number | undefined = keyMealTotals[m.name];
      if (v == null) {
        const lname = m.name.toLowerCase();
        const found = Object.keys(keyMealTotals).find((k) => k.toLowerCase() === lname);
        if (found) v = keyMealTotals[found];
      }
      if (v == null) {
        const tname = m.name.trim();
        const found = Object.keys(keyMealTotals).find((k) => k.trim() === tname);
        if (found) v = keyMealTotals[found];
      }
      memberMeals[m.name] = round2(memberMeals[m.name] + (v || 0));
    });
  });

  bazarRows.forEach((row) => {
    const bObj = row.bazar || {};
    Object.values(bObj).forEach((v) => {
      totalBazar += Number(v) || 0;
    });
    members.forEach((m) => {
      const v = Number(bObj[m.name] || 0);
      memberBazar[m.name] = round2(memberBazar[m.name] + v);
    });
  });

  const mealRate = totalMeals > 0 ? round2(totalBazar / totalMeals) : 0;
  return {
    totalMeals: round2(totalMeals),
    totalBazar: round2(totalBazar),
    mealRate,
    memberMeals,
    memberBazar,
  };
}

export type MemberSettlement = {
  memberName: string;
  settlementKey: string;
  sourceKey: string;
  prevMonthInfo: { month: number; year: number; key: string };
  totalMeals: number;
  totalBazar: number;
  mealRate: number;
  memberMeals: number;
  memberBazar: number;
  mealCost: number;
  roomRent: number;
  roomRentPaid: number;
  prepaidTotal: number;
  prepaidUtility: number;
  khalaTotal: number;
  otherTotal: number;
  khalaShare: number;
  otherShare: number;
  postpaidUtility: number;
  utilityPaid: number;
  utilityStatus: string;
  rentStatus: string;
  mealBalance: number;
  messCredit: number;
  mealPaid: number;
  creditPaid: number;
  totalPay: number;
  netPayable: number;
  /** filled in by the dashboard via calcPrevDueForMember */
  prevDue?: number;
  netWithPrevDue?: number;
};

export function calcMemberSettlement(
  member: Member,
  allMeals: MealRow[] | null,
  allBazar: BazarRow[] | null,
  currentRentRec: RentRecord | null,
  currentUtilRec: UtilityRecord | null,
  previousUtilRec: UtilityRecord | null,
  settlementKey: string,
  members: Member[],
): MemberSettlement {
  const settlementMonth = monthIndexFromKey(settlementKey);
  const settlementYear = yearFromKey(settlementKey);
  const sourceKey = calcSettlementSourceKey(settlementMonth, settlementYear);
  const prevMonthInfo = previousMonth(settlementMonth, settlementYear);
  const totals = calcSettlementTotals(allMeals, allBazar, sourceKey, members);
  const memberMeals = round2(totals.memberMeals[member.name] || 0);
  const memberBazar = round2(totals.memberBazar[member.name] || 0);
  const mealCost = round2(memberMeals * totals.mealRate);
  const rentEntry = currentRentRec?.entries?.find((e) => e.name === member.name) || ({} as any);
  const roomRent = Number(rentEntry.rent || 0);
  const roomRentPaid = Number(rentEntry.paid || 0);
  const memberCount = members.length || 1;
  const prepaidTotal = utilTotalFromBills(currentUtilRec?.bills || {}, UTIL_PREPAID_KEYS);
  const prepaidUtility = round2(prepaidTotal / memberCount);
  const khalaTotal = Number((previousUtilRec?.bills as any)?.khala || 0);
  const otherTotal = Number((previousUtilRec?.bills as any)?.other || 0);
  const khalaShare = round2(khalaTotal / memberCount);
  const otherShare = round2(otherTotal / memberCount);
  const postpaidUtility = round2(khalaShare + otherShare);
  const utilPayment = (currentUtilRec?.payments || {})[member.name] || {};
  const utilityPaid = Number(utilPayment.paid || 0);
  const mealPaid = Number(utilPayment.meal_paid || 0);
  const creditPaid = Number(utilPayment.credit_paid || 0);
  const mealBalance = round2(mealCost - memberBazar);
  const bills = (currentUtilRec?.bills || {}) as any;
  const messCredit = round2(
    Number((bills.mess_credit || {})[member.name] || 0) +
      Number((bills.change_credit || {})[member.name] || 0),
  );
  const totalPay = round2(mealCost + roomRent + prepaidUtility + postpaidUtility);
  const baseNetPayable = round2(
    totalPay - memberBazar - utilityPaid - roomRentPaid - mealPaid - messCredit,
  );
  const netPayable =
    baseNetPayable < 0 ? round2(Math.min(baseNetPayable + creditPaid, 0)) : baseNetPayable;

  return {
    memberName: member.name,
    settlementKey,
    sourceKey,
    prevMonthInfo,
    totalMeals: totals.totalMeals,
    totalBazar: totals.totalBazar,
    mealRate: totals.mealRate,
    memberMeals,
    memberBazar,
    mealCost,
    roomRent,
    roomRentPaid,
    prepaidTotal,
    prepaidUtility,
    khalaTotal,
    otherTotal,
    khalaShare,
    otherShare,
    postpaidUtility,
    utilityPaid,
    utilityStatus: utilPayment.status || 'unpaid',
    rentStatus: rentEntry.status || 'unpaid',
    mealBalance,
    messCredit,
    mealPaid,
    creditPaid,
    totalPay,
    netPayable,
  };
}

/**
 * Outstanding net due carried forward from ALL past unpaid settlements — not
 * just the immediately-previous month. Walks backward from settlementKey
 * through every month that has a rent record, accumulating each month's own
 * unpaid balance minus whatever was later paid down against it
 * (payments[name].prev_due_paid in the following month's utility record).
 *
 * See the long comment in js/core/helpers.js for why this must not trust the
 * rent/utility "status" text field.
 */
export function calcPrevDueForMember(
  member: Member,
  allMeals: MealRow[] | null,
  allBazar: BazarRow[] | null,
  allRent: RentRecord[] | null,
  allUtil: UtilityRecord[] | null,
  settlementKey: string,
  members: Member[],
  maxLookback = 24,
): number {
  const rentByKey: Record<string, RentRecord> = {};
  (allRent || []).forEach((r) => {
    if (r) rentByKey[r.month_key] = r;
  });
  const utilByKey: Record<string, UtilityRecord> = {};
  (allUtil || []).forEach((u) => {
    if (u) utilByKey[u.month_key] = u;
  });

  const immPrev = previousMonthFromKey(settlementKey).key;
  const chain = [immPrev];

  let k = previousMonthFromKey(immPrev).key;
  let hops = 0;
  while (hops < maxLookback && rentByKey[k]) {
    chain.unshift(k);
    k = previousMonthFromKey(k).key;
    hops++;
  }
  chain.push(settlementKey);

  let carry = 0;
  for (let i = 1; i < chain.length; i++) {
    const cur = chain[i];
    const prev = chain[i - 1];
    const rentPrevRec = rentByKey[prev] || null;
    const utilPrevRec = utilByKey[prev] || null;
    const utilPrevPrevRec = utilByKey[previousMonthFromKey(prev).key] || null;

    const netOwnPrev = calcMemberSettlement(
      member,
      allMeals,
      allBazar,
      rentPrevRec,
      utilPrevRec,
      utilPrevPrevRec,
      prev,
      members,
    ).netPayable;
    const prevDuePaidThisStep = round2(
      Number((utilByKey[cur]?.payments || {})[member.name]?.prev_due_paid || 0),
    );

    carry = round2(Math.max(0, carry + netOwnPrev - prevDuePaidThisStep));
  }
  return carry;
}
