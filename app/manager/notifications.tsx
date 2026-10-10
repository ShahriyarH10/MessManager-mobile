import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import { dbGetNotifications, dbUpdateNotifStatus, type NotificationRow } from '../../src/lib/db';
import { getSession } from '../../src/lib/session';
import { ScreenScroll, Card, Loading, Centered, EmptyState } from '../../src/components/ui';
import { Badge } from '../../src/components/form';
import { Icon, type IconName } from '../../src/components/Icon';
import { fmtTk } from '../../src/core/format';
import { useTheme, radiusSm } from '../../src/theme';
import { useRouteProgress } from '../../src/components/motion';

const TYPE_LABEL: Record<string, { icon: IconName; label: string }> = {
  meal_update: { icon: 'meals', label: 'updated a meal' },
  bazar_update: { icon: 'bazar', label: 'updated bazar' },
  utility_update: { icon: 'utility', label: 'recorded a utility payment' },
  rent_update: { icon: 'rent', label: 'recorded a rent payment' },
  payment_request: { icon: 'rent', label: 'wants to give a payment — confirm in Collect' },
  payment_confirmed: { icon: 'rent', label: 'confirmed a member payment' },
  payment_rejected: { icon: 'rent', label: 'rejected a member payment' },
  meal_request: { icon: 'meals', label: 'meal entry' },
  bazar_request: { icon: 'bazar', label: 'bazar entry' },
  bill_payment: { icon: 'utility', label: 'utility / rent entry' },
  meal_edit: { icon: 'meals', label: 'updated the meal sheet' },
  sub_edit_meal: { icon: 'meals', label: 'edited meals' },
  sub_edit_bazar: { icon: 'bazar', label: 'edited bazar' },
  sub_edit_rent: { icon: 'rent', label: 'edited rent' },
  sub_edit_utility: { icon: 'utility', label: 'edited utility' },
  sub_edit_member: { icon: 'members', label: 'changed member records' },
};

export default function ManagerNotifications() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  useRouteProgress(loading);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const myId = getSession()?.user.memberId;
      const all = await dbGetNotifications();
      // Hide the manager's own edits — this feed is about what everyone else does.
      setRows(all.filter((r) => r.from_id !== myId));
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
        <Card>
          <EmptyState icon="notifications" text="No member updates yet." />
        </Card>
      ) : (
        rows.slice(0, 100).map((n) => {
          const meta = TYPE_LABEL[n.type] || { icon: 'monthlyLog' as IconName, label: n.type };
          const isNew = n.status === 'new' || n.status === 'pending';
          const d = n.data || {};
          return (
            <Card key={n.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <Icon name={meta.icon} size={16} color={colors.text2} />
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{n.from_name}</Text>
                <Text style={{ color: colors.text3, fontSize: 12 }}>{meta.label}</Text>
                <Badge text={isNew ? 'New' : 'Seen'} tone={isNew ? 'amber' : 'green'} />
              </View>
              <Text style={{ color: colors.text3, fontSize: 11, marginBottom: 8 }}>
                {n.date} · {new Date(n.created_at).toLocaleString()}
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
                {(n.type === 'utility_update' || n.type === 'rent_update' || n.type === 'bill_payment' || n.type === 'payment_request') && (
                  <>
                    <Chip text={d.billLabel || (n.type === 'rent_update' ? 'Room Rent' : n.type === 'payment_request' ? 'Pending' : 'Utility')} />
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
