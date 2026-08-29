import React, { useEffect, useRef, useState } from 'react';
import { View, Text, AppState, type AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import {
  configureNotifications,
  checkForNewBroadcasts,
  checkForMealUpdates,
  registerPushToken,
} from '../lib/push';
import { registerBackgroundPoll, unregisterBackgroundPoll } from '../lib/backgroundPoll';
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
  const running = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    configureNotifications();
  }, []);

  useEffect(() => onStaleChange(() => setStale(wasStaleServed())), []);
  useEffect(() => subscribeConnectivity(setOnline), []);

  useEffect(() => {
    if (!user) {
      if (timer.current) clearInterval(timer.current);
      unregisterBackgroundPoll();
      return;
    }
    registerPushToken().catch(() => {});
    registerBackgroundPoll();

    // One poll at a time. On resume the OS can deliver a queued interval tick
    // right after the AppState "active" event — without this guard both would
    // poll at once and each would raise its own notification for the same row.
    const run = async () => {
      if (running.current) return;
      running.current = true;
      try {
        await checkForNewBroadcasts();
        await checkForMealUpdates();
      } catch {
        /* best effort */
      } finally {
        running.current = false;
      }
    };

    const start = () => {
      if (timer.current) clearInterval(timer.current);
      run();
      timer.current = setInterval(run, POLL_MS);
    };

    start();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      appState.current = s;
      // Only on a real background -> foreground transition. Restart the interval
      // so its next tick is a full POLL_MS away, not an overdue catch-up fire.
      if (s === 'active' && !wasActive) start();
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
