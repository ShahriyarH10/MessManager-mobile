import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, radius, radiusSm } from '../theme';

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
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardTitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return (
    <Text style={[{ color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 10 }, style]}>
      {children}
    </Text>
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
        borderTopWidth: accent ? 3 : 0,
        borderTopColor: accent,
        padding: 13,
      }}
    >
      <Text style={{ color: colors.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, gap: 14 }}
      refreshControl={refreshControl}
    >
      <View>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{title}</Text>
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
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 12, padding: 24 }}>
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
