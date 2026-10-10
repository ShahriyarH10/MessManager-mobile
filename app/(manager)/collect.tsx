import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, RefreshControl, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../src/context/AuthContext';
import { dbGetMembers, dbGetMemberPayments } from '../../src/lib/db';
import { getSession } from '../../src/lib/session';
import { toReceipt, showReceiptAlert } from '../../src/lib/receipt';
import {
  loadCollectData,
  saveCollectRow,
  saveChangeRow,
  saveCreditRow,
  confirmMemberPayment,
  rejectMemberPayment,
  type CollectRow,
  type CollectData,
} from '../../src/lib/collect';
import { computeSplit, buildReceiptText, buildReceiptHtml } from '../../src/core/collect';
import { thisMonth, MONTHS, fmtTk, round2, monthLabelFromKey, monthKey } from '../../src/core/format';
import { ScreenScroll, Card, CardTitle, Loading, Centered, EmptyState, CarryTag } from '../../src/components/ui';
import { MonthYearField, Field, Button } from '../../src/components/form';
import { Icon } from '../../src/components/Icon';
import { useTheme, radiusSm } from '../../src/theme';
import type { Member, MemberPayment } from '../../src/core/types';
import { useRouteProgress } from '../../src/components/motion';

export default function Collect() {
  const { colors } = useTheme();
  const { mess } = useAuth();
  const t = thisMonth();
  const [month, setMonth] = useState(t.month);
  const [year, setYear] = useState(t.year);
  const [members, setMembers] = useState<Member[]>([]);
  const [cd, setCd] = useState<CollectData | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [cashBack, setCashBack] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  useRouteProgress(loading);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingPays, setPendingPays] = useState<MemberPayment[]>([]);

  const key = monthKey(year, month);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ms, res, pays] = await Promise.all([
        dbGetMembers(),
        loadCollectData(month, year),
        dbGetMemberPayments({ status: 'pending' }).catch(() => [] as MemberPayment[]),
      ]);
      setMembers(ms);
      setPendingPays(pays);
      setCd(res);
      const pre: Record<string, string> = {};
      res.rows.forEach((r) => {
        if (r.total > 0) pre[r.id] = String(r.total);
      });
      setAmounts(pre);
      setCashBack({});
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // A member is "owing" only when their net (this month + old dues) is positive.
  // If a meal surplus more than covers their dues, they belong in the return
  // section below — never in both.
  const owing = useMemo(() => (cd?.rows ?? []).filter((r) => r.total > 0.01), [cd]);

  // Every reason the mess has to hand money back to a member, folded into one row
  // per person: an overpayment from a Collect action (pending change) and/or a
  // negative net settlement (meal surplus, after netting old dues). Same member,
  // one card. Amounts already carried to next month are shown for context only.
  const returnRows = useMemo(() => {
    return (cd?.rows ?? [])
      .map((r) => {
        const changeRemaining = round2(Math.max(0, r.pendingChange));
        const settlementOwed = round2(Math.abs(Math.min(0, r.total)));
        const owesRemaining = round2(Math.max(0, settlementOwed - r.existingCarryCredit));
        return {
          r,
          changeRemaining,
          owesRemaining,
          total: round2(changeRemaining + owesRemaining),
          alreadyCarried: round2(r.existingChangeCredit + r.existingCarryCredit),
        };
      })
      .filter((x) => x.total > 0.01);
  }, [cd]);
  type ReturnRow = (typeof returnRows)[number];

  if (loading && !cd) return <Loading label="Loading…" />;
  if (error && !cd)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );

  const shareReceipt = async (r: CollectRow, amount: number, res: Awaited<ReturnType<typeof saveCollectRow>>) => {
    const data = {
      messName: mess?.name ?? 'Mess',
      memberName: r.name,
      monthLabel: monthLabelFromKey(key),
      timestamp: new Date(),
      amountReceived: amount,
      newNet: res.newNet,
      allocPrevDue: res.allocPrevDue,
      allocRent: res.allocRent,
      allocUtil: res.allocUtil,
      allocMeal: res.allocMeal,
      change: res.change,
    };
    Alert.alert('Payment saved', buildReceiptText(data), [
      { text: 'Done', style: 'cancel' },
      { text: 'Share text', onPress: () => Share.share({ message: buildReceiptText(data) }) },
      {
        text: 'Share PDF',
        onPress: async () => {
          try {
            const { uri } = await Print.printToFileAsync({ html: buildReceiptHtml(data) });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not create PDF.');
          }
        },
      },
    ]);
  };

  const onCollect = async (r: CollectRow) => {
    const amount = parseFloat(amounts[r.id] || '0');
    if (amount <= 0) {
      Alert.alert('Enter an amount first');
      return;
    }
    setSavingId(r.id);
    try {
      const res = await saveCollectRow(members, month, year, key, r, amount);
      await load();
      shareReceipt(r, amount, res);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save.');
    } finally {
      setSavingId(null);
    }
  };

  // One "return" action per member. Cash the manager hands over is applied to the
  // overpayment first, then to the settlement the mess owes; whatever is left of
  // either carries to next month. Both writes run sequentially (each reads fresh
  // state) and touch separate bill keys, so ordering them is safe.
  const onReturn = async (rr: ReturnRow) => {
    if (!cd) return;
    const { r } = rr;
    let cashLeft = Math.max(0, parseFloat(cashBack[r.id] || '0') || 0);
    setSavingId(r.id);
    try {
      let cashReturned = 0;
      let carried = 0;
      if (rr.changeRemaining > 0.01) {
        const give = Math.min(cashLeft, rr.changeRemaining);
        const res = await saveChangeRow(r.name, month, year, key, cd.nextMonth, cd.nextYear, cd.nextKey, r, give);
        cashReturned = round2(cashReturned + res.cashNow);
        carried = round2(carried + res.carry);
        cashLeft = round2(Math.max(0, cashLeft - res.cashNow));
      }
      if (rr.owesRemaining > 0.01) {
        const give = Math.min(cashLeft, rr.owesRemaining);
        const res = await saveCreditRow(r.name, month, year, key, cd.nextMonth, cd.nextYear, cd.nextKey, r, give);
        cashReturned = round2(cashReturned + res.cashNow);
        carried = round2(carried + res.carry);
      }
      await load();
      Alert.alert(
        'Return recorded',
        `Cash returned: ${fmtTk(cashReturned)}\nCarried to ${MONTHS[cd.nextMonth]} ${cd.nextYear}: ${fmtTk(carried)}`,
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed.');
    } finally {
      setSavingId(null);
    }
  };

  const confirmPay = async (p: MemberPayment) => {
    setSavingId(p.id);
    try {
      const done = await confirmMemberPayment(p, members, getSession()?.user.name ?? 'Manager');
      await load();
      showReceiptAlert('Payment confirmed', toReceipt(done, mess?.name ?? 'Mess'));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not confirm.');
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const rejectPay = (p: MemberPayment) =>
    Alert.alert('Reject payment?', `${p.member_name}'s ${fmtTk(Number(p.amount))} will not be counted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setSavingId(p.id);
          try {
            await rejectMemberPayment(p, getSession()?.user.name ?? 'Manager');
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not reject.');
            await load();
          } finally {
            setSavingId(null);
          }
        },
      },
    ]);

  const nextLabel = cd ? `${MONTHS[cd.nextMonth]} ${cd.nextYear}` : '';

  return (
    <ScreenScroll
      title="Collect Payment"
      subtitle="Cash a member hands over splits automatically"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <Field label="Settlement month">
        <MonthYearField month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </Field>
      <Text style={{ color: colors.text3, fontSize: 11 }}>
        Split order: previous due → rent → utility → meal. Extra becomes change.
      </Text>

      {pendingPays.length > 0 ? (
        <>
          <CardTitle icon="notifications">Member payments to confirm</CardTitle>
          {pendingPays.map((p) => (
            <Card key={p.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{p.member_name}</Text>
                  <Text style={{ color: colors.text3, fontSize: 11, marginTop: 2 }}>
                    {monthLabelFromKey(p.month_key)} · {new Date(p.created_at).toLocaleString()}
                  </Text>
                  {p.due_at_submit != null ? (
                    <Text style={{ color: colors.text3, fontSize: 11 }}>Owed when sent: {fmtTk(Number(p.due_at_submit))}</Text>
                  ) : null}
                </View>
                <Text style={{ color: colors.green, fontSize: 18, fontWeight: '800' }}>{fmtTk(Number(p.amount))}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Button label="Reject" variant="danger" onPress={() => rejectPay(p)} disabled={savingId === p.id} style={{ flex: 1 }} />
                <Button label="Confirm received" onPress={() => confirmPay(p)} busy={savingId === p.id} style={{ flex: 2 }} />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {owing.length === 0 && returnRows.length === 0 && pendingPays.length === 0 ? (
        <Card>
          <EmptyState icon="present" text={`All settled for ${MONTHS[month]} ${year}`} />
        </Card>
      ) : null}

      {owing.map((r) => {
        const amount = parseFloat(amounts[r.id] || '0');
        const split = computeSplit(amount, r.mealRem, r.utilRem, r.rentRem, r.prevDue);
        return (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{r.name}</Text>
                {r.messCredit > 0 ? (
                  <CarryTag icon="fund" tone="green" text={`−${fmtTk(r.messCredit)} carried-forward credit`} />
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.text3, fontSize: 10, textTransform: 'uppercase' }}>Total due</Text>
                <Text style={{ color: colors.red, fontSize: 18, fontWeight: '800' }}>{fmtTk(r.total)}</Text>
              </View>
            </View>

            {r.prevDue > 0.01 ? (
              <View
                style={{
                  backgroundColor: colors.redBg,
                  borderRadius: radiusSm,
                  padding: 8,
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon name="warning" size={13} color={colors.red} />
                <Text style={{ color: colors.red, fontSize: 12, fontWeight: '600' }}>
                  {fmtTk(r.prevDue)} unpaid from before
                </Text>
              </View>
            ) : null}

            <View style={{ gap: 5, marginTop: 10 }}>
              <Line label="Previous due" value={r.prevDue} colors={colors} />
              <Line label="Rent" value={r.rentRem} colors={colors} />
              <Line label="Utility" value={r.utilRem} colors={colors} />
              <Line label="Meal balance" value={r.mealRem} colors={colors} surplus={r.mealRem < 0} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.bg2,
                  borderColor: colors.border2,
                  borderWidth: 1,
                  borderRadius: radiusSm,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: colors.text3, fontSize: 16, fontWeight: '700' }}>৳</Text>
                <TextInput
                  value={amounts[r.id] ?? ''}
                  onChangeText={(x) => setAmounts((p) => ({ ...p, [r.id]: x.replace(/[^0-9.]/g, '') }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.text3}
                  style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: '700', paddingVertical: 11, textAlign: 'right' }}
                />
              </View>
              <Button label="Save" onPress={() => onCollect(r)} busy={savingId === r.id} style={{ paddingHorizontal: 22 }} />
            </View>

            {amount > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {split.allocPrevDue > 0 ? <Chip text={`Prev ${fmtTk(split.allocPrevDue)}`} tone={colors.red} bg={colors.redBg} /> : null}
                {split.allocRent > 0 ? <Chip text={`Rent ${fmtTk(split.allocRent)}`} tone={colors.amber} bg={colors.accentBg} /> : null}
                {split.allocUtil > 0 ? <Chip text={`Util ${fmtTk(split.allocUtil)}`} tone={colors.blue} bg={colors.blueBg} /> : null}
                {split.allocMeal > 0 ? <Chip text={`Meal ${fmtTk(split.allocMeal)}`} tone={colors.purple} bg={colors.purpleBg} /> : null}
                {split.change > 0 ? <Chip text={`Change ${fmtTk(split.change)}`} tone={colors.green} bg={colors.greenBg} /> : null}
              </View>
            ) : null}
          </Card>
        );
      })}

      {returnRows.length > 0 ? (
        <>
          <CardTitle icon="fund">Return amount to these members</CardTitle>
          {returnRows.map((rr) => {
            const { r } = rr;
            const cash = parseFloat(cashBack[r.id] || '0') || 0;
            const carry = round2(Math.max(0, rr.total - Math.min(cash, rr.total)));
            const parts: string[] = [];
            if (rr.changeRemaining > 0.01) parts.push(`${fmtTk(rr.changeRemaining)} overpaid`);
            if (rr.owesRemaining > 0.01) parts.push(`${fmtTk(rr.owesRemaining)} mess owes`);
            return (
              <Card key={'ret' + r.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{r.name}</Text>
                  <Text style={{ color: colors.green, fontWeight: '800' }}>{fmtTk(rr.total)} to return</Text>
                </View>
                {parts.length > 0 ? (
                  <Text style={{ color: colors.text3, fontSize: 11, marginTop: 4 }}>{parts.join(' · ')}</Text>
                ) : null}
                {rr.alreadyCarried > 0 ? (
                  <CarryTag text={`${fmtTk(rr.alreadyCarried)} already carried → ${nextLabel}`} />
                ) : null}
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <CashInput value={cashBack[r.id] ?? ''} onChange={(x) => setCashBack((p) => ({ ...p, [r.id]: x }))} colors={colors} />
                  <Button label="Save" onPress={() => onReturn(rr)} busy={savingId === r.id} style={{ paddingHorizontal: 22 }} />
                </View>
                {carry > 0 ? (
                  <CarryTag text={`Carries ${fmtTk(carry)} → ${nextLabel}`} />
                ) : (
                  <CarryTag tone="green" icon="check" text="Fully returned — nothing carried" />
                )}
                <Text style={{ color: colors.text3, fontSize: 10, marginTop: 6 }}>
                  Leave the box empty (৳0) to carry the whole amount forward.
                </Text>
              </Card>
            );
          })}
        </>
      ) : null}
    </ScreenScroll>
  );
}

function CashInput({ value, onChange, colors }: { value: string; onChange: (x: string) => void; colors: any }) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg2,
        borderColor: colors.border2,
        borderWidth: 1,
        borderRadius: radiusSm,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: colors.text3, fontSize: 15, fontWeight: '700' }}>৳</Text>
      <TextInput
        value={value}
        onChangeText={(x) => onChange(x.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="cash now"
        placeholderTextColor={colors.text3}
        style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', paddingVertical: 10, textAlign: 'right' }}
      />
    </View>
  );
}

function Line({ label, value, colors, surplus }: { label: string; value: number; colors: any; surplus?: boolean }) {
  if (value === 0 && !surplus) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text2, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: colors.text3, fontSize: 12 }}>✓ 0</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.text2, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: surplus ? colors.green : colors.red, fontSize: 12, fontWeight: '600' }}>
        {surplus ? `+${fmtTk(Math.abs(value))}` : fmtTk(value)}
      </Text>
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

