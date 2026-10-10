import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { dbGetMembers, dbGetRent, dbGetRentMonth } from '../../src/lib/db';
import { saveRent, LockedMonthError } from '../../src/lib/managerActions';
import { thisMonth, monthKey, MONTHS, fmtTk, round2 } from '../../src/core/format';
import { ScreenScroll, Card, CardTitle, StatCard, Loading, Centered } from '../../src/components/ui';
import { Button, Field, MonthYearField, Badge } from '../../src/components/form';
import { useTheme, radiusSm } from '../../src/theme';
import type { Member, RentRecord } from '../../src/core/types';
import { useRouteProgress } from '../../src/components/motion';

type Row = { rent: string; paid: string; status: string; notes: string };

function autoStatus(rent: number, paid: number): string {
  if (paid <= 0) return 'unpaid';
  if (paid >= rent) return 'paid';
  return 'partial';
}

export default function RentEntry() {
  const { colors } = useTheme();
  const t = thisMonth();
  const [members, setMembers] = useState<Member[]>([]);
  const [history, setHistory] = useState<RentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useRouteProgress(loading);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(t.month);
  const [year, setYear] = useState(t.year);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);

  const key = monthKey(year, month);

  const loadBase = useCallback(async () => {
    setError(null);
    try {
      const [ms, all] = await Promise.all([dbGetMembers(), dbGetRent()]);
      setMembers(ms);
      setHistory(all.sort((a, b) => b.month_key.localeCompare(a.month_key)).slice(0, 8));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (members.length === 0) return;
    let active = true;
    dbGetRentMonth(key).then((rec) => {
      if (!active) return;
      const next: Record<string, Row> = {};
      members.forEach((m) => {
        const e = rec?.entries?.find((x) => x.name === m.name);
        next[m.id] = {
          rent: String(Number(e?.rent ?? m.rent ?? 0)),
          paid: String(Number(e?.paid ?? 0)),
          status: e?.status ?? 'unpaid',
          notes: e?.notes ?? '',
        };
      });
      setRows(next);
    });
    return () => {
      active = false;
    };
  }, [key, members]);

  const stats = useMemo(() => {
    let due = 0;
    let paid = 0;
    members.forEach((m) => {
      due += parseFloat(rows[m.id]?.rent || '0');
      paid += parseFloat(rows[m.id]?.paid || '0');
    });
    return { due: round2(due), paid: round2(paid), outstanding: round2(due - paid) };
  }, [rows, members]);

  if (loading && members.length === 0) return <Loading label="Loading…" />;
  if (error && members.length === 0)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={loadBase}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );

  const setField = (id: string, field: keyof Row, value: string) => {
    setRows((prev) => {
      const r = { ...prev[id], [field]: value };
      if (field === 'rent' || field === 'paid') {
        r.status = autoStatus(parseFloat(r.rent || '0'), parseFloat(r.paid || '0'));
      }
      return { ...prev, [id]: r };
    });
  };

  const markAllPaid = () => {
    setRows((prev) => {
      const next = { ...prev };
      members.forEach((m) => {
        next[m.id] = { ...next[m.id], paid: next[m.id]?.rent || '0', status: 'paid' };
      });
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, { rent: number; paid: number; status: string; notes: string }> = {};
      members.forEach((m) => {
        const r = rows[m.id] || { rent: '0', paid: '0', status: 'unpaid', notes: '' };
        payload[m.id] = {
          rent: parseFloat(r.rent || '0'),
          paid: parseFloat(r.paid || '0'),
          status: r.status,
          notes: r.notes,
        };
      });
      await saveRent(members, month, year, key, payload);
      Alert.alert('Saved', `Rent recorded for ${MONTHS[month]} ${year}.`);
      await loadBase();
    } catch (e: any) {
      Alert.alert(e instanceof LockedMonthError ? 'Month locked' : 'Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenScroll title="Room Rent" subtitle="Set rent and track collection">
      <Card>
        <Field label="Month">
          <MonthYearField month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        </Field>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <StatCard label="Total due" value={fmtTk(stats.due)} />
          <StatCard label="Collected" value={fmtTk(stats.paid)} accent={colors.green} />
          <StatCard label="Outstanding" value={fmtTk(stats.outstanding)} accent={stats.outstanding > 0 ? colors.red : colors.green} />
          <StatCard label="Rate" value={`${stats.due > 0 ? Math.round((stats.paid / stats.due) * 100) : 0}%`} accent={colors.blue} />
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <CardTitle>Rent entries</CardTitle>
          <Pressable onPress={markAllPaid}>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Mark all paid</Text>
          </Pressable>
        </View>
        <View style={{ gap: 10 }}>
          {members.map((m) => {
            const r = rows[m.id] || { rent: '0', paid: '0', status: 'unpaid', notes: '' };
            const tone = r.status === 'paid' ? 'green' : r.status === 'partial' ? 'amber' : 'red';
            return (
              <View key={m.id} style={{ backgroundColor: colors.bg3, borderRadius: radiusSm, padding: 10, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{m.name}</Text>
                  <Badge text={r.status} tone={tone as any} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <MiniInput label="Rent due ৳" value={r.rent} onChange={(v) => setField(m.id, 'rent', v)} />
                  <MiniInput label="Paid ৳" value={r.paid} onChange={(v) => setField(m.id, 'paid', v)} />
                </View>
                <MiniInput label="Notes" value={r.notes} onChange={(v) => setField(m.id, 'notes', v)} text />
              </View>
            );
          })}
        </View>
        <View style={{ marginTop: 14 }}>
          <Button label="Save rent" onPress={onSave} busy={saving} />
        </View>
      </Card>

      <Card>
        <CardTitle>History</CardTitle>
        {history.length === 0 ? (
          <Text style={{ color: colors.text3, fontSize: 13 }}>No rent records yet.</Text>
        ) : (
          history.map((r, i) => {
            const due = (r.entries || []).reduce((s, e) => s + Number(e.rent || 0), 0);
            const paid = (r.entries || []).reduce((s, e) => s + Number(e.paid || 0), 0);
            const paidCount = (r.entries || []).filter((e) => e.status === 'paid').length;
            return (
              <View
                key={r.id}
                style={{
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                    {MONTHS[r.month] ?? r.month_key} {r.year ?? ''}
                  </Text>
                  <Text style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>
                    {fmtTk(paid)} / {fmtTk(due)}
                  </Text>
                </View>
                <Text style={{ color: colors.text3, fontSize: 11, marginTop: 2 }}>
                  {paidCount}/{(r.entries || []).length} members paid
                </Text>
              </View>
            );
          })
        )}
      </Card>
    </ScreenScroll>
  );
}

function MiniInput({
  label,
  value,
  onChange,
  text,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  text?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={{ color: colors.text3, fontSize: 10 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(text ? t : t.replace(/[^0-9.]/g, ''))}
        keyboardType={text ? 'default' : 'decimal-pad'}
        placeholderTextColor={colors.text3}
        style={{
          backgroundColor: colors.bg2,
          borderColor: colors.border2,
          borderWidth: 1,
          borderRadius: 8,
          color: colors.text,
          fontSize: 14,
          paddingVertical: 7,
          paddingHorizontal: 10,
        }}
      />
    </View>
  );
}
