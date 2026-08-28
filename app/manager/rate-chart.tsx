import React, { useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { useMessData } from '../../src/hooks/useMessData';
import { ScreenScroll, Card, CardTitle, StatCard, Loading, Centered } from '../../src/components/ui';
import { useTheme, avatarCol } from '../../src/theme';
import { MONTHS, fmtTk, round2, monthKey, thisMonth, initials } from '../../src/core/format';
import { mealMemberTotal } from '../../src/core/meals';

export default function RateChart() {
  const { colors } = useTheme();
  const { data, loading, error, refresh } = useMessData();

  const v = useMemo(() => {
    if (!data) return null;
    const { members, meals, bazar } = data;
    const md: Record<string, { meals: number; bazar: number }> = {};
    meals.forEach((r) => {
      const k = String(r.date || '').slice(0, 7);
      if (!k) return;
      md[k] = md[k] || { meals: 0, bazar: 0 };
      const mObj = r.meals || {};
      const ks = Object.keys(mObj);
      const split = ks.some((x) => x.endsWith('_day') || x.endsWith('_night'));
      if (split) ks.forEach((x) => { if (x.endsWith('_day') || x.endsWith('_night')) md[k].meals += Number(mObj[x]) || 0; });
      else Object.values(mObj).forEach((x) => (md[k].meals += Number(x) || 0));
    });
    bazar.forEach((r) => {
      const k = String(r.date || '').slice(0, 7);
      if (!k) return;
      md[k] = md[k] || { meals: 0, bazar: 0 };
      Object.values(r.bazar || {}).forEach((x) => (md[k].bazar += Number(x) || 0));
    });
    const keys = Object.keys(md).sort().slice(-12);
    const rows = keys.map((k) => ({
      key: k,
      label: `${MONTHS[Number(k.slice(5, 7)) - 1].slice(0, 3)} '${k.slice(2, 4)}`,
      rate: md[k].meals > 0 ? round2(md[k].bazar / md[k].meals) : 0,
      meals: round2(md[k].meals),
      bazar: round2(md[k].bazar),
    }));
    const avg = rows.length ? round2(rows.reduce((s, r) => s + r.rate, 0) / rows.length) : 0;
    const maxRate = Math.max(...rows.map((r) => r.rate), 1);
    const maxBazar = Math.max(...rows.map((r) => r.bazar), 1);

    const { month, year } = thisMonth();
    const curKey = monthKey(year, month);
    const curMeals = meals.filter((r) => r.date.startsWith(curKey));
    const share = members
      .map((m) => ({
        name: m.name,
        meals: round2(curMeals.reduce((s, r) => s + mealMemberTotal(r.meals || {}, m.name), 0)),
      }))
      .sort((a, b) => b.meals - a.meals);
    const shareTotal = Math.max(share.reduce((s, x) => s + x.meals, 0), 1);

    return { rows, avg, maxRate, maxBazar, share, shareTotal, curLabel: `${MONTHS[month]} ${year}` };
  }, [data]);

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
  if (!v || v.rows.length === 0)
    return (
      <ScreenScroll title="Analytics" subtitle="Meal rate & spending trends">
        <Card>
          <Text style={{ color: colors.text3 }}>No meal/bazar data yet.</Text>
        </Card>
      </ScreenScroll>
    );

  return (
    <ScreenScroll
      title="Analytics"
      subtitle="Meal rate & spending trends"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatCard label="Avg meal rate" value={fmtTk(v.avg)} accent={colors.accent} />
        <StatCard label="Latest" value={fmtTk(v.rows[v.rows.length - 1].rate)} accent={colors.blue} />
      </View>

      <Card>
        <CardTitle>Meal rate by month (৳/meal)</CardTitle>
        <BarChart rows={v.rows.map((r) => ({ label: r.label, value: r.rate }))} max={v.maxRate} color={colors.accent} format={fmtTk} avg={v.avg} />
      </Card>

      <Card>
        <CardTitle>Bazar spend by month</CardTitle>
        <BarChart rows={v.rows.map((r) => ({ label: r.label, value: r.bazar }))} max={v.maxBazar} color={colors.green} format={fmtTk} />
      </Card>

      <Card>
        <CardTitle>Member meal share — {v.curLabel}</CardTitle>
        {v.share.map((s, i) => {
          const col = avatarCol(i);
          const pct = Math.round((s.meals / v.shareTotal) * 100);
          return (
            <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: col.fg, fontSize: 9, fontWeight: '700' }}>{initials(s.name)}</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 12, width: 78 }} numberOfLines={1}>
                {s.name}
              </Text>
              <View style={{ flex: 1, height: 7, backgroundColor: colors.bg4, borderRadius: 99, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: col.fg }} />
              </View>
              <Text style={{ color: colors.text2, fontSize: 12, width: 54, textAlign: 'right' }}>
                {s.meals} · {pct}%
              </Text>
            </View>
          );
        })}
      </Card>
    </ScreenScroll>
  );
}

function BarChart({
  rows,
  max,
  color,
  format,
  avg,
}: {
  rows: { label: string; value: number }[];
  max: number;
  color: string;
  format: (n: number) => string;
  avg?: number;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 120 }}>
        {rows.map((r) => {
          const h = Math.max(Math.round((r.value / max) * 96), 3);
          return (
            <View key={r.label} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <Text style={{ color: colors.text3, fontSize: 8 }} numberOfLines={1}>
                {r.value >= 1000 ? Math.round(r.value / 100) / 10 + 'k' : Math.round(r.value)}
              </Text>
              <View style={{ width: '72%', height: h, backgroundColor: color, borderRadius: 3 }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        {rows.map((r) => (
          <Text key={r.label} style={{ flex: 1, color: colors.text3, fontSize: 8, textAlign: 'center' }}>
            {r.label}
          </Text>
        ))}
      </View>
      {avg != null ? (
        <Text style={{ color: colors.green, fontSize: 11, marginTop: 6 }}>Average: {format(avg)}</Text>
      ) : null}
    </View>
  );
}
