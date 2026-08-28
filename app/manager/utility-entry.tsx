import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import {
  dbGetMembers,
  dbGetUtility,
  dbGetUtilityMonth,
} from '../../src/lib/db';
import {
  saveUtilityBills,
  saveUtilityPayments,
  utilityPerHead,
  LockedMonthError,
} from '../../src/lib/managerActions';
import { thisMonth, monthKey, MONTHS, fmtTk, round2, previousMonthFromKey, monthLabelFromKey } from '../../src/core/format';
import {
  utilTotalFromBills,
  UTIL_PREPAID_KEYS,
  UTIL_POSTPAID_KEYS,
} from '../../src/core/settlement';
import { ScreenScroll, Card, CardTitle, StatCard, Loading, Centered } from '../../src/components/ui';
import { Button, Field, MonthYearField, Badge } from '../../src/components/form';
import { useTheme, radiusSm } from '../../src/theme';
import type { Member, UtilityRecord } from '../../src/core/types';

const BILL_FIELDS: { key: string; label: string; group: 'prepaid' | 'postpaid' }[] = [
  { key: 'elec', label: '⚡ Electricity', group: 'prepaid' },
  { key: 'gas', label: '🔥 Gas', group: 'prepaid' },
  { key: 'wifi', label: '📶 WiFi', group: 'prepaid' },
  { key: 'khala', label: '👩 Khala', group: 'postpaid' },
  { key: 'other', label: '📦 Other', group: 'postpaid' },
];

type PayRow = { paid: string; status: string; notes: string };

function autoStatus(perHead: number, paid: number): string {
  if (paid <= 0) return 'unpaid';
  if (paid >= perHead) return 'paid';
  return 'partial';
}

