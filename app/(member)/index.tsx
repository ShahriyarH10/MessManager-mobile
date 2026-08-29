import React, { useState } from 'react';
import { View, Text, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemberDashboard } from '../../src/hooks/useMemberDashboard';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenScroll, Card, CardTitle, StatCard, Loading, Centered } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { useTheme, radius, radiusSm, avatarCol } from '../../src/theme';
import { fmtTk, initials } from '../../src/core/format';

export default function Dashboard() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut, mess } = useAuth();
  const { data, loading, error, refresh } = useMemberDashboard();
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (loading && !data) return <Loading label="Loading your dashboard…" />;

  if (error && !data) {
    return (
      <Centered>
        <Text style={{ color: colors.red, fontSize: 15, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={refresh} style={{ padding: 10 }}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Retry</Text>
        </Pressable>
        <Pressable onPress={signOut} style={{ padding: 10 }}>
          <Text style={{ color: colors.text3 }}>Sign out</Text>
        </Pressable>
      </Centered>
    );
  }

  if (!data) return null;

  const { calc, today } = data;
  const net = calc.netWithPrevDue;
  const owes = net > 0;
  const owed = net < 0;
  const netColor = owes ? colors.red : owed ? colors.green : colors.text;
  const netBg = owes ? colors.redBg : owed ? colors.greenBg : colors.bg3;
  const netLabel = owes
    ? `You pay ${fmtTk(net)}`
    : owed
    ? `You get ${fmtTk(Math.abs(net))}`
    : 'Settled';

  const charges: { label: string; value: number; color: string }[] = [
    { label: 'Meal', value: calc.mealCost, color: colors.accent },
    { label: 'Rent', value: calc.roomRent, color: colors.amber },
    { label: 'Utility', value: calc.prepaidUtility, color: colors.purple },
    { label: 'Khala + Other', value: calc.postpaidUtility, color: colors.blue },
  ].filter((c) => c.value > 0);
  const totalCharges = charges.reduce((s, c) => s + c.value, 0) || 1;

  const credits: { label: string; value: number }[] = [
    { label: 'Bazar', value: calc.memberBazar },
    { label: 'Rent paid', value: calc.roomRentPaid },
    { label: 'Utility paid', value: calc.utilityPaid },
    { label: 'Meal paid', value: calc.mealPaid },
    { label: 'Carry fwd', value: calc.messCredit },
  ].filter((c) => c.value > 0);

  const todayTotal = data.today.totalDay + data.today.totalNight;

  return (
    <View style={{ flex: 1 }}>
    <ScreenScroll
      title="My Dashboard"
      subtitle={`${data.member.name} · ${data.monthLabel}`}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
      }
    >
      {/* Net payable hero */}
      <Card style={{ backgroundColor: netBg, borderColor: 'transparent' }}>
        <Text style={{ color: colors.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Net payable — {data.monthLabel}
        </Text>
        <Text style={{ color: netColor, fontSize: 28, fontWeight: '900', marginTop: 6 }}>
          {netLabel}
        </Text>
        <Text style={{ color: colors.text3, fontSize: 11, marginTop: 6 }}>
          Meals/bazar from {data.prevLabel} · rent/utility from {data.monthLabel}
        </Text>
        {calc.prevDue > 0 ? (
          <Text style={{ color: colors.red, fontSize: 11, marginTop: 4, fontWeight: '600' }}>
            Includes {fmtTk(calc.prevDue)} unpaid due carried from before {data.prevLabel}
          </Text>
        ) : null}

        {charges.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <Text style={{ color: colors.text3, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Your charges this month
            </Text>
            <View style={{ flexDirection: 'row', height: 8, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
              {charges.map((c) => (
                <View key={c.label} style={{ flex: c.value / totalCharges, backgroundColor: c.color, borderRadius: 2 }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
              {charges.map((c) => (
                <Text key={c.label} style={{ color: c.color, fontSize: 11 }}>
                  {c.label} {fmtTk(c.value)}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {credits.length > 0 ? (
          <View
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text3, fontSize: 10 }}>Credits:</Text>
            {credits.map((c) => (
              <Text key={c.label} style={{ color: colors.green, fontSize: 10 }}>
                {c.label} {fmtTk(c.value)}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      {/* Settlement breakdown — collapsed by default */}
      <Card>
        <Pressable
          onPress={() => setShowBreakdown((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
        >
          <Icon name="monthlyLog" size={16} color={colors.text2} />
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
            Settlement breakdown
          </Text>
          <Text style={{ color: netColor, fontSize: 13, fontWeight: '800', marginRight: 4 }}>{netLabel}</Text>
          <View style={{ transform: [{ rotate: showBreakdown ? '90deg' : '0deg' }] }}>
            <Icon name="chevron" size={16} color={colors.text3} />
          </View>
        </Pressable>
        {!showBreakdown ? (
          <Text style={{ color: colors.text3, fontSize: 11, marginTop: 8 }}>Tap to see how this is calculated</Text>
        ) : null}

        {showBreakdown ? (
        <View style={{ marginTop: 12 }}>
        <BreakdownRow label="Meal cost" hint={`${calc.memberMeals} meals × ${fmtTk(calc.mealRate)}`} value={`+ ${fmtTk(calc.mealCost)}`} color={colors.red} />
        <BreakdownRow label="Khala share" hint={`${fmtTk(calc.khalaTotal)} ÷ ${data.memberCount}`} value={`+ ${fmtTk(calc.khalaShare)}`} color={colors.red} />
        <BreakdownRow label="Other share" hint={`${fmtTk(calc.otherTotal)} ÷ ${data.memberCount}`} value={`+ ${fmtTk(calc.otherShare)}`} color={colors.red} />
        <BreakdownRow label="Room rent" hint={data.monthLabel} value={`+ ${fmtTk(calc.roomRent)}`} color={colors.blue} />
        <BreakdownRow label="Utility share" hint={`${fmtTk(calc.prepaidTotal)} ÷ ${data.memberCount}`} value={`+ ${fmtTk(calc.prepaidUtility)}`} color={colors.blue} />
        <BreakdownRow label="Bazar credit" hint={`Groceries you bought in ${data.prevLabel}`} value={`− ${fmtTk(calc.memberBazar)}`} color={colors.green} />
        {calc.roomRentPaid > 0 ? <BreakdownRow label="Rent paid" value={`− ${fmtTk(calc.roomRentPaid)}`} color={colors.green} /> : null}
        {calc.utilityPaid > 0 ? <BreakdownRow label="Utility paid" value={`− ${fmtTk(calc.utilityPaid)}`} color={colors.green} /> : null}
        {calc.mealPaid > 0 ? <BreakdownRow label="Meal paid" value={`− ${fmtTk(calc.mealPaid)}`} color={colors.green} /> : null}
        {calc.messCredit > 0 ? <BreakdownRow label="Carried forward" value={`− ${fmtTk(calc.messCredit)}`} color={colors.blue} /> : null}
        {calc.prevDue > 0 ? <BreakdownRow label="Previous due" hint={`Outstanding before ${data.prevLabel}`} value={`+ ${fmtTk(calc.prevDue)}`} color={colors.red} /> : null}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            backgroundColor: colors.accentBg,
            borderRadius: radiusSm,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Net payable</Text>
          <Text style={{ color: netColor, fontWeight: '800', fontSize: 15 }}>{netLabel}</Text>
        </View>
        </View>
        ) : null}
      </Card>

      {/* Mess-wide stats */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label="Mess meals" value={data.messMeals} sub="total this month" accent={colors.accent} />
        <StatCard label="Meal rate" value={fmtTk(data.mealRate)} sub="per meal this month" accent={colors.blue} />
        <StatCard label="Total bazar" value={fmtTk(data.messBazar)} sub="this month" accent={colors.green} />
        <StatCard label="Members" value={data.memberCount} sub={mess?.name ?? 'this mess'} accent={colors.text3} />
      </View>

      {/* Today */}
      <Card>
        <CardTitle icon="calendar">
          {today.isNextDay ? 'Tomorrow' : 'Today'} · {today.dateStr}
        </CardTitle>
        {today.hasEntry ? (
          <View
            style={{
              backgroundColor: today.myDay + today.myNight > 0 ? colors.accentBg : colors.redBg,
              borderRadius: radiusSm,
              padding: 12,
            }}
          >
            <Text
              style={{
                color: today.myDay + today.myNight > 0 ? colors.accent : colors.red,
                fontWeight: '700',
                fontSize: 13,
              }}
            >
              {today.myDay + today.myNight > 0 ? 'You are eating' : 'You are absent'}
            </Text>
            {today.myDay + today.myNight > 0 ? (
              <Text style={{ color: colors.text3, fontSize: 12, marginTop: 3 }}>
                {today.myDay > 0 ? `Day ${today.myDay}  ` : ''}
                {today.myNight > 0 ? `Night ${today.myNight}` : ''}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={{ color: colors.text3, fontSize: 13 }}>
            No meal entry for {today.isNextDay ? 'tomorrow' : 'today'} yet
          </Text>
        )}
      </Card>

      {/* Who ate how much */}
      {data.whoAte.some((w) => w.meals > 0) ? (
        <Card>
          <CardTitle>Who ate how much — {data.monthLabel}</CardTitle>
          <View style={{ gap: 8 }}>
            {data.whoAte.map((w, i) => {
              const col = avatarCol(i);
              const maxMeals = Math.max(...data.whoAte.map((x) => x.meals), 1);
              return (
                <View
                  key={w.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    padding: 6,
                    borderRadius: radiusSm,
                    backgroundColor: w.isMe ? colors.accentBg : 'transparent',
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: col.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: col.fg, fontSize: 9, fontWeight: '700' }}>{initials(w.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={{ color: w.isMe ? colors.accent : colors.text, fontSize: 12, fontWeight: w.isMe ? '700' : '500' }}>
                        {w.name}
                        {w.isMe ? ' (You)' : ''}
                      </Text>
                      <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600' }}>
                        {w.meals} meals{w.bazar > 0 ? ` · ${fmtTk(w.bazar)}` : ''}
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: colors.bg4, borderRadius: 99, overflow: 'hidden' }}>
                      <View
                        style={{
                          width: `${Math.round((w.meals / maxMeals) * 100)}%`,
                          height: '100%',
                          backgroundColor: w.isMe ? colors.accent : col.fg,
                          borderRadius: 99,
                        }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={{ color: colors.text3, fontSize: 10, marginTop: 8 }}>
            Balance uses the current running rate {fmtTk(data.mealRate)}/meal.
          </Text>
        </Card>
      ) : null}

      <Pressable onPress={signOut} style={{ padding: 12, alignItems: 'center' }}>
        <Text style={{ color: colors.text3, fontSize: 13 }}>Sign out</Text>
      </Pressable>
    </ScreenScroll>

    {data.today.hasEntry ? (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 16,
          bottom: insets.bottom + 18,
          backgroundColor: colors.accent,
          borderRadius: radius,
          paddingLeft: 6,
          paddingRight: 14,
          paddingVertical: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: colors.accent,
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 5 },
          elevation: 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: 'rgba(26,24,22,0.14)',
            borderRadius: radius - 4,
            paddingHorizontal: 9,
            paddingVertical: 6,
          }}
        >
          <Icon name="day" size={13} color="#1a1816" />
          <Text style={{ color: '#1a1816', fontWeight: '900', fontSize: 14 }}>{data.today.totalDay}</Text>
          <View style={{ width: 1, height: 12, backgroundColor: 'rgba(26,24,22,0.28)', marginHorizontal: 3 }} />
          <Icon name="night" size={13} color="#1a1816" />
          <Text style={{ color: '#1a1816', fontWeight: '900', fontSize: 14 }}>{data.today.totalNight}</Text>
        </View>
        <View>
          <Text style={{ color: '#1a1816', fontWeight: '900', fontSize: 13, lineHeight: 15 }}>{todayTotal} meals</Text>
          <Text style={{ color: '#1a1816', fontWeight: '700', fontSize: 10, opacity: 0.7, lineHeight: 12 }}>
            {data.today.isNextDay ? 'tomorrow' : 'today'}
          </Text>
        </View>
      </View>
    ) : null}
    </View>
  );
}

function BreakdownRow({
  label,
  hint,
  value,
  color,
}: {
  label: string;
  hint?: string;
  value: string;
  color: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 9,
        paddingHorizontal: 12,
        backgroundColor: colors.bg3,
        borderRadius: 6,
        marginBottom: 5,
      }}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
        {hint ? <Text style={{ color: colors.text3, fontSize: 11, marginTop: 1 }}>{hint}</Text> : null}
      </View>
      <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{value}</Text>
    </View>
  );
}
