import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { getSession } from '../src/lib/session';
import { useMessData } from '../src/hooks/useMessData';
import { ScreenScroll, Card, CardTitle, StatCard, Loading, Centered } from '../src/components/ui';
import { MonthYearField } from '../src/components/form';
import { useTheme, radiusSm } from '../src/theme';
import { MONTHS, fmtTk, round2, monthKey, thisMonth, previousMonth } from '../src/core/format';
import {
  calcMemberSettlement,
  calcPrevDueForMember,
  utilTotalFromBills,
  UTIL_PREPAID_KEYS,
} from '../src/core/settlement';

export default function MonthlyLog() {
  const { colors } = useTheme();
  const { data, loading, error, refresh } = useMessData();
  const t = thisMonth();
  const [month, setMonth] = useState(t.month);
  const [year, setYear] = useState(t.year);
  const myName = data?.members.find((m) => m.id === getSession()?.user.memberId)?.name;

  const report = useMemo(() => {
    if (!data) return null;
    const settlementKey = monthKey(year, month);
    const prev = previousMonth(month, year);
    const rentByKey: Record<string, any> = {};
    data.rent.forEach((r) => (rentByKey[r.month_key] = r));
    const utilByKey: Record<string, any> = {};
    data.utility.forEach((u) => (utilByKey[u.month_key] = u));

    const curRent = rentByKey[settlementKey] || null;
    const curUtil = utilByKey[settlementKey] || null;
    const prevUtil = utilByKey[prev.key] || null;

    const rows = data.members.map((m) => {
      const p = calcMemberSettlement(m, data.meals, data.bazar, curRent, curUtil, prevUtil, settlementKey, data.members);
      const prevDue = calcPrevDueForMember(m, data.meals, data.bazar, data.rent, data.utility, settlementKey, data.members);
      return { ...p, prevDue, netWithPrevDue: round2(p.netPayable + prevDue) };
    });

    const totalMeals = round2(rows[0]?.totalMeals || 0);
    const totalBazar = round2(rows[0]?.totalBazar || 0);
    const mealRate = totalMeals > 0 ? round2(totalBazar / totalMeals) : 0;
    const prepaidTotal = utilTotalFromBills(curUtil?.bills || {}, UTIL_PREPAID_KEYS);
    const khalaTotal = Number((prevUtil?.bills as any)?.khala || 0);
    const otherTotal = Number((prevUtil?.bills as any)?.other || 0);
    const grandNet = round2(rows.reduce((s, r) => s + r.netWithPrevDue, 0));

    return {
      settlementKey,
      prevLabel: `${MONTHS[prev.month]} ${prev.year}`,
      curLabel: `${MONTHS[month]} ${year}`,
      rows,
      totalMeals,
      totalBazar,
      mealRate,
      prepaidTotal,
      postpaidTotal: round2(khalaTotal + otherTotal),
      prepaidShare: data.members.length ? round2(prepaidTotal / data.members.length) : 0,
      grandNet,
    };
  }, [data, month, year]);

  if (loading && !data) return <Loading label="Loading…" />;
  if (error && !data)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={refresh}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );
  if (!report) return null;

  return (
    <ScreenScroll
      title="Monthly Log"
      subtitle={`Settlement for ${report.curLabel}`}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <MonthYearField
        month={month}
        year={year}
        onChange={(m, y) => {
          setMonth(m);
          setYear(y);
        }}
      />

      <Text style={{ color: colors.text3, fontSize: 12 }}>
        Meals & bazar from {report.prevLabel} · rent & prepaid utility for {report.curLabel}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label="Total meals" value={report.totalMeals} sub={report.prevLabel} accent={colors.accent} />
        <StatCard label="Meal rate" value={fmtTk(report.mealRate)} sub={`${fmtTk(report.totalBazar)} ÷ ${report.totalMeals}`} accent={colors.blue} />
        <StatCard label="Prepaid bills" value={fmtTk(report.prepaidTotal)} sub="Elec+Gas+WiFi" accent={colors.blue} />
        <StatCard label="Postpaid bills" value={fmtTk(report.postpaidTotal)} sub="Khala+Other" accent={colors.red} />
      </View>

      <Card>
        <CardTitle>Member settlement</CardTitle>
        <View style={{ gap: 10 }}>
          {report.rows.map((p) => {
            const mine = p.memberName === myName;
            const net = p.netWithPrevDue;
            return (
              <View
                key={p.memberName}
                style={{
                  backgroundColor: mine ? colors.accentBg : colors.bg3,
                  borderRadius: radiusSm,
                  padding: 12,
                  borderWidth: mine ? 1 : 0,
                  borderColor: colors.accent,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                    {p.memberName}
                    {mine ? ' (You)' : ''}
                  </Text>
                  <Text
                    style={{
                      color: net > 0 ? colors.red : net < 0 ? colors.green : colors.text3,
                      fontWeight: '800',
                      fontSize: 14,
                    }}
                  >
                    {net > 0 ? `Pay ${fmtTk(net)}` : net < 0 ? `Get ${fmtTk(Math.abs(net))}` : '✓ Settled'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Chip label="Meal" value={fmtTk(p.mealCost)} color={colors.red} />
                  <Chip label="Khala" value={fmtTk(p.khalaShare)} color={colors.red} />
                  <Chip label="Other" value={fmtTk(p.otherShare)} color={colors.red} />
                  <Chip label="Util" value={fmtTk(p.prepaidUtility)} color={colors.blue} />
                  <Chip label="Rent" value={fmtTk(p.roomRent)} color={colors.blue} />
                  <Chip label="Bazar" value={fmtTk(p.memberBazar)} color={colors.green} />
                  <Chip label="Paid" value={fmtTk(round2(p.utilityPaid + p.roomRentPaid + p.mealPaid))} color={colors.green} />
                  {p.messCredit > 0 ? <Chip label="↩ Carry" value={fmtTk(p.messCredit)} color={colors.blue} /> : null}
                  {p.prevDue > 0 ? <Chip label="Prev due" value={fmtTk(p.prevDue)} color={colors.red} /> : null}
                </View>
              </View>
            );
          })}
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 12,
            padding: 12,
            backgroundColor: colors.bg2,
            borderRadius: radiusSm,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800' }}>Mess total</Text>
          <Text
            style={{
              color: report.grandNet > 0 ? colors.red : report.grandNet < 0 ? colors.green : colors.text3,
              fontWeight: '800',
            }}
          >
            {report.grandNet > 0
              ? `Collect ${fmtTk(report.grandNet)}`
              : report.grandNet < 0
              ? `Owe ${fmtTk(Math.abs(report.grandNet))}`
              : '✓ Balanced'}
          </Text>
        </View>
      </Card>
    </ScreenScroll>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.bg2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ color: colors.text3, fontSize: 9 }}>{label}</Text>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}
