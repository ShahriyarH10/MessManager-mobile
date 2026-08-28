/**
 * Absence calendar model — ported from loadAbsenceCalendar in
 * js/manager/features.js.
 *
 * A member is "absent" on a date if:
 *  - an explicit meal_attendance toggle marks day_meal/night_meal false, OR
 *  - the day has real meal data logged and their meal count is 0 (for day,
 *    night, or both).
 */
import { mealPartsFromObj } from './meals';
import { todayStr } from './format';
import type { Member, MealRow } from './types';

export type AttendanceRow = {
  id: string;
  member_id: string;
  date: string;
  day_meal: boolean;
  night_meal: boolean;
};

export type DayCell = {
  day: number;
  dateStr: string;
  isToday: boolean;
  isPast: boolean;
  hasData: boolean;
  allOff: Member[];
  dayOff: Member[];
  nightOff: Member[];
  absentCount: number;
};

export type AbsenceMonth = {
  firstDow: number; // 0 = Sunday
  cells: DayCell[];
  totalAbsenceDays: number;
  confirmedDays: number;
  allAteDays: number;
  perMember: { member: Member; allOff: number; dayOff: number; nightOff: number }[];
};

export function buildAbsenceMonth(
  key: string,
  members: Member[],
  attRows: AttendanceRow[],
  mealRows: MealRow[],
): AbsenceMonth {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7)) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const today = todayStr();

  // date -> member_id -> { day_meal, night_meal }
  const attMap: Record<string, Record<string, { day_meal: boolean; night_meal: boolean }>> = {};
  attRows.forEach((a) => {
    (attMap[a.date] ||= {})[a.member_id] = { day_meal: a.day_meal, night_meal: a.night_meal };
  });

  const mealDataDates = new Set<string>();
  mealRows
    .filter((r) => String(r.date || '').startsWith(key))
    .forEach((r) => {
      const mObj = r.meals || {};
      if (!Object.values(mObj).some((v) => Number(v) > 0)) return;
      mealDataDates.add(r.date);
      attMap[r.date] ||= {};
      const ks = Object.keys(mObj);
      const hasSplit = ks.some((k) => k.endsWith('_day') || k.endsWith('_night'));
      members.forEach((m) => {
        if (attMap[r.date][m.id]) return;
        const p = mealPartsFromObj(mObj, m.name);
        if (hasSplit) {
          if (p.day === 0 && p.night === 0) attMap[r.date][m.id] = { day_meal: false, night_meal: false };
          else if (p.day === 0) attMap[r.date][m.id] = { day_meal: false, night_meal: true };
          else if (p.night === 0) attMap[r.date][m.id] = { day_meal: true, night_meal: false };
        } else if (p.total === 0) {
          attMap[r.date][m.id] = { day_meal: false, night_meal: false };
        }
      });
    });
  Object.keys(attMap).forEach((d) => mealDataDates.add(d));

  const byId: Record<string, Member> = {};
  members.forEach((m) => (byId[m.id] = m));

  const cells: DayCell[] = [];
  const perTotals: Record<string, { allOff: number; dayOff: number; nightOff: number }> = {};
  members.forEach((m) => (perTotals[m.id] = { allOff: 0, dayOff: 0, nightOff: 0 }));
  let totalAbsenceDays = 0;
  let allAteDays = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${key}-${String(d).padStart(2, '0')}`;
    const dayMap = attMap[dateStr] || {};
    const allOff: Member[] = [];
    const dayOff: Member[] = [];
    const nightOff: Member[] = [];
    members.forEach((m) => {
      const a = dayMap[m.id];
      if (!a) return;
      if (!a.day_meal && !a.night_meal) {
        allOff.push(m);
        perTotals[m.id].allOff++;
        totalAbsenceDays++;
      } else if (!a.day_meal && a.night_meal) {
        dayOff.push(m);
        perTotals[m.id].dayOff++;
        totalAbsenceDays++;
      } else if (a.day_meal && !a.night_meal) {
        nightOff.push(m);
        perTotals[m.id].nightOff++;
        totalAbsenceDays++;
      }
    });
    const absentCount = allOff.length + dayOff.length + nightOff.length;
    const hasData = mealDataDates.has(dateStr);
    if (hasData && absentCount === 0 && dateStr <= today) allAteDays++;
    cells.push({
      day: d,
      dateStr,
      isToday: dateStr === today,
      isPast: dateStr < today,
      hasData,
      allOff,
      dayOff,
      nightOff,
      absentCount,
    });
  }

  return {
    firstDow,
    cells,
    totalAbsenceDays,
    confirmedDays: mealDataDates.size,
    allAteDays,
    perMember: members
      .map((m) => ({ member: m, ...perTotals[m.id] }))
      .filter((x) => x.allOff + x.dayOff + x.nightOff > 0),
  };
}
