import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTheme, radiusSm } from '../theme';
import { Icon } from './Icon';
import type { Member } from '../core/types';

function num(t: string): number {
  const v = parseFloat(t.replace(/[^0-9.]/g, ''));
  return isNaN(v) ? 0 : v;
}

/** One numeric input per member (bazar, utility payment, single-value grids). */
export function MemberValueGrid({
  members,
  values,
  onChange,
  prefix = '৳',
  suffix,
  hint,
}: {
  members: Member[];
  values: Record<string, string>;
  onChange: (id: string, text: string) => void;
  prefix?: string;
  suffix?: (m: Member) => React.ReactNode;
  hint?: (m: Member) => string | undefined;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {members.map((m) => (
        <View
          key={m.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.bg3,
            borderRadius: radiusSm,
            padding: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{m.name}</Text>
            {hint?.(m) ? <Text style={{ color: colors.text3, fontSize: 11 }}>{hint(m)}</Text> : null}
          </View>
          {suffix?.(m)}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.bg2,
              borderColor: colors.border2,
              borderWidth: 1,
              borderRadius: radiusSm,
              paddingHorizontal: 8,
            }}
          >
            {prefix ? <Text style={{ color: colors.text3, fontSize: 13 }}>{prefix}</Text> : null}
            <TextInput
              value={values[m.id] ?? ''}
              onChangeText={(t) => onChange(m.id, t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.text3}
              style={{ color: colors.text, fontSize: 15, paddingVertical: 8, minWidth: 64, textAlign: 'right' }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Day + night inputs per member (meal entry). */
export function MemberMealGrid({
  members,
  values,
  onChange,
  absent,
}: {
  members: Member[];
  values: Record<string, { day: string; night: string }>;
  onChange: (id: string, part: 'day' | 'night', text: string) => void;
  absent?: Record<string, { day?: boolean; night?: boolean }>;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {members.map((m) => {
        const ab = absent?.[m.id];
        const isAbsent = ab?.day && ab?.night;
        return (
          <View
            key={m.id}
            style={{
              backgroundColor: colors.bg3,
              borderRadius: radiusSm,
              padding: 10,
              opacity: isAbsent ? 0.6 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{m.name}</Text>
              {ab?.day || ab?.night ? (
                <View style={{ backgroundColor: colors.redBg, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ color: colors.red, fontSize: 9, fontWeight: '700' }}>absent</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['day', 'night'] as const).map((part) => {
                const tint = part === 'day' ? colors.blue : colors.amber;
                const val = parseFloat(values[m.id]?.[part] || '0') || 0;
                return (
                  <View key={part} style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <Icon name={part} size={12} color={tint} />
                      <Text style={{ color: tint, fontSize: 11, fontWeight: '700' }}>
                        {part === 'day' ? 'Day' : 'Night'}
                      </Text>
                    </View>
                    <TextInput
                      value={values[m.id]?.[part] ?? '0'}
                      onChangeText={(t) => onChange(m.id, part, t.replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      style={{
                        backgroundColor: colors.bg2,
                        borderColor: ab?.[part] ? colors.red : val > 0 ? tint : colors.border2,
                        borderWidth: 1,
                        borderRadius: radiusSm,
                        color: colors.text,
                        fontSize: 15,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        textAlign: 'center',
                      }}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export { num };
