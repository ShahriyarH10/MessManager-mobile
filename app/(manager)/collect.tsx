import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, RefreshControl, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../src/context/AuthContext';
import { dbGetMembers } from '../../src/lib/db';
import { loadCollectData, saveCollectRow, type CollectRow } from '../../src/lib/collect';
import { computeSplit, buildReceiptText, buildReceiptHtml } from '../../src/core/collect';
import { thisMonth, MONTHS, fmtTk, round2, monthLabelFromKey, monthKey } from '../../src/core/format';
import { ScreenScroll, Card, CardTitle, Loading, Centered } from '../../src/components/ui';
import { MonthYearField, Field } from '../../src/components/form';
import { useTheme, radiusSm } from '../../src/theme';
import type { Member } from '../../src/core/types';

export default function Collect() {
  const { colors } = useTheme();
  const { mess } = useAuth();
  const t = thisMonth();
  const [month, setMonth] = useState(t.month);
  const [year, setYear] = useState(t.year);
  const [members, setMembers] = useState<Member[]>([]);
  const [rows, setRows] = useState<CollectRow[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const key = monthKey(year, month);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ms, res] = await Promise.all([dbGetMembers(), loadCollectData(month, year)]);
      setMembers(ms);
      setRows(res.rows);
      const pre: Record<string, string> = {};
      res.rows.forEach((r) => {
        if (r.total > 0) pre[r.id] = String(r.total);
      });
      setAmounts(pre);
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

  const owing = useMemo(() => rows.filter((r) => r.total > 0.01 || r.prevDue > 0.01), [rows]);

  if (loading && rows.length === 0) return <Loading label="Loading…" />;
  if (error && rows.length === 0)
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

  const onSave = async (r: CollectRow) => {
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

  return (
    <ScreenScroll
      title="Collect Payment"
      subtitle="Cash a member hands over is split automatically"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <Field label="Settlement month">
        <MonthYearField month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </Field>
      <Text style={{ color: colors.text3, fontSize: 11 }}>
        Split order: previous due → rent → utility → meal. Extra shows as change.
      </Text>

      {owing.length === 0 ? (
        <Centered>
          <Text style={{ fontSize: 36 }}>✅</Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>All settled for {MONTHS[month]} {year}</Text>
        </Centered>
      ) : (
        owing.map((r) => {
          const amount = parseFloat(amounts[r.id] || '0');
          const split = computeSplit(amount, r.mealRem, r.utilRem, r.rentRem, r.prevDue);
          return (
            <Card key={r.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{r.name}</Text>
                  {r.messCredit > 0 ? (
                    <Text style={{ color: colors.blue, fontSize: 11 }}>↩ {fmtTk(r.messCredit)} credit applied</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.text3, fontSize: 10, textTransform: 'uppercase' }}>Total due</Text>
                  <Text style={{ color: colors.red, fontSize: 18, fontWeight: '800' }}>{fmtTk(r.total)}</Text>
                </View>
              </View>

              {r.prevDue > 0.01 ? (
                <View style={{ backgroundColor: colors.redBg, borderRadius: radiusSm, padding: 8, marginTop: 10 }}>
                  <Text style={{ color: colors.red, fontSize: 12, fontWeight: '600' }}>
                    ⚠ {fmtTk(r.prevDue)} unpaid from before
                  </Text>
                </View>
              ) : null}

              <View style={{ gap: 5, marginTop: 10 }}>
                <Line label="⏪ Previous due" value={r.prevDue} colors={colors} />
                <Line label="🏠 Rent" value={r.rentRem} colors={colors} />
                <Line label="⚡ Utility" value={r.utilRem} colors={colors} />
                <Line
                  label="🍽️ Meal balance"
                  value={r.mealRem}
                  colors={colors}
                  surplus={r.mealRem < 0}
                />
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
                <Pressable
                  onPress={() => onSave(r)}
                  disabled={savingId === r.id}
                  style={{
                    backgroundColor: colors.accent,
                    borderRadius: radiusSm,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    opacity: savingId === r.id ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: '#1a1816', fontWeight: '800' }}>{savingId === r.id ? '…' : 'Save'}</Text>
                </Pressable>
              </View>

              {amount > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {split.allocPrevDue > 0 ? <Chip text={`⏪ ${fmtTk(split.allocPrevDue)}`} tone={colors.red} bg={colors.redBg} /> : null}
                  {split.allocRent > 0 ? <Chip text={`🏠 ${fmtTk(split.allocRent)}`} tone={colors.amber} bg={colors.accentBg} /> : null}
                  {split.allocUtil > 0 ? <Chip text={`⚡ ${fmtTk(split.allocUtil)}`} tone={colors.blue} bg={colors.blueBg} /> : null}
                  {split.allocMeal > 0 ? <Chip text={`🍽️ ${fmtTk(split.allocMeal)}`} tone={colors.purple} bg={colors.purpleBg} /> : null}
                  {split.change > 0 ? <Chip text={`💸 Change ${fmtTk(split.change)}`} tone={colors.green} bg={colors.greenBg} /> : null}
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </ScreenScroll>
  );
}

function Line({
  label,
  value,
  colors,
  surplus,
}: {
  label: string;
  value: number;
  colors: any;
  surplus?: boolean;
}) {
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
