/**
 * Per-member stat aggregation — ported from getMemberStats / getUtilityBalance /
 * getPrevMonthMealBalance in js/manager/profiles.js. `members` is a parameter.
 */
import { round2, previousMonthFromKey, previousMonth, thisMonth } from './format';
import { mealMemberTotal } from './meals';
import {
  UTIL_PREPAID_KEYS,
  UTIL_POSTPAID_KEYS,
  utilTotalFromBills,
  calcSettlementTotals,
} from './settlement';
import type { Member, MealRow, BazarRow, RentRecord, UtilityRecord } from './types';

export type MonthBucket = { meals: number; bazar: number; rentPaid: number; utilityPaid: number };

export type MemberStats = {
  totalMeals: number;
  totalBazar: number;
  mealRate: number;
  mealCost: number;
  mealBalance: number;
  rentDue: number;
  rentPaid: number;
  utilityDue: number;
  utilityPaid: number;
  activeDays: number;
  avgMeals: number;
  latestStatus: string;
  latestUtilStatus: string;
  byMonth: Record<string, MonthBucket>;
};

export function getMemberStats(
  member: Member,
  meals: MealRow[],
  bazar: BazarRow[],
  rent: RentRecord[],
  members: Member[],
  utility: UtilityRecord[] = [],
  filteredUtility: UtilityRecord[] | null = null,
): MemberStats {
  let tm = 0;
  let tb = 0;
  let rd = 0;
  let rp = 0;
  let ud = 0;
  let up = 0;
  let ad = 0;
  const byM: Record<string, MonthBucket> = {};
  const em = (k: string) => {
    byM[k] = byM[k] || { meals: 0, bazar: 0, rentPaid: 0, utilityPaid: 0 };
  };

  meals.forEach((r) => {
    const v = mealMemberTotal(r.meals || {}, member.name);
    tm += v;
    if (v > 0) ad++;
    const k = r.date.slice(0, 7);
    em(k);
    byM[k].meals += v;
  });
  bazar.forEach((r) => {
    const v = Number((r.bazar || {})[member.name] || 0);
    tb += v;
    const k = r.date.slice(0, 7);
    em(k);
    byM[k].bazar += v;
  });
  rent.forEach((r) => {
    const e = r.entries?.find((x) => x.name === member.name);
    if (e) {
      rd += Number(e.rent || 0);
      rp += Number(e.paid || 0);
      em(r.month_key);
      byM[r.month_key].rentPaid += Number(e.paid || 0);
    }
  });

  const utilForStats = filteredUtility !== null ? filteredUtility : utility;
  const utilByKey: Record<string, UtilityRecord> = {};
  utility.forEach((r) => {
    utilByKey[r.month_key] = r;
  });
  utilForStats.forEach((r) => {
    const prevKey = previousMonthFromKey(r.month_key).key;
    const prepaid = utilTotalFromBills(r.bills || {}, UTIL_PREPAID_KEYS);
    const postpaid = utilTotalFromBills(utilByKey[prevKey]?.bills || {}, UTIL_POSTPAID_KEYS);
    const perHead = members.length > 0 ? round2((prepaid + postpaid) / members.length) : 0;
    const p = (r.payments || {})[member.name] || {};
    ud += perHead;
    up += Number(p.paid || 0);
    em(r.month_key);
    byM[r.month_key].utilityPaid += Number(p.paid || 0);
  });

  const allMealsTotal = meals.reduce((s, r) => {
    const mObj = r.meals || {};
    const keys = Object.keys(mObj);
    const hasSplit = keys.some((k) => k.endsWith('_day') || k.endsWith('_night'));
    if (hasSplit) {
      return (
        s +
        keys.reduce(
          (a, k) => (k.endsWith('_day') || k.endsWith('_night') ? a + (Number(mObj[k]) || 0) : a),
          0,
        )
      );
    }
    return s + Object.values(mObj).reduce((a, v) => a + (Number(v) || 0), 0);
  }, 0);
  const allBazarTotal = bazar.reduce(
    (s, r) => s + Object.values(r.bazar || {}).reduce((a, v) => a + Number(v || 0), 0),
    0,
  );
  const mr = allMealsTotal > 0 ? allBazarTotal / allMealsTotal : 0;
  const mc = round2(tm * mr);

  const latestR = [...rent].sort((a, b) => b.month_key.localeCompare(a.month_key))[0];
  const latestRS = latestR?.entries?.find((x) => x.name === member.name)?.status || 'unpaid';
  const latestU = [...utility].sort((a, b) => b.month_key.localeCompare(a.month_key))[0];
  const latestUS = (latestU?.payments || {})[member.name]?.status || 'unpaid';

  return {
    totalMeals: round2(tm),
    totalBazar: tb,
    mealRate: round2(mr),
    mealCost: mc,
    mealBalance: round2(tb - mc),
    rentDue: rd,
    rentPaid: rp,
    utilityDue: round2(ud),
    utilityPaid: round2(up),
    activeDays: ad,
    avgMeals: meals.length > 0 ? round2(tm / meals.length) : 0,
    latestStatus: latestRS,
    latestUtilStatus: latestUS,
    byMonth: byM,
  };
}

/** paid − (current prepaid + previous postpaid) share. Positive = overpaid. */
export function getUtilityBalance(
  member: Member,
  currentUtilRec: UtilityRecord | null,
  previousUtilRec: UtilityRecord | null,
  members: Member[],
): number {
  const memberCount = members.length || 1;
  const prepaidTotal = utilTotalFromBills(currentUtilRec?.bills || {}, UTIL_PREPAID_KEYS);
  const postpaidTotal = utilTotalFromBills(previousUtilRec?.bills || {}, UTIL_POSTPAID_KEYS);
  const totalDue = round2((prepaidTotal + postpaidTotal) / memberCount);
  const actualPaid = Number((currentUtilRec?.payments || {})[member.name]?.paid || 0);
  return round2(actualPaid - totalDue);
}

/** bazar credit + meal_paid − meal cost for the settlement month. Positive = Get. */
export function getPrevMonthMealBalance(
  member: Member,
  allM: MealRow[],
  allB: BazarRow[],
  curM: number | undefined,
  curY: number | undefined,
  currentUtilRec: UtilityRecord | null,
  members: Member[],
): number {
  const t = thisMonth();
  const month = curM !== undefined ? curM : t.month;
  const year = curY !== undefined ? curY : t.year;
  const prev = previousMonth(month, year);
  const totals = calcSettlementTotals(allM, allB, prev.key, members);
  const memberMeals = Number(totals.memberMeals[member.name] || 0);
  const memberBazar = Number(totals.memberBazar[member.name] || 0);
  const mealCost = round2(memberMeals * totals.mealRate);
  const mealPaid = Number((currentUtilRec?.payments || {})[member.name]?.meal_paid || 0);
  return round2(memberBazar + mealPaid - mealCost);
}
