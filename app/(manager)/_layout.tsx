import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/theme';
import { Loading } from '../../src/components/ui';

const ICONS = {
  index: ['grid-outline', 'grid'],
  entry: ['create-outline', 'create'],
  collect: ['cash-outline', 'cash'],
  people: ['people-outline', 'people'],
  more: ['ellipsis-horizontal-outline', 'ellipsis-horizontal'],
} as const;

export default function ManagerLayout() {
  const { ready, user, area } = useAuth();
  const { colors } = useTheme();

  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (area !== 'manager') return <Redirect href="/(member)" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarStyle: { backgroundColor: colors.bg1, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused, size }) => {
          const pair = ICONS[route.name as keyof typeof ICONS] ?? ICONS.more;
          return <Ionicons name={(focused ? pair[1] : pair[0]) as any} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="entry" options={{ title: 'Entry' }} />
      <Tabs.Screen name="collect" options={{ title: 'Collect' }} />
      <Tabs.Screen name="people" options={{ title: 'Members' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
