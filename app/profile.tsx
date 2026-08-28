import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { getSession } from '../src/lib/session';
import { useMessData } from '../src/hooks/useMessData';
import { ScreenScroll, Card, CardTitle, Loading, Centered } from '../src/components/ui';
import { SegmentedControl } from '../src/components/form';
import { useTheme, radiusSm, avatarCol } from '../src/theme';
import {
  MONTHS,
  fmtTk,
  round2,
  monthKey,
  thisMonth,
  previousMonth,
  previousMonthFromKey,
  monthLabelFromKey,
  initials,
} from '../src/core/format';
import { getFilteredData, getFilteredUtilityOnly, periodMonth, PERIOD_LABELS, type Period } from '../src/core/period';
import { getMemberStats, getUtilityBalance } from '../src/core/memberStats';
import { calcMemberSettlement, calcPrevDueForMember } from '../src/core/settlement';
import type { RentEntry, UtilityPayment } from '../src/core/types';

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'Next', value: 'next' },
  { label: 'This', value: '1' },
  { label: 'Last', value: 'last' },
  { label: '3M', value: '3' },
  { label: '6M', value: '6' },
  { label: 'All', value: 'all' },
];

export default function Profile() {
  const { colors } = useTheme();
  const { data, loading, error, refresh } = useMessData();
  const [period, setPeriod] = useState<Period>('1');
  const memberId = getSession()?.user.memberId;

  const view = useMemo(() => {
    if (!data || !memberId) return null;
    const member = data.members.find((m) => m.id === memberId);
    if (!member) return null;

    const { month: curM, year: curY } = periodMonth(period);
    const curKey = monthKey(curY, curM);
    const prev = previousMonth(curM, curY);

    const { meals, bazar, rent } = getFilteredData(data.meals, data.bazar, data.rent, period, data.utility);
    const filteredUtil = getFilteredUtilityOnly(data.utility, period);
    const s = getMemberStats(member, meals, bazar, rent, data.members, data.utility, filteredUtil);
    const allStats = getMemberStats(member, data.meals, data.bazar, data.rent, data.members, data.utility, null);

    const rentRec = data.rent.find((r) => r.month_key === curKey) ?? null;
    const curUtil = data.utility.find((u) => u.month_key === curKey) ?? null;
    const prevUtil = data.utility.find((u) => u.month_key === prev.key) ?? null;

    const calc = calcMemberSettlement(member, data.meals, data.bazar, rentRec, curUtil, prevUtil, curKey, data.members);
    const prevDue = calcPrevDueForMember(member, data.meals, data.bazar, data.rent, data.utility, curKey, data.members);
    const netWithPrevDue = round2(calc.netPayable + prevDue);

    const myRentEntry: Partial<RentEntry> = rentRec?.entries?.find((e) => e.name === member.name) ?? {};
    const myUtilPay: Partial<UtilityPayment> = (curUtil?.payments || {})[member.name] ?? {};
    const mealNet = round2(calc.memberBazar + calc.mealPaid - calc.mealCost);
    const rentNet = round2(Number(myRentEntry.paid || 0) - Number(myRentEntry.rent || 0));
    const utilNet = getUtilityBalance(member, curUtil, prevUtil, data.members);

    const rentByKey: Record<string, any> = {};
    data.rent.forEach((r) => (rentByKey[r.month_key] = r));
    const utilByKey: Record<string, any> = {};
    data.utility.forEach((u) => (utilByKey[u.month_key] = u));
    const recentKeys = Object.keys(allStats.byMonth).sort().slice(-6).reverse();
    const recent = recentKeys.map((k) => {
      const d = allStats.byMonth[k] || { meals: 0, bazar: 0, rentPaid: 0, utilityPaid: 0 };
      const pk = previousMonthFromKey(k).key;
      const nc = calcMemberSettlement(
        member,
        data.meals,
        data.bazar,
        rentByKey[k] || null,
        utilByKey[k] || null,
        utilByKey[pk] || null,
        k,
        data.members,
      );
      return { k, ...d, net: nc.netPayable };
    });

    const histKeys = Object.keys(allStats.byMonth).sort().slice(-8);
    const histMax = Math.max(...histKeys.map((k) => allStats.byMonth[k]?.meals || 0), 1);

    return {
      member,
      s,
      calc,
      prevDue,
      netWithPrevDue,
      mealNet,
      rentNet,
      utilNet,
      rentStatus: (myRentEntry.status as string) || 'unpaid',
      utilStatus: (myUtilPay.status as string) || 'unpaid',
      recent,
      histKeys,
      histMax,
      histByMonth: allStats.byMonth,
      curLabel: `${MONTHS[curM]} ${curY}`,
      prevLabel: `${MONTHS[prev.month]} ${prev.year}`,
    };
  }, [data, memberId, period]);

  if (loading && !data) return <Loading label="Loading profile…" />;
  if (error && !data)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={refresh}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );
  if (!view) return <Centered><Text style={{ color: colors.text3 }}>Profile not found.</Text></Centered>;

  const v = view;
  const col = avatarCol(v.member.id);
  const netColor = v.netWithPrevDue > 0 ? colors.red : v.netWithPrevDue < 0 ? colors.green : colors.text;

  const balColor = (n: number) => (n > 0 ? colors.green : n < 0 ? colors.red : colors.text2);
  const balText = (n: number, pos: string, neg: string) =>
    n === 0 ? '✓ Settled' : n > 0 ? `${pos} ${fmtTk(Math.abs(n))}` : `${neg} ${fmtTk(Math.abs(n))}`;

  return (
    <ScreenScroll
      title={v.member.name}
      subtitle={`Room ${v.member.room || '—'} · @${v.member.username}`}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      {period !== '1' && period !== 'last' ? (
        <Text style={{ color: colors.accent, fontSize: 11 }}>
          Stats cover {PERIOD_LABELS[period]}. Net payable & "What I Owe" stay pinned to {v.curLabel}.
        </Text>
      ) : null}

      {/* Balances */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: col.bg,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: colors.accent,
            }}
          >
            <Text style={{ color: col.fg, fontWeight: '800', fontSize: 15 }}>{initials(v.member.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{v.member.name}</Text>
            <Text style={{ color: colors.text3, fontSize: 11 }}>Joined {v.member.joined || '—'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { label: 'Meal balance', n: v.mealNet, pos: 'Get', neg: 'Pay' },
            { label: 'Rent balance', n: v.rentNet, pos: '+', neg: '−' },
            { label: 'Utility balance', n: v.utilNet, pos: '+', neg: '−' },
          ].map((b) => (
            <View key={b.label} style={{ flex: 1, backgroundColor: colors.bg3, borderRadius: radiusSm, padding: 10 }}>
              <Text style={{ color: colors.text3, fontSize: 10 }}>{b.label}</Text>
              <Text style={{ color: balColor(b.n), fontSize: 14, fontWeight: '800', marginTop: 3 }}>
                {balText(b.n, b.pos, b.neg)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Stat grid */}
      <Card>
        <CardTitle>Totals — {PERIOD_LABELS[period]}</CardTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            ['Total meals', String(v.s.totalMeals)],
            ['Active days', String(v.s.activeDays)],
            ['Avg / day', String(v.s.avgMeals)],
            ['Bazar spent', fmtTk(v.s.totalBazar)],
            ['Meal cost', fmtTk(v.s.mealCost)],
            ['Rent paid', fmtTk(v.s.rentPaid)],
            ['Utility paid', fmtTk(round2(v.s.utilityPaid))],
          ].map(([label, value]) => (
            <View key={label} style={{ flexBasis: '30%', flexGrow: 1, backgroundColor: colors.bg3, borderRadius: radiusSm, padding: 10 }}>
              <Text style={{ color: colors.text3, fontSize: 10 }}>{label}</Text>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 }}>{value}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Meal history sparkline */}
      {v.histKeys.length > 0 ? (
        <Card>
          <CardTitle>Monthly meal history</CardTitle>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70 }}>
            {v.histKeys.map((k) => {
              const val = v.histByMonth[k]?.meals || 0;
              const h = Math.max(Math.round((val / v.histMax) * 56), 4);
              return (
                <View key={k} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: colors.text3, fontSize: 9 }}>{round2(val)}</Text>
                  <View style={{ width: '70%', height: h, backgroundColor: colors.accent, borderRadius: 3 }} />
                  <Text style={{ color: colors.text3, fontSize: 9 }}>
                    {MONTHS[Number(k.slice(5, 7)) - 1].slice(0, 3)}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {/* Recent months */}
      <Card>
        <CardTitle>Recent months</CardTitle>
        {v.recent.length === 0 ? (
          <Text style={{ color: colors.text3, fontSize: 13 }}>No recent data.</Text>
        ) : (
          v.recent.map((r, i) => (
            <View
              key={r.k}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 9,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{monthLabelFromKey(r.k)}</Text>
                <Text style={{ color: colors.text3, fontSize: 11 }}>
                  {round2(r.meals)} meals · {fmtTk(r.bazar)} bazar
                </Text>
              </View>
              <Text
                style={{
                  color: r.net > 0 ? colors.red : r.net < 0 ? colors.green : colors.text3,
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {r.net > 0 ? `Pay ${fmtTk(r.net)}` : r.net < 0 ? `Get ${fmtTk(Math.abs(r.net))}` : '✓'}
              </Text>
            </View>
          ))
        )}
      </Card>

      {/* What I Owe */}
      <Card>
        <CardTitle>What I owe — {v.curLabel}</CardTitle>
        <OweRow label={`🍽️ Meal cost`} hint={`${round2(v.calc.memberMeals)} meals × ${fmtTk(v.calc.mealRate)}`} value={fmtTk(v.calc.mealCost)} />
        <OweRow label="👩 Khala share" hint={`${fmtTk(v.calc.khalaTotal)} ÷ ${data!.members.length}`} value={fmtTk(v.calc.khalaShare)} />
        <OweRow label="📦 Other share" value={fmtTk(v.calc.otherShare)} />
        <OweRow label="🏠 Rent" hint={v.rentStatus === 'paid' ? '✅ Paid' : '⏳ Not paid'} value={fmtTk(v.calc.roomRent)} />
        <OweRow label="⚡ Utility share" hint={`${fmtTk(v.calc.prepaidTotal)} ÷ ${data!.members.length}`} value={fmtTk(v.calc.prepaidUtility)} />
        <OweRow label="− Bazar credit" value={`-${fmtTk(v.calc.memberBazar)}`} good />
        {v.calc.roomRentPaid > 0 ? <OweRow label="− Rent paid" value={`-${fmtTk(v.calc.roomRentPaid)}`} good /> : null}
        {v.calc.mealPaid > 0 ? <OweRow label="− Meal paid (cash)" value={`-${fmtTk(v.calc.mealPaid)}`} good /> : null}
        {v.calc.utilityPaid > 0 ? <OweRow label="− Utility paid" value={`-${fmtTk(v.calc.utilityPaid)}`} good /> : null}
        {v.calc.messCredit > 0 ? <OweRow label="↩ Carry-forward credit" value={`-${fmtTk(v.calc.messCredit)}`} good /> : null}
        {v.prevDue > 0 ? <OweRow label="⚠️ Previous due" value={`+${fmtTk(v.prevDue)}`} bad /> : null}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 8,
            padding: 12,
            backgroundColor: colors.accentBg,
            borderRadius: radiusSm,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Net payable</Text>
          <Text style={{ color: netColor, fontWeight: '800', fontSize: 15 }}>
            {v.netWithPrevDue > 0
              ? `Pay ${fmtTk(v.netWithPrevDue)}`
              : v.netWithPrevDue < 0
              ? `Get ${fmtTk(Math.abs(v.netWithPrevDue))}`
              : '✓ Settled'}
          </Text>
        </View>
      </Card>
    </ScreenScroll>
  );
}

function OweRow({
  label,
  hint,
  value,
  good,
  bad,
}: {
  label: string;
  hint?: string;
  value: string;
  good?: boolean;
  bad?: boolean;
}) {
  const { colors } = useTheme();
  const c = good ? colors.green : bad ? colors.red : colors.text;
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: colors.bg3,
        borderRadius: 6,
        marginBottom: 5,
      }}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        {hint ? <Text style={{ color: colors.text3, fontSize: 10, marginTop: 1 }}>{hint}</Text> : null}
      </View>
      <Text style={{ color: c, fontSize: 13, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}
