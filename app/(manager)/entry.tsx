import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScroll } from '../../src/components/ui';
import { useTheme, radius } from '../../src/theme';

const ITEMS: { icon: string; label: string; desc: string; href: string }[] = [
  { icon: '🍽️', label: 'Meal Entry', desc: 'Log day/night meals for every member', href: '/manager/meal-entry' },
  { icon: '🛒', label: 'Bazar Entry', desc: 'Record grocery spending per member', href: '/manager/bazar-entry' },
  { icon: '⚡', label: 'Utility Entry', desc: 'Bills + member payment tracking', href: '/manager/utility-entry' },
  { icon: '🏠', label: 'Room Rent', desc: 'Set rent and track collection', href: '/manager/rent-entry' },
  { icon: '🔔', label: 'Member Updates', desc: 'Activity from member self-service edits', href: '/manager/notifications' },
];

export default function EntryHub() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <ScreenScroll title="Entry" subtitle="Record meals, bazar, bills and rent">
      <View style={{ gap: 10 }}>
        {ITEMS.map((it) => (
          <Pressable
            key={it.href}
            onPress={() => router.push(it.href as any)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              backgroundColor: colors.bg2,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius,
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 24 }}>{it.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{it.label}</Text>
              <Text style={{ color: colors.text3, fontSize: 12, marginTop: 2 }}>{it.desc}</Text>
            </View>
            <Text style={{ color: colors.text3, fontSize: 18 }}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScreenScroll>
  );
}
