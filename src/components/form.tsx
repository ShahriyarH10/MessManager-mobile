import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, radiusSm } from '../theme';
import { MONTHS, todayStr } from '../core/format';
import { Icon, type IconName } from './Icon';

function tap() {
  Haptics.selectionAsync().catch(() => {});
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary' ? colors.accent : variant === 'danger' ? colors.redBg : 'transparent';
  const fg =
    variant === 'primary' ? '#1a1816' : variant === 'danger' ? colors.red : colors.text;
  const border = variant === 'ghost' ? colors.border2 : 'transparent';
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      disabled={busy || disabled}
      android_ripple={{ color: colors.border2 }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderRadius: radiusSm,
          paddingVertical: 13,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy || disabled ? 0.55 : pressed && Platform.OS === 'ios' ? 0.7 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={{ color: fg, fontWeight: '800', fontSize: 15 }}>{label}</Text>
      )}
    </Pressable>
  );
}

/** iOS/Android-native list row with leading icon + trailing chevron. */
export function ListRow({
  icon,
  label,
  sublabel,
  onPress,
  first,
  tone,
  right,
}: {
  icon?: IconName;
  label: string;
  sublabel?: string;
  onPress: () => void;
  first?: boolean;
  tone?: 'default' | 'danger' | 'accent';
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const color = tone === 'danger' ? colors.red : tone === 'accent' ? colors.accent : colors.text;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      android_ripple={{ color: colors.border2 }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 52,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
        backgroundColor: pressed && Platform.OS === 'ios' ? colors.bg3 : 'transparent',
      })}
    >
      {icon ? <Icon name={icon} size={20} color={color} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color, fontSize: 15 }}>{label}</Text>
        {sublabel ? (
          <Text style={{ color: colors.text3, fontSize: 12, marginTop: 1 }}>{sublabel}</Text>
        ) : null}
      </View>
      {right ?? <Icon name="chevron" size={18} color={colors.text3} />}
    </Pressable>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      {children}
    </View>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  autoCapitalize,
  secureTextEntry,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  secureTextEntry?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.text3}
      keyboardType={keyboardType}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      secureTextEntry={secureTextEntry}
      style={{
        backgroundColor: colors.bg2,
        borderColor: colors.border2,
        borderWidth: 1,
        borderRadius: radiusSm,
        color: colors.text,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 16,
        minHeight: multiline ? 84 : undefined,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

export function NumberField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <TextField
      value={value}
      onChangeText={(t) => onChangeText(t.replace(/[^0-9.]/g, ''))}
      placeholder={placeholder}
      keyboardType="decimal-pad"
    />
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bg3,
        borderRadius: radiusSm,
        padding: 3,
        flexWrap: 'wrap',
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={{
              flexGrow: 1,
              flexBasis: options.length > 3 ? '30%' : undefined,
              paddingVertical: 9,
              paddingHorizontal: 10,
              borderRadius: radiusSm - 2,
              backgroundColor: active ? colors.accent : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: active ? '#1a1816' : colors.text2, fontSize: 12, fontWeight: '700' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ text, tone }: { text: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'muted' }) {
  const { colors } = useTheme();
  const map = {
    green: [colors.green, colors.greenBg],
    amber: [colors.amber, colors.amberBg],
    red: [colors.red, colors.redBg],
    blue: [colors.blue, colors.blueBg],
    muted: [colors.text3, colors.bg3],
  } as const;
  const [fg, bg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: fg, fontSize: 10, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

/* ── Date field ─────────────────────────────────────────── */

export function DateField({
  value,
  onChange,
  minimumDate,
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  minimumDate?: Date;
}) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  const dateObj = value ? new Date(value + 'T00:00:00') : new Date();

  return (
    <>
      <Pressable
        onPress={() => setShow(true)}
        style={{
          backgroundColor: colors.bg2,
          borderColor: colors.border2,
          borderWidth: 1,
          borderRadius: radiusSm,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 16 }}>{value || 'Pick a date'}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={(event, d) => {
            setShow(Platform.OS === 'ios');
            if (event.type === 'set' && d) onChange(todayStr(d));
            if (Platform.OS === 'android') setShow(false);
          }}
        />
      )}
    </>
  );
}

/* ── Month / Year field ─────────────────────────────────── */

export function MonthYearField({
  month,
  year,
  onChange,
}: {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const years = Array.from({ length: 9 }, (_, i) => now.getFullYear() - 5 + i);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: colors.bg2,
          borderColor: colors.border2,
          borderWidth: 1,
          borderRadius: radiusSm,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 16 }}>
          {MONTHS[month]} {year}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.bg1,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 16,
              gap: 12,
              maxHeight: '70%',
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Select month</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <ScrollView style={{ flex: 1, maxHeight: 260 }}>
                {MONTHS.map((m, i) => (
                  <Pressable
                    key={m}
                    onPress={() => onChange(i, year)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: radiusSm,
                      backgroundColor: i === month ? colors.accentBg : 'transparent',
                    }}
                  >
                    <Text style={{ color: i === month ? colors.accent : colors.text, fontWeight: i === month ? '700' : '400' }}>
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView style={{ width: 90, maxHeight: 260 }}>
                {years.map((y) => (
                  <Pressable
                    key={y}
                    onPress={() => onChange(month, y)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: radiusSm,
                      backgroundColor: y === year ? colors.accentBg : 'transparent',
                    }}
                  >
                    <Text style={{ color: y === year ? colors.accent : colors.text, fontWeight: y === year ? '700' : '400' }}>
                      {y}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Button label="Done" onPress={() => setOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function PickerField<T extends string>({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { label: string; value: T }[];
  value: T | '';
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: colors.bg2,
          borderColor: colors.border2,
          borderWidth: 1,
          borderRadius: radiusSm,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <Text style={{ color: current ? colors.text : colors.text3, fontSize: 16 }}>
          {current?.label ?? placeholder ?? 'Select'}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.bg1,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 16,
              gap: 4,
              maxHeight: '70%',
            }}
          >
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    paddingVertical: 13,
                    paddingHorizontal: 12,
                    borderRadius: radiusSm,
                    backgroundColor: o.value === value ? colors.accentBg : 'transparent',
                  }}
                >
                  <Text style={{ color: o.value === value ? colors.accent : colors.text, fontSize: 15 }}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
