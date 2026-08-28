import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import { getSession } from '../../src/lib/session';
import { dbGetBazar, dbGetMembers, dbGetBazarByDate } from '../../src/lib/db';
import { saveMyBazar } from '../../src/lib/memberActions';
import { todayStr, fmtTk, round2, monthLabelFromKey } from '../../src/core/format';
import { ScreenScroll, Card, CardTitle, Loading, Centered } from '../../src/components/ui';
import { Button, Field, NumberField, TextField, DateField } from '../../src/components/form';
import { useTheme, radiusSm } from '../../src/theme';
import type { Member, BazarRow } from '../../src/core/types';

export default function BazarLog() {
  const { colors } = useTheme();
  const [member, setMember] = useState<Member | null>(null);
  const [rows, setRows] = useState<BazarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const memberId = getSession()?.user.memberId;
    if (!memberId) {
      setError('Not signed in.');
      setLoading(false);
      return;
    }
    try {
      const [ms, bazar] = await Promise.all([dbGetMembers(), dbGetBazar()]);
      setMember(ms.find((m) => m.id === memberId) ?? null);
      setRows(bazar);
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
    if (!member || !date) return;
    let active = true;
    dbGetBazarByDate(date).then((row) => {
      if (!active) return;
      const v = Number((row?.bazar || {})[member.name] || 0);
      setAmount(v ? String(v) : '');
    });
    return () => {
      active = false;
    };
  }, [date, member]);

  const myRows = useMemo(() => {
    if (!member) return [];
    return rows
      .filter((r) => Number((r.bazar || {})[member.name] || 0) > 0)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 30);
  }, [rows, member]);

  const monthTotal = useMemo(() => {
    if (!member) return 0;
    const cur = todayStr().slice(0, 7);
    return round2(
      rows
        .filter((r) => String(r.date).startsWith(cur))
        .reduce((s, r) => s + Number((r.bazar || {})[member.name] || 0), 0),
    );
  }, [rows, member]);

  if (loading && !member) return <Loading label="Loading bazar log…" />;
  if (error && !member)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );
  if (!member) return null;

  const onSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Enter an amount');
      return;
    }
    setSaving(true);
    try {
      await saveMyBazar(member, date, parseFloat(amount), note.trim());
      setNote('');
      Alert.alert('Saved', 'Your bazar was updated. The manager has been notified.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenScroll
      title="Bazar Log"
      subtitle="Record your grocery spending"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <Card style={{ backgroundColor: colors.greenBg, borderColor: 'transparent' }}>
        <Text style={{ color: colors.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Your bazar this month
        </Text>
        <Text style={{ color: colors.green, fontSize: 26, fontWeight: '900', marginTop: 4 }}>
          {fmtTk(monthTotal)}
        </Text>
      </Card>

      <Card>
        <CardTitle>My bazar entry</CardTitle>
        <Text style={{ color: colors.text3, fontSize: 12, marginBottom: 12 }}>
          Sets your amount for the selected date. The manager gets an update notification.
        </Text>
        <View style={{ gap: 12 }}>
          <Field label="Date">
            <DateField value={date} onChange={setDate} />
          </Field>
          <Field label="Amount (৳)">
            <NumberField value={amount} onChangeText={setAmount} placeholder="e.g. 850" />
          </Field>
          <Field label="Note (optional)">
            <TextField value={note} onChangeText={setNote} placeholder="e.g. Vegetables from the market" />
          </Field>
          <Button label="Save my bazar" onPress={onSave} busy={saving} />
        </View>
      </Card>

      <Card>
        <CardTitle>My bazar history</CardTitle>
        {myRows.length === 0 ? (
          <Text style={{ color: colors.text3, fontSize: 13 }}>No bazar entries yet.</Text>
        ) : (
          <View>
            {myRows.map((r, i) => (
              <View
                key={r.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <View>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{r.date}</Text>
                  <Text style={{ color: colors.text3, fontSize: 11 }}>{monthLabelFromKey(r.date.slice(0, 7))}</Text>
                </View>
                <Text style={{ color: colors.green, fontSize: 14, fontWeight: '700' }}>
                  {fmtTk(Number((r.bazar || {})[member.name] || 0))}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScreenScroll>
  );
}
