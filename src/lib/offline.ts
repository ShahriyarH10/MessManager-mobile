/**
 * Offline read-through cache.
 *
 * Every mess-scoped list read goes through `withCache`: it tries the network,
 * and on success writes the result to AsyncStorage. If the network call fails
 * (no connection, timeout) it falls back to the last cached value and flags the
 * session as "serving stale data" so the UI can show an offline banner.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getSession } from './session';

const PREFIX = 'mm_cache_';

let staleServed = false;
const listeners = new Set<() => void>();

export function wasStaleServed(): boolean {
  return staleServed;
}
export function onStaleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setStale(v: boolean) {
  if (staleServed === v) return;
  staleServed = v;
  listeners.forEach((l) => l());
}

function scopedKey(name: string): string {
  const mess = getSession()?.mess?.id ?? 'nomess';
  return `${PREFIX}${mess}_${name}`;
}

export async function withCache<T>(name: string, fetcher: () => Promise<T>): Promise<T> {
  const key = scopedKey(name);
  try {
    const data = await fetcher();
    setStale(false);
    AsyncStorage.setItem(key, JSON.stringify({ t: Date.now(), data })).catch(() => {});
    return data;
  } catch (err) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        setStale(true);
        return parsed.data as T;
      }
    } catch {
      /* fall through */
    }
    throw err;
  }
}

/** Wipe all cached data (call on sign-out). */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    /* ignore */
  }
  setStale(false);
}

export function subscribeConnectivity(onChange: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    onChange(!!state.isConnected);
  });
}
