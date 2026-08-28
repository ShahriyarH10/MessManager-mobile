/**
 * Data + settlement for the member dashboard — a port of the data-loading and
 * computation half of renderMyDashboard() / buildMessSnapshotBlock() in
 * js/member/dashboard.js. The rendering half lives in the screen component.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSession } from '../lib/session';
import { dbGetMeals, dbGetBazar, dbGetRent, dbGetUtility } from '../lib/db';
import {
  calcMemberSettlement,
  calcPrevDueForMember,
  type MemberSettlement,
} from '../core/settlement';
import { mealMemberTotal, mealPartsFromObj } from '../core/meals';
import { dbGetMembers } from '../lib/db';
import {
  MONTHS,
  monthKey,
  previousMonth,
  round2,
  thisMonth,
  todayStr,
} from '../core/format';
import { LATE_NIGHT_HOUR } from '../lib/config';
import type { Member, MealRow, BazarRow } from '../core/types';

export type WhoAte = {
  id: string;
  name: string;
  meals: number;
  bazar: number;
  balance: number;
  isMe: boolean;
};

export type DashboardData = {
  member: Member;
  monthLabel: string;
  prevLabel: string;
  calc: MemberSettlement & { prevDue: number; netWithPrevDue: number };
  memberCount: number;
  messMeals: number;
  messBazar: number;
  mealRate: number;
  today: {
    dateStr: string;
    isNextDay: boolean;
    hasEntry: boolean;
    myDay: number;
    myNight: number;
    totalDay: number;
    totalNight: number;
  };
  whoAte: WhoAte[];
};

function currentMonthMessTotals(allMeals: MealRow[], allBazar: BazarRow[], key: string) {
  let meals = 0;
  let bazar = 0;
  allMeals
    .filter((r) => String(r.date || '').startsWith(key))
    .forEach((r) => {
      const mObj = r.meals || {};
      const ks = Object.keys(mObj);
      const hasSplit = ks.some((k) => k.endsWith('_day') || k.endsWith('_night'));
      if (hasSplit) {
        ks.forEach((k) => {
          if (k.endsWith('_day') || k.endsWith('_night')) meals += Number(mObj[k]) || 0;
        });
      } else {
        Object.values(mObj).forEach((v) => {
          meals += Number(v) || 0;
        });
      }
    });
  allBazar
    .filter((r) => String(r.date || '').startsWith(key))
    .forEach((r) => {
      Object.values(r.bazar || {}).forEach((v) => {
        bazar += Number(v) || 0;
      });
    });
  return { meals: round2(meals), bazar: round2(bazar) };
}

export function useMemberDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const session = getSession();
    const memberId = session?.user.memberId;
    if (!memberId) {
      setError('Not signed in.');
      setLoading(false);
      return;
    }

    try {
      const { month, year } = thisMonth();
      const key = monthKey(year, month);
      const prev = previousMonth(month, year);

      const [members, allMeals, allBazar, allRent, allUtil] = await Promise.all([
        dbGetMembers(),
        dbGetMeals(),
        dbGetBazar(),
        dbGetRent(),
        dbGetUtility(),
      ]);

      const member = members.find((m) => m.id === memberId) ?? null;
      if (!member) {
        setError('Could not load your profile.');
        setLoading(false);
        return;
      }

      const rentRec = allRent.find((r) => r.month_key === key) ?? null;
      const utilRec = allUtil.find((u) => u.month_key === key) ?? null;
      const prevUtilRec = allUtil.find((u) => u.month_key === prev.key) ?? null;

      const base = calcMemberSettlement(
        member,
        allMeals,
        allBazar,
        rentRec,
        utilRec,
        prevUtilRec,
        key,
        members,
      );
      const prevDue = calcPrevDueForMember(member, allMeals, allBazar, allRent, allUtil, key, members);
      const calc = {
        ...base,
        prevDue,
        netWithPrevDue: round2(base.netPayable + prevDue),
      };

      // Today (or tomorrow after 23:00)
      const now = new Date();
      const isNextDay = now.getHours() >= LATE_NIGHT_HOUR;
      const displayDate = isNextDay ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : now;
      const dateStr = todayStr(displayDate);
      const todayRec = allMeals.find((r) => r.date === dateStr) ?? null;
      let totalDay = 0;
      let totalNight = 0;
      if (todayRec) {
        members.forEach((m) => {
          const p = mealPartsFromObj(todayRec.meals || {}, m.name);
          totalDay += p.day;
          totalNight += p.night;
        });
      }
      const myParts = todayRec
        ? mealPartsFromObj(todayRec.meals || {}, member.name)
        : { day: 0, night: 0, total: 0 };

      // Mess-wide current-month snapshot
      const messTotals = currentMonthMessTotals(allMeals, allBazar, key);
      const mealRate = messTotals.meals > 0 ? round2(messTotals.bazar / messTotals.meals) : 0;

      const memMeals: Record<string, number> = {};
      const memBazar: Record<string, number> = {};
      members.forEach((m) => {
        memMeals[m.name] = 0;
        memBazar[m.name] = 0;
      });
      allMeals
        .filter((r) => String(r.date || '').startsWith(key))
        .forEach((r) => {
          members.forEach((m) => {
            memMeals[m.name] += mealMemberTotal(r.meals || {}, m.name);
          });
        });
      allBazar
        .filter((r) => String(r.date || '').startsWith(key))
        .forEach((r) => {
          members.forEach((m) => {
            memBazar[m.name] += Number((r.bazar || {})[m.name] || 0);
          });
        });

      const whoAte: WhoAte[] = members
        .map((m) => {
          const meals = round2(memMeals[m.name] || 0);
          const bazar = round2(memBazar[m.name] || 0);
          const cost = round2(meals * mealRate);
          return {
            id: m.id,
            name: m.name,
            meals,
            bazar,
            balance: round2(bazar - cost),
            isMe: m.id === member.id,
          };
        })
        .sort((a, b) => b.meals - a.meals);

      setData({
        member,
        monthLabel: `${MONTHS[month]} ${year}`,
        prevLabel: `${MONTHS[prev.month]} ${prev.year}`,
        calc,
        memberCount: members.length,
        messMeals: messTotals.meals,
        messBazar: messTotals.bazar,
        mealRate,
        today: {
          dateStr,
          isNextDay,
          hasEntry: !!todayRec,
          myDay: round2(myParts.day),
          myNight: round2(myParts.night),
          totalDay: round2(totalDay),
          totalNight: round2(totalNight),
        },
        whoAte,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  return { data, loading, error, refresh };
}
