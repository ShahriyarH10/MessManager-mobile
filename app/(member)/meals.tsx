import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert, Modal, ScrollView } from 'react-native';
import { getSession } from '../../src/lib/session';
import {
  dbGetMeals,
  dbGetMembers,
  dbGetMealByDate,
  dbGetMyUpcomingAbsences,
  dbDeleteAttendance,
  type AttendanceRow,
} from '../../src/lib/db';
import { saveMyMeal, markAbsenceRange, clearAbsenceRange } from '../../src/lib/memberActions';
import { mealPartsFromObj, mealMemberTotal, memberMonthCalendar } from '../../src/core/meals';
import { todayStr, monthLabelFromKey, MONTHS, round2 } from '../../src/core/format';
import { ScreenScroll, Card, CardTitle, Loading, Centered } from '../../src/components/ui';
import { Button, Field, NumberField, TextField, DateField } from '../../src/components/form';
import { useTheme, radiusSm } from '../../src/theme';
import type { Member, MealRow } from '../../src/core/types';

export default function MealLog() {
  const { colors } = useTheme();
  const [member, setMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allMeals, setAllMeals] = useState<MealRow[]>([]);
  const [absences, setAbsences] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayStr());
  const [day, setDay] = useState('0');
  const [night, setNight] = useState('0');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [absFrom, setAbsFrom] = useState(todayStr());
  const [absTo, setAbsTo] = useState(todayStr());
  const [skipDay, setSkipDay] = useState(true);
  const [skipNight, setSkipNight] = useState(true);
  const [absBusy, setAbsBusy] = useState(false);

  const [calKey, setCalKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const memberId = getSession()?.user.memberId;
    if (!memberId) {
      setError('Not signed in.');
      setLoading(false);
      return;
    }
    try {
      const [ms, meals] = await Promise.all([dbGetMembers(), dbGetMeals()]);
      const me = ms.find((m) => m.id === memberId) ?? null;
      setMembers(ms);
      setMember(me);
      setAllMeals(meals);
      if (me) setAbsences(await dbGetMyUpcomingAbsences(me.id, todayStr()));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-fill day/night when the date changes
  useEffect(() => {
    if (!member || !date) return;
    let active = true;
    dbGetMealByDate(date).then((row) => {
      if (!active) return;
      const p = mealPartsFromObj(row?.meals || {}, member.name);
      setDay(String(p.day || 0));
      setNight(String(p.night || 0));
    });
    return () => {
      active = false;
    };
  }, [date, member]);

  const monthKeys = useMemo(() => {
    const keys = [
      ...new Set(allMeals.map((r) => String(r.date || '').slice(0, 7)).filter(Boolean)),
    ].sort().reverse();
    const cur = todayStr().slice(0, 7);
    if (!keys.includes(cur)) keys.unshift(cur);
    return keys.slice(0, 12);
  }, [allMeals]);

  if (loading && !member) return <Loading label="Loading meal log…" />;
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
    setSaving(true);
    try {
      await saveMyMeal(member, members, date, parseFloat(day || '0'), parseFloat(night || '0'), note.trim());
      setNote('');
      Alert.alert('Saved', 'Your meal was updated. The manager has been notified.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const runAbsence = async (mark: boolean) => {
    setAbsBusy(true);
    try {
      const n = mark
        ? await markAbsenceRange(member.id, absFrom, absTo, skipDay, skipNight)
        : await clearAbsenceRange(member.id, absFrom, absTo);
      Alert.alert(mark ? 'Marked absent' : 'Marked present', `${n} day${n === 1 ? '' : 's'} updated.`);
      setAbsences(await dbGetMyUpcomingAbsences(member.id, todayStr()));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update.');
    } finally {
      setAbsBusy(false);
    }
  };

  const cancelAbs = (id: string) => {
    Alert.alert('Cancel absence?', 'This date will count as present again.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel absence',
        style: 'destructive',
        onPress: async () => {
          try {
            await dbDeleteAttendance(id);
            setAbsences(await dbGetMyUpcomingAbsences(member.id, todayStr()));
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed.');
          }
        },
      },
    ]);
  };

  return (
    <>
      <ScreenScroll
        title="Meal Log"
        subtitle="Update your meal count & mark absences"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
      >
        <Card>
          <CardTitle>My meal entry</CardTitle>
          <Text style={{ color: colors.text3, fontSize: 12, marginBottom: 12 }}>
            Saved directly to your record. The manager gets an update notification.
          </Text>
          <View style={{ gap: 12 }}>
            <Field label="Date">
              <DateField value={date} onChange={setDate} />
            </Field>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Day meals">
                  <NumberField value={day} onChangeText={setDay} placeholder="0" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Night meals">
                  <NumberField value={night} onChangeText={setNight} placeholder="0" />
                </Field>
              </View>
            </View>
            <Field label="Note (optional)">
              <TextField value={note} onChangeText={setNote} placeholder="e.g. Updated my night meal" />
            </Field>
            <Button label="Save my meal" onPress={onSave} busy={saving} />
          </View>
        </Card>

        <Card>
          <CardTitle>Mark absence</CardTitle>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="From">
                  <DateField value={absFrom} onChange={setAbsFrom} minimumDate={new Date()} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="To">
                  <DateField value={absTo} onChange={setAbsTo} minimumDate={new Date()} />
                </Field>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Toggle label="Skip day" on={skipDay} onToggle={() => setSkipDay((v) => !v)} />
              <Toggle label="Skip night" on={skipNight} onToggle={() => setSkipNight((v) => !v)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Mark absent" onPress={() => runAbsence(true)} busy={absBusy} style={{ flex: 1 }} />
              <Button
                label="Mark present"
                variant="ghost"
                onPress={() => runAbsence(false)}
                busy={absBusy}
                style={{ flex: 1 }}
              />
            </View>
            <Text style={{ color: colors.text3, fontSize: 11 }}>
              Marks a whole date range at once. Your manager sees this on the attendance board.
            </Text>
          </View>
        </Card>

        <Card>
          <CardTitle>Upcoming absences</CardTitle>
          {absences.length === 0 ? (
            <Text style={{ color: colors.text3, fontSize: 13 }}>
              None — you're eating every meal.
            </Text>
          ) : (
            <View style={{ gap: 6 }}>
              {absences.map((a) => {
                const sd = !a.day_meal;
                const sn = !a.night_meal;
                return (
                  <View
                    key={a.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.redBg,
                      borderRadius: radiusSm,
                      padding: 10,
                    }}
                  >
                    <View>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{a.date}</Text>
                      <Text style={{ color: colors.text3, fontSize: 11 }}>
                        {sd && sn ? 'All meals off' : sd ? 'Day off' : 'Night off'}
                      </Text>
                    </View>
                    <Pressable onPress={() => cancelAbs(a.id)} hitSlop={8}>
                      <Text style={{ color: colors.red, fontWeight: '700' }}>✕</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <Card>
          <CardTitle>Month history</CardTitle>
          <Text style={{ color: colors.text3, fontSize: 12, marginBottom: 10 }}>
            Tap a month to see your meal calendar.
          </Text>
          <View style={{ gap: 8 }}>
            {monthKeys.map((k) => {
              const rows = allMeals.filter((r) => String(r.date || '').startsWith(k));
              let total = 0;
              let activeDays = 0;
              rows.forEach((r) => {
                const v = mealMemberTotal(r.meals || {}, member.name);
                if (v > 0) activeDays++;
                total += v;
              });
              return (
                <Pressable
                  key={k}
                  onPress={() => setCalKey(k)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: colors.bg3,
                    borderRadius: radiusSm,
                    padding: 12,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                    {monthLabelFromKey(k)}
                  </Text>
                  <Text style={{ color: colors.text2, fontSize: 13 }}>
                    {round2(total)} meals · {activeDays} days
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </ScreenScroll>

      <CalendarModal memberName={member.name} allMeals={allMeals} calKey={calKey} onClose={() => setCalKey(null)} />
    </>
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.bg3,
        borderColor: on ? colors.accent : colors.border,
        borderWidth: 1,
        borderRadius: radiusSm,
        padding: 10,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: on ? colors.accent : colors.text3,
          backgroundColor: on ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {on ? <Text style={{ color: '#1a1816', fontSize: 11, fontWeight: '900' }}>✓</Text> : null}
      </View>
      <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function CalendarModal({
  memberName,
  allMeals,
  calKey,
  onClose,
}: {
  memberName: string;
  allMeals: MealRow[];
  calKey: string | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  if (!calKey) return null;
  const cal = memberMonthCalendar(memberName, allMeals, calKey);
  const monthIdx = Number(calKey.slice(5, 7)) - 1;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.bg1,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            padding: 16,
            maxHeight: '82%',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
              {MONTHS[monthIdx]} {calKey.slice(0, 4)}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={{ color: colors.text3, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <Stat label="Total meals" value={cal.total} />
            <Stat label="Meal days" value={cal.activeDays} />
          </View>
          <ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {cal.days.map((d) => (
                <View
                  key={d.day}
                  style={{
                    width: '13.5%',
                    aspectRatio: 0.82,
                    borderRadius: 8,
                    backgroundColor: d.hasMeal ? colors.accentBg : colors.bg3,
                    borderWidth: d.hasMeal ? 1 : 0,
                    borderColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: colors.text3, fontSize: 10 }}>{d.day}</Text>
                  <Text style={{ color: d.hasMeal ? colors.accent : colors.text3, fontSize: 13, fontWeight: '800' }}>
                    {d.hasMeal ? d.total : '—'}
                  </Text>
                  {d.hasMeal ? (
                    <Text style={{ color: colors.text3, fontSize: 8 }}>
                      D{d.dayMeals} N{d.nightMeals}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg3, borderRadius: radiusSm, padding: 12 }}>
      <Text style={{ color: colors.text3, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{value}</Text>
    </View>
  );
}
