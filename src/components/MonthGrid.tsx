import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, radiusSm } from '../theme';
import { Icon } from './Icon';
import { MONTHS, todayStr } from '../core/format';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function shiftKey(key: string, delta: number): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1 + delta;
  const ny = y + Math.floor(m / 12);
  const nm = ((m % 12) + 12) % 12;
  return `${ny}-${String(nm + 1).padStart(2, '0')}`;
}

/**
 * A tappable month calendar. Each day shows an optional numeric value; tapping a
 * day calls onSelectDay with its YYYY-MM-DD string. Used by the meal / bazar
 * entry screens and the member bazar log.
 */
export function MonthGrid({
  monthKey,
  onMonthChange,
  values,
  selectedDate,
  onSelectDay,
  format = (n) => String(n),
  accent,
  maxMonthKey = todayStr().slice(0, 7),
}: {
  monthKey: string;
  onMonthChange: (key: string) => void;
  values: Record<string, number>;
  selectedDate?: string;
  onSelectDay: (date: string) => void;
  format?: (n: number) => string;
  accent?: string;
  maxMonthKey?: string;
}) {
  const { colors } = useTheme();
  const acc = accent ?? colors.accent;
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const today = todayStr();
  const canNext = monthKey < maxMonthKey;

  const nav = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    onMonthChange(shiftKey(monthKey, delta));
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Pressable onPress={() => nav(-1)} hitSlop={10} style={{ padding: 4 }}>
          <View style={{ transform: [{ scaleX: -1 }] }}>
            <Icon name="chevron" size={18} color={colors.text2} />
          </View>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
          {MONTHS[month]} {year}
        </Text>
        <Pressable onPress={() => (canNext ? nav(1) : null)} hitSlop={10} style={{ padding: 4, opacity: canNext ? 1 : 0.25 }}>
          <Icon name="chevron" size={18} color={colors.text2} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {DOW.map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.text3, fontSize: 10, fontWeight: '700' }}>
            {d}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (day == null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 0.82, padding: 2 }} />;
          const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
          const raw = values[dateStr];
          const has = raw != null && raw > 0;
          const isSel = dateStr === selectedDate;
          const isToday = dateStr === today;
          return (
            <View key={day} style={{ width: `${100 / 7}%`, aspectRatio: 0.82, padding: 2 }}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onSelectDay(dateStr);
                }}
                android_ripple={{ color: colors.border2 }}
                style={{
                  flex: 1,
                  borderRadius: radiusSm,
                  borderWidth: isSel ? 2 : 1,
                  borderColor: isSel ? acc : isToday ? colors.border2 : colors.border,
                  backgroundColor: isSel ? colors.accentBg : has ? colors.bg3 : colors.bg2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 2,
                }}
              >
                <Text style={{ color: isToday ? acc : colors.text3, fontSize: 10, fontWeight: isToday ? '800' : '600' }}>
                  {day}
                </Text>
                <Text
                  style={{ color: has ? colors.text : colors.text3, fontSize: 11, fontWeight: '800', marginTop: 1 }}
                  numberOfLines={1}
                >
                  {has ? format(raw as number) : '·'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
