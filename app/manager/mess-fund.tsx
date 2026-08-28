import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import {
  dbGetFundEntries,
  dbAddFundEntry,
  dbDeleteFundEntry,
  logAudit,
  type FundEntry,
} from '../../src/lib/db';
import { ScreenScroll, Card, CardTitle, StatCard, Loading, Centered } from '../../src/components/ui';
import { Button, Field, NumberField, TextField, DateField, SegmentedControl, Badge } from '../../src/components/form';
import { todayStr, fmtTk, round2 } from '../../src/core/format';
import { useTheme, radiusSm } from '../../src/theme';

export default function MessFund() {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<FundEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await dbGetFundEntries());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const dep = round2(entries.filter((e) => e.type === 'deposit').reduce((s, e) => s + e.amount, 0));
    const wd = round2(entries.filter((e) => e.type === 'withdrawal').reduce((s, e) => s + e.amount, 0));
    return { dep, wd, balance: round2(dep - wd) };
  }, [entries]);

  if (loading && entries.length === 0) return <Loading label="Loading fund…" />;
  if (error && entries.length === 0)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );

  const add = async () => {
    const amt = parseFloat(amount || '0');
    if (amt <= 0) {
      Alert.alert('Enter a valid amount');
      return;
    }
    setBusy(true);
    try {
      await dbAddFundEntry({ type, amount: amt, date, note: note.trim() });
      await logAudit('create', 'fund', date, `Fund ${type}: ${fmtTk(amt)}${note ? ' — ' + note : ''}`);
      setAmount('');
      setNote('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  const del = (e: FundEntry) => {
    Alert.alert('Delete entry?', 'Removes this transaction from the fund history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await dbDeleteFundEntry(e.month_key, e.id);
            await load();
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Failed.');
          }
        },
      },
    ]);
  };

  return (
    <ScreenScroll
      title="Mess Fund"
      subtitle="Petty cash pool"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label="Balance" value={fmtTk(stats.balance)} accent={stats.balance >= 0 ? colors.green : colors.red} />
        <StatCard label="Deposits" value={fmtTk(stats.dep)} accent={colors.blue} />
        <StatCard label="Withdrawn" value={fmtTk(stats.wd)} accent={colors.amber} />
        <StatCard label="Entries" value={entries.length} />
      </View>

      <Card>
        <CardTitle>Add entry</CardTitle>
        <View style={{ gap: 12 }}>
          <SegmentedControl
            options={[
              { label: '↓ Deposit', value: 'deposit' },
              { label: '↑ Withdrawal', value: 'withdrawal' },
            ]}
            value={type}
            onChange={setType}
          />
          <Field label="Amount (৳)">
            <NumberField value={amount} onChangeText={setAmount} placeholder="e.g. 500" />
          </Field>
          <Field label="Date">
            <DateField value={date} onChange={setDate} />
          </Field>
          <Field label="Note">
            <TextField value={note} onChangeText={setNote} placeholder="e.g. Cleaning supplies" />
          </Field>
          <Button label="Save entry" onPress={add} busy={busy} />
        </View>
      </Card>

      <Card>
        <CardTitle>Transaction history</CardTitle>
        {entries.length === 0 ? (
          <Text style={{ color: colors.text3, fontSize: 13 }}>No fund entries yet.</Text>
        ) : (
          entries.map((e, i) => (
            <View
              key={e.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Badge text={e.type === 'deposit' ? '↓ Deposit' : '↑ Withdrawal'} tone={e.type === 'deposit' ? 'green' : 'amber'} />
                  <Text style={{ color: colors.text3, fontSize: 11 }}>{e.date}</Text>
                </View>
                {e.note ? <Text style={{ color: colors.text2, fontSize: 12, marginTop: 3 }}>{e.note}</Text> : null}
              </View>
              <Text
                style={{
                  color: e.type === 'deposit' ? colors.green : colors.red,
                  fontWeight: '800',
                  fontSize: 14,
                  marginRight: 12,
                }}
              >
                {e.type === 'deposit' ? '+' : '-'}
                {fmtTk(e.amount)}
              </Text>
              <Pressable onPress={() => del(e)} hitSlop={8}>
                <Text style={{ color: colors.red, fontSize: 15 }}>✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>
    </ScreenScroll>
  );
}
