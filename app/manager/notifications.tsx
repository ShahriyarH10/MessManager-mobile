import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import { dbGetNotifications, dbUpdateNotifStatus, type NotificationRow } from '../../src/lib/db';
import { ScreenScroll, Card, Loading, Centered } from '../../src/components/ui';
import { Badge } from '../../src/components/form';
import { fmtTk } from '../../src/core/format';
import { useTheme, radiusSm } from '../../src/theme';

const TYPE_LABEL: Record<string, { icon: string; label: string }> = {
  meal_update: { icon: '🍽️', label: 'updated a meal' },
  bazar_update: { icon: '🛒', label: 'updated bazar' },
  utility_update: { icon: '⚡', label: 'recorded a utility payment' },
  rent_update: { icon: '🏠', label: 'recorded a rent payment' },
  meal_request: { icon: '🍽️', label: 'meal entry' },
  bazar_request: { icon: '🛒', label: 'bazar entry' },
  bill_payment: { icon: '💡', label: 'utility / rent entry' },
};

export default function ManagerNotifications() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await dbGetNotifications());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markSeen = async (id: string) => {
    try {
      await dbUpdateNotifStatus(id, 'seen');
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status: 'seen' } : r)) ?? null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed.');
    }
  };

  const markAllSeen = async () => {
    const fresh = (rows ?? []).filter((r) => r.status === 'new' || r.status === 'pending');
    if (fresh.length === 0) return;
    try {
      await Promise.all(fresh.map((r) => dbUpdateNotifStatus(r.id, 'seen')));
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed.');
    }
  };

  if (loading && !rows) return <Loading label="Loading updates…" />;
  if (error && !rows)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );

  const freshCount = (rows ?? []).filter((r) => r.status === 'new' || r.status === 'pending').length;

  return (
    <ScreenScroll
      title="Member Updates"
      subtitle={`${freshCount} new`}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      {freshCount > 0 ? (
        <Pressable
          onPress={markAllSeen}
          style={{ backgroundColor: colors.bg3, borderRadius: radiusSm, paddingVertical: 11, alignItems: 'center' }}
        >
          <Text style={{ color: colors.text2, fontWeight: '700', fontSize: 13 }}>Mark all seen</Text>
        </Pressable>
      ) : null}

      {!rows || rows.length === 0 ? (
        <Centered>
          <Text style={{ fontSize: 34 }}>🔔</Text>
          <Text style={{ color: colors.text3 }}>No member updates yet.</Text>
        </Centered>
      ) : (
        rows.slice(0, 100).map((n) => {
          const meta = TYPE_LABEL[n.type] || { icon: '📋', label: n.type };
          const isNew = n.status === 'new' || n.status === 'pending';
          const d = n.data || {};
          return (
            <Card key={n.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <Text style={{ fontSize: 15 }}>{meta.icon}</Text>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{n.from_name}</Text>
                <Text style={{ color: colors.text3, fontSize: 12 }}>{meta.label}</Text>
                <Badge text={isNew ? 'New' : 'Seen'} tone={isNew ? 'amber' : 'green'} />
              </View>
              <Text style={{ color: colors.text3, fontSize: 11, marginBottom: 8 }}>
                📅 {n.date} · {new Date(n.created_at).toLocaleString()}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {(n.type === 'meal_update' || n.type === 'meal_request') && (
                  <>
                    <Chip text={`Day ${d.day ?? '—'}`} />
                    <Chip text={`Night ${d.night ?? '—'}`} />
                    <Chip text={`Total ${d.total ?? '—'}`} />
                  </>
                )}
                {(n.type === 'bazar_update' || n.type === 'bazar_request') && (
                  <Text style={{ color: colors.green, fontWeight: '700' }}>{fmtTk(Number(d.amount || 0))}</Text>
                )}
                {(n.type === 'utility_update' || n.type === 'rent_update' || n.type === 'bill_payment') && (
                  <>
                    <Chip text={d.billLabel || (n.type === 'rent_update' ? '🏠 Room Rent' : 'Utility')} />
                    <Text style={{ color: colors.green, fontWeight: '700' }}>{fmtTk(Number(d.amount || 0))}</Text>
                    {d.monthName ? <Chip text={`${d.monthName} ${d.year || ''}`} /> : null}
                  </>
                )}
              </View>
              {n.note ? (
                <Text style={{ color: colors.text2, fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                  “{n.note}”
                </Text>
              ) : null}
              {isNew ? (
                <Pressable onPress={() => markSeen(n.id)} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Mark seen</Text>
                </Pressable>
              ) : null}
            </Card>
          );
        })
      )}
    </ScreenScroll>
  );
}

function Chip({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.bg4, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: colors.text2, fontSize: 11 }}>{text}</Text>
    </View>
  );
}
