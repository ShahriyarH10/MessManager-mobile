/**
 * Notifications.
 *
 * Expo Go (SDK 53+) does NOT deliver remote push, but LOCAL notifications work.
 * So we poll for new broadcasts while the app is open (and on resume) and raise
 * a local notification for anything unseen. In a dev/production build the same
 * code also registers an Expo push token for true background delivery.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { getSession } from './session';
import { dbGetActiveBroadcasts, dbGetRecentNotifications } from './db';

const SEEN_KEY = 'mm_push_seen_broadcasts';
const MEAL_SEEN_KEY = 'mm_push_seen_meal_updates';

let configured = false;

export function configureNotifications() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('broadcasts', {
      name: 'Broadcasts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
    }).catch(() => {});
  }
}

export async function ensurePermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  } catch {
    return false;
  }
}

/** Registers an Expo push token when running in a real build. No-op in Expo Go. */
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    if (!(await ensurePermission())) return null;
    const { data } = await Notifications.getExpoPushTokenAsync();
    return data ?? null;
  } catch {
    return null; // Expo Go can't get a token on SDK 53+
  }
}

/** Poll broadcasts and fire a local notification for any not seen before. */
export async function checkForNewBroadcasts(): Promise<void> {
  if (!getSession()?.user) return;
  let seen: string[] = [];
  try {
    seen = JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) || '[]');
  } catch {
    seen = [];
  }
  let bcs;
  try {
    bcs = await dbGetActiveBroadcasts();
  } catch {
    return;
  }
  const fresh = bcs.filter((b) => !seen.includes(b.id));
  // On the very first run just record the baseline — don't spam every broadcast.
  const firstRun = seen.length === 0;
  const nextSeen = bcs.map((b) => b.id);
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(nextSeen));
  if (firstRun) return;

  if (!(await ensurePermission())) return;
  for (const b of fresh.slice(0, 5)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: b.priority === 'urgent' ? 'Urgent broadcast' : 'New broadcast',
        body: b.message,
        ...(Platform.OS === 'android' ? { channelId: 'broadcasts' } : {}),
      },
      trigger: null,
    }).catch(() => {});
  }
}

/**
 * Poll meal-update notifications and raise a local notification for every member
 * whenever someone else changes a meal entry. Works in Expo Go.
 */
export async function checkForMealUpdates(): Promise<void> {
  const me = getSession()?.user;
  if (!me) return;

  let seen: string[] = [];
  try {
    seen = JSON.parse((await AsyncStorage.getItem(MEAL_SEEN_KEY)) || '[]');
  } catch {
    seen = [];
  }

  let rows;
  try {
    rows = await dbGetRecentNotifications(25);
  } catch {
    return;
  }
  const mealRows = rows.filter((r) => r.type === 'meal_update' || r.type === 'meal_edit');

  const firstRun = seen.length === 0;
  const nextSeen = mealRows.map((r) => r.id);
  await AsyncStorage.setItem(MEAL_SEEN_KEY, JSON.stringify(nextSeen.slice(0, 60)));
  if (firstRun) return;

  const fresh = mealRows.filter((r) => !seen.includes(r.id) && r.from_id !== me.memberId);
  if (fresh.length === 0) return;
  if (!(await ensurePermission())) return;

  for (const r of fresh.slice(0, 4)) {
    const d = r.data || {};
    const detail =
      d.day != null || d.night != null
        ? `Day ${d.day ?? 0} · Night ${d.night ?? 0}`
        : 'Meal sheet updated';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${r.from_name} updated a meal`,
        body: `${r.date} — ${detail}`,
        ...(Platform.OS === 'android' ? { channelId: 'broadcasts' } : {}),
      },
      trigger: null,
    }).catch(() => {});
  }
}
