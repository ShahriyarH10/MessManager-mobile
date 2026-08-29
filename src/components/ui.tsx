import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, radius, radiusSm } from '../theme';
import { Icon, type IconName } from './Icon';

const shadow = (elevation: number): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: elevation * 1.6,
      shadowOffset: { width: 0, height: elevation * 0.6 },
    },
    android: { elevation },
    default: {},
  }) ?? {};

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.bg2,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius,
          padding: 16,
        },
        shadow(1),
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardTitle({
  children,
  icon,
  style,
}: {
  children: React.ReactNode;
  icon?: IconName;
  style?: TextStyle;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}>
      {icon ? <Icon name={icon} size={16} color={colors.text2} /> : null}
      <Text style={[{ color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }, style]}>
        {children}
      </Text>
    </View>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '47%',
        backgroundColor: colors.bg3,
        borderRadius: radiusSm,
        borderLeftWidth: accent ? 3 : 0,
        borderLeftColor: accent,
        padding: 13,
      }}
    >
      <Text style={{ color: colors.text3, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 }}>
        {label}
      </Text>
      <Text style={{ color: accent ?? colors.text, fontSize: 21, fontWeight: '800', marginTop: 6 }}>
        {value}
      </Text>
      {sub ? <Text style={{ color: colors.text3, fontSize: 10, marginTop: 5 }}>{sub}</Text> : null}
    </View>
  );
}

export function Pill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

/** High-visibility pill for carry-forward / applied-credit status. */
export function CarryTag({
  text,
  icon = 'chevron',
  tone = 'blue',
  style,
}: {
  text: string;
  icon?: IconName;
  tone?: 'blue' | 'green' | 'amber';
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const fg = tone === 'green' ? colors.green : tone === 'amber' ? colors.amber : colors.blue;
  const bg = tone === 'green' ? colors.greenBg : tone === 'amber' ? colors.amberBg : colors.blueBg;
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: fg,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
          marginTop: 8,
        },
        style,
      ]}
    >
      <Icon name={icon} size={12} color={fg} />
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.2 }}>{text}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function ScreenScroll({
  title,
  subtitle,
  children,
  refreshControl,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: 16,
        paddingTop: insets.top + 14,
        paddingBottom: insets.bottom + 40,
        gap: 14,
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      <View style={{ marginBottom: 2 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.text3, fontSize: 13, marginTop: 3 }}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </ScrollView>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
        gap: 12,
        padding: 24,
      }}
    >
      {children}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <Centered>
      <ActivityIndicator color={colors.accent} />
      {label ? <Text style={{ color: colors.text3 }}>{label}</Text> : null}
    </Centered>
  );
}

export function EmptyState({ icon, text }: { icon?: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
      {icon ? <Icon name={icon} size={34} color={colors.text3} /> : null}
      <Text style={{ color: colors.text3, fontSize: 14, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

/** Small "offline / cached" banner. */
export function OfflineBanner({ show }: { show: boolean }) {
  const { colors } = useTheme();
  if (!show) return null;
  return (
    <View
      style={{
        backgroundColor: colors.bg3,
        borderRadius: radiusSm,
        paddingVertical: 7,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Icon name="warning" size={14} color={colors.text3} />
      <Text style={{ color: colors.text3, fontSize: 12 }}>Offline — showing saved data</Text>
    </View>
  );
}
