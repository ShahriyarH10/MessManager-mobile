/**
 * Period filtering for profile/stats screens — ported from getFilteredData /
 * getFilteredUtilityOnly in js/manager/profiles.js.
 *
 * Utility rows are ALWAYS returned unfiltered from getFilteredData so the
 * postpaid (previous-month Khala+Other) lookup keeps working; the period-scoped
 * subset for stat totals comes from getFilteredUtilityOnly.
 */
import type { MealRow, BazarRow, RentRecord, UtilityRecord } from './types';

export type Period = 'next' | '1' | 'last' | '3' | '6' | 'all';

export const PERIOD_LABELS: Record<Period, string> = {
  next: 'Next month',
  '1': 'This month',
  last: 'Last month',
  '3': 'Last 3 months',
  '6': 'Last 6 months',
  all: 'All time',
};

/** The settlement month a given period resolves to (month index + year). */
export function periodMonth(period: Period): { month: number; year: number } {
  const now = new Date();
  let m = now.getMonth();
  let y = now.getFullYear();
  if (period === 'next') {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  } else if (period === 'last') {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return { month: m, year: y };
}

function cutoffKey(period: Period): string {
  const now = new Date();
  const months = parseInt(period, 10);
  let cm = now.getMonth() - months + 1;
  let cy = now.getFullYear();
  while (cm < 0) {
    cm += 12;
    cy -= 1;
  }
  return `${cy}-${String(cm + 1).padStart(2, '0')}`;
}

export function getFilteredData(
  allM: MealRow[],
  allB: BazarRow[],
  allR: RentRecord[],
  period: Period,
  allU: UtilityRecord[] = [],
): { meals: MealRow[]; bazar: BazarRow[]; rent: RentRecord[]; utility: UtilityRecord[] } {
  if (period === 'all') return { meals: allM, bazar: allB, rent: allR, utility: allU };
  if (period === 'next' || period === 'last') {
    const { month, year } = periodMonth(period);
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    return {
      meals: allM.filter((r) => r.date.slice(0, 7) === key),
      bazar: allB.filter((r) => r.date.slice(0, 7) === key),
      rent: allR.filter((r) => r.month_key === key),
      utility: allU,
    };
  }
  const cut = cutoffKey(period);
  return {
    meals: allM.filter((r) => r.date.slice(0, 7) >= cut),
    bazar: allB.filter((r) => r.date.slice(0, 7) >= cut),
    rent: allR.filter((r) => r.month_key >= cut),
    utility: allU,
  };
}

export function getFilteredUtilityOnly(allU: UtilityRecord[], period: Period): UtilityRecord[] {
  if (period === 'all') return allU;
  if (period === 'next' || period === 'last') {
    const { month, year } = periodMonth(period);
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    return allU.filter((r) => r.month_key === key);
  }
  const cut = cutoffKey(period);
  return allU.filter((r) => r.month_key >= cut);
}
