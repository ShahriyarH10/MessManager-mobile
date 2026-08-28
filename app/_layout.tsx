import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { useTheme } from '../src/theme';

function RootStack() {
  const { colors, scheme } = useTheme();
  const stackScreen = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.bg1 },
    headerTitleStyle: { color: colors.text },
    headerTintColor: colors.accent,
    contentStyle: { backgroundColor: colors.bg },
  };
  return (
    <>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(member)" />
        <Stack.Screen name="(manager)" />
        <Stack.Screen name="profile" options={{ ...stackScreen, title: 'My Profile' }} />
        <Stack.Screen name="monthly-log" options={{ ...stackScreen, title: 'Monthly Log' }} />
        <Stack.Screen name="messages" options={{ ...stackScreen, title: 'Messages' }} />
        <Stack.Screen name="mess-info" options={{ ...stackScreen, title: 'Mess Info' }} />
        <Stack.Screen name="change-password" options={{ ...stackScreen, title: 'Change Password' }} />
        <Stack.Screen name="manager/meal-entry" options={{ ...stackScreen, title: 'Meal Entry' }} />
        <Stack.Screen name="manager/bazar-entry" options={{ ...stackScreen, title: 'Bazar Entry' }} />
        <Stack.Screen name="manager/utility-entry" options={{ ...stackScreen, title: 'Utility Entry' }} />
        <Stack.Screen name="manager/rent-entry" options={{ ...stackScreen, title: 'Room Rent' }} />
        <Stack.Screen name="manager/notifications" options={{ ...stackScreen, title: 'Member Updates' }} />
        <Stack.Screen name="manager/audit-log" options={{ ...stackScreen, title: 'Audit Log' }} />
        <Stack.Screen name="manager/member-edit" options={{ ...stackScreen, title: 'Member' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
