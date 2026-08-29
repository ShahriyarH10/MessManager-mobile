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

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 0 = no data, 1‑4 = ascending heat buckets (GitHub‑style). */
function heatLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!(value > 0) || !(max > 0)) return 0;
  const t = value / max;
  if (t < 0.25) return 1;
  if (t < 0.5) return 2;
  if (t < 0.75) return 3;
  return 4;
}

const HEAT_ALPHA = [0, 0.16, 0.32, 0.5, 0.72];

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
  heatmap = true,
  maxMonthKey = todayStr().slice(0, 7),
}: {
  monthKey: string;
  onMonthChange: (key: string) => void;
  values: Record<string, number>;
  selectedDate?: string;
  onSelectDay: (date: string) => void;
  format?: (n: number) => string;
  accent?: string;
  heatmap?: boolean;
  maxMonthKey?: string;
}) {
  const { colors } = useTheme();
  const acc = accent ?? colors.accent;
  const accRgb = hexToRgb(acc);
  const monthMax = React.useMemo(() => {
    let mx = 0;
    for (const k in values) {
      if (k.startsWith(monthKey) && values[k] > mx) mx = values[k];
    }
    return mx;
  }, [values, monthKey]);
  const heatBg = (lvl: number) =>
    heatmap && accRgb && lvl > 0
      ? `rgba(${accRgb[0]}, ${accRgb[1]}, ${accRgb[2]}, ${HEAT_ALPHA[lvl]})`
      : null;
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
          const lvl = has ? heatLevel(raw as number, monthMax) : 0;
          const heat = heatBg(lvl);
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
                  borderColor: isSel ? acc : isToday ? colors.border2 : heat ? 'transparent' : colors.border,
                  backgroundColor: isSel ? colors.accentBg : heat ?? (has ? colors.bg3 : colors.bg2),
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    color: isToday ? acc : lvl >= 3 ? colors.text2 : colors.text3,
                    fontSize: 10,
                    fontWeight: isToday ? '800' : '600',
                  }}
                >
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

      {heatmap && accRgb && monthMax > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
          <Text style={{ color: colors.text3, fontSize: 9, fontWeight: '600' }}>Less</Text>
          {[0, 1, 2, 3, 4].map((l) => (
            <View
              key={l}
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: heatBg(l) ?? colors.bg2,
                borderWidth: l === 0 ? 1 : 0,
                borderColor: colors.border,
              }}
            />
          ))}
          <Text style={{ color: colors.text3, fontSize: 9, fontWeight: '600' }}>More</Text>
        </View>
      ) : null}
    </View>
  );
}
