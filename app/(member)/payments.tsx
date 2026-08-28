import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import { getSession } from '../../src/lib/session';
import { dbGetMembers, dbGetRent, dbGetUtility } from '../../src/lib/db';
import { saveMyPayment, type PaymentType } from '../../src/lib/memberActions';
import { thisMonth, fmtTk, MONTHS } from '../../src/core/format';
import { ScreenScroll, Card, CardTitle, Loading, Centered } from '../../src/components/ui';
import { Button, Field, NumberField, TextField, MonthYearField, PickerField, Badge } from '../../src/components/form';
import { useTheme, radiusSm } from '../../src/theme';
import type { Member, RentRecord, UtilityRecord } from '../../src/core/types';

const TYPES: { label: string; value: PaymentType }[] = [
  { label: 'Electricity', value: 'elec' },
  { label: 'WiFi', value: 'wifi' },
  { label: 'Gas', value: 'gas' },
  { label: 'Khala', value: 'khala' },
  { label: 'Other', value: 'other' },
  { label: 'Room Rent', value: 'rent' },
];

function tone(status?: string) {
  return status === 'paid' ? 'green' : status === 'partial' ? 'amber' : 'red';
}

export default function Payments() {
  const { colors } = useTheme();
  const t = thisMonth();
  const [member, setMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [rent, setRent] = useState<RentRecord[]>([]);
  const [util, setUtil] = useState<UtilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(t.month);
  const [year, setYear] = useState(t.year);
  const [type, setType] = useState<PaymentType | ''>('');
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
      const [ms, r, u] = await Promise.all([dbGetMembers(), dbGetRent(), dbGetUtility()]);
      setMembers(ms);
      setMember(ms.find((m) => m.id === memberId) ?? null);
      setRent(r);
      setUtil(u);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rentHistory = useMemo(() => {
    if (!member) return [];
    return rent
      .map((r) => ({ rec: r, entry: (r.entries || []).find((e) => e.name === member.name) }))
      .filter((x) => x.entry && Number(x.entry!.paid || 0) > 0)
      .sort((a, b) => b.rec.month_key.localeCompare(a.rec.month_key))
      .slice(0, 10);
  }, [rent, member]);

  const utilHistory = useMemo(() => {
    if (!member) return [];
    return util
      .map((r) => ({ rec: r, pay: (r.payments || {})[member.name] }))
      .filter((x) => x.pay && Number(x.pay!.paid || 0) > 0)
      .sort((a, b) => b.rec.month_key.localeCompare(a.rec.month_key))
      .slice(0, 10);
  }, [util, member]);

  if (loading && !member) return <Loading label="Loading payments…" />;
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
    if (!type) {
      Alert.alert('Select a payment type');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await saveMyPayment(member, members, month, year, type, parseFloat(amount), note.trim());
      setAmount('');
      setNote('');
      Alert.alert('Saved', 'Payment recorded. The manager has been notified.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenScroll
      title="Utility & Rent"
      subtitle="Record a payment you've made"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <Card>
        <CardTitle>Record a payment</CardTitle>
        <Text style={{ color: colors.text3, fontSize: 12, marginBottom: 12 }}>
          Credited to you immediately. The manager gets an update notification.
        </Text>
        <View style={{ gap: 12 }}>
          <Field label="Month">
            <MonthYearField
              month={month}
              year={year}
              onChange={(m, y) => {
                setMonth(m);
                setYear(y);
              }}
            />
          </Field>
          <Field label="Payment type">
            <PickerField options={TYPES} value={type} onChange={setType} placeholder="— Select payment —" />
          </Field>
          <Field label="Amount paid (৳)">
            <NumberField value={amount} onChangeText={setAmount} placeholder="e.g. 1200" />
          </Field>
          <Field label="Note (optional)">
            <TextField value={note} onChangeText={setNote} placeholder="e.g. Paid full electricity bill" />
          </Field>
          <Button label="Save payment" onPress={onSave} busy={saving} />
        </View>
      </Card>

      <Card>
        <CardTitle>My rent payments</CardTitle>
        {rentHistory.length === 0 ? (
          <Text style={{ color: colors.text3, fontSize: 13 }}>No rent payments yet.</Text>
        ) : (
          rentHistory.map((x, i) => (
            <View
              key={x.rec.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                  {MONTHS[x.rec.month]} {x.rec.year}
                </Text>
                <Text style={{ color: colors.text3, fontSize: 11 }}>
                  Due {fmtTk(x.entry!.rent || 0)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={{ color: colors.green, fontSize: 14, fontWeight: '700' }}>
                  {fmtTk(x.entry!.paid || 0)}
                </Text>
                <Badge text={x.entry!.status || 'unpaid'} tone={tone(x.entry!.status)} />
              </View>
            </View>
          ))
        )}
      </Card>

      <Card>
        <CardTitle>My utility payments</CardTitle>
        {utilHistory.length === 0 ? (
          <Text style={{ color: colors.text3, fontSize: 13 }}>No utility payments yet.</Text>
        ) : (
          utilHistory.map((x, i) => (
            <View
              key={x.rec.id}
              style={{
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                  {MONTHS[x.rec.month]} {x.rec.year}
                </Text>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Text style={{ color: colors.green, fontSize: 14, fontWeight: '700' }}>
                    {fmtTk(x.pay!.paid || 0)}
                  </Text>
                  <Badge text={x.pay!.status || 'unpaid'} tone={tone(x.pay!.status)} />
                </View>
              </View>
              {x.pay!.notes ? (
                <Text style={{ color: colors.text3, fontSize: 11, marginTop: 3 }}>{x.pay!.notes}</Text>
              ) : null}
            </View>
          ))
        )}
      </Card>
    </ScreenScroll>
  );
}
