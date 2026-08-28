import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import {
  dbGetActiveBroadcasts,
  dbGetAnnouncements,
  type Broadcast,
  type Announcement,
} from '../src/lib/db';
import { markMessagesRead } from '../src/lib/announceRead';
import { ScreenScroll, Card, Loading, Centered } from '../src/components/ui';
import { Badge } from '../src/components/form';
import { useTheme, radius } from '../src/theme';

type Item =
  | ({ kind: 'broadcast' } & Broadcast)
  | ({ kind: 'announcement' } & Announcement);

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Messages() {
  const { colors } = useTheme();
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bcs, anns] = await Promise.all([dbGetActiveBroadcasts(), dbGetAnnouncements()]);
      const merged: Item[] = [
        ...bcs.map((b) => ({ kind: 'broadcast' as const, ...b })),
        ...anns.map((a) => ({ kind: 'announcement' as const, ...a })),
      ].sort((x, y) => {
        if (!!(x as any).pinned !== !!(y as any).pinned) return (y as any).pinned ? 1 : -1;
        return new Date(y.created_at).getTime() - new Date(x.created_at).getTime();
      });
      setItems(merged);
      markMessagesRead();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !items) return <Loading label="Loading messages…" />;
  if (error && !items)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );

  return (
    <ScreenScroll
      title="Messages"
      subtitle="Broadcasts & announcements from your manager"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      {!items || items.length === 0 ? (
        <Centered>
          <Text style={{ fontSize: 40 }}>📢</Text>
          <Text style={{ color: colors.text3 }}>Nothing here yet.</Text>
        </Centered>
      ) : (
        items.map((it) => {
          const isBroadcast = it.kind === 'broadcast';
          const urgent = isBroadcast && (it as Broadcast).priority === 'urgent';
          const pinned = (it as any).pinned;
          return (
            <View
              key={it.kind + it.id}
              style={{
                backgroundColor: urgent ? colors.redBg : pinned ? colors.accentBg : colors.bg2,
                borderColor: urgent ? colors.red : pinned ? colors.accent : colors.border,
                borderWidth: 1,
                borderRadius: radius,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Text style={{ fontSize: 15 }}>{pinned ? '📌' : urgent ? '🔴' : isBroadcast ? '📢' : '📣'}</Text>
                {pinned ? <Badge text="PINNED" tone="amber" /> : null}
                {urgent ? <Badge text="URGENT" tone="red" /> : null}
                <Badge text={isBroadcast ? 'Broadcast' : 'Announcement'} tone="muted" />
              </View>
              {!isBroadcast ? (
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>
                  {(it as Announcement).title}
                </Text>
              ) : null}
              <Text style={{ color: colors.text2, fontSize: 14, lineHeight: 21 }}>
                {isBroadcast ? (it as Broadcast).message : (it as Announcement).body}
              </Text>
              <Text style={{ color: colors.text3, fontSize: 11, marginTop: 8 }}>
                {(it as any).author || 'Manager'} · {relativeTime(it.created_at)}
              </Text>
            </View>
          );
        })
      )}
    </ScreenScroll>
  );
}
