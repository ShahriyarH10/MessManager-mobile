/** Tracks the last time the member opened Messages, for the unread badge. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSession } from './session';
import { dbGetActiveBroadcasts, dbGetAnnouncements } from './db';

function key(): string | null {
  const id = getSession()?.user.memberId;
  return id ? `mm_announce_read_${id}` : null;
}

export async function markMessagesRead(): Promise<void> {
  const k = key();
  if (k) await AsyncStorage.setItem(k, new Date().toISOString());
}

export async function getUnreadMessageCount(): Promise<number> {
  const k = key();
  if (!k) return 0;
  const lastRead = (await AsyncStorage.getItem(k)) || '1970-01-01';
  try {
    const [bcs, anns] = await Promise.all([dbGetActiveBroadcasts(), dbGetAnnouncements()]);
    const cutoff = new Date(lastRead).getTime();
    const nb = bcs.filter((b) => new Date(b.created_at).getTime() > cutoff).length;
    const na = anns.filter((a) => new Date(a.created_at).getTime() > cutoff).length;
    return nb + na;
  } catch {
    return 0;
  }
}
