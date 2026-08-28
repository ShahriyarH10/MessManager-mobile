import React from 'react';
import { Text, type ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/theme';
import { Loading } from '../../src/components/ui';

function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 19, color }}>{icon}</Text>;
}

export default function ManagerLayout() {
  const { ready, user, area } = useAuth();
  const { colors } = useTheme();

  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (area !== 'manager') return <Redirect href="/(member)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarStyle: { backgroundColor: colors.bg1, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} /> }} />
      <Tabs.Screen name="entry" options={{ title: 'Entry', tabBarIcon: ({ color }) => <TabIcon icon="📝" color={color} /> }} />
      <Tabs.Screen name="collect" options={{ title: 'Collect', tabBarIcon: ({ color }) => <TabIcon icon="💰" color={color} /> }} />
      <Tabs.Screen name="people" options={{ title: 'Members', tabBarIcon: ({ color }) => <TabIcon icon="👥" color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon icon="⋯" color={color} /> }} />
    </Tabs>
  );
}
