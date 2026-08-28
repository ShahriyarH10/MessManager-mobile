import React from 'react';
import { Text, type ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/theme';
import { Loading } from '../../src/components/ui';

function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

export default function TabsLayout() {
  const { ready, user } = useAuth();
  const { colors } = useTheme();

  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarStyle: {
          backgroundColor: colors.bg1,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Meals',
          tabBarIcon: ({ color }) => <TabIcon icon="🍽️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bazar"
        options={{
          title: 'Bazar',
          tabBarIcon: ({ color }) => <TabIcon icon="🛒" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon icon="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
