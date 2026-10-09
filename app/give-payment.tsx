import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { getSession } from '../src/lib/session';
import { dbGetMembers, dbGetMemberPayments } from '../src/lib/db';
import { loadCollectData, type CollectRow } from '../src/lib/collect';
import { submitMyPayment } from '../src/lib/memberActions';
import { printReceipt, shareReceiptPdf, shareReceiptText, toReceipt } from '../src/lib/receipt';
import { computeSplit, buildPaymentReceiptText, receiptNumber } from '../src/core/collect';
import { thisMonth, fmtTk, monthKey, monthLabelFromKey, round2 } from '../src/core/format';
import { ScreenScroll, Card, CardTitle, Loading, Centered } from '../src/components/ui';
import { Button, Field, NumberField, MonthYearField, Badge } from '../src/components/form';
import { useTheme } from '../src/theme';
import type { Member, MemberPayment } from '../src/core/types';

const TONE = { pending: 'amber', confirmed: 'green', rejected: 'red' } as const;
const STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', rejected: 'Rejected' } as const;

export default function GivePayment() {
  const { colors } = useTheme();
  const { mess } = useAuth();
  const messName = mess?.name ?? 'Mess';
  const t = thisMonth();
  const [month, setMonth] = useState(t.month);
  const [year, setYear] = useState(t.year);
  const [me, setMe] = useState<Member | null>(null);
  const [row, setRow] = useState<CollectRow | null>(null);
  const [payments, setPayments] = useState<MemberPayment[]>([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const key = monthKey(year, month);

  const load = useCallback(async () => {
    setError(null);
    const memberId = getSession()?.user.memberId;
    if (!memberId) {
      setError('Not signed in.');
      setLoading(false);
      return;
    }
    try {
      const [ms, res, pays] = await Promise.all([
        dbGetMembers(),
        loadCollectData(month, year),
        dbGetMemberPayments({ memberId }),
      ]);
      const mine = res.rows.find((r) => r.id === memberId) ?? null;
      setMe(ms.find((m) => m.id === memberId) ?? null);
      setRow(mine);
      setPayments(pays);
      const waiting = pays
        .filter((p) => p.status === 'pending' && p.month_key === key)
        .reduce((s, p) => s + Number(p.amount), 0);
      const left = mine ? round2(mine.total - waiting) : 0;
      setAmount(left > 0.01 ? String(left) : '');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [month, year, key]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const value = parseFloat(amount) || 0;
  const split = useMemo(
    () => (row ? computeSplit(value, row.mealRem, row.utilRem, row.rentRem, row.prevDue) : null),
    [row, value],
  );
  const waitingThisMonth = useMemo(
    () => payments.filter((p) => p.status === 'pending' && p.month_key === key).reduce((s, p) => s + Number(p.amount), 0),
    [payments, key],
  );

  if (loading && !row) return <Loading label="Loading your balance…" />;
  if (error && !row)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );
  if (!row || !me) return null;

  const submit = async () => {
    if (value <= 0) {
      Alert.alert('Enter an amount first');
      return;
    }
    setSaving(true);
    try {
      const p = await submitMyPayment(me, month, year, row.total, value);
      setOpenId(p.id);
      await load();
      Alert.alert('Request sent', 'The manager has been notified. Your receipt becomes official once they confirm it.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const owed = row.total < -0.01;
  const settled = row.total <= 0.01;

  return (
    <ScreenScroll
      title="Give Payment"
      subtitle="Tell the manager what you're paying — they confirm it"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <Field label="Settlement month">
        <MonthYearField month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </Field>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{row.name}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.text3, fontSize: 10, textTransform: 'uppercase' }}>
              {owed ? 'Mess owes you' : 'Total due'}
            </Text>
            <Text style={{ color: settled ? colors.green : colors.red, fontSize: 18, fontWeight: '800' }}>
              {fmtTk(Math.abs(row.total))}
            </Text>
          </View>
        </View>

        <View style={{ gap: 5, marginTop: 12 }}>
          <Line label="Previous due" value={row.prevDue} />
          <Line label="Rent" value={row.rentRem} />
          <Line label="Utility" value={row.utilRem} />
          <Line label="Meal balance" value={row.mealRem} surplus={row.mealRem < 0} />
        </View>

        {waitingThisMonth > 0 ? (
          <View style={{ backgroundColor: colors.accentBg, borderRadius: 8, padding: 10, marginTop: 12 }}>
            <Text style={{ color: colors.amber, fontSize: 12, fontWeight: '600' }}>
              {fmtTk(waitingThisMonth)} is waiting for the manager to confirm.
            </Text>
          </View>
        ) : null}

        {settled ? (
          <Text style={{ color: colors.green, fontSize: 12, marginTop: 12 }}>
            {owed
              ? 'You have nothing to pay — the manager will return your balance.'
              : `✓ You are fully settled for ${monthLabelFromKey(key)}.`}
          </Text>
        ) : (
          <>
            <View style={{ marginTop: 14 }}>
              <Field label="Amount you are giving (৳)">
                <NumberField value={amount} onChangeText={setAmount} placeholder="e.g. 1500" />
              </Field>
            </View>
            {split && value > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {split.allocPrevDue > 0 ? <Chip text={`Prev ${fmtTk(split.allocPrevDue)}`} tone={colors.red} bg={colors.redBg} /> : null}
                {split.allocRent > 0 ? <Chip text={`Rent ${fmtTk(split.allocRent)}`} tone={colors.amber} bg={colors.accentBg} /> : null}
                {split.allocUtil > 0 ? <Chip text={`Util ${fmtTk(split.allocUtil)}`} tone={colors.blue} bg={colors.blueBg} /> : null}
                {split.allocMeal > 0 ? <Chip text={`Meal ${fmtTk(split.allocMeal)}`} tone={colors.purple} bg={colors.purpleBg} /> : null}
                {split.change > 0 ? <Chip text={`Extra ${fmtTk(split.change)}`} tone={colors.green} bg={colors.greenBg} /> : null}
              </View>
            ) : null}
            <View style={{ marginTop: 14 }}>
              <Button label="Send payment to manager" onPress={submit} busy={saving} />
            </View>
            <Text style={{ color: colors.text3, fontSize: 10, marginTop: 8 }}>
              Nothing is credited until the manager confirms. Split order: previous due → rent → utility → meal.
            </Text>
          </>
        )}
      </Card>

      <Card>
        <CardTitle>My payments</CardTitle>
        {payments.length === 0 ? (
          <Text style={{ color: colors.text3, fontSize: 13 }}>No payments yet.</Text>
        ) : (
          payments.map((p, i) => {
            const open = openId === p.id;
            const r = toReceipt(p, messName);
            return (
              <View
                key={p.id}
                style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border, paddingVertical: 10 }}
              >
                <Pressable
                  onPress={() => setOpenId(open ? null : p.id)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <View>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                      {monthLabelFromKey(p.month_key)}
                    </Text>
                    <Text style={{ color: colors.text3, fontSize: 11 }}>
                      {receiptNumber(p.receipt_no)} · {new Date(p.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{fmtTk(Number(p.amount))}</Text>
                    <Badge text={STATUS_LABEL[p.status]} tone={TONE[p.status]} />
                  </View>
                </Pressable>
                {open ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Courier', lineHeight: 17 }}>
                      {buildPaymentReceiptText(r)}
                    </Text>
                    <View style={{ gap: 8, marginTop: 12 }}>
                      <Button label="Print" onPress={() => printReceipt(r)} />
                      <Button label="Share PDF" variant="ghost" onPress={() => shareReceiptPdf(r)} />
                      <Button label="Share text" variant="ghost" onPress={() => shareReceiptText(r)} />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </Card>
    </ScreenScroll>
  );
}

function Line({ label, value, surplus }: { label: string; value: number; surplus?: boolean }) {
  const { colors } = useTheme();
  const zero = value === 0 && !surplus;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.text2, fontSize: 12 }}>{label}</Text>
      {zero ? (
        <Text style={{ color: colors.text3, fontSize: 12 }}>✓ 0</Text>
      ) : (
        <Text style={{ color: surplus ? colors.green : colors.red, fontSize: 12, fontWeight: '600' }}>
          {surplus ? `+${fmtTk(Math.abs(value))}` : fmtTk(value)}
        </Text>
      )}
    </View>
  );
}

function Chip({ text, tone, bg }: { text: string; tone: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text style={{ color: tone, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}