export default function UtilityEntry() {
  const { colors } = useTheme();
  const t = thisMonth();
  const [members, setMembers] = useState<Member[]>([]);
  const [history, setHistory] = useState<UtilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bills
  const [billMonth, setBillMonth] = useState(t.month);
  const [billYear, setBillYear] = useState(t.year);
  const [bills, setBills] = useState<Record<string, string>>({});
  const [savingBills, setSavingBills] = useState(false);

  // Payments
  const [payMonth, setPayMonth] = useState(t.month);
  const [payYear, setPayYear] = useState(t.year);
  const [payRows, setPayRows] = useState<Record<string, PayRow>>({});
  const [perHeadInfo, setPerHeadInfo] = useState({ perHead: 0, currentPrepaid: 0, previousPostpaid: 0 });
  const [credit, setCredit] = useState<Record<string, number>>({});
  const [savingPay, setSavingPay] = useState(false);

  const billKey = monthKey(billYear, billMonth);
  const payKey = monthKey(payYear, payMonth);

  const loadBase = useCallback(async () => {
    setError(null);
    try {
      const [ms, all] = await Promise.all([dbGetMembers(), dbGetUtility()]);
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
    let active = true;
    dbGetUtilityMonth(billKey).then((rec) => {
      if (!active) return;
      const next: Record<string, string> = {};
      BILL_FIELDS.forEach((f) => {
        const v = Number((rec?.bills as any)?.[f.key] || 0);
        next[f.key] = v ? String(v) : '';
      });
      setBills(next);
    });
    return () => {
      active = false;
    };
  }, [billKey]);

  useEffect(() => {
    if (members.length === 0) return;
    let active = true;
    const prevKey = previousMonthFromKey(payKey).key;
    Promise.all([dbGetUtilityMonth(payKey), utilityPerHead(payKey, prevKey, members.length)]).then(
      ([rec, info]) => {
        if (!active) return;
        setPerHeadInfo(info);
        const cr: Record<string, number> = {};
        const mc = ((rec?.bills as any)?.mess_credit || {}) as Record<string, number>;
        const cc = ((rec?.bills as any)?.change_credit || {}) as Record<string, number>;
        members.forEach((m) => {
          cr[m.name] = round2(Number(mc[m.name] || 0) + Number(cc[m.name] || 0));
        });
        setCredit(cr);
        const next: Record<string, PayRow> = {};
        members.forEach((m) => {
          const p = (rec?.payments || {})[m.name] || {};
          next[m.id] = { paid: String(Number(p.paid || 0)), status: p.status || 'unpaid', notes: p.notes || '' };
        });
        setPayRows(next);
      },
    );
    return () => {
      active = false;
    };
  }, [payKey, members]);

  const billPreview = useMemo(() => {
    const b: Record<string, number> = {};
    BILL_FIELDS.forEach((f) => (b[f.key] = parseFloat(bills[f.key] || '0')));
    const pre = utilTotalFromBills(b, UTIL_PREPAID_KEYS);
    const post = utilTotalFromBills(b, UTIL_POSTPAID_KEYS);
    const n = members.length || 1;
    return { pre, post, preShare: round2(pre / n), postShare: round2(post / n) };
  }, [bills, members]);

  const collected = useMemo(
    () => round2(members.reduce((s, m) => s + parseFloat(payRows[m.id]?.paid || '0'), 0)),
    [payRows, members],
  );

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

  const saveBills = async (group: 'prepaid' | 'postpaid') => {
    setSavingBills(true);
    try {
      const amounts: Record<string, number> = {};
      BILL_FIELDS.filter((f) => f.group === group).forEach((f) => {
        amounts[f.key] = parseFloat(bills[f.key] || '0');
      });
      await saveUtilityBills(billMonth, billYear, billKey, group, amounts);
      Alert.alert('Saved', `${group === 'prepaid' ? 'Prepaid' : 'Postpaid'} bills saved for ${MONTHS[billMonth]} ${billYear}.`);
      await loadBase();
    } catch (e: any) {
      Alert.alert(e instanceof LockedMonthError ? 'Month locked' : 'Error', e?.message ?? 'Could not save.');
    } finally {
      setSavingBills(false);
    }
  };

  const setPay = (id: string, field: keyof PayRow, value: string) => {
    setPayRows((prev) => {
      const r = { ...prev[id], [field]: value };
      if (field === 'paid') r.status = autoStatus(perHeadInfo.perHead, parseFloat(r.paid || '0'));
      return { ...prev, [id]: r };
    });
  };

  const markAllPaid = () => {
    setPayRows((prev) => {
      const next = { ...prev };
      members.forEach((m) => {
        const due = round2(Math.max(0, perHeadInfo.perHead - (credit[m.name] || 0)));
        next[m.id] = { ...next[m.id], paid: String(due), status: 'paid' };
      });
      return next;
    });
  };

  const savePayments = async () => {
    setSavingPay(true);
    try {
      const payload: Record<string, { paid: number; status: string; notes: string }> = {};
      members.forEach((m) => {
        const r = payRows[m.id] || { paid: '0', status: 'unpaid', notes: '' };
        payload[m.id] = { paid: parseFloat(r.paid || '0'), status: r.status, notes: r.notes };
      });
      await saveUtilityPayments(members, payMonth, payYear, payKey, payload);
      Alert.alert('Saved', 'Utility payments saved.');
      await loadBase();
    } catch (e: any) {
      Alert.alert(e instanceof LockedMonthError ? 'Month locked' : 'Error', e?.message ?? 'Could not save.');
    } finally {
      setSavingPay(false);
    }
  };

  return (
    <ScreenScroll title="Utility Entry" subtitle="Bills + member payment tracking">
      <Card>
        <CardTitle>Bills for one month</CardTitle>
        <Field label="Bill month">
          <MonthYearField month={billMonth} year={billYear} onChange={(m, y) => { setBillMonth(m); setBillYear(y); }} />
        </Field>
        <View style={{ gap: 10, marginTop: 12 }}>
          {BILL_FIELDS.map((f) => (
            <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: colors.text2, fontSize: 13, flex: 1 }}>{f.label}</Text>
              <TextInput
                value={bills[f.key] ?? ''}
                onChangeText={(t) => setBills((p) => ({ ...p, [f.key]: t.replace(/[^0-9.]/g, '') }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.text3}
                style={{
                  backgroundColor: colors.bg2,
                  borderColor: colors.border2,
                  borderWidth: 1,
                  borderRadius: 8,
                  color: colors.text,
                  fontSize: 15,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  width: 110,
                  textAlign: 'right',
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <StatCard label="🔵 Prepaid" value={fmtTk(billPreview.pre)} sub={`${fmtTk(billPreview.preShare)}/member`} accent={colors.blue} />
          <StatCard label="🔴 Postpaid" value={fmtTk(billPreview.post)} sub={`${fmtTk(billPreview.postShare)}/member`} accent={colors.red} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Button label="Save prepaid" onPress={() => saveBills('prepaid')} busy={savingBills} style={{ flex: 1 }} />
          <Button label="Save postpaid" onPress={() => saveBills('postpaid')} busy={savingBills} variant="ghost" style={{ flex: 1 }} />
        </View>
      </Card>

      <Card>
        <CardTitle>Member payments</CardTitle>
        <Field label="Settlement month">
          <MonthYearField month={payMonth} year={payYear} onChange={(m, y) => { setPayMonth(m); setPayYear(y); }} />
        </Field>
        <Text style={{ color: colors.text3, fontSize: 11, marginTop: 8 }}>
          Due/member = {MONTHS[payMonth]} prepaid ({fmtTk(perHeadInfo.currentPrepaid)}) + {monthLabelFromKey(previousMonthFromKey(payKey).key)} postpaid ({fmtTk(perHeadInfo.previousPostpaid)}) ÷ {members.length}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
          <StatCard label="Per member due" value={fmtTk(perHeadInfo.perHead)} accent={colors.accent} />
          <StatCard label="Collected" value={fmtTk(collected)} accent={colors.green} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          <Pressable onPress={markAllPaid}>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Mark all fully paid</Text>
          </Pressable>
        </View>

        <View style={{ gap: 10, marginTop: 8 }}>
          {members.map((m) => {
            const r = payRows[m.id] || { paid: '0', status: 'unpaid', notes: '' };
            const cr = credit[m.name] || 0;
            const due = round2(Math.max(0, perHeadInfo.perHead - cr));
            const tone = r.status === 'paid' ? 'green' : r.status === 'partial' ? 'amber' : 'red';
            return (
              <View key={m.id} style={{ backgroundColor: colors.bg3, borderRadius: radiusSm, padding: 10, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{m.name}</Text>
                  <Badge text={r.status} tone={tone as any} />
                </View>
                <Text style={{ color: colors.text3, fontSize: 11 }}>
                  Due {fmtTk(due)}
                  {cr > 0 ? `  ·  ↩ ${fmtTk(cr)} carried fwd` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text3, fontSize: 10, marginBottom: 3 }}>Paid ৳</Text>
                    <TextInput
                      value={r.paid}
                      onChangeText={(t) => setPay(m.id, 'paid', t.replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
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
                  <View style={{ flex: 1.4 }}>
                    <Text style={{ color: colors.text3, fontSize: 10, marginBottom: 3 }}>Notes</Text>
                    <TextInput
                      value={r.notes}
                      onChangeText={(t) => setPay(m.id, 'notes', t)}
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
                </View>
              </View>
            );
          })}
        </View>
        <View style={{ marginTop: 14 }}>
          <Button label="Save payments" onPress={savePayments} busy={savingPay} />
        </View>
      </Card>

      <Card>
        <CardTitle>Utility history</CardTitle>
        {history.length === 0 ? (
          <Text style={{ color: colors.text3, fontSize: 13 }}>No utility records yet.</Text>
        ) : (
          history.map((r, i) => {
            const prepaid = utilTotalFromBills(r.bills || {}, UTIL_PREPAID_KEYS);
            const postpaid = utilTotalFromBills(r.bills || {}, UTIL_POSTPAID_KEYS);
            const coll = round2(
              Object.values(r.payments || {}).reduce((s, p) => s + Number(p.paid || 0), 0),
            );
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
                    {monthLabelFromKey(r.month_key)}
                  </Text>
                  <Text style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>{fmtTk(coll)} collected</Text>
                </View>
                <Text style={{ color: colors.text3, fontSize: 11, marginTop: 2 }}>
                  Prepaid {fmtTk(prepaid)} · Postpaid {fmtTk(postpaid)}
                </Text>
              </View>
            );
          })
        )}
      </Card>
    </ScreenScroll>
  );
}
