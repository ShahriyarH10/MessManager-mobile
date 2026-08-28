/** Tracks the last time the member opened Broadcasts, for the unread badge. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSession } from './session';
import { dbGetActiveBroadcasts } from './db';

function key(): string | null {
  const id = getSession()?.user.memberId;
  return id ? `mm_broadcast_read_${id}` : null;
}

export async function markBroadcastsRead(): Promise<void> {
  const k = key();
  if (k) await AsyncStorage.setItem(k, new Date().toISOString());
}

export async function getUnreadBroadcastCount(): Promise<number> {
  const k = key();
  if (!k) return 0;
  const lastRead = (await AsyncStorage.getItem(k)) || '1970-01-01';
  try {
    const bcs = await dbGetActiveBroadcasts();
    const cutoff = new Date(lastRead).getTime();
    return bcs.filter((b) => new Date(b.created_at).getTime() > cutoff).length;
  } catch {
    return 0;
  }
}
