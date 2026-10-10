import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { dbGetMembers, dbGetBazar, dbGetBazarByDate, dbDeleteRow } from '../../src/lib/db';
import { saveBazar, LockedMonthError } from '../../src/lib/managerActions';
import { todayStr, fmtTk, round2 } from '../../src/core/format';
import { ScreenScroll, Card, CardTitle, Loading, Centered } from '../../src/components/ui';
import { Button, Field, DateField } from '../../src/components/form';
import { MemberValueGrid } from '../../src/components/MemberGrid';
import { MonthGrid } from '../../src/components/MonthGrid';
import { Icon } from '../../src/components/Icon';
import { useTheme } from '../../src/theme';
import type { Member, BazarRow } from '../../src/core/types';
import { useRouteProgress } from '../../src/components/motion';

export default function BazarEntry() {
  const { colors } = useTheme();
  const [members, setMembers] = useState<Member[]>([]);
  const [recent, setRecent] = useState<BazarRow[]>([]);
  const [allBazar, setAllBazar] = useState<BazarRow[]>([]);
  const [loading, setLoading] = useState(true);
  useRouteProgress(loading);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayStr());
  const [gridMonth, setGridMonth] = useState(todayStr().slice(0, 7));
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ms, bazar] = await Promise.all([dbGetMembers(), dbGetBazar()]);
      setMembers(ms);
      setAllBazar(bazar);
      setRecent([...bazar].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8));
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
    dbGetBazarByDate(date).then((row) => {
      if (!active) return;
      const next: Record<string, string> = {};
      members.forEach((m) => {
        const v = Number((row?.bazar || {})[m.name] || 0);
        next[m.id] = v ? String(v) : '';
      });
      setVals(next);
    });
    return () => {
      active = false;
    };
  }, [date, members]);

  const total = useMemo(
    () => round2(members.reduce((s, m) => s + parseFloat(vals[m.id] || '0'), 0)),
    [vals, members],
  );

  useEffect(() => {
    if (date) setGridMonth(date.slice(0, 7));
  }, [date]);

  const bazarByDate = useMemo(() => {
    const out: Record<string, number> = {};
    allBazar
      .filter((r) => String(r.date || '').startsWith(gridMonth))
      .forEach((r) => {
        out[String(r.date)] = round2(
          Object.values(r.bazar || {}).reduce((s, v) => s + Number(v || 0), 0),
        );
      });
    return out;
  }, [allBazar, gridMonth]);

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

  const onSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      members.forEach((m) => (payload[m.id] = parseFloat(vals[m.id] || '0')));
      await saveBazar(members, date, payload);
      Alert.alert('Saved', `Bazar recorded for ${date}.`);
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
            await dbDeleteRow('bazar', id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed.');
          }
        },
      },
    ]);
  };

  return (
    <ScreenScroll title="Bazar Entry" subtitle="Record grocery spending per member">
      <Card>
        <Field label="Date">
          <DateField value={date} onChange={setDate} />
        </Field>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 12,
            padding: 12,
            backgroundColor: colors.greenBg,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>Day total</Text>
          <Text style={{ color: colors.green, fontWeight: '800' }}>{fmtTk(total)}</Text>
        </View>
      </Card>

      <Card>
        <CardTitle icon="calendar">Month grid</CardTitle>
        <Text style={{ color: colors.text3, fontSize: 12, marginBottom: 12 }}>
          Tap any day to load it above. Darker cells = more spend that day.
        </Text>
        <MonthGrid
          monthKey={gridMonth}
          onMonthChange={setGridMonth}
          values={bazarByDate}
          selectedDate={date}
          onSelectDay={setDate}
          format={(n) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)))}
          accent={colors.green}
        />
      </Card>

      <Card>
        <CardTitle>Members</CardTitle>
        <MemberValueGrid
          members={members}
          values={vals}
          onChange={(id, text) => setVals((prev) => ({ ...prev, [id]: text }))}
        />
        <View style={{ marginTop: 14 }}>
          <Button label="Save bazar" onPress={onSave} busy={saving} />
        </View>
      </Card>

      <Card>
        <CardTitle>Recent entries</CardTitle>
        {recent.length === 0 ? (
          <Text style={{ color: colors.text3, fontSize: 13 }}>No bazar entries yet.</Text>
        ) : (
          recent.map((r, i) => {
            const tot = Object.values(r.bazar || {}).reduce((s, v) => s + Number(v || 0), 0);
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
                  <Text style={{ color: colors.green, fontSize: 13, fontWeight: '700' }}>{fmtTk(round2(tot))}</Text>
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
