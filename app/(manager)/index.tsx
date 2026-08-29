import React, { useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useMessData } from '../../src/hooks/useMessData';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenScroll, Card, CardTitle, StatCard, Loading, Centered } from '../../src/components/ui';
import { Badge } from '../../src/components/form';
import { Icon, type IconName } from '../../src/components/Icon';
import { useTheme, radiusSm, avatarCol } from '../../src/theme';
import { MONTHS, fmtTk, round2, monthKey, thisMonth, previousMonth, todayStr, initials } from '../../src/core/format';
import { mealMemberTotal, mealPartsFromObj } from '../../src/core/meals';
import { utilTotalFromBills, UTIL_PREPAID_KEYS, UTIL_POSTPAID_KEYS } from '../../src/core/settlement';
import { LATE_NIGHT_HOUR } from '../../src/lib/config';

export default function ManagerDashboard() {
  const { colors } = useTheme();
  const router = useRouter();
  const { mess } = useAuth();
  const { data, loading, error, refresh } = useMessData();

  const v = useMemo(() => {
    if (!data) return null;
    const { month, year } = thisMonth();
    const key = monthKey(year, month);
    const prev = previousMonth(month, year);
    const { members, meals, bazar, rent, utility } = data;

    const mM = meals.filter((r) => r.date.startsWith(key));
    const mB = bazar.filter((r) => r.date.startsWith(key));
    const rentRec = rent.find((r) => r.month_key === key) ?? null;
    const utilRec = utility.find((u) => u.month_key === key) ?? null;
    const prevUtilRec = utility.find((u) => u.month_key === prev.key) ?? null;

    let totalMeals = 0;
    mM.forEach((r) => {
      const mObj = r.meals || {};
      const ks = Object.keys(mObj);
      const split = ks.some((k) => k.endsWith('_day') || k.endsWith('_night'));
      if (split) ks.forEach((k) => { if (k.endsWith('_day') || k.endsWith('_night')) totalMeals += Number(mObj[k]) || 0; });
      else Object.values(mObj).forEach((x) => (totalMeals += Number(x) || 0));
    });
    let totalBazar = 0;
    const memBazar: Record<string, number> = {};
    mB.forEach((r) =>
      Object.entries(r.bazar || {}).forEach(([k, x]) => {
        totalBazar += Number(x) || 0;
        memBazar[k] = (memBazar[k] || 0) + Number(x || 0);
      }),
    );
    const mealRate = totalMeals > 0 ? round2(totalBazar / totalMeals) : 0;

    const rentDue = rentRec?.entries?.reduce((s, e) => s + Number(e.rent || 0), 0) || 0;
    const rentPaid = rentRec?.entries?.reduce((s, e) => s + Number(e.paid || 0), 0) || 0;
    const rentPaidCount = rentRec?.entries?.filter((e) => e.status === 'paid').length || 0;
    const rentPartCount = rentRec?.entries?.filter((e) => e.status === 'partial').length || 0;
    const rentDueCount = rentRec?.entries?.filter((e) => !e.status || e.status === 'unpaid').length || 0;

    const prepaid = utilTotalFromBills(utilRec?.bills || {}, UTIL_PREPAID_KEYS);
    const postpaid = utilTotalFromBills(prevUtilRec?.bills || {}, UTIL_POSTPAID_KEYS);
    const totalUtil = round2(prepaid + postpaid);
    const utilPaid = round2(Object.values(utilRec?.payments || {}).reduce((s, p) => s + Number(p.paid || 0), 0));

    const now = new Date();
    const isNextDay = now.getHours() >= LATE_NIGHT_HOUR;
    const dispDate = isNextDay ? new Date(now.getTime() + 86400000) : now;
    const dispStr = todayStr(dispDate);
    const todayRec = meals.find((r) => r.date === dispStr) ?? null;
    let tDay = 0;
    let tNight = 0;
    if (todayRec) {
      members.forEach((m) => {
        const p = mealPartsFromObj(todayRec.meals || {}, m.name);
        tDay += p.day;
        tNight += p.night;
      });
    }

    const memMeals: Record<string, number> = {};
    members.forEach((m) => (memMeals[m.name] = 0));
    mM.forEach((r) => members.forEach((m) => (memMeals[m.name] += mealMemberTotal(r.meals || {}, m.name))));
    const maxMem = Math.max(...Object.values(memMeals), 1);

    const topBazar = Object.entries(memBazar).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxB = topBazar[0]?.[1] || 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysGone = Math.min(now.getDate(), daysInMonth);

    return {
      monthLabel: `${MONTHS[month]} ${year}`,
      members,
      totalMeals: round2(totalMeals),
      totalBazar: round2(totalBazar),
      mealRate,
      daysLogged: mM.length,
      daysGone,
      rentDue,
      rentPaid,
      rentPct: rentDue > 0 ? Math.round((rentPaid / rentDue) * 100) : 0,
      rentPaidCount,
      rentPartCount,
      rentDueCount,
      rentEntries: rentRec?.entries ?? [],
      totalUtil,
      utilPaid,
      utilPct: totalUtil > 0 ? Math.round((utilPaid / totalUtil) * 100) : 0,
      isNextDay,
      dispStr,
      todayRec,
      tDay: round2(tDay),
      tNight: round2(tNight),
      memMeals,
      maxMem,
      memBazar,
      topBazar,
      maxB,
    };
  }, [data]);

  if (loading && !data) return <Loading label="Loading dashboard…" />;
  if (error && !data)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={refresh}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );
  if (!v) return null;

  return (
    <ScreenScroll
      title="Dashboard"
      subtitle={`${mess?.name ?? ''} · ${v.monthLabel} · ${v.members.length} members`}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label="Total meals" value={v.totalMeals} sub={`${v.daysLogged} days logged`} accent={colors.accent} />
        <StatCard label="Meal rate" value={fmtTk(v.mealRate)} sub={`${fmtTk(v.totalBazar)} / ${v.totalMeals}`} accent={colors.blue} />
        <StatCard label="Total bazar" value={fmtTk(v.totalBazar)} sub={`${v.topBazar.length} contributors`} accent={colors.green} />
        <StatCard label="Days logged" value={`${v.daysLogged}/${v.daysGone}`} sub="this month" accent={colors.text3} />
      </View>

      <Card>
        <CardTitle>Collection progress — {v.monthLabel}</CardTitle>
        <ProgressRow label="Rent" paid={v.rentPaid} total={v.rentDue} pct={v.rentPct} color={colors.amber} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 12 }}>
          {v.rentPaidCount > 0 ? <Badge text={`✓ ${v.rentPaidCount} paid`} tone="green" /> : null}
          {v.rentPartCount > 0 ? <Badge text={`~ ${v.rentPartCount} partial`} tone="amber" /> : null}
          {v.rentDueCount > 0 ? <Badge text={`! ${v.rentDueCount} due`} tone="red" /> : null}
        </View>
        <ProgressRow label="Utility" paid={v.utilPaid} total={v.totalUtil} pct={v.utilPct} color={colors.purple} />
      </Card>

      <Card>
        <CardTitle>
          {v.isNextDay ? "Tomorrow's meals" : "Today's meals"} — {v.dispStr}
        </CardTitle>
        {v.todayRec ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <MiniStat label="Day" value={v.tDay} color={colors.blue} icon="day" />
              <MiniStat label="Night" value={v.tNight} color={colors.amber} icon="night" />
              <MiniStat label="Total" value={round2(v.tDay + v.tNight)} color={colors.text} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {v.members.map((m) => {
                const p = mealPartsFromObj(v.todayRec!.meals || {}, m.name);
                const eating = p.day + p.night > 0;
                return (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: colors.bg3,
                      borderRadius: radiusSm,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: eating ? colors.text : colors.text3, fontSize: 13 }}>{m.name}</Text>
                    {p.day > 0 ? <Badge text={`D${p.day}`} tone="blue" /> : null}
                    {p.night > 0 ? <Badge text={`N${p.night}`} tone="amber" /> : null}
                    {!eating ? <Badge text="Absent" tone="red" /> : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <Text style={{ color: colors.text3, fontSize: 13 }}>
              No meal entry for {v.isNextDay ? 'tomorrow' : 'today'} yet
            </Text>
            <Pressable
              onPress={() => router.push('/manager/meal-entry')}
              style={{ backgroundColor: colors.accent, borderRadius: radiusSm, paddingHorizontal: 16, paddingVertical: 9 }}
            >
              <Text style={{ color: '#1a1816', fontWeight: '800' }}>+ Add meals</Text>
            </Pressable>
          </View>
        )}
      </Card>

      {v.topBazar.length > 0 ? (
        <Card>
          <CardTitle icon="bazar">Bazar leaders · {v.monthLabel}</CardTitle>
          {v.topBazar.map(([name, amt], i) => {
            const col = avatarCol(i);
            return (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: col.fg, fontSize: 9, fontWeight: '700' }}>{initials(name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ color: colors.text, fontSize: 12 }}>{name}</Text>
                    <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700' }}>{fmtTk(amt)}</Text>
                  </View>
                  <View style={{ height: 5, backgroundColor: colors.bg4, borderRadius: 99, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round((amt / v.maxB) * 100)}%`, height: '100%', backgroundColor: colors.green }} />
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      {v.rentEntries.length > 0 ? (
        <Card>
          <CardTitle icon="rent">Rent status · {v.monthLabel}</CardTitle>
          {v.rentEntries.map((e) => {
            const paid = Number(e.paid || 0);
            const due = Number(e.rent || 0);
            const pct = due > 0 ? Math.round((paid / due) * 100) : 0;
            const color = e.status === 'paid' ? colors.green : e.status === 'partial' ? colors.amber : colors.red;
            return (
              <View key={e.name} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 12 }}>{e.name}</Text>
                  <Text style={{ color: colors.text2, fontSize: 11 }}>
                    {fmtTk(paid)} / {fmtTk(due)}
                  </Text>
                </View>
                <View style={{ height: 5, backgroundColor: colors.bg4, borderRadius: 99, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      {v.daysLogged > 0 ? (
        <Card>
          <CardTitle icon="members">Member meal share · {v.monthLabel}</CardTitle>
          {v.members.map((m, i) => {
            const val = round2(v.memMeals[m.name] || 0);
            const col = avatarCol(i);
            const baz = v.memBazar[m.name] || 0;
            return (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <Text style={{ color: colors.text, fontSize: 12, width: 80 }} numberOfLines={1}>
                  {m.name}
                </Text>
                <View style={{ flex: 1, height: 7, backgroundColor: colors.bg4, borderRadius: 99, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round((val / v.maxMem) * 100)}%`, height: '100%', backgroundColor: col.fg }} />
                </View>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', width: 30, textAlign: 'right' }}>{val}</Text>
                {baz > 0 ? <Badge text={fmtTk(baz)} tone="green" /> : <View style={{ width: 44 }} />}
              </View>
            );
          })}
        </Card>
      ) : null}
    </ScreenScroll>
  );
}

function MiniStat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg3,
        borderRadius: radiusSm,
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: 'center',
        gap: 3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon ? <Icon name={icon} size={11} color={color} /> : null}
        <Text style={{ color: colors.text3, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
      </View>
      <Text style={{ color, fontSize: 18, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

function ProgressRow({
  label,
  paid,
  total,
  pct,
  color,
}: {
  label: string;
  paid: number;
  total: number;
  pct: number;
  color: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: colors.text2, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: colors.text2, fontSize: 12 }}>
          {fmtTk(paid)} / {fmtTk(total)} ({pct}%)
        </Text>
      </View>
      <View style={{ height: 7, backgroundColor: colors.bg4, borderRadius: 99, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: color }} />
      </View>
    </View>
  );
}
