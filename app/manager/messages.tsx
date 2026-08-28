import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import {
  dbGetBroadcastsRaw,
  dbGetAnnouncements,
  dbPostBroadcast,
  dbDeleteBroadcast,
  dbSetBroadcastPinned,
  dbSaveAnnouncement,
  dbDeleteAnnouncement,
  logAudit,
  type Broadcast,
  type Announcement,
} from '../../src/lib/db';
import { ScreenScroll, Card, CardTitle, Loading, Centered } from '../../src/components/ui';
import { Button, Field, TextField, SegmentedControl, PickerField, Badge } from '../../src/components/form';
import { useTheme, radius, radiusSm } from '../../src/theme';

const EXPIRY: { label: string; value: string }[] = [
  { label: 'Never', value: '' },
  { label: '6 hours', value: '6' },
  { label: '1 day', value: '24' },
  { label: '3 days', value: '72' },
  { label: '1 week', value: '168' },
];

export default function ManagerMessages() {
  const { colors } = useTheme();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<'broadcast' | 'announcement'>('broadcast');
  const [bMsg, setBMsg] = useState('');
  const [bPriority, setBPriority] = useState<'normal' | 'urgent'>('normal');
  const [bExpiry, setBExpiry] = useState('');
  const [bPin, setBPin] = useState(false);
  const [aTitle, setATitle] = useState('');
  const [aBody, setABody] = useState('');
  const [aPin, setAPin] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [b, a] = await Promise.all([dbGetBroadcastsRaw(), dbGetAnnouncements()]);
      setBroadcasts(b);
      setAnnouncements(a);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && broadcasts.length === 0 && announcements.length === 0) return <Loading label="Loading…" />;
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
    setBusy(true);
    try {
      if (kind === 'broadcast') {
        if (!bMsg.trim()) {
          Alert.alert('Message is required');
          return;
        }
        await dbPostBroadcast(bMsg.trim(), bPriority, bPin, bExpiry ? parseInt(bExpiry, 10) : null);
        await logAudit('create', 'broadcast', '', `Broadcast: "${bMsg.slice(0, 50)}"`);
        setBMsg('');
        setBPin(false);
      } else {
        if (!aTitle.trim() || !aBody.trim()) {
          Alert.alert('Title and message are required');
          return;
        }
        await dbSaveAnnouncement({ title: aTitle.trim(), body: aBody.trim(), pinned: aPin });
        await logAudit('create', 'announcement', '', `Announcement: "${aTitle.slice(0, 50)}"`);
        setATitle('');
        setABody('');
        setAPin(false);
      }
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  const delBroadcast = (id: string) =>
    Alert.alert('Delete broadcast?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await dbDeleteBroadcast(id); load(); } },
    ]);
  const delAnnouncement = (id: string) =>
    Alert.alert('Delete announcement?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await dbDeleteAnnouncement(id); load(); } },
    ]);

  return (
    <ScreenScroll
      title="Messages"
      subtitle="Post broadcasts & announcements"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <Card>
        <CardTitle>New message</CardTitle>
        <SegmentedControl
          options={[
            { label: '📢 Broadcast', value: 'broadcast' },
            { label: '📣 Announcement', value: 'announcement' },
          ]}
          value={kind}
          onChange={setKind}
        />
        {kind === 'broadcast' ? (
          <View style={{ gap: 12, marginTop: 12 }}>
            <Field label="Message">
              <TextField value={bMsg} onChangeText={setBMsg} placeholder="e.g. Pay rent by Friday!" multiline />
            </Field>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Priority">
                  <SegmentedControl
                    options={[
                      { label: 'Normal', value: 'normal' },
                      { label: '🔴 Urgent', value: 'urgent' },
                    ]}
                    value={bPriority}
                    onChange={setBPriority}
                  />
                </Field>
              </View>
            </View>
            <Field label="Auto-expire">
              <PickerField options={EXPIRY} value={bExpiry} onChange={setBExpiry} placeholder="Never" />
            </Field>
            <PinToggle on={bPin} onToggle={() => setBPin((v) => !v)} />
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 12 }}>
            <Field label="Title">
              <TextField value={aTitle} onChangeText={setATitle} placeholder="e.g. Rent due reminder" />
            </Field>
            <Field label="Message">
              <TextField value={aBody} onChangeText={setABody} placeholder="Write your message…" multiline />
            </Field>
            <PinToggle on={aPin} onToggle={() => setAPin((v) => !v)} />
          </View>
        )}
        <View style={{ marginTop: 14 }}>
          <Button label="Post" onPress={post} busy={busy} />
        </View>
      </Card>

      <CardTitle>Broadcasts</CardTitle>
      {broadcasts.length === 0 ? (
        <Card>
          <Text style={{ color: colors.text3 }}>No broadcasts.</Text>
        </Card>
      ) : (
        broadcasts.map((b) => (
          <View
            key={b.id}
            style={{
              backgroundColor: b.priority === 'urgent' ? colors.redBg : b.pinned ? colors.accentBg : colors.bg2,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius,
              padding: 14,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
              {b.pinned ? <Badge text="PINNED" tone="amber" /> : null}
              {b.priority === 'urgent' ? <Badge text="URGENT" tone="red" /> : null}
              {b.expires_at && new Date(b.expires_at) < new Date() ? <Badge text="EXPIRED" tone="muted" /> : null}
            </View>
            <Text style={{ color: colors.text, fontSize: 14 }}>{b.message}</Text>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
              <Pressable onPress={() => dbSetBroadcastPinned(b.id, !b.pinned).then(load)}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                  {b.pinned ? 'Unpin' : 'Pin'}
                </Text>
              </Pressable>
              <Pressable onPress={() => delBroadcast(b.id)}>
                <Text style={{ color: colors.red, fontSize: 12, fontWeight: '700' }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <CardTitle>Announcements</CardTitle>
      {announcements.length === 0 ? (
        <Card>
          <Text style={{ color: colors.text3 }}>No announcements.</Text>
        </Card>
      ) : (
        announcements.map((a) => (
          <View
            key={a.id}
            style={{
              backgroundColor: a.pinned ? colors.accentBg : colors.bg2,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius,
              padding: 14,
            }}
          >
            {a.pinned ? <Badge text="PINNED" tone="amber" /> : null}
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: a.pinned ? 6 : 0 }}>
              {a.title}
            </Text>
            <Text style={{ color: colors.text2, fontSize: 13, marginTop: 4 }}>{a.body}</Text>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
              <Pressable onPress={() => dbSaveAnnouncement({ id: a.id, title: a.title, body: a.body, pinned: !a.pinned }).then(load)}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                  {a.pinned ? 'Unpin' : 'Pin'}
                </Text>
              </Pressable>
              <Pressable onPress={() => delAnnouncement(a.id)}>
                <Text style={{ color: colors.red, fontSize: 12, fontWeight: '700' }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScreenScroll>
  );
}

function PinToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg3, borderRadius: radiusSm, padding: 12 }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: on ? colors.accent : colors.text3,
          backgroundColor: on ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {on ? <Text style={{ color: '#1a1816', fontSize: 11, fontWeight: '900' }}>✓</Text> : null}
      </View>
      <Text style={{ color: colors.text2, fontSize: 13 }}>📌 Pin to top</Text>
    </Pressable>
  );
}
