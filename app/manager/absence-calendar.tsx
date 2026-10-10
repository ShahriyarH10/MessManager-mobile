import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { dbGetMembers, dbGetMeals, dbGetAttendanceRange } from '../../src/lib/db';
import { buildAbsenceMonth } from '../../src/core/absence';
import { thisMonth, monthKey, MONTHS } from '../../src/core/format';
import { ScreenScroll, Card, CardTitle, StatCard, Loading, Centered } from '../../src/components/ui';
import { MonthYearField, Badge } from '../../src/components/form';
import { useTheme, radiusSm, avatarCol } from '../../src/theme';
import { initials } from '../../src/core/format';
import type { Member, MealRow } from '../../src/core/types';
import { useRouteProgress } from '../../src/components/motion';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AbsenceCalendar() {
  const { colors } = useTheme();
  const t = thisMonth();
  const [month, setMonth] = useState(t.month);
  const [year, setYear] = useState(t.year);
  const [members, setMembers] = useState<Member[]>([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [att, setAtt] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useRouteProgress(loading);
  const [error, setError] = useState<string | null>(null);

  const key = monthKey(year, month);

  const load = useCallback(async () => {
    setError(null);
    try {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const [ms, allMeals, attRows] = await Promise.all([
        dbGetMembers(),
        dbGetMeals(),
        dbGetAttendanceRange(`${key}-01`, `${key}-${String(daysInMonth).padStart(2, '0')}`),
      ]);
      setMembers(ms);
      setMeals(allMeals);
      setAtt(attRows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [key, month, year]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const model = useMemo(
    () => (members.length ? buildAbsenceMonth(key, members, att as any, meals) : null),
    [key, members, att, meals],
  );

  if (loading && !model) return <Loading label="Loading calendar…" />;
  if (error && !model)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );
  if (!model) return null;

  const leading = Array.from({ length: model.firstDow });
  const attendancePct =
    model.confirmedDays > 0 ? Math.round((model.allAteDays / model.confirmedDays) * 100) : null;

  return (
    <ScreenScroll
      title="Absence Calendar"
      subtitle={`${MONTHS[month]} ${year}`}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <MonthYearField month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label="Members" value={members.length} />
        <StatCard label="Absence records" value={model.totalAbsenceDays} accent={colors.red} />
        <StatCard label="Days logged" value={model.confirmedDays} accent={colors.blue} />
        {attendancePct != null ? (
          <StatCard label="Full attendance" value={`${attendancePct}%`} accent={attendancePct >= 80 ? colors.green : colors.amber} />
        ) : null}
      </View>

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <Legend color={colors.green} label="All ate" />
          <Legend color={colors.red} label="All off" />
          <Legend color={colors.blue} label="Day off" />
          <Legend color={colors.amber} label="Night off" />
        </View>

        <View style={{ flexDirection: 'row' }}>
          {DOW.map((d, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.text3, fontSize: 10, fontWeight: '700' }}>
              {d}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
          {leading.map((_, i) => (
            <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 0.8 }} />
          ))}
          {model.cells.map((c) => {
            const border =
              c.isToday ? colors.accent : c.absentCount > 0 ? colors.red : c.hasData && c.isPast ? colors.green : colors.border;
            const bg =
              c.absentCount > 0
                ? colors.redBg
                : c.hasData && c.isPast
                ? colors.greenBg
                : c.isToday
                ? colors.accentBg
                : colors.bg2;
            return (
              <View key={c.day} style={{ width: `${100 / 7}%`, aspectRatio: 0.8, padding: 2 }}>
                <View
                  style={{
                    flex: 1,
                    borderRadius: 7,
                    borderWidth: 1,
                    borderColor: border,
                    backgroundColor: bg,
                    padding: 3,
                  }}
                >
                  <Text style={{ color: c.isToday ? colors.accent : colors.text3, fontSize: 10, fontWeight: '700' }}>
                    {c.day}
                  </Text>
                  {c.absentCount > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1, marginTop: 2 }}>
                      {[...c.allOff, ...c.dayOff, ...c.nightOff].slice(0, 6).map((m, idx) => {
                        const col = avatarCol(m.id);
                        const isDayOff = c.dayOff.includes(m);
                        const isNightOff = c.nightOff.includes(m);
                        const ring = isDayOff ? colors.blue : isNightOff ? colors.amber : colors.red;
                        return (
                          <View
                            key={idx}
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: col.bg,
                              borderWidth: 1.5,
                              borderColor: ring,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: col.fg, fontSize: 6, fontWeight: '800' }}>
                              {initials(m.name).slice(0, 1)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : c.hasData && c.isPast ? (
                    <Text style={{ color: colors.green, fontSize: 8, marginTop: 4 }}>✓</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {model.perMember.length > 0 ? (
        <Card>
          <CardTitle icon="members">Absence summary — {MONTHS[month]}</CardTitle>
          {model.perMember.map(({ member, allOff, dayOff, nightOff }) => (
            <View
              key={member.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{member.name}</Text>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {allOff > 0 ? <Badge text={`All ${allOff}d`} tone="red" /> : null}
                {dayOff > 0 ? <Badge text={`Day ${dayOff}d`} tone="amber" /> : null}
                {nightOff > 0 ? <Badge text={`Night ${nightOff}d`} tone="blue" /> : null}
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </ScreenScroll>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: colors.text2, fontSize: 11 }}>{label}</Text>
    </View>
  );
}
