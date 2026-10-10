import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import {
  dbGetBroadcastsRaw,
  dbPostBroadcast,
  dbDeleteBroadcast,
  dbSetBroadcastPinned,
  logAudit,
  type Broadcast,
} from '../../src/lib/db';
import { ScreenScroll, Card, CardTitle, Loading, Centered, EmptyState } from '../../src/components/ui';
import { Button, Field, TextField, SegmentedControl, PickerField, Badge } from '../../src/components/form';
import { Icon } from '../../src/components/Icon';
import { useTheme, radius, radiusSm } from '../../src/theme';
import { useRouteProgress } from '../../src/components/motion';

const EXPIRY: { label: string; value: string }[] = [
  { label: 'Never', value: '' },
  { label: '6 hours', value: '6' },
  { label: '1 day', value: '24' },
  { label: '3 days', value: '72' },
  { label: '1 week', value: '168' },
];

export default function ManagerBroadcasts() {
  const { colors } = useTheme();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  useRouteProgress(loading);
  const [error, setError] = useState<string | null>(null);

  const [msg, setMsg] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [expiry, setExpiry] = useState('');
  const [pin, setPin] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBroadcasts(await dbGetBroadcastsRaw());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && broadcasts.length === 0) return <Loading label="Loading…" />;
  if (error && broadcasts.length === 0)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );

  const post = async () => {
    if (!msg.trim()) {
      Alert.alert('Message is required');
      return;
    }
    setBusy(true);
    try {
      await dbPostBroadcast(msg.trim(), priority, pin, expiry ? parseInt(expiry, 10) : null);
      await logAudit('create', 'broadcast', '', `Broadcast: "${msg.slice(0, 50)}"`);
      setMsg('');
      setPin(false);
      setPriority('normal');
      setExpiry('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  const del = (id: string) =>
    Alert.alert('Delete broadcast?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await dbDeleteBroadcast(id); load(); } },
    ]);

  return (
    <ScreenScroll
      title="Broadcasts"
      subtitle="Messages every member sees"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <Card>
        <CardTitle icon="broadcast">New broadcast</CardTitle>
        <View style={{ gap: 12 }}>
          <Field label="Message">
            <TextField value={msg} onChangeText={setMsg} placeholder="e.g. Pay rent by Friday" multiline />
          </Field>
          <Field label="Priority">
            <SegmentedControl
              options={[
                { label: 'Normal', value: 'normal' },
                { label: 'Urgent', value: 'urgent' },
              ]}
              value={priority}
              onChange={setPriority}
            />
          </Field>
          <Field label="Auto-expire">
            <PickerField options={EXPIRY} value={expiry} onChange={setExpiry} placeholder="Never" />
          </Field>
          <Pressable
            onPress={() => setPin((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg3, borderRadius: radiusSm, padding: 12 }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: pin ? colors.accent : colors.text3,
                backgroundColor: pin ? colors.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {pin ? <Icon name="check" size={12} color="#1a1816" /> : null}
            </View>
            <Text style={{ color: colors.text2, fontSize: 13 }}>Pin to top</Text>
          </Pressable>
          <Button label="Send broadcast" onPress={post} busy={busy} />
        </View>
      </Card>

      <CardTitle>Sent</CardTitle>
      {broadcasts.length === 0 ? (
        <Card>
          <EmptyState icon="broadcast" text="No broadcasts yet." />
        </Card>
      ) : (
        broadcasts.map((b) => {
          const expired = b.expires_at && new Date(b.expires_at) < new Date();
          return (
            <View
              key={b.id}
              style={{
                backgroundColor: b.priority === 'urgent' ? colors.redBg : b.pinned ? colors.accentBg : colors.bg2,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius,
                padding: 14,
                opacity: expired ? 0.6 : 1,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                {b.pinned ? <Badge text="PINNED" tone="amber" /> : null}
                {b.priority === 'urgent' ? <Badge text="URGENT" tone="red" /> : null}
                {expired ? <Badge text="EXPIRED" tone="muted" /> : null}
              </View>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{b.message}</Text>
              <View style={{ flexDirection: 'row', gap: 18, marginTop: 12 }}>
                <Pressable onPress={() => dbSetBroadcastPinned(b.id, !b.pinned).then(load)}>
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>
                    {b.pinned ? 'Unpin' : 'Pin'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => del(b.id)}>
                  <Text style={{ color: colors.red, fontSize: 13, fontWeight: '700' }}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </ScreenScroll>
  );
}
