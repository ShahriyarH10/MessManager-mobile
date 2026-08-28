import React, { useEffect, useRef, useState } from 'react';
import { View, Text, AppState, type AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { configureNotifications, checkForNewBroadcasts, registerPushToken } from '../lib/push';
import { onStaleChange, wasStaleServed, subscribeConnectivity } from '../lib/offline';
import { useTheme } from '../theme';
import { Icon } from './Icon';

const POLL_MS = 60_000;

/**
 * Background services + the global offline strip. Mounted once inside the
 * providers, renders nothing unless the last data read was stale.
 */
export function AppServices() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stale, setStale] = useState(wasStaleServed());
  const [online, setOnline] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    configureNotifications();
  }, []);

  useEffect(() => onStaleChange(() => setStale(wasStaleServed())), []);
  useEffect(() => subscribeConnectivity(setOnline), []);

  useEffect(() => {
    if (!user) {
      if (timer.current) clearInterval(timer.current);
      return;
    }
    registerPushToken().catch(() => {});
    const run = () => checkForNewBroadcasts().catch(() => {});
    run();
    timer.current = setInterval(run, POLL_MS);
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') run();
    });
    return () => {
      if (timer.current) clearInterval(timer.current);
      sub.remove();
    };
  }, [user]);

  if (!stale && online) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + 4,
        paddingBottom: 6,
        paddingHorizontal: 12,
        backgroundColor: colors.bg3,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        zIndex: 1000,
      }}
      pointerEvents="none"
    >
      <Icon name="warning" size={13} color={colors.text3} />
      <Text style={{ color: colors.text3, fontSize: 12 }}>
        {online ? 'Showing saved data — reconnecting…' : "You're offline — showing saved data"}
      </Text>
    </View>
  );
}
