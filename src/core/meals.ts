/**
 * Meal-total helpers — ported verbatim from js/core/helpers.js.
 *
 * These never depend on the members list, so they keep working even if member
 * names drift over time. They handle both the split format ("Name_day" /
 * "Name_night") and the legacy plain-name format.
 */
import { round2 } from './format';

type MealObj = Record<string, number> | null | undefined;

/** Total meals in ONE meal-row object, regardless of member names. */
export function mealRowTotal(mObj: MealObj): number {
  if (!mObj) return 0;
  const keys = Object.keys(mObj);
  const hasSplit = keys.some((k) => k.endsWith('_day') || k.endsWith('_night'));
  if (hasSplit) {
    return keys.reduce(
      (s, k) => (k.endsWith('_day') || k.endsWith('_night') ? s + (Number(mObj[k]) || 0) : s),
      0,
    );
  }
  return Object.values(mObj).reduce((s, v) => s + (Number(v) || 0), 0);
}

/**
 * One specific member's total meals from ONE meal-row object.
 * Tries: exact name -> _day/_night keys -> case-insensitive -> trimmed.
 */
export function mealMemberTotal(mObj: MealObj, memberName: string): number {
  if (!mObj || !memberName) return 0;
  const keys = Object.keys(mObj);
  const hasSplit = keys.some((k) => k.endsWith('_day') || k.endsWith('_night'));
  const totals: Record<string, number> = {};
  if (hasSplit) {
    keys.forEach((k) => {
      if (k.endsWith('_day')) {
        const b = k.slice(0, -4);
        totals[b] = (totals[b] || 0) + (Number(mObj[k]) || 0);
      }
      if (k.endsWith('_night')) {
        const b = k.slice(0, -6);
        totals[b] = (totals[b] || 0) + (Number(mObj[k]) || 0);
      }
    });
  } else {
    keys.forEach((k) => {
      totals[k] = Number(mObj[k]) || 0;
    });
  }
  if (totals[memberName] != null) return round2(totals[memberName]);
  const lname = memberName.toLowerCase();
  const ci = Object.keys(totals).find((k) => k.toLowerCase() === lname);
  if (ci) return round2(totals[ci]);
  const tname = memberName.trim();
  const tr = Object.keys(totals).find((k) => k.trim() === tname);
  if (tr) return round2(totals[tr]);
  return 0;
}

/** Per-day meal calendar for one member in one month (key "YYYY-MM"). */
export function memberMonthCalendar(
  memberName: string,
  allMeals: { date: string; meals: MealObj }[],
  key: string,
): {
  days: { day: number; total: number; dayMeals: number; nightMeals: number; hasMeal: boolean }[];
  total: number;
  activeDays: number;
} {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7)) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDate: Record<string, { day: number; night: number; total: number }> = {};
  (allMeals || [])
    .filter((r) => String(r.date || '').startsWith(key))
    .forEach((r) => {
      byDate[String(r.date).slice(8, 10)] = mealPartsFromObj(r.meals || {}, memberName);
    });
  let total = 0;
  let activeDays = 0;
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dd = String(i + 1).padStart(2, '0');
    const e = byDate[dd] || { day: 0, night: 0, total: 0 };
    if (e.total > 0) {
      activeDays++;
      total += e.total;
    }
    return { day: i + 1, total: e.total, dayMeals: e.day, nightMeals: e.night, hasMeal: e.total > 0 };
  });
  return { days, total: round2(total), activeDays };
}

/** Day/night/total split for a member from a meal-row object. */
export function mealPartsFromObj(
  mealsObj: MealObj,
  memberName: string,
): { day: number; night: number; total: number } {
  const day = Number(mealsObj?.[memberName + '_day'] || 0);
  const night = Number(mealsObj?.[memberName + '_night'] || 0);
  const legacy = Number(mealsObj?.[memberName] || 0);
  const hasSplit =
    mealsObj?.[memberName + '_day'] != null || mealsObj?.[memberName + '_night'] != null;
  const total = hasSplit ? round2(day + night) : legacy;
  return { day, night, total };
}
