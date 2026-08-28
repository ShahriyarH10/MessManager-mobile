import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { dbGetActiveBroadcasts, type Broadcast } from '../src/lib/db';
import { markBroadcastsRead } from '../src/lib/announceRead';
import { ScreenScroll, Card, Loading, Centered, EmptyState } from '../src/components/ui';
import { Badge } from '../src/components/form';
import { Icon } from '../src/components/Icon';
import { useTheme, radius } from '../src/theme';

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
  const [items, setItems] = useState<Broadcast[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const bcs = await dbGetActiveBroadcasts();
      setItems(bcs);
      markBroadcastsRead();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !items) return <Loading label="Loading broadcasts…" />;
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
      title="Broadcasts"
      subtitle="Messages from your manager"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      {!items || items.length === 0 ? (
        <Card>
          <EmptyState icon="broadcast" text="No broadcasts right now." />
        </Card>
      ) : (
        items.map((b) => {
          const urgent = b.priority === 'urgent';
          return (
            <View
              key={b.id}
              style={{
                backgroundColor: urgent ? colors.redBg : b.pinned ? colors.accentBg : colors.bg2,
                borderColor: urgent ? colors.red : b.pinned ? colors.accent : colors.border,
                borderWidth: 1,
                borderRadius: radius,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <Icon
                  name={b.pinned ? 'pin' : urgent ? 'warning' : 'broadcast'}
                  size={16}
                  color={urgent ? colors.red : b.pinned ? colors.accent : colors.text2}
                />
                {b.pinned ? <Badge text="PINNED" tone="amber" /> : null}
                {urgent ? <Badge text="URGENT" tone="red" /> : null}
              </View>
              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{b.message}</Text>
              <Text style={{ color: colors.text3, fontSize: 12, marginTop: 10 }}>
                {b.author || 'Manager'} · {relativeTime(b.created_at)}
              </Text>
            </View>
          );
        })
      )}
    </ScreenScroll>
  );
}
