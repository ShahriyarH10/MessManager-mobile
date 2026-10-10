import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { dbGetMembers, dbGetMealByDate, dbGetMeals, dbGetAttendanceForDate, dbDeleteRow } from '../../src/lib/db';
import { saveMeals, LockedMonthError } from '../../src/lib/managerActions';
import { todayStr, round2 } from '../../src/core/format';
import { mealPartsFromObj, mealMemberTotal } from '../../src/core/meals';
import { ScreenScroll, Card, CardTitle, StatCard, Loading, Centered } from '../../src/components/ui';
import { Button, Field, DateField } from '../../src/components/form';
import { MemberMealGrid } from '../../src/components/MemberGrid';
import { MonthGrid } from '../../src/components/MonthGrid';
import { Icon } from '../../src/components/Icon';
import { mealRowTotal } from '../../src/core/meals';
import { useTheme, radiusSm } from '../../src/theme';
import type { Member, MealRow } from '../../src/core/types';
import { useRouteProgress } from '../../src/components/motion';

type Vals = Record<string, { day: string; night: string }>;

export default function MealEntry() {
  const { colors } = useTheme();
  const [members, setMembers] = useState<Member[]>([]);
  const [recent, setRecent] = useState<MealRow[]>([]);
  const [allMeals, setAllMeals] = useState<MealRow[]>([]);
  const [loading, setLoading] = useState(true);
  useRouteProgress(loading);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayStr());
  const [gridMonth, setGridMonth] = useState(todayStr().slice(0, 7));
  const [vals, setVals] = useState<Vals>({});
  const [absent, setAbsent] = useState<Record<string, { day?: boolean; night?: boolean }>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ms, meals] = await Promise.all([dbGetMembers(), dbGetMeals()]);
      setMembers(ms);
      setAllMeals(meals);
      setRecent([...meals].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (members.length === 0 || !date) return;
    let active = true;
    Promise.all([dbGetMealByDate(date), dbGetAttendanceForDate(date)]).then(([row, att]) => {
      if (!active) return;
      const ab: Record<string, { day?: boolean; night?: boolean }> = {};
      att.forEach((a) => {
        ab[a.member_id] = { day: !a.day_meal, night: !a.night_meal };
      });
      setAbsent(ab);
      const next: Vals = {};
      members.forEach((m) => {
        // No entry for this day yet -> start everyone at 0 (use the quick-fill
        // buttons to bulk-set). Only pre-fill from a saved row.
        const p = mealPartsFromObj(row?.meals || {}, m.name);
        next[m.id] = row
          ? { day: String(p.day || 0), night: String(p.night || 0) }
          : { day: '0', night: '0' };
      });
      setVals(next);
    });
    return () => {
      active = false;
    };
  }, [date, members]);

  useEffect(() => {
    if (date) setGridMonth(date.slice(0, 7));
  }, [date]);

  const mealsByDate = useMemo(() => {
    const out: Record<string, number> = {};
    allMeals
      .filter((r) => String(r.date || '').startsWith(gridMonth))
      .forEach((r) => {
        out[String(r.date)] = round2(mealRowTotal(r.meals || {}));
      });
    return out;
  }, [allMeals, gridMonth]);

  const totals = useMemo(() => {
    let d = 0;
    let n = 0;
    let eating = 0;
    members.forEach((m) => {
      const dv = parseFloat(vals[m.id]?.day || '0');
      const nv = parseFloat(vals[m.id]?.night || '0');
      d += dv;
      n += nv;
      if (dv > 0 || nv > 0) eating++;
    });
    return { day: round2(d), night: round2(n), total: round2(d + n), eating };
  }, [vals, members]);

  if (loading && members.length === 0) return <Loading label="Loading…" />;
  if (error && members.length === 0)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );

  const setAll = (part: 'day' | 'night' | 'both', v: string) => {
    setVals((prev) => {
      const next = { ...prev };
      members.forEach((m) => {
        next[m.id] = { ...next[m.id] };
        if (part === 'day' || part === 'both') next[m.id].day = v;
        if (part === 'night' || part === 'both') next[m.id].night = v;
      });
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, { day: number; night: number }> = {};
      members.forEach((m) => {
        payload[m.id] = {
          day: parseFloat(vals[m.id]?.day || '0'),
          night: parseFloat(vals[m.id]?.night || '0'),
        };
      });
      await saveMeals(members, date, payload);
      Alert.alert('Saved', `Meals recorded for ${date}.`);
      await load();
    } catch (e: any) {
      Alert.alert(e instanceof LockedMonthError ? 'Month locked' : 'Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const del = (id: string) => {
    Alert.alert('Delete entry?', 'Removes the whole day.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await dbDeleteRow('meals', id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed.');
          }
        },
      },
    ]);
  };

  return (
    <ScreenScroll title="Meal Entry" subtitle="Log day/night meals for every member">
      <Card>
        <Field label="Date">
          <DateField value={date} onChange={setDate} />
        </Field>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <StatCard label="Total" value={totals.total} accent={colors.accent} />
          <StatCard label="Day" value={totals.day} accent={colors.blue} />
          <StatCard label="Night" value={totals.night} accent={colors.amber} />
          <StatCard label="Eating" value={`${totals.eating}/${members.length}`} accent={colors.green} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <QuickBtn label="All → 1" onPress={() => setAll('both', '1')} />
          <QuickBtn label="Day → 1" onPress={() => setAll('day', '1')} />
          <QuickBtn label="Night → 1" onPress={() => setAll('night', '1')} />
          <QuickBtn label="Clear" onPress={() => setAll('both', '0')} />
        </View>
      </Card>

      <Card>
        <CardTitle icon="calendar">Month grid</CardTitle>
        <Text style={{ color: colors.text3, fontSize: 12, marginBottom: 12 }}>
          Tap any day to load it above. Darker cells = more meals that day.
        </Text>
        <MonthGrid
          monthKey={gridMonth}
          onMonthChange={setGridMonth}
          values={mealsByDate}
          selectedDate={date}
          onSelectDay={setDate}
          format={(n) => String(round2(n))}
          accent={colors.blue}
        />
      </Card>

      <Card>
        <CardTitle>Members</CardTitle>
        <MemberMealGrid
          members={members}
          values={vals}
          absent={absent}
          onChange={(id, part, text) =>
            setVals((prev) => ({ ...prev, [id]: { ...prev[id], [part]: text } }))
          }
        />
        <View style={{ marginTop: 14 }}>
          <Button label="Save meals" onPress={onSave} busy={saving} />
        </View>
      </Card>

      <Card>
        <CardTitle>Recent entries</CardTitle>
        {recent.length === 0 ? (
          <Text style={{ color: colors.text3, fontSize: 13 }}>No meal entries yet.</Text>
        ) : (
          recent.map((r, i) => {
            const tot = members.reduce((s, m) => s + mealMemberTotal(r.meals || {}, m.name), 0);
            return (
              <View
                key={r.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 14 }}>{r.date}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Text style={{ color: colors.text2, fontSize: 13, fontWeight: '700' }}>{round2(tot)} meals</Text>
                  <Pressable onPress={() => del(r.id)} hitSlop={8}>
                    <Icon name="trash" size={16} color={colors.red} />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </Card>
    </ScreenScroll>
  );
}

function QuickBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.bg3,
        borderColor: colors.border2,
        borderWidth: 1,
        borderRadius: radiusSm,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
